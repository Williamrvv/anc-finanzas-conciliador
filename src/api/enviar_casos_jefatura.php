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
// Cargar la clase Mailer sin crashear si no la encuentra
if (file_exists('../Mailer.php')) require_once '../Mailer.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data || empty($data['casos'])) {
    echo json_encode(['success' => false, 'error' => 'No se recibieron casos para enviar.']);
    exit;
}

$emailUsuario = $_SESSION['user']['email'] ?? null;
$nombreReal = $_SESSION['user']['name'] ?? 'Agente Rentista';

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    $casosInput = $data['casos'];
    $casosIds = array_map(function($c) { return $c['id_caso']; }, $casosInput);
    
    // Obtener información cruzada
    $inClause = str_repeat('?,', count($casosIds) - 1) . '?';
    $sqlData = "SELECT C.IdCaso, C.NumeroContrato, C.NombreCliente, C.MotivoAgente, C.Sucursal_Relacionada, C.ICD_Relacionado, C.MontoCRC, C.FechaCreacion, 
                       J.EmailJefe, J.NombreJefe
                FROM Tbl_Casos_TSD C
                LEFT JOIN Tbl_Jefes_Estacion J ON SUBSTRING(C.Sucursal_Relacionada, 1, CHARINDEX(' ', C.Sucursal_Relacionada + ' ') - 1) = J.CodigoSucursal
                WHERE C.IdCaso IN ($inClause)";
    
    $stmtData = $pdo->prepare($sqlData);
    $stmtData->execute($casosIds);
    $resultados = $stmtData->fetchAll();

    if (empty($resultados)) {
        throw new Exception("Los casos seleccionados no existen o ya fueron procesados.");
    }

    // Preparar Updates
    $sqlUpdate = "UPDATE Tbl_Casos_TSD SET Estado = 'PENDIENTE_VISTO_BUENO', MotivoAgente = ?, TokenAprobacionJefe = ? WHERE IdCaso = ?";
    $stmtUpdate = $pdo->prepare($sqlUpdate);

    $sqlHist = "INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, 'ENVIADO_JEFATURA', ?, 'Caso escalado a la jefatura.')";
    $stmtHist = $pdo->prepare($sqlHist);

    $htmlBody = "";
    // Asumimos el correo del jefe del primer caso (Idealmente todos los casos enviados en bloque son de la misma sucursal)
    $emailDestino = $resultados[0]['EmailJefe'] ?? 'customer.service@rentascorporativascr.com';

    foreach ($casosInput as $inputCaso) {
        $idC = $inputCaso['id_caso'];
        $motivo = $inputCaso['motivo'];
        
        // Token Seguro de Aprobación para la Fase 3
        $token = bin2hex(random_bytes(16)); 
        
        $stmtUpdate->execute([$motivo, $token, $idC]);
        $stmtHist->execute([$idC, $emailUsuario]);

        // Construir la tarjeta del correo para este contrato
        $r = array_values(array_filter($resultados, function($i) use ($idC) { return $i['IdCaso'] == $idC; }))[0];

        $montoFmt = number_format((float)$r['MontoCRC'], 2, '.', ',');
        $fechaFmt = date('d/m/Y', strtotime($r['FechaCreacion']));

        $htmlBody .= "
            <li style='background-color: #ffffff; padding: 20px; margin-bottom: 15px; border-left: 5px solid #ef4444; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;'>
                <div style='display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;'>
                    <div>
                        <strong style='color: #0f172a; font-size: 16px;'>Contrato: {$r['NumeroContrato']}</strong><br>
                        <span style='font-size: 13px; color: #64748b;'>Cliente: {$r['NombreCliente']}</span>
                    </div>
                    <div style='text-align: right;'>
                        <span style='font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;'>ICD Origen</span><br>
                        <strong style='color: #4f46e5; font-size: 14px;'>{$r['ICD_Relacionado']}</strong>
                    </div>
                </div>
                <div style='display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13px; color: #475569;'>
                    <span><b>Fecha Cierre:</b> $fechaFmt</span>
                    <span><b>Monto:</b> ₡$montoFmt</span>
                </div>
                <div style='background-color: #fef2f2; color: #991b1b; padding: 12px 15px; border-radius: 6px; font-size: 13px; border: 1px solid #fecaca; margin-bottom: 15px;'>
                    <b style='display: block; margin-bottom: 5px;'>Justificación del Agente Rentista:</b>
                    $motivo
                </div>
            </li>";
    }

    $bodyFinal = "
    <div style='font-family: Arial, Helvetica, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;'>
        <div style='background-color: #4f46e5; color: #ffffff; padding: 25px 20px; text-align: center;'>
            <h2 style='margin: 0; font-size: 22px; font-weight: bold;'>Aprobación Requerida</h2>
            <p style='margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;'>Integración Regional de Ingresos (IRI)</p>
        </div>
        <div style='padding: 30px 20px; background-color: #ffffff;'>
            <p>Estimada Jefatura,</p>
            <p>El usuario <b>$nombreReal</b> ha reportado las siguientes inconsistencias detectadas durante el Cierre de Cajas que requieren su visto bueno para ser escaladas a Servicio al Cliente.</p>
            <ul style='list-style-type: none; padding: 0; margin: 20px 0;'>
                $htmlBody
            </ul>
        </div>
    </div>";

    // Llamar al motor de correos
    if (class_exists('Mailer')) {
        Mailer::send($emailDestino, "Aprobación Requerida: Inconsistencias TSD reportadas por $nombreReal", $bodyFinal);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Throwable $e) { // <--- EL PROTECTOR ABSOLUTO
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => 'Error de BD/PHP: ' . $e->getMessage()]);
}
?>