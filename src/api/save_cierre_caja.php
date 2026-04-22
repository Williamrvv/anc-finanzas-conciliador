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

$icdsRaw = $data['icds_involucrados'] ?? ''; // Ahora recibimos un string: "ICD1, ICD2"
$sucursalesRaw = $data['sucursales'] ?? '';
$emailUsuario = $_SESSION['user']['email'] ?? null;

if (!$emailUsuario) {
    echo json_encode(['success' => false, 'error' => 'Error de sesión: Correo de usuario no encontrado.']);
    exit;
}

try {
    // 1. VALIDACIÓN JUST-IN-TIME EN TSD (Múltiples ICDs)
    $icdsArray = array_filter(array_map('trim', explode(',', preg_replace('/\(.*?\)/', '', $icdsRaw)))); // Limpiamos los nombres de usuario entre paréntesis
    
    if (class_exists('TSDDatabase') && count($icdsArray) > 0) {
        $pdoTsd = TSDDatabase::connect();
        $inClause = str_repeat('?,', count($icdsArray) - 1) . '?';
        $stmtTsd = $pdoTsd->prepare("SELECT DBRNum, POST_FLAG FROM dbo.DBR WHERE DBRNum IN ($inClause)");
        $stmtTsd->execute($icdsArray);
        $resultadosTSD = $stmtTsd->fetchAll(PDO::FETCH_ASSOC);

        $abiertos = [];
        foreach ($resultadosTSD as $row) {
            if (empty($row['POST_FLAG']) || $row['POST_FLAG'] == '0') {
                $abiertos[] = $row['DBRNum'];
            }
        }

        if (!empty($abiertos)) {
            echo json_encode([
                'success' => false, 
                'error' => "⚠️ Cierre Incompleto en TSD.\n\nLos siguientes ICDs aún se encuentran abiertos: " . implode(', ', $abiertos) . "\nFinalice el proceso en TSD antes de guardar en IRI."
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
    
    // Al ser un cierre continuo, usamos la hora actual para FechaRegistroTSD como marca de corte
    $fechaTSD = date('Y-m-d\TH:i:s');

    $stmtH = $pdo->prepare($sqlHeader);
    $stmtH->execute([
        $icdsRaw, $sucursalesRaw, 'Múltiples AR', $fechaTSD, 
        $emailUsuario, floatval($data['total_crc'] ?? 0), floatval($data['total_usd'] ?? 0),
        intval($data['total_escaneadas'] ?? 0), intval($data['total_transacciones'] ?? 0)
    ]);
    
    $idCierre = $pdo->lastInsertId();

    // Detalle
    $sqlDetail = "INSERT INTO Tbl_CierreCaja_Detalle 
                  (IdCierre, Numero_Contrato, NombreCliente, Tipo_Tarjeta, Numero_Autorizacion, MontoUSD, TipoCambio, MontoCRC, MatchExitoso, Fecha_Transaccion) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmtD = $pdo->prepare($sqlDetail);

    $stmtCerrarTicket = $pdo->prepare("UPDATE Tbl_Casos_TSD SET Estado = 'CERRADO' WHERE IdCaso = ? AND Estado = 'RESUELTO'");
    $stmtHistCerrar = $pdo->prepare("INSERT INTO Tbl_Casos_Historial (IdCaso, Accion, EmailActor, ComentarioAdicional) VALUES (?, 'ESTADO_CERRADO', ?, 'Match Inteligente: El Agente Rentista vinculó la transacción de ajuste de TSD con este caso durante el Cierre de Cajas.')");

    foreach ($data['transacciones'] as $t) {
        // Formateo estricto ISO8601
        $fechaSegura = null;
        if (!empty($t['fecha_pago'])) {
            $timestamp = strtotime(str_replace('.000', '', $t['fecha_pago']));
            if ($timestamp !== false) {
                $fechaSegura = date('Y-m-d\TH:i:s', $timestamp);
            }
        }

        $stmtD->execute([
            $idCierre, $t['contrato'], $t['nombre'], $t['tarjeta'], $t['autorizacion'],
            $t['monto_usd'], $t['tc'], $t['monto_crc'], $t['match_exitoso'], $fechaSegura
        ]);

        // Cierre definitivo del Bucle (Match Inteligente)
        if (!empty($t['id_caso_cerrar'])) {
            $stmtCerrarTicket->execute([$t['id_caso_cerrar']]);
            // Solo insertamos en el historial si el UPDATE afectó la fila (para evitar dobles registros)
            if ($stmtCerrarTicket->rowCount() > 0) {
                $stmtHistCerrar->execute([$t['id_caso_cerrar'], $emailUsuario]);
            }
        }
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
            $icdIndividual = !empty($caso['icd']) ? $caso['icd'] : 'PENDIENTE TSD';
            $sucIndividual = !empty($caso['sucursal']) ? $caso['sucursal'] : $sucursalesRaw;

            $stmtCaso->execute([
                $idCierre, $icdIndividual, $sucIndividual, $caso['contrato'], $caso['cliente'],
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