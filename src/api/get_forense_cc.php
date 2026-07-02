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
        // Soporte para búsqueda directa por Folio (Ej: f:25 o F:25)
        if (preg_match('/^f:(\d+)$/i', $buscar, $matches)) {
            $whereClause .= " AND H.IdCierre = ?";
            $params[] = $matches[1];
        } else {
            $whereClause .= " AND (D.Numero_Contrato LIKE ? OR D.NombreCliente LIKE ? OR D.Numero_Autorizacion LIKE ?)";
            $term = '%' . $buscar . '%';
            array_push($params, $term, $term, $term);
        }
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

    // Filtro de Estado del Ticket (multi-select, viene de BD; vacío/TODOS = no filtra)
    $estadoFiltro = $_GET['estado'] ?? 'TODOS';
    if ($estadoFiltro !== 'TODOS' && !empty($estadoFiltro)) {
        $estadosArray = array_filter(array_map('trim', explode(',', $estadoFiltro)));
        if (!empty($estadosArray)) {
            $inEstados = str_repeat('?,', count($estadosArray) - 1) . '?';
            $whereClause .= " AND C.Estado IN ($inEstados)";
            foreach ($estadosArray as $est) { $params[] = $est; }
        }
    }

    $baseJoins = "FROM Tbl_CierreCaja_Detalle D
                  INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre
                  LEFT JOIN Tbl_Usuarios U ON H.EmailUsuario = U.Email
                  LEFT JOIN (
                      SELECT IdCierreOrigen, NumeroContrato, MAX(IdCaso) AS IdCaso
                      FROM Tbl_Casos_TSD
                      GROUP BY IdCierreOrigen, NumeroContrato
                  ) C_Unico ON D.Numero_Contrato = C_Unico.NumeroContrato AND C_Unico.IdCierreOrigen = H.IdCierre
                  LEFT JOIN Tbl_Casos_TSD C ON C.IdCaso = C_Unico.IdCaso
                  LEFT JOIN Tbl_Justificaciones_CC J ON C.IdJustificacion = J.IdJustificacion";

    // RBAC: Filtros de Visibilidad Universales
    $rol = $_SESSION['user']['role'] ?? '';
    $emailUsuario = $_SESSION['user']['email'] ?? '';
    $globalSucsRaw = $_GET['global_sucs'] ?? '';
    $esGlobal = in_array($rol, ['admin', 'conciliador', 'gerente_operaciones']);

    if ($esGlobal && !empty($globalSucsRaw)) {
        $sucsArray = array_filter(array_map('trim', explode(',', $globalSucsRaw)));
        if (!empty($sucsArray)) {
            $sucConditions = [];
            foreach ($sucsArray as $suc) {
                $sucConditions[] = "(H.Sucursal LIKE ?)";
                $params[] = '%' . $suc . '%';
            }
            $whereClause .= " AND (" . implode(" OR ", $sucConditions) . ")";
        }
    } else if (!in_array($rol, ['servicio_cliente', 'admin'])) {
        $whereClause .= " AND EXISTS (SELECT 1 FROM Tbl_Usuario_Sucursales_cc V WHERE V.EmailUsuario = ? AND V.Activo = 1 AND H.Sucursal LIKE '%' + V.CodigoSucursal + '%')";
        $params[] = $emailUsuario;
    }

    // 2. CONSULTA ULTRA-RÁPIDA DE KPIs GLOBALES Y DASHBOARD
    $sqlKPI = "SELECT 
                    COUNT(D.IdDetalle) AS TotalTx,
                    ISNULL(SUM(D.MontoCRC), 0) AS TotalCRC,
                    ISNULL(SUM(D.MontoUSD), 0) AS TotalUSD,
                    SUM(CASE WHEN D.MatchExitoso = 1 THEN 1 ELSE 0 END) AS TxLimpias,
                    SUM(CASE WHEN D.MatchExitoso = 0 THEN 1 ELSE 0 END) AS TxError,
                    SUM(CASE WHEN D.MatchExitoso = 0 THEN 1 ELSE 0 END) AS TotalTickets,
                    ISNULL(SUM(CASE WHEN D.MatchExitoso = 0 THEN D.MontoCRC ELSE 0 END), 0) AS MontoTicketsCRC
               $baseJoins 
               $whereClause";
               
    $stmtKPI = $pdo->prepare($sqlKPI);
    $stmtKPI->execute($params);
    $kpi = $stmtKPI->fetch(PDO::FETCH_ASSOC);

    // 2.5 SUB-CONSULTA DE ESTADOS DE TICKETS (Para el Mini-Gráfico)
    $sqlEstados = "SELECT 
                       C.Estado, 
                       COUNT(DISTINCT C.IdCaso) AS Cantidad 
                   $baseJoins 
                   $whereClause AND C.IdCaso IS NOT NULL 
                   GROUP BY C.Estado";
    $stmtEst = $pdo->prepare($sqlEstados);
    $stmtEst->execute($params);
    $kpiEstados = $stmtEst->fetchAll(PDO::FETCH_ASSOC);

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
                    -- El estado limpio/ticket es POR LÍNEA (D.MatchExitoso), no por contrato.
                    -- En líneas limpias anulamos los datos del caso hermano para no contaminar el grid.
                    CASE WHEN D.MatchExitoso = 1 THEN NULL ELSE C.IdCaso END AS IdCaso,
                    CASE WHEN D.MatchExitoso = 1 THEN NULL ELSE C.Estado END AS EstadoTicket,
                    CASE 
                        WHEN D.MatchExitoso = 1 THEN 'LIMPIO|' + ISNULL(H.Comentario, '')
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
    if ($esGlobal) {
        if (!empty($globalSucsRaw)) {
            $sucsArrLocal = array_filter(array_map('trim', explode(',', $globalSucsRaw)));
            if (!empty($sucsArrLocal)) {
                require_once 'tsd_db.php';
                $pdoTsd = TSDDatabase::connect();
                $inClause = str_repeat('?,', count($sucsArrLocal) - 1) . '?';
                $stmtAllSucs = $pdoTsd->prepare("SELECT Location AS ID, Name AS NAME FROM dbo.Setup WHERE Location IN ($inClause)");
                $stmtAllSucs->execute(array_values($sucsArrLocal));
                $listaSucs = $stmtAllSucs->fetchAll(PDO::FETCH_ASSOC);
            }
        }
    } else {
        $stmtMySucs = $pdo->prepare("SELECT CodigoSucursal AS ID, NombreSucursal AS NAME FROM Tbl_Usuario_Sucursales_cc WHERE EmailUsuario = ? AND Activo = 1 GROUP BY CodigoSucursal, NombreSucursal");
        $stmtMySucs->execute([$emailUsuario]);
        $listaSucs = $stmtMySucs->fetchAll(PDO::FETCH_ASSOC);
    }

    // Estados disponibles directo de BD (nada quemado). CI collation colapsa duplicados de casing.
    $stmtEstados = $pdo->query("SELECT DISTINCT Estado FROM Tbl_Casos_TSD WHERE Estado IS NOT NULL AND LTRIM(RTRIM(Estado)) <> '' ORDER BY Estado");
    $listaEstados = $stmtEstados->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'success' => true,
        'mis_sucursales' => $listaSucs,
        'estados_disponibles' => $listaEstados,
        'kpis' => [
            'total_tx' => $totalFilas,
            'tx_limpias' => (int)$kpi['TxLimpias'],
            'tx_error' => (int)$kpi['TxError'],
            'total_crc' => (float)$kpi['TotalCRC'],
            'total_usd' => (float)$kpi['TotalUSD'],
            'total_tickets' => (int)$kpi['TotalTickets'],
            'monto_tickets_crc' => (float)$kpi['MontoTicketsCRC'],
            'estados_tickets' => $kpiEstados
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