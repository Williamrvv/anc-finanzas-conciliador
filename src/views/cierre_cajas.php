<?php 
    $rolCC = $_SESSION['user']['role'] ?? '';
    $esSC = ($rolCC === 'servicio_cliente');
    $esAdmin = ($rolCC === 'admin');
    
    $verNormal = !$esSC; // Agentes, Jefes, Coordinadores, y Admins
    $verSC = ($esSC || $esAdmin); // SC y Admins
?>

<div class="flex flex-col h-full animate-fade-in-up pb-24 w-full max-w-[1920px] mx-auto" id="cierre-cajas-module">
    
    <!-- HEADER -->
    <header class="pb-4 mb-4 border-b border-slate-200 dark:border-slate-700 shrink-0 mt-2 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Cierre de Caja
            </h1>
            <p class="text-xs text-slate-500 mt-1">Conciliación de vouchers vs Registro TSD.</p>
        </div>
        
        <!-- BOTÓN DE MANUAL DE USUARIO -->
        <div>
            <a href="manual_cc/" target="_blank" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-4 py-2 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 text-sm group">
                <svg class="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                Manual de Usuario
            </a>
        </div>
    </header>

    <!-- PESTAÑAS DE NAVEGACIÓN -->
    <div class="flex overflow-x-auto custom-scrollbar space-x-1 border-b border-slate-200 dark:border-slate-700 mb-6 mt-2">
        <?php if($verNormal): ?>
            <button onclick="window.CierreCajasLogic.switchTab('workspace')" id="tab-workspace" class="whitespace-nowrap px-6 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20">
                Módulo de Trabajo
            </button>
            <button onclick="window.CierreCajasLogic.switchTab('history')" id="tab-history" class="whitespace-nowrap px-6 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                Trazabilidad de Casos
            </button>
            <button onclick="window.CierreCajasLogic.switchTab('audit')" id="tab-audit" class="whitespace-nowrap px-6 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                Historial de Facturación
            </button>
        <?php endif; ?>
        
        <?php if($verSC): ?>
            <button onclick="window.CierreCajasLogic.switchTab('sc_workspace')" id="tab-sc_workspace" class="whitespace-nowrap px-6 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                Bandeja de Servicio al Cliente
            </button>
        <?php endif; ?>
    </div>

    <!-- CARGADOR GLOBAL -->
    <div id="cc-loading" class="hidden flex-col items-center justify-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
        <span class="text-sm text-slate-500">Procesando información...</span>
    </div>

    <?php if($verNormal): ?>
        <!-- ========================================================= -->
        <!-- VISTAS PARA AGENTES, JEFES, COORDINADORES Y ADMINS        -->
        <!-- ========================================================= -->
        
        <div id="cc-search-section" class="flex flex-col items-center justify-center text-center py-12 px-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 mb-6 animate-fade-in-up transition-all w-full shadow-sm mx-auto">
            <div class="bg-white dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-full shadow-md mb-6 mx-auto"><span class="text-4xl drop-shadow-sm block translate-y-0.5">🧾</span></div>
            <h2 class="text-2xl font-black text-slate-800 dark:text-white mb-3">Facturación Continua</h2>
            <p class="text-sm text-slate-500 font-medium max-w-xl mx-auto mb-8 leading-relaxed">El sistema buscará en TSD todas las facturas generadas a partir del último corte de caja registrado para las sucursales que tiene asignadas.</p>
            <div id="home-sucursales-list" class="flex flex-wrap justify-center items-center gap-2 mb-8 w-full max-w-2xl mx-auto empty:hidden"></div>
            <div class="w-full flex justify-center">
                <button onclick="window.CierreCajasLogic.loadFacturacion()" id="btn-load-fact" class="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-xl font-black shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-3 transform hover:-translate-y-1 hover:shadow-indigo-500/50 w-full sm:w-auto min-w-[300px]">
                    <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> CARGAR FACTURACIÓN
                </button>
            </div>
        </div>

        <div id="cc-home-view" class="flex flex-col w-full py-4 transition-all">
            <div id="cc-mi-bandeja" class="hidden animate-fade-in-up w-full mt-2">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
                    <h2 class="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span> Casos Pendientes 
                        <span id="cc-mi-count" class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md text-[10px] ml-1">0</span>
                    </h2>
                    <button onclick="window.CierreCajasLogic.enviarSeleccionadosAJefatura('home')" id="cc-btn-report-home" class="hidden bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors items-center gap-2 text-xs">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> Reportar Seleccionados
                    </button>
                </div>
                <div id="cc-mi-list" class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 lg:gap-5 pb-10"></div>
            </div>
        </div>

        <div id="cc-workspace" class="hidden flex-col gap-4 flex-grow overflow-hidden">
            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm w-full mb-4 flex flex-col overflow-hidden shrink-0">
                <div class="p-4 lg:p-5 grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-start relative">
                    <div class="absolute top-0 left-0 w-1.5 h-full bg-green-500"></div>
                    <div class="pl-2 lg:pl-4 col-span-1 md:col-span-2">
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest block mb-1">Rango de Cortes Cargados</span>
                        <div id="meta-sucursales-list" class="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight space-y-1"></div>
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
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span> No Reportados en esta Sucursal (<span id="cc-suc-count">0</span>)
                    </h3>
                    <button onclick="window.CierreCajasLogic.enviarSeleccionadosAJefatura('sucursal')" id="cc-btn-report-suc" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors text-xs flex items-center gap-2 hidden">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> Reportar
                    </button>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-4" id="cc-suc-list"></div>
            </div>

            <div id="cc-action-bar" class="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 sm:p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center z-40 animate-fade-in-up">
                <div class="flex items-center gap-4 sm:gap-6">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Match</span>
                        <span class="text-xl font-black text-slate-800 dark:text-white font-mono"><span id="cc-sel-count" class="text-green-600">0</span> / <span id="cc-total-count">0</span></span>
                    </div>
                    <div class="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-4 sm:pl-6">
                        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verificado</span>
                        <span id="cc-sel-total" class="text-xl font-black text-green-600 dark:text-green-400 font-mono tracking-tight">₡0.00</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 sm:gap-3">
                    <button onclick="window.CierreCajasLogic.guardarBorrador()" id="btn-draft-cierre" class="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 text-amber-700 px-4 py-2.5 rounded-xl font-bold transition-all"><span class="hidden sm:inline">Pausar</span></button>
                    <button onclick="window.CierreCajasLogic.saveCierre()" id="btn-save-cierre" class="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-bold transition-all" disabled>Procesar Cierre</button>
                </div>
            </div>
        </div>

        <div id="cc-history-view" class="hidden flex-col flex-grow w-full h-full animate-fade-in-up pb-10">
            <div class="flex gap-4 mb-4 border-b border-slate-200 dark:border-slate-700">
                <button onclick="window.CierreCajasLogic.switchSubTab('activos')" id="subtab-activos" class="pb-2 text-sm font-bold border-b-2 border-amber-500 text-amber-600">Casos Activos (<span id="count-urgentes">0</span>)</button>
                <button onclick="window.CierreCajasLogic.switchSubTab('resueltos')" id="subtab-resueltos" class="pb-2 text-sm font-bold border-b-2 border-transparent text-slate-500">Histórico Resueltos (<span id="count-resueltos">0</span>)</button>
            </div>
            <div id="cc-section-activos" class="flex flex-col flex-grow">
                <div class="mb-6 relative">
                    <input type="text" id="search-activos" oninput="window.CierreCajasLogic.filterActivos()" class="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm" placeholder="Buscar en casos activos...">
                    <span class="absolute left-3 top-2.5">🔍</span>
                </div>
                <div id="cc-urgentes-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5"></div>
            </div>
            <div id="cc-section-resueltos" class="hidden flex-col flex-grow">
                <div class="mb-6 relative">
                    <input type="text" id="search-resueltos" onkeydown="if(event.key === 'Enter') window.CierreCajasLogic.searchResueltosServer()" class="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm" placeholder="Buscar histórico...">
                    <span class="absolute left-3 top-2.5">🔍</span>
                </div>
                <div id="cc-resueltos-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 mb-6"></div>
                <div id="cc-pagination-controls" class="hidden flex justify-between items-center bg-white p-3 rounded-xl border">
                    <span class="text-xs font-bold">Página <span id="pag-current">1</span> de <span id="pag-total">1</span></span>
                    <div class="flex gap-2">
                        <button onclick="window.CierreCajasLogic.changeHistoryPage(-1)" id="btn-hist-prev" class="px-4 py-1.5 bg-slate-100 rounded text-xs font-bold">Anterior</button>
                        <button onclick="window.CierreCajasLogic.changeHistoryPage(1)" id="btn-hist-next" class="px-4 py-1.5 bg-slate-100 rounded text-xs font-bold">Siguiente</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="cc-audit-view" class="hidden flex-col flex-grow w-full h-full animate-fade-in-up pb-10">
            <!-- Panel de Filtros -->
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 shrink-0">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        Auditoría Global de Transacciones
                    </h2>
                    <button id="btn-clear-filters" onclick="window.CierreCajasLogic.clearForenseFilters()" class="hidden text-[10px] text-slate-400 hover:text-rose-500 font-bold underline transition-colors cursor-pointer">
                        Limpiar Filtros
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rango de Fechas</label>
                        <div class="relative">
                            <input type="text" id="forense-rango" class="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-slate-400 cursor-pointer transition-colors" placeholder="Seleccione fechas...">
                            <svg class="absolute left-3 top-2.5 w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                    </div>
                    <div class="relative">
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sucursales a Consultar</label>
                        <button type="button" onclick="window.CierreCajasLogic.toggleForenseDropdown(event)" class="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-left flex justify-between items-center transition-colors">
                            <span id="forense-sucursal-btn-text" class="truncate font-bold">Todas las sucursales</span>
                            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                        <div id="forense-sucursal-dropdown" class="absolute z-50 w-full md:w-64 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl hidden max-h-56 overflow-y-auto custom-scrollbar p-2 origin-top-left animate-fade-in-up">
                            <div class="p-4 text-center text-xs text-slate-400">Cargando...</div>
                        </div>
                    </div>
                    <div class="md:col-span-2 relative">
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Búsqueda Universal</label>
                        <input type="text" id="forense-buscar" oninput="window.CierreCajasLogic.checkForenseFilters()" onkeydown="if(event.key === 'Enter') window.CierreCajasLogic.resetAndLoadForense()" class="w-full pl-9 pr-24 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white placeholder-slate-400" placeholder="Folio (f:25), Contrato, Cliente o Autorización..." autocomplete="off">
                        <span class="absolute left-3 top-[26px] text-slate-400">🔍</span>
                        <button onclick="window.CierreCajasLogic.resetAndLoadForense()" class="absolute right-1 top-[22px] bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-xs font-bold transition-colors shadow-sm">Buscar</button>
                    </div>
                </div>
            </div>

            <!-- DASHBOARD DE RENDIMIENTO OPERATIVO UNIFICADO -->
            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm mb-6 overflow-hidden shrink-0">
                <div class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-700/50">
                    
                    <div class="p-5 sm:p-6 flex flex-col justify-center">
                        <div class="flex items-center gap-2 mb-4">
                            <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 flex items-center justify-center text-sm">💰</div>
                            <h3 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dinero Procesado</h3>
                        </div>
                        <div class="flex items-end gap-2 mb-2">
                            <span class="text-3xl font-black text-slate-800 dark:text-white font-mono leading-none" id="kpi-crc">₡0.00</span>
                            <span class="text-xs font-bold text-slate-400 mb-1">CRC</span>
                        </div>
                        <div class="flex items-end gap-2 mb-5">
                            <span class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono leading-none" id="kpi-usd">$0.00</span>
                            <span class="text-[10px] font-bold text-emerald-500/70 mb-0.5">USD</span>
                        </div>
                        <div class="pt-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                            <span class="text-[10px] font-bold text-slate-500 uppercase">Volumen Transaccional</span>
                            <span class="text-sm font-black text-indigo-600 dark:text-indigo-400" id="kpi-volumen-tx">0 Tx</span>
                        </div>
                    </div>

                    <div class="p-5 sm:p-6 flex flex-col justify-center bg-slate-50/50 dark:bg-slate-800/20">
                        <div class="flex justify-between items-end mb-2">
                            <div class="flex items-center gap-2">
                                <div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center justify-center text-xs">🎯</div>
                                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tasa de Match</span>
                            </div>
                            <span class="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono leading-none" id="kpi-tasa">100%</span>
                        </div>
                        <div class="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2 overflow-hidden flex">
                            <div id="bar-exito" class="bg-emerald-500 h-2 transition-all duration-1000" style="width: 100%"></div>
                            <div id="bar-error" class="bg-rose-500 h-2 transition-all duration-1000" style="width: 0%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold mb-5">
                            <span class="text-emerald-600 dark:text-emerald-400"><span id="kpi-tx-limpias">0</span> Limpias</span>
                            <span class="text-rose-600 dark:text-rose-400"><span id="kpi-tickets">0</span> Tickets (Errores)</span>
                        </div>

                        <div class="pt-4 border-t border-slate-100 dark:border-slate-700/50">
                            <div class="flex justify-between items-end mb-1">
                                <span class="text-[10px] font-bold text-rose-500 uppercase">Impacto Riesgo (CRC)</span>
                                <span class="text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-1.5 py-0.5 rounded" id="kpi-porcentaje-monto">0% del total</span>
                            </div>
                            <span class="text-xl font-black text-rose-600 dark:text-rose-400 font-mono" id="kpi-monto-tickets">₡0.00</span>
                        </div>
                    </div>

                    <div class="p-5 sm:p-6 flex flex-col justify-center">
                        <div class="flex items-center gap-2 mb-5">
                            <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 flex items-center justify-center text-sm">📊</div>
                            <h3 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Distribución de Errores</h3>
                        </div>

                        <div class="w-full flex-grow flex flex-col justify-center">
                            <div id="kpi-no-errors" class="text-center py-2 hidden">
                                <span class="text-3xl block mb-2">🎉</span>
                                <span class="text-xs font-bold text-slate-400">Sin inconsistencias en este período</span>
                            </div>
                            
                            <div id="kpi-has-errors">
                                <div id="kpi-ticket-bar" class="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-3 mb-4 flex overflow-hidden shadow-inner"></div>
                                <div id="kpi-ticket-legend" class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5"></div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Tabla de Resultados -->
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

    <?php endif; ?>

    <?php if($verSC): ?>
        <!-- ========================================================= -->
        <!-- VISTA EXCLUSIVA SERVICIO AL CLIENTE (Y ADMINS)            -->
        <!-- ========================================================= -->
        <div id="cc-sc-view" class="hidden flex-col flex-grow w-full h-full animate-fade-in-up pb-10">
            
            <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
                <h2 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    Tickets Escalados a Servicio al Cliente
                </h2>
                <div class="relative">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Búsqueda Inteligente Global</label>
                    <input type="text" id="sc-search" oninput="window.CierreCajasLogic.filterSCTable()" class="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 dark:text-white placeholder-slate-400" placeholder="Buscar por Sucursal, Folio, Contrato o #Ticket...">
                    <span class="absolute left-3 top-[26px] text-slate-400">🔍</span>
                </div>
            </div>

            <div class="w-full flex-grow bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-4">
                <div class="w-full max-h-[65vh] overflow-auto custom-scrollbar">
                    <table class="w-full text-left border-collapse select-none">
                        <thead class="sticky top-0 bg-slate-50 dark:bg-slate-900/90 z-10 backdrop-blur-sm shadow-sm border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th class="p-4 font-bold">Ticket / Folio</th>
                                <th class="p-4 font-bold">Contrato / Cliente</th>
                                <th class="p-4 font-bold text-right">Monto (CRC)</th>
                                <th class="p-4 font-bold">Detalle del Trámite</th>
                                <th class="p-4 font-bold text-center">Atraso</th>
                            </tr>
                        </thead>
                        <tbody id="sc-tbody" class="divide-y divide-slate-100 dark:divide-slate-700/50">
                            <!-- JS Inyecta las filas agrupadas por sucursal -->
                        </tbody>
                    </table>
                </div>
            </div>
            
        </div>
    <?php endif; ?>

    <!-- TOAST DE AUTO-GUARDADO -->
    <div id="toast-autosave" class="fixed bottom-24 sm:bottom-28 left-4 sm:left-8 bg-[#1e293b] text-slate-200 text-xs font-bold px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2.5 transform transition-all duration-500 translate-y-10 opacity-0 z-[100] border border-slate-700 pointer-events-none">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span> Progreso guardado
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