<?php
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

require_once '../db.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

$token = $data['token'] ?? '';
$comentario = trim($data['comentario'] ?? '');
$actorCorreo = trim($data['actor'] ?? 'Sistema/Externa'); // Trazabilidad 

if (empty($token)) {
    echo json_encode(['success' => false, 'error' => 'Token no proporcionado.']);
    exit;
}

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // 1. Validar Token (Cualquiera de los dos)
    $stmt = $pdo->prepare("SELECT IdCaso, Estado, TokenAprobacionJefe, TokenResolucionCS FROM Tbl_Casos_TSD WHERE TokenAprobacionJefe = ? OR TokenResolucionCS = ?");
    $stmt->execute([$token, $token]);
    $caso = $stmt->fetch();

    if (!$caso) throw new Exception("El token es inválido o corrupto.");

    if (in_array($caso['Estado'], ['RESUELTO', 'CERRADO'])) {
        throw new Exception("Este caso ya se encuentra resuelto.");
    }

    // 2. Identificar al Actor (Quien ganó la carrera)
    $actor = ($caso['TokenAprobacionJefe'] === $token) ? 'Jefatura' : 'Servicio al Cliente';
    $accion = ($actor === 'Jefatura') ? 'RESUELTO_JEFATURA' : 'RESUELTO_CS';

    // 3. Actualizar Estado (Mantenemos los tokens pero el estado protege la carrera)
    $stmtUpdate = $pdo->prepare("UPDATE Tbl_Casos_TSD SET Estado = 'RESUELTO' WHERE IdCaso = ?");
    $stmtUpdate->execute([$caso['IdCaso']]);

    // 4. Registrar en Historial
    $comentarioFinal = empty($comentario) ? "Sin comentarios." : $comentario;
    
    // Tratamos de ver si el correo provisto en la URL existe en nuestra tabla de usuarios
    // Si no existe, pasamos NULL a la Foreign Key pero dejamos la huella completa en el comentario.
    $stmtCheckUser = $pdo->prepare("SELECT Email FROM Tbl_Usuarios WHERE Email = ?");
    $stmtCheckUser->execute([$actorCorreo]);
    $userBd = $stmtCheckUser->fetchColumn();
    
    $dbActor = $userBd ? $userBd : null; // Foreign Key Segura
    $huella = "Resuelto vía Correo por: $actorCorreo | Nota: $comentarioFinal";

    $stmtHist = $pdo->prepare("INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, ?, ?, ?)");
    $stmtHist->execute([$caso['IdCaso'], $accion, $dbActor, $huella]);

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>