<?php
session_start();
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No hay sesión activa']);
    exit;
}
$canManage = $_SESSION['user']['can_manage'] ?? false;
$isAdmin = ($_SESSION['user']['role'] ?? '') === 'admin';

if (!$canManage && !$isAdmin) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Permisos insuficientes.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = Database::connect();

try {
    if ($method === 'GET') {
        $stmtUsers = $pdo->query("SELECT u.Email, u.Nombre, u.Apellidos, u.Puesto, u.Activo, u.Puede_Administrar, u.Id_Rol, r.Nombre_Rol 
                                  FROM Tbl_Usuarios u INNER JOIN Tbl_Roles r ON u.Id_Rol = r.Id_Rol ORDER BY u.Nombre ASC");
        $stmtRoles = $pdo->query("SELECT Id_Rol, Nombre_Rol, Descripcion FROM Tbl_Roles");
        echo json_encode(['success' => true, 'usuarios' => $stmtUsers->fetchAll(), 'roles' => $stmtRoles->fetchAll()]);
    } 
    elseif ($method === 'POST') {
        $email = filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL);
        $nombre = $_POST['nombre'] ?? '';
        $apellidos = $_POST['apellidos'] ?? '';
        $puesto = $_POST['puesto'] ?? '';
        $idRol = $_POST['idRol'] ?? '';
        $password = $_POST['password'] ?? '';
        $isEdit = $_POST['isEdit'] === 'true';
        
        // Manejo de Switches (Checkboxes html mandan 'on' si están marcados)
        $activo = isset($_POST['activo']) && $_POST['activo'] === 'on' ? 1 : 0;
        $puedeAdmin = isset($_POST['puedeAdmin']) && $_POST['puedeAdmin'] === 'on' ? 1 : 0;

        if (!$email || !$nombre || !$idRol) throw new Exception("Faltan datos obligatorios.");

        if ($isEdit) {
            // Protección: No puedes quitarte el admin a ti mismo si eres el único
            if ($email === $_SESSION['user']['email'] && $activo == 0) throw new Exception("No puedes desactivar tu propia cuenta.");

            $sql = "UPDATE Tbl_Usuarios SET Nombre=?, Apellidos=?, Puesto=?, Id_Rol=?, Activo=?, Puede_Administrar=? WHERE Email=?";
            $params = [$nombre, $apellidos, $puesto, $idRol, $activo, $puedeAdmin, $email];
            
            if (!empty($password)) {
                $sql = "UPDATE Tbl_Usuarios SET Nombre=?, Apellidos=?, Puesto=?, Id_Rol=?, Activo=?, Puede_Administrar=?, Password_Hash=? WHERE Email=?";
                $params = [$nombre, $apellidos, $puesto, $idRol, $activo, $puedeAdmin, password_hash($password, PASSWORD_DEFAULT), $email];
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        } else {
            $check = $pdo->prepare("SELECT Email FROM Tbl_Usuarios WHERE Email = ?");
            $check->execute([$email]);
            if ($check->fetch()) throw new Exception("El correo ya está registrado.");

            $passHash = !empty($password) ? password_hash($password, PASSWORD_DEFAULT) : null;
            $stmt = $pdo->prepare("INSERT INTO Tbl_Usuarios (Email, Nombre, Apellidos, Puesto, Id_Rol, Activo, Puede_Administrar, Password_Hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([$email, $nombre, $apellidos, $puesto, $idRol, $activo, $puedeAdmin, $passHash]);
        }
        echo json_encode(['success' => true]);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>