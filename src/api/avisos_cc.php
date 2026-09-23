<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../db.php';

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

$email = $_SESSION['user']['email'] ?? '';
if ($email === '') {
    echo json_encode(['success' => false, 'error' => 'Sesión sin correo.']);
    exit;
}

$accion = $_GET['accion'] ?? 'check';
$clave  = trim((string)($_GET['clave'] ?? ''));

// Sólo se aceptan claves conocidas: evita que se registren avisos inventados
$AVISOS_VALIDOS = ['ICD_OBLIGATORIO_2026_09'];

if (!in_array($clave, $AVISOS_VALIDOS, true)) {
    echo json_encode(['success' => false, 'error' => 'Aviso desconocido.']);
    exit;
}

try {
    $pdo = Database::connect();

    if ($accion === 'confirmar') {
        // MERGE evita el error si el usuario confirma dos veces (doble clic)
        $stmt = $pdo->prepare("
            MERGE dbo.Tbl_Avisos_Leidos AS T
            USING (SELECT ? AS EmailUsuario, ? AS ClaveAviso) AS S
                ON T.EmailUsuario = S.EmailUsuario AND T.ClaveAviso = S.ClaveAviso
            WHEN NOT MATCHED THEN
                INSERT (EmailUsuario, ClaveAviso, IP, UserAgent) VALUES (S.EmailUsuario, S.ClaveAviso, ?, ?);
        ");
        $stmt->execute([
            $email, $clave,
            substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64),
            substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400)
        ]);

        echo json_encode(['success' => true, 'leido' => true]);
        exit;
    }

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM dbo.Tbl_Avisos_Leidos WHERE EmailUsuario = ? AND ClaveAviso = ?");
    $stmt->execute([$email, $clave]);

    echo json_encode(['success' => true, 'leido' => ((int)$stmt->fetchColumn()) > 0]);

} catch (Throwable $e) {
    // Un fallo acá NO debe impedir trabajar: se responde como ya leído
    error_log('avisos_cc: ' . $e->getMessage());
    echo json_encode(['success' => true, 'leido' => true, 'degradado' => true]);
}