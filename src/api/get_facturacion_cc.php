<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Forzamos la zona horaria de Costa Rica para evitar fechas futuras
date_default_timezone_set('America/Costa_Rica');

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
require_once 'tsd_db.php';

$emailUsuario = $_SESSION['user']['email'] ?? '';

// Leer los datos que provienen de la solicitud POST
$inputJSON = file_get_contents('php://input');
$requestData = json_decode($inputJSON, true) ?: [];
$manualDates = $requestData['manual_dates'] ?? [];

try {
    $pdoLocal = Database::connect();
    $pdoTsd = TSDDatabase::connect();

    // 1. Obtener sucursales asignadas en la matriz unificada
    $stmtSucs = $pdoLocal->prepare("SELECT CodigoSucursal, NombreSucursal FROM Tbl_Usuario_Sucursales_cc WHERE EmailUsuario = ? AND Activo = 1");
    
    $stmtSucs->execute([$emailUsuario]);
    $sucursales = $stmtSucs->fetchAll(PDO::FETCH_ASSOC);

    if (empty($sucursales)) {
        throw new Exception("No tiene sucursales asignadas. Solicite a un Administrador que configure sus sucursales desde el panel de Usuarios.");
    }

    // 2. Calcular la fecha/hora de inicio por cada sucursal
    $whereConditions = [];
    $infoMetadatos = [];
    $sucursalesPendientes = []; // Para enviar al FrontEnd si requieren inicialización

    foreach ($sucursales as $suc) {
        $codigo = $suc['CodigoSucursal'];
        
        // BUSCAMOS EL ÚLTIMO REGISTRO HISTÓRICO ABSOLUTO (Sin importar el día)
        $stmtLast = $pdoLocal->prepare("
            SELECT MAX(D.Fecha_Transaccion) 
            FROM Tbl_CierreCaja_Detalle D
            INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre
            WHERE H.Sucursal LIKE ?
        ");
        $stmtLast->execute(["%$codigo%"]);
        $lastDate = $stmtLast->fetchColumn();

        if ($lastDate) {
            $timestampSeguro = strtotime($lastDate) - 60; // Margen de 1 minuto
            $fechaInicio = date('Ymd H:i:s', $timestampSeguro);
        } else {
            // NO EXISTE HISTORIAL - Verificamos si el usuario envió las fechas manuales
            if (!empty($manualDates[$codigo])) {
                $fechaInicio = date('Ymd H:i:s', strtotime($manualDates[$codigo]));
            } else {
                // Almacenamos la sucursal para disparar el UI Modal
                $sucursalesPendientes[] = [
                    'codigo' => $codigo,
                    'nombre' => $suc['NombreSucursal']
                ];
                continue;
            }
        }
        
        $whereConditions[] = "(P.LOC_CODE = '$codigo' AND P.Pay_Date >= '$fechaInicio')";
        
        $infoMetadatos[] = [
            'sucursal' => $codigo,
            'nombre' => $suc['NombreSucursal'],
            'desde' => date('d/m/Y H:i:s', strtotime($fechaInicio))
        ];
    }

    // Si hay sucursales sin historia, detenemos el backend y avisamos al frontend
    if (!empty($sucursalesPendientes)) {
        echo json_encode([
            'success' => false,
            'requires_init' => true,
            'pending' => $sucursalesPendientes
        ]);
        exit;
    }

    $dynamicWhere = implode(' OR ', $whereConditions);

    // 3. Ejecutar la Consulta Dinámica en TSD
    // Simplificamos la extracción y aseguramos el formato de las fechas
    $sqlFacturacion = "
        SELECT
            P.KNUM AS Numero_Contrato,
            C.FNAME AS Nombre,
            C.LNAME AS Apellido,
            P.AMOUNT AS Monto_Pago,
            P.CARD_TYPE AS Tipo_Tarjeta,
            P.LOC_CODE AS Sucursal,
            P.Ref AS Numero_Autorizacion,
            P.dbr AS ICD,
            CONVERT(varchar(23), P.Pay_Date, 121) AS Pay_Date,
            ISNULL((SELECT TOP 1 Ex.sell FROM dbo.Exchange Ex WHERE Ex.description = 'TO-CR' AND Ex.AsOf <= CAST(P.Pay_Date AS DATE) ORDER BY Ex.AsOf DESC), C.USDRate) AS Tipo_Cambio_Dia
        FROM dbo.Cpay P
        INNER JOIN dbo.Cra001 C ON P.KNUM = C.KNUM
        WHERE P.PAY_CHARGE = 'P' 
          AND P.TYPE IN ('3','7','C','F','J')
          AND ($dynamicWhere)
        ORDER BY P.Pay_Date DESC, P.KNUM, P.dbr;
    ";

    $stmtFact = $pdoTsd->prepare($sqlFacturacion);
    $stmtFact->execute();
    $transaccionesTSD = $stmtFact->fetchAll(PDO::FETCH_ASSOC);

    // Si sigue vacía, no es error de código, es que no hay match en TSD
    if (count($transaccionesTSD) === 0) {
        throw new Exception("La consulta se ejecutó, pero TSD no devolvió facturas (TYPE P) para las sucursales asignadas en las últimas horas.");
    }

    // Calcular la Conversión Matemática localmente en PHP para evitar los cruces rotos de SQL
    foreach ($transaccionesTSD as &$trx) {
        $tc = floatval($trx['Tipo_Cambio_Dia'] ?? 0);
        $monto = floatval($trx['Monto_Pago'] ?? 0);
        $trx['Conversion'] = $monto * $tc;
    }

    // 4. FILTRO DE SEGURIDAD (Limpiar Traslapes Inteligente)
    $contratosTSD = array_unique(array_filter(array_column($transaccionesTSD, 'Numero_Contrato')));
    $transacciones = [];

    if (!empty($contratosTSD)) {
        $inClause = str_repeat('?,', count($contratosTSD) - 1) . '?';
        
        // 1. Filtrar transacciones ya exitosas (Usando llave compuesta: Contrato + Autorización)
        $stmtCerradosDetalle = $pdoLocal->prepare("
            SELECT Numero_Contrato + '|' + ISNULL(Numero_Autorizacion, '') 
            FROM Tbl_CierreCaja_Detalle 
            WHERE Numero_Contrato IN ($inClause)
        ");
        // FIX: Usamos array_values para reiniciar los índices numéricos que rompió array_unique
        $stmtCerradosDetalle->execute(array_values($contratosTSD));
        $llavesExitosas = $stmtCerradosDetalle->fetchAll(PDO::FETCH_COLUMN);

        // 2. Filtrar transacciones con Tickets ACTIVOS (Usando llave compuesta: Contrato + ICD)
        $stmtCerradosCasos = $pdoLocal->prepare("
            SELECT NumeroContrato + '|' + ISNULL(ICD_Relacionado, '')
            FROM Tbl_Casos_TSD
            WHERE NumeroContrato IN ($inClause) AND Estado NOT IN ('RESUELTO', 'CERRADO')
        ");
        // FIX: Usamos array_values para reiniciar los índices numéricos
        $stmtCerradosCasos->execute(array_values($contratosTSD));
        $llavesBloqueadasCasos = $stmtCerradosCasos->fetchAll(PDO::FETCH_COLUMN);

        foreach ($transaccionesTSD as $t) {
            $llaveDetalle = $t['Numero_Contrato'] . '|' . $t['Numero_Autorizacion'];
            $llaveCaso = $t['Numero_Contrato'] . '|' . $t['ICD'];

            // Si no está en el detalle exitoso Y no hay un ticket activo estorbando, lo dejamos pasar.
            if (!in_array($llaveDetalle, $llavesExitosas) && !in_array($llaveCaso, $llavesBloqueadasCasos)) {
                $transacciones[] = $t;
            }
        }
    }

    // 5. Analizar los ICDs involucrados para validar si están cerrados (POST_FLAG)
    $icdsInvolucrados = array_unique(array_filter(array_column($transacciones, 'ICD')));
    $icdsAbiertos = [];
    $icdsInfo = [];

    if (!empty($icdsInvolucrados)) {
        $inClauseDBR = str_repeat('?,', count($icdsInvolucrados) - 1) . '?';
        $stmtDBR = $pdoTsd->prepare("SELECT DBRNum, POST_FLAG, EMP_CODE FROM dbo.DBR WHERE DBRNum IN ($inClauseDBR)");
        $stmtDBR->execute(array_values($icdsInvolucrados));
        $dbrResults = $stmtDBR->fetchAll(PDO::FETCH_ASSOC);

        foreach ($dbrResults as $row) {
            $icdsInfo[] = $row['DBRNum'] . " (" . $row['EMP_CODE'] . ")";
            if (empty($row['POST_FLAG']) || $row['POST_FLAG'] == '0') {
                $icdsAbiertos[] = $row['DBRNum'];
            }
        }
    }

    // 6. RESPUESTA AL FRONTEND
    echo json_encode([
        'success' => true,
        'metadatos' => $infoMetadatos,
        'icds_info' => implode(', ', $icdsInfo), 
        'icds_abiertos' => $icdsAbiertos,
        'transacciones' => $transacciones
    ]);

} catch (Throwable $e) { // ATRAPAMOS TODO
    echo json_encode([
        'success' => false, 
        'error' => 'ERROR: ' . $e->getMessage() . ' en la línea ' . $e->getLine()
    ]);
}
?>