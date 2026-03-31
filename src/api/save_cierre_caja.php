<?php
ini_set('display_errors', 0); // Prohíbe a PHP escupir HTML
error_reporting(E_ALL);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
// Cargar la conexión TSD solo si existe para evitar fatal errors
if (file_exists('tsd_db.php')) {
    require_once 'tsd_db.php'; 
}

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data || empty($data['transacciones'])) {
    echo json_encode(['success' => false, 'error' => 'Datos incompletos o vacíos.']);
    exit;
}

$icd = $data['icd'] ?? '';
$emailUsuario = $_SESSION['user']['email'] ?? null;

if (!$emailUsuario) {
    echo json_encode(['success' => false, 'error' => 'Error de sesión: Correo de usuario no encontrado.']);
    exit;
}

try {
    // 1. VALIDACIÓN JUST-IN-TIME EN TSD
    if (class_exists('TSDDatabase')) {
        $pdoTsd = TSDDatabase::connect();
        $stmtTsd = $pdoTsd->prepare("SELECT TOP (1) POST_FLAG FROM dbo.DBR WHERE DBRNum = ?");
        $stmtTsd->execute([$icd]);
        $rowTsd = $stmtTsd->fetch();

        if (!$rowTsd) {
            echo json_encode(['success' => false, 'error' => "El ICD '$icd' no existe en TSD."]);
            exit;
        }

        if (empty($rowTsd['POST_FLAG']) || $rowTsd['POST_FLAG'] == '0') {
            echo json_encode([
                'success' => false, 
                'error' => "⚠️ Cierre Incompleto en TSD.\n\nEl ICD $icd aún se encuentra en estado 'Pre-Cierre'. Finalice el proceso en TSD antes de guardar en IRI."
            ]);
            exit;
        }
    }

    // 2. GUARDADO EN BASE DE DATOS LOCAL
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // Cabecera
    $sqlHeader = "INSERT INTO Tbl_CierreCaja_Header 
                  (ICD, Sucursal, UsuarioRegistroTSD, FechaRegistroTSD, EmailUsuario, TotalVerificadoCRC, TotalVerificadoUSD, TransaccionesEscaneadas, TotalTransacciones) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $fechaTSD = null;
    if (!empty($data['fecha_tsd']) && $data['fecha_tsd'] !== 'N/A') {
        $rawDate = explode('.', $data['fecha_tsd'])[0]; 
        $ts = strtotime($rawDate);
        if ($ts !== false) $fechaTSD = date('Y-m-d\TH:i:s', $ts);
    }

    $stmtH = $pdo->prepare($sqlHeader);
    $stmtH->execute([
        $icd, $data['sucursal'], $data['usuario_tsd'], $fechaTSD, 
        $emailUsuario, floatval($data['total_crc'] ?? 0), floatval($data['total_usd'] ?? 0),
        intval($data['total_escaneadas'] ?? 0), intval($data['total_transacciones'] ?? 0)
    ]);
    
    $idCierre = $pdo->lastInsertId();

    // Detalle
    $sqlDetail = "INSERT INTO Tbl_CierreCaja_Detalle 
                  (IdCierre, Numero_Contrato, NombreCliente, Tipo_Tarjeta, Numero_Autorizacion, MontoUSD, TipoCambio, MontoCRC, MatchExitoso) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmtD = $pdo->prepare($sqlDetail);

    foreach ($data['transacciones'] as $t) {
        $stmtD->execute([
            $idCierre, $t['contrato'], $t['nombre'], $t['tarjeta'], $t['autorizacion'],
            $t['monto_usd'], $t['tc'], $t['monto_crc'], $t['match_exitoso']
        ]);
    }

    // Casos Borrador (NO_REPORTADO)
    if (!empty($data['casos_borrador'])) {
        $sqlCaso = "INSERT INTO Tbl_Casos_TSD 
                    (IdCierreOrigen, ICD_Relacionado, Sucursal_Relacionada, NumeroContrato, NombreCliente, MontoCRC, MotivoAgente, Estado, EmailCreador) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'NO_REPORTADO', ?)";
        $stmtCaso = $pdo->prepare($sqlCaso);

        $sqlHist = "INSERT INTO Tbl_Casos_Historial 
                    (IdCaso, Accion, EmailActor, ComentarioAdicional) 
                    VALUES (?, 'CREADO_BORRADOR', ?, 'Inconsistencia detectada durante el Cierre de Cajas.')";
        $stmtHist = $pdo->prepare($sqlHist);

        foreach ($data['casos_borrador'] as $caso) {
            $motivoSeguro = empty($caso['motivo']) ? "" : $caso['motivo'];
            $stmtCaso->execute([
                $idCierre, $icd, $data['sucursal'], $caso['contrato'], $caso['cliente'],
                $caso['monto_crc'], $motivoSeguro, $emailUsuario
            ]);
            
            $idCaso = $pdo->lastInsertId();
            $stmtHist->execute([$idCaso, $emailUsuario]);
        }
    }

    $pdo->commit();

    echo json_encode(['success' => true, 'id_cierre' => $idCierre]);

} catch (Throwable $e) { // <--- ESTO EVITA EL ERROR RARO DE CONSOLA
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['success' => false, 'error' => 'Error PHP: ' . $e->getMessage()]);
}
?>