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
    
    // Traemos todo lo que está PENDIENTE, sumando los días de antigüedad
    $sql = "
        SELECT 
            m.*, 
            b.Liquidacion, b.Comision AS BacComision, b.RetencionVentas, b.RetencionRenta, b.AjusteACI,
            s.Lote, s.Comision AS ScotiaComision, s.RetencionIVA, s.RetencionISR,
            a.TipoAjuste, a.Justificacion, a.EvidenciaB64
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_BAC b ON m.IdTransaccion = b.IdTransaccion
        LEFT JOIN Tbl_Detalle_Scotia s ON m.IdTransaccion = s.IdTransaccion
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        WHERE m.Estado = 'PENDIENTE'
        ORDER BY m.FechaTransaccion ASC
    ";
    
    $stmt = $pdo->query($sql);
    $pendientes = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $pendientes
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>