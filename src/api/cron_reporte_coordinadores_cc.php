<?php
// Permite que el script corra sin límite de tiempo y muestra errores si se ejecuta desde consola
ini_set('display_errors', 1);
error_reporting(E_ALL);
set_time_limit(0); 

// Forzar zona horaria local
date_default_timezone_set('America/Costa_Rica');

require_once __DIR__ . '/../db.php';
if (file_exists(__DIR__ . '/../Mailer.php')) {
    require_once __DIR__ . '/../Mailer.php';
} else {
    die("Error: No se encuentra la clase Mailer.\n");
}

// Configuración de Fechas (Ayer)
$fechaAyerSQL = date('Y-m-d', strtotime('-1 day'));
$fechaAyerFmt = date('d/m/Y', strtotime('-1 day'));

// --- MODO DE PRUEBA (DESCOMENTAR PARA PROBAR CON LA FECHA DE HOY) ---
// $fechaAyerSQL = date('Y-m-d'); 
// $fechaAyerFmt = date('d/m/Y');
// --------------------------------------------------------------------

echo "Iniciando Cron Job de Coordinadores - Fecha a consultar: $fechaAyerFmt...\n";

try {
    $pdo = Database::connect();

    // 1. OBTENER A TODOS LOS COORDINADORES ACTIVOS
    $stmtCoords = $pdo->query("
        SELECT U.Email, RTRIM(U.Nombre + ' ' + ISNULL(U.Apellidos, '')) AS NombreCompleto 
        FROM Tbl_Usuarios U
        INNER JOIN Tbl_Roles R ON U.Id_Rol = R.Id_Rol
        WHERE R.Nombre_Rol = 'coordinador' AND U.Activo = 1
    ");
    $coordinadores = $stmtCoords->fetchAll(PDO::FETCH_ASSOC);

    if (empty($coordinadores)) {
        die("Proceso finalizado: No hay usuarios con el rol 'coordinador' activos en el sistema.\n");
    }

    // 2. PREPARAR CONSULTAS BASE (Filtradas por la Matriz Unificada de Sucursales)
    
    // A) Resumen de Cierres (Cabeceras)
    $stmtCierres = $pdo->prepare("
        SELECT 
            H.IdCierre, 
            H.Sucursal, 
            CONVERT(varchar(5), H.FechaCierre, 108) AS HoraCierre,
            H.TotalVerificadoCRC, 
            H.TotalVerificadoUSD, 
            H.TransaccionesEscaneadas,
            ISNULL(RTRIM(U.Nombre + ' ' + ISNULL(U.Apellidos, '')), H.EmailUsuario) AS Cajero
        FROM Tbl_CierreCaja_Header H
        LEFT JOIN Tbl_Usuarios U ON H.EmailUsuario = U.Email
        WHERE CAST(H.FechaCierre AS DATE) = ?
          AND EXISTS (
              SELECT 1 FROM Tbl_Usuario_Sucursales_cc CO 
              WHERE CO.EmailUsuario = ? AND CO.Activo = 1 AND H.Sucursal LIKE '%' + CO.CodigoSucursal + '%'
          )
        ORDER BY H.FechaCierre DESC
    ");

    // B) Detalle de Inconsistencias (Tickets) con MontoUSD cruzado
    $stmtCasos = $pdo->prepare("
        SELECT 
            C.IdCaso, C.Sucursal_Relacionada, C.NumeroContrato, C.NombreCliente, C.MontoCRC, C.Estado, C.MotivoAgente, C.ICD_Relacionado,
            ISNULL(D.MontoUSD, 0) AS MontoUSD,
            J.TextoVisor, J.TipoAccion,
            ISNULL(RTRIM(U.Nombre + ' ' + ISNULL(U.Apellidos, '')), C.EmailCreador) AS AgenteCreador
        FROM Tbl_Casos_TSD C
        LEFT JOIN Tbl_Justificaciones_CC J ON C.IdJustificacion = J.IdJustificacion
        LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email
        LEFT JOIN Tbl_CierreCaja_Detalle D ON C.IdCierreOrigen = D.IdCierre AND C.NumeroContrato = D.Numero_Contrato
        WHERE CAST(C.FechaCreacion AS DATE) = ?
          AND EXISTS (
              SELECT 1 FROM Tbl_Usuario_Sucursales_cc CO 
              WHERE CO.EmailUsuario = ? AND CO.Activo = 1 AND C.Sucursal_Relacionada LIKE CO.CodigoSucursal + '%'
          )
        ORDER BY C.Sucursal_Relacionada ASC, C.IdCaso DESC
    ");

    $dominioLocal = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $enviados = 0;

    // 3. ITERAR POR CADA COORDINADOR Y ARMAR SU REPORTE PERSONALIZADO
    foreach ($coordinadores as $coord) {
        $emailCoord = $coord['Email'];
        $nombreCoord = $coord['NombreCompleto'];

        $stmtCierres->execute([$fechaAyerSQL, $emailCoord]);
        $cierres = $stmtCierres->fetchAll(PDO::FETCH_ASSOC);
        
        $stmtCasos->execute([$fechaAyerSQL, $emailCoord]);
        $casos = $stmtCasos->fetchAll(PDO::FETCH_ASSOC);

        // Si no hubo cierres ni errores en su zona, no le enviamos spam
        if (empty($cierres) && empty($casos)) {
            echo "-> Omitido $emailCoord (Sin actividad en su zona).\n";
            continue;
        }

        // --- CONSTRUCCIÓN DEL REPORTE HTML MAESTRO ---
        $htmlBody = "
        <div style='font-family: Arial, sans-serif; max-width: 750px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #334155;'>
            <div style='background-color: #0f172a; color: #ffffff; padding: 25px 20px; text-align: center; border-bottom: 4px solid #3b82f6;'>
                <h2 style='margin: 0; font-size: 22px; font-weight: 900;'>Reporte Ejecutivo de Cierres de Caja</h2>
                <p style='margin: 5px 0 0 0; font-size: 14px; color: #94a3b8;'>Actividad del día: <b>$fechaAyerFmt</b></p>
            </div>
            
            <div style='padding: 30px 20px; background-color: #ffffff;'>
                <p style='font-size: 15px;'>Estimado/a <b>$nombreCoord</b>,</p>
                <p style='font-size: 14px; color: #475569;'>A continuación se presenta el resumen automatizado de la actividad transaccional en las sucursales bajo su coordinación correspondiente al día de ayer.</p>
                
                <!-- SECCIÓN 1: CIERRES OFICIALES -->
                <h3 style='color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; font-size: 16px;'>1. Resumen de Cierres Consolidados</h3>";

        if (empty($cierres)) {
            $htmlBody .= "<div style='background-color: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 13px; color: #64748b; text-align: center;'>No se registraron cierres de caja en su zona.</div>";
        } else {
            $htmlBody .= "
                <table style='width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;'>
                    <thead>
                        <tr style='background-color: #f8fafc; color: #475569; text-align: left;'>
                            <th style='padding: 10px; border-bottom: 2px solid #cbd5e1;'>ID</th>
                            <th style='padding: 10px; border-bottom: 2px solid #cbd5e1;'>Sucursales</th>
                            <th style='padding: 10px; border-bottom: 2px solid #cbd5e1;'>Realizado por</th>
                            <th style='padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center;'>Tx</th>
                            <th style='padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;'>Monto CRC</th>
                            <th style='padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;'>Monto USD</th>
                        </tr>
                    </thead>
                    <tbody>";
            foreach ($cierres as $c) {
                $htmlBody .= "
                        <tr style='border-bottom: 1px solid #f1f5f9;'>
                            <td style='padding: 10px; font-weight: bold; color: #64748b;'>#{$c['IdCierre']}</td>
                            <td style='padding: 10px; color: #0f172a; font-weight: bold;'>{$c['Sucursal']}</td>
                            <td style='padding: 10px;'>{$c['Cajero']} <span style='color:#94a3b8; font-size:10px;'>({$c['HoraCierre']})</span></td>
                            <td style='padding: 10px; text-align: center; font-weight: bold;'>{$c['TransaccionesEscaneadas']}</td>
                            <td style='padding: 10px; text-align: right; color: #059669; font-family: monospace; font-size: 13px;'>₡" . number_format($c['TotalVerificadoCRC'], 2) . "</td>
                            <td style='padding: 10px; text-align: right; color: #059669; font-family: monospace; font-size: 13px;'>$" . number_format($c['TotalVerificadoUSD'], 2) . "</td>
                        </tr>";
            }
            $htmlBody .= "</tbody></table>";
        }

        // SECCIÓN 2: INCONSISTENCIAS Y TRAMITES
        $htmlBody .= "<h3 style='color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 40px; font-size: 16px;'>2. Detalle de Inconsistencias y Trámites</h3>";
        
        if (empty($casos)) {
            $htmlBody .= "
                <div style='background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 6px; text-align: center; color: #065f46;'>
                    <strong>✅ Excelente</strong><br>
                    <span style='font-size: 13px;'>No se reportaron inconsistencias (Tickets) durante los cierres de ayer.</span>
                </div>";
        } else {
            foreach ($casos as $caso) {
                // Lógica de colores según el Estado
                $colorBorde = '#94a3b8'; // Gris por defecto (Borrador)
                $badgeHTML = "";

                if ($caso['Estado'] === 'NO_REPORTADO') {
                    $colorBorde = '#f59e0b'; // Ambar
                    $badgeHTML = "<span style='background-color: #fef3c7; color: #b45309; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;'>EN BORRADOR (Pendiente de enviar por Agente)</span>";
                    $tramiteVisual = "<i>El agente aún no ha justificado este caso. Se encuentra en su bandeja.</i>";
                } elseif ($caso['Estado'] === 'PENDIENTE_VISTO_BUENO') {
                    $colorBorde = '#8b5cf6'; // Morado
                    $badgeHTML = "<span style='background-color: #f3e8ff; color: #6d28d9; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;'>ESCALADO A JEFATURA</span>";
                    $tramiteVisual = "<b>Trámite:</b> {$caso['TextoVisor']}<br><b>Justificación del Agente:</b> \"{$caso['MotivoAgente']}\"";
                } elseif ($caso['Estado'] === 'PENDIENTE_RESOLUCION') {
                    $colorBorde = '#3b82f6'; // Azul
                    $badgeHTML = "<span style='background-color: #dbeafe; color: #1d4ed8; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;'>EN SERVICIO AL CLIENTE</span>";
                    $tramiteVisual = "<b>Trámite:</b> Aprobado por Jefatura -> Esperando corrección en TSD.<br><b>Nota original:</b> \"{$caso['MotivoAgente']}\"";
                } else {
                    $colorBorde = '#10b981'; // Verde (Resuelto/Cerrado)
                    $badgeHTML = "<span style='background-color: #d1fae5; color: #047857; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;'>" . str_replace('_', ' ', $caso['Estado']) . "</span>";
                    $tramiteVisual = "<b>Trámite Finalizado:</b> {$caso['TextoVisor']}<br><b>Nota:</b> \"{$caso['MotivoAgente']}\"";
                }

                $htmlBody .= "
                <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid $colorBorde; border-radius: 6px; padding: 15px; margin-bottom: 15px;'>
                    
                    <div style='display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;'>
                        <div>
                            <span style='font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: bold;'>Contrato</span><br>
                            <span style='font-size: 16px; font-weight: 900; color: #0f172a;'>{$caso['NumeroContrato']}</span>
                        </div>
                        <div style='text-align: right;'>
                            $badgeHTML<br>
                            <span style='font-size: 11px; color: #64748b; font-weight: bold; display: inline-block; margin-top: 5px;'>TICKET #{$caso['IdCaso']}</span>
                        </div>
                    </div>

                    <div style='display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px;'>
                        <div style='width: 60%;'>
                            <b>Cliente:</b> {$caso['NombreCliente']}<br>
                            <b>Sucursal:</b> <span style='color: #4f46e5; font-weight: bold;'>{$caso['Sucursal_Relacionada']}</span><br>
                            <b>Detectado por:</b> {$caso['AgenteCreador']}
                        </div>
                        <div style='width: 35%; text-align: right;'>
                            <span style='display: block; color: #ef4444; font-family: monospace; font-size: 14px; font-weight: bold;'>₡" . number_format($caso['MontoCRC'], 2) . "</span>
                            <span style='display: block; color: #10b981; font-family: monospace; font-size: 13px; font-weight: bold;'>$" . number_format($caso['MontoUSD'], 2) . "</span>
                        </div>
                    </div>

                    <div style='background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px dashed #cbd5e1; font-size: 12px; color: #334155; line-height: 1.4;'>
                        $tramiteVisual
                    </div>

                </div>";
            }
        }

        $htmlBody .= "
                <div style='text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;'>
                    <a href='https://$dominioLocal/' style='background-color: #0f172a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;'>Ir al Dashboard de IRI</a>
                </div>
            </div>
        </div>";

        // ENVIAR CORREO
        Mailer::send($emailCoord, "Reporte Zonal de Cajas IRI - $fechaAyerFmt", $htmlBody);
        echo "-> Reporte enviado exitosamente a: $emailCoord\n";
        $enviados++;
    }

    echo "Cron Job Finalizado. Total de reportes enviados: $enviados\n";

} catch (Throwable $e) { 
    echo "ERROR FATAL: " . $e->getMessage() . " en la linea " . $e->getLine() . "\n"; 
}
?>