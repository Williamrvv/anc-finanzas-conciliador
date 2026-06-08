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

// Configuración de Fechas
$fechaAyerSQL = date('Y-m-d', strtotime('-1 day'));
$fechaAyerFmt = date('d/m/Y', strtotime('-1 day'));
$fecha7DiasSQL = date('Y-m-d', strtotime('-7 days'));
$fecha7DiasFmt = date('d/m/Y', strtotime('-7 days'));

// --- MODO DE PRUEBA (DESCOMENTAR PARA PROBAR CON LA FECHA DE HOY) ---
// $fechaAyerSQL = date('Y-m-d'); 
// $fechaAyerFmt = date('d/m/Y');
// $fecha7DiasSQL = date('Y-m-d', strtotime('-6 days'));
// $fecha7DiasFmt = date('d/m/Y', strtotime('-6 days'));
// --------------------------------------------------------------------

echo "Iniciando Cron Job de Coordinadores...\n";

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

    // 2. PREPARAR CONSULTAS BASE ULTRA-OPTIMIZADAS (Se preparan 1 vez, se ejecutan N veces)
    
    // A) Resumen Diario (Ayer) - Cuenta el Detalle Real para exactitud 100%
    $stmtDiario = $pdo->prepare("
        SELECT 
            H.IdCierre, 
            H.Sucursal, 
            CONVERT(varchar(5), MAX(H.FechaCierre), 108) AS HoraCierre,
            COUNT(D.IdDetalle) AS TotalTx,
            ISNULL(SUM(D.MontoCRC), 0) AS MontoTotalCRC,
            COUNT(DISTINCT CASE WHEN C.IdCaso IS NOT NULL AND C.Estado != 'CERRADO' THEN C.IdCaso END) AS CantidadErrores,
            ISNULL(SUM(CASE WHEN C.IdCaso IS NOT NULL AND C.Estado != 'CERRADO' THEN D.MontoCRC ELSE 0 END), 0) AS ImpactoCRC,
            ISNULL(RTRIM(MAX(U.Nombre) + ' ' + ISNULL(MAX(U.Apellidos), '')), MAX(H.EmailUsuario)) AS Agente
        FROM Tbl_CierreCaja_Header H
        INNER JOIN Tbl_CierreCaja_Detalle D ON H.IdCierre = D.IdCierre
        LEFT JOIN Tbl_Casos_TSD C ON D.Numero_Contrato = C.NumeroContrato AND C.IdCierreOrigen = H.IdCierre
        LEFT JOIN Tbl_Usuarios U ON H.EmailUsuario = U.Email
        WHERE CAST(H.FechaCierre AS DATE) = ?
          AND EXISTS (
              SELECT 1 FROM Tbl_Usuario_Sucursales_cc CO 
              WHERE CO.EmailUsuario = ? AND CO.Activo = 1 AND H.Sucursal LIKE '%' + CO.CodigoSucursal + '%'
          )
        GROUP BY H.IdCierre, H.Sucursal
        ORDER BY Agente ASC, MAX(H.FechaCierre) DESC
    ");

    // B) Resumen Semanal (Últimos 7 días) - Agrupado por Agente y Sucursal
    $stmtSemanal = $pdo->prepare("
        SELECT 
            H.Sucursal, 
            ISNULL(RTRIM(MAX(U.Nombre) + ' ' + ISNULL(MAX(U.Apellidos), '')), MAX(H.EmailUsuario)) AS Agente,
            COUNT(DISTINCT H.IdCierre) AS TotalLotes,
            COUNT(D.IdDetalle) AS TotalTx,
            ISNULL(SUM(D.MontoCRC), 0) AS MontoTotalCRC,
            SUM(CASE WHEN C.IdCaso IS NOT NULL AND C.Estado != 'CERRADO' THEN 1 ELSE 0 END) AS CantidadErrores,
            ISNULL(SUM(CASE WHEN C.IdCaso IS NOT NULL AND C.Estado != 'CERRADO' THEN D.MontoCRC ELSE 0 END), 0) AS ImpactoCRC
        FROM Tbl_CierreCaja_Header H
        INNER JOIN Tbl_CierreCaja_Detalle D ON H.IdCierre = D.IdCierre
        LEFT JOIN Tbl_Casos_TSD C ON D.Numero_Contrato = C.NumeroContrato AND C.IdCierreOrigen = H.IdCierre
        LEFT JOIN Tbl_Usuarios U ON H.EmailUsuario = U.Email
        WHERE CAST(H.FechaCierre AS DATE) BETWEEN ? AND ?
          AND EXISTS (
              SELECT 1 FROM Tbl_Usuario_Sucursales_cc CO 
              WHERE CO.EmailUsuario = ? AND CO.Activo = 1 AND H.Sucursal LIKE '%' + CO.CodigoSucursal + '%'
          )
        GROUP BY H.Sucursal, H.EmailUsuario
        ORDER BY Agente ASC, H.Sucursal ASC
    ");

    // C) Detalle de Inconsistencias (Ayer)
    $stmtCasos = $pdo->prepare("
        SELECT 
            C.IdCaso, C.Sucursal_Relacionada, C.NumeroContrato, C.NombreCliente, C.MontoCRC, C.Estado, C.MotivoAgente,
            ISNULL(SUM(D.MontoUSD), 0) AS MontoUSD,
            J.TextoVisor, 
            ISNULL(RTRIM(MAX(U.Nombre) + ' ' + ISNULL(MAX(U.Apellidos), '')), MAX(C.EmailCreador)) AS AgenteCreador
        FROM Tbl_Casos_TSD C
        LEFT JOIN Tbl_Justificaciones_CC J ON C.IdJustificacion = J.IdJustificacion
        LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email
        LEFT JOIN Tbl_CierreCaja_Detalle D ON C.IdCierreOrigen = D.IdCierre AND C.NumeroContrato = D.Numero_Contrato
        WHERE CAST(C.FechaCreacion AS DATE) = ?
          AND EXISTS (
              SELECT 1 FROM Tbl_Usuario_Sucursales_cc CO 
              WHERE CO.EmailUsuario = ? AND CO.Activo = 1 AND C.Sucursal_Relacionada LIKE CO.CodigoSucursal + '%'
          )
        GROUP BY C.IdCaso, C.Sucursal_Relacionada, C.NumeroContrato, C.NombreCliente, C.MontoCRC, C.Estado, C.MotivoAgente, J.TextoVisor
        ORDER BY AgenteCreador ASC, C.Sucursal_Relacionada ASC, C.IdCaso DESC
    ");

    $dominioLocal = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $enviados = 0;

    // 3. ITERAR POR CADA COORDINADOR Y ARMAR SU REPORTE
    foreach ($coordinadores as $coord) {
        $emailCoord = $coord['Email'];
        $nombreCoord = $coord['NombreCompleto'];

        // Ejecutar las 3 consultas
        $stmtDiario->execute([$fechaAyerSQL, $emailCoord]);
        $cierresAyer = $stmtDiario->fetchAll(PDO::FETCH_ASSOC);
        
        $stmtSemanal->execute([$fecha7DiasSQL, $fechaAyerSQL, $emailCoord]);
        $cierresSemana = $stmtSemanal->fetchAll(PDO::FETCH_ASSOC);

        $stmtCasos->execute([$fechaAyerSQL, $emailCoord]);
        $casos = $stmtCasos->fetchAll(PDO::FETCH_ASSOC);

        if (empty($cierresAyer) && empty($casos)) {
            echo "-> Omitido $emailCoord (Sin actividad ayer).\n";
            continue;
        }

        // --- CONSTRUCCIÓN DEL REPORTE HTML MAESTRO ---
        $htmlBody = "
        <div style='font-family: \"Segoe UI\", Arial, sans-serif; max-width: 900px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
            <div style='background-color: #0f172a; color: #ffffff; padding: 25px 20px; text-align: center; border-bottom: 4px solid #4f46e5;'>
                <h2 style='margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;'>Reporte Zonal de Cierres de Caja</h2>
                <p style='margin: 5px 0 0 0; font-size: 13px; color: #94a3b8;'>Actividad consolidada del día: <b style='color: #ffffff;'>$fechaAyerFmt</b></p>
            </div>
            
            <div style='padding: 30px 20px; background-color: #ffffff;'>
                <p style='font-size: 15px; margin-top: 0;'>Estimado/a <b>$nombreCoord</b>,</p>
                <p style='font-size: 13px; color: #475569;'>A continuación se presenta el resumen automatizado de la actividad transaccional en las sucursales bajo su coordinación.</p>
                
                <!-- SECCIÓN 1: RESUMEN DIARIO -->
                <h3 style='color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;'>1. Resumen de Cierres (Ayer)</h3>";

        // Función Helper para dibujar las tablas de resumen (Para reciclar código)
        $dibujarTablaResumen = function($datos, $esSemanal = false) {
            $html = "<table style='width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; border: 1px solid #e2e8f0;'>
                        <thead>
                            <tr style='background-color: #f8fafc; color: #475569; text-align: left;'>
                                <th style='padding: 10px; border-bottom: 2px solid #cbd5e1; width: " . ($esSemanal ? "80px" : "60px") . ";'>" . ($esSemanal ? "Lotes" : "Folio") . "</th>
                                <th style='padding: 10px; border-bottom: 2px solid #cbd5e1;'>Agente a Cargo / Sucursal</th>
                                <th style='padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: center;'>Tx Totales</th>
                                <th style='padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;'>Monto Total (CRC)</th>
                                <th style='padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right; background-color: #fef2f2; color: #b91c1c;'>Impacto Errores</th>
                            </tr>
                        </thead>
                        <tbody>";
            
            $sumTxTotales = 0; $sumTxErrores = 0; $sumTotalCRC = 0; $sumImpactoCRC = 0;

            foreach ($datos as $c) {
                $txTotalesLote = intval($c['TotalTx']);
                $txErroresLote = intval($c['CantidadErrores']);
                $loteTotalCRC = floatval($c['MontoTotalCRC']);
                $impactoCRC = floatval($c['ImpactoCRC']);
                
                $sumTxTotales += $txTotalesLote;
                $sumTxErrores += $txErroresLote;
                $sumTotalCRC += $loteTotalCRC;
                $sumImpactoCRC += $impactoCRC;

                $pctError = ($loteTotalCRC > 0) ? ($impactoCRC / $loteTotalCRC) * 100 : 0;
                $colorImpacto = ($impactoCRC > 0) ? '#ef4444' : '#10b981'; 
                $textoImpacto = ($impactoCRC > 0) ? "₡" . number_format($impactoCRC, 2) : "Limpio";
                $pctHTML = ($impactoCRC > 0) ? "<br><span style='font-size: 10px; color: #991b1b;'>" . number_format($pctError, 1) . "% de merma</span>" : "";

                $identificador = $esSemanal ? "{$c['TotalLotes']} Cierres" : "#{$c['IdCierre']}";
                $horaCierre = $esSemanal ? "Últimos 7 días" : "Cierre: {$c['HoraCierre']}";

                $html .= "
                    <tr style='border-bottom: 1px solid #f1f5f9;'>
                        <td style='padding: 10px; font-weight: bold; color: #64748b;'>$identificador</td>
                        <td style='padding: 10px; color: #0f172a;'><b>{$c['Agente']}</b><br><span style='color:#64748b; font-size:10px;'>🏢 {$c['Sucursal']} ($horaCierre)</span></td>
                        <td style='padding: 10px; text-align: center; font-weight: bold;'>$txTotalesLote <span style='font-weight:normal; font-size:10px; color:#ef4444;'>(" . ($txErroresLote > 0 ? "-$txErroresLote" : "0") . ")</span></td>
                        <td style='padding: 10px; text-align: right; font-family: monospace; font-size: 13px;'>₡" . number_format($loteTotalCRC, 2) . "</td>
                        <td style='padding: 10px; text-align: right; font-family: monospace; font-size: 13px; font-weight: bold; color: $colorImpacto; background-color: #fffbfa;'>
                            $textoImpacto $pctHTML
                        </td>
                    </tr>";
            }
            
            $granPct = ($sumTotalCRC > 0) ? ($sumImpactoCRC / $sumTotalCRC) * 100 : 0;
            $html .= "</tbody>
                <tfoot style='background-color: #f1f5f9; font-weight: bold;'>
                    <tr>
                        <td colspan='2' style='padding: 12px 10px; text-align: right; border-top: 2px solid #cbd5e1; color: #334155; text-transform: uppercase; font-size: 11px;'>Totales del Periodo:</td>
                        <td style='padding: 12px 10px; text-align: center; border-top: 2px solid #cbd5e1; color: #0f172a; font-size: 14px;'>$sumTxTotales <span style='color: #ef4444; font-size: 10px;'>(" . ($sumTxErrores > 0 ? "-$sumTxErrores" : "0") . ")</span></td>
                        <td style='padding: 12px 10px; text-align: right; border-top: 2px solid #cbd5e1; color: #0f172a; font-family: monospace; font-size: 14px;'>₡" . number_format($sumTotalCRC, 2) . "</td>
                        <td style='padding: 12px 10px; text-align: right; border-top: 2px solid #cbd5e1; color: #b91c1c; font-family: monospace; font-size: 14px;'>₡" . number_format($sumImpactoCRC, 2) . "<br><span style='font-size: 10px;'>" . number_format($granPct, 1) . "% de merma</span></td>
                    </tr>
                </tfoot>
            </table>";
            return $html;
        };

        if (empty($cierresAyer)) {
            $htmlBody .= "<div style='background-color: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 13px; color: #64748b; text-align: center;'>No se registraron cierres de caja el día de ayer.</div>";
        } else {
            $htmlBody .= $dibujarTablaResumen($cierresAyer, false);
        }

        // SECCIÓN 2: RESUMEN SEMANAL
        $htmlBody .= "<h3 style='color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 40px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;'>2. Resumen Semanal ($fecha7DiasFmt al $fechaAyerFmt)</h3>";
        if (empty($cierresSemana)) {
            $htmlBody .= "<div style='background-color: #f1f5f9; padding: 15px; border-radius: 6px; font-size: 13px; color: #64748b; text-align: center;'>No hay datos para la última semana.</div>";
        } else {
            $htmlBody .= $dibujarTablaResumen($cierresSemana, true);
        }

        // SECCIÓN 3: INCONSISTENCIAS Y TRAMITES (AGRUPADAS POR USUARIO > SUCURSAL)
        $htmlBody .= "<h3 style='color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 40px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;'>3. Detalle de Inconsistencias (Ayer)</h3>";
        
        if (empty($casos)) {
            $htmlBody .= "
                <div style='background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 6px; text-align: center; color: #065f46;'>
                    <span style='font-size: 24px; display: block; margin-bottom: 5px;'>🎉</span>
                    <strong>Día Perfecto</strong><br>
                    <span style='font-size: 13px;'>No se reportaron inconsistencias ni tickets de error durante los cierres de ayer.</span>
                </div>";
        } else {
            $htmlBody .= "
                <table style='width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; border: 1px solid #e2e8f0;'>
                    <thead>
                        <tr style='background-color: #f8fafc; color: #475569; text-align: left;'>
                            <th style='padding: 12px 10px; border-bottom: 2px solid #cbd5e1; width: 110px;'>ID Ticket</th>
                            <th style='padding: 12px 10px; border-bottom: 2px solid #cbd5e1;'>Datos del Contrato</th>
                            <th style='padding: 12px 10px; border-bottom: 2px solid #cbd5e1; text-align: right;'>Afectación</th>
                            <th style='padding: 12px 10px; border-bottom: 2px solid #cbd5e1; width: 280px;'>Detalle del Trámite</th>
                        </tr>
                    </thead>
                    <tbody>";

            $currentAgente = "";
            $currentSucursal = "";

            foreach ($casos as $caso) {
                // Generar los Headers Agrupadores
                if ($currentAgente !== $caso['AgenteCreador']) {
                    $currentAgente = $caso['AgenteCreador'];
                    $htmlBody .= "<tr><td colspan='4' style='background-color: #e2e8f0; font-weight: 900; padding: 12px 10px; color: #0f172a; text-transform: uppercase; font-size: 13px; border-top: 2px solid #94a3b8;'>👤 Agente: {$currentAgente}</td></tr>";
                    $currentSucursal = ""; 
                }
                if ($currentSucursal !== $caso['Sucursal_Relacionada']) {
                    $currentSucursal = $caso['Sucursal_Relacionada'];
                    $htmlBody .= "<tr><td colspan='4' style='background-color: #f8fafc; font-weight: bold; padding: 8px 10px 8px 25px; color: #4f46e5; font-size: 11px; border-bottom: 1px solid #cbd5e1; text-transform: uppercase;'>🏢 Sucursal: {$currentSucursal}</td></tr>";
                }

                // Mapeo Oficial de Estados a la UI
                switch ($caso['Estado']) {
                    case 'NO_REPORTADO':
                        $estadoNombre = "EN BORRADOR";
                        $colorFondo = "#fef2f2"; $colorTexto = "#dc2626"; 
                        $tramiteVisual = "<span style='color:#dc2626; font-style:italic;'>El agente no justificó el error.</span>";
                        break;
                    case 'PENDIENTE_VISTO_BUENO':
                        $estadoNombre = "ESCALADO A JEFATURA";
                        $colorFondo = "#faf5ff"; $colorTexto = "#7e22ce"; 
                        $tramiteVisual = "<b>{$caso['TextoVisor']}</b><br><span style='color:#475569; font-style:italic;'>\"{$caso['MotivoAgente']}\"</span>";
                        break;
                    case 'PENDIENTE_RESOLUCION':
                        $estadoNombre = "ESCALADO A SC";
                        $colorFondo = "#fffbeb"; $colorTexto = "#d97706"; 
                        $tramiteVisual = "<b>En manos de SC</b><br><span style='color:#475569; font-style:italic;'>\"{$caso['MotivoAgente']}\"</span>";
                        break;
                    case 'RESUELTO':
                        $estadoNombre = "RESUELTO";
                        $colorFondo = "#eff6ff"; $colorTexto = "#2563eb"; 
                        $tramiteVisual = "<b>{$caso['TextoVisor']}</b><br><span style='color:#475569; font-style:italic;'>\"{$caso['MotivoAgente']}\"</span>";
                        break;
                    case 'CERRADO':
                        $estadoNombre = "CERRADO";
                        $colorFondo = "#ecfdf5"; $colorTexto = "#059669"; 
                        $tramiteVisual = "<b>{$caso['TextoVisor']}</b><br><span style='color:#475569; font-style:italic;'>\"{$caso['MotivoAgente']}\"</span>";
                        break;
                    default:
                        $estadoNombre = $caso['Estado'];
                        $colorFondo = "#f1f5f9"; $colorTexto = "#475569";
                        $tramiteVisual = $caso['MotivoAgente'];
                }

                $badgeEstado = "<div style='background-color: $colorFondo; color: $colorTexto; padding: 4px; border-radius: 4px; font-size: 9px; font-weight: bold; text-align: center; margin-top: 5px; border: 1px solid $colorTexto;'>$estadoNombre</div>";

                $htmlBody .= "
                        <tr style='border-bottom: 1px solid #e2e8f0;'>
                            <td style='padding: 12px 10px; vertical-align: top; padding-left: 25px;'>
                                <strong style='color: #0f172a; font-size: 13px;'>#{$caso['IdCaso']}</strong>
                                $badgeEstado
                            </td>
                            <td style='padding: 12px 10px; vertical-align: top;'>
                                <div style='color: #64748b; font-size: 9px; text-transform: uppercase;'>Contrato</div>
                                <strong style='color: #0f172a; font-size: 13px;'>{$caso['NumeroContrato']}</strong><br>
                                <div style='color: #64748b; font-size: 9px; text-transform: uppercase; margin-top: 6px;'>Cliente</div>
                                <span style='font-size: 11px; color: #475569;'>{$caso['NombreCliente']}</span>
                            </td>
                            <td style='padding: 12px 10px; vertical-align: top; text-align: right;'>
                                <div style='color: #64748b; font-size: 9px; text-transform: uppercase;'>Monto (CRC)</div>
                                <strong style='color: #ef4444; font-family: monospace; font-size: 13px; display: block;'>₡" . number_format($caso['MontoCRC'], 2) . "</strong>
                                <div style='color: #64748b; font-size: 9px; text-transform: uppercase; margin-top: 6px;'>Monto (USD)</div>
                                <span style='color: #10b981; font-family: monospace; font-size: 11px;'>$" . number_format($caso['MontoUSD'], 2) . "</span>
                            </td>
                            <td style='padding: 12px 10px; vertical-align: top; font-size: 11px; line-height: 1.4; color: #334155; background-color: #f8fafc;'>
                                <div style='color: #64748b; font-size: 9px; text-transform: uppercase; margin-bottom: 4px;'>Descripción</div>
                                $tramiteVisual
                            </td>
                        </tr>";
            }
            $htmlBody .= "</tbody></table>";
        }

        $htmlBody .= "
                <div style='text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0;'>
                    <a href='https://$dominioLocal/' style='background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;'>Ir al Panel de Auditoría en IRI</a>
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