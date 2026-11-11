<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['aprobados'])) {
    echo json_encode(['success' => false, 'error' => 'Payload inválido o vacío']); exit;
}

$aprobados = $input['aprobados'];

$fechaConcil = trim($input['fechaConciliacion'] ?? '');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaConcil)) {
    echo json_encode(['success' => false, 'error' => 'Fecha de conciliación inválida']); exit;
}

[$anio, $mes, $dia] = array_map('intval', explode('-', $fechaConcil));

if (!checkdate($mes, $dia, $anio) || $fechaConcil > date('Y-m-d')) {
    echo json_encode(['success' => false, 'error' => 'La fecha de conciliación no es válida o está en el futuro']); exit;
}

try {
    $pdo = Database::connect();
    $pdo->beginTransaction(); // Iniciamos el Escudo Transaccional

    // 1. Preparamos las consultas de UPDATE (El dato ya existe, solo sellamos el Match)
    // TSD a CONCILIADO
    $stmtUpdateTSD = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Estado = 'CONCILIADO', IdMatchTSD = ?, TipoCruceTSD = ?, FechaConciliacion = ?, FechaRealConciliacion = GETDATE() WHERE IdTransaccion = ? AND Banco = 'TSD'");

    // Bancos (Solo le inyectamos el IdMatchTSD a la fila específica enviada)
    $stmtUpdateBanco = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET IdMatchTSD = ?, TipoCruceTSD = ?, FechaConciliacion = ?, FechaRealConciliacion = GETDATE() WHERE IdTransaccion = ? AND Banco IN ('BAC', 'SCOTIA', 'Davibank')");

    $stmtInsertAuditoria = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion, EvidenciaB64) VALUES (?, ?, ?, ?)");

    // OTROS INGRESOS: se valida TODO antes de tocar una sola fila.
    // Si uno solo está incompleto o no aplica, no se guarda nada.
    $SELLO_OTROS   = '[AUX] Otros Ingresos (Sin TSD)';
    $MAX_EVIDENCIA = 2000000; // caracteres base64 (~1.5 MB de imagen)

    $stmtCheckOtros = $pdo->prepare("
        SELECT m.Banco, m.Origen, m.Autorizacion, m.MontoBruto, m.IdMatchTSD,
               (SELECT COUNT(*) FROM Tbl_Ajustes_Auditoria a WHERE a.IdTransaccion = m.IdTransaccion) AS TieneAuditoria
        FROM Tbl_Transacciones_Maestra m
        WHERE m.IdTransaccion = ? AND m.Banco IN ('BAC', 'SCOTIA', 'Davibank')
    ");

    $erroresOtros = [];
    foreach ($aprobados as $match) {
        if (($match['TipoAjuste'] ?? '') !== 'OTROS-INGRESOS') continue;

        $bancos = $match['Bancos'] ?? [];
        $tsd    = $match['TSD'] ?? [];
        $idRef  = count($bancos) === 1 ? (string)$bancos[0] : '(sin transacción)';
        $faltas = [];

        if (count($tsd) > 0 || count($bancos) !== 1) {
            $faltas[] = 'debe ser una sola transacción bancaria sin TSD';
        }

        // Formato esperado: "[SOFTLAND:asiento] explicación"
        $just   = trim($match['Justificacion'] ?? '');
        $okJust = preg_match('/^\[SOFTLAND:([^\]]*)\]\s*(.*)$/su', $just, $mJ) === 1;
        if (!$okJust || trim($mJ[1]) === '') $faltas[] = 'falta el asiento de Softland';
        if (!$okJust || trim($mJ[2]) === '') $faltas[] = 'falta la explicación';

        $ev = (string)($match['EvidenciaB64'] ?? '');
        if ($ev === '') {
            $faltas[] = 'falta la captura de la aprobación';
        } elseif (strlen($ev) > $MAX_EVIDENCIA) {
            $faltas[] = 'la captura excede el tamaño permitido';
        } elseif (!preg_match('#^data:image/(png|jpeg|webp);base64,#', $ev)
               || base64_decode(substr($ev, strpos($ev, ',') + 1), true) === false) {
            $faltas[] = 'la captura no es una imagen válida';
        }

        if (count($bancos) === 1) {
            $stmtCheckOtros->execute([$idRef]);
            $fila = $stmtCheckOtros->fetch(PDO::FETCH_ASSOC);
            $stmtCheckOtros->closeCursor();

            if (!$fila) {
                $faltas[] = 'la transacción bancaria no existe';
            } else {
                $idRef = $fila['Banco'] . ' auth ' . ($fila['Autorizacion'] ?: 's/d')
                       . ' (₡' . number_format((float)$fila['MontoBruto'], 2, ',', ' ') . ')';
                if ((float)$fila['MontoBruto'] <= 0)  $faltas[] = 'el monto debe ser positivo';
                if ($fila['Origen'] !== 'DETALLADO')  $faltas[] = 'solo aplica a transacciones de los Excel de bancos';
                if ((int)$fila['TieneAuditoria'] > 0) $faltas[] = 'la transacción ya tiene un ajuste registrado';
                if ($fila['IdMatchTSD'] !== null)     $faltas[] = 'la transacción ya fue conciliada';
            }
        }

        if ($faltas) $erroresOtros[] = '• ' . $idRef . ': ' . implode(', ', $faltas);
    }

    if ($erroresOtros) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'error' => "No se guardó nada. Corrija estos otros ingresos:\n" . implode("\n", $erroresOtros)]);
        exit;
    }

    // 2. Ejecutar la actualización en bloque
    foreach ($aprobados as $match) {
        $idMatchTSD = trim($match['IdMatchTSD']);
        $tipoCruce = trim($match['TipoCruce']);
        $justificacion = isset($match['Justificacion']) ? trim($match['Justificacion']) : '';

        // El sello de otros ingresos lo fija el servidor, no el navegador
        $esOtros   = ($match['TipoAjuste'] ?? '') === 'OTROS-INGRESOS';
        if ($esOtros) $tipoCruce = $SELLO_OTROS;
        $evidencia = $esOtros ? $match['EvidenciaB64'] : null;

        // Actualizamos los registros de TSD
        foreach ($match['TSD'] as $idTSD) {
            $stmtUpdateTSD->execute([$idMatchTSD, $tipoCruce, $fechaConcil, $idTSD]);
        }

        // Auditoría Manual. Se ancla al primer TSD del bloque; si el bloque NO tiene
        // TSD (devolución por datáfono, ajuste interno de bancos, monto menor),
        // se ancla a la fila BANCARIA, que si no la justificación se perdía.
        $anclaAud = (count($match['TSD']) > 0)
            ? $match['TSD'][0]
            : (count($match['Bancos']) > 0 ? $match['Bancos'][0] : null);

        if ($justificacion && $anclaAud !== null) {
            $tipoAud = !empty($match['TipoAjuste']) ? $match['TipoAjuste'] : 'Aprobación Auxiliar (M4)';
            $stmtCheckAud = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Ajustes_Auditoria WHERE IdTransaccion = ?");
            $stmtCheckAud->execute([$anclaAud]);
            if ($stmtCheckAud->rowCount() == 0) {
                $stmtInsertAuditoria->execute([$anclaAud, $tipoAud, $justificacion, $evidencia]);
            }
        }

        // Actualizamos estrictamente los registros Bancarios enviados desde la pantalla
        foreach ($match['Bancos'] as $idBanco) {
            $stmtUpdateBanco->execute([$idMatchTSD, $tipoCruce, $fechaConcil, $idBanco]);
        }
    }

    $pdo->commit(); // Sellar los cambios
    echo json_encode(['success' => true]);

} catch (PDOException $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>