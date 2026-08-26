<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

session_start();

header('Content-Type: application/json; charset=utf-8');

require_once '../db.php';

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

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    $input = [];
}

$action = trim($input['action'] ?? '');
$inicio = trim($input['inicio'] ?? '');
$fin    = trim($input['fin'] ?? '');

$validarFecha = function ($valor) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $valor)) {
        return false;
    }

    [$anio, $mes, $dia] = array_map('intval', explode('-', $valor));

    return checkdate($mes, $dia, $anio);
};

if (
    !$validarFecha($inicio) ||
    !$validarFecha($fin) ||
    $inicio > $fin
) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'El rango de fechas indicado no es válido.'
    ]);
    exit;
}

$emailUsuario = trim($_SESSION['user']['email'] ?? '');

if ($emailUsuario === '') {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'No fue posible identificar al usuario.'
    ]);
    exit;
}

try {
    $pdo = Database::connect();

    switch ($action) {
        case 'get':

            $stmt = $pdo->prepare("
                SELECT TOP 1
                    B.IdBorrador,
                    B.DataJson,
                    B.UsuarioInicio,
                    B.UsuarioUltimo,
                    CONVERT(varchar(19), B.FechaCreacion, 120) AS FechaCreacion,
                    CONVERT(varchar(19), B.FechaActualizacion, 120) AS FechaActualizacion,
                    LTRIM(RTRIM(
                        ISNULL(UI.Nombre, '') + ' ' + ISNULL(UI.Apellidos, '')
                    )) AS NombreInicio,
                    LTRIM(RTRIM(
                        ISNULL(UU.Nombre, '') + ' ' + ISNULL(UU.Apellidos, '')
                    )) AS NombreUltimo
                FROM Tbl_Borradores_TSD_M3 B
                LEFT JOIN Tbl_Usuarios UI
                    ON UI.Email = B.UsuarioInicio
                LEFT JOIN Tbl_Usuarios UU
                    ON UU.Email = B.UsuarioUltimo
                WHERE B.FechaDesde = CONVERT(date, ?, 23)
                  AND B.FechaHasta = CONVERT(date, ?, 23)
            ");

            $stmt->execute([$inicio, $fin]);

            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                echo json_encode([
                    'success' => true,
                    'existe' => false
                ]);
                exit;
            }

            $nombreInicio = trim($row['NombreInicio'] ?? '');
            $nombreUltimo = trim($row['NombreUltimo'] ?? '');

            echo json_encode([
                'success' => true,
                'existe' => true,
                'dataJson' => $row['DataJson'],
                'usuarioInicio' => $nombreInicio !== ''
                    ? $nombreInicio
                    : $row['UsuarioInicio'],
                'usuarioUltimo' => $nombreUltimo !== ''
                    ? $nombreUltimo
                    : $row['UsuarioUltimo'],
                'fechaCreacion' => $row['FechaCreacion'],
                'fechaActualizacion' => $row['FechaActualizacion']
            ]);
            exit;

        case 'save':

            $dataJson = $input['dataJson'] ?? null;

            if (!is_string($dataJson) || $dataJson === '') {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'El borrador recibido está vacío.'
                ]);
                exit;
            }

            $decoded = json_decode($dataJson, true);

            if (!is_array($decoded)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'El borrador recibido no contiene JSON válido.'
                ]);
                exit;
            }

            $pdo->beginTransaction();

            $stmtExiste = $pdo->prepare("
                SELECT IdBorrador
                FROM Tbl_Borradores_TSD_M3 WITH (UPDLOCK, HOLDLOCK)
                WHERE FechaDesde = CONVERT(date, ?, 23)
                  AND FechaHasta = CONVERT(date, ?, 23)
            ");

            $stmtExiste->execute([$inicio, $fin]);

            $idBorrador = $stmtExiste->fetchColumn();

            if ($idBorrador) {
                $stmt = $pdo->prepare("
                    UPDATE Tbl_Borradores_TSD_M3
                    SET DataJson = ?,
                        UsuarioUltimo = ?,
                        FechaActualizacion = GETDATE()
                    WHERE IdBorrador = ?
                ");

                $stmt->execute([
                    $dataJson,
                    $emailUsuario,
                    $idBorrador
                ]);
            } else {
                $stmt = $pdo->prepare("
                    INSERT INTO Tbl_Borradores_TSD_M3
                    (
                        FechaDesde,
                        FechaHasta,
                        DataJson,
                        UsuarioInicio,
                        UsuarioUltimo
                    )
                    VALUES
                    (
                        CONVERT(date, ?, 23),
                        CONVERT(date, ?, 23),
                        ?,
                        ?,
                        ?
                    )
                ");

                $stmt->execute([
                    $inicio,
                    $fin,
                    $dataJson,
                    $emailUsuario,
                    $emailUsuario
                ]);
            }

            $pdo->commit();

            echo json_encode([
                'success' => true
            ]);
            exit;

        case 'delete':

            $stmt = $pdo->prepare("
                DELETE FROM Tbl_Borradores_TSD_M3
                WHERE FechaDesde = CONVERT(date, ?, 23)
                  AND FechaHasta = CONVERT(date, ?, 23)
            ");

            $stmt->execute([$inicio, $fin]);

            echo json_encode([
                'success' => true,
                'eliminados' => $stmt->rowCount()
            ]);
            exit;

        default:

            http_response_code(400);

            echo json_encode([
                'success' => false,
                'error' => 'Acción no reconocida.'
            ]);
            exit;
    }

} catch (\Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>