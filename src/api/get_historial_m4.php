<?php
session_start();
require_once '../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { echo json_encode(['success' => false]); exit; }

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

try {
    $pdo = Database::connect();
    
    // Extracción enriquecida: Traemos la Maestra + Detalles de TSD y Bancos
    $sql = "
        SELECT 
            m.IdTransaccion, m.IdMatchTSD, m.TipoCruceTSD, m.Banco, m.Autorizacion,
            COALESCE(t.MontoCRC, m.MontoBruto) AS MontoCRC,
            COALESCE(t.Contrato, m.Afiliado_MerID) AS Contrato,
            t.Cliente, t.Recibo_Detalle,
            COALESCE(t.Tarjeta_Ultimos4, b.NUMERO_DE_TARJETA, s.Numero_Tarjeta, m.Tarjeta) AS Tarjeta,
            c.Folio, CAST(c.ConsolidadoTSD AS DATE) AS FechaFolio,
            a.Justificacion, a.EvidenciaB64
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Conciliacion_Cierres c ON m.IdCierre = c.IdCierre
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        LEFT JOIN Tbl_Detalle_TSD t ON m.IdTransaccion = t.IdTransaccion AND m.Banco = 'TSD'
        LEFT JOIN Tbl_Detalle_BAC b ON m.IdTransaccion = b.IdTransaccion AND m.Banco = 'BAC'
        LEFT JOIN Tbl_Detalle_Scotia s ON m.IdTransaccion = s.IdTransaccion AND m.Banco = 'Davibank'
        WHERE m.IdMatchTSD IS NOT NULL 
          AND m.TipoCruceTSD LIKE '%[AUX]%'
          AND c.ConsolidadoTSD IS NOT NULL
          AND CAST(c.ConsolidadoTSD AS DATE) BETWEEN :start AND :end
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':start' => $start, ':end' => $end]);
    
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>