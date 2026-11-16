<?php
// Latido de sesión. Lo llama js/app.js SOLO cuando hubo actividad real del usuario,
// y para cerrar la sesión cuando se cumple el límite de inactividad.
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

if (($_GET['accion'] ?? '') === 'cerrar' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    require_once __DIR__ . '/bitacora_lib.php';
    Bitacora::registrar('LOGIN', 'LOGOUT_INACTIVIDAD', 'OK', ['Url' => $_SERVER['REQUEST_URI'] ?? null]);
    session_destroy();
    echo json_encode(['success' => true, 'cerrada' => true]);
    exit;
}

// Escribir en la sesión es lo que renueva su vida en el servidor
$_SESSION['ultimo_ping'] = time();
echo json_encode(['success' => true, 'vida_servidor' => (int) ini_get('session.gc_maxlifetime')]);