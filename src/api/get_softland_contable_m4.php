<?php
session_start();
error_reporting(0);

require_once '../db.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode([
        'success' => false,
        'error' => 'Sin sesión'
    ]);
    exit;
}

$fecha = trim($_GET['fecha'] ?? '');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
    echo json_encode([
        'success' => false,
        'error' => 'Fecha inválida'
    ]);
    exit;
}

[$anio, $mes, $dia] = array_map('intval', explode('-', $fecha));

if (!checkdate($mes, $dia, $anio)) {
    echo json_encode([
        'success' => false,
        'error' => 'Fecha inválida'
    ]);
    exit;
}

try {
    $pdo = Database::connect();

    $stmt = $pdo->prepare("
        SELECT
            IdRegistro AS id,
            CONVERT(varchar(10), FechaContable, 23) AS FechaContable,
            Monto,
            ReferenciaSoftland,
            EmailUsuario,
            CONVERT(varchar(19), FechaRegistro, 120) AS FechaRegistro
        FROM Tbl_Contabilidad_Softland
        WHERE FechaContable = CONVERT(date, ?, 23)
        ORDER BY FechaRegistro DESC, IdRegistro DESC
    ");

    $stmt->execute([$fecha]);

    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total = array_reduce($data, function ($acum, $row) {
        return $acum + (float)($row['Monto'] ?? 0);
    }, 0.0);

    echo json_encode([
        'success' => true,
        'data' => $data ?: [],
        'summary' => [
            'cantidad' => count($data),
            'total' => $total
        ]
    ]);

} catch (\Throwable $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Error SQL: ' . $e->getMessage()
    ]);
}