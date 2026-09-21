<?php
ini_set('display_errors', 0); // Prohíbe a PHP escupir HTML
error_reporting(E_ALL);

session_start();
require_once __DIR__ . '/bitacora_lib.php';
Bitacora::observar('CIERRE_CAJA', 'CIERRE_GUARDAR', ['globales' => ['idCierre']]);
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

$icdsRaw = $data['icds_involucrados'] ?? ''; // Ahora recibimos un string: "ICD1, ICD2"
$sucursalesRaw = $data['sucursales'] ?? '';
$emailUsuario = $_SESSION['user']['email'] ?? null;

if (!$emailUsuario) {
    echo json_encode(['success' => false, 'error' => 'Error de sesión: Correo de usuario no encontrado.']);
    exit;
}

try {
    // 1. VALIDACIÓN JUST-IN-TIME EN TSD (Múltiples ICDs)
    $icdsArray = array_filter(array_map('trim', explode(',', preg_replace('/\(.*?\)/', '', $icdsRaw)))); // Limpiamos los nombres de usuario entre paréntesis
    
    if (class_exists('TSDDatabase') && count($icdsArray) > 0) {
        $pdoTsd = TSDDatabase::connect();
        $inClause = str_repeat('?,', count($icdsArray) - 1) . '?';
        $stmtTsd = $pdoTsd->prepare("SELECT DBRNum, POST_FLAG FROM dbo.DBR WHERE DBRNum IN ($inClause)");
        $stmtTsd->execute($icdsArray);
        $resultadosTSD = $stmtTsd->fetchAll(PDO::FETCH_ASSOC);

        $abiertos = [];
        foreach ($resultadosTSD as $row) {
            if (empty($row['POST_FLAG']) || $row['POST_FLAG'] == '0') {
                $abiertos[] = $row['DBRNum'];
            }
        }

        if (!empty($abiertos)) {
            echo json_encode([
                'success' => false, 
                'error' => "⚠️ Cierre Incompleto en TSD.\n\nLos siguientes ICDs aún se encuentran abiertos: " . implode(', ', $abiertos) . "\nFinalice el proceso en TSD antes de guardar en IRI."
            ]);
            exit;
        }
    }

    // 2. GUARDADO EN BASE DE DATOS LOCAL
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // Cabecera
    $sqlHeader = "INSERT INTO Tbl_CierreCaja_Header 
                  (ICD, Sucursal, UsuarioRegistroTSD, FechaRegistroTSD, EmailUsuario, TotalVerificadoCRC, TotalVerificadoUSD, TransaccionesEscaneadas, TotalTransacciones) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    // Al ser un cierre continuo, usamos la hora actual para FechaRegistroTSD como marca de corte
    $fechaTSD = date('Y-m-d\TH:i:s');

    $stmtH = $pdo->prepare($sqlHeader);
    $stmtH->execute([
        $icdsRaw, $sucursalesRaw, 'Múltiples AR', $fechaTSD, 
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
                  (IdCierre, Numero_Contrato, NombreCliente, Tipo_Tarjeta, Numero_Autorizacion, MontoUSD, TipoCambio, MontoCRC, MatchExitoso, Fecha_Transaccion, ID_Transaccion_TSD) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
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
            ($idTsdFila !== '' ? $idTsdFila : null)
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