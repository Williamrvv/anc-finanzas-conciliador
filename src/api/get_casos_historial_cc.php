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

// Parámetros de Paginación Server-Side (Solo aplican para RESUELTOS)
$pagina = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
$limite = isset($_GET['limit']) ? max(1, intval($_GET['limit'])) : 12;
$buscar = isset($_GET['search']) ? trim($_GET['search']) : '';
$offset = ($pagina - 1) * $limite;

try {
    $pdo = Database::connect();

    // =========================================================
    // 1. CARGAR TODOS LOS CASOS ACTIVOS (Urgentes)
    // Estos no se paginan porque el usuario debe ver todo lo que debe hacer hoy.
    // =========================================================
    $sqlActivos = "SELECT C.IdCaso, C.Estado, C.NumeroContrato, C.NombreCliente, C.Sucursal_Relacionada, 
                          C.MontoCRC, C.DiasAtraso, C.ICD_Relacionado,
                          CONVERT(varchar, C.FechaCreacion, 103) AS FechaCreacion,
                          ISNULL(U.Nombre, C.EmailCreador) AS CreadoPor
                   FROM Tbl_Casos_TSD C
                   LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email
                   WHERE C.Estado NOT IN ('RESUELTO', 'CERRADO')";
    
    $paramsActivos = [];

    // RBAC: Filtros de Visibilidad Universales
    // Si no es servicio_cliente, DEBE tener sucursales asignadas
    if ($rol !== 'servicio_cliente') {
        $tablaVinculo = ($rol === 'agente') ? 'Tbl_Agentes_Estacion' : 'Tbl_Jefes_Estacion';
        $columnaEmail = ($rol === 'agente') ? 'EmailAgente' : 'EmailJefe';
        
        $sqlActivos .= " AND EXISTS (SELECT 1 FROM $tablaVinculo V WHERE V.$columnaEmail = ? AND V.Activo = 1 AND C.Sucursal_Relacionada LIKE V.CodigoSucursal + '%')";
        $paramsActivos[] = $emailUsuario;
    }

    $sqlActivos .= " ORDER BY C.IdCaso DESC";

    $stmtActivos = $pdo->prepare($sqlActivos);
    $stmtActivos->execute($paramsActivos);
    $casosActivos = $stmtActivos->fetchAll(PDO::FETCH_ASSOC);


    // =========================================================
    // 2. CARGAR HISTORIAL RESUELTO O CERRADO (Paginado y Buscado en BD)
    // =========================================================
    $sqlBaseResueltos = "FROM Tbl_Casos_TSD C
                         LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email
                         WHERE C.Estado IN ('RESUELTO', 'CERRADO')";
    $paramsResueltos = [];

    // RBAC
    if ($rol !== 'servicio_cliente') {
        $tablaVinculo = ($rol === 'agente') ? 'Tbl_Agentes_Estacion' : 'Tbl_Jefes_Estacion';
        $columnaEmail = ($rol === 'agente') ? 'EmailAgente' : 'EmailJefe';
        
        $sqlBaseResueltos .= " AND EXISTS (SELECT 1 FROM $tablaVinculo V WHERE V.$columnaEmail = ? AND V.Activo = 1 AND C.Sucursal_Relacionada LIKE V.CodigoSucursal + '%')";
        $paramsResueltos[] = $emailUsuario;
    }

    // Filtro de Búsqueda SQL Server Nativo (Contrato, Cliente o Sucursal)
    if (!empty($buscar)) {
        $sqlBaseResueltos .= " AND (C.NumeroContrato LIKE ? OR C.NombreCliente LIKE ? OR C.Sucursal_Relacionada LIKE ?)";
        $terminoLIKE = '%' . $buscar . '%';
        $paramsResueltos[] = $terminoLIKE;
        $paramsResueltos[] = $terminoLIKE;
        $paramsResueltos[] = $terminoLIKE;
    }

    // A) Contar el Total Real para la UI de páginas
    $stmtTotal = $pdo->prepare("SELECT COUNT(C.IdCaso) $sqlBaseResueltos");
    $stmtTotal->execute($paramsResueltos);
    $totalResueltos = $stmtTotal->fetchColumn();

    // B) Extraer solo los 12 de esta página (ODBC 18 T-SQL Pagination)
    $sqlDataResueltos = "SELECT C.IdCaso, C.Estado, C.NumeroContrato, C.NombreCliente, C.Sucursal_Relacionada, 
                                C.MontoCRC, C.DiasAtraso, 
                                CONVERT(varchar, C.FechaCreacion, 103) AS FechaCreacion,
                                ISNULL(U.Nombre, C.EmailCreador) AS CreadoPor
                         $sqlBaseResueltos
                         ORDER BY C.IdCaso DESC
                         OFFSET ? ROWS FETCH NEXT ? ROWS ONLY";
    
    // Al usar OFFSET en PDO, los parámetros deben ser enteros estocásticos
    $stmtPagina = $pdo->prepare($sqlDataResueltos);
    
    $idx = 1;
    foreach ($paramsResueltos as $p) {
        $stmtPagina->bindValue($idx++, $p);
    }
    $stmtPagina->bindValue($idx++, $offset, PDO::PARAM_INT);
    $stmtPagina->bindValue($idx, $limite, PDO::PARAM_INT);
    
    $stmtPagina->execute();
    $casosResueltos = $stmtPagina->fetchAll(PDO::FETCH_ASSOC);

    // =========================================================
    // RESPUESTA FINAL
    // =========================================================
    echo json_encode([
        'success' => true, 
        'activos' => $casosActivos,
        'resueltos' => $casosResueltos,
        'paginacion' => [
            'total' => $totalResueltos,
            'pagina_actual' => $pagina,
            'limite' => $limite,
            'total_paginas' => ceil($totalResueltos / $limite)
        ],
        'userRole' => $rol
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
}
?>