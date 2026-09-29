<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['ok' => false, 'error' => 'Acceso denegado']);
    exit;
}

// La sesión ya no se vuelve a usar en este script. Se libera de inmediato.
// Sin esto PHP mantiene el archivo de sesión bloqueado durante toda la
// llamada externa, y cualquier otra petición del mismo navegador queda
// esperando en fila (incluidas las consultas que el usuario ya abandonó).
session_write_close();

$fecha = trim($_GET['fecha'] ?? '');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
    echo json_encode(['ok' => false, 'error' => 'Fecha inválida']);
    exit;
}

[$anio, $mes, $dia] = array_map('intval', explode('-', $fecha));

if (!checkdate($mes, $dia, $anio)) {
    echo json_encode(['ok' => false, 'error' => 'Fecha inválida']);
    exit;
}

$url = 'https://intanc.com/CRM/API/V1/NOTIFICADBR/interfase.php?fecha=' . urlencode($fecha);

$raw        = false;
$httpCode   = 0;
$transporte = null;
$errDetalle = null;
$curlExpiro = false;

// 1) cURL primero: reporta el error real y permite enviar User-Agent.
//    file_get_contents no manda User-Agent y muchos WAF rechazan por eso.
if (function_exists('curl_init')) {
    $transporte = 'curl';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT        => 180,
        // Acepta la respuesta comprimida: los días con mucho detalle
        // se transfieren bastante más rápido.
        CURLOPT_ENCODING       => '',
        // El certificado de intanc.com no lo firma una CA reconocida.
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT      => 'ANCFINANZAS/1.0',
        CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    ]);
    $raw      = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($raw === false) {
        $curlErrNo  = curl_errno($ch);
        $errDetalle = 'cURL #' . $curlErrNo . ': ' . curl_error($ch);
        // 28 = se agotó el tiempo de espera. cURL sí llegó al servidor y
        // esperó su tiempo completo; repetir con fopen sólo duplica la espera.
        $curlExpiro = ($curlErrNo === 28);
    }
    curl_close($ch);
}

// 2) Respaldo por si cURL no está compilado en la imagen.
//    No se intenta cuando cURL ya esperó su tiempo completo: en ese caso
//    el respaldo sólo agrega otros 60 s de espera para fallar igual.
if ($raw === false && !$curlExpiro) {
    $transporte = ($transporte === 'curl') ? 'curl->fopen' : 'fopen';
    $ctx = stream_context_create([
        'http' => [
            'timeout'       => 60,
            'ignore_errors' => true,
            'header'        => "User-Agent: ANCFINANZAS/1.0\r\nAccept: application/json\r\n",
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) {
        $e = error_get_last();
        $errDetalle = ($errDetalle ? $errDetalle . ' | ' : '')
            . 'fopen: ' . ($e['message'] ?? 'sin detalle')
            . ' | allow_url_fopen=' . (ini_get('allow_url_fopen') ? 'On' : 'Off');
    } elseif (isset($http_response_header[0])) {
        $errDetalle = 'fopen OK: ' . $http_response_header[0];
    }
}

// Modo diagnóstico: ?debug=1 devuelve la radiografía de la llamada.
if (isset($_GET['debug'])) {
    echo json_encode([
        'ok'          => false,
        'debug'       => true,
        'url'         => $url,
        'transporte'  => $transporte,
        'http_code'   => $httpCode,
        'detalle'     => $errDetalle,
        'bytes'       => $raw === false ? 0 : strlen($raw),
        'primeros500' => $raw === false ? null : substr($raw, 0, 500),
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($raw === false) {
    echo json_encode([
        'ok'    => false,
        'error' => 'No se pudo contactar la API de Interfase. ' . $errDetalle,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$json = json_decode($raw, true);

if (!is_array($json)) {
    echo json_encode([
        'ok'    => false,
        'error' => 'Respuesta no-JSON (HTTP ' . $httpCode . '): ' . substr(strip_tags($raw), 0, 200),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode($json, JSON_UNESCAPED_UNICODE);