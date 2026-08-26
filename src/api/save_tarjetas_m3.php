<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['tarjetas']) || !is_array($input['tarjetas'])) {
    echo json_encode(['success' => false, 'error' => 'Payload inválido']); exit;
}

try {
    $pdo = Database::connect();

    // ============================================================
    // NORMALIZAR Y ELIMINAR DUPLICADOS ANTES DE TOCAR SQL SERVER
    // Si el mismo contrato viene varias veces, conserva el último
    // valor recibido, igual que hacía el MERGE fila por fila.
    // ============================================================
    $tarjetasUnicas = [];

    foreach ($input['tarjetas'] as $row) {
        $contrato = trim((string)($row['contrato'] ?? ''));
        $tarjeta   = trim((string)($row['tarjeta'] ?? ''));

        if ($contrato === '' || $tarjeta === '') {
            continue;
        }

        // Prefijo para impedir que PHP transforme contratos numéricos
        // utilizados como llave asociativa.
        $tarjetasUnicas['CONTRATO|' . $contrato] = [
            'contrato' => $contrato,
            'tarjeta'   => $tarjeta
        ];
    }

    $tarjetas = array_values($tarjetasUnicas);

    if (count($tarjetas) === 0) {
        echo json_encode([
            'success' => false,
            'error' => 'No se encontraron contratos y tarjetas válidos para guardar.'
        ]);
        exit;
    }

    $pdo->beginTransaction();

    // ============================================================
    // TABLA TEMPORAL
    // SELECT TOP 0 hace que SQL Server copie los tipos REALES
    // de las columnas sin tener que duplicarlos aquí.
    // ============================================================
    $pdo->exec("
        SELECT TOP (0)
            NumeroContrato,
            Tarjeta_Ultimos4
        INTO #CargaHistorialTarjetas
        FROM Tbl_Historial_Tarjetas
    ");

    // ============================================================
    // CARGA POR LOTES
    // SQL Server soporta máximo 2100 parámetros por sentencia.
    // 500 filas x 2 columnas = 1000 parámetros por lote.
    // ============================================================
    foreach (array_chunk($tarjetas, 500) as $lote) {
        $values = [];
        $params = [];

        foreach ($lote as $row) {
            $values[] = '(?, ?)';
            $params[] = $row['contrato'];
            $params[] = $row['tarjeta'];
        }

        $stmtCarga = $pdo->prepare("
            INSERT INTO #CargaHistorialTarjetas
            (
                NumeroContrato,
                Tarjeta_Ultimos4
            )
            VALUES " . implode(', ', $values)
        );

        $stmtCarga->execute($params);
    }

    // ============================================================
    // ACTUALIZAR EXISTENTES EN UNA SOLA OPERACIÓN
    // ============================================================
    $pdo->exec("
        UPDATE destino
        SET
            destino.Tarjeta_Ultimos4 = origen.Tarjeta_Ultimos4,
            destino.FechaIngreso = GETDATE()
        FROM Tbl_Historial_Tarjetas AS destino
        INNER JOIN #CargaHistorialTarjetas AS origen
            ON origen.NumeroContrato = destino.NumeroContrato
    ");

    // ============================================================
    // INSERTAR NUEVOS EN UNA SOLA OPERACIÓN
    // ============================================================
    $pdo->exec("
        INSERT INTO Tbl_Historial_Tarjetas
        (
            NumeroContrato,
            Tarjeta_Ultimos4,
            FechaIngreso
        )
        SELECT
            origen.NumeroContrato,
            origen.Tarjeta_Ultimos4,
            GETDATE()
        FROM #CargaHistorialTarjetas AS origen
        WHERE NOT EXISTS
        (
            SELECT 1
            FROM Tbl_Historial_Tarjetas AS destino
            WHERE destino.NumeroContrato = origen.NumeroContrato
        )
    ");

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'filas' => count($tarjetas),
        'recibidas' => count($input['tarjetas'])
    ]);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>