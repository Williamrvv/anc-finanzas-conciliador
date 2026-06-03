<?php
session_start();
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/tsd_db.php'; // Agregamos conexión a TSD
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
        
        // Cargar Catalogo de TSD
        $pdoTsd = TSDDatabase::connect();
        $stmtSucs = $pdoTsd->query("SELECT Location AS ID, NAME FROM dbo.Setup WHERE DeactivateLocation = 0 AND Hidden = 0 AND Country = 'CRI' ORDER BY Location");
        
        // Cargar asignaciones unificadas
        $stmtAsignaciones = $pdo->query("SELECT EmailUsuario AS Email, CodigoSucursal, NombreSucursal FROM Tbl_Usuario_Sucursales_cc WHERE Activo = 1");

        echo json_encode([
            'success' => true, 
            'usuarios' => $stmtUsers->fetchAll(), 
            'roles' => $stmtRoles->fetchAll(),
            'sucursales_tsd' => $stmtSucs->fetchAll(),
            'asignaciones_bd' => $stmtAsignaciones->fetchAll()
        ]);
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
        $forzarReseteo = isset($_POST['resetPassword']) && $_POST['resetPassword'] === 'on';

        if (!$email || !$nombre || !$idRol) throw new Exception("Faltan datos obligatorios.");

        $pdo->beginTransaction(); // Iniciamos transacción (ACID)

        if ($isEdit) {
            if ($email === $_SESSION['user']['email'] && $activo == 0) throw new Exception("No puedes desactivar tu propia cuenta.");

            if ($forzarReseteo) {
                // Si el admin activó Forzar Reseteo, destruimos la clave actual dejándola en NULL
                $sql = "UPDATE Tbl_Usuarios SET Nombre=?, Apellidos=?, Puesto=?, Id_Rol=?, Activo=?, Puede_Administrar=?, Password_Hash=NULL WHERE Email=?";
                $params = [$nombre, $apellidos, $puesto, $idRol, $activo, $puedeAdmin, $email];
            } elseif (!empty($password)) {
                // Si el admin escribió una clave manual, la guardamos
                $sql = "UPDATE Tbl_Usuarios SET Nombre=?, Apellidos=?, Puesto=?, Id_Rol=?, Activo=?, Puede_Administrar=?, Password_Hash=? WHERE Email=?";
                $params = [$nombre, $apellidos, $puesto, $idRol, $activo, $puedeAdmin, password_hash($password, PASSWORD_DEFAULT), $email];
            } else {
                // Actualización normal sin tocar la clave
                $sql = "UPDATE Tbl_Usuarios SET Nombre=?, Apellidos=?, Puesto=?, Id_Rol=?, Activo=?, Puede_Administrar=? WHERE Email=?";
                $params = [$nombre, $apellidos, $puesto, $idRol, $activo, $puedeAdmin, $email];
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

        // --- LÓGICA DE SUCURSALES (Jerarquía Unificada) ---
        $stmtRol = $pdo->prepare("SELECT Nombre_Rol FROM Tbl_Roles WHERE Id_Rol = ?");
        $stmtRol->execute([$idRol]);
        $roleName = strtolower($stmtRol->fetchColumn());

        // 1. Limpiamos la matriz unificada
        $pdo->prepare("DELETE FROM Tbl_Usuario_Sucursales_cc WHERE EmailUsuario = ?")->execute([$email]);

        // 2. Insertamos si el rol admite sucursales
        if (in_array($roleName, ['jefe', 'agente', 'admin', 'coordinador'])) {
            $sucursales = json_decode($_POST['sucursalesJSON'] ?? '[]', true);
            
            // Validación estricta: Obligatorio para todos MENOS para Admin
            if (empty($sucursales) && $roleName !== 'admin') {
                throw new Exception("Debe asignar al menos una sucursal obligatoriamente para el rol de " . strtoupper($roleName) . ".");
            }

            if (!empty($sucursales)) {
                $stmtIns = $pdo->prepare("INSERT INTO Tbl_Usuario_Sucursales_cc (EmailUsuario, CodigoSucursal, NombreSucursal, Activo) VALUES (?, ?, ?, 1)");
                foreach ($sucursales as $suc) {
                    $stmtIns->execute([$email, $suc['id'], $suc['nombre']]);
                }
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true]);
    }
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack(); // Si algo falla, revertimos el usuario y las sucursales
    }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>