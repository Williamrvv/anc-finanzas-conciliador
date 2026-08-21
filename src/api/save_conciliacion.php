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
$usuario = $_SESSION['user']['username'] ?? ($_SESSION['user']['email'] ?? 'Sistema');
$totalConciliado = floatval($data['total_conciliado'] ?? 0);

$bancosUnicos = array_unique(array_column($transacciones, 'Banco'));
$stringBancos = implode(', ', $bancosUnicos);

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // =========================================================================
    // DICCIONARIO MAESTRO: AFILIADO -> CENTRO DE COSTO
    // =========================================================================
    // Consultamos la nueva tabla maestra directamente desde SQL Server
    $mapaCentroCosto = [];
    $stmtDiccionario = $pdo->query("SELECT Afiliado, CentroCosto FROM Tbl_Diccionario_Afiliados");
    while ($rowDict = $stmtDiccionario->fetch(PDO::FETCH_ASSOC)) {
        // Almacenamos '123456789' => '01-06-18'
        $mapaCentroCosto[trim(strtoupper($rowDict['Afiliado']))] = trim($rowDict['CentroCosto']);
    }

    // 1. Calcular totales reales agrupados por Banco en el Servidor
    $totalesPorBanco = [];
    foreach ($transacciones as $t) {
        $b = $t['Banco'] ?? 'DESC';
        if (!isset($totalesPorBanco[$b])) $totalesPorBanco[$b] = 0;
        if (($t['Origen'] ?? '') === 'DETALLADO' && ($t['Estado'] ?? '') === 'CONCILIADO') {
            $totalesPorBanco[$b] += floatval($t['MontoNeto'] ?? 0);
        }
    }

    // 2. Generar un Folio (IdCierre) independiente para cada banco/fuente
    $cierresIds = [];
    $stmtCierre = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Cierres (Usuario, Fuente, TotalConciliado) VALUES (?, ?, ?)");
    foreach ($bancosUnicos as $banco) {
        // Traducción para la Base de Datos
        $nombreDB = ($banco === 'SCOTIA') ? 'DAVIBANK' : $banco;
        $stmtCierre->execute([$usuario, $nombreDB, $totalesPorBanco[$banco] ?? 0]);
        $cierresIds[$banco] = $pdo->lastInsertId(); // JS necesita que la llave siga siendo SCOTIA
    }

    // FECHA DE REGISTRO elegida por el usuario. Se usa mientras dura la carga
    // de datos históricos: indica a qué fecha corresponde el dato, no cuándo se
    // subió. Si no viene o es inválida se usa hoy; nunca se admite futuro.
    $fechaRegistro = trim($input['fechaRegistro'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaRegistro) || $fechaRegistro > date('Y-m-d')) {
        $fechaRegistro = date('Y-m-d H:i:s');
    } else {
        $fechaRegistro .= ' ' . date('H:i:s');   // conserva la hora real de carga
    }

    $stmtCheck = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE HashUnico = ?");
    $stmtUpdate = $pdo->prepare("
    UPDATE Tbl_Transacciones_Maestra
        SET Estado = ?,
            IdMatch = ?,
            IdCierre = ISNULL(IdCierre, ?),
            Tarjeta = ISNULL(Tarjeta, ?)
        WHERE IdTransaccion = ?
    ");
    
    $stmtInsert = $pdo->prepare("INSERT INTO Tbl_Transacciones_Maestra
        (IdTransaccion, IdCierre, Banco, Origen, Estado, IdMatch, FechaTransaccion, Afiliado_MerID, Autorizacion, Tarjeta, MontoBruto, MontoNeto, ArchivoOrigen, HashUnico, FechaRegistro)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $stmtBAC = $pdo->prepare("INSERT INTO Tbl_Detalle_BAC (IdTransaccion, IdCierre, NUMERO_AFILIADO, NOMBRECOMERCIO, FECHA_TRANSACCION, FECHA_CIERRE_DATAFONO, FECHA_PAGO, NUMERO_DE_TARJETA, AUTORIZACION, TERMINAL, MONTO_VENTA, COMISION, RETENCION_VENTAS, RETENCION_RENTA, MONTONETO, NUMERO_LIQUIDACION, NUMERO_CUENTA, TIPO_CAMBIO, AJUSTE_COMISION_INTERNACIONAL, TIPO_TARJETA, CentroCosto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    // TABLA SCOTIA - EXACTAMENTE 27 COLUMNAS AHORA (Con IdCierre y CentroCosto)
    $stmtScotia = $pdo->prepare("INSERT INTO Tbl_Detalle_Scotia (IdTransaccion, IdCierre, Fuente, Fecha_Pago, Moneda, Transaccion, Razon_Social, MerID, Nombre, Fecha_Lote_Ajuste, Numero_Lote_Ajuste, Terminal, Numero_Pago, Numero_Autorizacion, Numero_Tarjeta, Monto_Orig, Monto_Bruto, Monto_Comision_Total, Porc_Comision_Total, Monto_Comision_Int, Porc_Comision_Int, Monto_Retencion_IVA, Porc_Retencion_IVA, Monto_Retencion_ISR, Monto_Neto, Estatus, CentroCosto, Monto_Dolar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmtPagadoBAC = $pdo->prepare("INSERT INTO Tbl_Pagado_BAC (IdTransaccion, IdCierre, Fecha, Referencia, Codigo, Descripcion, Debitos, Creditos, Balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtPagadoScotia = $pdo->prepare("INSERT INTO Tbl_Pagado_Scotia (IdTransaccion, IdCierre, Numero_Referencia, Fecha_Movimiento, Descripcion, Monto, Saldo, Credito_Debito, Monto_Dolar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtAjuste = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion, EvidenciaB64) VALUES (?, ?, ?, ?)");

    $filasAfectadas = 0;
    $auditHashes = []; // Rastreador para transacciones nuevas
    $auditIds = [];    // Rastreador para transacciones históricas

    foreach ($transacciones as $t) {
        $idTrans = $t['IdTransaccion'] ?? 'SIN_ID';
        $bancoT = $t['Banco'] ?? 'DESC';
        $idCierre = $cierresIds[$bancoT] ?? null; 
        
        $fecha = (!empty($t['FechaTransaccion']) && $t['FechaTransaccion'] !== 'N/A') ? $t['FechaTransaccion'] : null;
        $bruto = floatval($t['MontoBruto'] ?? 0);
        $neto  = floatval($t['MontoNeto'] ?? 0);

        // CASO 1: SALDOS HISTÓRICOS
        if (!empty($t['IsFromDB'])) {
            $stmtUpdate->execute([
                $t['Estado'] ?? 'PENDIENTE',
                $t['IdMatch'] ?? null,
                $idCierre,
                $t['Tarjeta'] ?? null,
                $idTrans
            ]);
            $filasAfectadas++;
            $auditIds[] = $idTrans; // Las auditamos por Llave Primaria
            continue; 
        }

        // CASO 2: NUEVOS ARCHIVOS O AJUSTES MANUALES
        $hashStr = $t['HashString'] ?? "FALLBACK|" . uniqid();
        $hashUnico = ($t['Origen'] === 'AJUSTE') ? $idTrans : md5($hashStr);
        $auditHashes[] = $hashUnico; // Las auditamos por Huella Criptográfica

        $stmtCheck->execute([$hashUnico]);
        $idExistente = $stmtCheck->fetchColumn();

        if ($idExistente) {
            // IDEMPOTENCIA ABSOLUTA: Si el Excel trae transacciones que ya existen en la BD
            // (superposición de fechas o recarga accidental), NO explotamos el servidor.
            // Simplemente actualizamos su estado (Ej. de Pendiente a Conciliado), 
            // omitimos volver a insertar sus detalles, y continuamos con el resto.
            $stmtUpdate->execute([
                $t['Estado'] ?? 'PENDIENTE',
                $t['IdMatch'] ?? null,
                $idCierre,
                $t['Tarjeta'] ?? null,
                $idExistente
            ]);
        } else {
            // Traducción para la Base de Datos
            $bancoParaBD = (($t['Banco'] ?? '') === 'SCOTIA') ? 'DAVIBANK' : ($t['Banco'] ?? 'DESC');
            
            // =========================================================================
            // VALIDACIÓN IMPLACABLE DEL CENTRO DE COSTO DIRECTO DEL DICCIONARIO
            // (Aplica para Archivos Detallados y para Ajustes Manuales inyectados)
            // =========================================================================
            $centroCostoValidado = null;
            $esVenta = in_array(($t['Origen'] ?? ''), ['DETALLADO', 'AJUSTE']);
            
            if ($esVenta) {
                $afiliado = ($bancoParaBD === 'BAC') ? trim($t['RawBAC']['NUMERO_AFILIADO'] ?? '') : trim($t['RawScotia']['MerID'] ?? '');
                
                if (empty($afiliado)) {
                    throw new \Exception("Error de Integridad: Una transacción de Venta o Ajuste en {$bancoParaBD} no tiene número de Afiliado/MerID.");
                }

                $afiliadoUpper = strtoupper($afiliado);
                $centroCostoValidado = $mapaCentroCosto[$afiliadoUpper] ?? null;

                if (empty($centroCostoValidado)) {
                    // Marcador AFILIADO_SIN_CC: el frontend lo reconoce y muestra un
                    // aviso guiado en vez del error genérico de servidor.
                    throw new \Exception("AFILIADO_SIN_CC:{$afiliado}");
                }
            }
            // =========================================================================
            
            $stmtInsert->execute([
                $idTrans, $idCierre, $bancoParaBD, $t['Origen'] ?? 'DESC', $t['Estado'] ?? 'PENDIENTE', $t['IdMatch'] ?? null,
                $fecha, $t['Afiliado_MerID'] ?? null, $t['Autorizacion'] ?? null, $t['Tarjeta'] ?? null, $bruto, $neto, $t['ArchivoOrigen'] ?? 'Local', $hashUnico, $fechaRegistro
            ]);

            if (($t['Banco'] ?? '') === 'BAC' && ($t['Origen'] ?? '') !== 'PAGADO') {
                $b = $t['RawBAC'] ?? [];
                $stmtBAC->execute([
                    $idTrans, $idCierre, $b['NUMERO_AFILIADO'] ?? null, $b['NOMBRECOMERCIO'] ?? null, $b['FECHA_TRANSACCION'] ?? null,
                    $b['FECHA_CIERRE_DATAFONO'] ?? null, $b['FECHA_PAGO'] ?? null, $b['NUMERO_DE_TARJETA'] ?? null, $b['AUTORIZACION'] ?? null,
                    $b['TERMINAL'] ?? null, $b['MONTO_VENTA'] ?? 0, $b['COMISION'] ?? 0, $b['RETENCION_VENTAS'] ?? 0,
                    $b['RETENCION_RENTA'] ?? 0, $b['MONTONETO'] ?? 0, $b['NUMERO_LIQUIDACION'] ?? null, $b['NUMERO_CUENTA'] ?? null,
                    $b['TIPO_CAMBIO'] ?? 0, $b['AJUSTE_COMISION_INTERNACIONAL'] ?? 0, $b['TIPO_TARJETA'] ?? null, $centroCostoValidado
                ]);
            }
            else if (($t['Banco'] ?? '') === 'SCOTIA' && ($t['Origen'] ?? '') !== 'PAGADO') {
                $s = $t['RawScotia'] ?? [];
                // EXACTAMENTE 27 PARÁMETROS EN EL EXECUTE AHORA
                $stmtScotia->execute([
                    $idTrans, $idCierre, $s['Fuente'] ?? null, $s['Fecha_Pago'] ?? null, $s['Moneda'] ?? null, $s['Transaccion'] ?? null,
                    $s['Razon_Social'] ?? null, $s['MerID'] ?? null, $s['Nombre'] ?? null,
                    $s['Fecha_Lote_Ajuste'] ?? null, $s['Numero_Lote_Ajuste'] ?? null, $s['Terminal'] ?? null, $s['Numero_Pago'] ?? null,
                    $s['Numero_Autorizacion'] ?? null, $s['Numero_Tarjeta'] ?? null, $s['Monto_Orig'] ?? 0, $s['Monto_Bruto'] ?? 0,
                    $s['Monto_Comision_Total'] ?? 0, $s['Porc_Comision_Total'] ?? 0, $s['Monto_Comision_Int'] ?? 0, $s['Porc_Comision_Int'] ?? 0,
                    $s['Monto_Retencion_IVA'] ?? 0, $s['Porc_Retencion_IVA'] ?? 0, $s['Monto_Retencion_ISR'] ?? 0, $s['Monto_Neto'] ?? 0, $s['Estatus'] ?? null, $centroCostoValidado,
                    (isset($s['Monto_Dolar']) && $s['Monto_Dolar'] !== null && $s['Monto_Dolar'] !== '') ? $s['Monto_Dolar'] : null
                ]);
            }
            else if (($t['Banco'] ?? '') === 'BAC' && ($t['Origen'] ?? '') === 'PAGADO') {
                $p = $t['RawPagadoBAC'] ?? [];
                $stmtPagadoBAC->execute([$idTrans, $idCierre, $p['Fecha'] ?? null, $p['Referencia'] ?? null, $p['Codigo'] ?? null, $p['Descripcion'] ?? null, $p['Debitos'] ?? 0, $p['Creditos'] ?? 0, $p['Balance'] ?? 0]);
            }
            else if (($t['Banco'] ?? '') === 'SCOTIA' && ($t['Origen'] ?? '') === 'PAGADO') {
                $p = $t['RawPagadoScotia'] ?? [];
                $stmtPagadoScotia->execute([$idTrans, $idCierre, $p['Numero_Referencia'] ?? null, $p['Fecha_Movimiento'] ?? null, $p['Descripcion'] ?? null, $p['Monto'] ?? 0, $p['Saldo'] ?? 0, $p['Credito_Debito'] ?? null, (isset($p['Monto_Dolar']) && $p['Monto_Dolar'] !== null && $p['Monto_Dolar'] !== '') ? $p['Monto_Dolar'] : null]);
            }

            if (($t['Origen'] ?? '') === 'AJUSTE') {
                $stmtAjuste->execute([$idTrans, $t['TipoAjuste'] ?? '', $t['Justificacion'] ?? '', $t['EvidenciaB64'] ?? '']);
            }
        }
        $filasAfectadas++;
    }

    // =========================================================================
    // AUDITORÍA DE INTEGRIDAD POST-INSERCIÓN (Double-Check Bimodal)
    // =========================================================================
    $hashesUnicos = array_unique($auditHashes);
    $idsUnicos = array_unique($auditIds);
    
    $totalEsperado = count($hashesUnicos) + count($idsUnicos);
    $totalVerificados = 0;

    // 1. Verificar registros nuevos (Por Huella Criptográfica)
    if (count($hashesUnicos) > 0) {
        $chunks = array_chunk($hashesUnicos, 1000);
        foreach ($chunks as $chunk) {
            $inQuery = implode(',', array_fill(0, count($chunk), '?'));
            $stmtVerify = $pdo->prepare("SELECT COUNT(DISTINCT HashUnico) FROM Tbl_Transacciones_Maestra WHERE HashUnico IN ($inQuery)");
            $stmtVerify->execute($chunk);
            $totalVerificados += (int)$stmtVerify->fetchColumn();
        }
    }

    // 2. Verificar saldos históricos recuperados (Por Llave Primaria)
    if (count($idsUnicos) > 0) {
        $chunks = array_chunk($idsUnicos, 1000);
        foreach ($chunks as $chunk) {
            $inQuery = implode(',', array_fill(0, count($chunk), '?'));
            $stmtVerify = $pdo->prepare("SELECT COUNT(DISTINCT IdTransaccion) FROM Tbl_Transacciones_Maestra WHERE IdTransaccion IN ($inQuery)");
            $stmtVerify->execute($chunk);
            $totalVerificados += (int)$stmtVerify->fetchColumn();
        }
    }

    if ($totalVerificados < $totalEsperado) {
        throw new \Exception("Auditoría de Integridad Fallida: Se procesaron {$totalEsperado} transacciones únicas, pero solo se verificaron {$totalVerificados} en la Base de Datos. Se aplicó ROLLBACK de seguridad.");
    }
    // =========================================================================

    $pdo->commit(); // Si llega aquí, es 100% seguro guardarlo en disco
    
    // Convertimos los cierres generados en un string visual
    $stringCierres = [];
    foreach ($cierresIds as $b => $id) { 
        $n = ($b === 'SCOTIA') ? 'DAVIBANK' : $b;
        $stringCierres[] = "$n: #$id"; 
    }
    $textoVisualCierres = implode(' | ', $stringCierres);

    echo json_encode(['success' => true, 'filas_insertadas' => $filasAfectadas, 'id_cierre' => $textoVisualCierres]);

} catch (\Throwable $e) { 
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error Crítico del Servidor: ' . $e->getMessage()]);
}
?>