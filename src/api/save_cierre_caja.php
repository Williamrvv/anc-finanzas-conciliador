<?php
ini_set('display_errors', 0); // Prohíbe a PHP escupir HTML
error_reporting(E_ALL);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
// Cargar la conexión TSD solo si existe para evitar fatal errors
if (file_exists('tsd_db.php')) {
    require_once 'tsd_db.php'; 
}

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data || empty($data['transacciones'])) {
    echo json_encode(['success' => false, 'error' => 'Datos incompletos o vacíos.']);
    exit;
}

$sucursalesRaw = $data['sucursales'] ?? '';
$emailUsuario = $_SESSION['user']['email'] ?? null;

if (!$emailUsuario) {
    echo json_encode(['success' => false, 'error' => 'Error de sesión: Correo de usuario no encontrado.']);
    exit;
}

try {
    // ==============================================================
    // 1. VALIDACIÓN DE ICD EN TSD, PAGO POR PAGO
    // Antes se validaba la lista de ICD que mandaba el navegador, y sólo
    // los ICD existentes: un pago SIN ICD pasaba sin revisión.
    // Ahora el servidor consulta TSD con el ID de cada pago y exige:
    //   a) que tenga ICD  b) que el ICD exista  c) que esté cerrado.
    // IRI sólo LEE TSD; nunca escribe en él.
    // ==============================================================
    if (!class_exists('TSDDatabase')) {
        echo json_encode(['success' => false, 'error' => "No hay conexión con TSD para validar los ICD.\n\nNo se guardó nada. Intente de nuevo en unos minutos."]);
        exit;
    }

    $contratoPorId = [];
    $sinIdTsd = [];
    foreach ($data['transacciones'] as $t) {
        $id = trim((string)($t['id_tsd'] ?? ''));
        if ($id === '') { $sinIdTsd[] = $t['contrato'] ?? '?'; continue; }
        $contratoPorId[$id] = $t['contrato'] ?? '?';
    }

    if (count($sinIdTsd) > 0) {
        echo json_encode(['success' => false, 'error' => "Hay transacciones sin identificador de TSD ("
            . implode(', ', array_slice($sinIdTsd, 0, 10)) . ").\n\nRecargue la facturación antes de guardar."]);
        exit;
    }

    $pdoTsd = TSDDatabase::connect();
    $mapaIcd = [];

    foreach (array_chunk(array_keys($contratoPorId), 1000) as $lote) {
        $in = str_repeat('?,', count($lote) - 1) . '?';
        $stmtIcd = $pdoTsd->prepare("
            SELECT CAST(P.ID AS varchar(50))                                   AS IdTsd,
                   LTRIM(RTRIM(CAST(P.dbr AS varchar(50))))                    AS ICD,
                   D.DBRNum,
                   D.POST_FLAG,
                   CONVERT(varchar(19), TRY_CONVERT(datetime, D.POST_DATE), 120) AS PostDate
            FROM dbo.Cpay P
            LEFT JOIN dbo.DBR D ON D.DBRNum = P.dbr
            WHERE P.ID IN ($in)
        ");
        $stmtIcd->execute(array_map('strval', $lote));
        foreach ($stmtIcd->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $mapaIcd[trim((string)$r['IdTsd'])] = $r;
        }
    }

    $noEncontrados = [];
    $sinIcd = [];
    $inexistentes = [];
    $abiertos = [];

    foreach ($contratoPorId as $id => $contrato) {
        $r = $mapaIcd[(string)$id] ?? null;
        if (!$r) { $noEncontrados[] = $contrato; continue; }

        $icd = (string)($r['ICD'] ?? '');
        if ($icd === '' || $icd === '0') { $sinIcd[] = $contrato; continue; }
        if (empty($r['DBRNum']))         { $inexistentes[$icd] = true; continue; }
        if (empty($r['POST_FLAG']) || $r['POST_FLAG'] == '0') { $abiertos[$icd] = true; }
    }

    $lista = function (array $v) {
        $v = array_values(array_unique($v));
        $txt = implode(', ', array_slice($v, 0, 15));
        return count($v) > 15 ? $txt . ' y ' . (count($v) - 15) . ' más' : $txt;
    };

    $problemas = [];
    if ($sinIcd)        $problemas[] = "• Pagos SIN ICD en TSD (contratos): " . $lista($sinIcd) . "\n  Cree en TSD el ICD que los incluya.";
    if ($inexistentes)  $problemas[] = "• ICD que no existen en TSD: " . $lista(array_keys($inexistentes));
    if ($abiertos)      $problemas[] = "• ICD aún ABIERTOS en TSD: " . $lista(array_keys($abiertos)) . "\n  Ciérrelos en TSD antes de guardar.";
    if ($noEncontrados) $problemas[] = "• Pagos que ya no aparecen en TSD (contratos): " . $lista($noEncontrados) . "\n  Recargue la facturación.";

    if (count($problemas) > 0) {
        echo json_encode([
            'success'    => false,
            'bloqueoIcd' => true,
            'error'      => "⚠️ No se puede guardar el cierre.\n\n" . implode("\n\n", $problemas) . "\n\nNo se guardó nada."
        ]);
        exit;
    }

    // Hora oficial del cierre: la del ICD en TSD (la más reciente si son varios)
    $icdsServidor = [];
    $fechaCierreTsd = null;
    foreach ($mapaIcd as $r) {
        $icdsServidor[$r['ICD']] = true;
        if (!empty($r['PostDate']) && ($fechaCierreTsd === null || $r['PostDate'] > $fechaCierreTsd)) {
            $fechaCierreTsd = $r['PostDate'];
        }
    }
    $icdsServidor = implode(', ', array_keys($icdsServidor));

    // 2. GUARDADO EN BASE DE DATOS LOCAL
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // Cabecera
    $sqlHeader = "INSERT INTO Tbl_CierreCaja_Header 
                  (ICD, Sucursal, UsuarioRegistroTSD, FechaRegistroTSD, EmailUsuario, TotalVerificadoCRC, TotalVerificadoUSD, TransaccionesEscaneadas, TotalTransacciones) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    // FechaRegistroTSD = hora oficial de cierre del ICD en TSD (POST_DATE)
    $fechaTSD = $fechaCierreTsd ? str_replace(' ', 'T', $fechaCierreTsd) : date('Y-m-d\TH:i:s');

    $stmtH = $pdo->prepare($sqlHeader);
    $stmtH->execute([
        $icdsServidor, $sucursalesRaw, 'Múltiples AR', $fechaTSD,
        $emailUsuario, floatval($data['total_crc'] ?? 0), floatval($data['total_usd'] ?? 0),
        intval($data['total_escaneadas'] ?? 0), intval($data['total_transacciones'] ?? 0)
    ]);
    
    $idCierre = $pdo->lastInsertId();

    // ==============================================================
    // CANDADO ANTI-DUPLICADOS
    // El filtro de get_facturacion_cc.php corre al CARGAR, no al
    // GUARDAR. 
    // ==============================================================
    $idsTSD = [];
    foreach ($data['transacciones'] as $t) {
        $id = trim((string)($t['id_tsd'] ?? ''));
        if ($id !== '') $idsTSD[] = $id;
    }

    if (count($idsTSD) > 0) {
        $inIds = str_repeat('?,', count($idsTSD) - 1) . '?';
        $stmtDup = $pdo->prepare("
            SELECT D.ID_Transaccion_TSD, D.IdCierre, H.FechaCierre, H.EmailUsuario
            FROM Tbl_CierreCaja_Detalle D
            INNER JOIN Tbl_CierreCaja_Header H ON H.IdCierre = D.IdCierre
            WHERE D.ID_Transaccion_TSD IN ($inIds)
        ");
        $stmtDup->execute($idsTSD);
        $yaExisten = $stmtDup->fetchAll(PDO::FETCH_ASSOC);

        if (count($yaExisten) > 0) {
            $pdo->rollBack();
            $primero = $yaExisten[0];
            echo json_encode([
                'success' => false,
                'yaGuardado' => true,
                'idCierreExistente' => $primero['IdCierre'],
                'error' => "Este cierre YA fue registrado anteriormente.\n\n"
                         . count($yaExisten) . " transaccion(es) de esta pantalla ya existen en el folio #"
                         . $primero['IdCierre'] . ", guardado el " . $primero['FechaCierre']
                         . " por " . $primero['EmailUsuario'] . ".\n\n"
                         . "No se creó un cierre nuevo. Recargue la facturación para ver el estado actual."
            ]);
            exit;
        }
    }

    // Detalle
    $sqlDetail = "INSERT INTO Tbl_CierreCaja_Detalle 
                  (IdCierre, Numero_Contrato, NombreCliente, Tipo_Tarjeta, Numero_Autorizacion, MontoUSD, TipoCambio, MontoCRC, MatchExitoso, Fecha_Transaccion, ID_Transaccion_TSD, ICD_TSD, FechaCierreICD) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmtD = $pdo->prepare($sqlDetail);

    foreach ($data['transacciones'] as $t) {
        // Formateo estricto ISO8601
        $fechaSegura = null;
        if (!empty($t['fecha_pago'])) {
            $timestamp = strtotime(str_replace('.000', '', $t['fecha_pago']));
            if ($timestamp !== false) {
                $fechaSegura = date('Y-m-d\TH:i:s', $timestamp);
            }
        }

        $idTsdFila = trim((string)($t['id_tsd'] ?? ''));

        $stmtD->execute([
            $idCierre, $t['contrato'], $t['nombre'], $t['tarjeta'], $t['autorizacion'],
            $t['monto_usd'], $t['tc'], $t['monto_crc'], $t['match_exitoso'], $fechaSegura,
            ($idTsdFila !== '' ? $idTsdFila : null),
            $mapaIcd[$idTsdFila]['ICD'] ?? null,
            !empty($mapaIcd[$idTsdFila]['PostDate']) ? str_replace(' ', 'T', $mapaIcd[$idTsdFila]['PostDate']) : null
        ]);
    }

    // Casos Borrador (NO_REPORTADO)
    if (!empty($data['casos_borrador'])) {
        $sqlCaso = "INSERT INTO Tbl_Casos_TSD 
                    (IdCierreOrigen, ICD_Relacionado, Sucursal_Relacionada, NumeroContrato, NombreCliente, MontoCRC, MotivoAgente, Estado, EmailCreador) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'NO_REPORTADO', ?)";
        $stmtCaso = $pdo->prepare($sqlCaso);

        $sqlHist = "INSERT INTO Tbl_Casos_Historial 
                    (IdCaso, Accion, EmailActor, ComentarioAdicional) 
                    VALUES (?, 'CREADO_BORRADOR', ?, 'Inconsistencia detectada durante el Cierre de Cajas.')";
        $stmtHist = $pdo->prepare($sqlHist);

        foreach ($data['casos_borrador'] as $caso) {
            $motivoSeguro = empty($caso['motivo']) ? "" : $caso['motivo'];
            $icdIndividual = !empty($caso['icd']) ? $caso['icd'] : 'PENDIENTE TSD';
            $sucIndividual = !empty($caso['sucursal']) ? $caso['sucursal'] : $sucursalesRaw;

            $stmtCaso->execute([
                $idCierre, $icdIndividual, $sucIndividual, $caso['contrato'], $caso['cliente'],
                $caso['monto_crc'], $motivoSeguro, $emailUsuario
            ]);
            
            $idCaso = $pdo->lastInsertId();
            $stmtHist->execute([$idCaso, $emailUsuario]);
        }
    }

    // ==============================================================
    // AUDITORÍA DE INTEGRIDAD (mismo criterio que save_tsd_m3.php)
    // Se cuenta lo que realmente quedó escrito ANTES del commit.
    // Si algo no cuadra, la transacción se revierte completa: es
    // preferible no guardar nada a guardar un cierre incompleto.
    // ==============================================================
    $totalEsperadoDetalle = count($data['transacciones']);

    $stmtVerifyDet = $pdo->prepare("SELECT COUNT(*) FROM Tbl_CierreCaja_Detalle WHERE IdCierre = ?");
    $stmtVerifyDet->execute([$idCierre]);
    $totalGuardadoDetalle = (int)$stmtVerifyDet->fetchColumn();

    if ($totalGuardadoDetalle !== $totalEsperadoDetalle) {
        throw new \Exception(
            "Auditoría fallida: se enviaron {$totalEsperadoDetalle} transacciones "
            . "pero se guardaron {$totalGuardadoDetalle}. Se revirtió todo por seguridad."
        );
    }

    // La cabecera debe existir y coincidir con los totales enviados
    $stmtVerifyHead = $pdo->prepare("
        SELECT TotalVerificadoCRC, TransaccionesEscaneadas, TotalTransacciones
        FROM Tbl_CierreCaja_Header WHERE IdCierre = ?
    ");
    $stmtVerifyHead->execute([$idCierre]);
    $cab = $stmtVerifyHead->fetch(PDO::FETCH_ASSOC);

    if (!$cab) {
        throw new \Exception("Auditoría fallida: la cabecera del cierre no quedó registrada.");
    }

    if ((int)$cab['TotalTransacciones'] !== $totalEsperadoDetalle) {
        throw new \Exception(
            "Auditoría fallida: la cabecera dice {$cab['TotalTransacciones']} transacciones "
            . "pero se enviaron {$totalEsperadoDetalle}."
        );
    }

    // Diferencia de más de un colón entre lo enviado y lo grabado
    $crcEsperado = round(floatval($data['total_crc'] ?? 0), 2);
    $crcGuardado = round(floatval($cab['TotalVerificadoCRC']), 2);

    if (abs($crcEsperado - $crcGuardado) > 1) {
        throw new \Exception(
            "Auditoría fallida: el monto enviado ({$crcEsperado}) no coincide "
            . "con el grabado ({$crcGuardado})."
        );
    }

    // Los tickets de los no escaneados también deben estar completos
    $totalCasosEsperado = !empty($data['casos_borrador']) ? count($data['casos_borrador']) : 0;

    if ($totalCasosEsperado > 0) {
        $stmtVerifyCasos = $pdo->prepare("SELECT COUNT(*) FROM Tbl_Casos_TSD WHERE IdCierreOrigen = ?");
        $stmtVerifyCasos->execute([$idCierre]);
        $totalCasosGuardado = (int)$stmtVerifyCasos->fetchColumn();

        if ($totalCasosGuardado !== $totalCasosEsperado) {
            throw new \Exception(
                "Auditoría fallida: se esperaban {$totalCasosEsperado} tickets "
                . "pero se crearon {$totalCasosGuardado}. Se revirtió el cierre."
            );
        }
    }

    // Sólo ahora es seguro confirmar en disco
    $pdo->commit();

    echo json_encode([
        'success'    => true,
        'id_cierre'  => $idCierre,
        'verificado' => [
            'transacciones' => $totalGuardadoDetalle,
            'tickets'       => $totalCasosEsperado,
            'total_crc'     => $crcGuardado
        ]
    ]);

} catch (Throwable $e) { // <--- ESTO EVITA EL ERROR RARO DE CONSOLA
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $msg = $e->getMessage();

    // El índice único UX_CierreCaja_Detalle_TSD frenó un guardado
    // simultáneo que alcanzó a pasar la validación previa.
    if (strpos($msg, 'UX_CierreCaja_Detalle_TSD') !== false) {
        echo json_encode([
            'success' => false,
            'yaGuardado' => true,
            'error' => "Este cierre ya está siendo registrado o ya fue registrado.\n\n"
                     . "No se guardó nada nuevo. Recargue la facturación para verificar el estado."
        ]);
        exit;
    }

    error_log('save_cierre_caja: ' . $msg);
    echo json_encode(['success' => false, 'error' => 'Error PHP: ' . $msg]);
}
?>