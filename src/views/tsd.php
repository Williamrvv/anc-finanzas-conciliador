<div class="animate-fade-in-up">
    <!-- Encabezado de Módulo -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h2 class="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <span class="p-2 bg-purple-600 rounded-lg text-white shadow-lg shadow-purple-500/30">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </span>
                Módulo Consolidado TSD
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Cruce final de Contratos TSD vs Transacciones Bancarias Procesadas.</p>
        </div>

        <div class="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div class="flex flex-col">
                <span class="text-[10px] font-bold text-slate-400 uppercase ml-1">Fecha de Cierre</span>
                <input type="date" id="process-date" class="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none px-1" value="<?php echo date('Y-m-d'); ?>">
            </div>
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
            <button id="btn-save-tsd" onclick="window.ConciliacionFunctions.saveTSD()" class="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-md shadow-purple-500/20 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                Guardar Cierre TSD
            </button>
        </div>
    </div>

    <!-- Zona de Ingesta -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Izquierda: Carga TSD -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg class="w-16 h-16 text-purple-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
            </div>
            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">1. Ingesta Sistema TSD</h3>
            <div id="drop-tsd" class="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-purple-500 dark:hover:border-purple-400 transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-900/20">
                <img src="assets/arrastra_xlsx_bac_pagado_claro.png" class="h-16 w-auto opacity-50 dark:hidden" alt="Excel">
                <img src="assets/arrastra_xlsx_bac_pagado_oscuro.png" class="h-16 w-auto hidden dark:block opacity-50" alt="Excel">
                <div class="text-center">
                    <p class="text-sm font-bold text-slate-600 dark:text-slate-300">Arrastra el reporte Excel de TSD</p>
                    <p class="text-[10px] text-slate-400">O haz clic para seleccionar archivo</p>
                </div>
                <input type="file" id="file-tsd" class="hidden" accept=".xlsx,.xls">
                <div id="status-tsd" class="hidden mt-2"></div>
            </div>
        </div>

        <!-- Derecha: Importación Bancaria y TC -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">2. Parámetros de Cruce</h3>
            
            <div class="space-y-4">
                <div class="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-purple-700 dark:text-purple-400">Tipo de Cambio del Día</span>
                        <span class="text-[10px] text-slate-500">Para conversión USD a CRC</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-lg font-bold text-slate-400">₡</span>
                        <input type="number" id="tsd-exchange-rate" step="0.01" value="500.00" oninput="window.ConciliacionFunctions.updateExchangeRate(this.value)"
                            class="w-24 bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg p-2 text-right font-mono font-bold text-purple-600 outline-none focus:ring-2 focus:ring-purple-500">
                    </div>
                </div>

                <button onclick="window.TSDLogic.importBankData()" class="w-full py-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold flex items-center justify-center gap-3 transition-all border border-slate-200 dark:border-slate-600 group">
                    <svg class="w-5 h-5 text-purple-600 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Importar Ventas Bancarias del Día
                </button>
            </div>
        </div>
    </div>

    <!-- Grid de Resultados -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
            <div class="flex items-center gap-4">
                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase flex items-center gap-2">
                    <span class="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                    Resultado del Cruce Consolidado
                </h3>
                <div class="relative">
                    <input type="text" id="search-tsd" placeholder="Buscar contrato o autorización..." 
                        class="pl-8 pr-4 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 w-64">
                    <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
            </div>
            
            <div class="flex gap-4">
                <div class="flex flex-col items-end">
                    <span class="text-[9px] font-bold text-slate-400 uppercase">Total TSD (CRC)</span>
                    <span id="tsd-total" class="font-mono font-bold text-slate-700 dark:text-slate-200">₡0,00</span>
                </div>
                <div class="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                <div class="flex flex-col items-end">
                    <span class="text-[9px] font-bold text-green-500 uppercase">Conciliado</span>
                    <span id="tsd-match-count" class="font-mono font-bold text-green-600">₡0,00</span>
                </div>
            </div>
        </div>
        
        <div id="table-result-tsd" class="h-[500px] w-full bg-white dark:bg-slate-800">
            <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-50">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span class="text-sm font-medium">Cargue el archivo TSD para iniciar el cruce</span>
            </div>
        </div>
    </div>
    
    <!-- Contenedor Auditoría TSD -->
    <div id="audit-tsd" class="mt-6 hidden animate-fade-in">
        <!-- Se inyectará vía JS -->
    </div>
</div>