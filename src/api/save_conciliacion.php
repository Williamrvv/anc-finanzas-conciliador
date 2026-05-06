<?php
// BLINDAJE CONTRA HTML SUCIO
ini_set('display_errors', 0);
error_reporting(E_ALL);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data || empty($data['transacciones'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Payload vacío o JSON inválido: ' . json_last_error_msg()]);
    exit;
}

$transacciones = $data['transacciones'];
$fechaCierre = $data['fecha_cierre'] ?? date('Y-m-d');
$usuario = $_SESSION['user']['username'] ?? ($_SESSION['user']['email'] ?? 'Sistema');
$totalConciliado = floatval($data['total_conciliado'] ?? 0);

$bancosUnicos = array_unique(array_column($transacciones, 'Banco'));
$stringBancos = implode(', ', $bancosUnicos);

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // 1. Calcular totales reales agrupados por Banco en el Servidor
    $totalesPorBanco = [];
    foreach ($transacciones as $t) {
        $b = $t['Banco'] ?? 'DESC';
        if (!isset($totalesPorBanco[$b])) $totalesPorBanco[$b] = 0;
        if (($t['Origen'] ?? '') === 'DETALLADO' && ($t['Estado'] ?? '') === 'CONCILIADO') {
            $totalesPorBanco[$b] += floatval($t['MontoNeto'] ?? 0);
        }
    }

    // 2. Generar un Folio (IdCierre) independiente para cada banco
    $cierresIds = [];
    $stmtCierre = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Cierres (FechaCierre, Usuario, Banco, TotalConciliado) VALUES (?, ?, ?, ?)");
    foreach ($bancosUnicos as $banco) {
        $stmtCierre->execute([$fechaCierre, $usuario, $banco, $totalesPorBanco[$banco] ?? 0]);
        $cierresIds[$banco] = $pdo->lastInsertId();
    }

    $stmtCheck = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE HashUnico = ?");
    $stmtUpdate = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Estado = ?, IdMatch = ?, IdCierre = ISNULL(IdCierre, ?), Tarjeta = ISNULL(Tarjeta, ?) WHERE IdTransaccion = ?");
    
    $stmtInsert = $pdo->prepare("INSERT INTO Tbl_Transacciones_Maestra 
        (IdTransaccion, IdCierre, Banco, Origen, Estado, IdMatch, FechaTransaccion, Afiliado_MerID, Autorizacion, Tarjeta, MontoBruto, MontoNeto, ArchivoOrigen, HashUnico)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $stmtBAC = $pdo->prepare("INSERT INTO Tbl_Detalle_BAC (IdTransaccion, IdCierre, NUMERO_AFILIADO, NOMBRECOMERCIO, FECHA_TRANSACCION, FECHA_CIERRE_DATAFONO, FECHA_PAGO, NUMERO_DE_TARJETA, AUTORIZACION, TERMINAL, MONTO_VENTA, COMISION, RETENCION_VENTAS, RETENCION_RENTA, MONTONETO, NUMERO_LIQUIDACION, NUMERO_CUENTA, TIPO_CAMBIO, AJUSTE_COMISION_INTERNACIONAL, TIPO_TARJETA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    // TABLA SCOTIA - EXACTAMENTE 26 COLUMNAS AHORA (Con IdCierre)
    $stmtScotia = $pdo->prepare("INSERT INTO Tbl_Detalle_Scotia (IdTransaccion, IdCierre, Fuente, Fecha_Pago, Moneda, Transaccion, Razon_Social, MerID, Nombre, Fecha_Lote_Ajuste, Numero_Lote_Ajuste, Terminal, Numero_Pago, Numero_Autorizacion, Numero_Tarjeta, Monto_Orig, Monto_Bruto, Monto_Comision_Total, Porc_Comision_Total, Monto_Comision_Int, Porc_Comision_Int, Monto_Retencion_IVA, Porc_Retencion_IVA, Monto_Retencion_ISR, Monto_Neto, Estatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmtPagadoBAC = $pdo->prepare("INSERT INTO Tbl_Pagado_BAC (IdTransaccion, IdCierre, Fecha, Referencia, Codigo, Descripcion, Debitos, Creditos, Balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtPagadoScotia = $pdo->prepare("INSERT INTO Tbl_Pagado_Scotia (IdTransaccion, IdCierre, Numero_Referencia, Fecha_Movimiento, Descripcion, Monto, Saldo, Credito_Debito) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtAjuste = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion, EvidenciaB64) VALUES (?, ?, ?, ?)");

    $filasAfectadas = 0;
    $hashesProcesados = []; // NUEVO: Rastreador de auditoría 

    foreach ($transacciones as $t) {
        $idTrans = $t['IdTransaccion'] ?? 'SIN_ID';
        $bancoT = $t['Banco'] ?? 'DESC';
        $idCierre = $cierresIds[$bancoT] ?? null; // ASIGNACIÓN INTELIGENTE DEL FOLIO
        
        $fecha = (!empty($t['FechaTransaccion']) && $t['FechaTransaccion'] !== 'N/A') ? $t['FechaTransaccion'] : null;
        $bruto = floatval($t['MontoBruto'] ?? 0);
        $neto  = floatval($t['MontoNeto'] ?? 0);

        $hashStr = $t['HashString'] ?? "FALLBACK|" . uniqid();
        $hashUnico = ($t['Origen'] === 'AJUSTE') ? $idTrans : md5($hashStr);
        
        $hashesProcesados[] = $hashUnico; // Guardamos la huella para la auditoría final

        // Si JS nos dice que esto es un saldo que ya sacó de la BD, lo forzamos a UPDATE directo
        if (!empty($t['IsFromDB'])) {
            $stmtUpdate->execute([$t['Estado'] ?? 'PENDIENTE', $t['IdMatch'] ?? null, $idCierre, $t['Tarjeta'] ?? null, $idTrans]);
            $filasAfectadas++;
            continue; // Saltamos a la siguiente transacción
        }

        $stmtCheck->execute([$hashUnico]);
        $idExistente = $stmtCheck->fetchColumn();

        if ($idExistente) {
            // LÓGICA DE SEGURIDAD (ANTI-DUPLICADOS COLADOS DESDE EXCEL)
            if ($idExistente !== $idTrans && ($t['Origen'] ?? '') !== 'AJUSTE') {
                throw new \Exception("Bloqueo de Seguridad: Se intentó procesar un archivo con transacciones duplicadas (El Hash Criptográfico ya existe en BD).");
            } else {
                $stmtUpdate->execute([$t['Estado'] ?? 'PENDIENTE', $t['IdMatch'] ?? null, $idCierre, $t['Tarjeta'] ?? null, $idExistente]);
            }
        } else {
            $stmtInsert->execute([
                $idTrans, $idCierre, $t['Banco'] ?? 'DESC', $t['Origen'] ?? 'DESC', $t['Estado'] ?? 'PENDIENTE', $t['IdMatch'] ?? null, 
                $fecha, $t['Afiliado_MerID'] ?? null, $t['Autorizacion'] ?? null, $t['Tarjeta'] ?? null, $bruto, $neto, $t['ArchivoOrigen'] ?? 'Local', $hashUnico
            ]);

            if (($t['Banco'] ?? '') === 'BAC' && ($t['Origen'] ?? '') !== 'PAGADO') {
                $b = $t['RawBAC'] ?? [];
                $stmtBAC->execute([
                    $idTrans, $idCierre, $b['NUMERO_AFILIADO'] ?? null, $b['NOMBRECOMERCIO'] ?? null, $b['FECHA_TRANSACCION'] ?? null,
                    $b['FECHA_CIERRE_DATAFONO'] ?? null, $b['FECHA_PAGO'] ?? null, $b['NUMERO_DE_TARJETA'] ?? null, $b['AUTORIZACION'] ?? null,
                    $b['TERMINAL'] ?? null, $b['MONTO_VENTA'] ?? 0, $b['COMISION'] ?? 0, $b['RETENCION_VENTAS'] ?? 0,
                    $b['RETENCION_RENTA'] ?? 0, $b['MONTONETO'] ?? 0, $b['NUMERO_LIQUIDACION'] ?? null, $b['NUMERO_CUENTA'] ?? null,
                    $b['TIPO_CAMBIO'] ?? 0, $b['AJUSTE_COMISION_INTERNACIONAL'] ?? 0, $b['TIPO_TARJETA'] ?? null
                ]);
            } 
            else if (($t['Banco'] ?? '') === 'SCOTIA' && ($t['Origen'] ?? '') !== 'PAGADO') {
                $s = $t['RawScotia'] ?? [];
                // EXACTAMENTE 26 PARÁMETROS EN EL EXECUTE AHORA
                $stmtScotia->execute([
                    $idTrans, $idCierre, $s['Fuente'] ?? null, $s['Fecha_Pago'] ?? null, $s['Moneda'] ?? null, $s['Transaccion'] ?? null,
                    $s['Razon_Social'] ?? null, $s['MerID'] ?? null, $s['Nombre'] ?? null,
                    $s['Fecha_Lote_Ajuste'] ?? null, $s['Numero_Lote_Ajuste'] ?? null, $s['Terminal'] ?? null, $s['Numero_Pago'] ?? null,
                    $s['Numero_Autorizacion'] ?? null, $s['Numero_Tarjeta'] ?? null, $s['Monto_Orig'] ?? 0, $s['Monto_Bruto'] ?? 0,
                    $s['Monto_Comision_Total'] ?? 0, $s['Porc_Comision_Total'] ?? 0, $s['Monto_Comision_Int'] ?? 0, $s['Porc_Comision_Int'] ?? 0,
                    $s['Monto_Retencion_IVA'] ?? 0, $s['Porc_Retencion_IVA'] ?? 0, $s['Monto_Retencion_ISR'] ?? 0, $s['Monto_Neto'] ?? 0, $s['Estatus'] ?? null
                ]);
            }
            else if (($t['Banco'] ?? '') === 'BAC' && ($t['Origen'] ?? '') === 'PAGADO') {
                $p = $t['RawPagadoBAC'] ?? [];
                $stmtPagadoBAC->execute([$idTrans, $idCierre, $p['Fecha'] ?? null, $p['Referencia'] ?? null, $p['Codigo'] ?? null, $p['Descripcion'] ?? null, $p['Debitos'] ?? 0, $p['Creditos'] ?? 0, $p['Balance'] ?? 0]);
            }
            else if (($t['Banco'] ?? '') === 'SCOTIA' && ($t['Origen'] ?? '') === 'PAGADO') {
                $p = $t['RawPagadoScotia'] ?? [];
                $stmtPagadoScotia->execute([$idTrans, $idCierre, $p['Numero_Referencia'] ?? null, $p['Fecha_Movimiento'] ?? null, $p['Descripcion'] ?? null, $p['Monto'] ?? 0, $p['Saldo'] ?? 0, $p['Credito_Debito'] ?? null]);
            }

            if (($t['Origen'] ?? '') === 'AJUSTE') {
                $stmtAjuste->execute([$idTrans, $t['TipoAjuste'] ?? '', $t['Justificacion'] ?? '', $t['EvidenciaB64'] ?? '']);
            }
        }
        $filasAfectadas++;
    }

    // =========================================================================
    // AUDITORÍA DE INTEGRIDAD POST-INSERCIÓN (Double-Check)
    // =========================================================================
    // Eliminamos duplicados teóricos del payload para saber cuántos hashes únicos DEBEN existir
    $hashesUnicosPayload = array_unique($hashesProcesados);
    $totalEsperado = count($hashesUnicosPayload);
    $totalVerificados = 0;

    // Dividimos en bloques de 1000 para no reventar el límite de parámetros de SQL Server (2100)
    $chunks = array_chunk($hashesUnicosPayload, 1000);
    foreach ($chunks as $chunk) {
        $inQuery = implode(',', array_fill(0, count($chunk), '?'));
        $stmtVerify = $pdo->prepare("SELECT COUNT(DISTINCT HashUnico) FROM Tbl_Transacciones_Maestra WHERE HashUnico IN ($inQuery)");
        $stmtVerify->execute($chunk);
        $totalVerificados += (int)$stmtVerify->fetchColumn();
    }

    if ($totalVerificados < $totalEsperado) {
        // Si falta un solo registro en el disco duro, abortamos TODO.
        throw new \Exception("Auditoría de Integridad Fallida: Se procesaron {$totalEsperado} transacciones únicas, pero solo se verificaron {$totalVerificados} en la Base de Datos. Se aplicó ROLLBACK de seguridad.");
    }
    // =========================================================================

    $pdo->commit(); // Si llega aquí, es 100% seguro guardarlo en disco
    
    // Convertimos los cierres generados en un string visual (Ej: "BAC: 15, SCOTIA: 16")
    $stringCierres = [];
    foreach ($cierresIds as $b => $id) { $stringCierres[] = "$b: #$id"; }
    $textoVisualCierres = implode(' | ', $stringCierres);

    echo json_encode(['success' => true, 'filas_insertadas' => $filasAfectadas, 'id_cierre' => $textoVisualCierres]);

} catch (\Throwable $e) { 
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error Crítico del Servidor: ' . $e->getMessage()]);
}
?>