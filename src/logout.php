<?php
session_start();
require_once __DIR__ . '/api/bitacora_lib.php';
Bitacora::registrar('LOGIN', 'LOGOUT', 'OK', ['Url' => $_SERVER['REQUEST_URI'] ?? null, 'Detalle' => ['desde' => $_SERVER['HTTP_REFERER'] ?? null]]);
session_destroy();
header('Location: /');
exit;