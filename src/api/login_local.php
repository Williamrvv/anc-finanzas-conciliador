<?php
session_start();
require_once __DIR__ . '/../db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$email = filter_var(trim($_POST['email'] ?? ''), FILTER_SANITIZE_EMAIL);
$password = $_POST['password'] ?? '';

sleep(1); // Anti Fuerza Bruta

if (empty($email)) {
    echo json_encode(['success' => false, 'error' => 'Por favor, ingrese su correo electrónico.']);
    exit;
}

try {
    $pdo = Database::connect();
    
    $stmt = $pdo->prepare("
        SELECT u.Email, u.Nombre, u.Apellidos, u.Puesto, u.Password_Hash, u.Activo, u.Puede_Administrar, r.Nombre_Rol 
        FROM Tbl_Usuarios u
        INNER JOIN Tbl_Roles r ON u.Id_Rol = r.Id_Rol
        WHERE u.Email = ?
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success' => false, 'error' => 'Usuario y/o contraseña incorrectos.']);
        exit;
    }

    if ($user['Activo'] == 0) {
        echo json_encode(['success' => false, 'error' => 'Su cuenta se encuentra inactiva o dada de baja. Contacte al administrador.']);
        exit;
    }

    $hash = $user['Password_Hash'];
    $requiereCambio = false;

    // LÓGICA DE BYPASS: Si la BD tiene el hash vacío y el usuario NO mandó contraseña...
    if (empty($hash) && empty($password)) {
        // Le damos pase libre temporal, PERO le levantamos la bandera de exigir cambio
        $requiereCambio = true;
    } 
    // Si la BD TIENE contraseña, procedemos con validación estricta
    elseif (!empty($hash)) {
        if (empty($password)) {
            echo json_encode(['success' => false, 'error' => 'Debe ingresar su contraseña.']);
            exit;
        }
        if (!password_verify($password, $hash)) {
            echo json_encode(['success' => false, 'error' => 'Usuario y/o contraseña incorrectos.']);
            exit;
        }
    } 
    // Si la BD NO TIENE contraseña, pero el usuario trató de inventar una para entrar (Ataque a ciegas)
    else {
        // Le mandamos el mismo error genérico que si se hubiera equivocado de clave, 
        // así no sabe que la cuenta está vulnerable esperando un ingreso en blanco.
        echo json_encode(['success' => false, 'error' => 'Usuario y/o contraseña incorrectos.']);
        exit;
    }

    // Iniciar Sesión Existosa (o en modo Reseteo)
    $_SESSION['user'] = [
        'email' => $user['Email'],
        'name' => $user['Nombre'] . ' ' . $user['Apellidos'],
        'jobTitle' => $user['Puesto'],
        'role' => $user['Nombre_Rol'],
        'can_manage' => ($user['Puede_Administrar'] == 1 || $user['Nombre_Rol'] === 'admin'),
        'req_password' => $requiereCambio
    ];

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    error_log("Login Error: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Error interno del servidor.']);
}
?>