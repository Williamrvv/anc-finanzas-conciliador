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
    $stmtT = $pdo->prepare("SELECT m.FechaTransaccion, m.MontoBruto, t.* FROM Tbl_Transacciones_Maestra m LEFT JOIN Tbl_Detalle_TSD t ON m.IdTransaccion = t.IdTransaccion WHERE m.IdMatchTSD = ? AND m.Banco = 'TSD'");
    $stmtT->execute([$id]);
    
    // 2. CENTRO: Detallados (Bancos)
    $stmtD = $pdo->prepare("SELECT m.IdTransaccion, m.IdMatch, m.Banco, m.MontoBruto, m.Autorizacion, m.Tarjeta, b.NUMERO_AFILIADO, b.TERMINAL AS BacTerm, b.NOMBRECOMERCIO, b.MONTO_VENTA AS BacMonto, b.COMISION AS BacCom, b.RETENCION_VENTAS, b.RETENCION_RENTA, b.MONTONETO AS BacNeto, b.AJUSTE_COMISION_INTERNACIONAL, s.MerID, s.Terminal AS ScoTerm, s.Nombre, s.Monto_Orig AS ScoMonto, s.Monto_Comision_Total AS ScoCom, s.Monto_Retencion_IVA, s.Monto_Retencion_ISR, s.Monto_Neto AS ScoNeto, a.Justificacion, a.TipoAjuste FROM Tbl_Transacciones_Maestra m LEFT JOIN Tbl_Detalle_BAC b ON m.IdTransaccion = b.IdTransaccion LEFT JOIN Tbl_Detalle_Scotia s ON m.IdTransaccion = s.IdTransaccion LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion WHERE m.IdMatchTSD = ? AND m.Banco != 'TSD'");
    $stmtD->execute([$id]);
    
    // 3. LADO IZQUIERDO: Pagados (Depósitos asociados a los Detallados anteriores)
    $stmtP = $pdo->prepare("SELECT m.IdTransaccion, m.Banco, m.IdMatch, m.MontoBruto, pb.Referencia AS BacRef, pb.Fecha AS BacFecha, pb.Descripcion AS BacDesc, pb.Creditos AS BacCred, ps.Numero_Referencia AS ScoRef, ps.Fecha_Movimiento AS ScoFecha, ps.Descripcion AS ScoDesc, ps.Monto AS ScoMonto, ps.Credito_Debito FROM Tbl_Transacciones_Maestra m LEFT JOIN Tbl_Pagado_BAC pb ON m.IdTransaccion = pb.IdTransaccion LEFT JOIN Tbl_Pagado_Scotia ps ON m.IdTransaccion = ps.IdTransaccion WHERE m.Origen = 'PAGADO' AND m.IdMatch IN (SELECT IdMatch FROM Tbl_Transacciones_Maestra WHERE IdMatchTSD = ? AND IdMatch IS NOT NULL)");
    $stmtP->execute([$id]);

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