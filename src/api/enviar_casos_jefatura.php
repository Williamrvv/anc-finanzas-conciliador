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
    
    // 1. Obtener la información cruzada de la BD (Incluyendo qué Jefe le toca a cada caso)
    $inClause = str_repeat('?,', count($casosIds) - 1) . '?';
    $sqlData = "SELECT C.IdCaso, C.NumeroContrato, C.NombreCliente, C.MotivoAgente, C.Sucursal_Relacionada, C.ICD_Relacionado, C.MontoCRC, C.FechaCreacion, 
                       J.EmailJefe, J.NombreJefe
                FROM Tbl_Casos_TSD C
                LEFT JOIN (
                    SELECT CodigoSucursal,
                        STUFF((SELECT ' / ' + NombreJefe FROM Tbl_Jefes_Estacion J2 WHERE J2.CodigoSucursal = J1.CodigoSucursal AND J2.Activo = 1 FOR XML PATH('')), 1, 3, '') AS NombreJefe,
                        STUFF((SELECT ',' + EmailJefe FROM Tbl_Jefes_Estacion J2 WHERE J2.CodigoSucursal = J1.CodigoSucursal AND J2.Activo = 1 FOR XML PATH('')), 1, 1, '') AS EmailJefe
                    FROM Tbl_Jefes_Estacion J1
                    WHERE Activo = 1
                    GROUP BY CodigoSucursal
                ) J ON SUBSTRING(C.Sucursal_Relacionada, 1, CHARINDEX(' ', C.Sucursal_Relacionada + ' ') - 1) = J.CodigoSucursal
                WHERE C.IdCaso IN ($inClause)";
    
    $stmtData = $pdo->prepare($sqlData);
    $stmtData->execute($casosIds);
    $resultados = $stmtData->fetchAll();

    if (empty($resultados)) {
        throw new Exception("Los casos seleccionados no existen o ya fueron procesados.");
    }

    // 2. AGRUPAR CASOS POR JEFATURA
    $gruposPorJefe = [];
    foreach ($casosInput as $inputCaso) {
        $idC = $inputCaso['id_caso'];
        
        // Encontrar los datos de la BD correspondientes a este input
        $r = array_values(array_filter($resultados, function($i) use ($idC) { return $i['IdCaso'] == $idC; }))[0] ?? null;
        if (!$r) continue;

        $emailJefe = $r['EmailJefe'] ?? 'customer.service@rentascorporativascr.com'; // Fallback
        
        if (!isset($gruposPorJefe[$emailJefe])) {
            $gruposPorJefe[$emailJefe] = [
                'nombreJefe' => $r['NombreJefe'] ?? 'Jefatura',
                'casos' => []
            ];
        }
        
        $gruposPorJefe[$emailJefe]['casos'][] = [
            'id_caso' => $idC,
            'motivo' => $inputCaso['motivo'],
            'datos_bd' => $r
        ];
    }

    // 3. PROCESAR BD Y ENVIAR CORREOS INDIVIDUALIZADOS POR GRUPO
    $dominioLocal = $_SERVER['HTTP_HOST'] ?? 'localhost';
    
    // Cambiamos el estado unificado a PENDIENTE_RESOLUCION
    $sqlUpdate = "UPDATE Tbl_Casos_TSD SET Estado = 'PENDIENTE_RESOLUCION', MotivoAgente = ?, TokenAprobacionJefe = ?, TokenResolucionCS = ? WHERE IdCaso = ?";
    $stmtUpdate = $pdo->prepare($sqlUpdate);

    $sqlHist = "INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, 'ENVIADO_RESOLUCION', ?, 'Caso escalado a Jefatura y SC para corrección.')";
    $stmtHist = $pdo->prepare($sqlHist);

    $todosLosCasosParaCS = []; // Acumulador para el correo masivo de CS

    foreach ($gruposPorJefe as $emailDestino => $grupo) {
        $htmlBody = "";
        
        // Procesar los casos de ESTE jefe específico
        foreach ($grupo['casos'] as $item) {
            $idC = $item['id_caso'];
            $motivo = $item['motivo'];
            $r = $item['datos_bd'];
            
            $tokenJefe = bin2hex(random_bytes(16)); 
            $tokenCS = bin2hex(random_bytes(16)); // Nuevo token para SC
            
            // Actualizar BD con ambos tokens
            $stmtUpdate->execute([$motivo, $tokenJefe, $tokenCS, $idC]);
            
            // Guardamos el caso para el correo de Servicio al Cliente
            $todosLosCasosParaCS[] = [
                'datos' => $r,
                'motivo' => $motivo,
                'token' => $tokenCS
            ];
            $stmtHist->execute([$idC, $emailUsuario]);

            // Construir tarjeta HTML
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
                        <span><b>Sucursal:</b> {$r['Sucursal_Relacionada']}</span>
                        <span><b>Monto:</b> ₡$montoFmt</span>
                    </div>
                    <div style='background-color: #fef2f2; color: #991b1b; padding: 12px 15px; border-radius: 6px; font-size: 13px; border: 1px solid #fecaca; margin-bottom: 15px;'>
                        <b style='display: block; margin-bottom: 5px;'>Justificación del Agente Rentista:</b>
                        $motivo
                    </div>
                    <div style='text-align: center; margin-top: 10px;'>
                        <a href='https://$dominioLocal/resolver_caso_cc.php?token=$tokenJefe&actor=" . urlencode($emailDestino) . "' style='display: block; width: 100%; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 0; border-radius: 6px; font-weight: bold; font-size: 14px;'>Resolver Caso</a>
                    </div>
                </li>";
        }

        // Armar y enviar el correo para ESTE jefe
        $bodyFinal = "
        <div style='font-family: Arial, Helvetica, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;'>
            <div style='background-color: #4f46e5; color: #ffffff; padding: 25px 20px; text-align: center;'>
                <h2 style='margin: 0; font-size: 22px; font-weight: bold;'>Resolución Requerida en TSD</h2>
                <p style='margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;'>Integración Regional de Ingresos (IRI)</p>
            </div>
            <div style='padding: 30px 20px; background-color: #ffffff;'>
                <p>Estimada Jefatura <b>({$grupo['nombreJefe']})</b>,</p>
                <p>El usuario <b>$nombreReal</b> ha reportado inconsistencias en su sucursal. Por favor, realice los ajustes correspondientes en TSD y marque el caso como resuelto.</p>
                <ul style='list-style-type: none; padding: 0; margin: 20px 0;'>
                    $htmlBody
                </ul>
            </div>
        </div>";

        if (class_exists('Mailer')) {
            Mailer::send($emailDestino, "Aprobación Requerida: Inconsistencias TSD reportadas por $nombreReal", $bodyFinal);
        }
    }

    // --- 4. ENVIAR CORREO PARALELO A SERVICIO AL CLIENTE (CS) ---
    if (!empty($todosLosCasosParaCS) && class_exists('Mailer')) {
        $dominioLocal = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $csHtmlBody = "";
        
        // Extraer TODOS los correos de los usuarios activos con rol Servicio al Cliente
        $stmtCS = $pdo->prepare("
            SELECT U.Email 
            FROM Tbl_Usuarios U
            INNER JOIN Tbl_Roles R ON U.Id_Rol = R.Id_Rol
            WHERE R.Nombre_Rol = 'servicio_cliente' AND U.Activo = 1
        ");
        $stmtCS->execute();
        $listaCorreosCS = $stmtCS->fetchAll(PDO::FETCH_COLUMN);

        // Si hay usuarios, los unimos por coma. Si no, usamos un Fallback.
        if (count($listaCorreosCS) > 0) {
            $csEmail = implode(',', $listaCorreosCS); // Genera: "correo1@grupoanc.com,correo2@grupoanc.com"
        } else {
            $csEmail = 'soporte.tsdiri@rentascorporativascr.com';
        }

        foreach ($todosLosCasosParaCS as $c) {
            $r = $c['datos'];
            $montoFmt = number_format((float)$r['MontoCRC'], 2, '.', ',');
            $urlResolucion = "https://$dominioLocal/resolver_caso_cc.php?token={$c['token']}&actor=" . urlencode($csEmail);

            $csHtmlBody .= "
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
                        <b>Agente:</b> $nombreReal
                    </div>
                    <div style='background-color: #fff; padding: 12px; border-left: 3px solid #3b82f6; font-size: 13px; color: #334155; margin-bottom: 15px;'>
                        <i>\"{$c['motivo']}\"</i>
                    </div>
                    <a href='$urlResolucion' style='display: block; width: 100%; text-align: center; background-color: #10b981; color: white; text-decoration: none; padding: 12px 0; border-radius: 6px; font-weight: bold; font-size: 14px;'>Resolver Caso</a>
                </div>";
        }

        $csBodyFinal = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
            <div style='text-align: center; padding: 20px 0;'>
                <h2 style='color: #0f172a; margin: 0;'>Reporte TSD - Servicio al Cliente</h2>
                <p style='color: #64748b; font-size: 14px; margin-top: 5px;'>Se han reportado nuevas inconsistencias en cajas.</p>
            </div>
            $csHtmlBody
            <div style='text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;'>
                <a href='https://$dominioLocal/' style='color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: bold;'>Ver todos los casos en IRI &rarr;</a>
            </div>
        </div>";

        Mailer::send($csEmail, "Alerta SC: " . count($todosLosCasosParaCS) . " casos reportados por $nombreReal", $csBodyFinal);
    }

    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Throwable $e) { 
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => 'Error de BD/PHP: ' . $e->getMessage()]);
}
?>