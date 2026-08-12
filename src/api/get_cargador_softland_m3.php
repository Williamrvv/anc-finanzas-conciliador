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

    // =======================================================================
    // 1. CÁLCULO DE TIPO DE CAMBIO PROMEDIO PONDERADO 
    // (Aplica para todo, tomamos la tabla BAC como muestra de volumen)
    // =======================================================================
    $sqlFechas = "
        SELECT 
            COALESCE(TRY_CONVERT(DATE, d.FECHA_PAGO, 103), TRY_CONVERT(DATE, d.FECHA_PAGO, 120)) AS FechaTransaccion, 
            COUNT(d.IdTransaccion) AS Cantidad
        FROM Tbl_Detalle_BAC d
        INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
        WHERE c.ConsolidadoTSD IS NULL
          AND COALESCE(TRY_CONVERT(DATE, d.FECHA_PAGO, 103), TRY_CONVERT(DATE, d.FECHA_PAGO, 120)) IS NOT NULL
        GROUP BY COALESCE(TRY_CONVERT(DATE, d.FECHA_PAGO, 103), TRY_CONVERT(DATE, d.FECHA_PAGO, 120))
    ";
    $fechasBancos = $pdoBancos->query($sqlFechas)->fetchAll(PDO::FETCH_ASSOC);

    $sumProduct = 0; $totalTransacciones = 0; $tcPromedio = 1;

    $stmtTC = $pdoTSD->prepare("
        SELECT TOP (1) Ex.Sell FROM dbo.Exchange AS Ex
        WHERE Ex.CurrencyCode = 'CRC' AND CAST(Ex.AsOf AS DATE) <= :fecha AND Ex.Sell > 300
        ORDER BY Ex.AsOf DESC
    ");

    if (count($fechasBancos) > 0) {
        foreach ($fechasBancos as $fb) {
            $stmtTC->execute([':fecha' => $fb['FechaTransaccion']]);
            $tcRow = $stmtTC->fetch();
            $tcDia = $tcRow ? (float)$tcRow['Sell'] : 1;
            $sumProduct += ($tcDia * (int)$fb['Cantidad']);
            $totalTransacciones += (int)$fb['Cantidad'];
        }
        if ($totalTransacciones > 0) $tcPromedio = round($sumProduct / $totalTransacciones, 2);
    } else {
        $stmtTC->execute([':fecha' => $end]);
        $tcRow = $stmtTC->fetch();
        $tcPromedio = $tcRow ? round((float)$tcRow['Sell'], 2) : 1;
    }

    // El tipo de cambio se fija a DOS decimales en el origen. Antes el promedio
    // ponderado arrastraba muchos decimales y los dólares no cuadraban contra el
    // TC que se muestra en el Excel.
    $tcCrudoServidor = $tcPromedio;
    $tcPromedio = round($tcPromedio, 2);
    if ($tcPromedio <= 0) $tcPromedio = 1;   // nunca dividir entre cero

    // Traza para auditar de dónde sale el promedio ponderado
    $diagTC = [
        'tc_crudo'            => $tcCrudoServidor,
        'tc_aplicado'         => $tcPromedio,
        'total_transacciones' => $totalTransacciones,
        'suma_producto'       => $sumProduct,
        'fechas'              => array_map(function ($f) {
            return ['fecha' => $f['FechaTransaccion'], 'cantidad' => (int)$f['Cantidad']];
        }, $fechasBancos)
    ];

    $data = [];

    // =======================================================================
    // 2. MULTIPLEXOR DE CONSULTAS (Patrón Estrategia SQL)
    // =======================================================================

    // A) CARGADOR MAESTRO DE TARJETAS (NUEVO)
    if ($type === 'tarjetas') {
        
        // Ejecutamos múltiples consultas para armar la bolsa de datos
        // 1. Totales BAC
        $bacTot = $pdoBancos->query("
            SELECT SUM(MONTONETO - AJUSTE_COMISION_INTERNACIONAL) AS NetoAci, SUM(RETENCION_VENTAS) AS RetVentas, SUM(RETENCION_RENTA) AS RetRenta 
            FROM Tbl_Detalle_BAC d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL
        ")->fetch(PDO::FETCH_ASSOC);
        
        // 2. Totales Davibank
        $daviTot = $pdoBancos->query("
            SELECT SUM(Monto_Neto) AS Neto, SUM(Monto_Retencion_IVA) AS RetIva, SUM(Monto_Retencion_ISR) AS RetIsr
            FROM Tbl_Detalle_Scotia d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL
        ")->fetch(PDO::FETCH_ASSOC);

        // 3. Totales TSD (Cruces Exitosos de hoy)
        $tsdTot = $pdoBancos->query("
            SELECT SUM(t.MontoCRC) AS TotalTSD
            FROM Tbl_Detalle_TSD t INNER JOIN Tbl_Conciliacion_Cierres c ON t.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL
        ")->fetchColumn();

        // 4. Agrupación Dinámica de Comisiones por Centro de Costo
        $comisionesCC = $pdoBancos->query("
            SELECT CentroCosto, SUM(ComisionTotal) AS ComisionAcumulada
            FROM (
                SELECT CentroCosto, SUM(COMISION) AS ComisionTotal FROM Tbl_Detalle_BAC d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL GROUP BY CentroCosto
                UNION ALL
                SELECT CentroCosto, SUM(Monto_Comision_Total) AS ComisionTotal FROM Tbl_Detalle_Scotia d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL GROUP BY CentroCosto
            ) AS ComisionesGlobales
            WHERE CentroCosto IS NOT NULL AND CentroCosto <> ''
            GROUP BY CentroCosto
        ")->fetchAll(PDO::FETCH_ASSOC);

        // 5. Detalles Puros (Ventas Bancos) para líneas inferiores
        $detallesBancos = $pdoBancos->query("
            SELECT 'BAC' AS Banco, NUMERO_AFILIADO AS Afiliado, NOMBRECOMERCIO AS Comercio, AUTORIZACION AS Auth, RIGHT(RTRIM(LTRIM(NUMERO_DE_TARJETA)), 4) AS Tarjeta, MONTO_VENTA AS MontoBruto, CentroCosto
            FROM Tbl_Detalle_BAC d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL
            UNION ALL
            SELECT 'Davibank' AS Banco, MerID AS Afiliado, Nombre AS Comercio, Numero_Autorizacion AS Auth, RIGHT(RTRIM(LTRIM(Numero_Tarjeta)), 4) AS Tarjeta, Monto_Orig AS MontoBruto, CentroCosto
            FROM Tbl_Detalle_Scotia d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL
        ")->fetchAll(PDO::FETCH_ASSOC);

        // 6. Detalles Puros (TSD) para líneas inferiores
        $detallesTSD = $pdoBancos->query("
            SELECT Contrato, SucursalCod, SucursalNombre, Autorizacion, Tarjeta_Ultimos4, MontoCRC, CentroCosto
            FROM Tbl_Detalle_TSD t INNER JOIN Tbl_Conciliacion_Cierres c ON t.IdCierre = c.IdCierre WHERE c.ConsolidadoTSD IS NULL
        ")->fetchAll(PDO::FETCH_ASSOC);

        // Devolvemos el "Toolkit" completo a JS
        echo json_encode([
            'success' => true,
            'tc_promedio' => $tcPromedio,
            'diag_tc' => $diagTC,
            'maestro' => [
                'bac_neto_aci' => (float)($bacTot['NetoAci'] ?? 0),
                'davi_neto' => (float)($daviTot['Neto'] ?? 0),
                'ret_renta_176' => (float)($bacTot['RetRenta'] ?? 0) + (float)($daviTot['RetIsr'] ?? 0),
                'ret_ventas_531' => (float)($bacTot['RetVentas'] ?? 0) + (float)($daviTot['RetIva'] ?? 0),
                'tsd_total' => (float)$tsdTot,
                'comisiones_cc' => $comisionesCC,
                'bancos_det' => $detallesBancos,
                'tsd_det' => $detallesTSD
            ]
        ]);
        exit;
    }

    // =======================================================================
    // B) CARGADORES SIMPLES ORIGINALES
    // =======================================================================
    else if ($type === 'davi_5') {
        $sql = "
            WITH TotalesAgrupados AS (
                SELECT c.IdCierre, d.MerID AS Fuente, SUM(d.Monto_Retencion_IVA) AS debito_5perc
                FROM Tbl_Detalle_Scotia d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL AND d.MerID IS NOT NULL AND d.MerID <> '' GROUP BY c.IdCierre, d.MerID
            )
            SELECT t.IdCierre, t.Fuente, RefUnica.Referencia, t.debito_5perc
            FROM TotalesAgrupados t
            OUTER APPLY ( SELECT TOP 1 p.Descripcion AS Referencia FROM Tbl_Pagado_Scotia p WHERE p.IdCierre = t.IdCierre AND RTRIM(LTRIM(p.Descripcion)) LIKE '% ' + t.Fuente ) AS RefUnica
            ORDER BY t.IdCierre ASC, t.Fuente ASC;
        ";
        $data = $pdoBancos->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        
    } else if ($type === 'bac_536') {
        $sql = "
            WITH TotalesAgrupados AS (
                SELECT c.IdCierre, d.NUMERO_AFILIADO AS Fuente, SUM(d.RETENCION_VENTAS) AS Total_Retencion_Ventas
                FROM Tbl_Detalle_BAC d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL AND d.NUMERO_AFILIADO IS NOT NULL AND d.NUMERO_AFILIADO <> '' GROUP BY c.IdCierre, d.NUMERO_AFILIADO
            )
            SELECT t.IdCierre, t.Fuente, RefUnica.Referencia, t.Total_Retencion_Ventas
            FROM TotalesAgrupados t
            OUTER APPLY ( SELECT TOP 1 p.Descripcion AS Referencia FROM Tbl_Pagado_BAC p WHERE p.IdCierre = t.IdCierre AND RTRIM(LTRIM(p.Descripcion)) LIKE 'AFI' + RTRIM(LTRIM(t.Fuente)) + ' %' ) AS RefUnica
            ORDER BY t.IdCierre ASC, t.Fuente ASC;
        ";
        $data = $pdoBancos->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    } else if ($type === 'bac_176') {
        $sql = "
            WITH TotalesAgrupados AS (
                SELECT c.IdCierre, d.NUMERO_AFILIADO AS Fuente, SUM(d.RETENCION_RENTA) AS Total_Retencion_Renta
                FROM Tbl_Detalle_BAC d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL AND d.NUMERO_AFILIADO IS NOT NULL AND d.NUMERO_AFILIADO <> '' GROUP BY c.IdCierre, d.NUMERO_AFILIADO
            )
            SELECT t.IdCierre, t.Fuente, RefUnica.Referencia, t.Total_Retencion_Renta
            FROM TotalesAgrupados t
            OUTER APPLY ( SELECT TOP 1 p.Descripcion AS Referencia FROM Tbl_Pagado_BAC p WHERE p.IdCierre = t.IdCierre AND RTRIM(LTRIM(p.Descripcion)) LIKE 'AFI' + RTRIM(LTRIM(t.Fuente)) + ' %' ) AS RefUnica
            ORDER BY t.IdCierre ASC, t.Fuente ASC;
        ";
        $data = $pdoBancos->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    } else if ($type === 'davi_2') {
        $sql = "
            WITH TotalesAgrupados AS (
                SELECT c.IdCierre, d.MerID AS Fuente, SUM(d.Monto_Retencion_ISR) AS Total_Retencion_ISR
                FROM Tbl_Detalle_Scotia d INNER JOIN Tbl_Conciliacion_Cierres c ON d.IdCierre = c.IdCierre
                WHERE c.ConsolidadoTSD IS NULL AND d.MerID IS NOT NULL AND d.MerID <> '' GROUP BY c.IdCierre, d.MerID
            )
            SELECT t.IdCierre, t.Fuente, RefUnica.Referencia, t.Total_Retencion_ISR
            FROM TotalesAgrupados t
            OUTER APPLY ( SELECT TOP 1 p.Descripcion AS Referencia FROM Tbl_Pagado_Scotia p WHERE p.IdCierre = t.IdCierre AND RTRIM(LTRIM(p.Descripcion)) LIKE '% ' + t.Fuente ) AS RefUnica
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