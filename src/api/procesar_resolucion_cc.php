<?php
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

require_once '../db.php';
if (file_exists('../Mailer.php')) require_once '../Mailer.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

$token = $data['token'] ?? '';
$comentario = trim($data['comentario'] ?? '');
$actorCorreo = trim($data['actor'] ?? 'Sistema/Externa'); // Trazabilidad 
$accion = trim($data['accion'] ?? 'RESOLVER'); // Puede ser RESOLVER o ESCALAR_SC

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

    // Extraer cuenta oficial de BD para foránea
    $stmtCheckUser = $pdo->prepare("SELECT Email FROM Tbl_Usuarios WHERE Email = ?");
    $stmtCheckUser->execute([$actorCorreo]);
    $userBd = $stmtCheckUser->fetchColumn();
    $dbActor = $userBd ? $userBd : null;

    $comentarioFinal = empty($comentario) ? "Sin comentarios adicionales." : $comentario;

    if ($accion === 'ESCALAR_SC') {
        if ($caso['Estado'] !== 'PENDIENTE_VISTO_BUENO') {
            throw new Exception("El caso no está pendiente de visto bueno.");
        }
        
        $stmtUpdate = $pdo->prepare("UPDATE Tbl_Casos_TSD SET Estado = 'PENDIENTE_RESOLUCION' WHERE IdCaso = ?");
        $stmtUpdate->execute([$caso['IdCaso']]);
        
        $huella = "Escalado a SC vía Correo por: $actorCorreo | Nota: $comentarioFinal";
        $stmtHist = $pdo->prepare("INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, 'ESCALADO_SC', ?, ?)");
        $stmtHist->execute([$caso['IdCaso'], $dbActor, $huella]);

        // ENVIAR CORREO A SERVICIO AL CLIENTE (SC)
        $stmtDetails = $pdo->prepare("
            SELECT NumeroContrato, NombreCliente, Sucursal_Relacionada, MontoCRC, MotivoAgente, TokenResolucionCS, 
                   (SELECT TOP 1 RTRIM(Nombre + ' ' + ISNULL(Apellidos, '')) FROM Tbl_Usuarios WHERE Email = Tbl_Casos_TSD.EmailCreador) as CreadorNombre 
            FROM Tbl_Casos_TSD WHERE IdCaso = ?
        ");
        $stmtDetails->execute([$caso['IdCaso']]);
        $r = $stmtDetails->fetch();
        
        $stmtCS = $pdo->prepare("SELECT U.Email FROM Tbl_Usuarios U INNER JOIN Tbl_Roles R ON U.Id_Rol = R.Id_Rol WHERE R.Nombre_Rol = 'servicio_cliente' AND U.Activo = 1");
        $stmtCS->execute();
        $listaCorreosCS = $stmtCS->fetchAll(PDO::FETCH_COLUMN);

        $csEmail = count($listaCorreosCS) > 0 ? implode(',', $listaCorreosCS) : 'soporte.tsdiri@rentascorporativascr.com';
        $dominioLocal = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $montoFmt = number_format((float)$r['MontoCRC'], 2, '.', ',');
        $urlResolucion = "https://$dominioLocal/resolver_caso_cc.php?token={$r['TokenResolucionCS']}&actor=" . urlencode('Servicio Al Cliente');

        $csHtmlBody = "
            <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;'>
                <div style='display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;'>
                    <div>
                        <span style='color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold;'>Contrato</span>
                        <div style='color: #0f172a; font-size: 16px; font-weight: bold;'>{$r['NumeroContrato']}</div>
                    </div>
                    <div style='text-align: right;'>
                        <span style='color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold;'>Monto Afectado</span>
                        <div style='color: #ef4444; font-size: 16px; font-weight: bold; font-family: monospace;'>₡$montoFmt</div>
                    </div>
                </div>
                <div style='font-size: 13px; color: #475569; margin-bottom: 15px;'>
                    <b>Sucursal:</b> {$r['Sucursal_Relacionada']}<br>
                    <b>Cliente:</b> {$r['NombreCliente']}<br>
                    <b>Solicitado por:</b> {$r['CreadorNombre']}<br>
                    <b>Escalado por (Jefatura):</b> $actorCorreo
                </div>
                <div style='background-color: #fff; padding: 12px; border-left: 3px solid #3b82f6; font-size: 13px; color: #334155; margin-bottom: 15px;'>
                    <b>Motivo Original:</b> <i>\"{$r['MotivoAgente']}\"</i><br><br>
                    <b>Nota de Jefatura:</b> <i>\"$comentarioFinal\"</i>
                </div>
                <a href='$urlResolucion' style='display: block; width: 100%; text-align: center; background-color: #10b981; color: white; text-decoration: none; padding: 12px 0; border-radius: 6px; font-weight: bold; font-size: 14px;'>Resolver Caso</a>
            </div>";

        $csBodyFinal = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
            <div style='text-align: center; padding: 20px 0;'>
                <h2 style='color: #0f172a; margin: 0;'>Escalamiento Jefatura - Requiere Corrección TSD</h2>
                <p style='color: #64748b; font-size: 14px; margin-top: 5px;'>La jefatura ha escalado un ticket que requiere acción de SC.</p>
            </div>
            $csHtmlBody
            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;'>
                <a href='https://$dominioLocal/' style='color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: bold;'>Ver todos los casos en IRI &rarr;</a>
            </div>
        </div>";

        if (class_exists('Mailer')) { Mailer::send($csEmail, "Alerta SC: Caso escalado por Jefatura para corrección", $csBodyFinal); }

    } elseif ($accion === 'REVERTIR') {
        // ------------------ FLUJO RECHAZO / REVERTIR (Jefatura) ------------------
        if ($caso['Estado'] !== 'PENDIENTE_VISTO_BUENO') {
            throw new Exception("El caso no está pendiente de visto bueno.");
        }

        $stmtUpdate = $pdo->prepare("UPDATE Tbl_Casos_TSD SET Estado = 'NO_REPORTADO' WHERE IdCaso = ?");
        $stmtUpdate->execute([$caso['IdCaso']]);

        $huella = "Rechazado y devuelto al Agente vía Correo por: $actorCorreo | Nota: $comentarioFinal";
        $stmtHist = $pdo->prepare("INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, 'ESTADO_NO_REPORTADO', ?, ?)");
        $stmtHist->execute([$caso['IdCaso'], $dbActor, $huella]);

    } else { 
        // ------------------ FLUJO RESOLVER FINAL (Customer Service) ------------------
        if ($caso['Estado'] !== 'PENDIENTE_RESOLUCION') {
            throw new Exception("El caso no está en estado pendiente de resolución.");
        }

        $stmtUpdate = $pdo->prepare("UPDATE Tbl_Casos_TSD SET Estado = 'RESUELTO' WHERE IdCaso = ?");
        $stmtUpdate->execute([$caso['IdCaso']]);

        $huella = "Resuelto vía Correo por: $actorCorreo | Nota: $comentarioFinal";
        $stmtHist = $pdo->prepare("INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, 'RESUELTO_CS', ?, ?)");
        $stmtHist->execute([$caso['IdCaso'], $dbActor, $huella]);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>