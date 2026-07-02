<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$emailUsuario = $_SESSION['user']['email'] ?? '';
$rol = $_SESSION['user']['role'] ?? '';

// Capturar rango de fechas
$desde = $_GET['desde'] ?? date('Y-m-d', strtotime('-7 days'));
$hasta = $_GET['hasta'] ?? date('Y-m-d');

// REGLA ACTUALIZADA: Todos los roles que tienen visión global
$esGlobal = in_array($rol, ['admin', 'conciliador', 'gerente_operaciones', 'servicio_cliente']);

try {
    $pdo = Database::connect();

    // ==========================================
    // 1. KPI GLOBALES DEL RANGO DE FECHAS (TotalTx, CRC, USD)
    // ==========================================
    $whereRango = "WHERE CAST(H.FechaCierre AS DATE) BETWEEN ? AND ?";
    $paramsRango = [$desde, $hasta];

    // Si NO es global, lo limitamos estrictamente a sus sucursales asignadas
    if (!$esGlobal) {
        $whereRango .= " AND EXISTS (SELECT 1 FROM Tbl_Usuario_Sucursales_cc V WHERE V.EmailUsuario = ? AND V.Activo = 1 AND H.Sucursal LIKE '%' + V.CodigoSucursal + '%')";
        $paramsRango[] = $emailUsuario;
    }

    $baseJoinsRango = "FROM Tbl_CierreCaja_Detalle D INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre";

    $sqlKPIs = "
        SELECT 
            COUNT(D.IdDetalle) AS TotalTx,
            ISNULL(SUM(D.MontoCRC), 0) AS RangoCRC,
            ISNULL(SUM(D.MontoUSD), 0) AS RangoUSD
        $baseJoinsRango 
        $whereRango
    ";
    
    $stmtKPI = $pdo->prepare($sqlKPIs);
    $stmtKPI->execute($paramsRango);
    $kpiData = $stmtKPI->fetch(PDO::FETCH_ASSOC);

    // ==========================================
    // 2. TICKETS ACTIVOS EN TIEMPO REAL (KPI de urgencia)
    // Muestra todos los tickets en trámite sin importar si son viejos
    // ==========================================
    $whereActivos = "WHERE C.Estado NOT IN ('CERRADO', 'RESUELTO')";
    $paramsActivos = [];

    if (!$esGlobal) {
        $whereActivos .= " AND EXISTS (SELECT 1 FROM Tbl_Usuario_Sucursales_cc V WHERE V.EmailUsuario = ? AND V.Activo = 1 AND C.Sucursal_Relacionada LIKE V.CodigoSucursal + '%')";
        $paramsActivos[] = $emailUsuario;
    }

    $sqlActivos = "SELECT COUNT(C.IdCaso) AS TicketsActivos FROM Tbl_Casos_TSD C $whereActivos";
    $stmtActivos = $pdo->prepare($sqlActivos);
    $stmtActivos->execute($paramsActivos);
    $ticketsActivos = $stmtActivos->fetchColumn();

    // ==========================================
    // 3. GRÁFICO: Evolución Financiera (Por Día en el Rango)
    // ==========================================
    $sqlEvo = "
        SELECT 
            CONVERT(varchar(5), CAST(H.FechaCierre AS DATE), 103) AS Fecha, 
            ISNULL(SUM(D.MontoCRC), 0) AS CRC
        $baseJoinsRango 
        $whereRango
        GROUP BY CAST(H.FechaCierre AS DATE)
        ORDER BY CAST(H.FechaCierre AS DATE) ASC
    ";
    $stmtEvo = $pdo->prepare($sqlEvo);
    $stmtEvo->execute($paramsRango);
    $dataEvolucion = $stmtEvo->fetchAll(PDO::FETCH_ASSOC);

    // ==========================================
    // 4. GRÁFICO: Estados de los Tickets (Dentro del Rango)
    // ==========================================
    $baseJoinsCasosRango = "FROM Tbl_Casos_TSD C
                  INNER JOIN Tbl_CierreCaja_Header H ON C.IdCierreOrigen = H.IdCierre";

    $sqlEstados = "
        SELECT 
            C.Estado, 
            COUNT(DISTINCT C.IdCaso) AS Cantidad
        $baseJoinsCasosRango 
        $whereRango
        GROUP BY C.Estado
    ";
    $stmtEstados = $pdo->prepare($sqlEstados);
    $stmtEstados->execute($paramsRango);
    $dataEstados = $stmtEstados->fetchAll(PDO::FETCH_ASSOC);

    // ==========================================
    // 5. RESPUESTA AL FRONTEND
    // ==========================================
    echo json_encode([
        'success' => true,
        'kpis' => [
            'hoy_crc' => $kpiData['RangoCRC'],
            'hoy_usd' => $kpiData['RangoUSD'],
            'tickets_activos' => $ticketsActivos,
            'tx_7d' => $kpiData['TotalTx']
        ],
        'graficos' => [
            'evolucion' => $dataEvolucion,
            'estados' => $dataEstados
        ]
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>