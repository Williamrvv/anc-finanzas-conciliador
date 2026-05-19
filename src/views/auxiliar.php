<div class="animate-fade-in-up flex flex-col min-h-screen pb-12">
    <!-- Encabezado -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 shrink-0">
        <div>
            <h2 class="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <span class="p-2 bg-orange-500 rounded-lg text-white shadow-lg shadow-orange-500/30">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                </span>
                Auxiliar Contable
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Bandeja de resolución de transacciones históricas pendientes.</p>
        </div>
        
        <!-- Botonera de Acción Flotante -->
        <div class="flex items-center mt-2 md:mt-0">
            <button id="btn-save-m4" onclick="window.AuxiliarLogic.saveAprobaciones()" class="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-black text-xs transition-all shadow-md shadow-green-500/30 flex items-center gap-2 shrink-0 hover:scale-105">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                APROBAR Y GUARDAR AJUSTES
            </button>
        </div>
    </div>

    <!-- Área Superior: Buscador Universal -->
    <div class="flex justify-between items-center mb-2 shrink-0">
        <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <span class="text-slate-500 dark:text-slate-400 ml-2">Simbología M4:</span>
            <div class="flex items-center gap-1 text-green-700 dark:text-green-500">
                <span class="w-3 h-3 rounded-full bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-600"></span> 
                Aprobados <span id="count-m4-aprob" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5 text-slate-700 dark:text-slate-300">0</span>
            </div>
            <div class="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
            <div class="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                <span class="w-3 h-3 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-600"></span> 
                Sugerencias <span id="count-m4-sug" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5 text-slate-700 dark:text-slate-300">0</span>
            </div>
            <div class="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
            <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <span class="w-3 h-3 rounded-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600"></span> 
                Huérfanos / Limbo <span id="count-m4-huer" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5 text-slate-700 dark:text-slate-300">0</span>
            </div>
        </div>

        <div class="relative">
            <input type="text" id="search-m4" placeholder="Filtrar en Auxiliar..." 
                class="pl-8 pr-4 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 w-72 shadow-sm text-slate-700 dark:text-white">
            <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
    </div>

    <!-- Contenedor Split de Tablas -->
    <div class="flex flex-col gap-6 w-full mt-2 relative min-h-[500px]">
        
        <!-- Pantalla de Carga Automática -->
        <div id="m4-loader" class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl">
            <svg class="animate-spin h-12 w-12 text-orange-500 mb-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <h3 class="text-lg font-bold text-slate-700 dark:text-slate-200">Reconstruyendo Historial...</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Escaneando transacciones huérfanas en la base de datos.</p>
        </div>

        <!-- TABLA 1: SUGERENCIAS Y LIMBO (Bandeja de Entrada) -->
        <div class="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between shrink-0">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <h3 class="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Sugerencias del Algoritmo y Bolsón (Limbo Histórico)</h3>
                </div>
                <span class="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Doble clic para auditar y aprobar</span>
            </div>
            <div id="table-limbo-m4" style="height: 500px; min-height: 300px;" class="w-full relative border-none bg-slate-50 dark:bg-slate-900/20"></div>
        </div>

        <!-- TABLA 2: APROBADOS (Listos para guardar) -->
        <div class="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden mt-2">
            <div class="bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-800 px-4 py-2 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span>
                    <h3 class="text-xs font-black text-green-700 dark:text-green-400 uppercase tracking-wider">Conciliaciones Aprobadas (Manual)</h3>
                </div>
                <span class="text-[10px] text-green-600 dark:text-green-500 font-medium">Listas para guardar</span>
            </div>
            <div id="table-sug-m4" style="height: 250px; min-height: 200px;" class="w-full relative border-none bg-slate-50 dark:bg-slate-900/20"></div>
        </div>

    </div>
</div>

<style>
    @keyframes shimmer {
        100% { transform: translateX(100%); }
    }
</style>