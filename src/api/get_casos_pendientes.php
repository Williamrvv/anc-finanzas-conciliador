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
    
    // Consulta base a la tabla de Tickets
    $sql = "SELECT 
                C.IdCaso, C.ICD_Relacionado, C.Sucursal_Relacionada, C.NumeroContrato, 
                C.NombreCliente, C.MontoCRC, C.Estado, C.FechaCreacion, C.DiasAtraso, C.MotivoAgente,
                J.NombreJefe, J.EmailJefe,
                ISNULL(U.Nombre, U.Email) AS CreadoPor
            FROM Tbl_Casos_TSD C
            LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email
            LEFT JOIN Tbl_Jefes_Estacion J ON SUBSTRING(C.Sucursal_Relacionada, 1, CHARINDEX(' ', C.Sucursal_Relacionada + ' ') - 1) = J.CodigoSucursal
            WHERE C.Estado != 'CERRADO'";

    if (empty($sucursal)) {
        // VISTA DE INICIO:
        // Si el rol es admin (o como tú llames a tu superusuario), traemos TODOS los pendientes
        if (isset($_SESSION['user']['role']) && $_SESSION['user']['role'] === 'admin') {
            $sql .= " ORDER BY C.DiasAtraso DESC, C.FechaCreacion DESC";
            $stmt = $pdo->query($sql);
        } else {
            // Si es un agente normal, traemos solo los casos que él creó
            $sql .= " AND C.EmailCreador = ? ORDER BY C.DiasAtraso DESC, C.FechaCreacion DESC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$emailUsuario]);
        }
    } else {
        // VISTA COLABORATIVA: Traer los NO REPORTADOS de esa Sucursal (Míos o de otros)
        $sql .= " AND C.Sucursal_Relacionada LIKE ? AND C.Estado = 'NO_REPORTADO' ORDER BY C.DiasAtraso DESC, C.FechaCreacion DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$sucursal . '%']);
    }

    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);

} catch (Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error BD: ' . $e->getMessage()]);
}
?>