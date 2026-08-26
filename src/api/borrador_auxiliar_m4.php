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

    if ($action === 'get') {

        $stmt = $pdo->query("
            SELECT
                IdBorrador,
                DataJson,
                UsuarioInicio,
                UsuarioUltimo,
                CONVERT(varchar(19), FechaCreacion, 120) AS FechaCreacion,
                CONVERT(varchar(19), FechaActualizacion, 120) AS FechaActualizacion
            FROM Tbl_Borrador_Auxiliar_M4
            WHERE IdBorrador = 1
        ");

        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            echo json_encode([
                'success' => true,
                'existe' => false
            ]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'existe' => true,
            'dataJson' => $row['DataJson'],
            'fechaActualizacion' => $row['FechaActualizacion']
        ]);
        exit;
    }

    if ($action === 'save') {

        $dataJson = $input['dataJson'] ?? '';

        if (!is_string($dataJson) || $dataJson === '') {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'error' => 'El borrador recibido está vacío.'
            ]);
            exit;
        }

        $decoded = json_decode($dataJson, true);

        if (
            !is_array($decoded) ||
            !isset($decoded['manualMatches']) ||
            !isset($decoded['blacklist']) ||
            !is_array($decoded['manualMatches']) ||
            !is_array($decoded['blacklist'])
        ) {
            http_response_code(400);

            echo json_encode([
                'success' => false,
                'error' => 'El estado recibido no es válido.'
            ]);
            exit;
        }

        $pdo->beginTransaction();

        $stmtExiste = $pdo->query("
            SELECT IdBorrador
            FROM Tbl_Borrador_Auxiliar_M4 WITH (UPDLOCK, HOLDLOCK)
            WHERE IdBorrador = 1
        ");

        $existe = $stmtExiste->fetchColumn();

        if ($existe) {

            $stmt = $pdo->prepare("
                UPDATE Tbl_Borrador_Auxiliar_M4
                SET DataJson = ?,
                    UsuarioUltimo = ?,
                    FechaActualizacion = GETDATE()
                WHERE IdBorrador = 1
            ");

            $stmt->execute([
                $dataJson,
                $emailUsuario
            ]);

        } else {

            $stmt = $pdo->prepare("
                INSERT INTO Tbl_Borrador_Auxiliar_M4
                (
                    IdBorrador,
                    DataJson,
                    UsuarioInicio,
                    UsuarioUltimo
                )
                VALUES
                (
                    1,
                    ?,
                    ?,
                    ?
                )
            ");

            $stmt->execute([
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
    }

    if ($action === 'delete') {

        $stmt = $pdo->prepare("
            DELETE FROM Tbl_Borrador_Auxiliar_M4
            WHERE IdBorrador = 1
        ");

        $stmt->execute();

        echo json_encode([
            'success' => true
        ]);
        exit;
    }

    http_response_code(400);

    echo json_encode([
        'success' => false,
        'error' => 'Acción no reconocida.'
    ]);

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