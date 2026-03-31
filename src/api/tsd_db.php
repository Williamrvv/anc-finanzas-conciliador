<?php
class TSDDatabase {
    private static $pdo = null;

    public static function connect() {
        if (self::$pdo !== null) return self::$pdo;

        // Leer credenciales de forma segura desde el archivo .env
        $host = getenv('TSD_DB_HOST');
        $db   = getenv('TSD_DB_NAME');
        $user = getenv('TSD_DB_USER');
        $pass = getenv('TSD_DB_PASSWORD');
        
        // Validación de seguridad por si el .env no cargó o faltan variables
        if (!$host || !$db || !$user || !$pass) {
            throw new Exception("Error Crítico: Faltan credenciales de TSD en el archivo de entorno (.env).");
        }

        // Configuramos el DSN para SQL Server (ODBC 18)
        $dsn = "sqlsrv:Server=$host;Database=$db;TrustServerCertificate=yes;Encrypt=no";

        try {
            self::$pdo = new PDO($dsn, $user, $pass);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            return self::$pdo;
        } catch (PDOException $e) {
            // Si falla la conexión a TSD, lanzamos una excepción limpia
            throw new Exception("Error de conexión al servidor TSD ($host): " . $e->getMessage());
        }
    }
}
?>