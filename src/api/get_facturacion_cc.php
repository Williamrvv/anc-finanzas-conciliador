<?php
// MODO DEBUG: Forzamos ver el error en Postman o en el tab Network del navegador
ini_set('display_errors', 1);
error_reporting(E_ALL);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
require_once 'tsd_db.php';

$emailUsuario = $_SESSION['user']['email'] ?? '';
$hoy = date('Y-m-d');


// ========================================================
$FORZAR_PRUEBA = false;
$HORA_PRUEBA = "04:33:00"; 
// ========================================================

try {
    $pdoLocal = Database::connect();
    $pdoTsd = TSDDatabase::connect();

    // 1. Obtener sucursales asignadas según el Rol del Usuario
    $rolUsuario = $_SESSION['user']['role'] ?? '';
    
    if ($rolUsuario === 'agente') {
        $stmtSucs = $pdoLocal->prepare("SELECT CodigoSucursal, NombreSucursal FROM Tbl_Agentes_Estacion WHERE EmailAgente = ? AND Activo = 1");
    } else {
        // Jefes, Administradores y Servicio al Cliente
        $stmtSucs = $pdoLocal->prepare("SELECT CodigoSucursal, NombreSucursal FROM Tbl_Jefes_Estacion WHERE EmailJefe = ? AND Activo = 1");
    }
    
    $stmtSucs->execute([$emailUsuario]);
    $sucursales = $stmtSucs->fetchAll(PDO::FETCH_ASSOC);

    if (empty($sucursales)) {
        throw new Exception("No tiene sucursales asignadas. Solicite a un Administrador que configure sus sucursales desde el panel de Usuarios.");
    }

    // 2. Calcular la fecha/hora de inicio por cada sucursal y armar el bloque WHERE de SQL
    $whereConditions = [];
    $infoMetadatos = [];

    foreach ($sucursales as $suc) {
        $codigo = $suc['CodigoSucursal'];
        
        // Buscar la fecha exacta del último voucher procesado en la BD Local HOY para ESTA SUCURSAL
        $stmtLast = $pdoLocal->prepare("
            SELECT MAX(D.Fecha_Transaccion) 
            FROM Tbl_CierreCaja_Detalle D
            INNER JOIN Tbl_CierreCaja_Header H ON D.IdCierre = H.IdCierre
            WHERE H.Sucursal LIKE ? AND CAST(D.Fecha_Transaccion AS DATE) = ?
        ");
        $stmtLast->execute(["%$codigo%", $hoy]);
        $lastDate = $stmtLast->fetchColumn();

        // Si no hay transacciones procesadas hoy, iniciamos a las 00:00:00
        $fechaInicio = $lastDate ? date('Y-m-d H:i:s', strtotime($lastDate)) : "$hoy 00:00:00";
        
        // 🚨 INTERCEPTOR UAT 🚨
        if ($FORZAR_PRUEBA) {
            $fechaInicio = "$hoy $HORA_PRUEBA";
        }
        
        // Usamos > (mayor estricto) para no repetir el voucher de la hora exacta de corte
        $whereConditions[] = "(P.LOC_CODE = '$codigo' AND P.Pay_Date > '$fechaInicio')";
        
        $infoMetadatos[] = [
            'sucursal' => $codigo,
            'nombre' => $suc['NombreSucursal'],
            'desde' => date('d/m/Y H:i:s', strtotime($fechaInicio)) . ($FORZAR_PRUEBA ? " (MODO PRUEBA UAT)" : "")
        ];
    }

    $dynamicWhere = implode(' OR ', $whereConditions);

    // 3. Ejecutar la Consulta Dinámica en TSD
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
            P.Pay_Date,
            ISNULL(E.sell, C.USDRate) AS Tipo_Cambio_Dia, 
            ISNULL(E.sell, C.USDRate) * P.AMOUNT AS Conversion
        FROM dbo.Cpay AS P
        INNER JOIN dbo.Cra001 AS C ON P.KNUM = C.KNUM
        OUTER APPLY (
            SELECT TOP 1 Ex.sell FROM dbo.Exchange AS Ex
            WHERE Ex.description = 'TO-CR' AND Ex.AsOf <= CAST(P.Pay_Date AS DATE) 
            ORDER BY Ex.AsOf DESC 
        ) AS E
        WHERE P.PAY_CHARGE = 'P' 
          AND P.TYPE IN ('3','7','C','F','J')
          AND ($dynamicWhere)
        ORDER BY P.Pay_Date DESC, P.KNUM, P.dbr;
    ";

    $stmtFact = $pdoTsd->prepare($sqlFacturacion);
    $stmtFact->execute();
    $transacciones = $stmtFact->fetchAll(PDO::FETCH_ASSOC);

    // 4. Analizar los ICDs involucrados para validar si están cerrados (POST_FLAG)
    $icdsInvolucrados = array_unique(array_filter(array_column($transacciones, 'ICD')));
    $icdsAbiertos = [];
    $icdsInfo = [];

    if (!empty($icdsInvolucrados)) {
        $inClause = str_repeat('?,', count($icdsInvolucrados) - 1) . '?';
        $stmtDBR = $pdoTsd->prepare("SELECT DBRNum, POST_FLAG, EMP_CODE FROM dbo.DBR WHERE DBRNum IN ($inClause)");
        $stmtDBR->execute(array_values($icdsInvolucrados));
        $dbrResults = $stmtDBR->fetchAll(PDO::FETCH_ASSOC);

        foreach ($dbrResults as $row) {
            $icdsInfo[] = $row['DBRNum'] . " (" . $row['EMP_CODE'] . ")";
            if (empty($row['POST_FLAG']) || $row['POST_FLAG'] == '0') {
                $icdsAbiertos[] = $row['DBRNum'];
            }
        }
    }

    // 5. MATCH INTELIGENTE: Buscar si hay casos RESUELTOS para estos contratos
    $casosResueltosMatch = [];
    $contratosUnicos = array_unique(array_filter(array_column($transacciones, 'Numero_Contrato')));
    
    if (!empty($contratosUnicos)) {
        $inClauseC = str_repeat('?,', count($contratosUnicos) - 1) . '?';
        // Buscamos los resueltos. Ordenamos ASC para que si hay varios, el array se quede con el más reciente.
        $stmtMatch = $pdoLocal->prepare("
            SELECT IdCaso, NumeroContrato, MontoCRC 
            FROM Tbl_Casos_TSD 
            WHERE Estado = 'RESUELTO' AND NumeroContrato IN ($inClauseC)
            ORDER BY IdCaso ASC
        ");
        $stmtMatch->execute(array_values($contratosUnicos));
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
        'casos_resueltos' => $casosResueltosMatch // <-- Enviamos los matches encontrados
    ]);

} catch (Throwable $e) { // Usamos Throwable para atrapar Fatal Errors de PHP
    echo json_encode([
        'success' => false, 
        'error' => 'ERROR CRÍTICO: ' . $e->getMessage(),
        'linea' => $e->getLine(),
        'archivo' => $e->getFile()
    ]);
}
?>
