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

    // ============================================================
    // 1. AUXILIAR COMPLETO GUARDADO PARA LA FECHA CONSULTADA
    // ============================================================
    $stmtCorte = $pdo->prepare("
        SELECT TOP (1)
            IdCorte,
            CONVERT(varchar(10), FechaRegistro, 23) AS FechaRegistro,
            CONVERT(varchar(23), FechaCapturaReal, 121) AS FechaCapturaReal,
            OrigenCaptura,
            UsuarioUltimo,
            CantidadFilas,
            CantidadTransacciones
        FROM Tbl_Auxiliar_Cortes
        WHERE FechaRegistro = CONVERT(date, ?, 23)
    ");

    $stmtCorte->execute([$fecha]);

    $corte = $stmtCorte->fetch(PDO::FETCH_ASSOC);

    if (!$corte) {
        $corte = null;
    }

    $pendientes = [];

    if ($corte) {
        $stmtPendientes = $pdo->prepare("
            SELECT
                F.IdFilaCorte,
                F.Seccion,
                F.OrdenVisual,

                COALESCE(NULLIF(F.Contrato, ''), '-') AS Contrato,
                COALESCE(NULLIF(F.Cliente, ''), '-') AS Cliente,
                COALESCE(NULLIF(F.AuthTSD, ''), '-') AS Autorizacion,

                F.TSD_Debito,
                F.TSD_Credito,

                COALESCE(
                    NULLIF(F.EstadoAux, ''),
                    'Pendiente'
                ) AS EstadoMatch,

                COALESCE(NULLIF(F.Banco, ''), '-') AS Banco_Nombre,
                COALESCE(NULLIF(F.AuthBanco, ''), '-') AS Banco_Auth,

                F.Banco_Debito,
                F.Banco_Credito,
                F.Diferencia,

                COALESCE(F.Nota, '') AS NotaUsuario,

                F.CategoriaId,
                F.IdEtiqueta,
                F.NombreEtiqueta,
                F.ColorCSS,

                CAST(F.EsMultiple AS int) AS [_isMulti],
                COALESCE(F.ClaseVisual, '') AS [_rowClass],

                CAST('' AS nvarchar(1)) AS DetalleTSDDebito,
                CAST('' AS nvarchar(1)) AS DetalleTSDCredito

            FROM Tbl_Auxiliar_Corte_Filas F
            WHERE F.IdCorte = ?

            ORDER BY
                CASE
                    WHEN F.Seccion = 'APROBADA_MANUAL' THEN 0
                    ELSE 1
                END,
                F.OrdenVisual
        ");

        $stmtPendientes->execute([
            $corte['IdCorte']
        ]);

        $pendientes = $stmtPendientes->fetchAll(
            PDO::FETCH_ASSOC
        );
    }

    // ============================================================
    // 2. CONCILIADOS EXACTAMENTE EN LA FECHA CONSULTADA
    // ============================================================
    $stmtConciliados = $pdo->prepare("
        SELECT
            TM.IdTransaccion,
            TM.Banco,
            TM.Origen,

            CAST(
                'CONCILIADO ESE DÍA'
                AS varchar(30)
            ) AS EstadoHistorico,

            TM.Estado AS EstadoActual,

            CONVERT(
                varchar(10),
                TM.FechaTransaccion,
                23
            ) AS FechaTransaccion,

            CONVERT(
                varchar(19),
                TM.FechaRegistro,
                120
            ) AS FechaRegistro,

            CONVERT(
                varchar(10),
                TM.FechaConciliacion,
                23
            ) AS FechaConciliacion,

            CONVERT(
                varchar(19),
                TM.FechaRealConciliacion,
                120
            ) AS FechaRealConciliacion,

            DATEDIFF(
                DAY,
                TM.FechaTransaccion,
                TM.FechaConciliacion
            ) AS DiasAntiguedadAlCorte,

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

            COALESCE(
                DT.CentroCosto,
                DB.CentroCosto,
                DS.CentroCosto
            ) AS CentroCosto,

            COALESCE(
                DT.SucursalNombre,
                DB.NOMBRECOMERCIO,
                DS.Nombre
            ) AS Sucursal,

            TM.NotaUsuario,
            TM.MontoBruto,
            TM.MontoNeto,
            TM.IdMatch,
            TM.IdMatchTSD,
            TM.TipoCruceTSD

        FROM Tbl_Transacciones_Maestra TM

        LEFT JOIN Tbl_Detalle_TSD DT
            ON DT.IdTransaccion = TM.IdTransaccion
           AND TM.Banco = 'TSD'

        LEFT JOIN Tbl_Detalle_BAC DB
            ON DB.IdTransaccion = TM.IdTransaccion
           AND TM.Banco = 'BAC'

        LEFT JOIN Tbl_Detalle_Scotia DS
            ON DS.IdTransaccion = TM.IdTransaccion
           AND TM.Banco IN ('Davibank', 'SCOTIA')

        WHERE TM.Origen IN ('DETALLADO', 'AJUSTE')
          AND TM.FechaConciliacion = CONVERT(date, ?, 23)

        ORDER BY
            COALESCE(
                TM.IdMatchTSD,
                TM.IdTransaccion
            ),
            TM.Banco,
            TM.IdTransaccion
    ");

    $stmtConciliados->execute([$fecha]);

    $conciliados = $stmtConciliados->fetchAll(
        PDO::FETCH_ASSOC
    );

    $montoPendiente = 0;

    foreach ($pendientes as $fila) {
        $montoPendiente += (float)(
            $fila['Diferencia'] ?? 0
        );
    }

    echo json_encode([
        'success' => true,
        'fecha' => $fecha,
        'corte' => $corte,

        'summary' => [
            'pendientes' => count($pendientes),
            'conciliados' => count($conciliados),
            'montoPendiente' => round(
                $montoPendiente,
                2
            )
        ],

        'pendientes' => $pendientes,
        'conciliados' => $conciliados

    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>