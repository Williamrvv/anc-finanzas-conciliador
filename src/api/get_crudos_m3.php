<?php
session_start();
require_once '../db.php';
require_once 'tsd_db.php';

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

$startDate = $_GET['start'] ?? date('Y-m-d');
$endDate = $_GET['end'] ?? date('Y-m-d');
$source = $_GET['source'] ?? 'all'; // bac, scotia, tsd

try {
    $pdoBancos = Database::connect();
    $data = [];

    // =====================================
    // 1. EXTRACCIÓN BAC
    // =====================================
    if ($source === 'bac' || $source === 'all') {
        $sqlBAC = "
            SELECT 
                c.IdCierre AS Folio_Cierre, 'BAC' AS Banco, 
                b.IdTransaccion, b.NUMERO_AFILIADO AS Afiliado_MerID, b.NOMBRECOMERCIO AS Nombre_Comercio,
                b.NUMERO_DE_TARJETA AS Numero_Tarjeta, b.AUTORIZACION AS Numero_Autorizacion, 
                b.TERMINAL AS Terminal, b.MONTO_VENTA AS Monto_Original, b.MONTONETO AS Monto_Neto, 
                b.FECHA_PAGO AS Fecha_Pago_Excel, b.FECHA_TRANSACCION, b.FECHA_CIERRE_DATAFONO, 
                b.COMISION, b.RETENCION_VENTAS, b.RETENCION_RENTA, b.NUMERO_LIQUIDACION, 
                b.NUMERO_CUENTA, b.TIPO_CAMBIO, b.AJUSTE_COMISION_INTERNACIONAL, b.TIPO_TARJETA,
                b.CentroCosto, a.TipoAjuste, a.Justificacion
            FROM Tbl_Detalle_BAC b
            INNER JOIN Tbl_Conciliacion_Cierres c ON b.IdCierre = c.IdCierre 
            LEFT JOIN Tbl_Ajustes_Auditoria a ON b.IdTransaccion = a.IdTransaccion
            WHERE c.ConsolidadoTSD IS NULL 
            AND (
                (b.AUTORIZACION IS NOT NULL AND RTRIM(LTRIM(b.AUTORIZACION)) <> '')
                OR a.IdTransaccion IS NOT NULL
            ) ORDER BY c.IdCierre ASC;
        ";
        $data = $pdoBancos->query($sqlBAC)->fetchAll();
    }

    // =====================================
    // 2. EXTRACCIÓN SCOTIA (DAVIBANK)
    // =====================================
    else if ($source === 'scotia') {
        $sqlSCOTIA = "
            SELECT 
                c.IdCierre AS Folio_Cierre, 'SCOTIA' AS Banco, 
                s.IdTransaccion, s.MerID AS Afiliado_MerID, s.Nombre AS Nombre_Comercio,
                s.Numero_Tarjeta AS Numero_Tarjeta, s.Numero_Autorizacion AS Numero_Autorizacion, 
                s.Terminal AS Terminal, s.Monto_Orig AS Monto_Original, s.Monto_Neto AS Monto_Neto, 
                s.Fecha_Pago AS Fecha_Pago_Excel, s.Fuente, s.Moneda, s.Transaccion, s.Razon_Social, 
                s.Fecha_Lote_Ajuste, s.Numero_Lote_Ajuste, s.Numero_Pago, s.Monto_Bruto, 
                s.Monto_Comision_Total, s.Porc_Comision_Total, s.Monto_Comision_Int, s.Porc_Comision_Int, 
                s.Monto_Retencion_IVA, s.Porc_Retencion_IVA, s.Monto_Retencion_ISR, s.Estatus,
                s.CentroCosto, a.TipoAjuste, a.Justificacion
            FROM Tbl_Detalle_Scotia s
            INNER JOIN Tbl_Conciliacion_Cierres c ON s.IdCierre = c.IdCierre 
            LEFT JOIN Tbl_Ajustes_Auditoria a ON s.IdTransaccion = a.IdTransaccion
            WHERE c.ConsolidadoTSD IS NULL 
            AND (
                (s.Numero_Autorizacion IS NOT NULL AND RTRIM(LTRIM(s.Numero_Autorizacion)) <> '' AND s.Numero_Tarjeta IS NOT NULL AND RTRIM(LTRIM(s.Numero_Tarjeta)) <> '')
                OR a.IdTransaccion IS NOT NULL
            ) ORDER BY c.IdCierre ASC;
        ";
        $data = $pdoBancos->query($sqlSCOTIA)->fetchAll();
    }

    // =====================================
    // 3. EXTRACCIÓN TSD (Pesada)  
    // =====================================
    else if ($source === 'tsd') {
        $pdoTSD = TSDDatabase::connect();
        // Consulta bimodal (Contratos + Reservas)
        $sqlTSD = "
            SELECT
                P.ID AS [ID_Transaccion],
                P.KNUM AS [Contrato],
                ISNULL(C.FNAME, R.FNAME) + ' ' + ISNULL(C.LNAME, R.LNAME) AS [Cliente],
                P.AMOUNT AS [MontoUSD],
                ISNULL(E.sell, ISNULL(C.USDRate, R.USDRate)) AS [TC],
                (ISNULL(E.sell, ISNULL(C.USDRate, R.USDRate)) * P.AMOUNT) AS [MontoCRC],
                P.TYPE AS [Tipo],
                P.Ref AS [Autorizacion],
                P.RECEIPT AS [Recibo_Detalle],
                CAST(P.Pay_Date AS DATE) AS [Fecha],
                ISNULL(U.FirstName + ' ' + U.LastName, P.TAKEN_BY) AS [RecibidoPor], 
                P.DBR AS [ICD],
                P.LOC_CODE AS [SucursalCod],
                S.Name AS [Sucursal]
            FROM dbo.Cpay AS P
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
              AND CAST(P.Pay_Date AS DATE) BETWEEN :start AND :end 
            ORDER BY P.Pay_Date DESC, P.KNUM;
        ";
        $stmtTSD = $pdoTSD->prepare($sqlTSD);
        $stmtTSD->execute([':start' => $startDate, ':end' => $endDate]);
        $data = $stmtTSD->fetchAll();

        // A. Inyectar Diccionario de Tarjetas
        $stmtTarjetas = $pdoBancos->query("SELECT NumeroContrato, Tarjeta_Ultimos4 FROM Tbl_Historial_Tarjetas");
        $mapaTarjetas = [];
        foreach($stmtTarjetas->fetchAll(PDO::FETCH_ASSOC) as $t) {
            $mapaTarjetas[trim($t['NumeroContrato'])] = trim($t['Tarjeta_Ultimos4']);
        }

        // B. Inyectar Diccionario de Centros de Costo (Mapeo por SucursalCod)
        $stmtCC = $pdoBancos->query("SELECT DISTINCT CodigoSucursal, CentroCosto FROM Tbl_Diccionario_Afiliados WHERE CodigoSucursal IS NOT NULL AND CodigoSucursal <> '' AND Activo = 1");
        $mapaCC = [];
        foreach($stmtCC->fetchAll(PDO::FETCH_ASSOC) as $d) {
            $mapaCC[strtoupper(trim($d['CodigoSucursal']))] = trim($d['CentroCosto']);
        }

        // C. Mapeo en Memoria
        foreach ($data as &$row) {
            $row['Tarjeta_Ultimos4'] = $mapaTarjetas[trim($row['Contrato'])] ?? '';
            $row['CentroCosto'] = $mapaCC[strtoupper(trim($row['SucursalCod']))] ?? '00-00-00';
        }
        unset($row);
    }

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>