<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}
require_once '../db.php';
try {
    $pdo = Database::connect();
    // EXTRAE TODAS LAS COLUMNAS CON ALIAS SEGUROS PARA JS
    $sql = "
        SELECT 
            m.*, 
            m.HashUnico AS _sourceHash,
            b.NUMERO_AFILIADO, b.NOMBRECOMERCIO, b.FECHA_TRANSACCION AS BAC_FTRANS, b.FECHA_CIERRE_DATAFONO, b.FECHA_PAGO AS BAC_FPAGO, b.NUMERO_DE_TARJETA, b.AUTORIZACION AS BAC_AUTH, b.TERMINAL AS BAC_TERM, b.MONTO_VENTA, b.COMISION AS BacComision, b.RETENCION_VENTAS AS RetencionVentas, b.RETENCION_RENTA AS RetencionRenta, b.MONTONETO AS BAC_NETO, b.NUMERO_LIQUIDACION AS Liquidacion, b.NUMERO_CUENTA, b.TIPO_CAMBIO, b.AJUSTE_COMISION_INTERNACIONAL AS AjusteACI, b.TIPO_TARJETA,
            s.Fuente, s.Fecha_Pago AS ScoFPago, s.Moneda, s.Transaccion, s.Cedula, s.Razon_Social, s.MerID, s.Nombre, s.Fecha_Lote_Ajuste, s.Numero_Lote_Ajuste AS Lote, s.Terminal AS ScoTerm, s.Numero_Pago, s.Numero_Autorizacion AS ScoAuth, s.Numero_Tarjeta AS ScoTarj, s.Monto_Orig, s.Monto_Bruto AS ScoBruto, s.Monto_Comision_Total AS ScoCom, s.Porc_Comision_Total, s.Monto_Comision_Int, s.Porc_Comision_Int, s.Monto_Retencion_IVA AS RetencionIVA, s.Porc_Retencion_IVA, s.Monto_Retencion_ISR AS RetencionISR, s.Monto_Neto AS ScoNeto, s.Estatus,
            pb.Fecha AS PBacF, pb.Referencia AS PBacRef, pb.Codigo AS PBacCod, pb.Descripcion AS PBacDesc, pb.Debitos AS PBacDeb, pb.Creditos AS PBacCred, pb.Balance AS PBacBal,
            ps.Numero_Referencia AS PScoRef, ps.Fecha_Movimiento AS PScoF, ps.Descripcion AS PScoDesc, ps.Monto AS PScoM, ps.Saldo AS PScoSal, ps.Credito_Debito AS PScoCD,
            a.TipoAjuste, a.Justificacion, a.EvidenciaB64
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_BAC b ON m.IdTransaccion = b.IdTransaccion
        LEFT JOIN Tbl_Detalle_Scotia s ON m.IdTransaccion = s.IdTransaccion
        LEFT JOIN Tbl_Pagado_BAC pb ON m.IdTransaccion = pb.IdTransaccion
        LEFT JOIN Tbl_Pagado_Scotia ps ON m.IdTransaccion = ps.IdTransaccion
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        WHERE m.Estado = 'PENDIENTE'
        ORDER BY m.FechaTransaccion ASC
    ";
    
    $stmt = $pdo->query($sql);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>