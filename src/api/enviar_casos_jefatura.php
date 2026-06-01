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
            'accion' => $inputCaso['accion'] ?? 'ESCALAR',
            'id_justificacion' => $inputCaso['id_justificacion'] ?? null,
            'texto_visor' => $inputCaso['texto_visor'] ?? 'Cierre',
            'datos_bd' => $r
        ];
    }

    // 3. PROCESAR BD Y ENVIAR CORREOS INDIVIDUALIZADOS POR GRUPO
    $dominioLocal = $_SERVER['HTTP_HOST'] ?? 'localhost';
    
    // Cambiamos el estado unificado a PENDIENTE_RESOLUCION
    // Queries preparadas para ambos flujos
    $sqlEscalar = "UPDATE Tbl_Casos_TSD SET Estado = 'PENDIENTE_VISTO_BUENO', MotivoAgente = ?, TokenAprobacionJefe = ?, TokenResolucionCS = ?, IdJustificacion = ? WHERE IdCaso = ?";
    $stmtEscalar = $pdo->prepare($sqlEscalar);

    // Cierre Absoluto (Solo cambia el estado y el motivo)
    $sqlCerrar = "UPDATE Tbl_Casos_TSD SET Estado = 'CERRADO', MotivoAgente = ?, IdJustificacion = ? WHERE IdCaso = ?";
    $stmtCerrar = $pdo->prepare($sqlCerrar);

    $sqlHist = "INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, ?, ?, ?)";
    $stmtHist = $pdo->prepare($sqlHist);

    $todosLosCasosParaCS = []; // Solo para los que se escalan
    $dominioLocal = $_SERVER['HTTP_HOST'] ?? 'localhost';

    foreach ($gruposPorJefe as $emailDestino => $grupo) {
        $htmlBody = "";
        
        foreach ($grupo['casos'] as $item) {
            $idC = $item['id_caso'];
            $motivo = $item['motivo'];
            $accion = $item['accion'] ?? 'ESCALAR'; // Ahora puede ser ESCALAR o CERRAR dictado por BD
            $idJustificacion = $item['id_justificacion'];
            $textoVisor = $item['texto_visor'];
            $r = $item['datos_bd'];
            
            $montoFmt = number_format((float)$r['MontoCRC'], 2, '.', ',');
            
            // Verificamos la acción basada en el Catálogo Dinámico
            if ($accion === 'CERRAR') {
                
                // CIERRE DIRECTO (AR es autónomo)
                $motivoCompleto = "[$textoVisor] " . $motivo;
                $stmtCerrar->execute([$motivoCompleto, $idJustificacion, $idC]);
                $stmtHist->execute([$idC, 'ESTADO_CERRADO', $emailUsuario, "Cerrado directamente por el Agente. Motivo: $textoVisor. Nota: $motivo"]);
                
                // Tarjeta HTML Informativa para el Jefe (Sin botón de resolver)
                $btnHtml = "";
                $etiquetaHtml = "<span style='font-size: 11px; background-color: #d1fae5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: bold;'>✅ CERRADO INFORMATIVO ($textoVisor)</span>";
                $motivoParaCorreo = $motivoCompleto; 
                $colorBorde = '#10b981';

            } else {
                
                // FLUJO VISTO BUENO (Escalar SOLO a Jefe)
                $tokenJefe = bin2hex(random_bytes(16)); 
                $tokenCS = bin2hex(random_bytes(16)); // Lo creamos por adelantado para no perder la relación
                
                $stmtEscalar->execute([$motivo, $tokenJefe, $tokenCS, $idJustificacion, $idC]);
                $stmtHist->execute([$idC, 'ENVIADO_JEFATURA', $emailUsuario, 'Caso escalado a Jefatura pendiente de respuesta.']);

                $btnHtml = "<div style='text-align: center; margin-top: 10px;'>
                                <a href='https://$dominioLocal/resolver_caso_cc.php?token=$tokenJefe&actor=" . urlencode($emailDestino) . "' style='display: block; width: 100%; background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 0; border-radius: 6px; font-weight: bold; font-size: 14px;'>Resolver Caso</a>
                            </div>";
                $etiquetaHtml = "<span style='font-size: 11px; background-color: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: bold;'>⚠️ REQUIERE ACCIÓN</span>";
                $motivoParaCorreo = $motivo;
                $colorBorde = '#ef4444';
            }

            // Construir tarjeta HTML unificada
            $htmlBody .= "
                <li style='background-color: #ffffff; padding: 20px; margin-bottom: 15px; border-left: 5px solid $colorBorde; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;'>
                    <div style='display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px;'>
                        <div>
                            <strong style='color: #0f172a; font-size: 16px;'>Contrato: {$r['NumeroContrato']}</strong> $etiquetaHtml<br>
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
                    <div style='background-color: #f8fafc; color: #334155; padding: 12px 15px; border-radius: 6px; font-size: 13px; border: 1px solid #e2e8f0; margin-bottom: 15px;'>
                        <b style='display: block; margin-bottom: 5px;'>Justificación del Agente Rentista:</b>
                        $motivoParaCorreo
                    </div>
                    $btnHtml
                </li>";
        } // Fin del foreach de casos individuales

        // Armar y enviar el correo para ESTE jefe
        $bodyFinal = "
        <div style='font-family: Arial, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;'>
            <div style='background-color: #4f46e5; color: #ffffff; padding: 25px 20px; text-align: center;'>
                <h2 style='margin: 0; font-size: 22px; font-weight: bold;'>Resolución y Novedades TSD</h2>
                <p style='margin: 5px 0 0 0; font-size: 13px; opacity: 0.9;'>Integración Regional de Ingresos (IRI)</p>
            </div>
            <div style='padding: 30px 20px; background-color: #ffffff;'>
                <p>Estimada Jefatura <b>({$grupo['nombreJefe']})</b>,</p>
                <p>El usuario <b>$nombreReal</b> ha reportado las siguientes inconsistencias en su sucursal. Por favor, revise el estado de cada una.</p>
                <ul style='list-style-type: none; padding: 0; margin: 20px 0;'>
                    $htmlBody
                </ul>
            </div>
        </div>";

        if (class_exists('Mailer')) {
            Mailer::send($emailDestino, "Reporte de Cajas TSD: Novedades enviadas por $nombreReal", $bodyFinal);
        }
    } // Fin del foreach de Jefes


    $pdo->commit();
    echo json_encode(['success' => true]);

} catch (Throwable $e) { 
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => 'Error de BD/PHP: ' . $e->getMessage(), 'line' => $e->getLine()]);
}
?>