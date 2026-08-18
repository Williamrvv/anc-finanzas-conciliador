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
    //    La maestra manda: el grupo lo define IdMatch. Dentro del grupo, el
    //    depósito exacto se identifica por el número que viene EN LA DESCRIPCIÓN:
    //      · Davibank -> "PCA 3897104 COMERCIO 91940101"  => contra Numero_Pago
    //      · BAC      -> "AFI23341409 LIQ61850948827"     => contra NUMERO_LIQUIDACION
    //    Nada se deduce por fecha ni por monto.
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
                -- DAVIBANK: número de PCA de la descripción contra Numero_Pago
                ( ps.Descripcion IS NOT NULL AND CHARINDEX('PCA', ps.Descripcion) > 0
                  AND LTRIM(RTRIM(SUBSTRING(
                        ps.Descripcion,
                        CHARINDEX('PCA', ps.Descripcion) + 4,
                        ISNULL(NULLIF(CHARINDEX(' ', ps.Descripcion + ' ', CHARINDEX('PCA', ps.Descripcion) + 4), 0), LEN(ps.Descripcion) + 1)
                            - (CHARINDEX('PCA', ps.Descripcion) + 4)
                      ))) IN (
                        SELECT LTRIM(RTRIM(s2.Numero_Pago))
                        FROM Tbl_Transacciones_Maestra m2
                        INNER JOIN Tbl_Detalle_Scotia s2 ON s2.IdTransaccion = m2.IdTransaccion
                        WHERE m2.IdMatchTSD = :idm2 AND s2.Numero_Pago IS NOT NULL
                      )
                )
                OR
                -- BAC: número de liquidación de la descripción contra NUMERO_LIQUIDACION
                ( pb.Descripcion IS NOT NULL AND CHARINDEX('LIQ', pb.Descripcion) > 0
                  AND LTRIM(RTRIM(SUBSTRING(pb.Descripcion, CHARINDEX('LIQ', pb.Descripcion) + 3, 50))) IN (
                        SELECT LTRIM(RTRIM(b2.NUMERO_LIQUIDACION))
                        FROM Tbl_Transacciones_Maestra m2
                        INNER JOIN Tbl_Detalle_BAC b2 ON b2.IdTransaccion = m2.IdTransaccion
                        WHERE m2.IdMatchTSD = :idm3 AND b2.NUMERO_LIQUIDACION IS NOT NULL
                      )
                )
              )
    ");
    $stmtP->execute([':idm' => $id, ':idm2' => $id, ':idm3' => $id]);

    // Respaldo: si el texto de la descripción no tuviera el formato esperado, se
    // devuelven todos los depósitos del grupo antes que dejar la etapa vacía.
    $filasP = $stmtP->fetchAll(PDO::FETCH_ASSOC);
    if (count($filasP) === 0) {
        $stmtPAll = $pdo->prepare("
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
        ");
        $stmtPAll->execute([':idm' => $id]);
        $filasP = $stmtPAll->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode([
        'success' => true, 
        'tsd' => $stmtT->fetchAll(PDO::FETCH_ASSOC), 
        'detallado' => $stmtD->fetchAll(PDO::FETCH_ASSOC), 
        'pagado' => $filasP
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>