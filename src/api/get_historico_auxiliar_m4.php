<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$fecha = trim($_GET['fecha'] ?? '');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
    echo json_encode(['success' => false, 'error' => 'Fecha inválida']); exit;
}

[$anio, $mes, $dia] = array_map('intval', explode('-', $fecha));

if (!checkdate($mes, $dia, $anio)) {
    echo json_encode(['success' => false, 'error' => 'Fecha inválida']); exit;
}

$inicio = $fecha . ' 00:00:00';

$fechaFin = DateTime::createFromFormat('!Y-m-d', $fecha);
$fechaFin->modify('+1 day');
$fin = $fechaFin->format('Y-m-d H:i:s');

try {
    $pdo = Database::connect();

    $stmt = $pdo->prepare("
        SELECT
            TM.IdTransaccion,
            TM.Banco,
            TM.Origen,
            CASE
                WHEN TM.FechaRealConciliacion >= ? AND TM.FechaRealConciliacion < ?
                    THEN 'CONCILIADO ESE DÍA'
                ELSE 'PENDIENTE AL CIERRE'
            END AS EstadoHistorico,
            TM.Estado AS EstadoActual,
            CONVERT(varchar(10), TM.FechaTransaccion, 23) AS FechaTransaccion,
            CONVERT(varchar(19), TM.FechaIngresoAuxiliar, 120) AS FechaIngresoAuxiliar,
            CONVERT(varchar(10), TM.FechaConciliacion, 23) AS FechaConciliacion,
            CONVERT(varchar(19), TM.FechaRealConciliacion, 120) AS FechaRealConciliacion,
            DATEDIFF(DAY, TM.FechaTransaccion, CAST(? AS date)) AS DiasAntiguedadAlCorte,
            TM.Afiliado_MerID,
            TM.Autorizacion,
            TM.Tarjeta,
            COALESCE(DT.CentroCosto, DB.CentroCosto, DS.CentroCosto) AS CentroCosto,
            COALESCE(DT.SucursalNombre, DB.NOMBRECOMERCIO, DS.Nombre) AS Sucursal,
            TM.MontoBruto,
            TM.MontoNeto,
            TM.IdMatch,
            TM.IdMatchTSD,
            TM.TipoCruceTSD
        FROM Tbl_Transacciones_Maestra TM
        LEFT JOIN Tbl_Detalle_TSD DT
            ON DT.IdTransaccion = TM.IdTransaccion
        LEFT JOIN Tbl_Detalle_BAC DB
            ON DB.IdTransaccion = TM.IdTransaccion
        LEFT JOIN Tbl_Detalle_Scotia DS
            ON DS.IdTransaccion = TM.IdTransaccion
        WHERE
            (
                TM.FechaIngresoAuxiliar IS NOT NULL
                AND TM.FechaIngresoAuxiliar < ?
                AND (
                    TM.FechaRealConciliacion IS NULL
                    OR TM.FechaRealConciliacion >= ?
                )
            )
            OR
            (
                TM.FechaRealConciliacion >= ?
                AND TM.FechaRealConciliacion < ?
            )
        ORDER BY EstadoHistorico DESC, TM.Banco, TM.FechaTransaccion, TM.IdTransaccion
    ");

    $stmt->execute([
        $inicio,
        $fin,
        $fecha,
        $fin,
        $fin,
        $inicio,
        $fin
    ]);

    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pendientes = 0;
    $conciliados = 0;
    $montoPendiente = 0;

    foreach ($data as $row) {
        if ($row['EstadoHistorico'] === 'PENDIENTE AL CIERRE') {
            $pendientes++;
            $montoPendiente += (float)($row['MontoBruto'] ?? 0);
        } elseif ($row['EstadoHistorico'] === 'CONCILIADO ESE DÍA') {
            $conciliados++;
        }
    }

    echo json_encode([
        'success' => true,
        'fecha' => $fecha,
        'summary' => [
            'pendientes' => $pendientes,
            'conciliados' => $conciliados,
            'montoPendiente' => $montoPendiente
        ],
        'data' => $data
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>