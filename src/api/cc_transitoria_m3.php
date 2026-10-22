<?php
// =========================================================================
// M3 · SACAR TRANSACCIONES DE LA TRANSITORIA (LINKS DE PAGO)
//   GET  ?accion=catalogo    -> CC transitoria + catálogo de CC válidos
//   POST ?accion=actualizar  -> {cambios:[{idTransaccion, banco, cc, sugerido}]}
// Todo o nada: si una sola transacción ya no está en la transitoria,
// no se guarda ningún cambio. Cada cambio queda en Tbl_Bitacora.
// =========================================================================
ini_set('display_errors', 0);
error_reporting(E_ALL);

session_start();
require_once '../db.php';
require_once __DIR__ . '/bitacora_lib.php';
require_once __DIR__ . '/cc_transitoria_lib.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'] ?? '', ['admin', 'conciliador'], true)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
    exit;
}

$accion = $_GET['accion'] ?? '';

try {
    $pdo = Database::connect();

    // ---------------- CATÁLOGO ----------------
    if ($accion === 'catalogo') {
        echo json_encode([
            'success'        => true,
            'cc_transitoria' => CC_TRANSITORIA,
            'catalogo'       => cc_catalogo_centros_costo($pdo)
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ---------------- ACTUALIZAR ----------------
    if ($accion !== 'actualizar' || ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        throw new InvalidArgumentException('Acción no válida.');
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $cambios = is_array($input) ? ($input['cambios'] ?? null) : null;

    if (!is_array($cambios) || count($cambios) === 0) {
        throw new InvalidArgumentException('No se recibieron cambios.');
    }
    if (count($cambios) > 1000) {
        throw new InvalidArgumentException('Demasiadas transacciones en una sola actualización (máximo 1000).');
    }

    $validos = array_flip(array_column(cc_catalogo_centros_costo($pdo), 'cc'));

    $normalizados = [];
    foreach ($cambios as $i => $c) {
        $id    = trim((string)($c['idTransaccion'] ?? ''));
        $banco = strtoupper(trim((string)($c['banco'] ?? '')));
        $cc    = trim((string)($c['cc'] ?? ''));
        $sug   = trim((string)($c['sugerido'] ?? ''));

        if ($id === '' || strlen($id) > 50) {
            throw new InvalidArgumentException('La fila ' . ($i + 1) . ' no tiene un IdTransaccion válido.');
        }
        if (!in_array($banco, ['DAVIBANK', 'SCOTIA', 'BAC'], true)) {
            throw new InvalidArgumentException("La transacción {$id} tiene un banco no reconocido.");
        }
        if (!isset($validos[$cc])) {
            throw new InvalidArgumentException("El centro de costo '{$cc}' de la transacción {$id} no está en el catálogo.");
        }
        // Si la misma transacción viene dos veces, gana la última
        $normalizados[$id] = ['id' => $id, 'banco' => $banco, 'cc' => $cc, 'sugerido' => $sug];
    }

    $pdo->beginTransaction();

    $stmtScotia = $pdo->prepare("UPDATE Tbl_Detalle_Scotia SET CentroCosto = ? WHERE IdTransaccion = ? AND CentroCosto = ?");
    $stmtBAC    = $pdo->prepare("UPDATE Tbl_Detalle_BAC SET CentroCosto = ? WHERE IdTransaccion = ? AND CentroCosto = ?");

    foreach ($normalizados as $n) {
        $stmt = ($n['banco'] === 'BAC') ? $stmtBAC : $stmtScotia;
        $stmt->execute([$n['cc'], $n['id'], CC_TRANSITORIA]);

        if ($stmt->rowCount() !== 1) {
            throw new RuntimeException(
                "La transacción {$n['id']} ya no está en la transitoria (otro usuario pudo haberla actualizado). "
                . "No se guardó ningún cambio: vuelva a ejecutar el cruce."
            );
        }
    }

    // VERIFICACIÓN: se relee de la base lo que quedó escrito ANTES del COMMIT.
    // Si una sola transacción no tiene el CC elegido, se revierte todo.
    $ids = array_keys($normalizados);
    $enBase = [];
    foreach (array_chunk($ids, 500) as $lote) {
        $in = implode(',', array_fill(0, count($lote), '?'));
        $stmtVer = $pdo->prepare("
            SELECT IdTransaccion, CentroCosto FROM Tbl_Detalle_Scotia WHERE IdTransaccion IN ($in)
            UNION ALL
            SELECT IdTransaccion, CentroCosto FROM Tbl_Detalle_BAC WHERE IdTransaccion IN ($in)
        ");
        $stmtVer->execute(array_merge($lote, $lote));
        foreach ($stmtVer->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $enBase[trim((string)$r['IdTransaccion'])] = trim((string)$r['CentroCosto']);
        }
    }

    $verificadas = [];
    foreach ($normalizados as $n) {
        $ccBase = $enBase[$n['id']] ?? null;
        if ($ccBase !== $n['cc']) {
            throw new RuntimeException(
                "Verificación fallida: la transacción {$n['id']} quedó con '" . ($ccBase ?? 'sin registro')
                . "' en lugar de '{$n['cc']}'. No se guardó ningún cambio."
            );
        }
        $verificadas[] = ['idTransaccion' => $n['id'], 'cc' => $ccBase];
    }

    $pdo->commit();

    // Bitácora: un registro por transacción (conexión propia, después del COMMIT)
    foreach ($normalizados as $n) {
        Bitacora::registrar('CONSOLIDADO_TSD', 'CC_TRANSITORIA_ACTUALIZAR', 'OK', [
            'Url'     => $_SERVER['REQUEST_URI'] ?? null,
            'Metodo'  => 'POST',
            'Mensaje' => "IdTransaccion {$n['id']}: " . CC_TRANSITORIA . " -> {$n['cc']}",
            'Detalle' => [
                'IdTransaccion'  => $n['id'],
                'Banco'          => $n['banco'],
                'CCAnterior'     => CC_TRANSITORIA,
                'CCNuevo'        => $n['cc'],
                'CCSugerido'     => $n['sugerido'] !== '' ? $n['sugerido'] : null,
                'UsoLaSugerencia'=> ($n['sugerido'] !== '' && $n['sugerido'] === $n['cc'])
            ]
        ]);
    }

    echo json_encode([
        'success'      => true,
        'actualizadas' => count($normalizados),
        'verificadas'  => $verificadas
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code($e instanceof InvalidArgumentException ? 400 : 500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}