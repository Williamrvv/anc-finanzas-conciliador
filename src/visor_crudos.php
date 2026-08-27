<?php
session_start();
if (!isset($_SESSION['user'])) { die("Acceso denegado."); }
$start = $_GET['start'] ?? '';
$end = $_GET['end'] ?? '';
$ctx = $_GET['ctx'] ?? 'm3'; // 'm3' = TSD en vivo | 'm4' = TSD desde base de datos

$historicoDefault = date('Y-m-d');

if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
    $fechaBase = DateTime::createFromFormat('!Y-m-d', $end);

    if ($fechaBase && $fechaBase->format('Y-m-d') === $end) {
        $fechaBase->modify('+1 day');
        $historicoDefault = $fechaBase->format('Y-m-d');
    }
}
?>
<!DOCTYPE html>
<html lang="es" class="h-screen overflow-hidden">
<head>
    <meta charset="UTF-8">
    <title>Explorador de Datos - IRI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
    <script>
        tailwind.config = { darkMode: 'class' };
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        }
    </script>
    <style>
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
        .dark ::-webkit-scrollbar-thumb { background-color: #475569; }
        .vanilla-grid-wrapper { height: 100% !important; border-radius: 0.75rem; border: 1px solid var(--border-color, #e2e8f0); }
        .dark .vanilla-grid-wrapper { border-color: #334155; }

        /* El ícono nativo del calendario es negro y se pierde en modo oscuro.
           Se invierte y se realza al pasar el mouse, sin sumar elementos. */
        input[type="date"]::-webkit-calendar-picker-indicator {
            cursor: pointer;
            opacity: .5;
            transition: opacity .15s ease;
        }
        input[type="date"]:hover::-webkit-calendar-picker-indicator { opacity: 1; }
        .dark input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: .55; }
        .dark input[type="date"]:hover::-webkit-calendar-picker-indicator { opacity: 1; }
    </style>
</head>
<body class="bg-slate-100 dark:bg-slate-900 h-screen w-screen flex flex-col font-sans">
    
    <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap justify-between items-center shrink-0 shadow-sm z-20">
        <div class="flex items-center gap-4">
            <div class="bg-blue-600 text-white p-2 rounded-lg shadow-md">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            </div>
            <div>
                <h1 class="text-xl font-black text-slate-800 dark:text-white leading-tight">Explorador de Datos</h1>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium"><?php echo $ctx === 'm4' ? "Historial consolidado por fecha de folio: $start al $end" : "Filtro TSD: $start al $end | Bancos: Folios Pendientes"; ?></p>
            </div>
        </div>
        
        <div class="flex items-center gap-4 mt-4 lg:mt-0">
            <!-- Inputs Ocultos para engañar a VanillaGrid y usar su motor nativo -->
            <input type="hidden" id="search-bac">
            <input type="hidden" id="search-scotia">
            <input type="hidden" id="search-tsd">
            <input type="hidden" id="search-historico">
            <input type="hidden" id="search-dbr">
            <input type="hidden" id="search-softland">

            <div class="relative">
                <!-- Se cambia oninput por syncSearch -->
                <input type="text" id="global-search" placeholder="Buscar en tabla actual..." oninput="syncSearch(this.value)"
                    class="pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-inner text-slate-700 dark:text-white transition-all font-medium">
                <svg class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            
            <!-- Carril de ancho fijo: rango e histórico se turnan aquí dentro, así
                 ningún control se corre al cambiar de pestaña. -->
            <div class="flex items-center justify-end gap-2 w-[420px] shrink-0">

                <!-- Rango del visor: se hereda del histórico y se aplica solo -->
                <div id="rango-controls" class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Rango:</span>
                    <input type="date" id="rango-inicio" value="<?php echo htmlspecialchars($start); ?>" onchange="aplicarRango()"
                        class="px-2 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white transition-shadow">
                    <span class="text-xs font-bold text-slate-400">a</span>
                    <input type="date" id="rango-fin" value="<?php echo htmlspecialchars($end); ?>" onchange="aplicarRango()"
                        class="px-2 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white transition-shadow">
                    <svg id="rango-spin" class="animate-spin h-4 w-4 text-blue-500 hidden shrink-0" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                </div>

                <div id="historico-controls" class="hidden items-center gap-2 min-w-0">
                    <span class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Estado al:</span>
                    <input type="date" id="historico-fecha" value="<?php echo $historicoDefault; ?>" onchange="loadHistorico(this.value)"
                        class="px-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white">
                    <span id="historico-resumen" class="text-xs font-bold text-slate-500 dark:text-slate-400 truncate"></span>
                </div>

                <div id="softland-controls" class="hidden items-center gap-2 min-w-0">
                    <span class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Fecha contable:</span>
                    <input type="date"
                        id="softland-fecha"
                        value="<?php echo htmlspecialchars($historicoDefault); ?>"
                        onchange="loadSoftland(this.value)"
                        class="px-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white">
                </div>

                <div id="dbr-controls" class="hidden items-center gap-2 min-w-0">
                    <span class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">DBR:</span>

                    <input type="date" id="dbr-inicio"
                        value="<?php echo htmlspecialchars($start); ?>"
                        max="<?php echo date('Y-m-d'); ?>"
                        onchange="programarDBR()"
                        class="px-2 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-slate-700 dark:text-white">

                    <span class="text-xs font-bold text-slate-400">a</span>

                    <input type="date" id="dbr-fin"
                        value="<?php echo htmlspecialchars($end); ?>"
                        max="<?php echo date('Y-m-d'); ?>"
                        onchange="programarDBR()"
                        class="px-2 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-slate-700 dark:text-white">
                </div>

            </div>

            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
            <!-- Pestañas con Spinners Integrados -->
            <div class="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
                <button onclick="switchTab('bac')" id="tab-bac" class="px-5 py-1.5 text-sm font-bold rounded-md bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400 transition-all flex items-center gap-2">
                    BAC <svg id="spin-bac" class="animate-spin h-3 w-3 hidden" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </button>
                <button onclick="switchTab('scotia')" id="tab-scotia" class="px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2">
                    Davibank <svg id="spin-scotia" class="animate-spin h-3 w-3 hidden" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </button>
                <button onclick="switchTab('tsd')" id="tab-tsd" class="px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2">
                    <?php echo $ctx === 'm4' ? 'TSD (Base Datos)' : 'Sist. TSD'; ?> <svg id="spin-tsd" class="animate-spin h-3 w-3 hidden" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </button>
                <button onclick="switchTab('dbr')" id="tab-dbr" class="px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2">
                    DBR Tarjetas <svg id="spin-dbr" class="animate-spin h-3 w-3 hidden" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                </button>

                <button onclick="switchTab('softland')" id="tab-softland" class="px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2">
                    Contabilidad Softland
                    <svg id="spin-softland" class="animate-spin h-3 w-3 hidden" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                </button>

                <button onclick="switchTab('historico')" id="tab-historico" class="px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2">
                    Histórico Auxiliar <svg id="spin-historico" class="animate-spin h-3 w-3 hidden" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </button>
            </div>
        </div>
    </header>

    <main class="flex-grow relative w-full h-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
        
        <!-- Pantalla de Carga Principal (Se apaga en cuanto carga el primer banco) -->
        <div id="loader-main" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm transition-opacity duration-300">
            <svg class="animate-spin h-14 w-14 text-blue-600 mb-6 drop-shadow-lg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <h2 class="text-xl font-black text-slate-800 dark:text-white tracking-wide">Iniciando Extracción Múltiple...</h2>
            <p id="loader-status" class="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Conectando con BAC Credomatic...</p>
        </div>
        
        <div class="absolute inset-0 w-full h-full p-4 pb-4 flex flex-col">
            <div id="grid-bac" class="w-full flex-grow min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden"></div>
            
            <div id="grid-scotia" class="w-full h-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden hidden relative">
                <div id="wait-scotia" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 z-10">
                    <svg class="animate-spin h-10 w-10 text-blue-400 mb-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span class="text-slate-500 font-bold">Descargando datos de Davibank...</span>
                </div>
            </div>

            <div id="grid-tsd" class="w-full h-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden hidden relative">
                <div id="wait-tsd" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 z-10">
                    <svg class="animate-spin h-10 w-10 text-blue-400 mb-3" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span class="text-slate-500 font-bold">Extrayendo contratos de TSD (Puede tomar unos minutos)...</span>
                </div>
            </div>

            <div id="grid-dbr" class="w-full h-full hidden relative">
                <div class="w-full h-full flex flex-col gap-3">

                    <div class="shrink-0 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-purple-200 dark:border-purple-900 flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-black text-purple-700 dark:text-purple-300">Interfase DBR · Tarjetas</h3>
                            <p class="text-[10px] text-slate-500 dark:text-slate-400">
                                Solo se muestran registros que contienen tarjeta.
                            </p>
                        </div>

                        <span id="dbr-resumen"
                            class="px-3 py-1 text-xs font-black rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                            Sin consultar
                        </span>
                    </div>

                    <div class="relative flex-grow min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">

                        <div id="grid-dbr-table" class="w-full h-full"></div>

                        <div id="dbr-loader"
                            class="hidden absolute inset-0 z-40 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6">

                            <svg class="animate-spin h-12 w-12 text-purple-400 mb-5" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>

                            <h3 class="text-lg font-black mb-2">Consultando Interfase DBR...</h3>

                            <p id="dbr-loader-text" class="text-sm text-slate-300 mb-5">
                                Preparando consultas...
                            </p>

                            <div class="w-full max-w-md h-2.5 bg-slate-700 rounded-full overflow-hidden">
                                <div id="dbr-loader-bar"
                                    class="h-full bg-purple-500 transition-all duration-300"
                                    style="width: 0%">
                                </div>
                            </div>

                            <span id="dbr-loader-pct" class="mt-2 text-xs font-mono font-bold text-purple-300">0%</span>
                        </div>

                    </div>
                </div>
            </div>

            <div id="grid-softland" class="w-full h-full hidden relative">
                <div class="w-full h-full flex flex-col gap-3">

                    <div class="shrink-0 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-blue-200 dark:border-blue-900 flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-black text-blue-700 dark:text-blue-300">
                                Contabilidad Softland
                            </h3>
                            <p class="text-[10px] text-slate-500 dark:text-slate-400">
                                Monto contable registrado manualmente para el día seleccionado.
                            </p>
                        </div>

                        <span id="softland-resumen"
                            class="px-3 py-1 text-xs font-black rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            Sin consultar
                        </span>
                    </div>

                    <div id="grid-softland-table"
                        class="w-full flex-grow min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    </div>

                </div>
            </div>

            <div id="grid-historico" class="w-full hidden relative overflow-y-auto">
                <div class="w-full flex flex-col gap-3 pb-4">

                    <!-- Subpestañas exclusivas de Histórico Auxiliar -->
                    <div class="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-lg w-fit border border-slate-300 dark:border-slate-700">

                        <button
                            id="historico-subtab-pendientes"
                            type="button"
                            onclick="switchHistoricoSubTab('pendientes')"
                            class="px-4 py-2 text-xs font-black rounded-md bg-white dark:bg-slate-700 shadow text-amber-700 dark:text-amber-300 transition-all flex items-center gap-2"
                        >
                            ⏳ Pendientes de conciliar
                            <span
                                id="historico-count-pendientes"
                                class="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300"
                            >0</span>
                        </button>

                        <button
                            id="historico-subtab-conciliados"
                            type="button"
                            onclick="switchHistoricoSubTab('conciliados')"
                            class="px-4 py-2 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2"
                        >
                            ✅ Conciliados ese día
                            <span
                                id="historico-count-conciliados"
                                class="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                            >0</span>
                        </button>

                    </div>

                    <!-- TAB: PENDIENTES -->
                    <section
                        id="historico-panel-pendientes"
                        class="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-amber-200 dark:border-amber-900"
                    >
                        <div class="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900 shrink-0">
                            <h3 class="text-sm font-black text-amber-800 dark:text-amber-300">
                                Pendientes de conciliar
                            </h3>
                            <p class="text-[10px] text-slate-500 dark:text-slate-400">
                                Transacciones que permanecían abiertas al finalizar la fecha seleccionada.
                            </p>
                        </div>

                        <div
                            id="grid-historico-pendientes"
                            class="w-full"
                            style="height: 60vh;"
                        ></div>
                    </section>

                    <!-- TAB: CONCILIADOS -->
                    <section
                        id="historico-panel-conciliados"
                        class="hidden flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-900"
                    >
                        <div class="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900 shrink-0">
                            <h3 class="text-sm font-black text-emerald-800 dark:text-emerald-300">
                                Conciliados ese día
                            </h3>
                            <p class="text-[10px] text-slate-500 dark:text-slate-400">
                                Cruces registrados contablemente durante la fecha seleccionada.
                            </p>
                        </div>

                        <div
                            id="grid-historico-conciliados"
                            class="w-full"
                            style="height: 60vh;"
                        ></div>
                    </section>

                </div>
            </div>
        </div>
    </main>

    <script src="js/vanilla_grid.js"></script>
    <script>
        let rawData = {
            bac: null,
            scotia: null,
            tsd: null,
            dbr: null,
            softland: null,
            historico: null,
            historicoPendientes: [],
            historicoConciliados: []
        };

        let grids = {
            bac: null,
            scotia: null,
            tsd: null,
            dbr: null,
            softland: null,
            historico: null,
            historicoPendientes: null,
            historicoConciliados: null
        };

        let dbrCargando = false;
        let dbrTimer = null;
        let dbrAbortController = null;
        let dbrConsultaSeq = 0;

        // Control de concurrencia BAC / Davibank / TSD.
        // Cada cambio de rango invalida inmediatamente cualquier carga anterior.
        let rangoConsultaSeq = 0;
        let rangoAbortController = null;

        let currentActiveTab = 'bac'; // Empezamos en BAC porque es el primero en cargar
        let historicoSubTabActivo = 'pendientes';

        function autoGenerateColumns(data) {
            if (!data || data.length === 0) return [];
            return Object.keys(data[0]).map(k => {
                if (k === 'EvidenciaB64') {
                    return {
                        title: "Evidencia", field: k, width: 90, hozAlign: "center", headerFilter: false,
                        formatter: (cell) => {
                            const val = cell.getValue();
                            return val ? `<button onclick="window.showEvidence(this.getAttribute('data-img'))" data-img="${val}" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded text-[10px] font-bold shadow-sm transition-colors flex items-center gap-1 mx-auto"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> Ver</button>` : `<span class="text-slate-300">-</span>`;
                        }
                    };
                }
                const isMoney = k.toLowerCase().match(/monto|comision|retencion|saldo|tc/);
                return {
                    title: k.replace(/_/g, ' '), 
                    field: k,
                    headerFilter: true,
                    width: isMoney ? 130 : (k.length > 15 ? 180 : 140),
                    hozAlign: isMoney ? "right" : "left",
                    formatter: isMoney ? "money" : null,
                    cssClass: isMoney ? "font-mono font-bold" : "text-[11px] whitespace-nowrap text-slate-700 dark:text-slate-300"
                };
            });
        }

        // Motor Global de Renderizado de Imágenes en Base64
        window.showEvidence = function(b64) {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[99999] bg-slate-900/90 backdrop-blur-sm flex justify-center items-center p-4 opacity-0 transition-opacity duration-300';
            overlay.innerHTML = `
                <div class="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-2xl relative max-w-5xl w-full flex flex-col transform scale-95 transition-transform duration-300">
                    <div class="flex justify-between items-center p-3 mb-2 border-b border-slate-200 dark:border-slate-700">
                        <h3 class="font-bold text-slate-800 dark:text-white flex items-center gap-2"><span class="text-blue-500">🖼️</span> Evidencia Visual del Ajuste</h3>
                        <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg p-1.5 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <div class="overflow-auto flex justify-center items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-2" style="max-height: 80vh;">
                        <img src="${b64}" class="max-w-full h-auto object-contain rounded">
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => {
                overlay.classList.remove('opacity-0');
                overlay.querySelector('div').classList.remove('scale-95');
            });
        };

        // Mapa de fuentes: en contexto M4 la pestaña TSD consulta la base de datos, no el TSD en vivo
        const SOURCE_MAP = {
            bac:    '<?php echo $ctx === 'm4' ? 'bac_bd'    : 'bac'; ?>',
            scotia: '<?php echo $ctx === 'm4' ? 'scotia_bd' : 'scotia'; ?>',
            tsd:    '<?php echo $ctx === 'm4' ? 'tsd_bd'    : 'tsd'; ?>'
        };

        async function fetchSource(sourceName, contextoRango) {
            const spinner =
                document.getElementById(`spin-${sourceName}`);

            if (spinner) spinner.classList.remove('hidden');

            try {
                const res = await fetch(
                    `api/get_crudos_m3.php?start=${contextoRango.start}&end=${contextoRango.end}&source=${SOURCE_MAP[sourceName]}`,
                    {
                        signal: contextoRango.signal
                    }
                );

                const json = await res.json();

                if (!json.success) {
                    throw new Error(json.error);
                }

                // Una respuesta perteneciente a un rango viejo
                // JAMÁS puede modificar la pantalla actual.
                if (contextoRango.seq !== rangoConsultaSeq) {
                    return false;
                }

                rawData[sourceName] = json.data;

                if (currentActiveTab === sourceName) {
                    renderGrid(sourceName);
                }

                return true;

            } catch (e) {
                if (e.name === 'AbortError') {
                    return false;
                }

                if (contextoRango.seq === rangoConsultaSeq) {
                    alert(
                        `Error en ${sourceName.toUpperCase()}: ` +
                        e.message
                    );
                }

                return false;

            } finally {
                if (
                    contextoRango.seq === rangoConsultaSeq &&
                    spinner
                ) {
                    spinner.classList.add('hidden');
                }
            }
        }

        function dbrHoyISO() {
            const hoy = new Date();
            const anio = hoy.getFullYear();
            const mes = String(hoy.getMonth() + 1).padStart(2, '0');
            const dia = String(hoy.getDate()).padStart(2, '0');
            return `${anio}-${mes}-${dia}`;
        }

        function validarRangoDBR() {
            const inicio = document.getElementById('dbr-inicio');
            const fin = document.getElementById('dbr-fin');

            if (!inicio || !fin) return false;

            const hoy = dbrHoyISO();

            inicio.max = hoy;
            fin.max = hoy;

            const invalido =
                !inicio.value ||
                !fin.value ||
                inicio.value > fin.value ||
                inicio.value > hoy ||
                fin.value > hoy;

            [inicio, fin].forEach(el => {
                el.classList.toggle('ring-2', invalido);
                el.classList.toggle('ring-red-500', invalido);
            });

            return !invalido;
        }

        function programarDBR() {
            clearTimeout(dbrTimer);

            if (!validarRangoDBR()) return;

            // Evita disparar dos consultas pesadas cuando el usuario
            // cambia inicio y fin uno inmediatamente después del otro.
            dbrTimer = setTimeout(() => {
                loadDBR();
            }, 500);
        }

        function dbrFechasRango(inicio, fin) {
            const crearFecha = iso => {
                const [anio, mes, dia] = iso.split('-').map(Number);
                return new Date(anio, mes - 1, dia);
            };

            const formatear = fecha => {
                const anio = fecha.getFullYear();
                const mes = String(fecha.getMonth() + 1).padStart(2, '0');
                const dia = String(fecha.getDate()).padStart(2, '0');
                return `${anio}-${mes}-${dia}`;
            };

            const fechas = [];
            const limite = crearFecha(fin);
            const cursor = crearFecha(inicio);

            while (cursor <= limite) {
                fechas.push(formatear(cursor));
                cursor.setDate(cursor.getDate() + 1);
            }

            return fechas;
        }

        function dbrColumns() {
            const valorCelda = cell =>
                (cell && typeof cell.getValue === 'function')
                    ? cell.getValue()
                    : cell;

            const formatoCRC = value => {
                if (value === null || value === undefined || value === '') return '-';

                const numero = parseFloat(value);
                if (Number.isNaN(numero)) return '-';

                return new Intl.NumberFormat('es-CR', {
                    style: 'currency',
                    currency: 'CRC',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(numero).replace(/\./g, ' ');
            };

            const formatoUSD = value => {
                if (value === null || value === undefined || value === '') return '-';

                const numero = parseFloat(value);
                if (Number.isNaN(numero)) return '-';

                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(numero);
            };

            return [
                {
                    title: 'Fecha consulta',
                    field: 'id',
                    width: 115,
                    headerFilter: true,
                    bottomCalc: 'label'
                },
                {
                    title: 'Asiento',
                    field: 'Asiento',
                    width: 120,
                    headerFilter: true
                },
                {
                    title: 'Consecutivo',
                    field: 'Consecutivo',
                    width: 100,
                    hozAlign: 'right',
                    headerFilter: true,
                    bottomCalc: 'count'
                },
                {
                    title: 'Tarjeta',
                    field: 'Tarjeta',
                    width: 90,
                    headerFilter: true,
                    cssClass: 'font-mono font-bold'
                },
                {
                    title: 'Cliente',
                    field: 'Nombre_Cliente',
                    width: 220,
                    headerFilter: true
                },
                {
                    title: 'Centro Costo',
                    field: 'Centro_Costo',
                    width: 115,
                    headerFilter: true
                },
                {
                    title: 'Cuenta Contable',
                    field: 'Cuenta_Contable',
                    width: 190,
                    headerFilter: true,
                    cssClass: 'font-mono'
                },
                {
                    title: 'Fuente',
                    field: 'Fuente',
                    width: 120,
                    headerFilter: true
                },
                {
                    title: 'Referencia',
                    field: 'Referencia',
                    width: 360,
                    headerFilter: true
                },
                {
                    title: 'Débito ₡',
                    field: 'Debito_Colon',
                    width: 135,
                    hozAlign: 'right',
                    headerFilter: true,
                    bottomCalc: 'sum',
                    formatter: cell => formatoCRC(valorCelda(cell)),
                    bottomCalcFormatter: formatoCRC,
                    cssClass: 'font-mono font-bold'
                },
                {
                    title: 'Crédito ₡',
                    field: 'Credito_Colon',
                    width: 135,
                    hozAlign: 'right',
                    headerFilter: true,
                    bottomCalc: 'sum',
                    formatter: cell => formatoCRC(valorCelda(cell)),
                    bottomCalcFormatter: formatoCRC,
                    cssClass: 'font-mono font-bold'
                },
                {
                    title: 'Débito USD',
                    field: 'Debito_Dolar',
                    width: 125,
                    hozAlign: 'right',
                    headerFilter: true,
                    bottomCalc: 'sum',
                    formatter: cell => formatoUSD(valorCelda(cell)),
                    bottomCalcFormatter: formatoUSD,
                    cssClass: 'font-mono font-bold'
                },
                {
                    title: 'Crédito USD',
                    field: 'Credito_Dolar',
                    width: 125,
                    hozAlign: 'right',
                    headerFilter: true,
                    bottomCalc: 'sum',
                    formatter: cell => formatoUSD(valorCelda(cell)),
                    bottomCalcFormatter: formatoUSD,
                    cssClass: 'font-mono font-bold'
                },
                {
                    title: 'Pay Date',
                    field: 'Pay_Date',
                    width: 115,
                    headerFilter: true
                },
                {
                    title: 'DBR Post Date',
                    field: 'DBR_post_date',
                    width: 130,
                    headerFilter: true
                },
                {
                    title: 'DBR Create Date',
                    field: 'DBR_createDATE',
                    width: 175,
                    headerFilter: true
                },
                {
                    title: 'ICD',
                    field: 'ICD',
                    width: 125,
                    headerFilter: true
                },
                {
                    title: 'Recibido',
                    field: 'Recibido',
                    width: 210,
                    headerFilter: true
                },
                {
                    title: 'Nit',
                    field: 'Nit',
                    width: 110,
                    headerFilter: true
                }
            ];
        }

        function renderDBRGrid() {
            const data = rawData.dbr || [];

            if (grids.dbr) {
                grids.dbr.updateData(data);
                return;
            }

            grids.dbr = new VanillaGrid(
                '#grid-dbr-table',
                data,
                dbrColumns(),
                {
                    threshold: 0,
                    searchInputId: 'search-dbr'
                }
            );
        }

        async function loadDBR() {
            if (!validarRangoDBR()) return;

            clearTimeout(dbrTimer);

            // Si el usuario cambia el rango mientras una consulta lenta sigue
            // ejecutándose, abandonamos la respuesta vieja.
            if (dbrAbortController) {
                dbrAbortController.abort();
            }

            const consultaId = ++dbrConsultaSeq;
            const controller = new AbortController();
            dbrAbortController = controller;

            const inicio = document.getElementById('dbr-inicio').value;
            const fin = document.getElementById('dbr-fin').value;
            const fechas = dbrFechasRango(inicio, fin);

            if (fechas.length === 0) return;

            const loader = document.getElementById('dbr-loader');
            const loaderText = document.getElementById('dbr-loader-text');
            const loaderBar = document.getElementById('dbr-loader-bar');
            const loaderPct = document.getElementById('dbr-loader-pct');
            const spinner = document.getElementById('spin-dbr');
            const resumen = document.getElementById('dbr-resumen');

            const endpoint = 'https://intanc.com/CRM/API/V1/NOTIFICADBR/interfase.php';

            const resultados = [];
            const errores = [];

            dbrCargando = true;

            if (spinner) spinner.classList.remove('hidden');

            if (loader) loader.classList.remove('hidden');
            if (loaderBar) loaderBar.style.width = '0%';
            if (loaderPct) loaderPct.textContent = '0%';
            if (loaderText) loaderText.textContent = `Preparando ${fechas.length} consulta(s)...`;

            try {
                for (let i = 0; i < fechas.length; i++) {
                    const fecha = fechas[i];

                    if (loaderText) {
                        loaderText.textContent = `Consultando ${i + 1} de ${fechas.length}: ${fecha}`;
                    }

                    try {
                        const res = await fetch(
                            `${endpoint}?fecha=${encodeURIComponent(fecha)}`,
                            {
                                cache: 'no-store',
                                signal: controller.signal
                            }
                        );

                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status}`);
                        }

                        const json = await res.json();

                        if (!json.ok) {
                            throw new Error(json.error || 'La API respondió con error');
                        }

                        const filasConTarjeta = (Array.isArray(json.data) ? json.data : [])
                            .filter(row => {
                                const tarjeta = row ? row.Tarjeta : null;

                                return tarjeta !== null &&
                                    tarjeta !== undefined &&
                                    String(tarjeta).trim() !== '' &&
                                    String(tarjeta).trim().toLowerCase() !== 'null';
                            });

                        resultados.push(
                            ...filasConTarjeta.map(row => ({
                                ...row,
                                id: fecha
                            }))
                        );

                    } catch (errorDia) {
                        if (errorDia.name === 'AbortError') {
                            throw errorDia;
                        }

                        errores.push(`${fecha}: ${errorDia.message}`);
                    }

                    const porcentaje = Math.round(((i + 1) / fechas.length) * 100);

                    if (loaderBar) loaderBar.style.width = `${porcentaje}%`;
                    if (loaderPct) loaderPct.textContent = `${porcentaje}%`;
                }

                rawData.dbr = resultados;

                if (resumen) {
                    resumen.textContent =
                        `${resultados.length.toLocaleString('es-CR')} registros con tarjeta` +
                        (errores.length ? ` · ${errores.length} día(s) con error` : '');
                }

                if (currentActiveTab === 'dbr') {
                    renderDBRGrid();
                }

                if (errores.length === fechas.length) {
                    alert(
                        'No fue posible consultar la Interfase DBR.\n\n' +
                        errores[0]
                    );
                } else if (errores.length > 0) {
                    console.warn('Fechas DBR con error:', errores);
                }

            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('Error DBR:', e);
                }
            } finally {
                // Una consulta vieja no debe apagar el loader de una consulta nueva.
                if (consultaId === dbrConsultaSeq) {
                    dbrCargando = false;
                    dbrAbortController = null;

                    if (spinner) spinner.classList.add('hidden');
                    if (loader) loader.classList.add('hidden');
                }
            }
        }

        function softlandColumns() {
            return [
                {
                    title: 'ID',
                    field: 'id',
                    width: 90,
                    hozAlign: 'right',
                    headerFilter: true,
                    bottomCalc: 'count',
                    cssClass: 'font-mono'
                },
                {
                    title: 'Fecha contable',
                    field: 'FechaContable',
                    width: 140,
                    headerFilter: true
                },
                {
                    title: 'Monto',
                    field: 'Monto',
                    width: 170,
                    hozAlign: 'right',
                    formatter: 'money',
                    bottomCalc: 'sum',
                    bottomCalcFormatter: 'money',
                    cssClass: 'font-mono font-bold'
                },
                {
                    title: 'Referencia Softland',
                    field: 'ReferenciaSoftland',
                    width: 240,
                    headerFilter: true,
                    cssClass: 'font-mono font-bold'
                },
                {
                    title: 'Registrado por',
                    field: 'EmailUsuario',
                    width: 240,
                    headerFilter: true
                },
                {
                    title: 'Fecha real de registro',
                    field: 'FechaRegistro',
                    width: 190,
                    headerFilter: true
                }
            ];
        }

        function renderSoftlandGrid() {
            const data = rawData.softland || [];

            if (grids.softland) {
                grids.softland.updateData(data);
                return;
            }

            grids.softland = new VanillaGrid(
                '#grid-softland-table',
                data,
                softlandColumns(),
                {
                    threshold: 0,
                    searchInputId: 'search-softland'
                }
            );
        }

        async function loadSoftland(fecha) {
            if (!fecha) return;

            const spinner = document.getElementById('spin-softland');
            const resumen = document.getElementById('softland-resumen');

            if (spinner) spinner.classList.remove('hidden');

            try {
                const res = await fetch(
                    `api/get_softland_contable_m4.php?fecha=${encodeURIComponent(fecha)}`
                );

                const json = await res.json();

                if (!json.success) {
                    throw new Error(json.error || 'No se pudo consultar Contabilidad Softland.');
                }

                rawData.softland = Array.isArray(json.data) ? json.data : [];

                const total = new Intl.NumberFormat('es-CR', {
                    style: 'currency',
                    currency: 'CRC',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(json.summary?.total || 0).replace(/\./g, ' ');

                if (resumen) {
                    resumen.textContent =
                        `${rawData.softland.length} registro(s) · ${total}`;
                }

                if (currentActiveTab === 'softland') {
                    renderSoftlandGrid();
                }

            } catch (e) {
                rawData.softland = [];

                if (resumen) {
                    resumen.textContent = 'Error al consultar';
                }

                alert('Error en CONTABILIDAD SOFTLAND: ' + e.message);

            } finally {
                if (spinner) spinner.classList.add('hidden');
            }
        }

        function historicoSumarMontos(rows) {
            return rows
                .map(row => parseFloat(row.MontoBruto) || 0)
                .sort((a, b) => Math.abs(b) - Math.abs(a))
                .reduce((acc, val) => acc + val, 0);
        }

        function historicoDiferencia(montoTSD, montoBanco) {
            const absT = Math.abs(montoTSD);
            const absB = Math.abs(montoBanco);
            const gap = Math.abs(absT - absB);

            if (absT >= absB) {
                return montoTSD < 0 ? -gap : gap;
            }

            return montoBanco < 0 ? -gap : gap;
        }

        function historicoDebitoCredito(rows) {
            let debito = 0;
            let credito = 0;

            const detalleDebito = [];
            const detalleCredito = [];

            (rows || []).forEach(row => {
                const monto = parseFloat(row.MontoBruto) || 0;

                if (monto === 0) return;

                const esTSD =
                    String(row.Banco || '').toUpperCase() === 'TSD';

                // Regla contable del Auxiliar:
                //
                // BANCO negativo  -> DÉBITO
                // BANCO positivo  -> CRÉDITO
                //
                // TSD positivo    -> DÉBITO
                // TSD negativo    -> CRÉDITO
                const vaDebito = esTSD
                    ? monto > 0
                    : monto < 0;

                const valor = Math.abs(monto);

                if (vaDebito) {
                    debito += valor;

                    if (esTSD && row.ReciboDetalleTSD) {
                        detalleDebito.push(
                            String(row.ReciboDetalleTSD)
                        );
                    }

                } else {
                    credito += valor;

                    if (esTSD && row.ReciboDetalleTSD) {
                        detalleCredito.push(
                            String(row.ReciboDetalleTSD)
                        );
                    }
                }
            });

            return {
                Debito: Number(debito.toFixed(2)),
                Credito: Number(credito.toFixed(2)),

                DetalleDebito: [
                    ...new Set(detalleDebito.filter(Boolean))
                ].join(' · '),

                DetalleCredito: [
                    ...new Set(detalleCredito.filter(Boolean))
                ].join(' · ')
            };
        }

        function historicoValoresUnicos(rows, getter, fallback = '-') {
            const values = rows
                .map(getter)
                .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
                .map(value => String(value).trim());

            const unique = [...new Set(values)];

            return unique.length ? unique.join(', ') : fallback;
        }

        function construirHistoricoPendientes(data) {
            return data
                .filter(row => row.EstadoHistorico === 'PENDIENTE AL CIERRE')
                .map(row => {
                    const esTSD = String(row.Banco || '').toUpperCase() === 'TSD';

                    const montoTSD = esTSD ? (parseFloat(row.MontoBruto) || 0) : 0;
                    const montoBanco = esTSD ? 0 : (parseFloat(row.MontoBruto) || 0);

                    const movimiento =
                        historicoDebitoCredito([row]);

                    return {
                        _rowClass: 'bg-amber-50/30 dark:bg-amber-900/10',
                        Contrato: esTSD ? (row.ContratoTSD || row.Afiliado_MerID || '-') : 'Solo Banco',
                        Cliente: esTSD ? (row.ClienteTSD || '-') : (row.Sucursal || '-'),
                        NotaUsuario: row.NotaUsuario || '',
                        Autorizacion: esTSD ? (row.Autorizacion || '-') : '-',
                        MontoTSD: {
                            valor: montoTSD,
                            recibo: esTSD ? (row.ReciboDetalleTSD || '') : '',
                            valueOf: function() { return this.valor; },
                            toString: function() { return this.valor.toString(); }
                        },
                        EstadoMatch: 'Pendiente',
                        Banco_Nombre: esTSD ? '-' : (row.Banco || '-'),
                        Banco_Auth: esTSD ? '-' : (row.Autorizacion || '-'),
                        Banco_Monto: montoBanco,

                        Debito: movimiento.Debito,
                        Credito: movimiento.Credito,
                        DetalleDebito: movimiento.DetalleDebito,
                        DetalleCredito: movimiento.DetalleCredito,

                        Diferencia: historicoDiferencia(montoTSD, montoBanco),
                        Antiguedad: row.DiasAntiguedadAlCorte !== null ? row.DiasAntiguedadAlCorte : '-'
                    };
                });
        }

        function construirHistoricoConciliados(data) {
            const rows = data.filter(row => row.EstadoHistorico === 'CONCILIADO ESE DÍA');
            const grupos = {};

            rows.forEach(row => {
                const key = row.IdMatchTSD || `sin_match_${row.IdTransaccion}`;

                if (!grupos[key]) grupos[key] = [];
                grupos[key].push(row);
            });

            return Object.values(grupos).map(grupo => {
                const tsdRows = grupo.filter(row => String(row.Banco || '').toUpperCase() === 'TSD');
                const bancoRows = grupo.filter(row => String(row.Banco || '').toUpperCase() !== 'TSD');

                const montoTSD = historicoSumarMontos(tsdRows);
                const montoBanco = historicoSumarMontos(bancoRows);

                // Débito/Crédito se calcula sobre CADA movimiento original,
                // no sobre el resultado neto del grupo.
                const movimiento =
                    historicoDebitoCredito(grupo);

                const antiguedades = grupo
                    .map(row => parseInt(row.DiasAntiguedadAlCorte, 10))
                    .filter(value => !Number.isNaN(value));

                const tipoCruce = historicoValoresUnicos(
                    grupo,
                    row => row.TipoCruceTSD ? String(row.TipoCruceTSD).replace('[AUX] ', '') : null,
                    'Conciliado'
                );

                return {
                    _rowClass: 'bg-emerald-50/30 dark:bg-emerald-900/10',
                    Contrato: historicoValoresUnicos(
                        tsdRows,
                        row => row.ContratoTSD || row.Afiliado_MerID,
                        'Solo Banco'
                    ),
                    Cliente: historicoValoresUnicos(
                        tsdRows.length ? tsdRows : bancoRows,
                        row => tsdRows.length ? row.ClienteTSD : row.Sucursal,
                        '-'
                    ),
                    NotaUsuario: historicoValoresUnicos(grupo, row => row.NotaUsuario, ''),
                    Autorizacion: historicoValoresUnicos(tsdRows, row => row.Autorizacion, '-'),
                    MontoTSD: {
                        valor: montoTSD,
                        recibo: historicoValoresUnicos(tsdRows, row => row.ReciboDetalleTSD, ''),
                        valueOf: function() { return this.valor; },
                        toString: function() { return this.valor.toString(); }
                    },
                    EstadoMatch: tipoCruce,
                    Banco_Nombre: historicoValoresUnicos(bancoRows, row => row.Banco, '-'),
                    Banco_Auth: historicoValoresUnicos(bancoRows, row => row.Autorizacion, '-'),
                    Banco_Monto: montoBanco,

                    Debito: movimiento.Debito,
                    Credito: movimiento.Credito,
                    DetalleDebito: movimiento.DetalleDebito,
                    DetalleCredito: movimiento.DetalleCredito,

                    Diferencia: historicoDiferencia(montoTSD, montoBanco),
                    Antiguedad: antiguedades.length ? Math.max(...antiguedades) : '-'
                };
            });
        }

        function historicoColumns() {
            const fmtMoney = value => new Intl.NumberFormat('es-CR', {
                style: 'currency',
                currency: 'CRC'
            }).format(Math.abs(parseFloat(value) || 0)).replace(/\./g, ' ');

            const fmtMovimiento = (cell, campo) => {
                const row = (typeof cell === 'object' && cell)
                    ? (
                        cell.getRow
                            ? cell.getRow()
                            : (
                                cell.getData
                                    ? cell.getData()
                                    : cell
                            )
                    )
                    : cell;

                const valor =
                    Math.abs(parseFloat(row?.[campo]) || 0);

                if (valor === 0) {
                    return `
                        <span class="text-slate-300 dark:text-slate-600">
                            —
                        </span>
                    `;
                }

                const detalle =
                    campo === 'Debito'
                        ? row?.DetalleDebito
                        : row?.DetalleCredito;

                const detalleHtml = detalle
                    ? `
                        <div
                            class="text-[9px] text-orange-600 dark:text-orange-400 italic truncate font-medium mt-0.5"
                            title="${detalle}"
                        >
                            ${detalle}
                        </div>
                    `
                    : '';

                return `
                    <div class="flex flex-col justify-center items-end h-full">
                        <span class="font-bold text-slate-800 dark:text-slate-200">
                            ${fmtMoney(valor)}
                        </span>
                        ${detalleHtml}
                    </div>
                `;
            };

            return [
                {
                    title: "Contrato",
                    field: "Contrato",
                    width: 120,
                    cssClass: "font-mono font-bold"
                },
                {
                    title: "Cliente / Notas",
                    field: "Cliente",
                    width: 190,
                    cssClass: "text-[10px]",
                    formatter: (cell) => {
                        const row = (typeof cell === 'object' && cell)
                            ? (cell.getRow ? cell.getRow() : (cell.getData ? cell.getData() : cell))
                            : cell;

                        const value = (typeof cell === 'object' && cell.getValue ? cell.getValue() : cell) || '-';
                        const nota = row && row.NotaUsuario ? row.NotaUsuario : '';

                        const notaHtml = nota
                            ? `<div class="mt-1 text-[9px] font-bold italic leading-tight text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-black/20 p-1 rounded border border-slate-200 dark:border-slate-600 break-words whitespace-normal max-w-full">💬 ${nota}</div>`
                            : '';

                        return `<div><span class="truncate" title="${value}">${value}</span>${notaHtml}</div>`;
                    }
                },
                {
                    title: "Auth TSD",
                    field: "Autorizacion",
                    width: 90,
                    cssClass: "font-mono",
                    hozAlign: "center"
                },
                {
                    title: "Débito",
                    field: "Debito",
                    width: 145,
                    hozAlign: "right",
                    bottomCalc: "sum",
                    bottomCalcFormatter: value =>
                        `<span class="font-black">${fmtMoney(value)}</span>`,
                    formatter: cell =>
                        fmtMovimiento(cell, 'Debito'),
                    cssClass: "font-mono"
                },
                {
                    title: "ESTADO AUX",
                    field: "EstadoMatch",
                    width: 160,
                    hozAlign: "center",
                    cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-white/30 dark:bg-black/20 font-bold"
                },
                {
                    title: "Banco",
                    field: "Banco_Nombre",
                    width: 100,
                    hozAlign: "center",
                    cssClass: "text-blue-600 font-bold"
                },
                {
                    title: "Auth Banco",
                    field: "Banco_Auth",
                    width: 100,
                    cssClass: "font-mono",
                    hozAlign: "center"
                },
                {
                    title: "Crédito",
                    field: "Credito",
                    width: 145,
                    hozAlign: "right",
                    bottomCalc: "sum",
                    bottomCalcFormatter: value =>
                        `<span class="font-black">${fmtMoney(value)}</span>`,
                    formatter: cell =>
                        fmtMovimiento(cell, 'Credito'),
                    cssClass: "font-mono"
                },
                {
                    title: "Dif",
                    field: "Diferencia",
                    width: 120,
                    hozAlign: "right",
                    formatter: (cell) => {
                        const value = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                        return `<span class="font-medium text-slate-500 dark:text-slate-400">${fmtMoney(value)}</span>`;
                    }
                }
            ];
        }

        function renderHistoricoGrids() {
            if (rawData.historico === null) return;

            const esPendientes =
                historicoSubTabActivo === 'pendientes';

            const data = esPendientes
                ? (rawData.historicoPendientes || [])
                : (rawData.historicoConciliados || []);

            const gridKey = esPendientes
                ? 'historicoPendientes'
                : 'historicoConciliados';

            const contenedorId = esPendientes
                ? 'grid-historico-pendientes'
                : 'grid-historico-conciliados';

            if (grids[gridKey]) {
                grids[gridKey].updateData(data);
            } else {
                const contenedor =
                    document.getElementById(contenedorId);

                // Recupera la altura que el usuario hubiera dejado.
                if (
                    contenedor &&
                    contenedor.dataset.altoUsuario
                ) {
                    contenedor.style.height =
                        contenedor.dataset.altoUsuario;
                }

                grids[gridKey] = new VanillaGrid(
                    `#${contenedorId}`,
                    data,
                    historicoColumns(),
                    {
                        threshold: 0,
                        searchInputId: 'search-historico'
                    }
                );
            }

            const el =
                document.getElementById(contenedorId);

            if (el && !el._obsAlto) {
                el._obsAlto = new ResizeObserver(() => {
                    if (el.style.height) {
                        el.dataset.altoUsuario =
                            el.style.height;
                    }
                });

                el._obsAlto.observe(el);
            }
        }

        function switchHistoricoSubTab(tab) {
            if (
                tab !== 'pendientes' &&
                tab !== 'conciliados'
            ) {
                return;
            }

            historicoSubTabActivo = tab;

            const esPendientes =
                tab === 'pendientes';

            const btnPendientes =
                document.getElementById(
                    'historico-subtab-pendientes'
                );

            const btnConciliados =
                document.getElementById(
                    'historico-subtab-conciliados'
                );

            const panelPendientes =
                document.getElementById(
                    'historico-panel-pendientes'
                );

            const panelConciliados =
                document.getElementById(
                    'historico-panel-conciliados'
                );

            if (btnPendientes) {
                btnPendientes.className = esPendientes
                    ? "px-4 py-2 text-xs font-black rounded-md bg-white dark:bg-slate-700 shadow text-amber-700 dark:text-amber-300 transition-all flex items-center gap-2"
                    : "px-4 py-2 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2";
            }

            if (btnConciliados) {
                btnConciliados.className = !esPendientes
                    ? "px-4 py-2 text-xs font-black rounded-md bg-white dark:bg-slate-700 shadow text-emerald-700 dark:text-emerald-300 transition-all flex items-center gap-2"
                    : "px-4 py-2 text-xs font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2";
            }

            if (panelPendientes) {
                panelPendientes.classList.toggle(
                    'hidden',
                    !esPendientes
                );

                panelPendientes.classList.toggle(
                    'flex',
                    esPendientes
                );
            }

            if (panelConciliados) {
                panelConciliados.classList.toggle(
                    'hidden',
                    esPendientes
                );

                panelConciliados.classList.toggle(
                    'flex',
                    !esPendientes
                );
            }

            // El grid se construye sólo cuando su panel ya está visible.
            // Esto evita cálculos incorrectos de ancho de VanillaGrid
            // dentro de un elemento display:none.
            renderHistoricoGrids();

            // Reaplicar la búsqueda actual al grid recién abierto.
            const globalSearch =
                document.getElementById('global-search');

            const hiddenSearch =
                document.getElementById('search-historico');

            if (globalSearch && hiddenSearch) {
                hiddenSearch.value = globalSearch.value;

                hiddenSearch.dispatchEvent(
                    new Event(
                        'input',
                        { bubbles: true }
                    )
                );
            }
        }

        async function loadHistorico(fecha) {
            if (!fecha) return;

            const spinner = document.getElementById('spin-historico');
            if (spinner) spinner.classList.remove('hidden');

            try {
                const res = await fetch(`api/get_historico_auxiliar_m4.php?fecha=${encodeURIComponent(fecha)}`);
                const json = await res.json();

                if (!json.success) throw new Error(json.error);

                rawData.historico = json.data;
                rawData.historicoPendientes = construirHistoricoPendientes(json.data);
                rawData.historicoConciliados = construirHistoricoConciliados(json.data);

                const countPendientes = document.getElementById('historico-count-pendientes');
                const countConciliados = document.getElementById('historico-count-conciliados');

                if (countPendientes) {
                    countPendientes.textContent = rawData.historicoPendientes.length;
                }

                if (countConciliados) {
                    countConciliados.textContent = rawData.historicoConciliados.length;
                }

                const monto = new Intl.NumberFormat('es-CR', {
                    style: 'currency',
                    currency: 'CRC',
                    maximumFractionDigits: 0
                }).format(json.summary.montoPendiente || 0);

                const resumen = document.getElementById('historico-resumen');

                if (resumen) {
                    resumen.textContent = `${rawData.historicoPendientes.length} pendientes · ${rawData.historicoConciliados.length} conciliaciones · ${monto}`;
                }

                if (currentActiveTab === 'historico') {
                    renderHistoricoGrids();
                }

            } catch (e) {
                alert('Error en HISTÓRICO AUXILIAR: ' + e.message);
            } finally {
                if (spinner) spinner.classList.add('hidden');
            }
        }

        // El rango se aplica solo. Una pausa breve agrupa los cambios seguidos
        // (elegir inicio y luego fin) en una sola consulta.
        let rangoTimer = null;

        function rangoActual() {
            return {
                start: document.getElementById('rango-inicio').value,
                end: document.getElementById('rango-fin').value
            };
        }

        function aplicarRango() {
            clearTimeout(rangoTimer);

            // Invalidar INMEDIATAMENTE cualquier consulta anterior.
            rangoConsultaSeq++;

            if (rangoAbortController) {
                rangoAbortController.abort();
                rangoAbortController = null;
            }

            ['bac', 'scotia', 'tsd'].forEach(fuente => {
                const spinner =
                    document.getElementById(`spin-${fuente}`);

                if (spinner) spinner.classList.add('hidden');
            });

            const spinRango =
                document.getElementById('rango-spin');

            if (spinRango) spinRango.classList.add('hidden');

            const inicio =
                document.getElementById('rango-inicio');

            const fin =
                document.getElementById('rango-fin');

            const invalido =
                !inicio.value ||
                !fin.value ||
                inicio.value > fin.value;

            [inicio, fin].forEach(el => {
                el.classList.toggle('ring-2', invalido);
                el.classList.toggle('ring-red-500', invalido);
            });

            if (invalido) return;

            if (rawData.dbr === null) {
                const dbrInicio =
                    document.getElementById('dbr-inicio');

                const dbrFin =
                    document.getElementById('dbr-fin');

                if (dbrInicio) dbrInicio.value = inicio.value;
                if (dbrFin) dbrFin.value = fin.value;
            }

            const controller = new AbortController();
            rangoAbortController = controller;

            const contextoRango = {
                seq: rangoConsultaSeq,
                start: inicio.value,
                end: fin.value,
                signal: controller.signal
            };

            rangoTimer = setTimeout(async () => {
                if (contextoRango.seq !== rangoConsultaSeq) return;

                const spin =
                    document.getElementById('rango-spin');

                if (spin) spin.classList.remove('hidden');

                sincronizarHistorico(contextoRango.end);

                try {
                    for (const fuente of ['bac', 'scotia', 'tsd']) {

                        const cargado = await fetchSource(
                            fuente,
                            contextoRango
                        );

                        if (
                            !cargado ||
                            contextoRango.seq !== rangoConsultaSeq
                        ) {
                            return;
                        }

                        if (
                            fuente === 'bac'
                        ) {
                            const loader =
                                document.getElementById('loader-main');

                            if (
                                loader &&
                                loader.style.display !== 'none'
                            ) {
                                loader.classList.add('opacity-0');

                                setTimeout(() => {
                                    loader.style.display = 'none';
                                }, 300);
                            }
                        }

                        if (
                            fuente !== currentActiveTab &&
                            grids[fuente]
                        ) {
                            grids[fuente].updateData(
                                rawData[fuente] || []
                            );

                            const cont =
                                document.getElementById(
                                    `grid-${fuente}`
                                );

                            if (cont) {
                                cont.classList.add('hidden');
                            }
                        }
                    }

                } finally {
                    if (
                        contextoRango.seq === rangoConsultaSeq &&
                        spin
                    ) {
                        spin.classList.add('hidden');
                    }
                }
            }, 500);
        }

        // Cortesía de lectura: el corte del histórico va siempre un día por delante
        // del rango de bancos y TSD, para que incluya lo conciliado de ese último día.
        function sincronizarHistorico(finRango) {
            const inputHist = document.getElementById('historico-fecha');
            if (!inputHist || !finRango) return;

            const dia = new Date(`${finRango}T00:00:00`);
            dia.setDate(dia.getDate() + 1);
            const siguiente = dia.toISOString().slice(0, 10);

            if (inputHist.value === siguiente) return;
            inputHist.value = siguiente;

            rawData.historico = null;
            if (currentActiveTab === 'historico') loadHistorico(siguiente);
        }

        async function startSequentialLoading() {
            rangoConsultaSeq++;

            if (rangoAbortController) {
                rangoAbortController.abort();
            }

            const controller = new AbortController();
            rangoAbortController = controller;

            const rango = rangoActual();

            const contextoRango = {
                seq: rangoConsultaSeq,
                start: rango.start,
                end: rango.end,
                signal: controller.signal
            };

            const bacOk =
                await fetchSource('bac', contextoRango);

            if (
                !bacOk ||
                contextoRango.seq !== rangoConsultaSeq
            ) return;

            const loader =
                document.getElementById('loader-main');

            loader.classList.add('opacity-0');
            setTimeout(() => loader.style.display = 'none', 300);

            renderGrid('bac');

            const scotiaOk =
                await fetchSource('scotia', contextoRango);

            if (
                !scotiaOk ||
                contextoRango.seq !== rangoConsultaSeq
            ) return;

            await fetchSource('tsd', contextoRango);
        }

        function renderGrid(tab) {
            if (tab === 'dbr') {
                if (rawData.dbr !== null) {
                    renderDBRGrid();
                }
                return;
            }

            if (tab === 'softland') {
                if (rawData.softland !== null) {
                    renderSoftlandGrid();
                }
                return;
            }

            if (tab === 'historico') {  
                if (rawData.historico !== null) {
                    renderHistoricoGrids();
                }
                return;
            }

            // La tabla ya existe: solo se le cambian los datos y conserva
            // filtros, orden y scroll del usuario.
            if (rawData[tab] && grids[tab]) {
                grids[tab].updateData(rawData[tab]);
                return;
            }

            if (rawData[tab] && !grids[tab]) {
                const waitScreen = document.getElementById(`wait-${tab}`);
                if(waitScreen) waitScreen.style.display = 'none';
                
                requestAnimationFrame(() => {
                    grids[tab] = new VanillaGrid(`#grid-${tab}`, rawData[tab], autoGenerateColumns(rawData[tab]), { 
                        threshold: 0,
                        // Barra de arrastre inferior activa, igual que en el auxiliar
                        searchInputId: `search-${tab}` // Cada grid escucha a su propio input oculto
                    });
                });
            }
        }

        function switchTab(tab) {
            currentActiveTab = tab;

            const historicoControls = document.getElementById('historico-controls');

            if (historicoControls) {
                if (tab === 'historico') {
                    historicoControls.classList.remove('hidden');
                    historicoControls.classList.add('flex');

                    if (rawData.historico === null) {
                        const fecha = document.getElementById('historico-fecha').value;
                        loadHistorico(fecha);
                    }
                } else {
                    historicoControls.classList.add('hidden');
                    historicoControls.classList.remove('flex');
                }
            }

            const dbrControls = document.getElementById('dbr-controls');

            if (dbrControls) {
                if (tab === 'dbr') {
                    dbrControls.classList.remove('hidden');
                    dbrControls.classList.add('flex');

                    validarRangoDBR();

                    // Primera entrada al tab: consulta automáticamente
                    // utilizando el rango heredado de BAC / Davibank / TSD.
                    if (rawData.dbr === null && !dbrCargando) {
                        loadDBR();
                    }
                } else {
                    dbrControls.classList.add('hidden');
                    dbrControls.classList.remove('flex');
                }
            }

            const softlandControls = document.getElementById('softland-controls');

            if (softlandControls) {
                if (tab === 'softland') {
                    softlandControls.classList.remove('hidden');
                    softlandControls.classList.add('flex');

                    if (rawData.softland === null) {
                        const fechaHistorico = document.getElementById('historico-fecha');
                        const fechaSoftland = document.getElementById('softland-fecha');

                        if (fechaHistorico && fechaSoftland) {
                            fechaSoftland.value = fechaHistorico.value;
                        }

                        if (fechaSoftland && fechaSoftland.value) {
                            loadSoftland(fechaSoftland.value);
                        }
                    }
                } else {
                    softlandControls.classList.add('hidden');
                    softlandControls.classList.remove('flex');
                }
            }

            const rangoControls = document.getElementById('rango-controls');
            if (rangoControls) {
                const usaRangoPropio =
                    tab === 'historico' ||
                    tab === 'dbr' ||
                    tab === 'softland';

                rangoControls.classList.toggle('hidden', usaRangoPropio);
                rangoControls.classList.toggle('flex', !usaRangoPropio);
            }

            // 1. Limpiar el buscador visual global
            const globalSearch = document.getElementById('global-search');
            if (globalSearch) globalSearch.value = '';

            ['bac', 'scotia', 'tsd', 'dbr', 'softland', 'historico'].forEach(t => {
                const btn = document.getElementById(`tab-${t}`);
                const gridDiv = document.getElementById(`grid-${t}`);
                
                // 2. Limpiar los inputs ocultos y resetear tablas
                const hiddenInput = document.getElementById(`search-${t}`);
                if (hiddenInput && hiddenInput.value !== '') {
                    hiddenInput.value = '';
                    hiddenInput.dispatchEvent(new Event('input', { bubbles: true })); // Obliga a VanillaGrid a restaurar la tabla nativamente
                }
                
                if (t === tab) {
                    btn.className = "px-5 py-1.5 text-sm font-bold rounded-md bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 transition-all flex items-center gap-2";
                    gridDiv.classList.remove('hidden');
                    renderGrid(t); // Intenta pintar si ya hay datos
                } else {
                    btn.className = "px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2";
                    gridDiv.classList.add('hidden');
                }
            });
        }

        // Función Puente: Clona lo que escribes hacia el VanillaGrid activo
        function syncSearch(term) {
            const hiddenInput = document.getElementById(`search-${currentActiveTab}`);
            if (hiddenInput) {
                hiddenInput.value = term;
                // Dispara el evento nativo. VanillaGrid detecta esto y aplica su propio buscador y resaltado permanente
                hiddenInput.dispatchEvent(new Event('input', { bubbles: true })); 
            }
        }

        document.addEventListener('DOMContentLoaded', startSequentialLoading);
    </script>
</body>
</html>