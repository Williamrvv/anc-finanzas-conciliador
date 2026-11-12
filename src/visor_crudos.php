<?php
session_start();
if (!isset($_SESSION['user'])) { die("Acceso denegado."); }
$start = $_GET['start'] ?? '';
$end = $_GET['end'] ?? '';
$ctx = $_GET['ctx'] ?? 'm3'; // 'm3' = TSD en vivo | 'm4' = TSD desde base de datos

$historicoDefault = date('Y-m-d');

if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
    $fechaBase = DateTime::createFromFormat(
        '!Y-m-d',
        $end
    );

    if (
        $fechaBase &&
        $fechaBase->format('Y-m-d') === $end
    ) {
        $historicoDefault = $end;
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
                    Interfase (Tarjetas) <svg id="spin-dbr" class="animate-spin h-3 w-3 hidden" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
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
                            <h3 class="text-sm font-black text-purple-700 dark:text-purple-300">Interfase · (Tarjetas)</h3>
                            <p class="text-[10px] text-slate-500 dark:text-slate-400">
                                Solo se muestran registros de la cuenta contable 101-004-003-000-000-000 provistos en el api de interfase.
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

                            <!-- Conciliaciones manuales del Auxiliar: solo aparece si hay alguna -->
                            <div id="historico-kpis-manuales" class="hidden flex-wrap items-center gap-2 mt-2"></div>
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

            // Cuenta contable que define qué registros son relevantes.
            // Si cambia el plan de cuentas, se modifica sólo acá.
            const CUENTA_CONTABLE_INTERFASE = '101-004-003-000-000-000';

            // Se consulta vía proxy PHP propio: el certificado de intanc.com no
            // lo valida Chrome y el navegador no permite ignorarlo por código.
            const endpoint = 'api/get_interfase_tarjetas.php';

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

                        const filasDeLaCuenta = (Array.isArray(json.data) ? json.data : [])
                            .filter(row => {
                                // El API no permite filtrar por cuenta contable,
                                // así que se hace acá. Antes se filtraba por
                                // presencia de tarjeta; ahora manda la cuenta.
                                const cuenta = row ? row.Cuenta_Contable : null;

                                return cuenta !== null &&
                                    cuenta !== undefined &&
                                    String(cuenta).trim() === CUENTA_CONTABLE_INTERFASE;
                            });

                        resultados.push(
                            ...filasDeLaCuenta.map(row => ({
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
                        `${resultados.length.toLocaleString('es-CR')} registros en la cuenta ${CUENTA_CONTABLE_INTERFASE}` +
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
            return montoBanco - montoTSD;
        }

        function historicoDebitoCredito(rows) {
            let tsdDebito = 0;
            let tsdCredito = 0;
            let bancoDebito = 0;
            let bancoCredito = 0;

            const detalleTSDDebito = [];
            const detalleTSDCredito = [];

            (rows || []).forEach(row => {
                const monto = parseFloat(row.MontoBruto) || 0;
                if (monto === 0) return;

                const esTSD =
                    String(row.Banco || '').toUpperCase() === 'TSD';

                const valor = Math.abs(monto);

                if (esTSD) {
                    if (monto > 0) {
                        tsdDebito += valor;

                        if (row.ReciboDetalleTSD) {
                            detalleTSDDebito.push(String(row.ReciboDetalleTSD));
                        }
                    } else {
                        tsdCredito += valor;

                        if (row.ReciboDetalleTSD) {
                            detalleTSDCredito.push(String(row.ReciboDetalleTSD));
                        }
                    }
                } else {
                    if (monto < 0) {
                        bancoDebito += valor;
                    } else {
                        bancoCredito += valor;
                    }
                }
            });

            return {
                TSD_Debito: Number(tsdDebito.toFixed(2)),
                TSD_Credito: Number(tsdCredito.toFixed(2)),
                Banco_Debito: Number(bancoDebito.toFixed(2)),
                Banco_Credito: Number(bancoCredito.toFixed(2)),

                DetalleTSDDebito: [
                    ...new Set(detalleTSDDebito.filter(Boolean))
                ].join(' · '),

                DetalleTSDCredito: [
                    ...new Set(detalleTSDCredito.filter(Boolean))
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

        // Los pendientes ya llegan completos desde
        // Tbl_Auxiliar_Corte_Filas.

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

                // Tipos manuales del Auxiliar presentes en este grupo
                const tiposAux = TIPOS_MANUALES_AUX.filter(t => grupo.some(t.prueba));

                return {
                    _tiposAux: tiposAux.map(t => t.clave),
                    _rowClass: tiposAux.length
                        ? tiposAux[0].fila
                        : 'bg-emerald-50/30 dark:bg-emerald-900/10',
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

                    TSD_Debito: movimiento.TSD_Debito,
                    TSD_Credito: movimiento.TSD_Credito,
                    Banco_Debito: movimiento.Banco_Debito,
                    Banco_Credito: movimiento.Banco_Credito,
                    DetalleTSDDebito: movimiento.DetalleTSDDebito,
                    DetalleTSDCredito: movimiento.DetalleTSDCredito,

                    Diferencia: historicoDiferencia(montoTSD, montoBanco),
                    Antiguedad: antiguedades.length ? Math.max(...antiguedades) : '-',

                    // Para la traza al hacer doble clic
                    _trazaMatch: grupo[0].IdMatchTSD || null,
                    _trazaId: String(grupo[0].IdTransaccion)
                };
            });
        }

        // ===== Conciliaciones manuales del Auxiliar (M4) =====
        // Se reconocen por el sello que deja save_auxiliar_m4.php y, el ajuste
        // manual, por el ID que genera save_ajuste_m4.php. Clases literales
        // para que Tailwind las encuentre.
        function esSelloAux(row, texto) {
            const sello = String(row.TipoCruceTSD || '');
            return sello.startsWith('[AUX]') && sello.includes(texto);
        }

        const TIPOS_MANUALES_AUX = [
            {
                clave: 'OTROS', nombre: 'Otros ingresos', icono: '💰',
                prueba: row => esSelloAux(row, 'Otros Ingresos'),
                fila: 'bg-emerald-100/80 dark:bg-emerald-900/40',
                etiqueta: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
                on: 'bg-emerald-600 border-emerald-600 text-white',
                off: 'bg-white dark:bg-slate-800 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30',
                num: 'bg-emerald-100 dark:bg-emerald-900/60'
            },
            {
                clave: 'DATAFONO', nombre: 'Devolución datáfono', icono: '↩️',
                prueba: row => esSelloAux(row, 'Devolución Datáfono'),
                fila: 'bg-orange-100/80 dark:bg-orange-900/40',
                etiqueta: 'bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200',
                on: 'bg-orange-600 border-orange-600 text-white',
                off: 'bg-white dark:bg-slate-800 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/30',
                num: 'bg-orange-100 dark:bg-orange-900/60'
            },
            {
                clave: 'MENOR', nombre: 'Monto menor', icono: '✂️',
                prueba: row => esSelloAux(row, 'Monto Menor'),
                fila: 'bg-fuchsia-100/80 dark:bg-fuchsia-900/40',
                etiqueta: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/60 dark:text-fuchsia-200',
                on: 'bg-fuchsia-600 border-fuchsia-600 text-white',
                off: 'bg-white dark:bg-slate-800 border-fuchsia-300 dark:border-fuchsia-800 text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/30',
                num: 'bg-fuchsia-100 dark:bg-fuchsia-900/60'
            },
            {
                clave: 'INTERNO', nombre: 'Ajuste interno', icono: '🔄',
                prueba: row => esSelloAux(row, 'Ajuste Interno'),
                fila: 'bg-cyan-100/80 dark:bg-cyan-900/40',
                etiqueta: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200',
                on: 'bg-cyan-600 border-cyan-600 text-white',
                off: 'bg-white dark:bg-slate-800 border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-900/30',
                num: 'bg-cyan-100 dark:bg-cyan-900/60'
            },
            {
                clave: 'AJUSTE', nombre: 'Ajuste manual', icono: '🧾',
                prueba: row => String(row.IdTransaccion || '').startsWith('ADJM4-'),
                fila: 'bg-indigo-100/80 dark:bg-indigo-900/40',
                etiqueta: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200',
                on: 'bg-indigo-600 border-indigo-600 text-white',
                off: 'bg-white dark:bg-slate-800 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30',
                num: 'bg-indigo-100 dark:bg-indigo-900/60'
            }
        ];

        // KPIs activos. Se combinan: se muestra lo que cumpla cualquiera.
        let filtroTiposAux = new Set();

        function conciliadosVisibles() {
            const todos = rawData.historicoConciliados || [];
            if (filtroTiposAux.size === 0) return todos;
            return todos.filter(row => (row._tiposAux || []).some(t => filtroTiposAux.has(t)));
        }

        function pintarKpisManuales() {
            const cont = document.getElementById('historico-kpis-manuales');
            if (!cont) return;

            const todos = rawData.historicoConciliados || [];
            const conteo = {};
            todos.forEach(row => (row._tiposAux || []).forEach(t => {
                conteo[t] = (conteo[t] || 0) + 1;
            }));

            // Un KPI activo cuyo tipo no existe en la fecha nueva se suelta
            filtroTiposAux = new Set([...filtroTiposAux].filter(t => conteo[t]));

            const presentes = TIPOS_MANUALES_AUX.filter(t => conteo[t.clave]);
            cont.innerHTML = '';
            cont.classList.toggle('hidden', presentes.length === 0);
            cont.classList.toggle('flex', presentes.length > 0);
            if (presentes.length === 0) return;

            presentes.forEach(t => {
                const activo = filtroTiposAux.has(t.clave);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
                btn.title = activo ? 'Quitar este filtro' : 'Mostrar solo ' + t.nombre.toLowerCase();
                btn.className =
                    'px-2.5 py-1 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-colors ' +
                    'outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400 ' +
                    (activo ? t.on : t.off);
                btn.innerHTML =
                    `<span aria-hidden="true">${t.icono}</span>${t.nombre}` +
                    `<span class="min-w-[1.25rem] px-1.5 rounded-full text-[10px] font-black text-center ${activo ? 'bg-white/25' : t.num}">${conteo[t.clave]}</span>`;
                btn.onclick = () => {
                    if (filtroTiposAux.has(t.clave)) filtroTiposAux.delete(t.clave);
                    else filtroTiposAux.add(t.clave);
                    aplicarFiltroTiposAux();
                };
                cont.appendChild(btn);
            });

            if (filtroTiposAux.size > 0) {
                const info = document.createElement('span');
                info.className = 'text-[10px] text-slate-500 dark:text-slate-400 ml-1';
                info.textContent = `Mostrando ${conciliadosVisibles().length} de ${todos.length}`;
                cont.appendChild(info);

                const reset = document.createElement('button');
                reset.type = 'button';
                reset.className = 'text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline-offset-2 hover:underline outline-none focus-visible:underline';
                reset.textContent = 'Restablecer';
                reset.onclick = () => {
                    filtroTiposAux.clear();
                    aplicarFiltroTiposAux();
                };
                cont.appendChild(reset);
            }
        }

        function aplicarFiltroTiposAux() {
            pintarKpisManuales();
            if (grids.historicoConciliados) {
                grids.historicoConciliados.updateData(conciliadosVisibles());
            }
        }

        function historicoColumns() {
            const fmtMoney = value =>
                new Intl.NumberFormat('es-CR', {
                    style: 'currency',
                    currency: 'CRC'
                }).format(value || 0).replace(/\./g, ' ');

            const fmtMovimiento = (cell, campo) => {
                const row = (typeof cell === 'object' && cell)
                    ? (
                        cell.getRow
                            ? cell.getRow()
                            : (cell.getData ? cell.getData() : cell)
                    )
                    : cell;

                const valor =
                    Math.abs(parseFloat(row?.[campo]) || 0);

                if (valor === 0) {
                    return '<span class="text-slate-300 dark:text-slate-600">-</span>';
                }

                const detalle =
                    campo === 'TSD_Debito'
                        ? row?.DetalleTSDDebito
                        : campo === 'TSD_Credito'
                            ? row?.DetalleTSDCredito
                            : '';

                return `
                    <div class="flex flex-col items-end">
                        <span class="font-bold">
                            ${fmtMoney(valor)}
                        </span>
                        ${detalle ? `
                            <div class="text-[9px] text-orange-600 truncate w-full text-right"
                                 title="${detalle}">
                                ${detalle}
                            </div>
                        ` : ''}
                    </div>
                `;
            };

            return [
                {
                    title: "Contrato",
                    field: "Contrato",
                    width: 150,
                    cssClass: "font-mono font-bold",
                    // Las conciliaciones manuales del Auxiliar llevan su etiqueta
                    formatter: cell => {
                        const row = cell.getRow ? cell.getRow() : {};
                        const val = cell.getValue ? cell.getValue() : '';
                        const tipos = TIPOS_MANUALES_AUX.filter(t => (row._tiposAux || []).includes(t.clave));
                        if (!tipos.length) return val ?? '';
                        return `<div>${val ?? ''}</div>` + tipos.map(t =>
                            `<span class="inline-flex items-center gap-1 mt-0.5 mr-1 px-1.5 rounded text-[9px] font-sans font-bold ${t.etiqueta}">${t.icono} ${t.nombre}</span>`
                        ).join('');
                    }
                },
                {
                    title: "Cliente / Notas",
                    field: "Cliente",
                    width: 180,
                    cssClass: "text-[10px]"
                },
                {
                    title: "Auth TSD",
                    field: "Autorizacion",
                    width: 90,
                    cssClass: "font-mono",
                    hozAlign: "center"
                },
                {
                    title: "TSD Débito",
                    field: "TSD_Debito",
                    width: 125,
                    hozAlign: "right",
                    bottomCalc: "sum",
                    cssClass: "font-mono",
                    bottomCalcFormatter: val =>
                        `<span class="font-black">${fmtMoney(Math.abs(val || 0))}</span>`,
                    formatter: cell =>
                        fmtMovimiento(cell, 'TSD_Debito')
                },
                {
                    title: "TSD Crédito",
                    field: "TSD_Credito",
                    width: 125,
                    hozAlign: "right",
                    bottomCalc: "sum",
                    cssClass: "font-mono",
                    bottomCalcFormatter: val =>
                        `<span class="font-black">${fmtMoney(Math.abs(val || 0))}</span>`,
                    formatter: cell =>
                        fmtMovimiento(cell, 'TSD_Credito')
                },
                {
                    title: "Banco",
                    field: "Banco_Nombre",
                    width: 90,
                    hozAlign: "center",
                    cssClass: "text-blue-600 font-bold"
                },
                {
                    title: "Auth Banco",
                    field: "Banco_Auth",
                    width: 90,
                    cssClass: "font-mono",
                    hozAlign: "center"
                },
                {
                    title: "Banco Débito",
                    field: "Banco_Debito",
                    width: 125,
                    hozAlign: "right",
                    bottomCalc: "sum",
                    cssClass: "font-mono",
                    bottomCalcFormatter: val =>
                        `<span class="font-black">${fmtMoney(Math.abs(val || 0))}</span>`,
                    formatter: cell =>
                        fmtMovimiento(cell, 'Banco_Debito')
                },
                {
                    title: "Banco Crédito",
                    field: "Banco_Credito",
                    width: 125,
                    hozAlign: "right",
                    bottomCalc: "sum",
                    cssClass: "font-mono",
                    bottomCalcFormatter: val =>
                        `<span class="font-black">${fmtMoney(Math.abs(val || 0))}</span>`,
                    formatter: cell =>
                        fmtMovimiento(cell, 'Banco_Credito')
                },
                {
                    title: "Dif",
                    field: "Diferencia",
                    hozAlign: "right",
                    formatter: "money",
                    cssClass: "font-bold text-red-500"
                },
                {
                    title: "📝 Nota",
                    field: "NotaUsuario",
                    width: 200,
                    cssClass: "text-[10px]",
                    formatter: cell => {
                        const val =
                            typeof cell === 'object' && cell.getValue
                                ? cell.getValue()
                                : cell;

                        return val
                            ? `<div class="italic font-medium">${val}</div>`
                            : '<span class="text-slate-400">-</span>';
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
                : conciliadosVisibles();

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
                        searchInputId: 'search-historico',
                        onRowDblClick: abrirTrazaFila
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

            const spinner =
                document.getElementById(
                    'spin-historico'
                );

            if (spinner) {
                spinner.classList.remove('hidden');
            }

            try {
                const res = await fetch(
                    `api/get_historico_auxiliar_m4.php?fecha=${encodeURIComponent(fecha)}`,
                    { cache: 'no-store' }
                );

                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(
                        json.error ||
                        `Error HTTP ${res.status}`
                    );
                }

                rawData.historico = {
                    fecha: json.fecha,
                    corte: json.corte || null
                };

                // Ya llegan exactamente como fueron guardados.
                rawData.historicoPendientes =
                    Array.isArray(json.pendientes)
                        ? json.pendientes
                        : [];

                // Maestra todavía se agrupa por IdMatchTSD.
                rawData.historicoConciliados =
                    construirHistoricoConciliados(
                        Array.isArray(json.conciliados)
                            ? json.conciliados
                            : []
                    );

                pintarKpisManuales();

                const countPendientes =
                    document.getElementById(
                        'historico-count-pendientes'
                    );

                const countConciliados =
                    document.getElementById(
                        'historico-count-conciliados'
                    );

                if (countPendientes) {
                    countPendientes.textContent =
                        rawData.historicoPendientes.length;
                }

                if (countConciliados) {
                    countConciliados.textContent =
                        rawData.historicoConciliados.length;
                }

                const monto =
                    new Intl.NumberFormat(
                        'es-CR',
                        {
                            style: 'currency',
                            currency: 'CRC',
                            maximumFractionDigits: 0
                        }
                    ).format(
                        json.summary?.montoPendiente || 0
                    );

                const resumen =
                    document.getElementById(
                        'historico-resumen'
                    );

                if (resumen) {
                    const corteTexto = json.corte
                        ? ` · corte ${json.corte.OrigenCaptura} ${json.corte.FechaCapturaReal}`
                        : ' · sin corte guardado';

                    resumen.textContent =
                        `${rawData.historicoPendientes.length} pendientes · ` +
                        `${rawData.historicoConciliados.length} conciliaciones · ` +
                        `${monto}${corteTexto}`;
                }

                if (currentActiveTab === 'historico') {
                    renderHistoricoGrids();
                }

            } catch (e) {
                alert(
                    'Error en HISTÓRICO AUXILIAR: ' +
                    e.message
                );

            } finally {
                if (spinner) {
                    spinner.classList.add('hidden');
                }
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

        // El histórico usa exactamente la fecha del corte diario.
        function sincronizarHistorico(finRango) {
            const inputHist =
                document.getElementById(
                    'historico-fecha'
                );

            if (!inputHist || !finRango) return;

            if (inputHist.value === finRango) return;

            inputHist.value = finRango;
            rawData.historico = null;

            if (currentActiveTab === 'historico') {
                loadHistorico(finRango);
            }
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

            const dataActual =
                Array.isArray(rawData[tab])
                    ? rawData[tab]
                    : [];

            // Si el grid ya existe, puede recibir incluso un array vacío.
            if (grids[tab]) {
                grids[tab].updateData(dataActual);
                return;
            }

            // NUNCA crear VanillaGrid sin columnas.
            // Cuando posteriormente lleguen datos reales,
            // renderGrid() podrá construirlo correctamente.
            if (dataActual.length === 0) {
                return;
            }

            const waitScreen =
                document.getElementById(`wait-${tab}`);

            if (waitScreen) {
                waitScreen.style.display = 'none';
            }

            requestAnimationFrame(() => {
                const dataFinal =
                    Array.isArray(rawData[tab])
                        ? rawData[tab]
                        : [];

                if (dataFinal.length === 0) return;

                // Otro render pudo haber creado el grid mientras
                // esperábamos el siguiente frame.
                if (grids[tab]) {
                    grids[tab].updateData(dataFinal);
                    return;
                }

                grids[tab] = new VanillaGrid(
                    `#grid-${tab}`,
                    dataFinal,
                    autoGenerateColumns(dataFinal),
                    {
                        threshold: 0,
                        searchInputId: `search-${tab}`,
                        onRowDblClick: abrirTrazaFila
                    }
                );
            });
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

        // =====================================================================
        // TRAZA DE UNA TRANSACCIÓN — doble clic en BAC, Davibank, TSD e Histórico.
        // Todo se lee de api/get_traza_transaccion.php (solo lectura).
        // =====================================================================
        const traza = { datos: null, peticion: 0 };

        function trazaEsc(v) {
            return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function trazaVacio(v) {
            return v === null || v === undefined || String(v).trim() === '';
        }

        function trazaMonto(v) {
            const n = parseFloat(v);
            if (Number.isNaN(n)) return '-';
            return '₡' + new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
        }

        // "2026-10-12 09:41:00.000" → "12/10/2026 09:41"
        function trazaFecha(v, conHora = true) {
            const t = String(v ?? '').trim();
            const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
            if (!m) return t || '-';
            return `${m[3]}/${m[2]}/${m[1]}` + (conHora && m[4] ? ` ${m[4]}:${m[5]}` : '');
        }

        // Qué llave mandar según la tabla donde se hizo doble clic
        function llaveTraza(row) {
            if (!row) return null;
            if (row._trazaMatch) return { match: row._trazaMatch };
            if (row._trazaId) return { id: row._trazaId };
            if (row.IdFilaCorte) return { fila: row.IdFilaCorte };
            const id = row.IdTransaccion ?? row.ID_Transaccion;
            return trazaVacio(id) ? null : { id: String(id) };
        }

        function abrirTrazaFila(row) {
            const llave = llaveTraza(row);
            if (llave) abrirTraza(llave);
        }

        // Clases literales para que Tailwind las encuentre
        const TRAZA_TONOS = {
            emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
            amber:   'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
            blue:    'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
            slate:   'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
            indigo:  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200'
        };

        function trazaChip(texto, tono) {
            return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${TRAZA_TONOS[tono] || tono}">${trazaEsc(texto)}</span>`;
        }

        function trazaTiposManuales(t) {
            if (typeof TIPOS_MANUALES_AUX === 'undefined') return [];
            return TIPOS_MANUALES_AUX.filter(tp => tp.prueba(t.maestra));
        }

        function trazaModal() {
            let m = document.getElementById('traza-modal');
            if (m) return m;

            m = document.createElement('div');
            m.id = 'traza-modal';
            m.className = 'fixed inset-0 z-[9999] hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
            m.setAttribute('role', 'dialog');
            m.setAttribute('aria-modal', 'true');
            m.setAttribute('aria-labelledby', 'traza-titulo');
            m.innerHTML = `
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div id="traza-cabecera" class="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4 shrink-0"></div>
                    <div id="traza-cuerpo" class="overflow-auto px-5 py-4 text-sm text-slate-700 dark:text-slate-200"></div>
                </div>`;
            m.addEventListener('click', e => { if (e.target === m) cerrarTraza(); });
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape' && !m.classList.contains('hidden')) cerrarTraza();
            });
            document.body.appendChild(m);
            return m;
        }

        function cerrarTraza() {
            const m = document.getElementById('traza-modal');
            if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
            traza.peticion++; // descarta una respuesta que todavía venga en camino
        }

        function trazaCabeceraHtml(t) {
            const cerrar = `<button type="button" onclick="cerrarTraza()" title="Cerrar (Esc)" aria-label="Cerrar"
                class="shrink-0 w-8 h-8 rounded-full text-xl leading-none text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-white">×</button>`;
            if (!t) {
                return `<h3 id="traza-titulo" class="font-bold text-slate-700 dark:text-white">Traza de la transacción</h3>${cerrar}`;
            }

            const m = t.maestra;
            const d = t.detalle || {};
            const esTSD = String(m.Banco || '').toUpperCase() === 'TSD';
            const sub = [
                esTSD ? 'TSD' : m.Banco,
                trazaVacio(m.Autorizacion) ? null : 'Aut ' + m.Autorizacion,
                trazaVacio(m.Tarjeta) ? null : '****' + String(m.Tarjeta).slice(-4),
                esTSD && !trazaVacio(d.Contrato) ? 'Contrato ' + d.Contrato : null
            ].filter(Boolean).map(trazaEsc).join(' · ');

            const conciliada = !trazaVacio(m.IdMatchTSD) && !trazaVacio(m.FechaConciliacion);
            const chips = [conciliada ? trazaChip('Conciliada', 'emerald') : trazaChip('Pendiente', 'amber')]
                .concat(trazaTiposManuales(t).map(tp => trazaChip(tp.icono + ' ' + tp.nombre, tp.etiqueta)));

            return `
                <div class="min-w-0">
                    <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${sub}</div>
                    <h3 id="traza-titulo" class="text-2xl font-mono font-black text-slate-800 dark:text-white">${trazaMonto(m.MontoBruto)}</h3>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap justify-end">${chips.join('')}${cerrar}</div>`;
        }

        // quien: texto = usuario | null = "Usuario no registrado" | false = no aplica
        function trazaPaso(icono, titulo, detalle, cuando, quien, extra = '') {
            return `
                <li class="relative pl-9 pb-4 last:pb-0">
                    <span class="absolute left-0 top-0 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm" aria-hidden="true">${icono}</span>
                    <div class="flex justify-between gap-4">
                        <div class="min-w-0">
                            <div class="font-bold text-slate-800 dark:text-white">${trazaEsc(titulo)}</div>
                            ${detalle ? `<div class="text-xs text-slate-500 dark:text-slate-400 break-words">${detalle}</div>` : ''}
                        </div>
                        <div class="text-right text-xs shrink-0">
                            ${cuando ? `<div class="font-mono text-slate-600 dark:text-slate-300">${trazaEsc(cuando)}</div>` : ''}
                            ${quien === false ? '' : `<div class="${quien ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600 italic'}">${quien ? trazaEsc(quien) : 'Usuario no registrado'}</div>`}
                        </div>
                    </div>
                    ${extra}
                </li>`;
        }

        // Justificación + captura de la auditoría
        function trazaAuditoriaHtml(aud) {
            if (!aud) return '';
            let texto = String(aud.Justificacion || '').trim();
            let asiento = '';
            const mS = texto.match(/^\[SOFTLAND:([^\]]*)\]\s*([\s\S]*)$/);
            if (mS) { asiento = mS[1].trim(); texto = mS[2].trim(); }

            let captura = '';
            const ev = String(aud.EvidenciaB64 || '').trim();
            if (ev) {
                const src = ev.startsWith('data:') ? ev : 'data:image/png;base64,' + ev;
                if (/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/i.test(src)) {
                    captura = `
                        <button type="button" onclick="trazaVerCaptura(this)"
                            class="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Ver aprobación</button>
                        <img alt="Captura de la aprobación" data-src="${trazaEsc(src)}"
                            class="hidden mt-2 max-h-[60vh] w-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white">`;
                }
            }

            return `
                <div class="mt-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 text-xs">
                    <div class="font-bold text-slate-600 dark:text-slate-300">${trazaEsc(aud.TipoAjuste || 'Justificación')}${asiento ? ' · Asiento ' + trazaEsc(asiento) : ''}</div>
                    ${texto ? `<div class="mt-0.5 whitespace-pre-line text-slate-600 dark:text-slate-300">${trazaEsc(texto)}</div>` : ''}
                    ${captura}
                </div>`;
        }

        function trazaVerCaptura(btn) {
            const img = btn.nextElementSibling;
            if (!img) return;
            if (!img.getAttribute('src')) img.setAttribute('src', img.dataset.src);
            const visible = !img.classList.toggle('hidden');
            btn.textContent = visible ? 'Ocultar aprobación' : 'Ver aprobación';
        }

        function trazaRecorridoHtml(t) {
            const m = t.maestra;
            const d = t.detalle || {};
            const esTSD = String(m.Banco || '').toUpperCase() === 'TSD';
            const esAjusteM4 = String(m.IdTransaccion || '').startsWith('ADJM4-');
            const pasos = [];

            // 1. Origen
            if (esAjusteM4) {
                pasos.push(trazaPaso('🧾', 'Registrada como ajuste manual en el Auxiliar', '',
                    trazaFecha(m.FechaRegistro, false), null, trazaAuditoriaHtml(t.auditoria)));
            } else if (esTSD) {
                pasos.push(trazaPaso('📄', 'Tomada del sistema TSD',
                    [d.Recibo_Detalle, d.Cliente].filter(v => !trazaVacio(v)).map(trazaEsc).join(' · '),
                    trazaFecha(d.FechaPago || m.FechaTransaccion, false), false));
            } else {
                pasos.push(trazaPaso('📄', 'Cargada del Excel del banco',
                    trazaEsc(m.ArchivoOrigen || ''), trazaFecha(m.FechaTransaccion, false), false));
            }

            // 2. Folio (módulo 2 para bancos, consolidado del módulo 3 para TSD)
            if (t.cierre) {
                const c = t.cierre;
                const folio = 'Folio ' + trazaEsc(c.Folio || c.IdCierre);
                pasos.push(esTSD
                    ? trazaPaso('📦', 'Consolidada en el módulo 3', folio, trazaFecha(c.ConsolidadoTSD || c.FechaCreacion), c.Usuario)
                    : trazaPaso('🏦', 'Registrada en el módulo 2', folio + (trazaVacio(c.Fuente) ? '' : ' · ' + trazaEsc(c.Fuente)),
                        trazaFecha(c.FechaCreacion), c.Usuario));
            }

            // 3. Paso por el Auxiliar
            const enBandeja = [...new Set((t.cortes || []).filter(c => c.Seccion === 'BANDEJA').map(c => c.FechaRegistro))];
            if (enBandeja.length) {
                const lista = enBandeja.slice(0, 6).map(f => trazaFecha(f, false).slice(0, 5)).join(', ')
                    + (enBandeja.length > 6 ? ` y ${enBandeja.length - 6} más` : '');
                pasos.push(trazaPaso('⏳', `Pendiente en el Auxiliar ${enBandeja.length} ${enBandeja.length === 1 ? 'día' : 'días'}`,
                    'Cortes: ' + trazaEsc(lista), '', false));
            }

            // 4. Conciliación
            const conciliada = !trazaVacio(m.IdMatchTSD) && !trazaVacio(m.FechaConciliacion);
            if (conciliada) {
                const sello = String(m.TipoCruceTSD || '');
                const enAux = sello.startsWith('[AUX]');
                const cc = t.corteConciliacion;
                let quien = null;
                let nota = '';
                if (cc && cc.CoincideConConciliacion === true) {
                    quien = cc.UsuarioUltimo;
                } else if (cc && !trazaVacio(cc.UsuarioUltimo)) {
                    nota = `<div class="mt-1 text-[11px] text-slate-400">Corte del día guardado por ${trazaEsc(cc.UsuarioUltimo)} el ${trazaEsc(trazaFecha(cc.FechaCapturaReal))}</div>`;
                }

                pasos.push(trazaPaso('✅', enAux ? 'Conciliada en el Auxiliar' : 'Conciliada en el módulo 3',
                    trazaEsc(sello.replace('[AUX] ', '') || 'Conciliado') + ' · fecha contable ' + trazaEsc(trazaFecha(m.FechaConciliacion, false)),
                    trazaFecha(m.FechaRealConciliacion), quien,
                    nota + (esAjusteM4 ? '' : trazaAuditoriaHtml(t.auditoria))));
            } else {
                pasos.push(trazaPaso('⚪', 'Sin conciliar', 'Estado: ' + trazaEsc(m.Estado || '-'), '', false));
            }

            let extras = '';
            if (t.etiqueta || !trazaVacio(m.NotaUsuario)) {
                extras = `<div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    ${t.etiqueta ? trazaChip('🏷️ ' + t.etiqueta.Nombre, 'slate') : ''}
                    ${trazaVacio(m.NotaUsuario) ? '' : `<span class="text-slate-500 dark:text-slate-400">Nota: ${trazaEsc(m.NotaUsuario)}</span>`}
                </div>`;
            }

            return `
                <section>
                    <h4 class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Recorrido</h4>
                    <ol>${pasos.join('')}</ol>
                    ${extras}
                </section>`;
        }

        function trazaGrupoHtml(trans, idSel) {
            const suma = filas => filas.reduce((a, t) => a + (parseFloat(t.maestra.MontoBruto) || 0), 0);
            const tsd = trans.filter(t => String(t.maestra.Banco || '').toUpperCase() === 'TSD');
            const bancos = trans.filter(t => String(t.maestra.Banco || '').toUpperCase() !== 'TSD');

            const filas = trans.map(t => {
                const m = t.maestra;
                const activa = t.IdTransaccion === idSel;
                return `
                    <button type="button" data-id="${trazaEsc(t.IdTransaccion)}" onclick="pintarTraza(this.dataset.id)"
                        class="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-md text-left text-xs transition-colors
                        ${activa ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}">
                        <span class="font-bold w-16 shrink-0 ${String(m.Banco).toUpperCase() === 'TSD' ? 'text-amber-600' : 'text-blue-600 dark:text-blue-400'}">${trazaEsc(m.Banco)}</span>
                        <span class="flex-1 min-w-0 truncate text-slate-500 dark:text-slate-400">${trazaEsc(m.Autorizacion || m.IdTransaccion)}</span>
                        <span class="font-mono font-bold text-slate-700 dark:text-slate-200">${trazaMonto(m.MontoBruto)}</span>
                    </button>`;
            }).join('');

            return `
                <section class="mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
                    <div class="flex items-baseline justify-between gap-2 mb-2">
                        <h4 class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Grupo conciliado · ${trans.length}</h4>
                        <span class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            TSD ${trazaMonto(suma(tsd))} · Bancos ${trazaMonto(suma(bancos))} · Dif ${trazaMonto(suma(tsd) - suma(bancos))}
                        </span>
                    </div>
                    <div class="flex flex-col gap-0.5">${filas}</div>
                </section>`;
        }

        function trazaDepositosHtml(pagado, t) {
            const idMatch = t.maestra.IdMatch;
            const deps = (pagado || []).filter(p => !trazaVacio(idMatch) && p.IdMatch === idMatch);
            if (!deps.length) return '';
            const filas = deps.map(p => `
                <div class="flex justify-between gap-3 text-xs py-1">
                    <span class="min-w-0 truncate text-slate-600 dark:text-slate-300">
                        <span class="font-mono">${trazaEsc(trazaFecha(p.BacFecha || p.ScoFecha, false))}</span>
                        · ${trazaEsc(p.BacDesc || p.ScoDesc || '-')}
                    </span>
                    <span class="font-mono font-bold shrink-0">${trazaMonto(p.MontoBruto)}</span>
                </div>`).join('');
            return `
                <section class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <h4 class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Depósito del banco</h4>
                    ${filas}
                </section>`;
        }

        // Todas las columnas, para auditoría
        function trazaTablaHtml(titulo, fila) {
            if (!fila) return '';
            const celdas = Object.keys(fila).map(k => {
                let v = fila[k];
                if (k === 'EvidenciaB64' && !trazaVacio(v)) v = '(imagen)';
                return `
                    <div class="min-w-0 py-1 border-b border-slate-100 dark:border-slate-700/60">
                        <div class="text-[10px] text-slate-400">${trazaEsc(k)}</div>
                        <div class="font-mono text-[11px] text-slate-700 dark:text-slate-200 break-all">${trazaVacio(v) ? '-' : trazaEsc(v)}</div>
                    </div>`;
            }).join('');
            return `
                <div class="mb-3">
                    <div class="text-[11px] font-bold text-slate-500 dark:text-slate-300 mb-1">${trazaEsc(titulo)}</div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-4">${celdas}</div>
                </div>`;
        }

        function trazaDatosHtml(t) {
            return `
                <details class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 group">
                    <summary class="cursor-pointer select-none text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        Datos completos
                    </summary>
                    <div class="mt-3">
                        ${trazaTablaHtml('Tbl_Transacciones_Maestra', t.maestra)}
                        ${trazaTablaHtml(t.tablaDetalle || 'Detalle', t.detalle)}
                        ${trazaTablaHtml('Tbl_Ajustes_Auditoria', t.auditoria)}
                        ${trazaTablaHtml('Tbl_Conciliacion_Cierres', t.cierre)}
                    </div>
                </details>`;
        }

        function pintarTraza(idSel) {
            const datos = traza.datos;
            if (!datos) return;
            const t = datos.transacciones.find(x => x.IdTransaccion === String(idSel)) || datos.transacciones[0];

            document.getElementById('traza-cabecera').innerHTML = trazaCabeceraHtml(t);
            document.getElementById('traza-cuerpo').innerHTML =
                (datos.transacciones.length > 1 ? trazaGrupoHtml(datos.transacciones, t.IdTransaccion) : '') +
                trazaRecorridoHtml(t) +
                trazaDepositosHtml(datos.pagado, t) +
                trazaDatosHtml(t);
        }

        async function abrirTraza(llave) {
            const modal = trazaModal();
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            const cuerpo = document.getElementById('traza-cuerpo');
            document.getElementById('traza-cabecera').innerHTML = trazaCabeceraHtml(null);
            cuerpo.innerHTML = '<div class="py-12 text-center text-xs text-slate-400 animate-pulse">Buscando la transacción…</div>';

            const mia = ++traza.peticion;
            try {
                const res = await fetch('api/get_traza_transaccion.php?' + new URLSearchParams(llave).toString(), { cache: 'no-store' });
                const json = await res.json();
                if (mia !== traza.peticion) return;
                if (!json.success) throw new Error(json.error || 'Respuesta inválida');

                if (!json.encontrada) {
                    cuerpo.innerHTML = `
                        <div class="py-10 text-center">
                            <div class="text-3xl mb-2" aria-hidden="true">🔎</div>
                            <div class="font-bold text-slate-700 dark:text-white">Todavía no está en IRI</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">Aparecerá aquí cuando se consolide o se concilie.</div>
                        </div>`;
                    return;
                }

                traza.datos = json;
                const semilla = json.transacciones.find(t => t.EsSemilla) || json.transacciones[0];
                pintarTraza(semilla.IdTransaccion);
            } catch (e) {
                if (mia !== traza.peticion) return;
                cuerpo.innerHTML = `<div class="py-10 text-center text-xs font-bold text-red-600">No se pudo consultar la transacción: ${trazaEsc(e.message)}</div>`;
            }
        }

        document.addEventListener('DOMContentLoaded', startSequentialLoading);
    </script>
</body>
</html>