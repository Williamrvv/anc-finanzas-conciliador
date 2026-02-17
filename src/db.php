<?php
class Database {
    private static $pdo = null;

    public static function connect() {
        // Si ya existe conexión, la reutilizamos
        if (self::$pdo !== null) return self::$pdo;

        $host = getenv('DB_HOST');
        $port = getenv('DB_PORT');
        $name = getenv('DB_NAME');
        $user = getenv('DB_USER');
        $pass = getenv('DB_PASSWORD');
        
        // Configuración específica para ODBC Driver 18 for SQL Server
        // TrustServerCertificate=yes es vital si no hay certificados SSL válidos en la red interna
        $dsn = "sqlsrv:Server=$host,$port;Database=$name;TrustServerCertificate=yes;Encrypt=no";

        try {
            self::$pdo = new PDO($dsn, $user, $pass);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            return self::$pdo;
        } catch (PDOException $e) {
            // En producción no deberíamos mostrar el error completo, pero para desarrollo es útil
            die("⛔ Error Crítico de Conexión SQL Server: " . $e->getMessage());
        }
    }
}
?>