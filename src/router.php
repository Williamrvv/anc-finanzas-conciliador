<?php
session_start();

$raw_view = $_GET['view'] ?? 'dashboard';
$view = preg_replace('/[^a-zA-Z0-9_-]/', '', $raw_view);

// 1. Si no hay sesión, forzamos login
if (!isset($_SESSION['user'])) {
    $view = 'login_view';
} else {
    // 2. CONTROL DE ACCESO BASADO EN ROLES (RBAC) - LISTA BLANCA
    $role = $_SESSION['user']['role'] ?? 'visitante';
    $canManage = $_SESSION['user']['can_manage'] ?? false;
    
    // Todos los usuarios logueados pueden ver el inicio por defecto
    $allowed_views = ['dashboard'];

    // Permisos Dinámicos según el Rol oficial
    switch ($role) {
        case 'admin':
            // El admin tiene acceso absoluto a todo
            $allowed_views = ['dashboard', 'conciliacion', 'tsd', 'cierre_cajas', 'usuarios'];
            break;
            
        case 'conciliador':
            // Solo ve la parte de bancos y consolidado TSD
            $allowed_views = ['dashboard', 'conciliacion', 'tsd'];
            break;
            
        case 'jefe':
        case 'agente':
            // Los de TSD solo ven su módulo de cierres
            $allowed_views = ['dashboard', 'cierre_cajas'];
            break;
            
        case 'visitante':
            // El visitante se queda con el dashboard básico
            $allowed_views = ['dashboard'];
            break;
    }

    // 3. Reglas Especiales (Super Permisos Inter-Roles)
    // Si un Agente o Jefe tiene el "interruptor" encendido, se le abre la puerta del panel de usuarios
    if ($canManage && !in_array('usuarios', $allowed_views)) {
        $allowed_views[] = 'usuarios';
    }

    // 4. El Veredicto Final
    // Si la vista que el usuario escribió en la URL no está en su lista personal de permisos, lo devolvemos al inicio.
    if (!in_array($view, $allowed_views)) {
        $view = 'dashboard';
    }
}

// 5. Cargar el Archivo Seguro
$file = __DIR__ . "/views/$view.php";

if (file_exists($file)) {
    include $file;
} else {
    http_response_code(404);
    echo "<div class='text-center text-red-500 font-bold p-10'>Error 404: Vista no encontrada</div>";
}
?>