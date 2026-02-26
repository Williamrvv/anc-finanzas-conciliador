<?php
session_start();

$raw_view = $_GET['view'] ?? 'dashboard';
$view = preg_replace('/[^a-zA-Z0-9_-]/', '', $raw_view);

// 1. Si no hay sesión, forzamos login
if (!isset($_SESSION['user'])) {
    $view = 'login_view';
} else {
    // 2. Control de Acceso Basado en Roles (RBAC)
    $role = $_SESSION['user']['role'] ?? 'visitante';

    // Reglas de Bloqueo (Actualizado con el Súper Permiso)
    $canManage = $_SESSION['user']['can_manage'] ?? false;
    $isAdmin = ($_SESSION['user']['role'] ?? '') === 'admin';
    
    // Si no tiene el súper permiso Y TAMPOCO es admin, lo bloqueamos
    if ($view === 'usuarios' && !$canManage && !$isAdmin) {
        $view = 'dashboard';
    }
    
    if ($view === 'conciliacion' && $role === 'visitante') {
        $view = 'dashboard'; // El visitante no puede conciliar
    }
}

$file = __DIR__ . "/views/$view.php";

if (file_exists($file)) {
    include $file;
} else {
    http_response_code(404);
    echo "<div class='text-center text-red-500 font-bold p-10'>Error 404: Vista no encontrada</div>";
}
?>