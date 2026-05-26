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

// Usamos formato seguro YYYYMMDD para evitar choques de cultura de SQL
$hoySeguro = date('Ymd'); 

// ========================================================
// MODO PRUEBAS UAT: Forzar hora de inicio (Eliminar en Prod)
// ========================================================
$FORZAR_PRUEBA = false; // <-- Cambia a false para apagarlo
$HORA_PRUEBA = "06:00:00"; // La hora de inicio simulada
// ========================================================

try {
    $pdoLocal = Database::connect();
    $pdoTsd = TSDDatabase::connect();

    // 1. Obtener sucursales asignadas según el Rol del Usuario
    $rolUsuario = $_SESSION['user']['role'] ?? '';
    if ($rolUsuario === 'agente') {
        $stmtSucs = $pdoLocal->prepare("SELECT CodigoSucursal, NombreSucursal FROM Tbl_Agentes_Estacion WHERE EmailAgente = ? AND Activo = 1");
    } else {
        $stmtSucs = $pdoLocal->prepare("SELECT CodigoSucursal, NombreSucursal FROM Tbl_Jefes_Estacion WHERE EmailJefe = ? AND Activo = 1");
    }
    
    $stmtSucs->execute([$emailUsuario]);
    $sucursales = $stmtSucs->fetchAll(PDO::FETCH_ASSOC);

    if (empty($sucursales)) {
        throw new Exception("No tiene sucursales asignadas. Solicite a un Administrador que configure sus sucursales desde el panel de Usuarios.");
    }

    // 2. Calcular la fecha/hora de inicio por cada sucursal
    $whereConditions = [];
    $infoMetadatos = [];

    foreach ($sucursales as $suc) {
        $codigo = $suc['CodigoSucursal'];
        
        $stmtLast = $pdoLocal->prepare("
            SELECT MAX(D.Fecha_Transaccion) 
            FROM Tbl_CierreCaja_Detalle D
            INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre
            WHERE H.Sucursal LIKE ? AND CONVERT(varchar(8), D.Fecha_Transaccion, 112) = ?
        ");
        $stmtLast->execute(["%$codigo%", $hoySeguro]);
        $lastDate = $stmtLast->fetchColumn();

        if ($lastDate) {
            $timestampSeguro = strtotime($lastDate) - 60; 
            $fechaInicio = date('Ymd H:i:s', $timestampSeguro);
        } else {
            $fechaInicio = "$hoySeguro 00:00:00";
        }
        
        if ($FORZAR_PRUEBA) {
            $fechaInicio = "$hoySeguro $HORA_PRUEBA";
        }
        
        // La consulta a la BD
        $whereConditions[] = "(P.LOC_CODE = '$codigo' AND P.Pay_Date >= '$fechaInicio')";
        
        $infoMetadatos[] = [
            'sucursal' => $codigo,
            'nombre' => $suc['NombreSucursal'],
            'desde' => date('d/m/Y H:i:s', strtotime($fechaInicio)) . ($FORZAR_PRUEBA ? " (MODO PRUEBA UAT)" : "")
        ];
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

    // 4. FILTRO DE SEGURIDAD (Limpiar Traslapes)
    $contratosTSD = array_unique(array_filter(array_column($transaccionesTSD, 'Numero_Contrato')));
    $transacciones = [];

    if (!empty($contratosTSD)) {
        $inClause = str_repeat('?,', count($contratosTSD) - 1) . '?';
        
        $stmtCerrados = $pdoLocal->prepare("
            SELECT Numero_Contrato 
            FROM Tbl_CierreCaja_Detalle 
            WHERE Numero_Contrato IN ($inClause) AND CONVERT(varchar(8), Fecha_Transaccion, 112) = ?
            UNION
            SELECT NumeroContrato
            FROM Tbl_Casos_TSD
            WHERE NumeroContrato IN ($inClause) AND CONVERT(varchar(8), FechaCreacion, 112) = ?
        ");
        
        $parametrosCheck = array_merge($contratosTSD, [$hoySeguro], $contratosTSD, [$hoySeguro]);
        $stmtCerrados->execute($parametrosCheck);
        $contratosYaCerrados = $stmtCerrados->fetchAll(PDO::FETCH_COLUMN);

        foreach ($transaccionesTSD as $t) {
            if (!in_array($t['Numero_Contrato'], $contratosYaCerrados)) {
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

    // 6. MATCH INTELIGENTE
    $casosResueltosMatch = [];
    if (!empty($contratosTSD)) {
        $inClauseC = str_repeat('?,', count($contratosTSD) - 1) . '?';
        $stmtMatch = $pdoLocal->prepare("
            SELECT IdCaso, NumeroContrato, MontoCRC 
            FROM Tbl_Casos_TSD 
            WHERE Estado = 'RESUELTO' AND NumeroContrato IN ($inClauseC)
            ORDER BY IdCaso ASC
        ");
        $stmtMatch->execute(array_values($contratosTSD));
        foreach ($stmtMatch->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $casosResueltosMatch[$row['NumeroContrato']] = $row;
        }
    }

    echo json_encode([
        'success' => true,
        'metadatos' => $infoMetadatos,
        'icds_info' => implode(', ', $icdsInfo), 
        'icds_abiertos' => $icdsAbiertos,
        'transacciones' => $transacciones,
        'casos_resueltos' => $casosResueltosMatch 
    ]);

} catch (Throwable $e) { // ATRAPAMOS TODO
    echo json_encode([
        'success' => false, 
        'error' => 'ERROR: ' . $e->getMessage() . ' en la línea ' . $e->getLine()
    ]);
}
?>