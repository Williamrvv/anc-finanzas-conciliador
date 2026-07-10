<?php
session_start();
require_once '../db.php';

// Activar visualización de errores solo en el payload JSON para debugear
ini_set('display_errors', 0);

header('Content-Type: application/json');

if (!isset($_SESSION['user'])) {
    echo json_encode(['success' => false, 'error' => 'Acceso denegado']); exit;
}

try {
    $pdo = Database::connect();

    // 1. EXTRAER TSD PENDIENTES
    // Se usa LEFT JOIN para no perder la Maestra aunque falle el detalle. Prioridad: Columnas de la Maestra.
    $sqlTSD = "
        SELECT 
            m.IdTransaccion AS ID_Transaccion, 
            m.Estado,
            t.Contrato, 
            t.Cliente, 
            t.Recibo_Detalle, 
            t.MontoUSD, 
            t.TipoCambio AS TC, 
            COALESCE(t.MontoCRC, m.MontoBruto) AS MontoCRC, 
            t.TipoCobro AS Tipo,
            COALESCE(t.Autorizacion, m.Autorizacion) AS Autorizacion, 
            COALESCE(t.Tarjeta_Ultimos4, m.Tarjeta) AS Tarjeta_Ultimos4, 
            COALESCE(t.FechaPago, m.FechaTransaccion) AS Fecha, 
            t.RecibidoPor, 
            t.ICD, 
            t.SucursalCod, 
            t.SucursalNombre AS Sucursal,
            m.ColorEtiqueta, m.NotaUsuario
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_TSD t ON m.IdTransaccion = t.IdTransaccion
        WHERE m.Banco = 'TSD' 
          AND m.IdMatchTSD IS NULL 
          AND m.Estado = 'PENDIENTE'
    ";
    $dataTSD = $pdo->query($sqlTSD)->fetchAll(PDO::FETCH_ASSOC);

    // 2. EXTRAER BANCOS PENDIENTES (Solo Maestra con información hija complementaria)
    $sqlBancos = "
        SELECT 
            CAST(m.IdTransaccion AS VARCHAR(50)) AS IdTransaccion, 
            m.IdCierre AS Folio_Cierre, 
            CAST('BAC' AS VARCHAR(20)) AS Banco,
            CAST(b.NUMERO_AFILIADO AS VARCHAR(50)) AS Afiliado_MerID, 
            CAST(b.TERMINAL AS VARCHAR(50)) AS Codigo_Sucursal_Terminal,
            CAST(COALESCE(b.NOMBRECOMERCIO, 'AJUSTE MANUAL') AS VARCHAR(255)) AS Nombre_Sucursal_Comercio, 
            CAST(RIGHT(RTRIM(LTRIM(COALESCE(b.NUMERO_DE_TARJETA, m.Tarjeta))), 4) AS VARCHAR(4)) AS Tarjeta_Ultimos4,
            CAST(COALESCE(b.AUTORIZACION, m.Autorizacion) AS VARCHAR(50)) AS Numero_Autorizacion, 
            CAST(m.MontoBruto AS DECIMAL(18,2)) AS Monto_Venta_Original, 
            COALESCE(b.FECHA_PAGO, CONVERT(VARCHAR(10), m.FechaTransaccion, 23)) AS Fecha_Pago_Excel,
            CAST(a.TipoAjuste AS VARCHAR(50)) AS TipoAjuste, 
            CAST(a.Justificacion AS NVARCHAR(MAX)) AS Justificacion,
            CAST(m.ColorEtiqueta AS VARCHAR(20)) AS ColorEtiqueta, 
            CAST(m.NotaUsuario AS NVARCHAR(255)) AS NotaUsuario
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_BAC b ON m.IdTransaccion = b.IdTransaccion
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        WHERE m.Banco = 'BAC'
          AND m.Origen IN ('DETALLADO', 'AJUSTE')
          AND m.IdMatch IS NOT NULL 
          AND m.IdMatchTSD IS NULL 

        UNION ALL

        SELECT 
            CAST(m.IdTransaccion AS VARCHAR(50)) AS IdTransaccion, 
            MAX(m.IdCierre) AS Folio_Cierre, 
            CAST(m.Banco AS VARCHAR(20)) AS Banco, 
            CAST(MAX(s.MerID) AS VARCHAR(50)) AS Afiliado_MerID, 
            CAST(MAX(s.Terminal) AS VARCHAR(50)) AS Codigo_Sucursal_Terminal,
            CAST(COALESCE(MAX(s.Nombre), 'AJUSTE MANUAL') AS VARCHAR(255)) AS Nombre_Sucursal_Comercio, 
            CAST(RIGHT(RTRIM(LTRIM(COALESCE(MAX(s.Numero_Tarjeta), MAX(m.Tarjeta)))), 4) AS VARCHAR(4)) AS Tarjeta_Ultimos4,
            CAST(COALESCE(MAX(s.Numero_Autorizacion), MAX(m.Autorizacion)) AS VARCHAR(50)) AS Numero_Autorizacion, 
            CAST(MAX(m.MontoBruto) AS DECIMAL(18,2)) AS Monto_Venta_Original, 
            COALESCE(MAX(s.Fecha_Pago), CONVERT(VARCHAR(10), MAX(m.FechaTransaccion), 23)) AS Fecha_Pago_Excel,
            CAST(MAX(a.TipoAjuste) AS VARCHAR(50)) AS TipoAjuste, 
            CAST(MAX(a.Justificacion) AS NVARCHAR(MAX)) AS Justificacion,
            CAST(MAX(m.ColorEtiqueta) AS VARCHAR(20)) AS ColorEtiqueta, 
            CAST(MAX(m.NotaUsuario) AS NVARCHAR(255)) AS NotaUsuario
        FROM Tbl_Transacciones_Maestra m
        LEFT JOIN Tbl_Detalle_Scotia s ON m.IdTransaccion = s.IdTransaccion
        LEFT JOIN Tbl_Ajustes_Auditoria a ON m.IdTransaccion = a.IdTransaccion
        WHERE m.Banco = 'Davibank' 
          AND m.Origen IN ('DETALLADO', 'AJUSTE')
          AND m.IdMatch IS NOT NULL 
          AND m.IdMatchTSD IS NULL 
        GROUP BY m.IdTransaccion, m.Banco
    ";
    $dataBancos = $pdo->query($sqlBancos)->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'tsd' => $dataTSD ?: [],
        'bancos' => $dataBancos ?: []
    ]);

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => "Error DB: " . $e->getMessage()]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => "Error Genérico: " . $e->getMessage()]);
}
?>