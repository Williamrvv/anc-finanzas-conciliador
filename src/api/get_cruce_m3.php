<?php
session_start();
require_once '../db.php';
require_once 'tsd_db.php'; // Incluimos la conexión dedicada a TSD

header('Content-Type: application/json');

if (!isset($_SESSION['user']) || !in_array($_SESSION['user']['role'], ['admin', 'conciliador'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']);
    exit;
}

// Recibir fechas
$startDate = $_GET['start'] ?? date('Y-m-d');
$endDate = $_GET['end'] ?? date('Y-m-d');

// Formatear para cubrir todo el día
$startDateTime = $startDate . ' 00:00:00';
$endDateTime = $endDate . ' 23:59:59';

try {
    // Abrimos las dos conexiones independientemente
    $pdoTSD = TSDDatabase::connect();
    $pdoBancos = Database::connect();

    // ==========================================
    // 1. QUERY TSD (Usa $pdoTSD) - Filtrado para Costa Rica
    // ==========================================
    $sqlTSD = "
        SELECT
            P.KNUM AS [Contrato],
            C.FNAME + ' ' + C.LNAME AS [Cliente],
            P.AMOUNT AS [MontoUSD],
            ISNULL(E.sell, C.USDRate) AS [TC],
            (ISNULL(E.sell, C.USDRate) * P.AMOUNT) AS [MontoCRC],
            P.CARD_TYPE AS [Tipo],
            P.Ref AS [Autorizacion],
            CAST(P.Pay_Date AS DATE) AS [Fecha],
            ISNULL(U.FirstName + ' ' + U.LastName, P.TAKEN_BY) AS [RecibidoPor], 
            P.DBR AS [ICD],
            P.LOC_CODE AS [SucursalCod],
            S.Name AS [Sucursal]
        FROM dbo.Cpay AS P
        INNER JOIN dbo.Cra001 AS C ON P.KNUM = C.KNUM
        LEFT JOIN dbo.Setup AS S ON P.LOC_CODE = S.Location
        LEFT JOIN dbo.Cemp01 AS U ON P.TAKEN_BY = U.EmpID 
        OUTER APPLY (
            SELECT TOP (1) Ex.sell
            FROM dbo.Exchange AS Ex
            WHERE Ex.LocCode = P.LOC_CODE 
              AND Ex.description = 'TO-CR'
              AND Ex.AsOf <= CAST(P.Pay_Date AS DATE)
            ORDER BY Ex.AsOf DESC
        ) AS E
        WHERE P.PAY_CHARGE = 'P'                            
          AND P.TYPE IN ('3', '7', 'C', 'F', 'J')           
          AND S.Country = 'CRI'                      
          AND CAST(P.Pay_Date AS DATE) BETWEEN :startDate AND :endDate 
        ORDER BY P.Pay_Date DESC, P.KNUM;
    ";
    
    $stmtTSD = $pdoTSD->prepare($sqlTSD);
    // Como usamos CAST a DATE y BETWEEN, ya no ocupamos variables con tiempo (00:00:00), pasamos el string directo.
    $stmtTSD->execute([':startDate' => $startDate, ':endDate' => $endDate]);
    $dataTSD = $stmtTSD->fetchAll();

    // ==========================================
    // 2. QUERY BANCOS (Extracción Directa de Detalles)
    // ==========================================
    $sqlBancos = "
        WITH TransaccionesCombinadas AS (
            -- 1. EXTRACCIÓN DEL BAC CREDOMATIC
            SELECT 
                IdTransaccion,
                'BAC' AS Banco,
                NUMERO_AFILIADO AS Afiliado_MerID,
                NOMBRECOMERCIO AS Nombre_Comercio,
                RIGHT(RTRIM(LTRIM(NUMERO_DE_TARJETA)), 4) AS Tarjeta_Ultimos4,
                AUTORIZACION AS Numero_Autorizacion,
                MONTO_VENTA AS Monto_Venta_Original,
                FECHA_PAGO AS Fecha_Pago_Excel
            FROM 
                Tbl_Detalle_BAC
            WHERE 
                TRY_CONVERT(date, FECHA_PAGO, 103) >= :startBAC 
                AND TRY_CONVERT(date, FECHA_PAGO, 103) <= :endBAC
                AND AUTORIZACION IS NOT NULL 
                AND RTRIM(LTRIM(AUTORIZACION)) <> ''

            UNION ALL

            -- 2. EXTRACCIÓN DE SCOTIABANK (DAVIBANK)
            SELECT 
                IdTransaccion,
                'SCOTIA' AS Banco,
                MerID AS Afiliado_MerID,
                Nombre AS Nombre_Comercio,
                RIGHT(RTRIM(LTRIM(Numero_Tarjeta)), 4) AS Tarjeta_Ultimos4,
                Numero_Autorizacion AS Numero_Autorizacion,
                Monto_Orig AS Monto_Venta_Original,
                Fecha_Pago AS Fecha_Pago_Excel
            FROM 
                Tbl_Detalle_Scotia
            WHERE 
                (Numero_Tarjeta IS NOT NULL AND RTRIM(LTRIM(Numero_Tarjeta)) <> '')
                AND TRY_CONVERT(date, Fecha_Pago, 103) >= :startScotia 
                AND TRY_CONVERT(date, Fecha_Pago, 103) <= :endScotia
                AND Numero_Autorizacion IS NOT NULL 
                AND RTRIM(LTRIM(Numero_Autorizacion)) <> ''
        )
        SELECT * 
        FROM TransaccionesCombinadas
        ORDER BY TRY_CONVERT(date, Fecha_Pago_Excel, 103) ASC, Banco ASC;
    ";

    $stmtBancos = $pdoBancos->prepare($sqlBancos);
    // Pasamos las variables explícitamente para cada bloque del UNION para evitar errores de parámetros en PDO
    $stmtBancos->execute([
        ':startBAC' => $startDate, 
        ':endBAC' => $endDate,
        ':startScotia' => $startDate, 
        ':endScotia' => $endDate
    ]);
    $dataBancos = $stmtBancos->fetchAll();

    echo json_encode([
        'success' => true,
        'tsd' => $dataTSD,
        'bancos' => $dataBancos
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>