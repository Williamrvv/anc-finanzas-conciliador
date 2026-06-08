<?php
$user = $_SESSION['user'] ?? ['name' => 'Invitado', 'email' => '', 'jobTitle' => ''];
$rolNombre = $_SESSION['user']['role'] ?? 'Usuario';
?>
<div class="flex flex-col h-full animate-fade-in-up pb-10 w-full max-w-[1920px] mx-auto">
    
    <!-- HEADER -->
    <header class="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg mb-8 relative overflow-hidden">
        <div class="relative z-10">
            <h1 class="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
                <span>👋</span> Bienvenido, <?php echo htmlspecialchars(explode(' ', trim($user['name']))[0]); ?>
            </h1>
            <p class="text-indigo-100 mt-2 font-medium">Este es el resumen de la actividad operativa de sus sucursales asignadas.</p>
        </div>
        <div class="mt-4 md:mt-0 relative z-10 flex flex-col items-end gap-3">
            <div class="text-left md:text-right bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 w-full sm:w-auto">
                <span class="block text-[10px] text-indigo-200 uppercase tracking-widest font-bold">Puesto Actual</span>
                <span class="text-sm font-black text-white uppercase"><?php echo htmlspecialchars($user['jobTitle']); ?></span>
                <span class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full ml-2"><?php echo strtoupper($rolNombre); ?></span>
            </div>
            
            <!-- FILTROS DE FECHA DEL DASHBOARD -->
            <div class="flex flex-col sm:flex-row items-center gap-2 bg-white/10 backdrop-blur-sm p-2 rounded-xl border border-white/20 w-full sm:w-auto">
                <div class="flex items-center gap-2">
                    <input type="date" id="dash-desde" class="bg-transparent text-white outline-none text-sm font-bold [color-scheme:dark] cursor-pointer">
                    <span class="text-indigo-200 text-xs">al</span>
                    <input type="date" id="dash-hasta" class="bg-transparent text-white outline-none text-sm font-bold [color-scheme:dark] cursor-pointer">
                </div>
                <button onclick="window.DashboardLogic.init()" class="w-full sm:w-auto bg-white text-indigo-700 px-4 py-1.5 rounded-lg shadow text-xs font-bold hover:bg-indigo-50 transition-colors mt-2 sm:mt-0">
                    Filtrar
                </button>
            </div>
        </div>
        <!-- Forma decorativa -->
        <svg class="absolute -bottom-10 -right-10 w-64 h-64 text-white opacity-5 transform rotate-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z"></path></svg>
    </header>

    <!-- LOADING STATE -->
    <div id="dash-loading" class="flex justify-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600"></div>
    </div>

    <div id="dash-content" class="hidden flex-col gap-6">
        <!-- KPIS SUPERIORES -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4 transition-transform hover:-translate-y-1">
                <div class="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center text-xl shrink-0">💰</div>
                <div>
                    <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Colones (Período)</span>
                    <span id="kpi-hoy-crc" class="text-xl font-black text-slate-800 dark:text-white font-mono leading-none">₡0.00</span>
                </div>
            </div>
            
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4 transition-transform hover:-translate-y-1">
                <div class="w-12 h-12 rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400 flex items-center justify-center text-xl shrink-0">💵</div>
                <div>
                    <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dólares (Período)</span>
                    <span id="kpi-hoy-usd" class="text-xl font-black text-slate-800 dark:text-white font-mono leading-none">$0.00</span>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4 transition-transform hover:-translate-y-1">
                <div class="w-12 h-12 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center text-xl shrink-0">⚠️</div>
                <div>
                    <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tickets Activos</span>
                    <div class="flex items-end gap-2">
                        <span id="kpi-tickets" class="text-xl font-black text-slate-800 dark:text-white font-mono leading-none">0</span>
                        <span class="text-[10px] text-slate-400 font-medium pb-0.5">En trámite</span>
                    </div>
                </div>
            </div>

            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4 transition-transform hover:-translate-y-1">
                <div class="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">🧾</div>
                <div>
                    <span class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Transacciones Totales</span>
                    <span id="kpi-tx" class="text-xl font-black text-slate-800 dark:text-white font-mono leading-none">0</span>
                </div>
            </div>
        </div>

        <!-- GRÁFICOS -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
            <!-- Gráfico de Barras -->
            <div class="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Evolución de Conciliación Diaria (CRC)
                </h3>
                <div class="relative h-64 w-full">
                    <canvas id="chartEvolucion"></canvas>
                </div>
            </div>

            <!-- Gráfico de Dona -->
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
                <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                    Estado de Inconsistencias
                </h3>
                <div class="relative h-56 w-full flex-grow flex items-center justify-center">
                    <canvas id="chartEstados"></canvas>
                    <!-- Overlay de datos vacío -->
                    <div id="chart-empty" class="absolute inset-0 flex items-center justify-center hidden bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl">
                        <span class="text-sm font-bold text-slate-400">Sin tickets activos 🎉</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>