<?php
ini_set('display_errors', 0);

// read_and_close: lee la sesión sin bloquearla. La bitácora nunca frena al sistema.
session_start(['read_and_close' => true]);
require_once __DIR__ . '/bitacora_lib.php';

http_response_code(204);

$raw = file_get_contents('php://input');
if (!is_string($raw) || $raw === '' || strlen($raw) > 512000) exit;

$paquete = json_decode($raw, true);
if (!is_array($paquete) || empty($paquete['eventos']) || !is_array($paquete['eventos'])) exit;

// Sin sesión sólo se aceptan eventos de la pantalla de login, y pocos.
$conSesion = isset($_SESSION['user']);
$eventos   = array_slice($paquete['eventos'], 0, $conSesion ? 300 : 30);

$txt = function ($v) { return ($v === null || is_array($v) || is_object($v)) ? null : (string)$v; };

$ctx     = Bitacora::contexto();
$pestana = substr((string)($paquete['pestana'] ?? ''), 0, 40);
$filas   = [];

foreach ($eventos as $e) {
    if (!is_array($e)) continue;

    $modulo = (string)($e['modulo'] ?? '');
    if (!in_array($modulo, ['LOGIN', 'CIERRE_CAJA'], true)) continue;
    if (!$conSesion && $modulo !== 'LOGIN') continue;

    $fc = (string)($e['ts'] ?? '');

    $filas[] = array_merge($ctx, [
        'FechaCliente' => preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/', $fc) ? $fc : null,
        'Origen'       => 'NAVEGADOR',
        'Modulo'       => $modulo,
        'Evento'       => $txt($e['evento'] ?? null) ?? 'DESCONOCIDO',
        'Resultado'    => $txt($e['resultado'] ?? null) ?? 'INFO',
        'IdPestana'    => $pestana,
        'Secuencia'    => $e['seq'] ?? null,
        'Funcion'      => $txt($e['funcion'] ?? null),
        'Elemento'     => $txt($e['elemento'] ?? null),
        'Url'          => $txt($e['url'] ?? null),
        'Metodo'       => $txt($e['metodo'] ?? null),
        'HttpStatus'   => $e['status'] ?? null,
        'DuracionMs'   => $e['ms'] ?? null,
        'Mensaje'      => $txt($e['mensaje'] ?? null),
        'Detalle'      => $e['detalle'] ?? null,
    ]);
}

Bitacora::insertar($filas);