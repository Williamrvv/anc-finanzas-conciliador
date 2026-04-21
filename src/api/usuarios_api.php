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
        
        // Cargar asignaciones actuales (Unificamos Jefes y Agentes para el Frontend)
        $stmtAsignaciones = $pdo->query("
            SELECT EmailJefe AS Email, CodigoSucursal, NombreSucursal FROM Tbl_Jefes_Estacion
            UNION ALL
            SELECT EmailAgente AS Email, CodigoSucursal, NombreSucursal FROM Tbl_Agentes_Estacion
        ");

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

        if (!$email || !$nombre || !$idRol) throw new Exception("Faltan datos obligatorios.");

        $pdo->beginTransaction(); // Iniciamos transacción (ACID)

        if ($isEdit) {
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

        // --- LÓGICA DE SUCURSALES (JEFES Y AGENTES) ---
        $stmtRol = $pdo->prepare("SELECT Nombre_Rol FROM Tbl_Roles WHERE Id_Rol = ?");
        $stmtRol->execute([$idRol]);
        $roleName = strtolower($stmtRol->fetchColumn());

        // 1. Borramos cualquier asignación previa en ambas tablas por si cambió de rol (Limpieza)
        $pdo->prepare("DELETE FROM Tbl_Jefes_Estacion WHERE EmailJefe = ?")->execute([$email]);
        $pdo->prepare("DELETE FROM Tbl_Agentes_Estacion WHERE EmailAgente = ?")->execute([$email]);

        // 2. Insertamos las nuevas sucursales si aplica
        if ($roleName === 'jefe' || $roleName === 'agente' || $roleName === 'admin') {
            $sucursales = json_decode($_POST['sucursalesJSON'] ?? '[]', true);
            if (empty($sucursales)) throw new Exception("Debe asignar al menos una sucursal para este rol.");

            if ($roleName === 'jefe' || $roleName === 'admin') {
                $stmtIns = $pdo->prepare("INSERT INTO Tbl_Jefes_Estacion (CodigoSucursal, NombreSucursal, NombreJefe, EmailJefe, Activo) VALUES (?, ?, ?, ?, 1)");
            } else {
                $stmtIns = $pdo->prepare("INSERT INTO Tbl_Agentes_Estacion (CodigoSucursal, NombreSucursal, NombreAgente, EmailAgente, Activo) VALUES (?, ?, ?, ?, 1)");
            }
            
            foreach ($sucursales as $suc) {
                try {
                    $stmtIns->execute([$suc['id'], $suc['nombre'], $nombre, $email]);
                } catch (PDOException $ex) {
                    if ($ex->getCode() == 23000 && $roleName === 'jefe') {
                        throw new Exception("La sucursal {$suc['id']} ya está asignada a otro jefe en el sistema. Debe retirarla del otro usuario primero.");
                    }
                    throw $ex;
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