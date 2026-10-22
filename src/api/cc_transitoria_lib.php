<?php
// =========================================================================
// CENTRO DE COSTO TRANSITORIO (LINKS DE PAGO)
// Los links de pago (afiliado 90631045) se registran en el Diccionario
// Maestro con este CC. M2 los guarda con él y avisa; M3 obliga a asignar
// el CC real antes de guardar el consolidado o descargar un cargador.
// Si cambia el CC de la transitoria en el diccionario, se cambia AQUÍ.
// =========================================================================
if (!defined('CC_TRANSITORIA')) {
    define('CC_TRANSITORIA', '12-34-56');
}

if (!function_exists('cc_catalogo_centros_costo')) {
    /**
     * Catálogo de centros de costo válidos para sacar una transacción de la
     * transitoria: Diccionario Maestro + API de sucursales del CRM (la misma
     * fuente que usa el cruce del M3). Excluye la transitoria y 00-00-00.
     * Devuelve [['cc' => '01-04-03', 'etiqueta' => 'NATIONAL LINK · SJOE71'], ...]
     */
    function cc_catalogo_centros_costo(PDO $pdo): array
    {
        $mapa = [];
        $agregar = function ($cc, $etiqueta) use (&$mapa) {
            $cc = trim((string)$cc);
            $etiqueta = trim((string)$etiqueta);
            if ($cc === '' || $cc === CC_TRANSITORIA || $cc === '00-00-00') return;
            if (!isset($mapa[$cc])) $mapa[$cc] = [];
            if ($etiqueta !== '' && count($mapa[$cc]) < 4 && !in_array($etiqueta, $mapa[$cc], true)) {
                $mapa[$cc][] = $etiqueta;
            }
        };

        // 1. Diccionario Maestro (Afiliado -> Centro de Costo)
        $stmt = $pdo->query("SELECT CentroCosto, NombreSucursal FROM Tbl_Diccionario_Afiliados WHERE Activo = 1");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $agregar($r['CentroCosto'] ?? '', $r['NombreSucursal'] ?? '');
        }

        // 2. API de sucursales del CRM (si no responde, queda sólo el diccionario)
        $ctx = stream_context_create([
            'http' => ['timeout' => 8],
            'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false]
        ]);
        $json = @file_get_contents('https://intanc.com/CRM/API/V1/NOTIFICADBR/centros-costo-tsd.php', false, $ctx);
        $crm = $json !== false ? json_decode($json, true) : null;
        if (isset($crm['ok']) && $crm['ok'] && isset($crm['data']) && is_array($crm['data'])) {
            foreach ($crm['data'] as $item) {
                $agregar($item['Centro_Costo'] ?? '', $item['Codigo'] ?? '');
            }
        }

        ksort($mapa, SORT_STRING);
        $salida = [];
        foreach ($mapa as $cc => $etiquetas) {
            $salida[] = ['cc' => $cc, 'etiqueta' => implode(' · ', $etiquetas)];
        }
        return $salida;
    }
}