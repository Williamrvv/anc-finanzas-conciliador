<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$idCaso = $_GET['idCaso'] ?? 0;

if (empty($idCaso)) {
    echo json_encode(['success' => false, 'error' => 'ID de caso no válido.']);
    exit;
}

try {
    $pdo = Database::connect();
    
    // 1. Obtener la cabecera del Caso (Incluyendo Cliente y USD)
    $stmtCaso = $pdo->prepare("
        SELECT C.IdCaso, C.NumeroContrato, C.NombreCliente, C.Sucursal_Relacionada, C.MontoCRC, C.Estado, 
               ISNULL(D.MontoUSD, 0) AS MontoUSD
        FROM Tbl_Casos_TSD C
        LEFT JOIN Tbl_CierreCaja_Detalle D ON C.IdCierreOrigen = D.IdCierre AND C.NumeroContrato = D.Numero_Contrato
        WHERE C.IdCaso = ?
    ");
    $stmtCaso->execute([$idCaso]);
    $caso = $stmtCaso->fetch(PDO::FETCH_ASSOC);

    if (!$caso) throw new Exception("Caso no encontrado.");

    // 2. Obtener el Historial ordenado cronológicamente
    $stmtHist = $pdo->prepare("SELECT Accion, EmailActor, ComentarioAdicional, FechaAccion 
                               FROM Tbl_Casos_Historial 
                               WHERE IdCaso = ? 
                               ORDER BY IdHistorial ASC");
    $stmtHist->execute([$idCaso]);
    $historial = $stmtHist->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true, 
        'caso' => $caso,
        'historial' => $historial
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>