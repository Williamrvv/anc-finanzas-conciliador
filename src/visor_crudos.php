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
    <title>Visor de Datos Crudos - IRI</title>
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
    </style>
</head>
<body class="bg-slate-100 dark:bg-slate-900 h-screen w-screen flex flex-col font-sans">
    
    <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-wrap justify-between items-center shrink-0 shadow-sm z-20">
        <div class="flex items-center gap-4">
            <div class="bg-blue-600 text-white p-2 rounded-lg shadow-md">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            </div>
            <div>
                <h1 class="text-xl font-black text-slate-800 dark:text-white leading-tight">Visor Detallado de Transacciones</h1>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium"><?php echo $ctx === 'm4' ? "Historial consolidado por fecha de folio: $start al $end" : "Filtro TSD: $start al $end | Bancos: Folios Pendientes"; ?></p>
            </div>
        </div>
        
        <div class="flex items-center gap-4 mt-4 lg:mt-0">
            <!-- Inputs Ocultos para engañar a VanillaGrid y usar su motor nativo -->
            <input type="hidden" id="search-bac">
            <input type="hidden" id="search-scotia">
            <input type="hidden" id="search-tsd">
            <input type="hidden" id="search-historico">

            <div class="relative">
                <!-- Se cambia oninput por syncSearch -->
                <input type="text" id="global-search" placeholder="Buscar en tabla actual..." oninput="syncSearch(this.value)"
                    class="pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-64 shadow-inner text-slate-700 dark:text-white transition-all font-medium">
                <svg class="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            
            <div id="historico-controls" class="hidden items-center gap-2">
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">Estado al:</span>
                <input type="date" id="historico-fecha" value="<?php echo $historicoDefault; ?>" onchange="loadHistorico(this.value)"
                    class="px-3 py-2 text-sm font-bold bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-white">
                <span id="historico-resumen" class="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap"></span>
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

            <div id="grid-historico" class="w-full h-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden hidden relative"></div>
        </div>
    </main>

    <script src="js/vanilla_grid.js"></script>
    <script>
        let rawData = { bac: null, scotia: null, tsd: null, historico: null };
        let grids = { bac: null, scotia: null, tsd: null, historico: null };
        let currentActiveTab = 'bac'; // Empezamos en BAC porque es el primero en cargar

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

        async function fetchSource(sourceName) {
            document.getElementById(`spin-${sourceName}`).classList.remove('hidden');
            try {
                const res = await fetch(`api/get_crudos_m3.php?start=<?php echo $start; ?>&end=<?php echo $end; ?>&source=${SOURCE_MAP[sourceName]}`);
                const json = await res.json();
                if (!json.success) throw new Error(json.error);
                
                rawData[sourceName] = json.data;
                
                // Si el usuario ya estaba en esta pestaña esperándola, pintarla de inmediato
                if (currentActiveTab === sourceName) {
                    renderGrid(sourceName);
                }
            } catch (e) {
                alert(`Error en ${sourceName.toUpperCase()}: ` + e.message);
            } finally {
                document.getElementById(`spin-${sourceName}`).classList.add('hidden');
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

                const monto = new Intl.NumberFormat('es-CR', {
                    style: 'currency',
                    currency: 'CRC',
                    maximumFractionDigits: 0
                }).format(json.summary.montoPendiente || 0);

                const resumen = document.getElementById('historico-resumen');
                if (resumen) {
                    resumen.textContent = `${json.summary.pendientes} pendientes · ${json.summary.conciliados} conciliados · ${monto}`;
                }

                const gridDiv = document.getElementById('grid-historico');
                if (gridDiv) gridDiv.innerHTML = '';

                grids.historico = null;

                if (currentActiveTab === 'historico') {
                    renderGrid('historico');
                }

            } catch (e) {
                alert('Error en HISTÓRICO AUXILIAR: ' + e.message);
            } finally {
                if (spinner) spinner.classList.add('hidden');
            }
        }

        async function startSequentialLoading() {
            // 1. CARGA BAC (Rápido)
            await fetchSource('bac');
            
            // Ocultar Overlay Principal y mostrar BAC inmediatamente
            const loader = document.getElementById('loader-main');
            loader.classList.add('opacity-0');
            setTimeout(() => loader.style.display = 'none', 300);
            renderGrid('bac');

            // 2. CARGA SCOTIA (De fondo)
            await fetchSource('scotia');
            
            // 3. CARGA TSD (De fondo)
            await fetchSource('tsd');
        }

        function renderGrid(tab) {
            if (rawData[tab] && !grids[tab]) {
                const waitScreen = document.getElementById(`wait-${tab}`);
                if(waitScreen) waitScreen.style.display = 'none';
                
                requestAnimationFrame(() => {
                    grids[tab] = new VanillaGrid(`#grid-${tab}`, rawData[tab], autoGenerateColumns(rawData[tab]), { 
                        threshold: 0,
                        resize: false, // Desactiva la barra de arrastre inferior nativa de VanillaGrid
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

            // 1. Limpiar el buscador visual global 
            const globalSearch = document.getElementById('global-search');
            if (globalSearch) globalSearch.value = '';

            ['bac', 'scotia', 'tsd', 'historico'].forEach(t => {
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