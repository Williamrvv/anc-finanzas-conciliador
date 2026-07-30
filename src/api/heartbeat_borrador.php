<?php
// ============================================================================
//  heartbeat_borrador.php  —  Endpoint ÚNICO de borradores compartidos (M2)
//  action:  beat | meta | get | save | delete
//
//  Reglas de negocio:
//   - Un solo borrador EN_CURSO por módulo (índice único filtrado en la tabla).
//   - Presencia por latido: candado ajeno "vencido" tras STALE_MIN sin latido.
//   - Los DIFERIDOS viven en Tbl_Transacciones_Maestra y NUNCA se tocan aquí.
//   - session_start() en cada latido refresca la sesión (absorbe el keepalive).
// ============================================================================
ini_set('display_errors', 0);
error_reporting(E_ALL);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$STALE_MIN  = 3; // minutos sin latido para liberar un candado ajeno
$emailUser  = $_SESSION['user']['email'] ?? 'Sistema';

$raw    = file_get_contents('php://input');
$body   = json_decode($raw, true);
if (!is_array($body)) $body = [];
$action = $body['action'] ?? ($_GET['action'] ?? '');
$modulo = $body['modulo'] ?? ($_GET['modulo'] ?? 'M2');

try {
    $pdo = Database::connect();

    $getRow = function () use ($pdo, $modulo, $STALE_MIN) {
        $stale = (int) $STALE_MIN;
        $sql = "SELECT TOP 1 b.IdBorrador, b.[Version], b.EnEdicion, b.UsuarioActivo,
                       b.FechaHeartbeat, b.UsuarioInicio, b.UsuarioUltimo, b.FechaInicio,
                       b.FechaUltimo, b.TamanoBytes, b.Comprimido,
                       CASE WHEN b.FechaHeartbeat > DATEADD(MINUTE, -$stale, GETDATE())
                            THEN 1 ELSE 0 END AS Fresco,
                       LTRIM(RTRIM(ISNULL(ua.Nombre,'') + ' ' + ISNULL(ua.Apellidos,''))) AS NombreActivo,
                       LTRIM(RTRIM(ISNULL(ui.Nombre,'') + ' ' + ISNULL(ui.Apellidos,''))) AS NombreInicio,
                       LTRIM(RTRIM(ISNULL(uu.Nombre,'') + ' ' + ISNULL(uu.Apellidos,''))) AS NombreUltimo
                FROM Tbl_Conciliacion_Borradores b
                LEFT JOIN Tbl_Usuarios ua ON ua.Email = b.UsuarioActivo
                LEFT JOIN Tbl_Usuarios ui ON ui.Email = b.UsuarioInicio
                LEFT JOIN Tbl_Usuarios uu ON uu.Email = b.UsuarioUltimo
                WHERE b.Modulo = :m AND b.Estado = 'EN_CURSO'";
        $st = $pdo->prepare($sql);
        $st->execute([':m' => $modulo]);
        return $st->fetch(PDO::FETCH_ASSOC);
    };

    $ocupadoPor = function ($row) use ($emailUser) {
        if (!$row) return null;
        if (!$row['EnEdicion']) return null;
        if (empty($row['UsuarioActivo']) || $row['UsuarioActivo'] === $emailUser) return null;
        if (!$row['Fresco']) return null;
        return $row['NombreActivo'] ?: $row['UsuarioActivo'];
    };

    switch ($action) {

        case 'beat': {
            $row = $getRow();
            if (!$row) { echo json_encode(['success' => true, 'existe' => false, 'ocupado' => false]); break; }
            $ocu = $ocupadoPor($row);
            if ($ocu !== null) {
                echo json_encode(['success' => true, 'existe' => true, 'ocupado' => true,
                                  'ocupadoPor' => $ocu, 'version' => (int)$row['Version']]);
                break;
            }
            $up = $pdo->prepare("UPDATE Tbl_Conciliacion_Borradores
                                 SET EnEdicion = 1, UsuarioActivo = :me, FechaHeartbeat = GETDATE()
                                 WHERE IdBorrador = :id");
            $up->execute([':me' => $emailUser, ':id' => $row['IdBorrador']]);
            echo json_encode(['success' => true, 'existe' => true, 'ocupado' => false,
                              'mio' => true, 'version' => (int)$row['Version']]);
            break;
        }

        case 'meta': {
            $row = $getRow();
            if (!$row) { echo json_encode(['success' => true, 'existe' => false]); break; }
            $ocu = $ocupadoPor($row);
            echo json_encode([
                'success' => true, 'existe' => true,
                'version' => (int)$row['Version'], 'tamano' => (int)$row['TamanoBytes'],
                'comprimido' => (int)$row['Comprimido'],
                'usuarioInicio' => $row['NombreInicio'] ?: $row['UsuarioInicio'],
                'usuarioUltimo' => $row['NombreUltimo'] ?: $row['UsuarioUltimo'],
                'fechaInicio' => $row['FechaInicio'], 'fechaUltimo' => $row['FechaUltimo'],
                'ocupado' => $ocu !== null, 'ocupadoPor' => $ocu,
                'iniciadoPorMi' => ($row['UsuarioInicio'] === $emailUser),
            ]);
            break;
        }

        case 'get': {
            $st = $pdo->prepare("SELECT TOP 1 DataJson, [Version], Comprimido
                                 FROM Tbl_Conciliacion_Borradores
                                 WHERE Modulo = :m AND Estado = 'EN_CURSO'");
            $st->execute([':m' => $modulo]);
            $r = $st->fetch(PDO::FETCH_ASSOC);
            if (!$r) { echo json_encode(['success' => true, 'existe' => false]); break; }
            echo json_encode(['success' => true, 'existe' => true,
                              'dataJson' => $r['DataJson'], 'version' => (int)$r['Version'],
                              'comprimido' => (int)$r['Comprimido']]);
            break;
        }

        case 'save': {
            $dataJson    = $body['dataJson'] ?? null;
            $baseVersion = (int)($body['baseVersion'] ?? 0);
            $tipo        = ($body['tipo'] ?? 'auto') === 'manual' ? 'manual' : 'auto';
            $comprimido  = (int)($body['comprimido'] ?? 0);
            $tamano      = (int)($body['tamano'] ?? ($dataJson !== null ? strlen($dataJson) : 0));

            if ($dataJson === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'dataJson vacío.']);
                break;
            }

            $row = $getRow();

            if (!$row) {
                try {
                    $ins = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Borradores
                        (Modulo, Estado, DataJson, Comprimido, [Version], TamanoBytes, EnEdicion,
                         UsuarioActivo, FechaHeartbeat, UsuarioInicio, UsuarioUltimo, FechaInicio, FechaUltimo)
                        VALUES (:m, 'EN_CURSO', :d, :c, 1, :t, 1, :me, GETDATE(), :me, :me, GETDATE(), GETDATE())");
                    $ins->bindParam(':m',  $modulo);
                    $ins->bindParam(':d',  $dataJson, PDO::PARAM_STR);
                    $ins->bindParam(':c',  $comprimido, PDO::PARAM_INT);
                    $ins->bindParam(':t',  $tamano, PDO::PARAM_INT);
                    $ins->bindParam(':me', $emailUser);
                    $ins->execute();
                    echo json_encode(['success' => true, 'ok' => true, 'version' => 1, 'creado' => true]);
                } catch (PDOException $e) {
                    $fresh = $getRow();
                    echo json_encode(['success' => true, 'ok' => false, 'conflict' => true,
                                      'version' => $fresh ? (int)$fresh['Version'] : 0]);
                }
                break;
            }

            if ($tipo === 'manual') {
                $sql = "UPDATE Tbl_Conciliacion_Borradores
                        SET DataJson = :d, Comprimido = :c, TamanoBytes = :t,
                            [Version] = [Version] + 1, UsuarioUltimo = :me, FechaUltimo = GETDATE()
                        WHERE IdBorrador = :id AND [Version] = :base";
            } else {
                $sql = "UPDATE Tbl_Conciliacion_Borradores
                        SET DataJson = :d, Comprimido = :c, TamanoBytes = :t,
                            [Version] = [Version] + 1, UsuarioUltimo = :me, FechaUltimo = GETDATE(),
                            EnEdicion = 1, UsuarioActivo = :me, FechaHeartbeat = GETDATE()
                        WHERE IdBorrador = :id AND [Version] = :base";
            }
            $up = $pdo->prepare($sql);
            $up->bindParam(':d',    $dataJson, PDO::PARAM_STR);
            $up->bindParam(':c',    $comprimido, PDO::PARAM_INT);
            $up->bindParam(':t',    $tamano, PDO::PARAM_INT);
            $up->bindParam(':me',   $emailUser);
            $up->bindValue(':id',   (int)$row['IdBorrador'], PDO::PARAM_INT);
            $up->bindValue(':base', $baseVersion, PDO::PARAM_INT);
            $up->execute();

            if ($up->rowCount() === 0) {
                $fresh = $getRow();
                echo json_encode(['success' => true, 'ok' => false, 'conflict' => true,
                                  'version' => $fresh ? (int)$fresh['Version'] : 0]);
            } else {
                echo json_encode(['success' => true, 'ok' => true, 'version' => $baseVersion + 1]);
            }
            break;
        }

        case 'delete': {
            $del = $pdo->prepare("DELETE FROM Tbl_Conciliacion_Borradores
                                  WHERE Modulo = :m AND Estado = 'EN_CURSO'");
            $del->execute([':m' => $modulo]);
            echo json_encode(['success' => true, 'ok' => true, 'borrados' => $del->rowCount()]);
            break;
        }

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Acción no reconocida: ' . $action]);
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}