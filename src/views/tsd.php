<div class="animate-fade-in-up flex flex-col h-[calc(100vh-100px)]">
    <!-- Encabezado y Filtros -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 shrink-0">
        <div>
            <h2 class="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <span class="p-2 bg-purple-600 rounded-lg text-white shadow-lg shadow-purple-500/30">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </span>
                Consolidado Final TSD
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Cruce automatizado: Base de Datos TSD vs Transacciones Bancarias (BAC & Davibank)</p>
        </div>

        <div class="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <!-- Selector de Rango Moderno -->
            <div class="flex flex-col px-3 relative">
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Rango de Fechas</span>
                <div class="flex items-center gap-2 border-b border-slate-300 dark:border-slate-600 pb-1">
                    <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <input type="text" id="tsd-date-picker" class="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer w-48 text-center" placeholder="Seleccione fechas...">
                </div>
            </div>
            
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
            
            <button id="btn-run-match" onclick="window.TSDLogic.fetchAndMatch()" class="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-md shadow-purple-500/20 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Ejecutar Cruce
            </button>
        </div>
    </div>

    <!-- Leyenda de Colores (UX) -->
    <div class="flex items-center gap-4 mb-3 text-[10px] font-bold uppercase tracking-wider shrink-0 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
        <span class="text-slate-500 ml-2">Simbología Activa:</span>
        <div class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-[#fce4d6] dark:bg-[#7c6f69] border border-slate-300"></span> Cruce Exacto por Autorización</div>
    </div>

    <!-- Grid de Resultados (Ocupa el resto de la pantalla) -->
    <div class="flex-grow bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col relative">
        <!-- Buscador Integrado -->
        <div class="absolute top-3 right-4 z-10">
            <div class="relative">
                <input type="text" id="search-tsd" placeholder="Buscar contrato, auth..." 
                    class="pl-8 pr-4 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 w-64 shadow-sm text-slate-700 dark:text-white">
                <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
        </div>
        
        <div id="table-result-tsd" class="w-full h-full">
            <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-50">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span class="text-sm font-medium">Seleccione las fechas y presione "Ejecutar Cruce M3"</span>
            </div>
        </div>
    </div>
</div>