<?php
// 1. BLINDAJE CONTRA CORTES DE SERVIDOR (Tanque de Oxígeno)
ini_set('display_errors', 0);
set_time_limit(300); // 5 minutos de tiempo de ejecución para lotes masivos
ini_set('memory_limit', '512M'); // Expandir RAM para procesar el JSON gigante

session_start();
require_once '../db.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

// 2. LECTURA SEGURA DEL PAYLOAD GIGANTE
$jsonString = file_get_contents('php://input');
$input = json_decode($jsonString, true);

if (!$input) {
    echo json_encode(['success' => false, 'error' => 'El volumen de datos excedió el límite permitido por el servidor o el paquete está corrupto. Intente con un rango de fechas más pequeño.']); exit;
}

$folios = $input['folios'] ?? [];

// Fecha CONTABLE elegida por el usuario. Si no viene o es inválida, se usa hoy;
// nunca se admite una fecha futura.
$fechaConcil = trim($input['fechaConciliacion'] ?? '');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaConcil) || $fechaConcil > date('Y-m-d')) {
    $fechaConcil = date('Y-m-d');
}
$fechaRealConcil = date('Y-m-d H:i:s');
$matches = $input['matches'] ?? [];
$pendientes = $input['pendientes'] ?? [];
  
try {
    $pdo = Database::connect();
    $pdo->beginTransaction(); // Iniciamos el Escudo Transaccional

    // ==============================================================
    // 2.5 GUARDIÁN DE CENTROS DE COSTO (Fuente: API del CRM)
    // Misma fuente que el visor de crudos. Si faltan CC, se pide
    // confirmación al usuario antes de guardar con CC vacío.
    // ==============================================================
    // Normalización agresiva tipo Excel: SOLO letras y números, sin ceros a la izquierda
    $normCod = function($v) {
        $s = preg_replace('/[^A-Z0-9]/', '', strtoupper((string)$v));
        if ($s === '') return '';
        $n = ltrim($s, '0');
        return $n === '' ? '0' : $n;
    };
    $mapaCC = [];
    $ctxCC = stream_context_create([
        'http' => ['timeout' => 8],
        'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
    ]);
    $crmJson = @file_get_contents('https://intanc.com/CRM/API/V1/NOTIFICADBR/centros-costo-tsd.php', false, $ctxCC);
    $crmData = $crmJson !== false ? json_decode($crmJson, true) : null;
    if (!isset($crmData['ok']) || !$crmData['ok'] || !isset($crmData['data'])) {
        throw new \Exception("No se pudo consultar el catálogo de Centros de Costo (API del CRM). El guardado fue cancelado para no sellar datos incompletos. Intente de nuevo en unos minutos.");
    }
    foreach ($crmData['data'] as $itemCC) {
        $k = $normCod($itemCC['Codigo'] ?? '');
        if ($k !== '' && !isset($mapaCC[$k])) $mapaCC[$k] = trim($itemCC['Centro_Costo'] ?? '');
    }

    // Unificar todas las filas TSD del payload (conciliadas + pendientes)
    $todosTSD = $pendientes;
    foreach ($matches as $m) { foreach (($m['TSD'] ?? []) as $t) { $todosTSD[] = $t; } }

    $sucursalesSinCC = [];
    foreach ($todosTSD as $t) {
        $cod = $normCod($t['SucursalCod'] ?? '');
        if ($cod === '' || !isset($mapaCC[$cod])) {
            $llave = ($cod === '') ? '(SIN CÓDIGO)' : $cod;
            $sucursalesSinCC[$llave] = trim($t['Sucursal'] ?? 'Nombre no disponible');
        }
    }

    // PUERTA DE CONFIRMACIÓN: si faltan CC y el usuario aún no autorizó, devolver la lista y esperar su decisión
    $confirmarSinCC = !empty($input['confirmarSinCC']);
    if (count($sucursalesSinCC) > 0 && !$confirmarSinCC) {
        $pdo->rollBack();
        $faltantes = [];
        foreach ($sucursalesSinCC as $cod => $nombre) { $faltantes[] = ['codigo' => $cod, 'nombre' => $nombre]; }
        echo json_encode(['success' => false, 'requiereConfirmacionCC' => true, 'faltantes' => $faltantes]);
        exit;
    }

    // ==============================================================
    // 3. CALCULAR TOTAL CONCILIADO (Suma TSD)
    // ==============================================================
    $granTotalCRC = 0;
    foreach ($matches as $match) {
        foreach ($match['TSD'] as $t) {
            $granTotalCRC += isset($t['MontoCRC']) ? (float)$t['MontoCRC'] : 0;
        }
    }

    // ==============================================================
    // 4. CREAR EL FOLIO CABECERA (El Cierre TSD de Hoy)
    // ==============================================================
    $usuarioId = $_SESSION['user']['email'] ?? ($_SESSION['user']['nombre'] ?? 'Sistema');
    $folioUnico = 'TSD-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

    $stmtCierre = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Cierres (Usuario, Fuente, TotalConciliado, ConsolidadoTSD, Folio) VALUES (?, 'Sistema TSD', ?, GETDATE(), ?)");
    $stmtCierre->execute([$usuarioId, $granTotalCRC, $folioUnico]);
    $nuevoIdCierreTSD = $pdo->lastInsertId();

    // ==============================================================
    // 5. APLICAR MARCA DE AGUA A BANCOS
    // ==============================================================
    if (count($folios) > 0) {
        $inQuery = implode(',', array_fill(0, count($folios), '?'));
        $paramsWatermark = array_merge([$folioUnico], $folios);
        $stmtWatermark = $pdo->prepare("UPDATE Tbl_Conciliacion_Cierres SET ConsolidadoTSD = GETDATE(), Folio = ? WHERE IdCierre IN ($inQuery)");
        $stmtWatermark->execute($paramsWatermark);
    }

    // Preparar statements de inserción/actualización
    $stmtCheck = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE HashUnico = ?");
    
    $stmtInsertMaestra = $pdo->prepare("
        INSERT INTO Tbl_Transacciones_Maestra
        (
            IdTransaccion, IdCierre, Banco, Origen, Estado,
            IdMatchTSD, TipoCruceTSD, FechaTransaccion,
            Afiliado_MerID, Autorizacion, MontoBruto, MontoNeto,
            HashUnico, Tarjeta,
            FechaConciliacion, FechaRealConciliacion
        )
        VALUES (
            ?, ?, 'TSD', 'DETALLADO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?
        )
    ");
    
    $stmtUpdateMaestra = $pdo->prepare("
        UPDATE Tbl_Transacciones_Maestra
        SET Estado = ?,
            IdMatchTSD = ?,
            TipoCruceTSD = ?,
            FechaConciliacion = CASE
                WHEN ? = 'CONCILIADO' THEN ?
                ELSE FechaConciliacion
            END,
            FechaRealConciliacion = CASE
                WHEN ? = 'CONCILIADO' THEN ?
                ELSE FechaRealConciliacion
            END
        WHERE HashUnico = ?
    ");

    // NOTA: Añadida la columna CentroCosto para inyectar lo que calculó la API del Módulo 3
    $stmtInsertDetalle = $pdo->prepare("
        INSERT INTO Tbl_Detalle_TSD 
        (IdTransaccion, IdCierre, Contrato, Cliente, Recibo_Detalle, MontoUSD, TipoCambio, MontoCRC, TipoTarjeta, Autorizacion, Tarjeta_Ultimos4, FechaPago, RecibidoPor, ICD, SucursalCod, SucursalNombre, CentroCosto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    // ==============================================================
    // 6. FUNCIÓN HELPER: Procesar fila TSD
    // ==============================================================
    $procesarTSD = function($t, $estado, $idMatchTSD, $tipoCruce) use ($pdo, $nuevoIdCierreTSD, $stmtCheck, $stmtInsertMaestra, $stmtUpdateMaestra, $stmtInsertDetalle, $mapaCC, $normCod, $fechaConcil, $fechaRealConcil) {
        $idTransaccion = trim($t['ID_Transaccion'] ?? 'SD');
        $contrato = trim($t['Contrato'] ?? '');
        $auth = trim($t['Autorizacion'] ?? '');
        $montoCRC = isset($t['MontoCRC']) ? (float)$t['MontoCRC'] : 0;
        $fecha = $t['Fecha'] ?? date('Y-m-d');
        $tarjeta = trim($t['Tarjeta_Ultimos4'] ?? '');

        // Súper-Hash Inmune a Duplicación
        $hashData = "TSD|$idTransaccion|$contrato|$auth|$montoCRC|$fecha";
        $hashUnico = md5($hashData);

        $stmtCheck->execute([$hashUnico]);
        if ($stmtCheck->rowCount() > 0) {
            $stmtUpdateMaestra->execute([
                $estado,
                $idMatchTSD,
                $tipoCruce,
                $estado,
                $fechaConcil,
                $estado,
                $fechaRealConcil,
                $hashUnico
            ]);
        } else {
            $stmtInsertMaestra->execute([
                $idTransaccion,
                $nuevoIdCierreTSD,
                $estado,
                $idMatchTSD,
                $tipoCruce,
                $fecha,
                $contrato,
                $auth,
                $montoCRC,
                $montoCRC,
                $hashUnico,
                $tarjeta,
                $estado === 'CONCILIADO' ? $fechaConcil : null,
                $estado === 'CONCILIADO' ? $fechaRealConcil : null
            ]); 
            
            $montoUSD = isset($t['MontoUSD']) ? (float)$t['MontoUSD'] : 0;
            $tc = isset($t['TC']) ? (float)$t['TC'] : 1;
            // Re-resolución en servidor: el CC oficial sale del Diccionario, no del payload
            // Sin CC en el catálogo: se guarda vacío (NULL), previa confirmación del usuario
            $centroCosto = $mapaCC[$normCod($t['SucursalCod'] ?? '')] ?? null;
            
            $stmtInsertDetalle->execute([
                $idTransaccion, $nuevoIdCierreTSD, $contrato, $t['Cliente'] ?? null, $t['Recibo_Detalle'] ?? null, $montoUSD, $tc, $montoCRC, 
                $t['Tipo_Tarjeta'] ?? null, $auth, $tarjeta, $fecha, $t['RecibidoPor'] ?? null, $t['ICD'] ?? null, $t['SucursalCod'] ?? null, $t['Sucursal'] ?? null, $centroCosto
            ]);
        }
    };

    // ==============================================================
    // 7. PROCESAR MATCHES Y PENDIENTES
    // ==============================================================
    $stmtUpdateBanco = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET IdMatchTSD = ?, TipoCruceTSD = ?, FechaConciliacion = ?, FechaRealConciliacion = ? WHERE IdTransaccion = ?");
    $stmtInsertAuditoria = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion) VALUES (?, 'Cruce Manual TSD', ?)");

    foreach ($matches as $match) {
        $idMatchTSD = $match['IdMatchTSD'] ?? uniqid();
        $tipoCruce = $match['TipoCruce'] ?? 'S/D';
        $justificacion = $match['Justificacion'] ?? '';

        foreach ($match['TSD'] as $t) { $procesarTSD($t, 'CONCILIADO', $idMatchTSD, $tipoCruce); }

        if ($justificacion && count($match['TSD']) > 0) {
            $primerIdTSD = $match['TSD'][0]['ID_Transaccion'] ?? null;
            if ($primerIdTSD) {
                $stmtCheckAud = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Ajustes_Auditoria WHERE IdTransaccion = ?");
                $stmtCheckAud->execute([$primerIdTSD]);
                if ($stmtCheckAud->rowCount() == 0) {
                    $stmtInsertAuditoria->execute([$primerIdTSD, $justificacion]);
                }
            }
        }

        foreach ($match['Bancos'] as $bancoIdTrans) {
            $stmtUpdateBanco->execute([$idMatchTSD, $tipoCruce, $fechaConcil, $fechaRealConcil, $bancoIdTrans]);
        }
    }

    foreach ($pendientes as $p) {
        $procesarTSD($p, 'PENDIENTE', null, null);
    }

    // ==============================================================
    // 8. AUDITORÍA FINAL
    // ==============================================================
    $totalContratosPayload = count($pendientes);
    foreach ($matches as $match) { $totalContratosPayload += count($match['TSD']); }

    $stmtVerify = $pdo->prepare("SELECT COUNT(*) as TsdGuardados FROM Tbl_Transacciones_Maestra WHERE IdCierre = ? AND Banco = 'TSD'");
    $stmtVerify->execute([$nuevoIdCierreTSD]);
    $totalGuardadosSql = (int)$stmtVerify->fetch()['TsdGuardados'];

    if ($totalGuardadosSql !== $totalContratosPayload) {
        throw new \Exception("Auditoría fallida: Se recibieron $totalContratosPayload registros, pero se guardaron $totalGuardadosSql.");
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (\Throwable $e) { // <-- ATRAPA ABSOLUTAMENTE CUALQUIER ERROR (Incluso fatales de RAM)
    if (isset($pdo) && $pdo->inTransaction()) { $pdo->rollBack(); }
    
    $code = $e->getCode();
    $msg = $e->getMessage();
    
    // Si es un error de duplicidad de llave primaria, lo hacemos legible
    if ($code == 23000) {
        $msg = "Se detectó que uno o más registros de TSD ya fueron ingresados previamente y no pueden duplicarse en la contabilidad.\n\nPor favor, actualice la fecha del filtro para obtener transacciones nuevas.";
    }
    
    echo json_encode(['success' => false, 'error' => $msg]);
}
?>