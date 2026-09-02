<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

session_start();
require_once '../db.php';

header('Content-Type: application/json; charset=utf-8');

if (
    !isset($_SESSION['user']) ||
    !in_array($_SESSION['user']['role'] ?? '', ['admin', 'conciliador'], true)
) {
    http_response_code(401);

    echo json_encode([
        'success' => false,
        'error' => 'Acceso denegado'
    ]);

    exit;
}

$input = json_decode(
    file_get_contents('php://input'),
    true
);

if (!is_array($input)) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'error' => 'Payload inválido.'
    ]);

    exit;
}

$fechaRegistro = trim(
    $input['fechaRegistro'] ?? ''
);

$origenCaptura = strtoupper(trim(
    $input['origenCaptura'] ?? ''
));

$corteAuxiliar = $input['corteAuxiliar'] ?? null;

$filas = is_array($corteAuxiliar)
    ? ($corteAuxiliar['filas'] ?? null)
    : null;

$usuario = trim(
    $_SESSION['user']['email'] ?? ''
);

$validarFecha = static function (string $valor): bool {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor)) {
        return false;
    }

    [$anio, $mes, $dia] = array_map(
        'intval',
        explode('-', $valor)
    );

    return checkdate($mes, $dia, $anio);
};

$cortarTexto = static function (
    $valor,
    int $maximo
): ?string {
    if ($valor === null) {
        return null;
    }

    $texto = trim((string)$valor);

    if ($texto === '') {
        return null;
    }

    if (function_exists('mb_substr')) {
        return mb_substr(
            $texto,
            0,
            $maximo,
            'UTF-8'
        );
    }

    return substr($texto, 0, $maximo);
};

$numero = static function ($valor): float {
    return is_numeric($valor)
        ? round((float)$valor, 2)
        : 0.0;
};

try {
    if (!$validarFecha($fechaRegistro)) {
        throw new InvalidArgumentException(
            'La fecha de registro del auxiliar no es válida.'
        );
    }

    $hoyCR = (
        new DateTimeImmutable(
            'now',
            new DateTimeZone('America/Costa_Rica')
        )
    )->format('Y-m-d');

    if ($fechaRegistro > $hoyCR) {
        throw new InvalidArgumentException(
            'La fecha de registro del auxiliar no puede estar en el futuro.'
        );
    }

    if (!in_array($origenCaptura, ['M3', 'M4'], true)) {
        throw new InvalidArgumentException(
            'El origen de la captura no es válido.'
        );
    }

    if ($usuario === '') {
        throw new InvalidArgumentException(
            'No fue posible identificar al usuario.'
        );
    }

    if (!is_array($filas)) {
        throw new InvalidArgumentException(
            'No se recibió el auxiliar completo.'
        );
    }

    if (count($filas) > 20000) {
        throw new InvalidArgumentException(
            'El corte excede el máximo permitido de 20.000 filas.'
        );
    }

    $filasNormalizadas = [];
    $idsGlobales = [];
    $totalTransacciones = 0;

    foreach ($filas as $indice => $fila) {
        if (!is_array($fila)) {
            throw new InvalidArgumentException(
                'La fila ' . ($indice + 1) .
                ' del corte no es válida.'
            );
        }

        $seccion = strtoupper(trim(
            $fila['seccion'] ?? ''
        ));

        if (
            !in_array(
                $seccion,
                ['BANDEJA', 'APROBADA_MANUAL'],
                true
            )
        ) {
            throw new InvalidArgumentException(
                'La sección de la fila ' .
                ($indice + 1) .
                ' no es válida.'
            );
        }

        $transacciones =
            $fila['transacciones'] ?? null;

        if (
            !is_array($transacciones) ||
            count($transacciones) === 0
        ) {
            throw new InvalidArgumentException(
                'La fila ' . ($indice + 1) .
                ' no contiene IDs de transacción.'
            );
        }

        $transaccionesNormalizadas = [];
        $idsFila = [];

        foreach (
            $transacciones as
            $indiceTransaccion => $transaccion
        ) {
            if (!is_array($transaccion)) {
                throw new InvalidArgumentException(
                    'Una transacción de la fila ' .
                    ($indice + 1) .
                    ' no es válida.'
                );
            }

            $idTransaccion = trim((string)(
                $transaccion['idTransaccion'] ?? ''
            ));

            $lado = strtoupper(trim((string)(
                $transaccion['lado'] ?? ''
            )));

            $banco = trim((string)(
                $transaccion['banco'] ?? ''
            ));

            if (
                $idTransaccion === '' ||
                strlen($idTransaccion) > 50
            ) {
                throw new InvalidArgumentException(
                    'La fila ' . ($indice + 1) .
                    ' contiene un IdTransaccion inválido.'
                );
            }

            if (
                !in_array(
                    $lado,
                    ['TSD', 'BANCO'],
                    true
                )
            ) {
                throw new InvalidArgumentException(
                    'La fila ' . ($indice + 1) .
                    ' contiene un lado inválido.'
                );
            }

            if (isset($idsFila[$idTransaccion])) {
                continue;
            }

            if (isset($idsGlobales[$idTransaccion])) {
                throw new InvalidArgumentException(
                    "La transacción {$idTransaccion} " .
                    'aparece en más de una fila del corte.'
                );
            }

            $idsFila[$idTransaccion] = true;
            $idsGlobales[$idTransaccion] = true;

            $transaccionesNormalizadas[] = [
                'idTransaccion' => $idTransaccion,
                'lado' => $lado,

                'banco' => $cortarTexto(
                    $lado === 'TSD'
                        ? 'TSD'
                        : (
                            $banco !== ''
                                ? $banco
                                : 'BANCO'
                        ),
                    20
                ),

                'ordenEnGrupo' => max(
                    1,
                    (int)(
                        $transaccion['ordenEnGrupo'] ??
                        ($indiceTransaccion + 1)
                    )
                )
            ];
        }

        if (count($transaccionesNormalizadas) === 0) {
            throw new InvalidArgumentException(
                'La fila ' . ($indice + 1) .
                ' quedó sin IDs válidos.'
            );
        }

        $categoriaId =
            isset($fila['categoriaId']) &&
            is_numeric($fila['categoriaId'])
                ? (int)$fila['categoriaId']
                : null;

        $idEtiqueta =
            isset($fila['idEtiqueta']) &&
            is_numeric($fila['idEtiqueta'])
                ? (int)$fila['idEtiqueta']
                : null;

        $filasNormalizadas[] = [
            'seccion' => $seccion,

            'ordenVisual' => max(
                1,
                (int)(
                    $fila['ordenVisual'] ??
                    ($indice + 1)
                )
            ),

            'contrato' => $cortarTexto(
                $fila['contrato'] ?? null,
                500
            ),

            'cliente' => $cortarTexto(
                $fila['cliente'] ?? null,
                1000
            ),

            'authTSD' => $cortarTexto(
                $fila['authTSD'] ?? null,
                500
            ),

            'tsdDebito' => $numero(
                $fila['tsdDebito'] ?? 0
            ),

            'tsdCredito' => $numero(
                $fila['tsdCredito'] ?? 0
            ),

            'estadoAux' => $cortarTexto(
                $fila['estadoAux'] ?? null,
                1000
            ),

            'banco' => $cortarTexto(
                $fila['banco'] ?? null,
                200
            ),

            'authBanco' => $cortarTexto(
                $fila['authBanco'] ?? null,
                500
            ),

            'bancoDebito' => $numero(
                $fila['bancoDebito'] ?? 0
            ),

            'bancoCredito' => $numero(
                $fila['bancoCredito'] ?? 0
            ),

            'diferencia' => $numero(
                $fila['diferencia'] ?? 0
            ),

            'nota' => $cortarTexto(
                $fila['nota'] ?? null,
                1000
            ),

            'categoriaId' => $categoriaId,
            'idEtiqueta' => $idEtiqueta,

            'nombreEtiqueta' => $cortarTexto(
                $fila['nombreEtiqueta'] ?? null,
                100
            ),

            'colorCSS' => $cortarTexto(
                $fila['colorCSS'] ?? null,
                20
            ),

            'esMultiple' =>
                !empty($fila['esMultiple']) ? 1 : 0,

            'claseVisual' => $cortarTexto(
                $fila['claseVisual'] ?? null,
                1000
            ),

            'transacciones' =>
                $transaccionesNormalizadas
        ];

        $totalTransacciones +=
            count($transaccionesNormalizadas);
    }

    $pdo = Database::connect();
    $pdo->beginTransaction();

    /*
     * UPDLOCK + HOLDLOCK impide que dos usuarios
     * reemplacen simultáneamente el mismo día.
     */
    $stmtCorte = $pdo->prepare("
        SELECT IdCorte
        FROM Tbl_Auxiliar_Cortes
             WITH (UPDLOCK, HOLDLOCK)
        WHERE FechaRegistro = CONVERT(date, ?, 23)
    ");

    $stmtCorte->execute([$fechaRegistro]);

    $idCorte = $stmtCorte->fetchColumn();
    $reemplazado = $idCorte !== false;

    if ($reemplazado) {
        /*
         * Las relaciones se eliminan por cascada.
         * El corte viejo permanece visible hasta
         * que esta transacción complete el COMMIT.
         */
        $stmtEliminarFilas = $pdo->prepare("
            DELETE FROM Tbl_Auxiliar_Corte_Filas
            WHERE IdCorte = ?
        ");

        $stmtEliminarFilas->execute([$idCorte]);

        $stmtActualizarCorte = $pdo->prepare("
            UPDATE Tbl_Auxiliar_Cortes
            SET FechaCapturaReal = SYSDATETIME(),
                OrigenCaptura = ?,
                UsuarioUltimo = ?,
                CantidadFilas = 0,
                CantidadTransacciones = 0
            WHERE IdCorte = ?
        ");

        $stmtActualizarCorte->execute([
            $origenCaptura,
            $usuario,
            $idCorte
        ]);

    } else {
        $stmtInsertarCorte = $pdo->prepare("
            INSERT INTO Tbl_Auxiliar_Cortes
            (
                FechaRegistro,
                OrigenCaptura,
                UsuarioUltimo,
                CantidadFilas,
                CantidadTransacciones
            )
            OUTPUT INSERTED.IdCorte
            VALUES
            (
                CONVERT(date, ?, 23),
                ?,
                ?,
                0,
                0
            )
        ");

        $stmtInsertarCorte->execute([
            $fechaRegistro,
            $origenCaptura,
            $usuario
        ]);

        $idCorte =
            $stmtInsertarCorte->fetchColumn();
    }

    $stmtInsertarFila = $pdo->prepare("
        INSERT INTO Tbl_Auxiliar_Corte_Filas
        (
            IdCorte,
            Seccion,
            OrdenVisual,
            Contrato,
            Cliente,
            AuthTSD,
            TSD_Debito,
            TSD_Credito,
            EstadoAux,
            Banco,
            AuthBanco,
            Banco_Debito,
            Banco_Credito,
            Diferencia,
            Nota,
            CategoriaId,
            IdEtiqueta,
            NombreEtiqueta,
            ColorCSS,
            EsMultiple,
            ClaseVisual
        )
        OUTPUT INSERTED.IdFilaCorte
        VALUES
        (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
    ");

    $stmtInsertarTransaccion = $pdo->prepare("
        INSERT INTO
            Tbl_Auxiliar_Corte_Transacciones
        (
            IdFilaCorte,
            IdTransaccion,
            Lado,
            Banco,
            OrdenEnGrupo
        )
        VALUES (?, ?, ?, ?, ?)
    ");

    foreach ($filasNormalizadas as $fila) {
        $stmtInsertarFila->execute([
            $idCorte,
            $fila['seccion'],
            $fila['ordenVisual'],
            $fila['contrato'],
            $fila['cliente'],
            $fila['authTSD'],
            $fila['tsdDebito'],
            $fila['tsdCredito'],
            $fila['estadoAux'],
            $fila['banco'],
            $fila['authBanco'],
            $fila['bancoDebito'],
            $fila['bancoCredito'],
            $fila['diferencia'],
            $fila['nota'],
            $fila['categoriaId'],
            $fila['idEtiqueta'],
            $fila['nombreEtiqueta'],
            $fila['colorCSS'],
            $fila['esMultiple'],
            $fila['claseVisual']
        ]);

        $idFilaCorte =
            $stmtInsertarFila->fetchColumn();

        foreach (
            $fila['transacciones']
            as $transaccion
        ) {
            $stmtInsertarTransaccion->execute([
                $idFilaCorte,
                $transaccion['idTransaccion'],
                $transaccion['lado'],
                $transaccion['banco'],
                $transaccion['ordenEnGrupo']
            ]);
        }
    }

    $stmtTotales = $pdo->prepare("
        UPDATE Tbl_Auxiliar_Cortes
        SET CantidadFilas = ?,
            CantidadTransacciones = ?
        WHERE IdCorte = ?
    ");

    $stmtTotales->execute([
        count($filasNormalizadas),
        $totalTransacciones,
        $idCorte
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'idCorte' => $idCorte,
        'fechaRegistro' => $fechaRegistro,
        'reemplazado' => $reemplazado,
        'cantidadFilas' =>
            count($filasNormalizadas),
        'cantidadTransacciones' =>
            $totalTransacciones
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    if (
        isset($pdo) &&
        $pdo->inTransaction()
    ) {
        $pdo->rollBack();
    }

    http_response_code(
        $e instanceof InvalidArgumentException
            ? 400
            : 500
    );

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>