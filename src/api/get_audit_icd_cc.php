<?php
ini_set('display_errors', 0);
session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'No autorizado.']);
    exit;
}

require_once '../db.php';
require_once 'tsd_db.php';

$icd = trim($_GET['icd'] ?? '');

if (empty($icd)) {
    echo json_encode(['success' => false, 'error' => 'Debe proveer un número de ICD.']);
    exit;
}

try {
    $pdoTsd = TSDDatabase::connect();
    $pdoLocal = Database::connect();

    // 1. Obtener Cabecera de TSD
    $stmtHeaderTSD = $pdoTsd->prepare("
        SELECT TOP 1 D.DBRNum, D.CreateDate, D.LOC_CODE, S.Name AS Nombre_Sucursal
        FROM dbo.DBR D
        LEFT JOIN dbo.Setup S ON D.LOC_CODE = S.Location
        WHERE D.DBRNum = ?
    ");
    $stmtHeaderTSD->execute([$icd]);
    $headerTSD = $stmtHeaderTSD->fetch(PDO::FETCH_ASSOC);

    if (!$headerTSD) {
        throw new Exception("El ICD '$icd' no existe en la base de datos TSD.");
    }

    // 2. Verificar si está cerrado en BD Local
    $stmtCierreLocal = $pdoLocal->prepare("
        SELECT C.IdCierre, U.Nombre AS CerradoPor 
        FROM Tbl_CierreCaja_Header C
        LEFT JOIN Tbl_Usuarios U ON C.EmailUsuario = U.Email
        WHERE C.ICD = ?
    ");
    $stmtCierreLocal->execute([$icd]);
    $cierreLocal = $stmtCierreLocal->fetch(PDO::FETCH_ASSOC);

    // 3. Obtener Transacciones Orginales TSD (Igual que Módulo Trabajo)
    $stmtDetallesTSD = $pdoTsd->prepare("
        SELECT P.KNUM, C.FNAME, C.LNAME, P.CARD_TYPE, P.AMOUNT,
               ISNULL(E.sell, C.USDRate) * P.AMOUNT AS MontoCRC
        FROM dbo.Cpay P
        INNER JOIN dbo.Cra001 C ON P.KNUM = C.KNUM
        OUTER APPLY (
            SELECT TOP 1 Ex.sell FROM dbo.Exchange Ex
            WHERE Ex.LocCode = P.LOC_CODE AND Ex.description = 'TO-CR' AND Ex.AsOf <= CAST(P.Pay_Date AS DATE) 
            ORDER BY Ex.AsOf DESC 
        ) E
        WHERE P.PAY_CHARGE = 'P' AND P.TYPE IN ('3','7','C','F','J') AND P.DBR = ?
    ");
    $stmtDetallesTSD->execute([$icd]);
    $detallesTSD = $stmtDetallesTSD->fetchAll(PDO::FETCH_ASSOC);

    // 4. Mapeo de Estados y Cruce con Casos Locales
    $transaccionesFinales = [];

    // Si ya se cerró localmente, buscamos si los contratos tienen MatchExitoso o Ticket
    if ($cierreLocal) {
        $idCierre = $cierreLocal['IdCierre'];

        // Extraer detalles de match
        $stmtMatch = $pdoLocal->prepare("SELECT Numero_Contrato, MatchExitoso FROM Tbl_CierreCaja_Detalle WHERE IdCierre = ?");
        $stmtMatch->execute([$idCierre]);
        $matchesDB = $stmtMatch->fetchAll(PDO::FETCH_KEY_PAIR);

        // Extraer Tickets (Casos) relacionados a ese cierre
        $stmtCasos = $pdoLocal->prepare("SELECT NumeroContrato, IdCaso, Estado FROM Tbl_Casos_TSD WHERE IdCierreOrigen = ?");
        $stmtCasos->execute([$idCierre]);
        $casosBD = [];
        foreach ($stmtCasos->fetchAll(PDO::FETCH_ASSOC) as $caso) {
            $casosBD[$caso['NumeroContrato']] = $caso;
        }

        foreach ($detallesTSD as $t) {
            $knum = $t['KNUM'];
            $estadoStr = 'DESCONOCIDO';
            $idCaso = null;

            if (isset($casosBD[$knum])) {
                $estadoStr = $casosBD[$knum]['Estado'];
                $idCaso = $casosBD[$knum]['IdCaso'];
            } elseif (isset($matchesDB[$knum]) && $matchesDB[$knum] == 1) {
                $estadoStr = 'MATCH EXACTO';
            }

            $transaccionesFinales[] = [
                'Contrato' => $knum,
                'Cliente' => trim($t['FNAME'] . ' ' . $t['LNAME']),
                'Tarjeta' => $t['CARD_TYPE'],
                'MontoCRC' => $t['MontoCRC'],
                'Estado' => $estadoStr,
                'IdCaso' => $idCaso
            ];
        }
    } else {
        // Si no se ha cerrado, todos están "No Registrados"
        foreach ($detallesTSD as $t) {
            $transaccionesFinales[] = [
                'Contrato' => $t['KNUM'],
                'Cliente' => trim($t['FNAME'] . ' ' . $t['LNAME']),
                'Tarjeta' => $t['CARD_TYPE'],
                'MontoCRC' => $t['MontoCRC'],
                'Estado' => 'NO REGISTRADO AÚN',
                'IdCaso' => null
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'header' => [
            'ICD' => $headerTSD['DBRNum'],
            'Sucursal' => $headerTSD['LOC_CODE'] . ' - ' . $headerTSD['Nombre_Sucursal'],
            'FechaTSD' => $headerTSD['CreateDate'],
            'CerradoLocalmente' => $cierreLocal ? true : false,
            'CerradoPor' => $cierreLocal['CerradoPor'] ?? null
        ],
        'transacciones' => $transaccionesFinales
    ]);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>