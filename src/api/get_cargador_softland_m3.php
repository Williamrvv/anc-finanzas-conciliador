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

    // 1. CÁLCULO DE TIPO DE CAMBIO PROMEDIO PONDERADO (Matemática Exacta por Volumen)
    
    // A. Identificar a qué banco le estamos sacando el cargador
    $isBac = (strpos($type, 'bac_') === 0);
    $table = $isBac ? 'Tbl_Detalle_BAC' : 'Tbl_Detalle_Scotia';
    $dateCol = $isBac ? 'FECHA_PAGO' : 'Fecha_Pago';

    // B. Obtener cantidad de transacciones agrupadas por fecha (Solo las pendientes de cruzar)
    $sqlFechas = "
        SELECT 
            -- Convertimos a DATE para asegurar compatibilidad con TSD (formatos 103 o 120)
            COALESCE(TRY_CONVERT(DATE, d.{$dateCol}, 103), TRY_CONVERT(DATE, d.{$dateCol}, 120)) AS FechaTransaccion, 
            COUNT(d.IdTransaccion) AS Cantidad
        FROM {$table} d
        INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
        WHERE c.ConsolidadoTSD IS NULL
          AND COALESCE(TRY_CONVERT(DATE, d.{$dateCol}, 103), TRY_CONVERT(DATE, d.{$dateCol}, 120)) IS NOT NULL
        GROUP BY COALESCE(TRY_CONVERT(DATE, d.{$dateCol}, 103), TRY_CONVERT(DATE, d.{$dateCol}, 120))
    ";
    $fechasBancos = $pdoBancos->query($sqlFechas)->fetchAll(PDO::FETCH_ASSOC);

    $sumProduct = 0;
    $totalTransacciones = 0;
    $tcPromedio = 1; // Respaldo de seguridad

    // C. Preparar consulta rápida a TSD para buscar el TC igual o anterior más cercano
    $stmtTC = $pdoTSD->prepare("
        SELECT TOP (1) Ex.Sell
        FROM dbo.Exchange AS Ex
        WHERE Ex.CurrencyCode = 'CRC'
          AND CAST(Ex.AsOf AS DATE) <= :fecha
          AND Ex.Sell > 300 -- Seguro contra días con TC en 0 o errores de captura
        ORDER BY Ex.AsOf DESC
    ");

    if (count($fechasBancos) > 0) {
        // D. Iterar fechas, multiplicar (TC * Volumen) e ir sumando al gran total
        foreach ($fechasBancos as $fb) {
            $fecha = $fb['FechaTransaccion'];
            $cantidad = (int)$fb['Cantidad'];

            $stmtTC->execute([':fecha' => $fecha]);
            $tcRow = $stmtTC->fetch();
            $tcDia = $tcRow ? (float)$tcRow['Sell'] : 1;

            $sumProduct += ($tcDia * $cantidad);
            $totalTransacciones += $cantidad;
        }
        
        // E. Ecuación Final del Promedio Ponderado
        if ($totalTransacciones > 0) {
            $tcPromedio = $sumProduct / $totalTransacciones;
        }
    } else {
        // Fallback: Si no hay datos pendientes (tabla vacía), devolvemos el TC del final del rango
        $stmtTC->execute([':fecha' => $end]);
        $tcRow = $stmtTC->fetch();
        $tcPromedio = $tcRow ? (float)$tcRow['Sell'] : 1;
    }

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