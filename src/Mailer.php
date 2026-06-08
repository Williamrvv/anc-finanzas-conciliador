<?php
class Mailer {
    
    public static function send($to_list, $subject, $body) {
        $host = getenv('SMTP_HOST');
        $port = 587; // <-- FORZADO MANUALMENTE PARA EVITAR BLOQUEO DE FIREWALL
        $user = getenv('SMTP_USER');
        $pass = getenv('SMTP_PASS');

        if (empty($host) || empty($user) || empty($pass)) {
            throw new Exception("Error SMTP: Credenciales no configuradas en el archivo .env.");
        }

        // 1. Configuración de Sockets
        $timeout = 15;
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        $isImplicitSSL = ($port == 465);
        $socketHost = $isImplicitSSL ? "ssl://$host" : $host;
        
        // El arroba (@) evita que PHP imprima el warning en pantalla rompiendo el JSON
        $socket = @stream_socket_client("$socketHost:$port", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
        
        if (!$socket) {
            $errstr = empty($errstr) ? "Conexión bloqueada por el Firewall de la red o fallo de DNS." : $errstr;
            throw new Exception("No se pudo conectar a $socketHost:$port - $errstr");
        }

        // Lector del buffer del servidor
        $readResponse = function() use ($socket) {
            $response = '';
            while ($line = fgets($socket, 515)) {
                $response .= $line;
                if (substr($line, 3, 1) === ' ') break;
            }
            return $response;
        };

        // Enviador de comandos
        $sendCommand = function($cmd, $expected_code) use ($socket, $readResponse) {
            if ($cmd !== null) {
                fwrite($socket, $cmd . "\r\n");
            }
            $res = $readResponse();
            if ($expected_code && substr($res, 0, 3) != $expected_code) {
                throw new Exception("Esperaba código $expected_code, pero el servidor respondió: $res");
            }
            return $res;
        };

        try {
            // 2. Secuencia de Comunicación SMTP
            $sendCommand(null, '220'); // Leer mensaje de bienvenida
            $sendCommand("EHLO " . gethostname(), '250');

            // Soporte para STARTTLS (PUERTO 587)
            if (!$isImplicitSSL) {
                $sendCommand("STARTTLS", '220');
                if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT | STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new Exception("Falló la negociación de cifrado STARTTLS.");
                }
                $sendCommand("EHLO " . gethostname(), '250');
            }

            // Autenticación
            $sendCommand("AUTH LOGIN", '334');
            $sendCommand(base64_encode($user), '334');
            $sendCommand(base64_encode($pass), '235'); // 235 = Autenticación exitosa
            
            $sendCommand("MAIL FROM: <$user>", '250');

            // Procesar múltiples destinatarios (Filtrado Resiliente)
            $emails = array_filter(array_map('trim', explode(',', $to_list)));
            if (empty($emails)) {
                throw new Exception("No hay destinatarios válidos.");
            }

            $aceptados = 0;
            $ultimoError = '';
            
            foreach ($emails as $email) {
                try {
                    // Intentamos agregar al destinatario
                    $sendCommand("RCPT TO: <$email>", '250');
                    $aceptados++;
                } catch (Exception $e) {
                    // Si el servidor rechaza este correo específico (ej. Hotmail), lo anotamos pero seguimos con los demás
                    $ultimoError = $e->getMessage();
                }
            }

            // Si ABSOLUTAMENTE TODOS los correos fueron rechazados, abortamos
            if ($aceptados === 0) {
                throw new Exception("El servidor SMTP rechazó a todos los destinatarios. Detalle: $ultimoError");
            }

            $sendCommand("DATA", '354'); // 354 = Go ahead

            // 3. Construcción del Mensaje
            $messageId = "<" . uniqid() . "@" . gethostname() . ">";
            $date = date('r');

            $message = "Date: $date\r\n";
            $message .= "Message-ID: $messageId\r\n";
            $message .= "From: =?UTF-8?B?" . base64_encode("Notificaciones IRI") . "?= <$user>\r\n";
            $message .= "To: $to_list\r\n";
            $message .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
            $message .= "MIME-Version: 1.0\r\n";
            $message .= "Content-Type: text/html; charset=UTF-8\r\n";
            $message .= "\r\n"; 
            
            // Convertir saltos de línea del textarea a formato de red
            $body_crlf = preg_replace('/(?<!\r)\n/', "\r\n", $body);
            $message .= $body_crlf;
            $message .= "\r\n"; 

            // 4. Enviar el correo y cerrar
            fwrite($socket, $message);
            $sendCommand(".", '250'); 
            $sendCommand("QUIT", '221');
            
            fclose($socket);
            return true;

        } catch (Exception $e) {
            fclose($socket);
            throw new Exception("Error interno SMTP: " . $e->getMessage());
        }
    }
}
?>