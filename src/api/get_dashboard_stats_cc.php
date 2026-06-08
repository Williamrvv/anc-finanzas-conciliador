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

// Capturar rango de fechas (Por defecto últimos 7 días)
$desde = $_GET['desde'] ?? date('Y-m-d', strtotime('-7 days'));
$hasta = $_GET['hasta'] ?? date('Y-m-d');

try {
    $pdo = Database::connect();

    // 1. CONSTRUCCIÓN DE LA CONSULTA MAESTRA (Idéntica al Forense para cuadre perfecto)
    $whereClause = "WHERE CAST(H.FechaCierre AS DATE) BETWEEN ? AND ?";
    $params = [$desde, $hasta];

    // Filtro RBAC: Sucursales cruzadas mediante la Matriz Unificada
    if (!in_array($rol, ['servicio_cliente', 'admin'])) {
        $whereClause .= " AND EXISTS (SELECT 1 FROM Tbl_Usuario_Sucursales_cc V WHERE V.EmailUsuario = ? AND V.Activo = 1 AND H.Sucursal LIKE '%' + V.CodigoSucursal + '%')";
        $params[] = $emailUsuario;
    }

    $baseJoins = "FROM Tbl_CierreCaja_Detalle D
                  INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre
                  LEFT JOIN Tbl_Casos_TSD C ON D.Numero_Contrato = C.NumeroContrato AND C.IdCierreOrigen = H.IdCierre";

    // 2. KPIs GLOBALES (Cantidades exactas)
    $sqlKPIs = "
        SELECT 
            COUNT(D.IdDetalle) AS TotalTx,
            ISNULL(SUM(D.MontoCRC), 0) AS RangoCRC,
            ISNULL(SUM(D.MontoUSD), 0) AS RangoUSD,
            SUM(CASE WHEN C.IdCaso IS NOT NULL AND C.Estado NOT IN ('CERRADO', 'RESUELTO') THEN 1 ELSE 0 END) AS TicketsActivos
        $baseJoins 
        $whereClause
    ";
    
    $stmtKPI = $pdo->prepare($sqlKPIs);
    $stmtKPI->execute($params);
    $kpiData = $stmtKPI->fetch(PDO::FETCH_ASSOC);

    // 3. GRÁFICO: Evolución Financiera (Por Día)
    $sqlEvo = "
        SELECT 
            CONVERT(varchar(5), CAST(H.FechaCierre AS DATE), 103) AS Fecha, 
            ISNULL(SUM(D.MontoCRC), 0) AS CRC
        $baseJoins 
        $whereClause
        GROUP BY CAST(H.FechaCierre AS DATE)
        ORDER BY CAST(H.FechaCierre AS DATE) ASC
    ";
    $stmtEvo = $pdo->prepare($sqlEvo);
    $stmtEvo->execute($params);
    $dataEvolucion = $stmtEvo->fetchAll(PDO::FETCH_ASSOC);

    // 4. GRÁFICO: Estados de los Tickets (Dona)
    $sqlEstados = "
        SELECT 
            C.Estado, 
            COUNT(C.IdCaso) AS Cantidad
        $baseJoins 
        $whereClause AND C.IdCaso IS NOT NULL
        GROUP BY C.Estado
    ";
    $stmtEstados = $pdo->prepare($sqlEstados);
    $stmtEstados->execute($params);
    $dataEstados = $stmtEstados->fetchAll(PDO::FETCH_ASSOC);

    // 5. RESPUESTA CONSOLIDADA
    echo json_encode([
        'success' => true,
        'kpis' => [
            'hoy_crc' => $kpiData['RangoCRC'],
            'hoy_usd' => $kpiData['RangoUSD'],
            'tickets_activos' => $kpiData['TicketsActivos'],
            'tx_7d' => $kpiData['TotalTx'] // Ahora refleja exactamente el Volumen Transaccional de Forense
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