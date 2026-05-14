<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

try {
    $pdo = Database::connect();

    // 1. EXTRAER TSD PENDIENTES
    $sqlTSD = "
        SELECT 
            m.IdTransaccion AS ID_Transaccion, m.Estado,
            t.Contrato, t.Cliente, t.Recibo_Detalle, t.MontoUSD, t.TipoCambio AS TC, 
            t.MontoCRC, t.TipoTarjeta AS Tipo, t.Autorizacion, t.Tarjeta_Ultimos4, 
            t.FechaPago AS Fecha, t.RecibidoPor, t.ICD, t.SucursalCod, t.SucursalNombre AS Sucursal
        FROM Tbl_Transacciones_Maestra m
        INNER JOIN Tbl_Detalle_TSD t ON m.IdTransaccion = t.IdTransaccion
        WHERE m.Banco = 'TSD' AND m.IdMatchTSD IS NULL AND m.Estado = 'PENDIENTE'
    ";
    $dataTSD = $pdo->query($sqlTSD)->fetchAll(PDO::FETCH_ASSOC);

    // 2. EXTRAER BANCOS PENDIENTES (BAC y DAVIBANK combinados)
    $sqlBancos = "
        SELECT 
            m.IdTransaccion, m.IdCierre AS Folio_Cierre, 'BAC' AS Banco,
            b.NUMERO_AFILIADO AS Afiliado_MerID, b.TERMINAL AS Codigo_Sucursal_Terminal,
            b.NOMBRECOMERCIO AS Nombre_Sucursal_Comercio, RIGHT(RTRIM(LTRIM(b.NUMERO_DE_TARJETA)), 4) AS Tarjeta_Ultimos4,
            b.AUTORIZACION AS Numero_Autorizacion, b.MONTO_VENTA AS Monto_Venta_Original, b.FECHA_PAGO AS Fecha_Pago_Excel,
            a.TipoAjuste, a.Justificacion
        FROM Tbl_Transacciones_Maestra m
        INNER JOIN Tbl_Detalle_BAC b ON m.IdTransaccion = b.IdTransaccion
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        WHERE m.Banco = 'BAC' AND m.IdMatchTSD IS NULL AND (m.Origen = 'DETALLADO' OR a.IdTransaccion IS NOT NULL)

        UNION ALL

        SELECT 
            m.IdTransaccion, m.IdCierre AS Folio_Cierre, 'Davibank' AS Banco,
            s.MerID AS Afiliado_MerID, s.Terminal AS Codigo_Sucursal_Terminal,
            s.Nombre AS Nombre_Sucursal_Comercio, RIGHT(RTRIM(LTRIM(s.Numero_Tarjeta)), 4) AS Tarjeta_Ultimos4,
            s.Numero_Autorizacion AS Numero_Autorizacion, s.Monto_Orig AS Monto_Venta_Original, s.Fecha_Pago AS Fecha_Pago_Excel,
            a.TipoAjuste, a.Justificacion
        FROM Tbl_Transacciones_Maestra m
        INNER JOIN Tbl_Detalle_Scotia s ON m.IdTransaccion = s.IdTransaccion
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        WHERE m.Banco = 'SCOTIA' AND m.IdMatchTSD IS NULL AND (m.Origen = 'DETALLADO' OR a.IdTransaccion IS NOT NULL)
    ";
    $dataBancos = $pdo->query($sqlBancos)->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'tsd' => $dataTSD,
        'bancos' => $dataBancos
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>