<?php
// 1. Forzar a PHP a no escupir HTML al navegador
ini_set('display_errors', 0);
error_reporting(E_ALL);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

// 2. Intentar cargar el archivo de conexión
if (!file_exists('tsd_db.php')) {
    echo json_encode(['success' => false, 'error' => 'Falta el archivo de conexión tsd_db.php']);
    exit;
}
require_once 'tsd_db.php';

$icd = $_GET['icd'] ?? '';

if (empty($icd)) {
    echo json_encode(['success' => false, 'error' => 'Debe proveer un número de ICD.']);
    exit;
}

try {
    $pdo = TSDDatabase::connect();
    
    // 1. OBTENER METADATOS DEL ICD (Cabecera)
    $sqlHeader = "SELECT TOP (1)
    D.DBRNum,
    D.CreateDate,
    D.LOC_CODE,
    S.Name AS Nombre_Sucursal,
    CASE S.TPCode 
        WHEN 'ALA01' THEN 'Alamo'
        WHEN 'ENT01' THEN 'Enterprise'
        WHEN 'NAL01' THEN 'National'
        ELSE S.TPCode 
    END AS Nombre_Marca,
    S.TPCode AS Codigo_Marca, 
    D.EMP_CODE,
    CASE 
        WHEN D.EMP_CODE = 'AUTOEOD' THEN 'Auto Generado'
        ELSE ISNULL(E.FirstName + ' ' + E.LastName, 'Empleado no encontrado')
    END AS Nombre_Usuario
FROM dbo.DBR D
LEFT JOIN dbo.Setup S ON D.LOC_CODE = S.Location
LEFT JOIN dbo.Cemp01 E ON D.EMP_CODE = E.EmpID
WHERE D.DBRNum = ?
ORDER BY D.ID DESC";
    
    $stmtH = $pdo->prepare($sqlHeader);
    $stmtH->execute([$icd]);
    $header = $stmtH->fetch();

    if (!$header) {
        echo json_encode(['success' => false, 'error' => "El ICD '$icd' no existe en la base de datos TSD."]);
        exit;
    }

    // NUEVO: Validar si el ICD ya fue cerrado en nuestro sistema local (ANCFinanzas)
    require_once '../db.php'; // Conexión a la BD local
    $pdoLocal = Database::connect();
    
    // Hacemos JOIN con Tbl_Usuarios para mostrar el Nombre bonito en lugar del correo
    $checkSql = "
        SELECT H.FechaCierre, U.Nombre 
        FROM Tbl_CierreCaja_Header H
        LEFT JOIN Tbl_Usuarios U ON H.EmailUsuario = U.Email
        WHERE H.ICD = ?";
        
    $stmtCheck = $pdoLocal->prepare($checkSql);
    $stmtCheck->execute([$icd]);
    $yaCerrado = $stmtCheck->fetch();

    if ($yaCerrado) {
        $fechaCierre = date('d/m/Y H:i', strtotime($yaCerrado['FechaCierre']));
        $nombreResponsable = $yaCerrado['Nombre'] ?? 'Usuario Desconocido';
        
        echo json_encode([
            'success' => false, 
            'error' => "Este ICD ya fue cerrado el $fechaCierre por el usuario: $nombreResponsable."
        ]);
        exit;
    }

    // 2. OBTENER TRANSACCIONES DEL ICD (Detalle con Tipo de Cambio Histórico Inteligente)
    $sqlDetails = "SELECT
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
                    SELECT TOP 1 Ex.sell
                    FROM dbo.Exchange AS Ex
                    WHERE Ex.LocCode = P.LOC_CODE
                    AND Ex.description = 'TO-CR'
                    AND Ex.AsOf <= CAST(P.Pay_Date AS DATE) 
                    ORDER BY Ex.AsOf DESC 
                ) AS E
                WHERE P.PAY_CHARGE = 'P' 
                AND P.TYPE IN ('3','7','C','F','J') 
                AND P.DBR = ?
                ORDER BY P.Pay_Date DESC, P.KNUM, P.dbr;";

    $stmtD = $pdo->prepare($sqlDetails);
    $stmtD->execute([$icd]);
    $details = $stmtD->fetchAll();

    // --- NUEVO: BUSCAR CASOS "NO REPORTADOS" DE ESTA SUCURSAL EN BD LOCAL ---
    require_once '../db.php';
    $pdoLocal = Database::connect();
    
    // Extraer solo el código de la sucursal (Ej: 'SJOT71' de 'SJOT71 - Nombre')
    $locCode = $header['LOC_CODE']; 
    
    $sqlPendientes = "
        SELECT C.IdCaso, C.ICD_Relacionado, C.NumeroContrato, C.NombreCliente, C.MontoCRC, C.FechaCreacion, C.DiasAtraso, C.EmailCreador, 
               J.EmailJefe, J.NombreJefe,
               ISNULL(U.Nombre, U.Email) AS CreadoPor -- Rescatamos el nombre bonito para la carita azul
        FROM Tbl_Casos_TSD C
        LEFT JOIN Tbl_Jefes_Estacion J ON J.CodigoSucursal = ?
        LEFT JOIN Tbl_Usuarios U ON C.EmailCreador = U.Email
        WHERE C.Estado = 'NO_REPORTADO' AND C.Sucursal_Relacionada LIKE ?
        ORDER BY C.DiasAtraso DESC";
        
    $stmtP = $pdoLocal->prepare($sqlPendientes);
    $stmtP->execute([$locCode, $locCode . '%']);
    $noReportados = $stmtP->fetchAll();

    // Obtenemos tu nombre real de la sesión
    $nombreReal = $_SESSION['user']['name'] ?? 'Usuario del Sistema';

    echo json_encode([
        'success' => true, 
        'header' => $header,
        'details' => $details,
        'no_reportados' => $noReportados, // Inyectamos los casos huérfanos al Frontend
        'current_user' => $nombreReal
    ]);

} catch (Throwable $e) {
    // Throwable captura TODO (Errores fatales de PHP y errores de SQL)
    echo json_encode([
        'success' => false, 
        'error' => 'Error Interno TSD: ' . $e->getMessage()
    ]);
}
?>