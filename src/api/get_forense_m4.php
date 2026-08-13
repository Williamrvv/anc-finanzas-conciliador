<?php
session_start();
require_once '../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { echo json_encode(['success' => false]); exit; }

$id = $_GET['id'] ?? '';
if (!$id) { echo json_encode(['success' => false, 'error' => 'ID no proporcionado']); exit; }

try {
    $pdo = Database::connect();
    
    // 1. LADO DERECHO: TSD
    $stmtT = $pdo->prepare("
        SELECT m.FechaTransaccion, m.MontoBruto, m.MontoNeto, m.Estado, m.IdCierre AS FolioMaestra,
               m.Autorizacion AS AuthMaestra, m.Tarjeta AS TarjetaMaestra, m.DiasAntiguedad,
               m.ColorEtiqueta, m.NotaUsuario, m.TipoCruceTSD, m.HashUnico, m.ArchivoOrigen,
               t.*
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_TSD t ON m.IdTransaccion = t.IdTransaccion
        WHERE m.IdMatchTSD = ? AND m.Banco = 'TSD'
    ");
    $stmtT->execute([$id]);
    
    // 2. CENTRO: Detallados (Bancos)
    $stmtD = $pdo->prepare("
        SELECT m.IdTransaccion, m.IdMatch, m.Banco, m.Origen, m.Estado, m.MontoBruto, m.MontoNeto,
               m.Autorizacion, m.Tarjeta, m.FechaTransaccion, m.Afiliado_MerID, m.ArchivoOrigen,
               m.HashUnico, m.IdCierre, m.TipoCruceTSD, m.ColorEtiqueta, m.NotaUsuario, m.DiasAntiguedad,
               -- BAC
               b.NUMERO_AFILIADO, b.NOMBRECOMERCIO, b.FECHA_TRANSACCION AS BacFechaTrx,
               b.FECHA_CIERRE_DATAFONO AS BacFechaCierreDat, b.FECHA_PAGO AS BacFechaPago,
               b.NUMERO_DE_TARJETA AS BacTarjeta, b.AUTORIZACION AS BacAuth, b.TERMINAL AS BacTerm,
               b.MONTO_VENTA AS BacMonto, b.COMISION AS BacCom, b.RETENCION_VENTAS, b.RETENCION_RENTA,
               b.MONTONETO AS BacNeto, b.NUMERO_LIQUIDACION AS BacLiquidacion, b.NUMERO_CUENTA AS BacCuenta,
               b.TIPO_CAMBIO AS BacTipoCambio, b.AJUSTE_COMISION_INTERNACIONAL, b.TIPO_TARJETA AS BacTipoTarjeta,
               b.CentroCosto AS BacCentroCosto,
               -- DAVIBANK
               s.Fuente AS ScoFuente, s.Fecha_Pago AS ScoFechaPago, s.Moneda AS ScoMoneda,
               s.Transaccion AS ScoTransaccion, s.Razon_Social AS ScoRazonSocial, s.MerID, s.Nombre,
               s.Fecha_Lote_Ajuste AS ScoFechaLote, s.Numero_Lote_Ajuste AS ScoNumLote,
               s.Terminal AS ScoTerm, s.Numero_Pago AS ScoNumPago, s.Numero_Autorizacion AS ScoAuth,
               s.Numero_Tarjeta AS ScoTarjeta, s.Monto_Orig AS ScoMonto, s.Monto_Bruto AS ScoBrutoTot,
               s.Monto_Comision_Total AS ScoCom, s.Porc_Comision_Total AS ScoPorcCom,
               s.Monto_Comision_Int AS ScoComInt, s.Porc_Comision_Int AS ScoPorcComInt,
               s.Monto_Retencion_IVA, s.Porc_Retencion_IVA AS ScoPorcIVA, s.Monto_Retencion_ISR,
               s.Monto_Neto AS ScoNeto, s.Estatus AS ScoEstatus, s.CentroCosto AS ScoCentroCosto,
               s.Monto_Dolar AS ScoMontoDolar,
               -- Auditoría
               a.Justificacion, a.TipoAjuste, a.EvidenciaB64
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_BAC     b ON m.IdTransaccion = b.IdTransaccion
        LEFT JOIN Tbl_Detalle_Scotia  s ON m.IdTransaccion = s.IdTransaccion
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        WHERE m.IdMatchTSD = ? AND m.Banco != 'TSD'
    ");
    $stmtD->execute([$id]);
    
    // 3. LADO IZQUIERDO: Depósitos.
    //    BAC cruza UNO A UNO por número de liquidación, así que su IdMatch ya
    //    apunta al depósito exacto. DAVIBANK agrupa por comercio (MerID), por lo
    //    que el IdMatch abarca todo el lote del afiliado. Para acotarlo se usa
    //    además la FECHA DE PAGO del detalle contra la fecha del movimiento.
    $stmtFecha = $pdo->prepare("
        SELECT TOP 1 COALESCE(
                 TRY_CONVERT(date, b.FECHA_PAGO, 23), TRY_CONVERT(date, b.FECHA_PAGO, 103),
                 TRY_CONVERT(date, s.Fecha_Pago, 23), TRY_CONVERT(date, s.Fecha_Pago, 103)
               ) AS FechaPagoRef
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_BAC    b ON b.IdTransaccion = m.IdTransaccion
        LEFT JOIN Tbl_Detalle_Scotia s ON s.IdTransaccion = m.IdTransaccion
        WHERE m.IdMatchTSD = ? AND m.Banco <> 'TSD'
          AND COALESCE(
                 TRY_CONVERT(date, b.FECHA_PAGO, 23), TRY_CONVERT(date, b.FECHA_PAGO, 103),
                 TRY_CONVERT(date, s.Fecha_Pago, 23), TRY_CONVERT(date, s.Fecha_Pago, 103)
               ) IS NOT NULL
    ");
    $stmtFecha->execute([$id]);
    $fechaPagoRef = $stmtFecha->fetchColumn();   // puede venir null

    $stmtP = $pdo->prepare("
        SELECT m.IdTransaccion, m.Banco, m.IdMatch, m.MontoBruto,
               pb.Referencia AS BacRef, pb.Fecha AS BacFecha, pb.Descripcion AS BacDesc, pb.Creditos AS BacCred,
               pb.Codigo AS BacCodigo, pb.Debitos AS BacDebitos, pb.Balance AS BacBalance, pb.IdCierre AS BacIdCierre,
               ps.Numero_Referencia AS ScoRef, ps.Fecha_Movimiento AS ScoFecha, ps.Descripcion AS ScoDesc,
               ps.Monto AS ScoMonto, ps.Credito_Debito, ps.Saldo AS ScoSaldo,
               ps.IdCierre AS ScoIdCierre, ps.Monto_Dolar AS ScoMontoDolarPag,
               (SELECT COUNT(*) FROM Tbl_Transacciones_Maestra mv
                 WHERE mv.IdMatch = m.IdMatch AND mv.Origen <> 'PAGADO' AND mv.Banco <> 'TSD') AS VentasDelGrupo
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Pagado_BAC    pb ON m.IdTransaccion = pb.IdTransaccion
        LEFT JOIN Tbl_Pagado_Scotia ps ON m.IdTransaccion = ps.IdTransaccion
        WHERE m.Origen = 'PAGADO'
          AND m.IdMatch IN (SELECT IdMatch FROM Tbl_Transacciones_Maestra WHERE IdMatchTSD = :idm AND IdMatch IS NOT NULL)
          AND (
                :fref IS NULL                      -- sin fecha de referencia: no se acota
                OR m.Banco <> 'Davibank'           -- BAC ya viene uno a uno
                OR COALESCE(
                     TRY_CONVERT(date, ps.Fecha_Movimiento, 23),
                     TRY_CONVERT(date, ps.Fecha_Movimiento, 103)
                   ) = :fref2
              )
    ");
    $stmtP->execute([':idm' => $id, ':fref' => $fechaPagoRef, ':fref2' => $fechaPagoRef]);

    echo json_encode([
        'success' => true, 
        'tsd' => $stmtT->fetchAll(PDO::FETCH_ASSOC), 
        'detallado' => $stmtD->fetchAll(PDO::FETCH_ASSOC), 
        'pagado' => $stmtP->fetchAll(PDO::FETCH_ASSOC)
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>