<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = Database::connect();

    // 1. LEER DATOS (GET)
    if ($method === 'GET') {
        $stmt = $pdo->query("SELECT Afiliado, Banco, CentroCosto, CodigoSucursal, NombreSucursal, Activo FROM Tbl_Diccionario_Afiliados ORDER BY Activo DESC, Afiliado ASC");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    } 
    
    // 2. INSERTAR O ACTUALIZAR (UPSERT - POST)
    else if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['Afiliado']) || empty($input['CentroCosto'])) {
            throw new Exception("El Afiliado y el Centro de Costo son obligatorios.");
        }

        $afil = strtoupper(trim($input['Afiliado']));
        $banco = trim($input['Banco'] ?? 'S/D');
        $cc = trim($input['CentroCosto']);
        $codSuc = trim($input['CodigoSucursal'] ?? '');
        $nomSuc = trim($input['NombreSucursal'] ?? '');

        // Validar si existe (Para devolver mensaje al usuario)
        $stmtCheck = $pdo->prepare("SELECT Activo FROM Tbl_Diccionario_Afiliados WHERE Afiliado = ?");
        $stmtCheck->execute([$afil]);
        $row = $stmtCheck->fetch();

        if ($row) {
            // Ya existe -> ACTUALIZAR Y REACTIVAR
            $stmtUpdate = $pdo->prepare("UPDATE Tbl_Diccionario_Afiliados SET Banco=?, CentroCosto=?, CodigoSucursal=?, NombreSucursal=?, Activo=1 WHERE Afiliado=?");
            $stmtUpdate->execute([$banco, $cc, $codSuc, $nomSuc, $afil]);
            $msg = "El afiliado '$afil' ya existía. Sus datos han sido actualizados y marcado como Activo.";
        } else {
            // No existe -> INSERTAR
            $stmtInsert = $pdo->prepare("INSERT INTO Tbl_Diccionario_Afiliados (Afiliado, Banco, CentroCosto, CodigoSucursal, NombreSucursal, Activo) VALUES (?, ?, ?, ?, ?, 1)");
            $stmtInsert->execute([$afil, $banco, $cc, $codSuc, $nomSuc]);
            $msg = "Afiliado '$afil' registrado exitosamente.";
        }

        echo json_encode(['success' => true, 'message' => $msg]);
    }
    
    // 3. CAMBIAR ESTADO ACTIVO/INACTIVO (PATCH)
    else if ($method === 'PATCH') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['Afiliado'])) throw new Exception("Afiliado no proporcionado.");
        
        $afil = $input['Afiliado'];
        $activo = (int)$input['Activo'];

        $stmt = $pdo->prepare("UPDATE Tbl_Diccionario_Afiliados SET Activo = ? WHERE Afiliado = ?");
        $stmt->execute([$activo, $afil]);

        echo json_encode(['success' => true]);
    }

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>