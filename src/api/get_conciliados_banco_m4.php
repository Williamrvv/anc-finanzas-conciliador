<?php
session_start();
require_once '../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { echo json_encode(['success' => false]); exit; }

$start = $_GET['start'] ?? date('Y-m-d');
$end   = $_GET['end'] ?? date('Y-m-d');
$banco = $_GET['banco'] ?? 'BAC';

try {
    $pdo = Database::connect();

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
                pg.FechaPago            AS PagFecha,
                pg.Referencia           AS PagReferencia,
                pg.MontoPagado          AS PagMonto,
                c.Folio                 AS Folio,
                CAST(c.ConsolidadoTSD AS DATE) AS FechaFolio
            FROM Tbl_Transacciones_Maestra det
            INNER JOIN Tbl_Detalle_BAC dv ON det.IdTransaccion = dv.IdTransaccion
            INNER JOIN Tbl_Conciliacion_Cierres c ON det.IdCierre = c.IdCierre
            OUTER APPLY (
                SELECT SUM(ISNULL(p2.Creditos, 0)) AS MontoPagado,
                       MIN(p2.Referencia) AS Referencia,
                       MIN(p2.Fecha) AS FechaPago
                FROM Tbl_Transacciones_Maestra mp
                INNER JOIN Tbl_Pagado_BAC p2 ON mp.IdTransaccion = p2.IdTransaccion
                WHERE mp.IdMatch = det.IdMatch 
                  AND mp.Origen = 'PAGADO' 
                  AND mp.Banco = det.Banco
            ) pg
            WHERE UPPER(det.Banco) = 'BAC' 
              AND det.Origen = 'DETALLADO'
              AND det.Estado = 'CONCILIADO' 
              AND det.IdMatch IS NOT NULL
              AND COALESCE(TRY_CONVERT(date, dv.Fecha_Pago, 23),
                           TRY_CONVERT(date, dv.Fecha_Pago, 103)) BETWEEN :start AND :end
            ORDER BY COALESCE(TRY_CONVERT(date, dv.Fecha_Pago, 23),
                              TRY_CONVERT(date, dv.Fecha_Pago, 103)) DESC, det.IdMatch
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
                pg.FechaPago            AS PagFecha,
                pg.Referencia           AS PagReferencia,
                pg.MontoPagado          AS PagMonto,
                c.Folio                 AS Folio,
                CAST(c.ConsolidadoTSD AS DATE) AS FechaFolio
            FROM Tbl_Transacciones_Maestra det
            INNER JOIN Tbl_Detalle_Scotia dv ON det.IdTransaccion = dv.IdTransaccion
            INNER JOIN Tbl_Conciliacion_Cierres c ON det.IdCierre = c.IdCierre
            OUTER APPLY (
                SELECT SUM(ISNULL(p2.Monto, 0)) AS MontoPagado,
                       MIN(p2.Numero_Referencia) AS Referencia,
                       MIN(p2.Fecha_Movimiento) AS FechaPago
                FROM Tbl_Transacciones_Maestra mp
                INNER JOIN Tbl_Pagado_Scotia p2 ON mp.IdTransaccion = p2.IdTransaccion
                WHERE mp.IdMatch = det.IdMatch 
                  AND mp.Origen = 'PAGADO' 
                  AND mp.Banco = det.Banco
            ) pg
            WHERE UPPER(det.Banco) IN ('DAVIBANK', 'SCOTIA') 
              AND det.Origen = 'DETALLADO'
              AND det.Estado = 'CONCILIADO' 
              AND det.IdMatch IS NOT NULL
              AND COALESCE(TRY_CONVERT(date, dv.FECHA_PAGO, 23),
                           TRY_CONVERT(date, dv.FECHA_PAGO, 103)) BETWEEN :start AND :end
            ORDER BY COALESCE(TRY_CONVERT(date, dv.FECHA_PAGO, 23),
                              TRY_CONVERT(date, dv.FECHA_PAGO, 103)) DESC, det.IdMatch
        ";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':start' => $start, ':end' => $end]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

} catch (\Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}