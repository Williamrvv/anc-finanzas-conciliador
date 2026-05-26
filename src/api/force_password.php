<?php
session_start();
ini_set('display_errors', 0);
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Sesión expirada.']);
    exit;
}

require_once '../db.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);
$password = trim($data['password'] ?? '');

// Validación Estricta de Política de Contraseñas (Backend)
if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe tener al menos 8 caracteres.']);
    exit;
}

if (!preg_match('/[A-Z]/', $password)) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe incluir al menos una letra mayúscula.']);
    exit;
}

if (!preg_match('/[a-z]/', $password)) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe incluir al menos una letra minúscula.']);
    exit;
}

if (!preg_match('/[0-9]/', $password)) {
    echo json_encode(['success' => false, 'error' => 'La contraseña debe incluir al menos un número.']);
    exit;
}

if (!preg_match('/[\W_]/', $password)) { 
    echo json_encode(['success' => false, 'error' => 'La contraseña debe incluir al menos un carácter especial.']);
    exit;
}

$email = $_SESSION['user']['email'];

try {
    $pdo = Database::connect();
    
    $hash = password_hash($password, PASSWORD_DEFAULT);
    
    $stmt = $pdo->prepare("UPDATE Tbl_Usuarios SET Password_Hash = ? WHERE Email = ?");
    $stmt->execute([$hash, $email]);

    // Limpiamos la bandera en la sesión actual
    $_SESSION['user']['req_password'] = false;

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error de Base de Datos.']);
}
?>