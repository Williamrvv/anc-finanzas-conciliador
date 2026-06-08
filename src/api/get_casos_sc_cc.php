<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['servicio_cliente', 'admin'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado. Permisos insuficientes.']);
    exit;
}

require_once '../db.php';

try {
    $pdo = Database::connect();
    
    // Consulta de todos los casos nacionales escalados a SC
    $sql = "SELECT 
                C.IdCaso, 
                C.IdCierreOrigen AS Folio, 
                C.Sucursal_Relacionada, 
                (SELECT TOP 1 NombreSucursal FROM Tbl_Usuario_Sucursales_cc WHERE CodigoSucursal = SUBSTRING(C.Sucursal_Relacionada, 1, CHARINDEX(' ', C.Sucursal_Relacionada + ' ') - 1)) AS NombreSucursal,
                C.NumeroContrato, 
                C.NombreCliente,
                C.MontoCRC, 
                C.DiasAtraso, 
                CONVERT(varchar, C.FechaCreacion, 103) AS FechaCreacion, 
                J.TextoVisor, 
                C.MotivoAgente, 
                ISNULL(RTRIM(U.Nombre + ' ' + ISNULL(U.Apellidos, '')), C.EmailCreador) AS Creador 
            FROM Tbl_Casos_TSD C 
            LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email 
            LEFT JOIN Tbl_Justificaciones_CC J ON C.IdJustificacion = J.IdJustificacion 
            WHERE C.Estado = 'PENDIENTE_RESOLUCION' 
            ORDER BY C.DiasAtraso DESC, C.Sucursal_Relacionada ASC, C.IdCaso ASC";
            
    $stmt = $pdo->query($sql);
    $casos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['success' => true, 'data' => $casos, 'userRole' => 'servicio_cliente']);

} catch(Exception $e) { 
    echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]); 
}
?>