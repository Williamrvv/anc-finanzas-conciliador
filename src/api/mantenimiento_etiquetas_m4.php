<?php
session_start();
error_reporting(0); // Anula los warnings de PHP que corrompen el JSON
require_once '../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { echo json_encode(['success' => false, 'error' => 'Sin sesión']); exit; }

$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = Database::connect();

    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT * FROM Tbl_Etiquetas_M4 WHERE Activo = 1 ORDER BY Nombre ASC");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    } 
    else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['Nombre'])) {
            echo json_encode(['success' => false, 'error' => 'El nombre es requerido']); exit;
        }
        $stmt = $pdo->prepare("INSERT INTO Tbl_Etiquetas_M4 (Nombre, Descripcion, ColorCSS) VALUES (?, ?, ?)");
        $stmt->execute([
            $input['Nombre'], 
            $input['Descripcion'] ?? '', 
            $input['ColorCSS'] ?? 'slate'
        ]);
        echo json_encode(['success' => true]);
    }
    else if ($method === 'DELETE') {
        $input = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare("UPDATE Tbl_Etiquetas_M4 SET Activo = 0 WHERE IdEtiqueta = ?");
        $stmt->execute([$input['IdEtiqueta']]);
        echo json_encode(['success' => true]);
    }
} catch (\Throwable $e) { // Throwable atrapa ERRORES FATALES
    echo json_encode(['success' => false, 'error' => 'Error SQL: ' . $e->getMessage()]);
}
?>