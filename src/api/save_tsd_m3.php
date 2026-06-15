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
$matches = $input['matches'] ?? [];
$pendientes = $input['pendientes'] ?? [];
  
try {
    $pdo = Database::connect();
    $pdo->beginTransaction(); // Iniciamos el Escudo Transaccional

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
        (IdTransaccion, IdCierre, Banco, Origen, Estado, IdMatchTSD, TipoCruceTSD, FechaTransaccion, Afiliado_MerID, Autorizacion, MontoBruto, MontoNeto, HashUnico, Tarjeta) 
        VALUES (?, ?, 'TSD', 'DETALLADO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmtUpdateMaestra = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Estado = ?, IdMatchTSD = ?, TipoCruceTSD = ? WHERE HashUnico = ?");

    // NOTA: Añadida la columna CentroCosto para inyectar lo que calculó la API del Módulo 3
    $stmtInsertDetalle = $pdo->prepare("
        INSERT INTO Tbl_Detalle_TSD 
        (IdTransaccion, IdCierre, Contrato, Cliente, Recibo_Detalle, MontoUSD, TipoCambio, MontoCRC, TipoTarjeta, Autorizacion, Tarjeta_Ultimos4, FechaPago, RecibidoPor, ICD, SucursalCod, SucursalNombre, CentroCosto)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    // ==============================================================
    // 6. FUNCIÓN HELPER: Procesar fila TSD
    // ==============================================================
    $procesarTSD = function($t, $estado, $idMatchTSD, $tipoCruce) use ($pdo, $nuevoIdCierreTSD, $stmtCheck, $stmtInsertMaestra, $stmtUpdateMaestra, $stmtInsertDetalle) {
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
            $stmtUpdateMaestra->execute([$estado, $idMatchTSD, $tipoCruce, $hashUnico]);
        } else {
            $stmtInsertMaestra->execute([
                $idTransaccion, $nuevoIdCierreTSD, $estado, $idMatchTSD, $tipoCruce, $fecha, $contrato, $auth, $montoCRC, $montoCRC, $hashUnico, $tarjeta
            ]);
            
            $montoUSD = isset($t['MontoUSD']) ? (float)$t['MontoUSD'] : 0;
            $tc = isset($t['TC']) ? (float)$t['TC'] : 1;
            $centroCosto = trim($t['CentroCosto'] ?? '00-00-00');
            
            $stmtInsertDetalle->execute([
                $idTransaccion, $nuevoIdCierreTSD, $contrato, $t['Cliente'] ?? null, $t['Recibo_Detalle'] ?? null, $montoUSD, $tc, $montoCRC, 
                $t['Tipo'] ?? null, $auth, $tarjeta, $fecha, $t['RecibidoPor'] ?? null, $t['ICD'] ?? null, $t['SucursalCod'] ?? null, $t['Sucursal'] ?? null, $centroCosto
            ]);
        }
    };

    // ==============================================================
    // 7. PROCESAR MATCHES Y PENDIENTES
    // ==============================================================
    $stmtUpdateBanco = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET IdMatchTSD = ?, TipoCruceTSD = ? WHERE IdTransaccion = ?");
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
            $stmtUpdateBanco->execute([$idMatchTSD, $tipoCruce, $bancoIdTrans]);
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