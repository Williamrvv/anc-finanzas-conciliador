<?php
session_start();
require_once '../db.php';
header('Content-Type: application/json');

if (!isset($_SESSION['user'])) { echo json_encode(['success' => false]); exit; }

$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');
$field = $_GET['field'] ?? null;
$term  = trim($_GET['term'] ?? '');

// Whitelist estricta: el campo se resuelve por llave, NUNCA se concatena input del usuario en el SQL
$camposGlobales = [
    'contrato'    => "t2.Contrato",
    'afiliado'    => "COALESCE(m2.Afiliado_MerID, CAST(b2.NUMERO_AFILIADO AS VARCHAR(50)), CAST(s2.MerID AS VARCHAR(50)))",
    'auth'        => "m2.Autorizacion",
    'tarjeta'     => "COALESCE(t2.Tarjeta_Ultimos4, b2.NUMERO_DE_TARJETA, s2.Numero_Tarjeta, m2.Tarjeta)",
    'cliente'     => "t2.Cliente",
    'banco'       => "m2.Banco",
    'liquidacion' => "COALESCE(CAST(b2.NUMERO_LIQUIDACION AS VARCHAR(50)), CAST(s2.Numero_Pago AS VARCHAR(50)))"
];
$modoGlobal = $field !== null && isset($camposGlobales[$field]) && $term !== '';
if ($modoGlobal && mb_strlen($term) < 3) {
    echo json_encode(['success' => false, 'error' => 'Ingrese al menos 3 caracteres para la búsqueda global.']); exit;
}

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
            COALESCE(m.Afiliado_MerID, CAST(b.NUMERO_AFILIADO AS VARCHAR(50)), CAST(s.MerID AS VARCHAR(50))) AS Afiliado,
            COALESCE(CAST(b.NUMERO_LIQUIDACION AS VARCHAR(50)), CAST(s.Numero_Pago AS VARCHAR(50))) AS Liquidacion,
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
    ";

    if ($modoGlobal) {
        // Búsqueda forense global: ignora fechas y rescata el GRUPO COMPLETO de cada coincidencia
        // para que las sumas y diferencias del frontend no lleguen mutiladas.
        $sql .= "
          AND m.IdMatchTSD IN (
            SELECT TOP 500 m2.IdMatchTSD
            FROM Tbl_Transacciones_Maestra m2
            LEFT JOIN Tbl_Detalle_TSD t2 ON m2.IdTransaccion = t2.IdTransaccion AND m2.Banco = 'TSD'
            LEFT JOIN Tbl_Detalle_BAC b2 ON m2.IdTransaccion = b2.IdTransaccion AND m2.Banco = 'BAC'
            LEFT JOIN Tbl_Detalle_Scotia s2 ON m2.IdTransaccion = s2.IdTransaccion AND m2.Banco = 'Davibank'
            WHERE m2.IdMatchTSD IS NOT NULL
              AND {$camposGlobales[$field]} LIKE :term
            GROUP BY m2.IdMatchTSD
            ORDER BY MAX(m2.FechaRegistro) DESC
          )";
        // Escapamos los comodines de T-SQL (% _ [) para que el término se busque LITERAL
        $termSql = '%' . str_replace(['[', '%', '_'], ['[[]', '[%]', '[_]'], $term) . '%';
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':term' => $termSql]);
    } else {
        $sql .= " AND CAST(c.ConsolidadoTSD AS DATE) BETWEEN :start AND :end";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':start' => $start, ':end' => $end]);
    }
    
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>