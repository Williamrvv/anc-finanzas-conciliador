<?php
class Mailer {
    
    public static function send($to_list, $subject, $body) {
        $host = getenv('SMTP_HOST');
        $port = getenv('SMTP_PORT');
        $user = getenv('SMTP_USER');
        $pass = getenv('SMTP_PASS');

        if (empty($host) || empty($user) || empty($pass)) {
            throw new Exception("Error SMTP: Credenciales no configuradas en el archivo .env.");
        }

        // 1. Configuración de Sockets SSL
        $timeout = 15;
        $context = stream_context_create([
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ]);

        $socketHost = ($port == 465) ? "ssl://$host" : $host;
        $socket = stream_socket_client("$socketHost:$port", $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
        
        if (!$socket) {
            throw new Exception("Error SMTP: No se pudo conectar a $socketHost:$port - $errstr");
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

        // Enviador de comandos (Agrega \r\n automáticamente)
        $sendCommand = function($cmd, $expected_code) use ($socket, $readResponse) {
            if ($cmd !== null) {
                fwrite($socket, $cmd . "\r\n");
            }
            $res = $readResponse();
            if ($expected_code && substr($res, 0, 3) != $expected_code) {
                throw new Exception("Error SMTP (Esperaba $expected_code): $res");
            }
            return $res;
        };

        try {
            // 2. Secuencia de Comunicación SMTP
            $sendCommand(null, '220'); // Leer mensaje de bienvenida
            $sendCommand("EHLO " . gethostname(), '250');
            $sendCommand("AUTH LOGIN", '334');
            $sendCommand(base64_encode($user), '334');
            $sendCommand(base64_encode($pass), '235'); // 235 = Autenticación exitosa
            
            $sendCommand("MAIL FROM: <$user>", '250');

            // Procesar múltiples destinatarios
            $emails = array_filter(array_map('trim', explode(',', $to_list)));
            if (empty($emails)) {
                throw new Exception("Error SMTP: No hay destinatarios válidos.");
            }

            foreach ($emails as $email) {
                $sendCommand("RCPT TO: <$email>", '250');
            }

            $sendCommand("DATA", '354'); // 354 = Go ahead

            // 3. Construcción del Mensaje (Headers y Body)
            $messageId = "<" . uniqid() . "@" . gethostname() . ">";
            $date = date('r');

            $message = "Date: $date\r\n";
            $message .= "Message-ID: $messageId\r\n";
            $message .= "From: =?UTF-8?B?" . base64_encode("Notificaciones IRI") . "?= <$user>\r\n";
            $message .= "To: $to_list\r\n";
            $message .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
            $message .= "MIME-Version: 1.0\r\n";
            $message .= "Content-Type: text/html; charset=UTF-8\r\n";
            $message .= "\r\n"; // Línea en blanco OBLIGATORIA entre cabeceras y cuerpo
            
            // Convertir saltos de línea del textarea a formato de red
            $body_crlf = preg_replace('/(?<!\r)\n/', "\r\n", $body);
            $message .= $body_crlf;
            $message .= "\r\n"; // Aseguramos que termine en salto de línea

            // 4. Enviar el correo "crudo" sin esperar respuesta
            fwrite($socket, $message);

            // 5. Enviar el comando "Punto Final" para decirle al servidor que terminamos
            $sendCommand(".", '250'); // 250 = Message accepted for delivery

            // 6. Despedida limpia
            $sendCommand("QUIT", '221');
            
            fclose($socket);
            return true;

        } catch (Exception $e) {
            fclose($socket);
            throw $e;
        }
    }
}
?>