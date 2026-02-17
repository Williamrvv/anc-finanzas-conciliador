<?php
// Cargar configuración (si no usas una librería de .env en PHP puro, 
// asume que las variables ya están en el entorno de Docker)
require_once 'db.php';

?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Test DB ANC</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-white flex items-center justify-center h-screen">
    <div class="bg-slate-800 p-8 rounded-lg shadow-xl border border-slate-700 max-w-2xl w-full">
        <h1 class="text-2xl font-bold mb-4 border-b border-slate-600 pb-2">Diagnóstico de Conexión</h1>
        
        <?php try {
            $start = microtime(true);
            $conn = Database::connect();
            $end = microtime(true);
            $duration = round(($end - $start) * 1000, 2);
            
            echo '<div class="flex items-center gap-3 text-green-400 mb-4">';
            echo '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            echo "<span class='font-bold text-lg'>Conexión Exitosa ($duration ms)</span>";
            echo '</div>';

            // Prueba de consulta
            $stmt = $conn->query("SELECT @@VERSION as version, DB_NAME() as db");
            $row = $stmt->fetch();

            echo '<div class="bg-black/30 p-4 rounded font-mono text-xs text-slate-300 space-y-2">';
            echo "<p><span class='text-blue-400'>Host:</span> " . getenv('DB_HOST') . "</p>";
            echo "<p><span class='text-blue-400'>Base de Datos:</span> " . $row['db'] . "</p>";
            echo "<p><span class='text-blue-400'>Motor SQL:</span> " . $row['version'] . "</p>";
            echo '</div>';

        } catch (Exception $e) {
            echo '<div class="flex items-center gap-3 text-red-500 mb-4">';
            echo '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            echo "<span class='font-bold text-lg'>Fallo de Conexión</span>";
            echo '</div>';
            echo '<div class="bg-red-900/20 p-4 rounded font-mono text-xs text-red-200 border border-red-800">';
            echo $e->getMessage();
            echo '</div>';
        } ?>
        
        <div class="mt-6 text-right">
            <a href="/" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold transition-colors">Ir al Sistema</a>
        </div>
    </div>
</body>
</html>