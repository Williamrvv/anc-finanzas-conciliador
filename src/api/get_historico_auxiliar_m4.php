<?php
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$fecha = trim($_GET['fecha'] ?? '');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
    echo json_encode(['success' => false, 'error' => 'Fecha inválida']); exit;
}

[$anio, $mes, $dia] = array_map('intval', explode('-', $fecha));

if (!checkdate($mes, $dia, $anio)) {
    echo json_encode(['success' => false, 'error' => 'Fecha inválida']); exit;
}

try {
    $pdo = Database::connect();

    // Último día contable que tiene conciliaciones registradas.
    // Si se consulta este día, también debemos mostrar todos los pendientes
    // actuales cuya FechaConciliacion todavía sea NULL.
    $stmtUltimaFecha = $pdo->query("
        SELECT MAX(CAST(FechaConciliacion AS date))
        FROM Tbl_Transacciones_Maestra
        WHERE Origen IN ('DETALLADO', 'AJUSTE')
          AND FechaConciliacion IS NOT NULL
    ");

    $ultimaFechaConRegistros = $stmtUltimaFecha->fetchColumn();

    $esUltimoDia = (
        $ultimaFechaConRegistros !== false
        && $ultimaFechaConRegistros !== null
        && $fecha === $ultimaFechaConRegistros
    );

    $stmt = $pdo->prepare("
        SELECT
            TM.IdTransaccion,
            TM.Banco,
            TM.Origen,
            CASE
                WHEN TM.FechaConciliacion = CONVERT(date, ?, 23)
                    THEN 'CONCILIADO ESE DÍA'
                ELSE 'PENDIENTE AL CIERRE'
            END AS EstadoHistorico,
            TM.Estado AS EstadoActual,
            CONVERT(varchar(10), TM.FechaTransaccion, 23) AS FechaTransaccion,
            CONVERT(varchar(19), TM.FechaRegistro, 120) AS FechaRegistro,
            CONVERT(varchar(10), TM.FechaConciliacion, 23) AS FechaConciliacion,
            CONVERT(varchar(19), TM.FechaRealConciliacion, 120) AS FechaRealConciliacion,
            DATEDIFF(DAY, TM.FechaTransaccion, CONVERT(date, ?, 23)) AS DiasAntiguedadAlCorte,
            TM.Afiliado_MerID,
            COALESCE(
                NULLIF(LTRIM(RTRIM(TM.Autorizacion)), ''),
                NULLIF(LTRIM(RTRIM(DT.Autorizacion)), ''),
                NULLIF(LTRIM(RTRIM(DB.AUTORIZACION)), ''),
                NULLIF(LTRIM(RTRIM(DS.Numero_Autorizacion)), '')
            ) AS Autorizacion,
            TM.Tarjeta,
            DT.Contrato AS ContratoTSD,
            DT.Cliente AS ClienteTSD,
            DT.Recibo_Detalle AS ReciboDetalleTSD,
            COALESCE(DT.CentroCosto, DB.CentroCosto, DS.CentroCosto) AS CentroCosto,
            COALESCE(DT.SucursalNombre, DB.NOMBRECOMERCIO, DS.Nombre) AS Sucursal,
            TM.NotaUsuario,
            TM.MontoBruto,
            TM.MontoNeto,
            TM.IdMatch,
            TM.IdMatchTSD,
            TM.TipoCruceTSD
        FROM Tbl_Transacciones_Maestra TM
        LEFT JOIN Tbl_Detalle_TSD DT
            ON DT.IdTransaccion = TM.IdTransaccion AND TM.Banco = 'TSD'
        LEFT JOIN Tbl_Detalle_BAC DB
            ON DB.IdTransaccion = TM.IdTransaccion AND TM.Banco = 'BAC'
        LEFT JOIN Tbl_Detalle_Scotia DS
            ON DS.IdTransaccion = TM.IdTransaccion AND TM.Banco = 'Davibank'
        WHERE
        -- Sólo lo que pertenece al auxiliar: los PAGADO nunca se cruzan con TSD.
        TM.Origen IN ('DETALLADO', 'AJUSTE')
        AND
        (
            -- Estado histórico normal: sólo registros que ya existían al corte.
            (
                -- Nunca puede aparecer antes de su propia transacción.
                COALESCE(
                    CONVERT(date, TM.FechaTransaccion),
                    CONVERT(date, TM.FechaRegistro)
                ) <= CONVERT(date, ?, 23)

                AND TM.FechaRegistro < DATEADD(DAY, 1, CONVERT(date, ?, 23))

                AND (
                    TM.FechaConciliacion IS NULL
                    OR TM.FechaConciliacion > CONVERT(date, ?, 23)
                )
            )

            -- CONCILIADO ESE DÍA
            OR TM.FechaConciliacion = CONVERT(date, ?, 23)

            -- Último día: pendientes actuales, pero nunca movimientos futuros.
            OR (
                ? = 1
                AND TM.FechaConciliacion IS NULL
                AND COALESCE(
                    CONVERT(date, TM.FechaTransaccion),
                    CONVERT(date, TM.FechaRegistro)
                ) <= CONVERT(date, ?, 23)
            )
        )
            ORDER BY EstadoHistorico DESC, TM.Banco, TM.FechaTransaccion, TM.IdTransaccion
        ");

    $stmt->execute([
        $fecha,
        $fecha,
        $fecha,
        $fecha,
        $fecha,
        $esUltimoDia ? 1 : 0
    ]);

    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pendientes = 0;
    $conciliados = 0;
    $montoPendiente = 0;

    foreach ($data as $row) {
        if ($row['EstadoHistorico'] === 'PENDIENTE AL CIERRE') {
            $pendientes++;
            $montoPendiente += (float)($row['MontoBruto'] ?? 0);
        } elseif ($row['EstadoHistorico'] === 'CONCILIADO ESE DÍA') {
            $conciliados++;
        }
    }

    echo json_encode([
        'success' => true,
        'fecha' => $fecha,
        'summary' => [
            'pendientes' => $pendientes,
            'conciliados' => $conciliados,
            'montoPendiente' => $montoPendiente
        ],
        'data' => $data
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>