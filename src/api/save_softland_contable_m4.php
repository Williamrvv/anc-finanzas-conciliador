<?php
session_start();
ini_set('display_errors', 0);

require_once '../db.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode([
        'success' => false,
        'error' => 'Acceso denegado'
    ]);
    exit;
}

$in = json_decode(file_get_contents('php://input'), true);

if (!is_array($in)) {
    echo json_encode([
        'success' => false,
        'error' => 'Payload inválido'
    ]);
    exit;
}

$montoRaw = $in['monto'] ?? null;
$fecha = trim($in['fecha'] ?? '');
$emailUsuario = trim($_SESSION['user']['email'] ?? '');

if ($montoRaw === null || $montoRaw === '' || !is_numeric($montoRaw)) {
    echo json_encode([
        'success' => false,
        'error' => 'El monto indicado no es válido.'
    ]);
    exit;
}

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
    echo json_encode([
        'success' => false,
        'error' => 'La fecha indicada no es válida.'
    ]);
    exit;
}

[$anio, $mes, $dia] = array_map('intval', explode('-', $fecha));

if (!checkdate($mes, $dia, $anio)) {
    echo json_encode([
        'success' => false,
        'error' => 'La fecha indicada no existe.'
    ]);
    exit;
}

$hoyCR = (new DateTimeImmutable(
    'now',
    new DateTimeZone('America/Costa_Rica')
))->format('Y-m-d');

if ($fecha > $hoyCR) {
    echo json_encode([
        'success' => false,
        'error' => 'La fecha no puede estar en el futuro.'
    ]);
    exit;
}

if ($emailUsuario === '') {
    echo json_encode([
        'success' => false,
        'error' => 'No fue posible identificar al usuario.'
    ]);
    exit;
}

try {
    $pdo = Database::connect();

    $stmt = $pdo->prepare("
        INSERT INTO Tbl_Contabilidad_Softland
        (
            FechaContable,
            Monto,
            EmailUsuario
        )
        OUTPUT INSERTED.IdRegistro
        VALUES (CONVERT(date, ?, 23), ?, ?)
    ");

    $stmt->execute([
        $fecha,
        $montoRaw,
        $emailUsuario
    ]);

    $idRegistro = (int)$stmt->fetchColumn();

    echo json_encode([
        'success' => true,
        'id' => $idRegistro
    ]);

} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'No se pudo guardar el registro de Softland: ' . $e->getMessage()
    ]);
}
?>