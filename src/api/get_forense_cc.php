<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$desde = $_GET['desde'] ?? '';
$hasta = $_GET['hasta'] ?? '';
$buscar = trim($_GET['search'] ?? '');

// Paginación Remota
$pagina = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$limite = 50; // Extraer solo 50 registros por página para proteger RAM
$offset = ($pagina - 1) * $limite;

if (empty($desde) || empty($hasta)) {
    echo json_encode(['success' => false, 'error' => 'Rango de fechas requerido.']);
    exit;
}

try {
    $pdo = Database::connect();

    // 1. CONDICIONES BASE (WHERE)
    $whereClause = "WHERE CAST(H.FechaCierre AS DATE) BETWEEN ? AND ?";
    $params = [$desde, $hasta];

    if (!empty($buscar)) {
        $whereClause .= " AND (D.Numero_Contrato LIKE ? OR D.NombreCliente LIKE ? OR D.Numero_Autorizacion LIKE ?)";
        $term = '%' . $buscar . '%';
        array_push($params, $term, $term, $term);
    }

    $baseJoins = "FROM Tbl_CierreCaja_Detalle D
                  INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre
                  LEFT JOIN Tbl_Usuarios U ON H.EmailUsuario = U.Email
                  LEFT JOIN Tbl_Casos_TSD C ON D.Numero_Contrato = C.NumeroContrato AND C.IdCierreOrigen = H.IdCierre";

    // RBAC: Filtros de Visibilidad Universales
    $rol = $_SESSION['user']['role'] ?? '';
    $emailUsuario = $_SESSION['user']['email'] ?? '';

    if ($rol !== 'servicio_cliente') {
        $tablaVinculo = ($rol === 'agente') ? 'Tbl_Agentes_Estacion' : 'Tbl_Jefes_Estacion';
        $columnaEmail = ($rol === 'agente') ? 'EmailAgente' : 'EmailJefe';
        
        $whereClause .= " AND EXISTS (SELECT 1 FROM $tablaVinculo V WHERE V.$columnaEmail = ? AND V.Activo = 1 AND H.Sucursal LIKE '%' + V.CodigoSucursal + '%')";
        $params[] = $emailUsuario;
    }

    // 2. CONSULTA ULTRA-RÁPIDA DE KPIs GLOBALES (Total de ese año/mes)
    $sqlKPI = "SELECT 
                    COUNT(D.IdDetalle) AS TotalTx,
                    SUM(D.MontoCRC) AS TotalCRC,
                    SUM(D.MontoUSD) AS TotalUSD,
                    SUM(CASE WHEN C.IdCaso IS NOT NULL THEN 1 ELSE 0 END) AS TotalTickets
               $baseJoins 
               $whereClause";
               
    $stmtKPI = $pdo->prepare($sqlKPI);
    $stmtKPI->execute($params);
    $kpi = $stmtKPI->fetch(PDO::FETCH_ASSOC);

    // 3. CONSULTA DE DATOS PAGINADOS (Solo saca 50 filas)
    $sqlData = "SELECT 
                    D.Numero_Contrato, D.NombreCliente, D.Tipo_Tarjeta, D.Numero_Autorizacion, 
                    D.MontoUSD, D.MontoCRC, 
                    CONVERT(varchar, H.FechaCierre, 103) + ' ' + CONVERT(varchar, H.FechaCierre, 108) AS FechaCierre,
                    H.Sucursal, 
                    ISNULL(U.Nombre, H.EmailUsuario) AS Cajero,
                    C.IdCaso, C.Estado AS EstadoTicket
                $baseJoins 
                $whereClause
                ORDER BY H.FechaCierre DESC, D.IdDetalle DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";

    $stmtData = $pdo->prepare($sqlData);
    
    // Bind dinámico para soportar OFFSET en PDO SQL Server
    $idx = 1;
    foreach ($params as $p) {
        $stmtData->bindValue($idx++, $p);
    }
    $stmtData->bindValue($idx++, $offset, PDO::PARAM_INT);
    $stmtData->bindValue($idx, $limite, PDO::PARAM_INT);
    
    $stmtData->execute();
    $transacciones = $stmtData->fetchAll(PDO::FETCH_ASSOC);

    // 4. RESPUESTA FINAL
    $totalFilas = (int)$kpi['TotalTx'];
    $totalPaginas = ceil($totalFilas / $limite);

    echo json_encode([
        'success' => true,
        'kpis' => [
            'total_tx' => $totalFilas,
            'total_crc' => (float)$kpi['TotalCRC'],
            'total_usd' => (float)$kpi['TotalUSD'],
            'total_tickets' => (int)$kpi['TotalTickets']
        ],
        'paginacion' => [
            'pagina_actual' => $pagina,
            'total_paginas' => max(1, $totalPaginas),
            'total_registros' => $totalFilas
        ],
        'transacciones' => $transacciones
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
}
?>