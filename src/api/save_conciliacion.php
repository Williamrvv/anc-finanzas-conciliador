<?php
// 1. BLINDAJE CONTRA HTML SUCIO (Evita el error de Syntax JSON)
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
    // Si PHP se quedó sin memoria o el POST superó el límite, json_last_error_msg nos lo dirá
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

    $stmtCierre = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Cierres (FechaCierre, Usuario, Banco, TotalConciliado) VALUES (?, ?, ?, ?)");
    $stmtCierre->execute([$fechaCierre, $usuario, $stringBancos, $totalConciliado]);
    $idCierre = $pdo->lastInsertId();

    $stmtCheck = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE HashUnico = ?");
    $stmtUpdate = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Estado = ?, IdMatch = ?, IdCierre = ISNULL(IdCierre, ?), Tarjeta = ISNULL(Tarjeta, ?) WHERE IdTransaccion = ?");
    
    $stmtInsert = $pdo->prepare("INSERT INTO Tbl_Transacciones_Maestra 
        (IdTransaccion, IdCierre, Banco, Origen, Estado, IdMatch, FechaTransaccion, Afiliado_MerID, Autorizacion, Tarjeta, MontoBruto, MontoNeto, ArchivoOrigen, HashUnico)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $stmtBAC = $pdo->prepare("INSERT INTO Tbl_Detalle_BAC (IdTransaccion, NUMERO_AFILIADO, NOMBRECOMERCIO, FECHA_TRANSACCION, FECHA_CIERRE_DATAFONO, FECHA_PAGO, NUMERO_DE_TARJETA, AUTORIZACION, TERMINAL, MONTO_VENTA, COMISION, RETENCION_VENTAS, RETENCION_RENTA, MONTONETO, NUMERO_LIQUIDACION, NUMERO_CUENTA, TIPO_CAMBIO, AJUSTE_COMISION_INTERNACIONAL, TIPO_TARJETA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtScotia = $pdo->prepare("INSERT INTO Tbl_Detalle_Scotia (IdTransaccion, Fuente, Fecha_Pago, Moneda, Transaccion, Cedula, Razon_Social, MerID, Nombre, Fecha_Lote_Ajuste, Numero_Lote_Ajuste, Terminal, Numero_Pago, Numero_Autorizacion, Numero_Tarjeta, Monto_Orig, Monto_Bruto, Monto_Comision_Total, Porc_Comision_Total, Monto_Comision_Int, Porc_Comision_Int, Monto_Retencion_IVA, Porc_Retencion_IVA, Monto_Retencion_ISR, Monto_Neto, Estatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    $stmtPagadoBAC = $pdo->prepare("INSERT INTO Tbl_Pagado_BAC (IdTransaccion, Fecha, Referencia, Codigo, Descripcion, Debitos, Creditos, Balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmtPagadoScotia = $pdo->prepare("INSERT INTO Tbl_Pagado_Scotia (IdTransaccion, Numero_Referencia, Fecha_Movimiento, Descripcion, Monto, Saldo, Credito_Debito) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmtAjuste = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion, EvidenciaB64) VALUES (?, ?, ?, ?)");

    $filasAfectadas = 0;

    foreach ($transacciones as $t) {
        $idTrans = $t['IdTransaccion'] ?? 'SIN_ID';
        $fecha = (!empty($t['FechaTransaccion']) && $t['FechaTransaccion'] !== 'N/A') ? $t['FechaTransaccion'] : null;
        $bruto = floatval($t['MontoBruto'] ?? 0);
        $neto  = floatval($t['MontoNeto'] ?? 0);

        if (!empty($t['SourceHash'])) {
            $hashUnico = $t['SourceHash']; 
        } else {
            $hashStr = "{$t['Banco']}|{$t['Origen']}|{$fecha}|{$neto}|" . ($t['Autorizacion'] ?? '') . "|" . ($t['Afiliado_MerID'] ?? '');
            $hashUnico = ($t['Origen'] === 'AJUSTE') ? $idTrans : md5($hashStr);
        }

        $stmtCheck->execute([$hashUnico]);
        $idExistente = $stmtCheck->fetchColumn();

        if ($idExistente) {
            $stmtUpdate->execute([$t['Estado'] ?? 'PENDIENTE', $t['IdMatch'] ?? null, $idCierre, $t['Tarjeta'] ?? null, $idExistente]);
        } else {
            $stmtInsert->execute([
                $idTrans, $idCierre, $t['Banco'] ?? 'DESC', $t['Origen'] ?? 'DESC', $t['Estado'] ?? 'PENDIENTE', $t['IdMatch'] ?? null, 
                $fecha, $t['Afiliado_MerID'] ?? null, $t['Autorizacion'] ?? null, $t['Tarjeta'] ?? null, $bruto, $neto, $t['ArchivoOrigen'] ?? 'Local', $hashUnico
            ]);

            if (($t['Banco'] ?? '') === 'BAC' && ($t['Origen'] ?? '') !== 'PAGADO') {
                $b = $t['RawBAC'] ?? [];
                $stmtBAC->execute([
                    $idTrans, $b['NUMERO_AFILIADO'] ?? null, $b['NOMBRECOMERCIO'] ?? null, $b['FECHA_TRANSACCION'] ?? null,
                    $b['FECHA_CIERRE_DATAFONO'] ?? null, $b['FECHA_PAGO'] ?? null, $b['NUMERO_DE_TARJETA'] ?? null, $b['AUTORIZACION'] ?? null,
                    $b['TERMINAL'] ?? null, $b['MONTO_VENTA'] ?? 0, $b['COMISION'] ?? 0, $b['RETENCION_VENTAS'] ?? 0,
                    $b['RETENCION_RENTA'] ?? 0, $b['MONTONETO'] ?? 0, $b['NUMERO_LIQUIDACION'] ?? null, $b['NUMERO_CUENTA'] ?? null,
                    $b['TIPO_CAMBIO'] ?? 0, $b['AJUSTE_COMISION_INTERNACIONAL'] ?? 0, $b['TIPO_TARJETA'] ?? null
                ]);
            } 
            else if (($t['Banco'] ?? '') === 'SCOTIA' && ($t['Origen'] ?? '') !== 'PAGADO') {
                $s = $t['RawScotia'] ?? [];
                $stmtScotia->execute([
                    $idTrans, $s['Fuente'] ?? null, $s['Fecha_Pago'] ?? null, $s['Moneda'] ?? null, $s['Transaccion'] ?? null,
                    $s['Cedula'] ?? null, $s['Razon_Social'] ?? null, $s['MerID'] ?? null, $s['Nombre'] ?? null,
                    $s['Fecha_Lote_Ajuste'] ?? null, $s['Numero_Lote_Ajuste'] ?? null, $s['Terminal'] ?? null, $s['Numero_Pago'] ?? null,
                    $s['Numero_Autorizacion'] ?? null, $s['Numero_Tarjeta'] ?? null, $s['Monto_Orig'] ?? 0, $s['Monto_Bruto'] ?? 0,
                    $s['Monto_Comision_Total'] ?? 0, $s['Porc_Comision_Total'] ?? 0, $s['Monto_Comision_Int'] ?? 0, $s['Porc_Comision_Int'] ?? 0,
                    $s['Monto_Retencion_IVA'] ?? 0, $s['Porc_Retencion_IVA'] ?? 0, $s['Monto_Retencion_ISR'] ?? 0, $s['Monto_Neto'] ?? 0, $s['Estatus'] ?? null
                ]);
            }
            else if (($t['Banco'] ?? '') === 'BAC' && ($t['Origen'] ?? '') === 'PAGADO') {
                $p = $t['RawPagadoBAC'] ?? [];
                $stmtPagadoBAC->execute([$idTrans, $p['Fecha'] ?? null, $p['Referencia'] ?? null, $p['Codigo'] ?? null, $p['Descripcion'] ?? null, $p['Debitos'] ?? 0, $p['Creditos'] ?? 0, $p['Balance'] ?? 0]);
            }
            else if (($t['Banco'] ?? '') === 'SCOTIA' && ($t['Origen'] ?? '') === 'PAGADO') {
                $p = $t['RawPagadoScotia'] ?? [];
                $stmtPagadoScotia->execute([$idTrans, $p['Numero_Referencia'] ?? null, $p['Fecha_Movimiento'] ?? null, $p['Descripcion'] ?? null, $p['Monto'] ?? 0, $p['Saldo'] ?? 0, $p['Credito_Debito'] ?? null]);
            }

            if (($t['Origen'] ?? '') === 'AJUSTE') {
                $stmtAjuste->execute([$idTrans, $t['TipoAjuste'] ?? '', $t['Justificacion'] ?? '', $t['EvidenciaB64'] ?? '']);
            }
        }
        $filasAfectadas++;
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'filas_insertadas' => $filasAfectadas, 'id_cierre' => $idCierre]);

} catch (\Throwable $e) { // ATRAPA ABSOLUTAMENTE TODO, INCLUSO ERRORES FATALES PHP
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error Crítico del Servidor: ' . $e->getMessage()]);
}
?>