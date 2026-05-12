<?php
session_start();
require_once '../db.php';
require_once 'tsd_db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$type = $_GET['type'] ?? '';
$start = $_GET['start'] ?? date('Y-m-d');
$end = $_GET['end'] ?? date('Y-m-d');

try {
    $pdoTSD = TSDDatabase::connect();
    $pdoBancos = Database::connect();

    // 1. Obtener Promedio de Tipo de Cambio Seguro desde TSD (Evita Fines de Semana o Nulos)
    $sqlTC = "
        SELECT 
            CASE 
                WHEN AVG(Sell) IS NULL OR AVG(Sell) < 300 THEN (
                    SELECT TOP (1) E2.Sell
                    FROM dbo.Exchange AS E2
                    WHERE E2.CurrencyCode = 'CRC'
                      AND E2.Sell > 300
                      AND E2.AsOf <= :endFallback
                    ORDER BY E2.AsOf DESC
                )
                ELSE AVG(Sell) 
            END AS PromedioTC
        FROM dbo.Exchange
        WHERE AsOf BETWEEN :start AND :end
          AND CurrencyCode = 'CRC';
    ";
    $stmtTC = $pdoTSD->prepare($sqlTC);
    // Le pasamos :endFallback (que es el mismo $end) para que el subquery busque hacia atrás desde la última fecha
    $stmtTC->execute([':start' => $start, ':end' => $end, ':endFallback' => $end]);
    $tcRow = $stmtTC->fetch();
    $tcPromedio = $tcRow['PromedioTC'] ? (float)$tcRow['PromedioTC'] : 1; // Respaldo matemático final

    $data = [];

    // 2. Multiplexor de Consultas (Estrategia por Configuración)
    if ($type === 'davi_5') {
        $sql = "
            -- PASO 1: Calcular la suma matemáticamente perfecta
            WITH TotalesAgrupados AS (
                SELECT 
                    c.IdCierre,
                    d.MerID AS Fuente,
                    SUM(d.Monto_Retencion_IVA) AS debito_5perc
                FROM Tbl_Detalle_Scotia d
                INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL
                  AND d.MerID IS NOT NULL 
                  AND d.MerID <> ''
                GROUP BY c.IdCierre, d.MerID
            )
            -- PASO 2: Pegar la referencia exacta (Solo 1 descripción) a los totales
            SELECT 
                t.IdCierre,
                t.Fuente,
                RefUnica.Referencia,
                t.debito_5perc
            FROM TotalesAgrupados t
            OUTER APPLY (
                SELECT TOP 1 p.Descripcion AS Referencia
                FROM Tbl_Pagado_Scotia p
                WHERE p.IdCierre = t.IdCierre
                  AND RTRIM(LTRIM(p.Descripcion)) LIKE '% ' + t.Fuente
            ) AS RefUnica
            ORDER BY t.IdCierre ASC, t.Fuente ASC;
        ";
        // Ejecutamos directamente, ya que este query depende del Watermark (ConsolidadoTSD IS NULL)
        $data = $pdoBancos->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        
    } else if ($type === 'bac_536') {
        $sql = "
            -- PASO 1: Calcular la suma matemáticamente perfecta de la Retención de Ventas
            WITH TotalesAgrupados AS (
                SELECT 
                    c.IdCierre,
                    d.NUMERO_AFILIADO AS Fuente,
                    SUM(d.RETENCION_VENTAS) AS Total_Retencion_Ventas
                FROM Tbl_Detalle_BAC d
                INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL
                  AND d.NUMERO_AFILIADO IS NOT NULL 
                  AND d.NUMERO_AFILIADO <> ''
                GROUP BY c.IdCierre, d.NUMERO_AFILIADO
            )
            -- PASO 2: Pegar la referencia exacta (Solo 1 descripción) desde el Pagado
            SELECT 
                t.IdCierre,
                t.Fuente,
                RefUnica.Referencia,
                t.Total_Retencion_Ventas
            FROM TotalesAgrupados t
            OUTER APPLY (
                SELECT TOP 1 p.Descripcion AS Referencia
                FROM Tbl_Pagado_BAC p
                WHERE p.IdCierre = t.IdCierre
                  AND RTRIM(LTRIM(p.Descripcion)) LIKE 'AFI' + RTRIM(LTRIM(t.Fuente)) + ' %'
            ) AS RefUnica
            ORDER BY t.IdCierre ASC, t.Fuente ASC;
        ";
        $data = $pdoBancos->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    } else if ($type === 'bac_176') {
        $sql = "
            -- PASO 1: Calcular la suma matemáticamente perfecta de la Retención de Renta
            WITH TotalesAgrupados AS (
                SELECT 
                    c.IdCierre,
                    d.NUMERO_AFILIADO AS Fuente,
                    SUM(d.RETENCION_RENTA) AS Total_Retencion_Renta
                FROM Tbl_Detalle_BAC d
                INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL
                  AND d.NUMERO_AFILIADO IS NOT NULL 
                  AND d.NUMERO_AFILIADO <> ''
                GROUP BY c.IdCierre, d.NUMERO_AFILIADO
            )
            -- PASO 2: Pegar la referencia exacta (Solo 1 descripción) desde el Pagado
            SELECT 
                t.IdCierre,
                t.Fuente,
                RefUnica.Referencia,
                t.Total_Retencion_Renta
            FROM TotalesAgrupados t
            OUTER APPLY (
                SELECT TOP 1 p.Descripcion AS Referencia
                FROM Tbl_Pagado_BAC p
                WHERE p.IdCierre = t.IdCierre
                  AND RTRIM(LTRIM(p.Descripcion)) LIKE 'AFI' + RTRIM(LTRIM(t.Fuente)) + ' %'
            ) AS RefUnica
            ORDER BY t.IdCierre ASC, t.Fuente ASC;
        ";
        $data = $pdoBancos->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    } else if ($type === 'davi_2') {
        $sql = "
            -- PASO 1: Calcular la suma matemáticamente perfecta del ISR
            WITH TotalesAgrupados AS (
                SELECT 
                    c.IdCierre,
                    d.MerID AS Fuente,
                    SUM(d.Monto_Retencion_ISR) AS Total_Retencion_ISR
                FROM Tbl_Detalle_Scotia d
                INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL
                  AND d.MerID IS NOT NULL 
                  AND d.MerID <> ''
                GROUP BY c.IdCierre, d.MerID
            )
            -- PASO 2: Pegar la referencia exacta (Solo 1 descripción) a los totales
            SELECT 
                t.IdCierre,
                t.Fuente,
                RefUnica.Referencia,
                t.Total_Retencion_ISR
            FROM TotalesAgrupados t
            OUTER APPLY (
                SELECT TOP 1 p.Descripcion AS Referencia
                FROM Tbl_Pagado_Scotia p
                WHERE p.IdCierre = t.IdCierre
                  AND RTRIM(LTRIM(p.Descripcion)) LIKE '% ' + t.Fuente
            ) AS RefUnica
            ORDER BY t.IdCierre ASC, t.Fuente ASC;
        ";
        $data = $pdoBancos->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    } else {
        throw new Exception("Tipo de cargador no soportado aún en el backend.");
    }

    echo json_encode([
        'success' => true,
        'tc_promedio' => $tcPromedio,
        'data' => $data
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>