<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode(['success' => false, 'error' => 'Payload inválido']); exit;
}

$folios = $input['folios'] ?? [];
$matches = $input['matches'] ?? [];
$pendientes = $input['pendientes'] ?? [];
  
try {
    $pdo = Database::connect();
    $pdo->beginTransaction(); // Iniciamos el Escudo Transaccional

    // ==============================================================
    // 1. CALCULAR TOTAL CONCILIADO (Suma TSD)
    // ==============================================================
    $granTotalCRC = 0;
    foreach ($matches as $match) {
        foreach ($match['TSD'] as $t) {
            $granTotalCRC += isset($t['MontoCRC']) ? (float)$t['MontoCRC'] : 0;
        }
    }

    // ==============================================================
    // 2. CREAR EL FOLIO CABECERA (El Cierre TSD de Hoy)
    // ==============================================================
    // Usar el email como trazabilidad si existe, sino el nombre
    $usuarioId = $_SESSION['user']['email'] ?? ($_SESSION['user']['nombre'] ?? 'Sistema');
    
    // Generar Folio Único Agrupador (Ej: TSD-20260424-XYZ9)
    $folioUnico = 'TSD-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

    // Insertar con el Total Real y el Usuario Responsable
    $stmtCierre = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Cierres (Usuario, Fuente, TotalConciliado, ConsolidadoTSD, Folio) VALUES (?, 'Sistema TSD', ?, GETDATE(), ?)");
    $stmtCierre->execute([$usuarioId, $granTotalCRC, $folioUnico]);
    $nuevoIdCierreTSD = $pdo->lastInsertId();

    // ==============================================================
    // 3. APLICAR MARCA DE AGUA Y FOLIO (Sellar folios bancarios)
    // ==============================================================
    if (count($folios) > 0) {
        $inQuery = implode(',', array_fill(0, count($folios), '?'));
        // Le inyectamos el mismo FolioUnico a todos los bancos que estamos cerrando hoy
        $paramsWatermark = array_merge([$folioUnico], $folios);
        $stmtWatermark = $pdo->prepare("UPDATE Tbl_Conciliacion_Cierres SET ConsolidadoTSD = GETDATE(), Folio = ? WHERE IdCierre IN ($inQuery)");
        $stmtWatermark->execute($paramsWatermark);
    }

    // Preparar statements de inserción/actualización para TSD
    $stmtCheck = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE HashUnico = ?");
    
    // Aquí le inyectamos el IdCierre a la tabla Maestra también para trazabilidad universal
    $stmtInsertMaestra = $pdo->prepare("
        INSERT INTO Tbl_Transacciones_Maestra 
        (IdTransaccion, IdCierre, Banco, Origen, Estado, IdMatchTSD, TipoCruceTSD, FechaTransaccion, Afiliado_MerID, Autorizacion, MontoBruto, MontoNeto, HashUnico, Tarjeta) 
        VALUES (?, ?, 'TSD', 'DETALLADO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmtUpdateMaestra = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Estado = ?, IdMatchTSD = ?, TipoCruceTSD = ? WHERE HashUnico = ?");

    // Y se lo inyectamos a la tabla de Detalle
    $stmtInsertDetalle = $pdo->prepare("
        INSERT INTO Tbl_Detalle_TSD 
        (IdTransaccion, IdCierre, Contrato, Cliente, Recibo_Detalle, MontoUSD, TipoCambio, MontoCRC, TipoTarjeta, Autorizacion, Tarjeta_Ultimos4, FechaPago, RecibidoPor, ICD, SucursalCod, SucursalNombre)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    // ==============================================================
    // 3. FUNCIÓN HELPER: Procesar fila TSD
    // ==============================================================
    $procesarTSD = function($t, $estado, $idMatchTSD, $tipoCruce) use ($pdo, $nuevoIdCierreTSD, $stmtCheck, $stmtInsertMaestra, $stmtUpdateMaestra, $stmtInsertDetalle) {
        $idTransaccion = trim($t['ID_Transaccion']);
        $contrato = trim($t['Contrato']);
        $auth = trim($t['Autorizacion']);
        $montoCRC = isset($t['MontoCRC']) ? (float)$t['MontoCRC'] : 0;
        $fecha = $t['Fecha'];
        $tarjeta = trim($t['Tarjeta_Ultimos4']);

        // Súper-Hash Inmune a Duplicación
        $hashData = "TSD|$idTransaccion|$contrato|$auth|$montoCRC|$fecha";
        $hashUnico = md5($hashData);

        $stmtCheck->execute([$hashUnico]);
        if ($stmtCheck->rowCount() > 0) {
            // Ya existía (Arrastrado), solo actualizamos el estado y el match
            $stmtUpdateMaestra->execute([$estado, $idMatchTSD, $tipoCruce, $hashUnico]);
        } else {
            // Es nuevo, insertamos en Maestra con el nuevo Folio
            $stmtInsertMaestra->execute([
                $idTransaccion, $nuevoIdCierreTSD, $estado, $idMatchTSD, $tipoCruce, $fecha, $contrato, $auth, $montoCRC, $montoCRC, $hashUnico, $tarjeta
            ]);
            
            // Insertamos la metadata rica en la Bóveda TSD con el nuevo Folio
            $montoUSD = isset($t['MontoUSD']) ? (float)$t['MontoUSD'] : 0;
            $tc = isset($t['TC']) ? (float)$t['TC'] : 1;
            
            $stmtInsertDetalle->execute([
                $idTransaccion, $nuevoIdCierreTSD, $contrato, $t['Cliente'], $t['Recibo_Detalle'] ?? null, $montoUSD, $tc, $montoCRC, 
                $t['Tipo'], $auth, $tarjeta, $fecha, $t['RecibidoPor'], $t['ICD'], $t['SucursalCod'], $t['Sucursal']
            ]);
        }
    };

    // ==============================================================
    // 3. PROCESAR MATCHES (Éxitos Azules y Amarillos)
    // ==============================================================
    $stmtUpdateBanco = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET IdMatchTSD = ?, TipoCruceTSD = ? WHERE IdTransaccion = ?");
    $stmtInsertAuditoria = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion) VALUES (?, 'Cruce Manual TSD', ?)");

    foreach ($matches as $match) {
        $idMatchTSD = $match['IdMatchTSD'];
        $tipoCruce = $match['TipoCruce'];
        $justificacion = $match['Justificacion'];

        // Guardar TSDs
        foreach ($match['TSD'] as $t) {
            $procesarTSD($t, 'CONCILIADO', $idMatchTSD, $tipoCruce);
        }

        // Guardar Auditoría Manual (Se liga al primer TSD del grupo)
        if ($justificacion && count($match['TSD']) > 0) {
            $primerIdTSD = $match['TSD'][0]['ID_Transaccion'];
            // Validamos que no exista para evitar constraint error
            $stmtCheckAud = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Ajustes_Auditoria WHERE IdTransaccion = ?");
            $stmtCheckAud->execute([$primerIdTSD]);
            if ($stmtCheckAud->rowCount() == 0) {
                $stmtInsertAuditoria->execute([$primerIdTSD, $justificacion]);
            }
        }

        // Matrimonio Directo (Solo actualizamos la transacción Detallada visible)
        foreach ($match['Bancos'] as $bancoIdTrans) {
            $stmtUpdateBanco->execute([$idMatchTSD, $tipoCruce, $bancoIdTrans]);
        }
    }

    // ==============================================================
    // 4. PROCESAR PENDIENTES (Huérfanos TSD)
    // ==============================================================
    foreach ($pendientes as $p) {
        // IdMatchTSD = NULL, TipoCruce = NULL, Estado = PENDIENTE
        $procesarTSD($p, 'PENDIENTE', null, null);
    }

    // ==============================================================
    // 5. DOUBLE-CHECK (Auditoría Final de Integridad)
    // ==============================================================
    // Sumamos cuántos contratos TSD nos mandó JS en total
    $totalContratosPayload = count($pendientes);
    foreach ($matches as $match) {
        $totalContratosPayload += count($match['TSD']);
    }

    // Le preguntamos a SQL cuántos insertó/actualizó en la tabla Maestra para este Folio recién creado
    $stmtVerify = $pdo->prepare("SELECT COUNT(*) as TsdGuardados FROM Tbl_Transacciones_Maestra WHERE IdCierre = ? AND Banco = 'TSD'");
    $stmtVerify->execute([$nuevoIdCierreTSD]);
    $totalGuardadosSql = (int)$stmtVerify->fetch()['TsdGuardados'];

    // Si los números no son idénticos, algo se corrompió. Hacemos ROLLBACK.
    if ($totalGuardadosSql !== $totalContratosPayload) {
        throw new PDOException("Error de Integridad: El sistema recibió $totalContratosPayload registros de TSD, pero la Base de Datos reporta $totalGuardadosSql registros guardados. El proceso fue abortado por seguridad.", 9999);
    }

    $pdo->commit(); // Sellar Bóveda

    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    
    // Interceptar error 23000 (Violación de Llave Primaria / Duplicado)
    if ($e->getCode() == 23000) {
        $msg = "Se detectó que uno o más registros de TSD ya fueron ingresados previamente y no pueden duplicarse en la contabilidad.\n\nPor favor, actualice la fecha del filtro para obtener transacciones nuevas.";
    } else {
        $msg = $e->getMessage();
    }
    
    echo json_encode(['success' => false, 'error' => $msg]);
}
?>