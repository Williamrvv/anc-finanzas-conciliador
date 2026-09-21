<?php
/**
 * BITÁCORA IRI — motor del servidor.
 * - Usa una conexión PROPIA a SQL: si el proceso observado hace ROLLBACK,
 *   el registro de la bitácora sobrevive.
 * - Nunca lanza excepciones ni imprime nada. Si falla, el sistema sigue.
 * - Nunca guarda contraseñas, tokens ni el ID real de sesión.
 */
final class Bitacora
{
    private static $pdo = null;
    private static $deshabilitada = false;
    private const MASCARA = '/pass|clave|contra|token|secret|code|state|authorization|cookie/i';

    private static function conexion()
    {
        if (self::$deshabilitada) return null;
        if (self::$pdo !== null) return self::$pdo;
        try {
            $dsn = 'sqlsrv:Server=' . getenv('DB_HOST') . ',' . getenv('DB_PORT')
                 . ';Database=' . getenv('DB_NAME')
                 . ';TrustServerCertificate=yes;Encrypt=no;LoginTimeout=3';
            self::$pdo = new PDO($dsn, getenv('DB_USER'), getenv('DB_PASSWORD'), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
        } catch (\Throwable $e) {
            self::$deshabilitada = true;
            error_log('Bitacora sin conexion: ' . $e->getMessage());
            return null;
        }
        return self::$pdo;
    }

    public static function contexto(): array
    {
        $u   = $_SESSION['user'] ?? [];
        $sid = session_id();
        return [
            'EmailUsuario' => $u['email'] ?? null,
            'Rol'          => $u['role'] ?? null,
            'IdSesion'     => $sid ? substr(hash('sha256', $sid), 0, 16) : null,
            'IP'           => $_SERVER['REMOTE_ADDR'] ?? null,
            'IPReenviada'  => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['HTTP_X_REAL_IP'] ?? null),
            'UserAgent'    => $_SERVER['HTTP_USER_AGENT'] ?? null,
        ];
    }

    /** Resume estructuras: listas -> cantidad, llaves sensibles -> ***. */
    public static function resumir($valor, int $prof = 0)
    {
        if (is_array($valor)) {
            if ($valor !== [] && array_keys($valor) === range(0, count($valor) - 1)) {
                return ['_items' => count($valor)];
            }
            if ($prof >= 2) return ['_campos' => count($valor)];
            $out = [];
            foreach ($valor as $k => $v) {
                if (preg_match(self::MASCARA, (string)$k)) {
                    $out[$k] = ($v === '' || $v === null) ? '(vacío)' : '***';
                    continue;
                }
                $out[$k] = self::resumir($v, $prof + 1);
            }
            return $out;
        }
        if (is_string($valor)) return mb_substr($valor, 0, 200);
        return $valor;
    }

    private static function resumenPeticion(): array
    {
        $r = [];
        if (!empty($_GET))  $r['query'] = self::resumir($_GET);
        if (!empty($_POST)) $r['form']  = self::resumir($_POST);
        $raw = @file_get_contents('php://input');
        if (is_string($raw) && $raw !== '' && strlen($raw) < 5000000) {
            $j = json_decode($raw, true);
            if (is_array($j)) $r['json'] = self::resumir($j);
        }
        return $r;
    }

    public static function registrar(string $modulo, string $evento, string $resultado, array $datos = []): void
    {
        self::insertar([array_merge(self::contexto(), [
            'Origen'    => 'SERVIDOR',
            'Modulo'    => $modulo,
            'Evento'    => $evento,
            'Resultado' => $resultado,
        ], $datos)]);
    }

    public static function insertar(array $filas): void
    {
        $pdo = self::conexion();
        if (!$pdo || !$filas) return;

        $cols = ['FechaCliente','Origen','Modulo','Evento','Resultado','EmailUsuario','Rol','IdSesion',
                 'IdPestana','Secuencia','Funcion','Elemento','Url','Metodo','HttpStatus','DuracionMs',
                 'Mensaje','Detalle','IP','IPReenviada','UserAgent'];
        $largos = ['Origen'=>10,'Modulo'=>30,'Evento'=>60,'Resultado'=>20,'EmailUsuario'=>150,'Rol'=>50,
                   'IdSesion'=>64,'IdPestana'=>40,'Funcion'=>150,'Elemento'=>300,'Url'=>400,'Metodo'=>10,
                   'Mensaje'=>1000,'Detalle'=>16000,'IP'=>64,'IPReenviada'=>200,'UserAgent'=>400];
        $enteros = ['Secuencia','HttpStatus','DuracionMs'];

        try {
            $st = $pdo->prepare('INSERT INTO Tbl_Bitacora (' . implode(',', $cols) . ') VALUES ('
                . rtrim(str_repeat('?,', count($cols)), ',') . ')');
            $pdo->beginTransaction();
            foreach ($filas as $f) {
                $vals = [];
                foreach ($cols as $c) {
                    $v = $f[$c] ?? null;
                    if ($c === 'Detalle' && $v !== null && !is_string($v)) {
                        $v = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
                    }
                    if (in_array($c, $enteros, true)) {
                        $v = is_numeric($v) ? (int)$v : null;
                    } elseif (is_array($v) || is_object($v)) {
                        $v = null;
                    } elseif ($v !== null) {
                        $v = (string)$v;
                        if (isset($largos[$c])) $v = mb_substr($v, 0, $largos[$c]);
                    }
                    $vals[] = $v;
                }
                $st->execute($vals);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Bitacora insert: ' . $e->getMessage());
        }
    }

    /**
     * Observa un script completo con UNA línea al inicio.
     * Al terminar lee lo que el script respondió, detecta éxito/error,
     * errores fatales y redirecciones, y lo registra.
     *
     * $opciones:
     *   emailIntento     correo que intentó entrar (login fallido)
     *   emailGlobal      nombre de la variable global que trae el correo
     *   globales         variables del script a guardar (nunca credenciales)
     *   exitoSiHaySesion el éxito se mide por la sesión creada (login SSO)
     */
    public static function observar(string $modulo, string $evento, array $opciones = []): void
    {
        ob_start();
        $inicio = $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true);

        register_shutdown_function(function () use ($modulo, $evento, $opciones, $inicio) {
            try {
                $salida    = ob_get_level() > 0 ? (string)ob_get_contents() : '';
                $detalle   = ['peticion' => self::resumenPeticion()];
                $resultado = 'INFO';
                $mensaje   = null;

                $json = ($salida !== '' && strlen($salida) < 2000000) ? json_decode($salida, true) : null;
                if (is_array($json)) {
                    if (array_key_exists('success', $json)) $resultado = $json['success'] ? 'OK' : 'ERROR';
                    if (isset($json['error'])) $mensaje = (string)$json['error'];
                    $detalle['respuesta'] = self::resumir($json);
                } elseif ($salida !== '') {
                    if (preg_match('/"success"\s*:\s*(true|false)/', substr($salida, 0, 4000), $m)) {
                        $resultado = $m[1] === 'true' ? 'OK' : 'ERROR';
                    } else {
                        $mensaje = trim(strip_tags(substr($salida, 0, 1000)));
                    }
                    $detalle['bytes_respuesta'] = strlen($salida);
                }

                $err = error_get_last();
                if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
                    $resultado = 'FATAL';
                    $mensaje   = $err['message'] . ' @ ' . basename($err['file']) . ':' . $err['line'];
                }

                foreach (($opciones['globales'] ?? []) as $g) {
                    if (array_key_exists($g, $GLOBALS) && !preg_match(self::MASCARA, $g)) {
                        $detalle['vars'][$g] = self::resumir($GLOBALS[$g]);
                    }
                }

                foreach (headers_list() as $h) {
                    if (stripos($h, 'Location:') === 0) $detalle['redirige_a'] = trim(substr($h, 9));
                }

                if (!empty($opciones['exitoSiHaySesion']) && $resultado !== 'FATAL') {
                    $resultado = isset($_SESSION['user']) ? 'OK' : 'ERROR';
                }

                $extra = [
                    'Url'        => $_SERVER['REQUEST_URI'] ?? null,
                    'Metodo'     => $_SERVER['REQUEST_METHOD'] ?? null,
                    'HttpStatus' => http_response_code() ?: null,
                    'DuracionMs' => (int)round((microtime(true) - $inicio) * 1000),
                    'Funcion'    => basename($_SERVER['SCRIPT_NAME'] ?? ''),
                    'Mensaje'    => $mensaje,
                    'Detalle'    => $detalle,
                ];

                // Login fallido: no hay sesión, se registra el correo que intentó entrar
                if (empty($_SESSION['user']['email'])) {
                    $intento = $opciones['emailIntento'] ?? null;
                    $g = $opciones['emailGlobal'] ?? '';
                    if (!$intento && $g !== '' && isset($GLOBALS[$g]) && is_string($GLOBALS[$g])) $intento = $GLOBALS[$g];
                    if ($intento) $extra['EmailUsuario'] = filter_var(trim($intento), FILTER_SANITIZE_EMAIL);
                }

                self::registrar($modulo, $evento, $resultado, $extra);
            } catch (\Throwable $e) {
                error_log('Bitacora observar: ' . $e->getMessage());
            }
        });
    }
}