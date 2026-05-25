<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

$idCaso = $data['idCaso'] ?? 0;
$accion = $data['accion'] ?? ''; // REPORTAR, RESOLVER, REVERTIR
$comentario = trim($data['comentario'] ?? '');

$emailUsuario = $_SESSION['user']['email'] ?? 'Sistema';
$nombreUsuario = $_SESSION['user']['name'] ?? 'Usuario';

if (empty($idCaso) || empty($accion)) {
    echo json_encode(['success' => false, 'error' => 'Datos incompletos.']);
    exit;
}

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // 1. Validar el estado actual del caso
    $stmtVal = $pdo->prepare("SELECT Estado FROM Tbl_Casos_TSD WHERE IdCaso = ?");
    $stmtVal->execute([$idCaso]);
    $estadoActual = $stmtVal->fetchColumn();

    if (!$estadoActual) throw new Exception("El caso no existe.");

    $nuevoEstado = '';
    $notaHistorial = '';

    // 2. Máquina de Estados Estricta
    if ($accion === 'ESCALAR') {
        if ($estadoActual !== 'NO_REPORTADO') throw new Exception("El caso ya fue reportado anteriormente.");
        $nuevoEstado = 'PENDIENTE_RESOLUCION';
        $notaHistorial = "Reportado vía Dashboard a SC: $comentario";
        
        $stmtMotivo = $pdo->prepare("UPDATE Tbl_Casos_TSD SET MotivoAgente = ? WHERE IdCaso = ?");
        $stmtMotivo->execute([$comentario, $idCaso]);

    } 
    elseif (in_array($accion, ['CONTRACARGO', 'DEVOLUCION', 'OTRO_CONTRATO', 'CAMBIO_RAZON_SOCIAL'])) {
        if ($estadoActual !== 'NO_REPORTADO') throw new Exception("El caso ya fue procesado.");
        $nuevoEstado = 'CERRADO';
        $notaHistorial = "Cerrado directamente por el Agente ($accion). Nota: $comentario";
        
        $motivoCompleto = "[$accion] " . $comentario;
        $stmtMotivo = $pdo->prepare("UPDATE Tbl_Casos_TSD SET MotivoAgente = ? WHERE IdCaso = ?");
        $stmtMotivo->execute([$motivoCompleto, $idCaso]);
        
    }
    elseif ($accion === 'RESOLVER') {
        if ($estadoActual !== 'PENDIENTE_CORRECCION_TSD') throw new Exception("El caso no se encuentra en estado pendiente de corrección.");
        $nuevoEstado = 'RESUELTO';
        $notaHistorial = "Corregido en TSD: $comentario";
    } 
    elseif ($accion === 'REVERTIR') {
        // Solo para regresar atrás en caso de error
        $nuevoEstado = 'NO_REPORTADO';
        $notaHistorial = "Revertido manualmente por Jefatura.";
    } 
    else {
        throw new Exception("Acción no reconocida.");
    }

    // 3. Ejecutar Update del Estado
    $stmtUpdate = $pdo->prepare("UPDATE Tbl_Casos_TSD SET Estado = ? WHERE IdCaso = ?");
    $stmtUpdate->execute([$nuevoEstado, $idCaso]);

    // 4. Registrar en Historial
    $stmtHist = $pdo->prepare("INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, ?, ?, ?)");
    $stmtHist->execute([$idCaso, "ESTADO_" . $nuevoEstado, $emailUsuario, $notaHistorial]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>