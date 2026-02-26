<?php
session_start();
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

// 1. Sanitización Básica (Anti-Prompt / Anti-SQLi)
$email = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$password = $_POST['password'] ?? '';

// Retraso artificial de 1 segundo (Anti Fuerza Bruta / Time-based attacks)
sleep(1);

if (!$email || !$password) {
    echo json_encode(['success' => false, 'error' => 'Faltan credenciales']);
    exit;
}

try {
    $pdo = Database::connect();
    
    // 2. Consulta Segura (Prepared Statement) que trae también el Rol
    $stmt = $pdo->prepare("
        SELECT u.Nombre, u.Apellidos, u.Puesto, u.Password_Hash, u.Activo, u.Puede_Administrar, r.Nombre_Rol 
        FROM Tbl_Usuarios u
        INNER JOIN Tbl_Roles r ON u.Id_Rol = r.Id_Rol
        WHERE u.Email = ?
    ");
    // Reemplazar por (Manejo de Nulls y Unificación de Error):
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Evitar Fatal Error en PHP 8.2 si el usuario no tiene contraseña (NULL)
    $hash = $user['Password_Hash'] ?? '';

    // 3. Lógica de Seguridad Estricta (Mensaje Genérico Único)
    // Si NO existe, o si está DADO DE BAJA, o si FALLA LA CLAVE -> Mismo error para no dar pistas.
    if (!$user || $user['Activo'] == 0 || !password_verify($password, $hash)) {
        echo json_encode(['success' => false, 'error' => 'Usuario y/o contraseña incorrectos.']);
        exit;
    }

    // 4. Iniciar Sesión Exitosa
    $_SESSION['user'] = [
        'email' => $email,
        'name' => $user['Nombre'] . ' ' . $user['Apellidos'],
        'jobTitle' => $user['Puesto'],
        'role' => $user['Nombre_Rol'],
        'can_manage' => ($user['Puede_Administrar'] == 1 || $user['Nombre_Rol'] === 'admin')
    ];

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    // Log interno del error, no lo exponemos al cliente
    error_log("Login Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor.']);
}
?>