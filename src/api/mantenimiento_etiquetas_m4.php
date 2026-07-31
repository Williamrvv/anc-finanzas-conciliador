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
    else if ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['IdEtiqueta'])) {
            echo json_encode(['success' => false, 'error' => 'Faltan datos']); exit;
        }
        $id = $input['IdEtiqueta'];

        // Las etiquetas de SISTEMA no pueden cambiar de nombre: la detección
        // automática (Contracargos / Devoluciones) se guía por ese nombre exacto.
        $q = $pdo->prepare("SELECT EsSistema FROM Tbl_Etiquetas_M4 WHERE IdEtiqueta = ?");
        $q->execute([$id]);
        $fila = $q->fetch(PDO::FETCH_ASSOC);
        if (!$fila) { echo json_encode(['success' => false, 'error' => 'La etiqueta no existe']); exit; }
        $esSistema = (int)$fila['EsSistema'] === 1;

        // UPDATE dinámico: se actualiza SOLO lo que venga en la petición.
        // Así este mismo endpoint sirve para el cambio de color y para la edición.
        $sets = []; $vals = [];

        if (isset($input['ColorCSS']) && trim($input['ColorCSS']) !== '') {
            $sets[] = "ColorCSS = ?";      $vals[] = trim($input['ColorCSS']);
        }
        if (!$esSistema && isset($input['Nombre']) && trim($input['Nombre']) !== '') {
            $sets[] = "Nombre = ?";        $vals[] = trim($input['Nombre']);
        }
        if (array_key_exists('Descripcion', $input)) {
            $sets[] = "Descripcion = ?";   $vals[] = trim((string)$input['Descripcion']);
        }

        if (!$sets) { echo json_encode(['success' => false, 'error' => 'No hay cambios que guardar']); exit; }

        $vals[] = $id;
        $stmt = $pdo->prepare("UPDATE Tbl_Etiquetas_M4 SET " . implode(', ', $sets) . " WHERE IdEtiqueta = ?");
        $stmt->execute($vals);

        echo json_encode(['success' => true, 'esSistema' => $esSistema, 'campos' => count($sets)]);
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