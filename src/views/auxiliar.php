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
            <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Bandeja de resolución de transacciones históricas y pendientes.</p>
        </div>
        
        <!-- Botonera de Acción Flotante -->
        <div id="m4-action-bar" class="flex items-center gap-2 mt-2 md:mt-0 transition-opacity">

            <button
                id="btn-save-draft-m4"
                type="button"
                onclick="window.AuxiliarLogic.guardarBorradorManualM4()"
                title="Guardar el estado temporal del Auxiliar. También se respalda automáticamente cada 5 minutos."
                class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-black text-xs transition-colors shadow-sm flex items-center gap-2 border border-slate-200 dark:border-slate-600 shrink-0"
            >
                <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7M5 3h11l3 3v15H5V3z"></path>
                </svg>
                GUARDAR BORRADOR
            </button>

            <button id="btn-save-m4" onclick="window.AuxiliarLogic.saveAprobaciones()" class="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-black text-xs transition-all shadow-md shadow-green-500/30 flex items-center gap-2 shrink-0 hover:scale-105">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                APROBAR Y GUARDAR AJUSTES
            </button>

        </div>
    </div>

    <!-- Pestañas de Navegación y Herramientas -->
    <div class="flex justify-between items-center w-full mb-2 shrink-0">
        <div class="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg w-fit border border-slate-200 dark:border-slate-700">
            <button id="tab-m4-bandeja" onclick="window.AuxiliarLogic.switchTab('bandeja')" class="px-5 py-1.5 text-sm font-bold rounded-md bg-white dark:bg-slate-700 shadow text-orange-600 dark:text-orange-400 transition-all flex items-center gap-2">⚖️ Pendientes de conciliar</button>
            <button id="tab-m4-historial" onclick="window.AuxiliarLogic.switchTab('historial')" class="px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2">📚 Historial de conciliados</button>
        </div>
    </div>

    <!-- VISTA 1: BANDEJA PRINCIPAL (Por defecto) -->
    <div id="m4-view-bandeja" class="flex flex-col w-full animate-fade-in-up">
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
                Excepciones / Pendientes <span id="count-m4-huer" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5 text-slate-700 dark:text-slate-300">0</span>
            </div>
        </div>

        <div class="flex items-center gap-2">
            <button onclick="window.AuxiliarLogic.abrirVisorCrudos()" title="Ver datos crudos de BAC, Davibank y TSD guardados en base de datos" class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-slate-200 dark:border-slate-600">🔎 Visor Crudos</button>
            <div class="relative">
                <input type="text" id="search-m4" placeholder="Filtrar en Auxiliar..." 
                    class="pl-8 pr-4 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 w-72 shadow-sm text-slate-700 dark:text-white">
                <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
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
                    <h3 class="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">Sugerencias del Algoritmo y Bandeja de Pendientes</h3>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Doble clic para auditar y aprobar</span>
                    <button onclick="window.AuxiliarLogic.abrirRegistroSoftland()" title="Registrar monto de contabilidad de Softland"
                        class="flex items-center gap-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 border border-blue-700 px-2.5 py-1 rounded-md transition-colors shadow-md">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h10"></path>
                        </svg>
                        Contabilidad Softland
                    </button>

                    <button onclick="window.AuxiliarLogic.abrirAjusteManual()" title="Registrar un ajuste manual del banco (contracargo, devolución, mantenimiento o datáfono)"
                        class="flex items-center gap-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 px-2.5 py-1 rounded-md transition-colors shadow-md">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
                        Ajuste manual
                    </button>
                </div>
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
            </div> <!-- Cierra Contenedor Split de Tablas -->
        </div> <!-- ¡AQUÍ ESTÁ EL DIV FALTANTE! Cierra m4-view-bandeja -->

    <!-- VISTA 2: HISTORIAL DE APROBADOS (Oculta por defecto) -->
    <div id="m4-view-historial" class="hidden flex-col w-full gap-2 animate-fade-in-up">
        <div class="flex justify-between items-center shrink-0">
            <!-- Selector Rango -->
            <div class="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha de Folio:</span>
                <input type="text" id="m4-historial-date" class="bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-white px-3 py-1 outline-none cursor-pointer w-52 text-center rounded border border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500" placeholder="Seleccione fechas...">
                <button onclick="window.AuxiliarLogic.abrirVisorCrudos()" title="Ver datos crudos de BAC, Davibank y TSD guardados en base de datos" class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1 rounded text-xs font-bold transition-colors border border-slate-200 dark:border-slate-600">🔎 Visor Crudos</button>
                <span id="m4-hist-global-badge" class="hidden items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold">
                    🌐 Búsqueda global — fechas ignoradas
                    <button onclick="window.AuxiliarLogic.exitGlobalMode()" title="Volver al rango de fechas" class="hover:text-red-500 font-black px-1 transition-colors">✕</button>
                </span>
            </div>
            
            <div class="flex items-stretch bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                <select id="m4-hist-scope" title="Ámbito de búsqueda" class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-600 px-2 outline-none cursor-pointer hover:text-slate-700 dark:hover:text-white transition-colors">
                    <option value="all">Todo</option>
                    <option value="contrato">Contrato</option>
                    <option value="afiliado">Afiliado</option>
                    <option value="auth">Autorización</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="cliente">Cliente</option>
                    <option value="banco">Banco</option>
                    <option value="liquidacion">Liquidación / PCA</option>
                </select>
                <div class="relative">
                    <input type="text" id="search-m4-historial" placeholder="Buscar en todo el historial..." class="pl-8 pr-4 py-1.5 text-xs bg-transparent outline-none w-64 text-slate-700 dark:text-white">
                    <button onclick="window.AuxiliarLogic.triggerHistorialSearch()" title="Buscar" class="absolute left-1 top-0.5 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center gap-2 shrink-0">
                <span class="text-lg">📚</span>
                <h3 class="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Consolidado TSD — Historial de Ajustes Manuales y Conciliaciones (M4)</h3>
                <span class="text-[10px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Consolidado TSD</span>
            </div>
            <!-- FILTROS UNIVERSALES + DASHBOARDS DEL HISTORIAL -->
            <div class="p-3 space-y-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold uppercase text-slate-500">Filtros:</span>
                    <div id="fh-marca" class="relative"></div>
                    <div id="fh-banco" class="relative"></div>
                    <div id="fh-tarjeta" class="relative"></div>
                    <div id="fh-cc" class="relative"></div>
                    <div id="fh-sucursal" class="relative"></div>
                    <button onclick="window.AuxiliarLogic.limpiarFiltrosHist()" class="text-xs font-bold text-slate-500 hover:text-red-500 border border-slate-300 dark:border-slate-600 px-2 py-1.5 rounded-lg transition-colors">✕ Limpiar</button>
                </div>
                <div id="dash-m4-kpis" class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3"></div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div class="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div class="text-xs font-bold uppercase text-slate-500 mb-2">💰 Ingresos por Centro de Costo</div>
                        <div style="height:240px"><canvas id="ch-hist-cc"></canvas></div>
                    </div>
                    <div class="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div class="text-xs font-bold uppercase text-slate-500 mb-2">💳 Ingresos por Tipo de Tarjeta <span class="text-[9px] normal-case font-normal text-slate-400">(según TSD)</span></div>
                        <div style="height:240px"><canvas id="ch-hist-tarjeta"></canvas></div>
                    </div>
                    <div class="lg:col-span-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div class="text-xs font-bold uppercase text-slate-500 mb-2">🏦 % de Cobro BAC vs Davibank por Sucursal <span class="text-[9px] normal-case font-normal text-slate-400">(proporción del volumen conciliado)</span></div>
                        <div style="height:420px; overflow-x:auto; overflow-y:hidden"><div id="ch-hist-vs-inner" style="height:100%"><canvas id="ch-hist-vs"></canvas></div></div>
                    </div>
                    <div class="lg:col-span-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div class="text-xs font-bold uppercase text-slate-500 mb-2">🏦 Comparativa BAC vs Davibank <span class="text-[9px] normal-case font-normal text-slate-400">(composición % — comisión · retención · neto)</span></div>
                        <div style="height:260px"><canvas id="ch-hist-banco"></canvas></div>
                    </div>
                </div>
            </div>
            <div id="table-historial-m4" style="height: 600px;" class="w-full relative border-none bg-slate-50 dark:bg-slate-900/20"></div>
        </div>

        <!-- TABLA CONCILIADOS BAC — OCULTA temporalmente hasta verificar los datos.
             Para volver a mostrarla: quitar la clase "hidden" de la línea siguiente. -->
        <div class="hidden flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-2 flex items-center gap-2 shrink-0">
                <span class="text-lg">🏦</span>
                <h3 class="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">Transacciones Conciliadas — BAC</h3>
                <span id="count-bac-m4" class="text-[10px] bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">0</span>
            </div>
            <div id="table-bac-m4" style="height: 300px;" class="w-full relative border-none bg-slate-50 dark:bg-slate-900/20"></div>
        </div>

        <!-- TABLA CONCILIADOS DAVIBANK — OCULTA temporalmente hasta verificar los datos.
             Para volver a mostrarla: quitar la clase "hidden" de la línea siguiente. -->
        <div class="hidden flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-center gap-2 shrink-0">
                <span class="text-lg">🏦</span>
                <h3 class="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider">Transacciones Conciliadas — Davibank</h3>
                <span id="count-davi-m4" class="text-[10px] bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-bold">0</span>
            </div>
            <div id="table-davi-m4" style="height: 300px;" class="w-full relative border-none bg-slate-50 dark:bg-slate-900/20"></div>
        </div>
    </div> <!-- FIN VISTA 2 -->

</div>

<style>
    @keyframes shimmer {
        100% { transform: translateX(100%); }
    }
</style>