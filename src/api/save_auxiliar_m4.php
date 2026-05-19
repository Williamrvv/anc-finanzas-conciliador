<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['aprobados'])) {
    echo json_encode(['success' => false, 'error' => 'Payload inválido o vacío']); exit;
}

$aprobados = $input['aprobados'];

try {
    $pdo = Database::connect();
    $pdo->beginTransaction(); // Iniciamos el Escudo Transaccional

    // 1. Preparamos las consultas de UPDATE (El dato ya existe, solo sellamos el Match)
    // TSD a CONCILIADO
    $stmtUpdateTSD = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Estado = 'CONCILIADO', IdMatchTSD = ?, TipoCruceTSD = ? WHERE IdTransaccion = ? AND Banco = 'TSD'");
    
    // Bancos (Solo le inyectamos el IdMatchTSD a la fila específica enviada)
    $stmtUpdateBanco = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET IdMatchTSD = ?, TipoCruceTSD = ? WHERE IdTransaccion = ? AND Banco IN ('BAC', 'SCOTIA', 'Davibank')");

    $stmtInsertAuditoria = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion) VALUES (?, 'Aprobación Auxiliar (M4)', ?)");

    // 2. Ejecutar la actualización en bloque
    foreach ($aprobados as $match) {
        $idMatchTSD = trim($match['IdMatchTSD']);
        $tipoCruce = trim($match['TipoCruce']);
        $justificacion = isset($match['Justificacion']) ? trim($match['Justificacion']) : '';

        // Actualizamos los registros de TSD
        foreach ($match['TSD'] as $idTSD) {
            $stmtUpdateTSD->execute([$idMatchTSD, $tipoCruce, $idTSD]);
        }

        // Auditoría Manual (Si el usuario justificó, se la pegamos al primer registro de TSD del bloque)
        if ($justificacion && count($match['TSD']) > 0) {
            $primerIdTSD = $match['TSD'][0];
            $stmtCheckAud = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Ajustes_Auditoria WHERE IdTransaccion = ?");
            $stmtCheckAud->execute([$primerIdTSD]);
            if ($stmtCheckAud->rowCount() == 0) {
                $stmtInsertAuditoria->execute([$primerIdTSD, $justificacion]);
            }
        }

        // Actualizamos estrictamente los registros Bancarios enviados desde la pantalla
        foreach ($match['Bancos'] as $idBanco) {
            $stmtUpdateBanco->execute([$idMatchTSD, $tipoCruce, $idBanco]);
        }
    }

    $pdo->commit(); // Sellar los cambios
    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>