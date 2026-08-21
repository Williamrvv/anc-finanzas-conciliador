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

            <div id="grid-historico" class="w-full h-full hidden relative">
                <div class="w-full h-full flex flex-col gap-3">

                    <section class="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-amber-200 dark:border-amber-900 overflow-hidden">
                        <div class="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900 flex items-center justify-between shrink-0">
                            <div>
                                <h3 class="text-sm font-black text-amber-800 dark:text-amber-300">Pendientes al cierre</h3>
                                <p class="text-[10px] text-slate-500 dark:text-slate-400">Transacciones que permanecían abiertas al finalizar el día seleccionado.</p>
                            </div>
                            <span id="historico-count-pendientes" class="px-2.5 py-1 text-xs font-black rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">0</span>
                        </div>
                        <div id="grid-historico-pendientes" class="w-full flex-1 min-h-0"></div>
                    </section>

                    <section class="flex-1 min-h-0 flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-900 overflow-hidden">
                        <div class="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900 flex items-center justify-between shrink-0">
                            <div>
                                <h3 class="text-sm font-black text-emerald-800 dark:text-emerald-300">Conciliados ese día</h3>
                                <p class="text-[10px] text-slate-500 dark:text-slate-400">Cruces registrados contablemente en la fecha seleccionada.</p>
                            </div>
                            <span id="historico-count-conciliados" class="px-2.5 py-1 text-xs font-black rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">0</span>
                        </div>
                        <div id="grid-historico-conciliados" class="w-full flex-1 min-h-0"></div>
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
            historico: null,
            historicoPendientes: [],
            historicoConciliados: []
        };

        let grids = {
            bac: null,
            scotia: null,
            tsd: null,
            historico: null,
            historicoPendientes: null,
            historicoConciliados: null
        };
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
                    Diferencia: historicoDiferencia(montoTSD, montoBanco),
                    Antiguedad: antiguedades.length ? Math.max(...antiguedades) : '-'
                };
            });
        }

        function historicoColumns() {
            const fmtMoney = value => new Intl.NumberFormat('es-CR', {
                style: 'currency',
                currency: 'CRC'
            }).format(parseFloat(value) || 0).replace(/\./g, ' ');

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
                    title: "Monto TSD / Detalle",
                    field: "MontoTSD",
                    width: 150,
                    hozAlign: "right",
                    bottomCalc: "sum",
                    formatter: (cell) => {
                        const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                        const valor = val && typeof val === 'object' && 'valor' in val ? val.valor : val;
                        const recibo = val && typeof val === 'object' && 'recibo' in val ? val.recibo : '';
                        const recHtml = recibo
                            ? `<div class="text-[9px] text-orange-600 dark:text-orange-400 italic truncate font-medium mt-0.5" title="${recibo}">${recibo}</div>`
                            : '';

                        return `<div class="flex flex-col justify-center items-end h-full"><span class="font-bold text-slate-800 dark:text-slate-200">${fmtMoney(valor)}</span>${recHtml}</div>`;
                    }
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
                    title: "Monto",
                    field: "Banco_Monto",
                    width: 130,
                    hozAlign: "right",
                    formatter: "money",
                    bottomCalc: "sum",
                    cssClass: "font-bold"
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
            const pendientes = rawData.historicoPendientes || [];
            const conciliados = rawData.historicoConciliados || [];
            const columns = historicoColumns();

            if (grids.historicoPendientes) {
                grids.historicoPendientes.updateData(pendientes);
            } else {
                grids.historicoPendientes = new VanillaGrid(
                    '#grid-historico-pendientes',
                    pendientes,
                    columns,
                    {
                        threshold: 0,
                        // Sin 'resize: false' el grid muestra la barra de arrastre
                        // inferior y se puede estirar, igual que en el auxiliar.
                        searchInputId: 'search-historico'
                    }
                );
            }

            if (grids.historicoConciliados) {
                grids.historicoConciliados.updateData(conciliados);
            } else {
                grids.historicoConciliados = new VanillaGrid(
                    '#grid-historico-conciliados',
                    conciliados,
                    historicoColumns(),
                    {
                        threshold: 0,
                        searchInputId: 'search-historico'
                    }
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
            if (tab === 'historico') {
                if (rawData.historico !== null) {
                    renderHistoricoGrids();
                }
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