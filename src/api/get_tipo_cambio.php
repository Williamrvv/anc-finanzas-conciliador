<?php
// ============================================================================
//  get_tipo_cambio.php — Tipo de cambio de TSD para una fecha de pago
//
//  Uso:  api/get_tipo_cambio.php?fecha=2026-07-27
//        (sin 'fecha' devuelve el del día de hoy)
//
//  TSD no carga tipo de cambio todos los días, así que la consulta toma el
//  último registro con AsOf <= fecha. Es el mismo criterio que usa el negocio.
// ============================================================================
session_start();
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Sin sesión']); exit;
}

require_once 'tsd_db.php';

$fecha = trim($_GET['fecha'] ?? '');
if ($fecha === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
    $fecha = date('Y-m-d');
}
$pais = strtoupper(trim($_GET['pais'] ?? 'CRI'));

try {
    $pdo = TSDDatabase::connect();

    $sql = "SELECT TOP 1 Ex.Sell AS Tipo_Cambio, CONVERT(varchar(10), Ex.AsOf, 23) AS Fecha_TC
            FROM dbo.Exchange AS Ex
            INNER JOIN dbo.Setup AS S ON Ex.LocCode = S.Location
            WHERE S.Country = :pais
              AND Ex.AsOf <= :fecha
            ORDER BY Ex.AsOf DESC";

    $st = $pdo->prepare($sql);
    $st->execute([':pais' => $pais, ':fecha' => $fecha]);
    $row = $st->fetch(PDO::FETCH_ASSOC);

    if (!$row || !$row['Tipo_Cambio']) {
        echo json_encode(['success' => false, 'error' => 'TSD no tiene tipo de cambio para ' . $fecha]);
        exit;
    }

    echo json_encode([
        'success'         => true,
        'tipoCambio'      => (float)$row['Tipo_Cambio'],
        'fechaSolicitada' => $fecha,
        'fechaTC'         => $row['Fecha_TC'],                 // puede ser anterior a la pedida
        'esExacto'        => ($row['Fecha_TC'] === $fecha)
    ]);

} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error TSD: ' . $e->getMessage()]);
}