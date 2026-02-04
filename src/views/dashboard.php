<?php
// Asumimos que router.php ya hizo session_start
$user = $_SESSION['user'] ?? ['name' => 'Invitado', 'email' => '', 'jobTitle' => ''];
?>
<div class="space-y-6 animate-fade-in-up">
    <header class="bg-white dark:bg-slate-800 shadow rounded-lg p-6 flex justify-between items-center">
        <div>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">Bienvenido de nuevo, <?php echo htmlspecialchars($user['name']); ?></p>
        </div>
        <div class="text-right hidden sm:block">
            <span class="block text-xs text-slate-400 uppercase tracking-wider">Puesto</span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300"><?php echo htmlspecialchars($user['jobTitle']); ?></span>
        </div>
    </header>

    <!-- Contenido de ejemplo (Grid) -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Tarjeta 1 -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
            <h3 class="text-lg font-medium text-slate-900 dark:text-white">Cierres Pendientes</h3>
            <p class="mt-2 text-3xl font-bold text-blue-600">0</p>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Sin conexión a DB</p>
        </div>
         <!-- Tarjeta 2 -->
         <div class="bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700">
            <h3 class="text-lg font-medium text-slate-900 dark:text-white">Estado del Sistema</h3>
            <div class="mt-4 flex items-center gap-2">
                <span class="flex h-3 w-3 rounded-full bg-green-500"></span>
                <span class="text-slate-600 dark:text-slate-300 text-sm">PHP & Drivers OK</span>
            </div>
        </div>
    </div>
</div>