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
    // 1. QUERY TSD (Usa $pdoTSD) 
    // ==========================================
    $sqlTSD = "
        SELECT
            P.ID AS [ID_Transaccion],
            P.KNUM AS [Contrato],
            
            /* Extrae el nombre de la tabla de contratos, si no existe, lo toma de reservas */
            ISNULL(C.FNAME, R.FNAME) + ' ' + ISNULL(C.LNAME, R.LNAME) AS [Cliente],
            
            P.AMOUNT AS [MontoUSD],
            
            /* Extrae el Tipo de Cambio en este orden: Exchange -> Contrato -> Reserva */
            ISNULL(E.sell, ISNULL(C.USDRate, R.USDRate)) AS [TC],
            (ISNULL(E.sell, ISNULL(C.USDRate, R.USDRate)) * P.AMOUNT) AS [MontoCRC],
            
            P.TYPE AS [Tipo],
            
            /* Columna directa de tipo de tarjeta desde Cpay */
            P.CARD_TYPE AS [Tipo_Tarjeta],
            
            P.Ref AS [Autorizacion],
            P.RECEIPT AS [Recibo_Detalle],
            CAST(P.Pay_Date AS DATE) AS [Fecha],
            ISNULL(U.FirstName + ' ' + U.LastName, P.TAKEN_BY) AS [RecibidoPor], 
            P.DBR AS [ICD],
            P.LOC_CODE AS [SucursalCod],
            S.Name AS [Sucursal]
            
        FROM dbo.Cpay AS P

        /* Búsquedas directas e independientes por número de documento */
        LEFT JOIN dbo.Cra001 AS C ON P.KNUM = C.KNUM
        LEFT JOIN dbo.Creser AS R ON P.KNUM = R.KNUM

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
    $stmtTSD->execute([':startDate' => $startDate, ':endDate' => $endDate]);
    $dataTSD = $stmtTSD->fetchAll();

    // ==========================================
    // 1.5 MERGE EN PHP: Agregar Tarjetas y Centro de Costo al array TSD
    // ==========================================
    // A. Extraer Tarjetas
    $stmtTarjetas = $pdoBancos->query("SELECT NumeroContrato, Tarjeta_Ultimos4 FROM Tbl_Historial_Tarjetas");
    $tarjetasRows = $stmtTarjetas->fetchAll(PDO::FETCH_ASSOC);
    $mapaTarjetas = [];
    foreach($tarjetasRows as $t) { $mapaTarjetas[trim($t['NumeroContrato'])] = trim($t['Tarjeta_Ultimos4']); }

    // B. Obtener Centros de Costo desde la API del CRM (misma fuente que el visor de crudos)
    // Normalización agresiva tipo Excel: SOLO letras y números, sin ceros a la izquierda
    $normCod = function($v) {
        $s = preg_replace('/[^A-Z0-9]/', '', strtoupper((string)$v));
        if ($s === '') return '';
        $n = ltrim($s, '0');
        return $n === '' ? '0' : $n;
    };
    $mapaCC = [];
    $ctxCC = stream_context_create([
        'http' => ['timeout' => 8],
        'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
    ]);
    $crmJson = @file_get_contents('https://intanc.com/CRM/API/V1/NOTIFICADBR/centros-costo-tsd.php', false, $ctxCC);
    $crmData = $crmJson !== false ? json_decode($crmJson, true) : null;
    if (isset($crmData['ok']) && $crmData['ok'] && isset($crmData['data'])) {
        foreach ($crmData['data'] as $itemCC) {
            $k = $normCod($itemCC['Codigo'] ?? '');
            if ($k !== '' && !isset($mapaCC[$k])) $mapaCC[$k] = trim($itemCC['Centro_Costo'] ?? '');
        }
    }

    // C. Inyectar al array de TSD en memoria
    foreach ($dataTSD as &$row) {
        $contrato = trim($row['Contrato']);
        $sucursal = $normCod($row['SucursalCod']);
        
        $row['Tarjeta_Ultimos4'] = $mapaTarjetas[$contrato] ?? '';
        $row['CentroCosto'] = $mapaCC[$sucursal] ?? '00-00-00';
    }
    unset($row);

    // ==========================================
    // 2. QUERY BANCOS (Extracción por Marca de Agua y Datos Financieros)
    // ==========================================
    $sqlBancos = "
        WITH FoliosNuevos AS (
    -- 1. EXTRACCIÓN DIRECTA: BAC CREDOMATIC
    SELECT 
        b.IdTransaccion, c.IdCierre AS Folio_Cierre,
        'BAC' AS Banco, b.NUMERO_AFILIADO AS Afiliado_MerID, b.TERMINAL AS Codigo_Sucursal_Terminal,
        b.NOMBRECOMERCIO AS Nombre_Sucursal_Comercio, RIGHT(RTRIM(LTRIM(b.NUMERO_DE_TARJETA)), 4) AS Tarjeta_Ultimos4,
        b.AUTORIZACION AS Numero_Autorizacion, b.MONTO_VENTA AS Monto_Venta_Original, b.FECHA_PAGO AS Fecha_Pago_Excel,
        
        -- Datos Financieros Homologados
        b.MONTONETO AS Monto_Neto, b.COMISION AS Comision, b.RETENCION_VENTAS AS Retencion_Ventas,
        b.RETENCION_RENTA AS Retencion_Renta, b.AJUSTE_COMISION_INTERNACIONAL AS ACI,
        
        a.TipoAjuste, a.Justificacion, COALESCE(b.CentroCosto, '00-00-00') AS CentroCosto
    FROM Tbl_Detalle_BAC b
    INNER JOIN Tbl_Transacciones_Maestra m ON b.IdTransaccion = m.IdTransaccion
    INNER JOIN Tbl_Conciliacion_Cierres c ON b.IdCierre = c.IdCierre
    LEFT JOIN Tbl_Ajustes_Auditoria a ON b.IdTransaccion = a.IdTransaccion
    WHERE c.IdCierre IN (
        SELECT TOP 2 IdCierre
        FROM Tbl_Conciliacion_Cierres
        ORDER BY IdCierre DESC
    )
      AND m.IdMatch IS NOT NULL 
      AND m.Origen IN ('DETALLADO', 'AJUSTE')

    UNION ALL

    -- 2. EXTRACCIÓN DIRECTA: SCOTIA (DAVIBANK)
    SELECT 
        s.IdTransaccion, c.IdCierre AS Folio_Cierre,
        'Davibank' AS Banco, s.MerID AS Afiliado_MerID, s.Terminal AS Codigo_Sucursal_Terminal,
        s.Nombre AS Nombre_Sucursal_Comercio, RIGHT(RTRIM(LTRIM(s.Numero_Tarjeta)), 4) AS Tarjeta_Ultimos4,
        s.Numero_Autorizacion AS Numero_Autorizacion, s.Monto_Orig AS Monto_Venta_Original, s.Fecha_Pago AS Fecha_Pago_Excel,

        -- Datos Financieros Homologados
        s.Monto_Neto AS Monto_Neto, s.Monto_Comision_Total AS Comision, s.Monto_Retencion_IVA AS Retencion_Ventas,
        s.Monto_Retencion_ISR AS Retencion_Renta, 0 AS ACI,
        
        a.TipoAjuste, a.Justificacion, COALESCE(s.CentroCosto, '00-00-00') AS CentroCosto
    FROM Tbl_Detalle_Scotia s
    INNER JOIN Tbl_Transacciones_Maestra m ON s.IdTransaccion = m.IdTransaccion
    INNER JOIN Tbl_Conciliacion_Cierres c ON s.IdCierre = c.IdCierre
    LEFT JOIN Tbl_Ajustes_Auditoria a ON s.IdTransaccion = a.IdTransaccion
    WHERE c.IdCierre IN (
        SELECT TOP 2 IdCierre
        FROM Tbl_Conciliacion_Cierres
        ORDER BY IdCierre DESC
    )
      AND m.IdMatch IS NOT NULL 
      AND m.Origen IN ('DETALLADO', 'AJUSTE')
)
SELECT * 
FROM FoliosNuevos
ORDER BY Folio_Cierre ASC, Banco ASC, TRY_CONVERT(date, Fecha_Pago_Excel, 103) ASC;
    ";

    $stmtBancos = $pdoBancos->prepare($sqlBancos);
    // Bancos: se ignora el rango del date-picker y se consultan únicamente los últimos dos cierres.
    $stmtBancos->execute();
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