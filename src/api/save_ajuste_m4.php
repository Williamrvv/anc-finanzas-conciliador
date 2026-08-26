<?php
// ============================================================================
//  save_ajuste_m4.php — Alta de AJUSTE MANUAL desde el Auxiliar Contable (M4)
//  Escribe en: Tbl_Conciliacion_Cierres, Tbl_Transacciones_Maestra,
//              Tbl_Detalle_BAC / Tbl_Detalle_Scotia y Tbl_Ajustes_Auditoria.
//  Estado='CONCILIADO' + IdMatch sintético => aparece SOLO en M4 (no en M2).
//  HashUnico = md5(HashString) con el MISMO formato de 12 campos de M2.
// ============================================================================
session_start();
ini_set('display_errors', 0);
require_once '../db.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) { echo json_encode(['success' => false, 'error' => 'Payload inválido']); exit; }

$usuario = $_SESSION['user']['email'] ?? 'Sistema';

// ============================================================================
//  ACCIÓN: EDITAR  (sólo Autorización y Tarjeta; el hash NO se recalcula)
// ============================================================================
if (($in['action'] ?? '') === 'update') {
    $idUp    = trim($in['id'] ?? '');
    $nAuth   = trim($in['autorizacion'] ?? '');
    $nTarj   = trim($in['tarjeta'] ?? '');
    if ($idUp === '') { echo json_encode(['success' => false, 'error' => 'Falta el ID del ajuste']); exit; }

    try {
        $pdo = Database::connect();

        $q = $pdo->prepare("SELECT Banco, IdMatchTSD, ArchivoOrigen FROM Tbl_Transacciones_Maestra WHERE IdTransaccion = ?");
        $q->execute([$idUp]);
        $reg = $q->fetch(PDO::FETCH_ASSOC);
        if (!$reg) { echo json_encode(['success' => false, 'error' => 'El registro no existe']); exit; }

        if (strpos((string)($reg['ArchivoOrigen'] ?? ''), 'AJUSTE-M4') !== 0) {
            echo json_encode(['success' => false, 'error' => 'Sólo se pueden editar los ajustes manuales creados en el Auxiliar Contable.']); exit;
        }
        if (!empty($reg['IdMatchTSD'])) {
            echo json_encode(['success' => false, 'error' => 'Este ajuste ya fue conciliado con TSD. No se puede modificar.']); exit;
        }

        $pdo->beginTransaction();

        // Maestra (el HashUnico queda intacto a propósito)
        $u = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Autorizacion = ?, Tarjeta = ? WHERE IdTransaccion = ?");
        $u->execute([($nAuth !== '' ? $nAuth : null), ($nTarj !== '' ? $nTarj : null), $idUp]);

        // Detalle del banco correspondiente
        if (strtoupper($reg['Banco']) === 'BAC') {
            $ud = $pdo->prepare("UPDATE Tbl_Detalle_BAC SET AUTORIZACION = ?, NUMERO_DE_TARJETA = ? WHERE IdTransaccion = ?");
        } else {
            $ud = $pdo->prepare("UPDATE Tbl_Detalle_Scotia SET Numero_Autorizacion = ?, Numero_Tarjeta = ? WHERE IdTransaccion = ?");
        }
        $ud->execute([($nAuth !== '' ? $nAuth : null), ($nTarj !== '' ? $nTarj : null), $idUp]);

        $pdo->commit();
        echo json_encode(['success' => true, 'id' => $idUp]);

    } catch (\Throwable $e) {
        if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Error al editar: ' . $e->getMessage()]);
    }
    exit;
}

// ============================================================================
//  ACCIÓN: BORRAR (solo ajustes manuales creados en el Auxiliar y sin pareja TSD)
//  Se resuelve en este mismo archivo para no multiplicar endpoints.
// ============================================================================
if (($in['action'] ?? '') === 'delete') {
    $idDel = trim($in['id'] ?? '');
    if ($idDel === '') { echo json_encode(['success' => false, 'error' => 'Falta el ID del ajuste']); exit; }

    try {
        $pdo = Database::connect();

        $q = $pdo->prepare("SELECT IdCierre, IdMatchTSD, Origen, ArchivoOrigen
                            FROM Tbl_Transacciones_Maestra WHERE IdTransaccion = ?");
        $q->execute([$idDel]);
        $reg = $q->fetch(PDO::FETCH_ASSOC);

        if (!$reg) { echo json_encode(['success' => false, 'error' => 'El registro no existe']); exit; }

        // Candado 1: SOLO ajustes creados en el Auxiliar. El marcador es ArchivoOrigen.
        if (strpos((string)($reg['ArchivoOrigen'] ?? ''), 'AJUSTE-M4') !== 0) {
            echo json_encode(['success' => false, 'error' => 'Solo se pueden eliminar los ajustes manuales creados en el Auxiliar Contable.']); exit;
        }
        // Candado 2: si ya casó con TSD, borrarlo rompería la conciliación.
        if (!empty($reg['IdMatchTSD'])) {
            echo json_encode(['success' => false, 'error' => 'Este ajuste ya fue conciliado con TSD. Debe deshacerse el cruce antes de eliminarlo.']); exit;
        }

        $idCierreDel = $reg['IdCierre'];

        $pdo->beginTransaction();

        // La maestra tiene FK con ON DELETE CASCADE hacia Tbl_Detalle_BAC,
        // Tbl_Detalle_Scotia y Tbl_Ajustes_Auditoria: se limpian solas.
        $d = $pdo->prepare("DELETE FROM Tbl_Transacciones_Maestra WHERE IdTransaccion = ?");
        $d->execute([$idDel]);

        // El folio se creó exclusivamente para este ajuste: se borra si quedó huérfano.
        if ($idCierreDel !== null) {
            $dc = $pdo->prepare(
                "DELETE FROM Tbl_Conciliacion_Cierres
                 WHERE IdCierre = ?
                   AND NOT EXISTS (SELECT 1 FROM Tbl_Transacciones_Maestra WHERE IdCierre = ?)
                   AND NOT EXISTS (SELECT 1 FROM Tbl_Detalle_TSD WHERE IdCierre = ?)"
            );
            $dc->execute([$idCierreDel, $idCierreDel, $idCierreDel]);
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'eliminado' => $idDel]);

    } catch (\Throwable $e) {
        if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => 'Error al eliminar: ' . $e->getMessage()]);
    }
    exit;
}

$bancoUI   = strtoupper(trim($in['banco'] ?? ''));
$tipo      = trim($in['tipo'] ?? '');
$fecha     = trim($in['fecha'] ?? '');
$fechaPago = trim($in['fechaPago'] ?? '') ?: $fecha;
$sucursal  = trim($in['sucursal'] ?? '');
$afiliado  = trim($in['afiliado'] ?? '');
$terminal  = trim($in['terminal'] ?? '');
$centroCC  = trim($in['centroCosto'] ?? '');
$auth      = trim($in['autorizacion'] ?? '');
$tarjeta   = trim($in['tarjeta'] ?? '');
$softland  = trim($in['softland'] ?? '');
$nota      = trim($in['nota'] ?? '');
$motivo    = trim($in['motivo'] ?? '');
$idEtiq    = isset($in['idEtiqueta']) && $in['idEtiqueta'] !== '' ? trim($in['idEtiqueta']) : null;
$hashStr   = (string)($in['hashString'] ?? '');

$neto      = isset($in['neto']) ? (float)$in['neto'] : 0;
$bruto     = isset($in['bruto']) ? (float)$in['bruto'] : 0;
$comision  = isset($in['comision']) ? (float)$in['comision'] : 0;
$retA      = isset($in['ret1']) ? (float)$in['ret1'] : 0;
$retB      = isset($in['ret2']) ? (float)$in['ret2'] : 0;
$aci       = isset($in['aci']) ? (float)$in['aci'] : 0;
$porcCom   = isset($in['porcComision']) ? (float)$in['porcComision'] : 0;

// Obligatorios: TODOS alimentan el hash de contenido
// Sucursal, afiliado, terminal, autorización y tarjeta son OPCIONALES:
// se completan más adelante desde el propio Auxiliar.
$faltan = [];
if (!in_array($bancoUI, ['BAC', 'DAVIBANK'], true)) $faltan[] = 'Banco';
if ($tipo === '')      $faltan[] = 'Tipo de ajuste';
if ($fecha === '')     $faltan[] = 'Fecha';
if ($softland === '')  $faltan[] = 'ID de asiento Softland';
if ($neto == 0)        $faltan[] = 'Monto del ajuste';

if ($faltan) {
    echo json_encode(['success' => false, 'error' => "Faltan datos obligatorios:\n• " . implode("\n• ", $faltan)]);
    exit;
}

$bancoDB   = ($bancoUI === 'DAVIBANK') ? 'DAVIBANK' : 'BAC';
$fuenteDB  = $bancoDB;
$justificacion = '[SOFTLAND:' . $softland . '] ' . ($motivo !== '' ? $motivo : $tipo);

// IdTransaccion: lleva fecha, hora, segundo y 5 hex aleatorios
$idTrans = 'ADJM4-' . date('YmdHis') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));

// HASH de ajustes manuales. Dos garantías:
//  - El prefijo 'M4:' hace imposible el choque con los md5 puros de archivos.
//  - Incluir $idTrans (tiempo + azar) garantiza unicidad aunque el contenido se
//    repita, porque ahora hay pocos campos y podrían coincidir entre ajustes.
$hashStr = 'M4|' . $bancoUI . '|' . $tipo . '|' . $fecha . '|' . strtoupper($softland)
         . '|' . $neto . '|' . strtoupper($auth) . '|' . strtoupper($tarjeta) . '|' . $idTrans;
$hashUnico = 'M4:' . md5($hashStr);

try {
    $pdo = Database::connect();

    $chk = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE HashUnico = ?");
    $chk->execute([$hashUnico]);
    if ($chk->fetchColumn()) {
        echo json_encode(['success' => false, 'error' => "Ya existe un ajuste idéntico registrado (mismo asiento, sucursal, fecha y monto).\n\nVerifique el ID de asiento de Softland."]);
        exit;
    }

    $pdo->beginTransaction();

    // ---------- 1. FOLIO PROPIO ----------
    $stCierre = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Cierres (Usuario, Fuente, TotalConciliado) VALUES (?, ?, ?)");
    $stCierre->execute([$usuario, $fuenteDB, $neto]);
    $idCierre = (int)$pdo->lastInsertId();

    // ---------- 2. MAESTRA ----------
    $idMatch = 'adjm4_' . bin2hex(random_bytes(5));

    $stMaestra = $pdo->prepare(
        "INSERT INTO Tbl_Transacciones_Maestra
         (IdTransaccion, IdCierre, Banco, Origen, Estado, IdMatch, FechaTransaccion, Afiliado_MerID,
          Autorizacion, Tarjeta, MontoBruto, MontoNeto, ArchivoOrigen, HashUnico, ColorEtiqueta, NotaUsuario,
          FechaRegistro)
         VALUES (
            ?, ?, ?, 'AJUSTE', 'CONCILIADO', ?,
            CONVERT(date, ?, 23),
            ?, ?, ?, ?, ?, 'AJUSTE-M4', ?, ?, ?,
            CONVERT(datetime, ?, 126)
         )"
    );
    $stMaestra->execute([
        $idTrans, $idCierre, $bancoDB, $idMatch, $fecha, ($afiliado !== '' ? $afiliado : null),
        ($auth !== '' ? $auth : null), ($tarjeta !== '' ? $tarjeta : null), $bruto, $neto, $hashUnico,
        $idEtiq, ($nota !== '' ? $nota : null),
        // ISO 8601 con "T": independiente del idioma/DATEFORMAT del SQL Server.
        $fecha . 'T' . date('H:i:s')
    ]);

    // ---------- 3. DETALLE POR BANCO ----------
    if ($bancoDB === 'BAC') {
        $stDet = $pdo->prepare(
            "INSERT INTO Tbl_Detalle_BAC
             (IdTransaccion, IdCierre, NUMERO_AFILIADO, NOMBRECOMERCIO, FECHA_TRANSACCION, FECHA_CIERRE_DATAFONO,
              FECHA_PAGO, NUMERO_DE_TARJETA, AUTORIZACION, TERMINAL, MONTO_VENTA, COMISION, RETENCION_VENTAS,
              RETENCION_RENTA, MONTONETO, NUMERO_LIQUIDACION, NUMERO_CUENTA, TIPO_CAMBIO,
              AJUSTE_COMISION_INTERNACIONAL, TIPO_TARJETA, CentroCosto)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?)"
        );
        $stDet->execute([
            $idTrans, $idCierre, $afiliado, $sucursal, $fecha, $fecha,
            $fechaPago, $tarjeta, $auth, $terminal, $bruto, $comision, $retA,
            $retB, $neto, $softland, $aci, ($centroCC !== '' ? $centroCC : null)
        ]);
    } else {
        $stDet = $pdo->prepare(
            "INSERT INTO Tbl_Detalle_Scotia
             (IdTransaccion, IdCierre, Fuente, Fecha_Pago, Moneda, Transaccion, Razon_Social, MerID, Nombre,
              Fecha_Lote_Ajuste, Numero_Lote_Ajuste, Terminal, Numero_Pago, Numero_Autorizacion, Numero_Tarjeta,
              Monto_Orig, Monto_Bruto, Monto_Comision_Total, Porc_Comision_Total, Monto_Comision_Int,
              Porc_Comision_Int, Monto_Retencion_IVA, Porc_Retencion_IVA, Monto_Retencion_ISR, Monto_Neto,
              Estatus, CentroCosto)
             VALUES (?, ?, ?, ?, 'CRC', 'AJUSTE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)"
        );
        $stDet->execute([
            $idTrans, $idCierre, 'AJUSTE-M4', $fechaPago, $sucursal, $afiliado, $sucursal,
            $fecha, $softland, $terminal, null, $auth, $tarjeta,
            $bruto, $bruto, $comision, $porcCom,
            $retA, ($retA != 0 ? 0.0530 : 0), $retB, $neto,
            'AJUSTE', ($centroCC !== '' ? $centroCC : null)
        ]);
    }

    // ---------- 4. AUDITORÍA ----------
    $stAud = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion) VALUES (?, ?, ?)");
    $stAud->execute([$idTrans, $tipo, $justificacion]);

    $pdo->commit();

    echo json_encode([
        'success'   => true,
        'id'        => $idTrans,
        'idCierre'  => $idCierre,
        'hash'      => $hashUnico,
        'sinCategoria' => ($idEtiq === null)
    ]);

} catch (\Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => 'Error al guardar: ' . $e->getMessage()]);
}