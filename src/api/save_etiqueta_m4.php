<?php
session_start();
error_reporting(0); // Anula los warnings de PHP que corrompen el JSON
require_once '../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit; }

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['id'])) { echo json_encode(['success' => false, 'error' => 'Falta el ID de transacción']); exit; }

try {
    $pdo = Database::connect();
    $stmt = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET ColorEtiqueta = ?, NotaUsuario = ? WHERE IdTransaccion = ?");
    
    // Asignación ultra-segura para evitar "Undefined index"
    $color = !empty($input['color']) ? $input['color'] : null;
    $nota = !empty($input['nota']) ? $input['nota'] : null;

    $stmt->execute([$color, $nota, $input['id']]);
    
    echo json_encode(['success' => true]);
} catch (\Throwable $e) { // Throwable atrapa ERRORES FATALES
    echo json_encode(['success' => false, 'error' => 'Error SQL: ' . $e->getMessage()]);
}
?>