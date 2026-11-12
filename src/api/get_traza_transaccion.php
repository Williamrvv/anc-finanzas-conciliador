<?php
// TRAZA DE UNA TRANSACCIÓN (solo lectura) — Explorador de datos.
// Recibe UNA de estas llaves y devuelve todo lo que IRI sabe del grupo:
//   ?id=<IdTransaccion> | ?match=<IdMatchTSD> | ?fila=<IdFilaCorte>
session_start();
require_once '../db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$id    = trim($_GET['id'] ?? '');
$match = trim($_GET['match'] ?? '');
$fila  = trim($_GET['fila'] ?? '');

if ($id === '' && $match === '' && !ctype_digit($fila)) {
    echo json_encode(['success' => false, 'error' => 'Indique la transacción a consultar']); exit;
}

const MAX_TRANSACCIONES = 100;

// "?,?,?" para una lista de IDs
function marcas(array $lista): string {
    return implode(',', array_fill(0, count($lista), '?'));
}

function consultar(PDO $pdo, string $sql, array $params): array {
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

try {
    $pdo = Database::connect();

    // ------------------------------------------------------------
    // 1. Semillas: lo que el usuario tocó
    // ------------------------------------------------------------
    if ($id !== '') {
        $semillas = [$id];
    } elseif ($match !== '') {
        $semillas = array_column(consultar($pdo,
            "SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE IdMatchTSD = ?", [$match]), 'IdTransaccion');
    } else {
        $semillas = array_column(consultar($pdo,
            "SELECT IdTransaccion FROM Tbl_Auxiliar_Corte_Transacciones WHERE IdFilaCorte = ?", [(int)$fila]), 'IdTransaccion');
    }
    $semillas = array_values(array_unique(array_map('strval', $semillas)));

    if (!$semillas) {
        echo json_encode(['success' => true, 'encontrada' => false, 'semillas' => []]); exit;
    }
    $semillas = array_slice($semillas, 0, MAX_TRANSACCIONES);

    // ------------------------------------------------------------
    // 2. Grupo completo: todo lo que comparte IdMatchTSD con las semillas
    // ------------------------------------------------------------
    $ids = array_column(consultar($pdo, "
        SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE IdTransaccion IN (" . marcas($semillas) . ")
        UNION
        SELECT g.IdTransaccion
        FROM Tbl_Transacciones_Maestra g
        WHERE g.IdMatchTSD IN (
            SELECT s.IdMatchTSD FROM Tbl_Transacciones_Maestra s
            WHERE s.IdTransaccion IN (" . marcas($semillas) . ") AND s.IdMatchTSD IS NOT NULL
        )", array_merge($semillas, $semillas)), 'IdTransaccion');

    $ids = array_slice(array_values(array_unique(array_map('strval', $ids))), 0, MAX_TRANSACCIONES);

    if (!$ids) {
        // Existe fuera de IRI (p. ej. TSD en vivo todavía no consolidado)
        echo json_encode(['success' => true, 'encontrada' => false, 'semillas' => $semillas]); exit;
    }
    $in = marcas($ids);

    // ------------------------------------------------------------
    // 3. Datos por transacción
    // ------------------------------------------------------------
    $maestra   = consultar($pdo, "SELECT * FROM Tbl_Transacciones_Maestra WHERE IdTransaccion IN ($in)", $ids);
    $detBAC    = consultar($pdo, "SELECT * FROM Tbl_Detalle_BAC WHERE IdTransaccion IN ($in)", $ids);
    $detScotia = consultar($pdo, "SELECT * FROM Tbl_Detalle_Scotia WHERE IdTransaccion IN ($in)", $ids);
    $detTSD    = consultar($pdo, "SELECT * FROM Tbl_Detalle_TSD WHERE IdTransaccion IN ($in)", $ids);
    $auditoria = consultar($pdo, "SELECT * FROM Tbl_Ajustes_Auditoria WHERE IdTransaccion IN ($in)", $ids);

    // Cortes del Auxiliar donde apareció cada transacción
    $cortesTrx = consultar($pdo, "
        SELECT DISTINCT T.IdTransaccion,
               CONVERT(varchar(10), C.FechaRegistro, 23) AS FechaRegistro,
               F.Seccion, C.OrigenCaptura
        FROM Tbl_Auxiliar_Corte_Transacciones T
        INNER JOIN Tbl_Auxiliar_Corte_Filas F ON F.IdFilaCorte = T.IdFilaCorte
        INNER JOIN Tbl_Auxiliar_Cortes C ON C.IdCorte = F.IdCorte
        WHERE T.IdTransaccion IN ($in)
        ORDER BY FechaRegistro", $ids);

    // Folios (módulo 2 para bancos, consolidado TSD para TSD)
    $idsCierre = array_values(array_unique(array_filter(array_column($maestra, 'IdCierre'), fn($v) => $v !== null && $v !== '')));
    $cierres = $idsCierre ? consultar($pdo, "
        SELECT IdCierre, Usuario, Fuente, TotalConciliado, Folio,
               CONVERT(varchar(19), FechaCreacion, 120) AS FechaCreacion,
               CONVERT(varchar(19), ConsolidadoTSD, 120) AS ConsolidadoTSD
        FROM Tbl_Conciliacion_Cierres WHERE IdCierre IN (" . marcas($idsCierre) . ")", $idsCierre) : [];

    // Etiquetas de usuario
    $idsEtiq = array_values(array_unique(array_filter(array_column($maestra, 'ColorEtiqueta'), fn($v) => ctype_digit((string)$v))));
    $etiquetas = $idsEtiq ? consultar($pdo,
        "SELECT IdEtiqueta, Nombre, ColorCSS FROM Tbl_Etiquetas_M4 WHERE IdEtiqueta IN (" . marcas($idsEtiq) . ")", $idsEtiq) : [];

    // Corte guardado en la fecha contable de cada conciliación
    $fechasConc = array_values(array_unique(array_filter(array_map(
        fn($r) => $r['FechaConciliacion'] ? substr((string)$r['FechaConciliacion'], 0, 10) : null, $maestra))));
    $cortesConc = $fechasConc ? consultar($pdo, "
        SELECT CONVERT(varchar(10), FechaRegistro, 23) AS FechaRegistro,
               CONVERT(varchar(19), FechaCapturaReal, 120) AS FechaCapturaReal,
               UsuarioUltimo, OrigenCaptura
        FROM Tbl_Auxiliar_Cortes WHERE FechaRegistro IN (" . marcas($fechasConc) . ")", $fechasConc) : [];

    // ------------------------------------------------------------
    // 4. Depósitos (módulo 2) de las ventas bancarias del grupo.
    //    Misma regla que get_forense_m4.php: el depósito exacto se reconoce
    //    por el número que trae la descripción (PCA en Davibank, LIQ en BAC).
    // ------------------------------------------------------------
    $ventas = array_values(array_map(fn($r) => (string)$r['IdTransaccion'], array_filter($maestra,
        fn($r) => strtoupper((string)$r['Banco']) !== 'TSD' && $r['Origen'] !== 'PAGADO' && $r['IdMatch'] !== null && $r['IdMatch'] !== '')));

    $pagado = [];
    if ($ventas) {
        $inV = marcas($ventas);
        $baseP = "
            SELECT m.IdTransaccion, m.Banco, m.IdMatch, m.MontoBruto,
                   pb.Referencia AS BacRef, CONVERT(varchar(10), pb.Fecha, 23) AS BacFecha, pb.Descripcion AS BacDesc,
                   pb.Creditos AS BacCred, pb.Debitos AS BacDebitos,
                   ps.Numero_Referencia AS ScoRef, CONVERT(varchar(10), ps.Fecha_Movimiento, 23) AS ScoFecha,
                   ps.Descripcion AS ScoDesc, ps.Monto AS ScoMonto, ps.Credito_Debito
            FROM Tbl_Transacciones_Maestra m
            LEFT JOIN Tbl_Pagado_BAC    pb ON m.IdTransaccion = pb.IdTransaccion
            LEFT JOIN Tbl_Pagado_Scotia ps ON m.IdTransaccion = ps.IdTransaccion
            WHERE m.Origen = 'PAGADO'
              AND m.IdMatch IN (SELECT IdMatch FROM Tbl_Transacciones_Maestra WHERE IdTransaccion IN ($inV) AND IdMatch IS NOT NULL)";

        $pagado = consultar($pdo, $baseP . "
              AND (
                ( ps.Descripcion IS NOT NULL AND CHARINDEX('PCA', ps.Descripcion) > 0
                  AND LTRIM(RTRIM(SUBSTRING(
                        ps.Descripcion,
                        CHARINDEX('PCA', ps.Descripcion) + 4,
                        ISNULL(NULLIF(CHARINDEX(' ', ps.Descripcion + ' ', CHARINDEX('PCA', ps.Descripcion) + 4), 0), LEN(ps.Descripcion) + 1)
                            - (CHARINDEX('PCA', ps.Descripcion) + 4)
                      ))) IN (
                        SELECT LTRIM(RTRIM(s2.Numero_Pago)) FROM Tbl_Detalle_Scotia s2
                        WHERE s2.IdTransaccion IN ($inV) AND s2.Numero_Pago IS NOT NULL
                      )
                )
                OR
                ( pb.Descripcion IS NOT NULL AND CHARINDEX('LIQ', pb.Descripcion) > 0
                  AND LTRIM(RTRIM(SUBSTRING(pb.Descripcion, CHARINDEX('LIQ', pb.Descripcion) + 3, 50))) IN (
                        SELECT LTRIM(RTRIM(b2.NUMERO_LIQUIDACION)) FROM Tbl_Detalle_BAC b2
                        WHERE b2.IdTransaccion IN ($inV) AND b2.NUMERO_LIQUIDACION IS NOT NULL
                      )
                )
              )", array_merge($ventas, $ventas, $ventas));

        // Respaldo: si la descripción no trae el formato esperado
        if (!$pagado) $pagado = consultar($pdo, $baseP, $ventas);
    }

    // ------------------------------------------------------------
    // 4b. Ajustes manuales del módulo 2 hechos en la misma conciliación
    //     bancaria (comparten IdMatch). Traen su evidencia.
    // ------------------------------------------------------------
    $ajustesM2 = [];
    $idsMatchM2 = array_values(array_unique(array_filter(array_map(
        fn($r) => strtoupper((string)$r['Banco']) !== 'TSD' ? $r['IdMatch'] : null, $maestra),
        fn($v) => $v !== null && $v !== '')));
    if ($idsMatchM2) {
        $ajustesM2 = consultar($pdo, "
            SELECT m.IdTransaccion, m.Banco, m.IdMatch, m.MontoBruto, m.MontoNeto,
                   CONVERT(varchar(10), m.FechaTransaccion, 23) AS FechaTransaccion,
                   a.TipoAjuste, a.Justificacion, a.EvidenciaB64,
                   c.Usuario, CONVERT(varchar(19), c.FechaCreacion, 120) AS FechaCreacion
            FROM Tbl_Transacciones_Maestra m
            INNER JOIN Tbl_Ajustes_Auditoria a ON a.IdTransaccion = m.IdTransaccion
            LEFT JOIN Tbl_Conciliacion_Cierres c ON c.IdCierre = m.IdCierre
            WHERE m.Origen = 'AJUSTE'
              AND m.IdTransaccion NOT LIKE 'ADJM4-%'
              AND m.IdMatch IN (" . marcas($idsMatchM2) . ")", $idsMatchM2);
    }

    // ------------------------------------------------------------
    // 5. Armado por transacción
    // ------------------------------------------------------------
    $porId = fn(array $filas) => array_column($filas, null, 'IdTransaccion');
    $mBAC = $porId($detBAC); $mSco = $porId($detScotia); $mTSD = $porId($detTSD); $mAud = $porId($auditoria);
    $mCierre = array_column($cierres, null, 'IdCierre');
    $mEtiq   = array_column($etiquetas, null, 'IdEtiqueta');
    $mCorte  = array_column($cortesConc, null, 'FechaRegistro');

    $transacciones = array_map(function ($m) use ($mBAC, $mSco, $mTSD, $mAud, $mCierre, $mEtiq, $mCorte, $cortesTrx, $semillas) {
        $idT = (string)$m['IdTransaccion'];
        $fConc = $m['FechaConciliacion'] ? substr((string)$m['FechaConciliacion'], 0, 10) : null;

        // ¿El corte del día se guardó junto con esta conciliación? (≤ 5 min)
        $corte = $fConc && isset($mCorte[$fConc]) ? $mCorte[$fConc] : null;
        if ($corte) {
            $tReal  = $m['FechaRealConciliacion'] ? strtotime((string)$m['FechaRealConciliacion']) : false;
            $tCorte = strtotime((string)$corte['FechaCapturaReal']);
            $corte['CoincideConConciliacion'] = ($tReal && $tCorte) ? abs($tCorte - $tReal) <= 300 : null;
        }

        return [
            'IdTransaccion' => $idT,
            'EsSemilla'     => in_array($idT, $semillas, true),
            'maestra'       => $m,
            'detalle'       => $mBAC[$idT] ?? $mSco[$idT] ?? $mTSD[$idT] ?? null,
            'tablaDetalle'  => isset($mBAC[$idT]) ? 'Tbl_Detalle_BAC' : (isset($mSco[$idT]) ? 'Tbl_Detalle_Scotia' : (isset($mTSD[$idT]) ? 'Tbl_Detalle_TSD' : null)),
            'auditoria'     => $mAud[$idT] ?? null,
            'cierre'        => ($m['IdCierre'] !== null && isset($mCierre[$m['IdCierre']])) ? $mCierre[$m['IdCierre']] : null,
            'etiqueta'      => isset($mEtiq[$m['ColorEtiqueta'] ?? '']) ? $mEtiq[$m['ColorEtiqueta']] : null,
            'cortes'        => array_values(array_filter($cortesTrx, fn($c) => (string)$c['IdTransaccion'] === $idT)),
            'corteConciliacion' => $corte
        ];
    }, $maestra);

    echo json_encode([
        'success'       => true,
        'encontrada'    => true,
        'semillas'      => $semillas,
        'transacciones' => $transacciones,
        'pagado'        => $pagado,
        'ajustesM2'     => $ajustesM2
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

} catch (\Throwable $e) {
    echo json_encode(['success' => false, 'error' => 'Error al consultar la transacción: ' . $e->getMessage()]);
}
?>