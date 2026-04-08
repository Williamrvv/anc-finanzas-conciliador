<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

$idCaso = $data['idCaso'] ?? 0;
$emailUsuario = $_SESSION['user']['email'] ?? 'Sistema';

if (empty($idCaso)) {
    echo json_encode(['success' => false, 'error' => 'ID de caso faltante.']);
    exit;
}

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // 1. Validar que el caso exista y no esté ya cerrado
    $stmtVal = $pdo->prepare("SELECT Estado FROM Tbl_Casos_TSD WHERE IdCaso = ?");
    $stmtVal->execute([$idCaso]);
    $estadoActual = $stmtVal->fetchColumn();

    if (!$estadoActual) throw new Exception("El caso no existe.");
    if ($estadoActual === 'CERRADO') throw new Exception("El caso ya se encuentra cerrado.");

    // 2. Actualizar a CERRADO (Congela SLA)
    $stmtUpdate = $pdo->prepare("UPDATE Tbl_Casos_TSD SET Estado = 'CERRADO' WHERE IdCaso = ?");
    $stmtUpdate->execute([$idCaso]);

    // 3. Registrar cierre en el historial
    $stmtHist = $pdo->prepare("INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, 'CERRADO_DEFINITIVO', ?, 'El ticket fue validado y cerrado manualmente.')");
    $stmtHist->execute([$idCaso, $emailUsuario]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>