<?php
session_start();
require_once __DIR__ . '/db.php'; // Agregamos la BD

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
    die("Error obteniendo token O365.");
}

$accessToken = $tokenData['access_token'];

// 2. Obtener datos del usuario desde Microsoft Graph
$userUrl = "https://graph.microsoft.com/v1.0/me";
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $userUrl);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer $accessToken", "Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$userResponse = curl_exec($ch);
curl_close($ch);

$userData = json_decode($userResponse, true);

$email = $userData['mail'] ?? $userData['userPrincipalName'];
$name = $userData['givenName'] ?? $userData['displayName'];
$surname = $userData['surname'] ?? '';
$jobTitle = $userData['jobTitle'] ?? 'Colaborador';

// 3. INTEGRACIÓN CON BASE DE DATOS (UPSERT LÓGICO)
try {
    $pdo = Database::connect();
    
    // Consultar si existe
     $stmt = $pdo->prepare("
        SELECT u.Activo, u.Puede_Administrar, r.Nombre_Rol, u.Password_Hash 
        FROM Tbl_Usuarios u 
        INNER JOIN Tbl_Roles r ON u.Id_Rol = r.Id_Rol 
        WHERE u.Email = ?
    ");
    $stmt->execute([$email]);
    $dbUser = $stmt->fetch();

    $finalRole = 'visitante';

    if ($dbUser) {
        // EXISTE: Validar si está activo
        if ($dbUser['Activo'] == 0) {
            die("<div style='text-align:center; padding:50px; font-family:sans-serif;'><h2>⛔ Acceso Denegado</h2><p>Esta cuenta ha sido dada de baja del sistema.</p><a href='/'>Volver</a></div>");
        }
        $finalRole = $dbUser['Nombre_Rol'];
        
        // SELLO DE SEGURIDAD O365: Si el Password_Hash está en NULL, lo rellenamos con basura criptográfica
        // Esto evita que alguien vaya al login local, use el correo y cree una clave suplantando la cuenta.
        if (empty($dbUser['Password_Hash'])) {
            // Generamos un hash de un string largo e irrepetible para inutilizar el login local
            $basuraCriptografica = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
            $stmtSello = $pdo->prepare("UPDATE Tbl_Usuarios SET Password_Hash = ? WHERE Email = ?");
            $stmtSello->execute([$basuraCriptografica, $email]);
        }
        
    } else {
        // NO EXISTE: Crearlo automáticamente
        // Primero, obtener el Id del rol visitante
        $stmtRol = $pdo->prepare("SELECT Id_Rol FROM Tbl_Roles WHERE Nombre_Rol = 'visitante'");
        $stmtRol->execute();
        $idRolVisitante = $stmtRol->fetchColumn();

        // Inmediatamente le aplicamos el sello criptográfico para que nazca protegido
        $basuraCriptografica = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);

        // Insertar usuario
        $stmtInsert = $pdo->prepare("
            INSERT INTO Tbl_Usuarios (Email, Nombre, Apellidos, Puesto, Id_Rol, Password_Hash) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmtInsert->execute([$email, $name, $surname, $jobTitle, $idRolVisitante, $basuraCriptografica]);
    }

    $canManage = isset($dbUser['Puede_Administrar']) && $dbUser['Puede_Administrar'] == 1;
    // 4. Guardar en sesión PHP
    $_SESSION['user'] = [
        'email' => $email,
        'name' => $name . ' ' . $surname,
        'jobTitle' => $jobTitle,
        'role' => $finalRole,
        'can_manage' => ($canManage || $finalRole === 'admin')
    ];

    header('Location: /');
    exit;

} catch (Exception $e) {
    die("Error Crítico de Base de Datos: No se pudo verificar la identidad.");
}
?>