<div class="flex flex-col h-full animate-fade-in-up pb-24 max-w-6xl mx-auto w-full" id="cierre-cajas-module">
    
    <!-- HEADER -->
    <header class="pb-4 mb-4 border-b border-slate-200 dark:border-slate-700 shrink-0 mt-2 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Cierre de Caja
            </h1>
            <p class="text-xs text-slate-500 mt-1">Conciliación de vouchers vs Registro TSD.</p>
        </div>
        
        <div class="flex items-center gap-2">
            <input type="text" id="cc-icd-input" class="w-full md:w-64 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold uppercase transition-all text-slate-800 dark:text-white" placeholder="Ej: SJOT71-23876" autocomplete="off">
            <button onclick="window.CierreCajasLogic.searchICD()" id="btn-search-icd" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors">Buscar</button>
        </div>
    </header>

    <div id="cc-loading" class="hidden flex-col items-center justify-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
        <span class="text-sm text-slate-500">Consultando a TSD...</span>
    </div>

    <!-- ========================================== -->
    <!-- 1. VISTA HOME (Bandeja Global del Usuario) -->
    <!-- ========================================== -->
    <div id="cc-home-view" class="flex flex-col w-full py-4 transition-all">
        
        <!-- Estado Vacío (Aparece si la bandeja no tiene datos) -->
        <div id="cc-empty-state" class="flex flex-col items-center justify-center opacity-70 mb-8 transition-all duration-300">
            <span class="text-5xl mb-3 drop-shadow-sm">🧾</span>
            <span class="text-sm text-slate-500 text-center font-medium">Ingrese el número de ICD en el buscador<br>para iniciar el cuadre de caja.</span>
        </div>

        <!-- Mi Bandeja de Pendientes (Tabla de Alta Densidad) -->
        <div id="cc-mi-bandeja" class="hidden animate-fade-in-up w-full mt-2">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                <h2 class="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
                    Mis Casos Pendientes
                    <span id="cc-mi-count" class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md text-[10px] ml-1">0</span>
                </h2>
                <button onclick="window.CierreCajasLogic.enviarSeleccionadosAJefatura('home')" id="cc-btn-report-home" class="hidden bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors items-center gap-2 text-xs">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    Reportar a Jefatura
                </button>
            </div>
            
            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm w-full overflow-x-auto">
                <table class="w-full text-left whitespace-nowrap min-w-[800px]">
                    <thead class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <tr>
                            <th class="p-3 w-28">Estado</th>
                            <th class="p-3">Contrato / Cliente</th>
                            <th class="p-3 w-32">ICD Origen</th>
                            <th class="p-3 w-32 text-right">Monto ₡</th>
                            <th class="p-3 w-72">Motivo / Justificación</th>
                        </tr>
                    </thead>
                    <tbody id="cc-mi-list" class="text-sm divide-y divide-slate-100 dark:divide-slate-700/50">
                        <!-- Filas inyectadas por JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- ========================================== -->
    <!-- 2. VISTA WORKSPACE (Aparece al buscar un ICD) -->
    <!-- ========================================== -->
    <div id="cc-workspace" class="hidden flex-col gap-4 flex-grow overflow-hidden">
        
        <!-- Tarjeta de Metadatos y Escáner Minimalista -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm w-full mb-4 flex flex-col overflow-hidden shrink-0">
            <!-- Zona Superior: Metadatos -->
            <div class="p-4 lg:p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6 items-start relative">
                <div class="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                
                <div class="pl-2 lg:pl-4">
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">Número ICD</span>
                    <span id="meta-icd" class="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono leading-tight truncate block"></span>
                </div>
                
                <div>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">Sucursal</span>
                    <span id="meta-sucursal" class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight truncate block"></span>
                </div>
                
                <div>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">Marca Operativa</span>
                    <span id="meta-marca" class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold shadow-sm transition-colors mt-0.5"></span>
                </div>
                
                <div>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">Registrado TSD</span>
                    <span id="meta-usuario" class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight truncate block"></span>
                </div>
                
                <div>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">Fecha / Hora</span>
                    <span id="meta-fecha" class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight truncate block"></span>
                </div>
            </div>

            <!-- Zona Inferior: Escáner Doble Ciego -->
            <div class="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 lg:p-5 border-t border-indigo-100 dark:border-indigo-800/50 flex flex-col md:flex-row items-center gap-4 lg:gap-6">
                <div class="shrink-0 w-full md:w-auto text-center md:text-left">
                    <span class="block text-sm font-black text-indigo-700 dark:text-indigo-300">🔍 Doble Ciego</span>
                    <span class="text-[10px] text-indigo-500 dark:text-indigo-400">Verifique Autorización y Monto</span>
                </div>
                
                <form onsubmit="return false;" class="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-grow justify-end">
                    <div class="w-full sm:w-48 relative">
                        <input type="text" id="cc-scan-auth" enterkeyhint="next" onkeydown="window.CierreCajasLogic.handleScanner(event)" class="w-full pl-8 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono font-black text-slate-800 dark:text-white transition-all shadow-inner placeholder:font-sans placeholder:font-normal uppercase" placeholder="Autorización" autocomplete="off">
                        <svg class="w-4 h-4 absolute left-2.5 top-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-4l5.659-5.659A6 6 0 1121 9z"></path></svg>
                    </div>
                    <div class="w-full sm:w-48 relative">
                        <input type="text" inputmode="decimal" id="cc-scan-monto" enterkeyhint="go" onkeydown="window.CierreCajasLogic.handleScanner(event)" class="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500 outline-none text-sm font-mono font-black text-slate-800 dark:text-white transition-all shadow-inner placeholder:font-sans placeholder:font-normal" placeholder="Monto ₡" autocomplete="off">
                        <span class="absolute left-3 top-2.5 font-bold text-indigo-400">₡</span>
                    </div>
                </form>
            </div>
        </div>

        <!-- Lista de Vouchers del ICD -->
        <div id="cc-transactions-list" class="space-y-2 px-1 pb-10"></div>

        <!-- BANDEJA COLABORATIVA DE SUCURSAL (Al final de los vouchers) -->
        <div id="cc-sucursal-bandeja" class="hidden mt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 pt-6">
            <div class="flex justify-between items-end mb-4">
                <h3 class="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    No Reportados en esta Sucursal (<span id="cc-suc-count">0</span>)
                </h3>
                <button onclick="window.CierreCajasLogic.enviarSeleccionadosAJefatura('sucursal')" id="cc-btn-report-suc" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors text-xs flex items-center gap-2 hidden">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    Ayudar a Reportar
                </button>
            </div>
            
            <!-- Grid Colaborativo (Tarjetas) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4" id="cc-suc-list">
                <!-- Se inyectan por JS -->
            </div>
        </div>

    </div>

    <!-- BARRA INFERIOR DE ACCIÓN -->
    <div id="cc-action-bar" class="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 sm:p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center transform translate-y-full transition-transform duration-300 z-40">
        <div class="flex items-center gap-4 sm:gap-6">
            <div class="flex flex-col">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Match</span>
                <span class="text-xl font-black text-slate-800 dark:text-white font-mono"><span id="cc-sel-count" class="text-green-600">0</span> / <span id="cc-total-count">0</span></span>
            </div>
            <div class="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-4 sm:pl-6">
                <span class="text-[10px] font-bold text-slate-500 uppercase">Verificado</span>
                <span id="cc-sel-total" class="text-xl font-black text-green-600 dark:text-green-400 font-mono">₡0.00</span>
            </div>
        </div>

        <button onclick="window.CierreCajasLogic.saveCierre()" id="btn-save-cierre" class="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2.5 sm:py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2" disabled>
            <span id="btn-save-text">Guardar Cierre</span>
            <svg class="w-5 h-5 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        </button>
    </div>
</div>