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
    </header>

    <!-- PESTAÑAS DE NAVEGACIÓN -->
    <div class="flex overflow-x-auto custom-scrollbar space-x-1 border-b border-slate-200 dark:border-slate-700 mb-6 mt-2">
        <button onclick="window.CierreCajasLogic.switchTab('workspace')" id="tab-workspace" class="whitespace-nowrap px-6 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20">
            Módulo de Trabajo
        </button>
        <button onclick="window.CierreCajasLogic.switchTab('history')" id="tab-history" class="whitespace-nowrap px-6 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            Trazabilidad de Casos
        </button>
        <button onclick="window.CierreCajasLogic.switchTab('audit')" id="tab-audit" class="whitespace-nowrap px-6 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-300">
            Historial de Facturación
        </button>
    </div>

    <!-- PANEL CENTRAL AUTOMÁTICO (Exclusivo del Módulo de Trabajo) -->
    <div id="cc-search-section" class="flex flex-col items-center justify-center text-center py-12 px-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 mb-6 animate-fade-in-up transition-all w-full shadow-sm mx-auto">
        
        <div class="bg-white dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-full shadow-md mb-6 mx-auto">
            <span class="text-4xl drop-shadow-sm block translate-y-0.5">🧾</span>
        </div>
        
        <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-3">Facturación Continua</h2>
        <p class="text-sm text-slate-500 font-medium max-w-xl mx-auto mb-8 leading-relaxed">
            El sistema buscará en TSD todas las facturas generadas a partir del último corte de caja registrado para las sucursales que tiene asignadas.
        </p>
        
        <!-- INYECCIÓN DINÁMICA: Sucursales Asignadas -->
        <div id="home-sucursales-list" class="flex flex-wrap justify-center items-center gap-2 mb-8 w-full max-w-2xl mx-auto empty:hidden">
            <!-- JS inyecta las píldoras de las sucursales aquí -->
        </div>

        <div class="w-full flex justify-center">
            <button onclick="window.CierreCajasLogic.loadFacturacion()" id="btn-load-fact" class="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-black shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 hover:shadow-indigo-500/50 w-full sm:w-auto min-w-[300px]">
                <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                CARGAR FACTURACIÓN
            </button>
        </div>
        
    </div>

    <div id="cc-loading" class="hidden flex-col items-center justify-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
        <span class="text-sm text-slate-500">Analizando cortes y consultando TSD...</span>
    </div>

    <!-- ========================================== -->
    <!-- 1. VISTA HOME (Bandeja Global del Usuario) -->
    <!-- ========================================== -->
    <div id="cc-home-view" class="flex flex-col w-full py-4 transition-all">
        <div id="cc-mi-bandeja" class="hidden animate-fade-in-up w-full mt-2">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                <h2 class="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
                    Mis Casos Pendientes de Corrección
                    <span id="cc-mi-count" class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md text-[10px] ml-1">0</span>
                </h2>
                <button onclick="window.CierreCajasLogic.enviarSeleccionadosAJefatura('home')" id="cc-btn-report-home" class="hidden bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors items-center gap-2 text-xs">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    Reportar Seleccionados
                </button>
            </div>
            <div id="cc-mi-list" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 pb-10"></div>
        </div>
    </div>

    <!-- ========================================== -->
    <!-- 2. VISTA WORKSPACE (Aparece al cargar facturación) -->
    <!-- ========================================== -->
    <div id="cc-workspace" class="hidden flex-col gap-4 flex-grow overflow-hidden">
        
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm w-full mb-4 flex flex-col overflow-hidden shrink-0">
            <div class="p-4 lg:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-start relative">
                <div class="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
                <div class="pl-2 lg:pl-4 col-span-1 md:col-span-2">
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">Rango de Cortes Cargados</span>
                    <div id="meta-sucursales-list" class="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight space-y-1">
                        <!-- JS inyecta la lista de sucursales y sus horas de corte -->
                    </div>
                </div>
                <div>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">ICDs Involucrados (TSD)</span>
                    <span id="meta-icd-list" class="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono leading-tight block whitespace-pre-line"></span>
                </div>
            </div>

            <div class="bg-indigo-50/50 dark:bg-indigo-900/20 p-4 lg:p-5 border-t border-indigo-100 dark:border-indigo-800/50 flex flex-col md:flex-row items-center gap-4 lg:gap-6">
                <div class="shrink-0 w-full md:w-auto text-center md:text-left">
                    <span class="block text-sm font-black text-indigo-700 dark:text-indigo-300">🔍 Cruce de Validación</span>
                    <span class="text-[10px] text-indigo-500 dark:text-indigo-400">Ingrese la Autorización y el Monto del voucher</span>
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

        <div id="cc-transactions-list" class="space-y-2 px-1 pb-10"></div>

        <div id="cc-sucursal-bandeja" class="hidden mt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 pt-6">
            <div class="flex justify-between items-end mb-4">
                <h3 class="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    No Reportados en esta Sucursal (<span id="cc-suc-count">0</span>)
                </h3>
                <button onclick="window.CierreCajasLogic.enviarSeleccionadosAJefatura('sucursal')" id="cc-btn-report-suc" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors text-xs flex items-center gap-2 hidden">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    Reportar
                </button>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4" id="cc-suc-list"></div>
        </div>

        <!-- BARRA INFERIOR DE ACCIÓN (Pertenece estructuralmente al Workspace) -->
        <div id="cc-action-bar" class="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 sm:p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center z-40 animate-fade-in-up">
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

    <!-- ========================================== -->
    <!-- 3. VISTA HISTORIAL (BPM con Sub-Pestañas) -->
    <!-- ========================================== -->
    <div id="cc-history-view" class="hidden flex-col flex-grow w-full h-full animate-fade-in-up pb-10">
        
        <!-- Sub-Pestañas Internas (Activos vs Resueltos) -->
        <div class="flex gap-4 mb-4 border-b border-slate-200 dark:border-slate-700">
            <button onclick="window.CierreCajasLogic.switchSubTab('activos')" id="subtab-activos" class="pb-2 text-sm font-bold border-b-2 border-amber-500 text-amber-600 dark:text-amber-500 transition-colors">
                Casos Activos (<span id="count-urgentes">0</span>)
            </button>
            <button onclick="window.CierreCajasLogic.switchSubTab('resueltos')" id="subtab-resueltos" class="pb-2 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Histórico Resueltos (<span id="count-resueltos">0</span>)
            </button>
        </div>

        <!-- SECCIÓN 1: ACTIVOS (Urgentes) -->
        <div id="cc-section-activos" class="flex flex-col flex-grow">
            <div class="mb-6 relative">
                <input type="text" id="search-activos" oninput="window.CierreCajasLogic.filterActivos()" class="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm transition-shadow placeholder-slate-400" placeholder="Buscar en casos activos (Contrato, Cliente, Sucursal)...">
                <span class="absolute left-3 top-2.5 text-slate-400">🔍</span>
            </div>
            <div id="cc-urgentes-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                <!-- Tarjetas Activas -->
            </div>
        </div>

        <!-- SECCIÓN 2: HISTÓRICO RESUELTOS (Con Paginación) -->
        <div id="cc-section-resueltos" class="hidden flex-col flex-grow">
            <div class="mb-6 relative">
                <input type="text" id="search-resueltos" onkeydown="if(event.key === 'Enter') window.CierreCajasLogic.searchResueltosServer()" class="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-shadow placeholder-slate-400" placeholder="Buscar en el histórico completo (Presione Enter)..." autocomplete="off">
                <span class="absolute left-3 top-2.5 text-slate-400">🔍</span>
            </div>
            
            <div id="cc-resueltos-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-6">
                <!-- Tarjetas Resueltas -->
            </div>

            <!-- Controles de Paginación -->
            <div id="cc-pagination-controls" class="hidden flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mt-auto">
                <span class="text-xs text-slate-500 font-bold">Página <span id="pag-current" class="text-indigo-600 dark:text-indigo-400">1</span> de <span id="pag-total">1</span></span>
                <div class="flex gap-2">
                    <button onclick="window.CierreCajasLogic.changeHistoryPage(-1)" id="btn-hist-prev" class="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Anterior</button>
                    <button onclick="window.CierreCajasLogic.changeHistoryPage(1)" id="btn-hist-next" class="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Siguiente</button>
                </div>
            </div>
        </div>

    </div>

    <!-- ========================================== -->
    <!-- 4. EXPLORADOR FORENSE 360 (Búsqueda Transaccional) -->
    <!-- ========================================== -->
    <div id="cc-audit-view" class="hidden flex-col flex-grow w-full h-full animate-fade-in-up pb-10">
        
        <!-- Panel de Filtros -->
        <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 shrink-0">
            <h2 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                Auditoría Global de Transacciones
            </h2>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Inicio</label>
                    <input type="date" id="forense-desde" class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Fin</label>
                    <input type="date" id="forense-hasta" class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white">
                </div>
                <div class="md:col-span-2 relative">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Búsqueda Universal</label>
                    <input type="text" id="forense-buscar" onkeydown="if(event.key === 'Enter') window.CierreCajasLogic.resetAndLoadForense()" class="w-full pl-9 pr-24 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-slate-400" placeholder="Contrato, Cliente o Autorización..." autocomplete="off">
                    <span class="absolute left-3 top-[26px] text-slate-400">🔍</span>
                    <button onclick="window.CierreCajasLogic.resetAndLoadForense()" class="absolute right-1 top-[22px] bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors shadow-sm">Buscar</button>
                </div>
            </div>
        </div>

        <!-- KPIs Dinámicos -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
            <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 p-4 rounded-xl">
                <div class="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Transacciones</div>
                <div id="kpi-tx" class="text-2xl font-black text-indigo-700 dark:text-indigo-400 font-mono">0</div>
            </div>
            <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 p-4 rounded-xl">
                <div class="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Total Colones (CRC)</div>
                <div id="kpi-crc" class="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">₡0.00</div>
            </div>
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 p-4 rounded-xl">
                <div class="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-1">Total Dólares (USD)</div>
                <div id="kpi-usd" class="text-2xl font-black text-green-700 dark:text-green-400 font-mono">$0.00</div>
            </div>
            <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 p-4 rounded-xl">
                <div class="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1">Tickets Generados</div>
                <div id="kpi-tickets" class="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono">0</div>
            </div>
        </div>

        <!-- Tabla de Resultados -->
        <!-- La clase max-h-[60vh] y overflow-auto fuerzan el scroll dentro de la tabla y activan los Sticky Headers -->
        <div class="w-full flex-grow bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4">
            <div id="forense-grid" class="w-full max-h-[60vh] overflow-auto custom-scrollbar"></div>
        </div>

        <!-- Paginación Server-Side Forense -->
        <div id="forense-pagination" class="hidden flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
            <span class="text-xs text-slate-500 font-bold">
                Página <span id="pag-forense-current" class="text-indigo-600 dark:text-indigo-400 text-sm font-black">1</span> de <span id="pag-forense-total">1</span>
                <span class="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-md text-[10px]" id="pag-forense-registros">0 registros</span>
            </span>
            <div class="flex gap-2">
                <button onclick="window.CierreCajasLogic.changeForensePage(-1)" id="btn-forense-prev" class="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Anterior</button>
                <button onclick="window.CierreCajasLogic.changeForensePage(1)" id="btn-forense-next" class="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Siguiente</button>
            </div>
        </div>
    </div>

</div> <!-- FIN DEL CONTENEDOR ANIMADO -->
    <div id="cc-history-view" class="hidden flex-col flex-grow w-full h-full animate-fade-in-up pb-10">
        
        <!-- Barra de Búsqueda Global -->
        <div class="flex flex-col sm:flex-row gap-4 mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
            <div class="flex-grow relative">
                <input type="text" id="hist-search" oninput="window.CierreCajasLogic.filterHistoryCards()" class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Buscar por Contrato, Cliente o Sucursal...">
                <span class="absolute left-3 top-2 text-slate-400">🔍</span>
            </div>
            <!-- Ocultamos el select de estados porque ahora está dividido en secciones -->
        </div>
        
        <!-- SECCIÓN 1: URGENCIAS (No Reportados y Pendientes) -->
        <div class="mb-8">
            <h2 class="text-sm font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
                Casos Activos Requieren Atención (<span id="count-urgentes">0</span>)
            </h2>
            <div id="cc-urgentes-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                <!-- JS inyecta las tarjetas urgentes aquí -->
            </div>
        </div>

        <!-- SECCIÓN 2: HISTORIAL (Resueltos con Paginación) -->
        <div class="mt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 pt-6">
            <h2 class="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Casos Resueltos
            </h2>
            
            <div id="cc-resueltos-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-6">
                <!-- JS inyecta las tarjetas resueltas aquí -->
            </div>

            <!-- Controles de Paginación -->
            <div id="cc-pagination-controls" class="hidden flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <span class="text-xs text-slate-500 font-bold">Página <span id="pag-current" class="text-indigo-600">1</span> de <span id="pag-total">1</span></span>
                <div class="flex gap-2">
                    <button onclick="window.CierreCajasLogic.changeHistoryPage(-1)" id="btn-hist-prev" class="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">Anterior</button>
                    <button onclick="window.CierreCajasLogic.changeHistoryPage(1)" id="btn-hist-next" class="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">Siguiente</button>
                </div>
            </div>
        </div>

    </div>

</div> <!-- FIN DEL CONTENEDOR ANIMADO -->

<!-- ========================================== -->
<!-- MODAL LÍNEA DE TIEMPO INTERACTIVA (BPM)    -->
<!-- (Movido a la raíz para arreglar Bug de Blur)-->
<!-- ========================================== -->
<div id="modal-timeline" class="fixed inset-0 bg-slate-500/30 dark:bg-slate-900/60 backdrop-blur-sm z-[9999] hidden flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all flex flex-col max-h-[90vh] animate-fade-in-up">
        
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                Gestión de Caso #<span id="tl-id"></span>
            </h3>
            <button type="button" onclick="document.getElementById('modal-timeline').classList.add('hidden')" class="text-slate-400 hover:text-red-500 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        <div class="p-6 overflow-y-auto custom-scrollbar flex-grow bg-slate-50 dark:bg-slate-900/20">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div><span class="block text-[10px] text-slate-500 uppercase font-bold">Contrato</span><span id="tl-contrato" class="font-bold text-sm dark:text-white"></span></div>
                <div class="col-span-2"><span class="block text-[10px] text-slate-500 uppercase font-bold">Cliente</span><span id="tl-cliente" class="font-bold text-sm dark:text-white truncate block"></span></div>
                <div><span class="block text-[10px] text-slate-500 uppercase font-bold">Colones</span><span id="tl-monto" class="font-bold text-sm text-red-600 font-mono"></span></div>
                <div><span class="block text-[10px] text-slate-500 uppercase font-bold">Dólares</span><span id="tl-usd" class="font-bold text-sm text-green-600 font-mono"></span></div>
            </div>
            
            <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 ml-2">Línea de Tiempo de Auditoría</h4>
            <div class="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3 md:ml-4 space-y-6 pb-4" id="tl-events">
                <!-- Eventos Historial -->
            </div>
        </div>

        <div id="tl-action-zone" class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0 hidden">
            <!-- Se inyectan los inputs y botones por JS -->
        </div>
    </div>
</div>