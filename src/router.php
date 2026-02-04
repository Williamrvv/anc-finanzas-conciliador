<?php
session_start();

$view = $_GET['view'] ?? 'dashboard';

// Si no hay sesión, forzamos la vista de login
if (!isset($_SESSION['user'])) {
    $view = 'login_view';
}

$file = __DIR__ . "/views/$view.php";

if (file_exists($file)) {
    include $file;
} else {
    http_response_code(404);
    echo "<div class='text-center text-red-500 font-bold p-10'>Error 404: Vista no encontrada</div>";
}
?>