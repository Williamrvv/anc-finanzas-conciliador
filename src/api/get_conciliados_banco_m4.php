<?php
session_start();
require_once '../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { echo json_encode(['success' => false]); exit; }

$start = $_GET['start'] ?? date('Y-m-d');
$end   = $_GET['end'] ?? date('Y-m-d');
$banco = $_GET['banco'] ?? 'BAC'; // 'BAC' o 'Davibank'

try {
    $pdo = Database::connect();

    // Empareja DETALLADO (venta) con PAGADO (depósito) por IdMatch, ambos CONCILIADOS,
    // dentro del rango de fecha de folio consolidado. Solo lo que vive en la Maestra.
    if ($banco === 'BAC') {
        $sql = "
            SELECT 
                det.IdMatch,
                dv.NUMERO_AFILIADO      AS Afiliado,
                dv.NOMBRECOMERCIO       AS Comercio,
                dv.NUMERO_DE_TARJETA    AS Tarjeta,
                dv.AUTORIZACION         AS Autorizacion,
                dv.TIPO_TARJETA         AS TipoTarjeta,
                dv.MONTO_VENTA          AS DetBruto,
                dv.COMISION             AS DetComision,
                (ISNULL(dv.RETENCION_VENTAS,0) + ISNULL(dv.RETENCION_RENTA,0)) AS DetRetenciones,
                dv.MONTONETO            AS DetNeto,
                dv.NUMERO_LIQUIDACION   AS Liquidacion,
                dv.CentroCosto          AS CentroCosto,
                pg.Fecha                AS PagFecha,
                pg.Referencia           AS PagReferencia,
                pg.Creditos             AS PagMonto,
                c.Folio                 AS Folio,
                CAST(c.ConsolidadoTSD AS DATE) AS FechaFolio
            FROM Tbl_Transacciones_Maestra det
            INNER JOIN Tbl_Detalle_BAC dv ON det.IdTransaccion = dv.IdTransaccion
            INNER JOIN Tbl_Transacciones_Maestra pgm ON pgm.IdMatch = det.IdMatch AND pgm.Origen = 'PAGADO'
            LEFT JOIN Tbl_Pagado_BAC pg ON pgm.IdTransaccion = pg.IdTransaccion
            LEFT JOIN Tbl_Conciliacion_Cierres c ON det.IdCierre = c.IdCierre
            WHERE det.Banco = 'BAC' AND det.Origen = 'DETALLADO'
              AND det.Estado = 'CONCILIADO' AND det.IdMatch IS NOT NULL
              AND c.ConsolidadoTSD IS NOT NULL
              AND CAST(c.ConsolidadoTSD AS DATE) BETWEEN :start AND :end
            ORDER BY c.IdCierre ASC, det.IdMatch
        ";
    } else {
        $sql = "
            SELECT 
                det.IdMatch,
                dv.MerID                AS Afiliado,
                dv.Nombre               AS Comercio,
                dv.Numero_Tarjeta       AS Tarjeta,
                dv.Numero_Autorizacion  AS Autorizacion,
                NULL                    AS TipoTarjeta,
                dv.Monto_Bruto          AS DetBruto,
                dv.Monto_Comision_Total AS DetComision,
                (ISNULL(dv.Monto_Retencion_IVA,0) + ISNULL(dv.Monto_Retencion_ISR,0)) AS DetRetenciones,
                dv.Monto_Neto           AS DetNeto,
                dv.Numero_Pago          AS Liquidacion,
                dv.CentroCosto          AS CentroCosto,
                pg.Fecha_Movimiento     AS PagFecha,
                pg.Numero_Referencia    AS PagReferencia,
                pg.Monto                AS PagMonto,
                c.Folio                 AS Folio,
                CAST(c.ConsolidadoTSD AS DATE) AS FechaFolio
            FROM Tbl_Transacciones_Maestra det
            INNER JOIN Tbl_Detalle_Scotia dv ON det.IdTransaccion = dv.IdTransaccion
            INNER JOIN Tbl_Transacciones_Maestra pgm ON pgm.IdMatch = det.IdMatch AND pgm.Origen = 'PAGADO'
            LEFT JOIN Tbl_Pagado_Scotia pg ON pgm.IdTransaccion = pg.IdTransaccion
            LEFT JOIN Tbl_Conciliacion_Cierres c ON det.IdCierre = c.IdCierre
            WHERE det.Banco = 'Davibank' AND det.Origen = 'DETALLADO'
              AND det.Estado = 'CONCILIADO' AND det.IdMatch IS NOT NULL
              AND c.ConsolidadoTSD IS NOT NULL
              AND CAST(c.ConsolidadoTSD AS DATE) BETWEEN :start AND :end
            ORDER BY c.IdCierre ASC, det.IdMatch
        ";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':start' => $start, ':end' => $end]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (\Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}