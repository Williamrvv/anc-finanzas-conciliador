<?php
session_start();

if (!isset($_GET['code'])) {
    die("Error: No se recibió código de autorización.");
}

$code = $_GET['code'];
$tenantId = getenv('O365_TENANT_ID');
$clientId = getenv('O365_CLIENT_ID');
$clientSecret = getenv('O365_CLIENT_SECRET');
$redirectUri = getenv('O365_REDIRECT_URI');

// 1. Canjear código por Token
$url = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token";
$data = [
    'client_id' => $clientId,
    'scope' => 'User.Read openid profile email',
    'code' => $code,
    'redirect_uri' => $redirectUri,
    'grant_type' => 'authorization_code',
    'client_secret' => $clientSecret
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

$tokenData = json_decode($response, true);

if (!isset($tokenData['access_token'])) {
    die("Error obteniendo token: " . $response);
}

$accessToken = $tokenData['access_token'];

// 2. Obtener datos del usuario usando el Token
$userUrl = "https://graph.microsoft.com/v1.0/me";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $userUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $accessToken",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$userResponse = curl_exec($ch);
curl_close($ch);

$userData = json_decode($userResponse, true);

// 3. Guardar en sesión
$_SESSION['user'] = [
    'id' => $userData['id'],
    'name' => $userData['displayName'],
    'email' => $userData['mail'] ?? $userData['userPrincipalName'],
    'jobTitle' => $userData['jobTitle'] ?? 'N/A'
];

header('Location: /');
exit;