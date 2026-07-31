<?php
// ============================================================================
//  get_sucursales_m4.php — Autocomplete de sucursales para el Ajuste Manual M4
// ============================================================================
session_start();
error_reporting(0);
require_once '../db.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Sin sesión']); exit;
}

$banco = strtoupper(trim($_GET['banco'] ?? 'DAVIBANK'));

try {
    $pdo = Database::connect();

    // El MISMO local puede tener datáfono BAC y Davibank: el filtro por banco es obligatorio.
    $sql = "SELECT Afiliado, CentroCosto, CodigoSucursal, NombreSucursal, Banco
            FROM Tbl_Diccionario_Afiliados
            WHERE Activo = 1 AND UPPER(LTRIM(RTRIM(Banco))) = :b
            ORDER BY NombreSucursal ASC";
    $st = $pdo->prepare($sql);
    $st->execute([':b' => $banco]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $parcial = false;
    if (!$rows) {
        $rows = $pdo->query("SELECT Afiliado, CentroCosto, CodigoSucursal, NombreSucursal, Banco
                             FROM Tbl_Diccionario_Afiliados
                             WHERE Activo = 1 ORDER BY NombreSucursal ASC")->fetchAll(PDO::FETCH_ASSOC);
        $parcial = true;
    }

    echo json_encode(['success' => true, 'data' => $rows ?: [], 'parcial' => $parcial]);

} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error SQL: ' . $e->getMessage()]);
}