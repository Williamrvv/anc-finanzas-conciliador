<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
if (file_exists('../Mailer.php')) require_once '../Mailer.php';

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
        if ($estadoActual !== 'PENDIENTE_RESOLUCION') throw new Exception("El caso no se encuentra en estado pendiente de resolución.");
        $nuevoEstado = 'RESUELTO';
        $notaHistorial = "Corregido en TSD: $comentario";
    } 
    elseif ($accion === 'ESCALAR_SC') {
        if ($estadoActual !== 'PENDIENTE_VISTO_BUENO') throw new Exception("El caso no está pendiente de visto bueno.");
        $nuevoEstado = 'PENDIENTE_RESOLUCION';
        $notaHistorial = "Escalado a SC por Jefatura: $comentario";
        
        // --- ENVIAR CORREO A SERVICIO AL CLIENTE ---
        $stmtDetails = $pdo->prepare("SELECT NumeroContrato, NombreCliente, Sucursal_Relacionada, MontoCRC, MotivoAgente, TokenResolucionCS, (SELECT TOP 1 RTRIM(Nombre + ' ' + ISNULL(Apellidos, '')) FROM Tbl_Usuarios WHERE Email = Tbl_Casos_TSD.EmailCreador) as CreadorNombre FROM Tbl_Casos_TSD WHERE IdCaso = ?");
        $stmtDetails->execute([$idCaso]);
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
                    <b>Escalado por (Jefatura):</b> {$nombreUsuario}
                </div>
                <div style='background-color: #fff; padding: 12px; border-left: 3px solid #3b82f6; font-size: 13px; color: #334155; margin-bottom: 15px;'>
                    <b>Motivo Original:</b> <i>\"{$r['MotivoAgente']}\"</i><br><br>
                    <b>Nota de Jefatura:</b> <i>\"$comentario\"</i>
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