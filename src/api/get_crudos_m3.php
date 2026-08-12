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
                b.CentroCosto, a.TipoAjuste, a.Justificacion, a.EvidenciaB64
            FROM Tbl_Detalle_BAC b
            INNER JOIN Tbl_Conciliacion_Cierres c ON b.IdCierre = c.IdCierre 
            LEFT JOIN Tbl_Ajustes_Auditoria a ON b.IdTransaccion = a.IdTransaccion
            WHERE c.IdCierre IN (
                SELECT TOP 2 IdCierre
                FROM Tbl_Conciliacion_Cierres
                ORDER BY IdCierre DESC
            )
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
                s.CentroCosto, a.TipoAjuste, a.Justificacion, a.EvidenciaB64
            FROM Tbl_Detalle_Scotia s
            INNER JOIN Tbl_Conciliacion_Cierres c ON s.IdCierre = c.IdCierre 
            LEFT JOIN Tbl_Ajustes_Auditoria a ON s.IdTransaccion = a.IdTransaccion
            WHERE c.IdCierre IN (
                SELECT TOP 2 IdCierre
                FROM Tbl_Conciliacion_Cierres
                ORDER BY IdCierre DESC
            )
            AND (
                (s.Numero_Autorizacion IS NOT NULL AND RTRIM(LTRIM(s.Numero_Autorizacion)) <> '' AND s.Numero_Tarjeta IS NOT NULL AND RTRIM(LTRIM(s.Numero_Tarjeta)) <> '')
                OR a.IdTransaccion IS NOT NULL
            ) ORDER BY c.IdCierre ASC;
        ";
        $data = $pdoBancos->query($sqlSCOTIA)->fetchAll();
    }

    // =====================================
    // 2.3 BAC DESDE BASE DE DATOS (Folios consolidados, por fecha de folio)
    // =====================================
    else if ($source === 'bac_bd') {
        $stmt = $pdoBancos->prepare("
            SELECT 
                c.Folio, CAST(c.ConsolidadoTSD AS DATE) AS Fecha_Folio, 'BAC' AS Banco,
                b.IdTransaccion, b.NUMERO_AFILIADO AS Afiliado_MerID, b.NOMBRECOMERCIO AS Nombre_Comercio,
                b.NUMERO_DE_TARJETA AS Numero_Tarjeta, b.AUTORIZACION AS Numero_Autorizacion, 
                b.TERMINAL AS Terminal, b.MONTO_VENTA AS Monto_Original, b.MONTONETO AS Monto_Neto, 
                b.FECHA_PAGO AS Fecha_Pago_Excel, b.FECHA_TRANSACCION, b.FECHA_CIERRE_DATAFONO, 
                b.COMISION, b.RETENCION_VENTAS, b.RETENCION_RENTA, b.NUMERO_LIQUIDACION, 
                b.NUMERO_CUENTA, b.TIPO_CAMBIO, b.AJUSTE_COMISION_INTERNACIONAL, b.TIPO_TARJETA,
                b.CentroCosto, a.TipoAjuste, a.Justificacion, a.EvidenciaB64
            FROM Tbl_Detalle_BAC b
            INNER JOIN Tbl_Conciliacion_Cierres c ON b.IdCierre = c.IdCierre 
            LEFT JOIN Tbl_Ajustes_Auditoria a ON b.IdTransaccion = a.IdTransaccion
            WHERE TRY_CONVERT(date, b.FECHA_PAGO) BETWEEN :start AND :end
            ORDER BY c.IdCierre ASC
        ");
        $stmt->execute([':start' => $startDate, ':end' => $endDate]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // =====================================
    // 2.4 DAVIBANK DESDE BASE DE DATOS (Folios consolidados, por fecha de folio)
    // =====================================
    else if ($source === 'scotia_bd') {
        $stmt = $pdoBancos->prepare("
            SELECT 
                c.Folio, CAST(c.ConsolidadoTSD AS DATE) AS Fecha_Folio, 'SCOTIA' AS Banco,
                s.IdTransaccion, s.MerID AS Afiliado_MerID, s.Nombre AS Nombre_Comercio,
                s.Numero_Tarjeta AS Numero_Tarjeta, s.Numero_Autorizacion AS Numero_Autorizacion, 
                s.Terminal AS Terminal, s.Monto_Orig AS Monto_Original, s.Monto_Neto AS Monto_Neto, 
                s.Fecha_Pago AS Fecha_Pago_Excel, s.Fuente, s.Moneda, s.Transaccion, s.Razon_Social, 
                s.Fecha_Lote_Ajuste, s.Numero_Lote_Ajuste, s.Numero_Pago, s.Monto_Bruto, 
                s.Monto_Comision_Total, s.Porc_Comision_Total, s.Monto_Comision_Int, s.Porc_Comision_Int, 
                s.Monto_Retencion_IVA, s.Porc_Retencion_IVA, s.Monto_Retencion_ISR, s.Estatus,
                s.CentroCosto, a.TipoAjuste, a.Justificacion, a.EvidenciaB64
            FROM Tbl_Detalle_Scotia s
            INNER JOIN Tbl_Conciliacion_Cierres c ON s.IdCierre = c.IdCierre 
            LEFT JOIN Tbl_Ajustes_Auditoria a ON s.IdTransaccion = a.IdTransaccion
            WHERE TRY_CONVERT(date, s.Fecha_Pago) BETWEEN :start AND :end
            ORDER BY c.IdCierre ASC
        ");
        $stmt->execute([':start' => $startDate, ':end' => $endDate]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // =====================================
    // 2.5 EXTRACCIÓN TSD DESDE BASE DE DATOS (Lo ya consolidado, por fecha de folio)
    // =====================================
    else if ($source === 'tsd_bd') {
        $stmt = $pdoBancos->prepare("
            SELECT 
                c.Folio, CAST(c.ConsolidadoTSD AS DATE) AS Fecha_Folio,
                t.IdTransaccion, t.Contrato, t.Cliente, t.Recibo_Detalle, 
                t.MontoUSD, t.TipoCambio, t.MontoCRC, t.TipoTarjeta, 
                t.Autorizacion, t.Tarjeta_Ultimos4, t.FechaPago, t.RecibidoPor, 
                t.ICD, t.SucursalCod, t.SucursalNombre, t.CentroCosto,
                m.Estado, m.TipoCruceTSD
            FROM Tbl_Detalle_TSD t
            INNER JOIN Tbl_Conciliacion_Cierres c ON t.IdCierre = c.IdCierre
            LEFT JOIN Tbl_Transacciones_Maestra m ON t.IdTransaccion = m.IdTransaccion
            WHERE t.FechaPago BETWEEN :start AND :end
            ORDER BY t.FechaPago DESC, t.Contrato
        ");
        $stmt->execute([':start' => $startDate, ':end' => $endDate]);
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
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
                P.CARD_TYPE AS [Tipo_Tarjeta],
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

        $normCod = function($v) {
            $s = preg_replace('/[^A-Z0-9]/', '', strtoupper((string)$v));
            if ($s === '') return '';
            $n = ltrim($s, '0');
            return $n === '' ? '0' : $n;
        };
        // Fuente de verdad: API del CRM (catálogo oficial de CC por código de estación TSD)
        $mapaCC = [];
        $apiCCError = null;
        $ctxCC = stream_context_create([
            'http' => ['timeout' => 8],
            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
        ]);
        $crmJson = @file_get_contents('https://intanc.com/CRM/API/V1/NOTIFICADBR/centros-costo-tsd.php', false, $ctxCC);
        if ($crmJson === false) {
            $apiCCError = 'No se pudo contactar la API del CRM de Centros de Costo.';
        } else {
            $crmData = json_decode($crmJson, true);
            if (!isset($crmData['ok']) || !$crmData['ok'] || !isset($crmData['data'])) {
                $apiCCError = 'La API del CRM respondio en un formato inesperado.';
            } else {
                foreach ($crmData['data'] as $item) {
                    $k = $normCod($item['Codigo'] ?? '');
                    if ($k !== '' && !isset($mapaCC[$k])) $mapaCC[$k] = trim($item['Centro_Costo'] ?? '');
                }
            }
        }

        // C. Mapeo en Memoria
        // 'SIN-API' = la API no respondió (falla técnica) / '00-00-00' = el código no está en el catálogo
        $sinMatch = [];
        foreach ($data as &$row) {
            $row['Tarjeta_Ultimos4'] = $mapaTarjetas[trim($row['Contrato'])] ?? '';
            $llaveCC = $normCod($row['SucursalCod']);
            $row['CentroCosto'] = $apiCCError ? 'SIN-API' : ($mapaCC[$llaveCC] ?? '00-00-00');
            if (!$apiCCError && !isset($mapaCC[$llaveCC])) $sinMatch[$llaveCC] = $row['SucursalCod'];
        }
        unset($row);

        // MODO DIAGNÓSTICO TEMPORAL: ?debug_cc=1 revela por qué no cruzan los CC
        if (isset($_GET['debug_cc'])) {
            echo json_encode(['success' => true, 'debug' => [
                'estado_api_crm'          => $apiCCError ?: 'OK',
                'total_filas_tsd'         => count($data),
                'total_llaves_api'        => count($mapaCC),
                'llaves_api'              => array_keys($mapaCC),
                'codigos_tsd_sin_match'   => $sinMatch
            ], 'nota' => 'Compare visualmente: las llaves de la API vs los codigos TSD que no cruzaron.']);
            exit;
        }

        // ============================================================
        // DIAGNÓSTICO TEMPORAL (?debug_cc=1): radiografía byte a byte
        // de por qué los códigos de TSD no cruzan con el Diccionario.
        // Retirar este bloque cuando el problema esté resuelto.
        // ============================================================
        if (isset($_GET['debug_cc'])) {
            $sinMatch = []; $conMatch = 0;
            foreach ($data as $r2) {
                if (($r2['CentroCosto'] ?? '') === '00-00-00') {
                    $raw = (string)($r2['SucursalCod'] ?? '');
                    if (!isset($sinMatch[$raw])) $sinMatch[$raw] = ['crudo' => $raw, 'hex' => bin2hex($raw), 'normalizado' => $normCod($raw), 'filas' => 0];
                    $sinMatch[$raw]['filas']++;
                } else { $conMatch++; }
            }
            $dicCrudo = $pdoBancos->query("SELECT CodigoSucursal, CentroCosto FROM Tbl_Diccionario_Afiliados WHERE Activo = 1 AND ISNULL(CodigoSucursal,'') <> ''")->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'debug_cc' => [
                'totalFilasTSD'      => count($data),
                'filasConCC'         => $conMatch,
                'filasSinCC'         => count($data) - $conMatch,
                'codigosSinMatch'    => array_values($sinMatch),
                'llavesNormalizadas' => array_keys($mapaCC),
                'diccionarioCrudo'   => array_map(fn($d) => ['crudo' => $d['CodigoSucursal'], 'hex' => bin2hex($d['CodigoSucursal']), 'normalizado' => $normCod($d['CodigoSucursal']), 'cc' => $d['CentroCosto']], $dicCrudo)
            ]], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>