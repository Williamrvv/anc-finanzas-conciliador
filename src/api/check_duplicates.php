<?php
ini_set('display_errors', 0); error_reporting(0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) { http_response_code(401); exit; }
require_once '../db.php';

$data = json_decode(file_get_contents('php://input'), true);
if (empty($data['hashes'])) { echo json_encode(['success' => true, 'duplicados' => []]); exit; }

try {
    $pdo = Database::connect();
    
    // Calcular el MD5 idéntico al que genera el Backend al guardar
    $hashesToSearch = array_map('md5', $data['hashes']);
    $uniqueHashes = array_unique($hashesToSearch);

    $foundHashes = [];
    
    // SQL Server tiene un límite de 2100 parámetros por consulta. Lo partimos en bloques de 1000.
    $chunks = array_chunk($uniqueHashes, 1000);

    foreach ($chunks as $chunk) {
        $inQuery = implode(',', array_fill(0, count($chunk), '?'));
        // Buscamos transacciones que ya existan (No importa si están Pendientes o Conciliadas, si están en la BD, ya no deben volver a subirse por Excel)
        $stmt = $pdo->prepare("SELECT HashUnico FROM Tbl_Transacciones_Maestra WHERE HashUnico IN ($inQuery)");
        $stmt->execute($chunk);
        $foundHashes = array_merge($foundHashes, $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    $foundHashes = array_unique($foundHashes);

    // Mapear de vuelta a los strings originales para que JS sepa cuáles borrar
    $dupes = [];
    foreach ($data['hashes'] as $rawStr) {
        if (in_array(md5($rawStr), $foundHashes)) {
            $dupes[] = $rawStr;
        }
    }

    echo json_encode(['success' => true, 'duplicados' => array_values(array_unique($dupes))]);
    
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>