<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
$emailUsuario = $_SESSION['user']['email'] ?? null;
$sucursal = $_GET['sucursal'] ?? ''; // Leemos si nos mandan una sucursal

try {
    $pdo = Database::connect();
    
    // 1. Obtener Catálogo de Justificaciones
    $stmtCat = $pdo->query("SELECT IdJustificacion, TextoVisor, TipoAccion, RequiereComentario FROM Tbl_Justificaciones_CC WHERE Activo = 1 ORDER BY IdJustificacion ASC");
    $catalogoJustificaciones = $stmtCat->fetchAll(PDO::FETCH_ASSOC);

    // Consulta base a la tabla de Tickets
    $sql = "SELECT 
                C.IdCaso, C.ICD_Relacionado, C.Sucursal_Relacionada, C.NumeroContrato, 
                C.NombreCliente, C.MontoCRC, C.Estado, C.FechaCreacion, C.DiasAtraso, C.MotivoAgente,
                J.NombreJefe, J.EmailJefe,
                ISNULL(RTRIM(U.Nombre + ' ' + ISNULL(U.Apellidos, '')), U.Email) AS CreadoPor
            FROM Tbl_Casos_TSD C
            LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email
            LEFT JOIN (
                -- Agrupa Jefes dinámicamente desde la Matriz Unificada con Apellidos
                SELECT CodigoSucursal,
                    STUFF((SELECT ' / ' + RTRIM(U2.Nombre + ' ' + ISNULL(U2.Apellidos, '')) FROM Tbl_Usuario_Sucursales_cc S2 INNER JOIN Tbl_Usuarios U2 ON S2.EmailUsuario = U2.Email INNER JOIN Tbl_Roles R2 ON U2.Id_Rol = R2.Id_Rol WHERE S2.CodigoSucursal = S1.CodigoSucursal AND S2.Activo = 1 AND R2.Nombre_Rol IN ('jefe', 'admin') FOR XML PATH('')), 1, 3, '') AS NombreJefe,
                    STUFF((SELECT ',' + S2.EmailUsuario FROM Tbl_Usuario_Sucursales_cc S2 INNER JOIN Tbl_Usuarios U2 ON S2.EmailUsuario = U2.Email INNER JOIN Tbl_Roles R2 ON U2.Id_Rol = R2.Id_Rol WHERE S2.CodigoSucursal = S1.CodigoSucursal AND S2.Activo = 1 AND R2.Nombre_Rol IN ('jefe', 'admin') FOR XML PATH('')), 1, 1, '') AS EmailJefe
                FROM Tbl_Usuario_Sucursales_cc S1
                WHERE Activo = 1
                GROUP BY CodigoSucursal
            ) J ON SUBSTRING(C.Sucursal_Relacionada, 1, CHARINDEX(' ', C.Sucursal_Relacionada + ' ') - 1) = J.CodigoSucursal
            WHERE C.Estado != 'CERRADO'";

    if (empty($sucursal)) {
        // VISTA DE INICIO: Traer todos mis pendientes activos que coincidan con mis sucursales actuales asignadas
        $sql .= " AND C.EmailCreador = ? 
                  AND EXISTS (
                      SELECT 1 FROM Tbl_Usuario_Sucursales_cc V 
                      WHERE V.EmailUsuario = ? AND V.Activo = 1 
                      AND C.Sucursal_Relacionada LIKE V.CodigoSucursal + '%'
                  )
                  ORDER BY C.DiasAtraso DESC, C.FechaCreacion DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$emailUsuario, $emailUsuario]); // Se pasa dos veces: Uno para el creador, otro para la subconsulta
        
        // --- NUEVO: Extraer sucursales asignadas para mostrar en el Home ---
        $rolUsuario = $_SESSION['user']['role'] ?? '';
        $sucursalesHome = [];

        if (in_array($rolUsuario, ['jefe', 'admin', 'servicio_cliente', 'agente', 'coordinador'])) {
            // Todos los roles extraen sus sucursales de la matriz unificada
            $stmtSucs = $pdo->prepare("SELECT CodigoSucursal, NombreSucursal FROM Tbl_Usuario_Sucursales_cc WHERE EmailUsuario = ? AND Activo = 1");
            $stmtSucs->execute([$emailUsuario]);
            $sucursalesHome = $stmtSucs->fetchAll(PDO::FETCH_ASSOC);
        }
        
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll(), 'mis_sucursales' => $sucursalesHome, 'catalogo_justificaciones' => $catalogoJustificaciones]);

    } else {
        // VISTA COLABORATIVA: Traer los NO REPORTADOS de esa Sucursal (Míos o de otros)
        $sql .= " AND C.Sucursal_Relacionada LIKE ? AND C.Estado = 'NO_REPORTADO' ORDER BY C.DiasAtraso DESC, C.FechaCreacion DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$sucursal . '%']);
        
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll(), 'catalogo_justificaciones' => $catalogoJustificaciones]);
    }
} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
}
?>