<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['tarjetas']) || !is_array($input['tarjetas'])) {
    echo json_encode(['success' => false, 'error' => 'Payload inválido']); exit;
}

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // Query de UPSERT (Merge) para SQL Server
    $sql = "
        MERGE INTO Tbl_Historial_Tarjetas AS target
        USING (SELECT :contrato AS NumeroContrato, :tarjeta AS Tarjeta_Ultimos4) AS source
        ON target.NumeroContrato = source.NumeroContrato
        WHEN MATCHED THEN 
            UPDATE SET Tarjeta_Ultimos4 = source.Tarjeta_Ultimos4, FechaIngreso = GETDATE()
        WHEN NOT MATCHED THEN 
            INSERT (NumeroContrato, Tarjeta_Ultimos4, FechaIngreso)
            VALUES (source.NumeroContrato, source.Tarjeta_Ultimos4, GETDATE());
    ";
    
    $stmt = $pdo->prepare($sql);
    $insertados = 0;

    foreach ($input['tarjetas'] as $row) {
        $stmt->execute([
            ':contrato' => $row['contrato'],
            ':tarjeta' => $row['tarjeta']
        ]);
        $insertados++;
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'filas' => $insertados]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>