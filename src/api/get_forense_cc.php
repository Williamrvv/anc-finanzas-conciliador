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

    // 0. Recibir el filtro de Sucursal
    $sucursalFiltro = $_GET['sucursal'] ?? 'TODAS';

    // 1. CONDICIONES BASE (WHERE)
    $whereClause = "WHERE CAST(H.FechaCierre AS DATE) BETWEEN ? AND ?";
    $params = [$desde, $hasta];

    if (!empty($buscar)) {
        $whereClause .= " AND (D.Numero_Contrato LIKE ? OR D.NombreCliente LIKE ? OR D.Numero_Autorizacion LIKE ?)";
        $term = '%' . $buscar . '%';
        array_push($params, $term, $term, $term);
    }

    if ($sucursalFiltro !== 'TODAS' && !empty($sucursalFiltro)) {
        // Soporte para selección múltiple (Ej: "SJO,ALA,LIB")
        $sucsArray = explode(',', $sucursalFiltro);
        $sucConditions = [];
        foreach ($sucsArray as $suc) {
            $sucConditions[] = "(C.Sucursal_Relacionada = ? OR (C.IdCaso IS NULL AND H.Sucursal LIKE ?))";
            $params[] = $suc;
            $params[] = '%' . $suc . '%';
        }
        $whereClause .= " AND (" . implode(" OR ", $sucConditions) . ")";
    }

    $baseJoins = "FROM Tbl_CierreCaja_Detalle D
                  INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre
                  LEFT JOIN Tbl_Usuarios U ON H.EmailUsuario = U.Email
                  LEFT JOIN Tbl_Casos_TSD C ON D.Numero_Contrato = C.NumeroContrato AND C.IdCierreOrigen = H.IdCierre
                  LEFT JOIN Tbl_Justificaciones_CC J ON C.IdJustificacion = J.IdJustificacion";

    // RBAC: Filtros de Visibilidad Universales
    $rol = $_SESSION['user']['role'] ?? '';
    $emailUsuario = $_SESSION['user']['email'] ?? '';

    if ($rol !== 'servicio_cliente') {
        $whereClause .= " AND EXISTS (SELECT 1 FROM Tbl_Usuario_Sucursales_cc V WHERE V.EmailUsuario = ? AND V.Activo = 1 AND H.Sucursal LIKE '%' + V.CodigoSucursal + '%')";
        $params[] = $emailUsuario;
    }

    // 2. CONSULTA ULTRA-RÁPIDA DE KPIs GLOBALES Y DASHBOARD
    $sqlKPI = "SELECT 
                    COUNT(D.IdDetalle) AS TotalTx,
                    ISNULL(SUM(D.MontoCRC), 0) AS TotalCRC,
                    ISNULL(SUM(D.MontoUSD), 0) AS TotalUSD,
                    SUM(CASE WHEN C.IdCaso IS NOT NULL THEN 1 ELSE 0 END) AS TotalTickets,
                    ISNULL(SUM(CASE WHEN C.IdCaso IS NOT NULL THEN D.MontoCRC ELSE 0 END), 0) AS MontoTicketsCRC
               $baseJoins 
               $whereClause";
               
    $stmtKPI = $pdo->prepare($sqlKPI);
    $stmtKPI->execute($params);
    $kpi = $stmtKPI->fetch(PDO::FETCH_ASSOC);

    // 3. CONSULTA DE DATOS PAGINADOS (Saca 50 filas)
    $sqlData = "SELECT 
                    CAST(H.IdCierre AS varchar) + '|' + ISNULL((
                        SELECT CASE 
                            WHEN CONVERT(date, MIN(Fecha_Transaccion)) = CONVERT(date, MAX(Fecha_Transaccion)) THEN CONVERT(varchar, MIN(Fecha_Transaccion), 103)
                            ELSE CONVERT(varchar, MIN(Fecha_Transaccion), 103) + ' al ' + CONVERT(varchar, MAX(Fecha_Transaccion), 103)
                        END FROM Tbl_CierreCaja_Detalle WHERE IdCierre = H.IdCierre
                    ), '') AS FolioData,
                    D.Numero_Contrato, D.NombreCliente, D.Tipo_Tarjeta, D.Numero_Autorizacion,
                    D.MontoUSD, D.MontoCRC, 
                    CONVERT(varchar(5), H.FechaCierre, 108) AS HoraCierre,
                    ISNULL(C.Sucursal_Relacionada, H.Sucursal) AS SucursalReal,
                    ISNULL(RTRIM(U.Nombre + ' ' + ISNULL(U.Apellidos, '')), H.EmailUsuario) AS Agente,
                    H.Comentario AS ComentarioCierre,
                    C.IdCaso, C.Estado AS EstadoTicket,
                    CASE 
                        WHEN C.IdCaso IS NULL THEN 'LIMPIO|' + ISNULL(H.Comentario, '')
                        ELSE 'TICKET|' + ISNULL(J.TextoVisor, '') + '|' + ISNULL(C.MotivoAgente, '')
                    END AS MotivoTramiteSQL
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

    // Extraer lista de sucursales disponibles para este usuario (Para llenar el combobox)
    $listaSucs = [];
    if ($rol === 'servicio_cliente') {
        $stmtAllSucs = $pdo->query("SELECT CodigoSucursal AS ID, NombreSucursal AS NAME FROM Tbl_Usuario_Sucursales_cc GROUP BY CodigoSucursal, NombreSucursal");
        $listaSucs = $stmtAllSucs->fetchAll(PDO::FETCH_ASSOC);
    } else {
        $stmtMySucs = $pdo->prepare("SELECT CodigoSucursal AS ID, NombreSucursal AS NAME FROM Tbl_Usuario_Sucursales_cc WHERE EmailUsuario = ? AND Activo = 1 GROUP BY CodigoSucursal, NombreSucursal");
        $stmtMySucs->execute([$emailUsuario]);
        $listaSucs = $stmtMySucs->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode([
        'success' => true,
        'mis_sucursales' => $listaSucs,
        'kpis' => [
            'total_tx' => $totalFilas,
            'total_crc' => (float)$kpi['TotalCRC'],
            'total_usd' => (float)$kpi['TotalUSD'],
            'total_tickets' => (int)$kpi['TotalTickets'],
            'monto_tickets_crc' => (float)$kpi['MontoTicketsCRC']
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