<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';

$inputJSON = file_get_contents('php://input');
$data = json_decode($inputJSON, true);

if (!$data || empty($data['transacciones'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Payload vacío.']);
    exit;
}

$transacciones = $data['transacciones'];
$fechaCierre = $data['fecha_cierre'] ?? date('Y-m-d');
$usuario = $_SESSION['user']['username'] ?? ($_SESSION['user']['email'] ?? 'Sistema');
$totalConciliado = floatval($data['total_conciliado'] ?? 0);

$bancosUnicos = array_unique(array_column($transacciones, 'Banco'));
$stringBancos = implode(', ', $bancosUnicos);

try {
    $pdo = Database::connect();
    $pdo->beginTransaction();

    // 1. CREAR EL CIERRE (CABECERA CON TOTAL)
    $stmtCierre = $pdo->prepare("INSERT INTO Tbl_Conciliacion_Cierres (FechaCierre, Usuario, Banco, TotalConciliado) VALUES (?, ?, ?, ?)");
    $stmtCierre->execute([$fechaCierre, $usuario, $stringBancos, $totalConciliado]);
    $idCierre = $pdo->lastInsertId();

    // 2. PREPARAR SENTENCIAS
    $stmtCheck = $pdo->prepare("SELECT IdTransaccion FROM Tbl_Transacciones_Maestra WHERE HashUnico = ?");
    
    // Si ya existe, actualizamos Estado, Match, Cierre y también inyectamos la Tarjeta si estaba en NULL
    $stmtUpdate = $pdo->prepare("UPDATE Tbl_Transacciones_Maestra SET Estado = ?, IdMatch = ?, IdCierre = ISNULL(IdCierre, ?), Tarjeta = ISNULL(Tarjeta, ?) WHERE IdTransaccion = ?");
    
    // Si no existe, lo creamos (Agregado campo Tarjeta)
    $stmtInsert = $pdo->prepare("INSERT INTO Tbl_Transacciones_Maestra 
        (IdTransaccion, IdCierre, Banco, Origen, Estado, IdMatch, FechaTransaccion, Afiliado_MerID, Autorizacion, Tarjeta, MontoBruto, MontoNeto, ArchivoOrigen, HashUnico)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $stmtBAC = $pdo->prepare("INSERT INTO Tbl_Detalle_BAC (IdTransaccion, Liquidacion, Comision, RetencionVentas, RetencionRenta, AjusteACI) VALUES (?, ?, ?, ?, ?, ?)");
    $stmtScotia = $pdo->prepare("INSERT INTO Tbl_Detalle_Scotia (IdTransaccion, Lote, Comision, RetencionIVA, RetencionISR) VALUES (?, ?, ?, ?, ?)");
    $stmtAjuste = $pdo->prepare("INSERT INTO Tbl_Ajustes_Auditoria (IdTransaccion, TipoAjuste, Justificacion, EvidenciaB64) VALUES (?, ?, ?, ?)");

    $filasAfectadas = 0;

    // 3. RECORRER Y APLICAR LÓGICA
    foreach ($transacciones as $t) {
        $idTrans = $t['IdTransaccion'];
        $fecha = (!empty($t['FechaTransaccion']) && $t['FechaTransaccion'] !== 'N/A') ? $t['FechaTransaccion'] : null;
        $bruto = floatval($t['MontoBruto'] ?? 0);
        $neto  = floatval($t['MontoNeto'] ?? 0);

        // CREAR HUELLA DIGITAL (Hash) PARA EVITAR DUPLICADOS
        // Combinamos datos únicos de la fila. Si es un ajuste ficticio, su Hash es su UID.
        $hashStr = "{$t['Banco']}|{$t['Origen']}|{$fecha}|{$neto}|{$t['Autorizacion']}|{$t['Afiliado_MerID']}";
        $hashUnico = ($t['Origen'] === 'AJUSTE') ? $idTrans : md5($hashStr);

        // ¿Existe esta transacción en la Base de Datos?
        $stmtCheck->execute([$hashUnico]);
        $idExistente = $stmtCheck->fetchColumn();

        if ($idExistente) {
            // SÍ EXISTE: Solo actualizamos su cruce y llenamos la tarjeta si faltaba.
            $stmtUpdate->execute([$t['Estado'], $t['IdMatch'], $idCierre, $t['Tarjeta'], $idExistente]);
        } else {
            // NO EXISTE: Es un dato nuevo.
            $stmtInsert->execute([
                $idTrans, $idCierre, $t['Banco'], $t['Origen'], $t['Estado'], $t['IdMatch'], 
                $fecha, $t['Afiliado_MerID'], $t['Autorizacion'], $t['Tarjeta'], $bruto, $neto, $t['ArchivoOrigen'], $hashUnico
            ]);

            // Se insertan sus detalles hijos
            if ($t['Banco'] === 'BAC' && $t['Origen'] !== 'PAGADO') {
                $stmtBAC->execute([$idTrans, $t['Liquidacion'], floatval($t['Comision'] ?? 0), floatval($t['RetencionVentas'] ?? 0), floatval($t['RetencionRenta'] ?? 0), floatval($t['AjusteACI'] ?? 0)]);
            } 
            else if ($t['Banco'] === 'SCOTIA' && $t['Origen'] !== 'PAGADO') {
                $stmtScotia->execute([$idTrans, $t['Lote'], floatval($t['Comision'] ?? 0), floatval($t['RetencionIVA'] ?? 0), floatval($t['RetencionISR'] ?? 0)]);
            }

            if ($t['Origen'] === 'AJUSTE') {
                $stmtAjuste->execute([$idTrans, $t['TipoAjuste'], $t['Justificacion'], $t['EvidenciaB64']]);
            }
        }
        $filasAfectadas++;
    }

    $pdo->commit();

    echo json_encode([
        'success' => true, 
        'filas_insertadas' => $filasAfectadas,
        'id_cierre' => $idCierre
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    // Mandamos el error real al front para diagnosticar si algo falla
    echo json_encode([
        'success' => false, 
        'error' => 'Error de BD: ' . $e->getMessage()
    ]);
}
?>