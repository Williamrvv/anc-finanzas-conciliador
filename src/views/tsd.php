<div class="animate-fade-in-up flex flex-col min-h-screen pb-12">
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
            <div class="flex flex-col px-3 relative group">
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Rango de Fechas</span>
                <!-- Contenedor con Gradiente Animado Oculto -->
                <div id="tsd-date-wrapper" class="relative flex items-center gap-2 pb-1 transition-all overflow-hidden">
                    <div id="tsd-date-loader" class="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-0 translate-x-[-100%] transition-opacity duration-300"></div>
                    <div class="absolute bottom-0 left-0 h-[1px] w-full bg-slate-300 dark:bg-slate-600"></div>
                    
                    <svg class="w-4 h-4 text-purple-500 z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <input type="text" id="tsd-date-picker" class="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer w-48 text-center z-10" placeholder="Seleccione fechas...">
                </div>
            </div>
            
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

            <!-- Menú Desplegable: Cargadores ERP -->
            <div class="relative group">
                <button type="button" class="bg-transparent text-slate-600 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 px-3 py-2 rounded-lg font-bold text-sm transition-colors flex items-center gap-1.5 border border-transparent hover:border-green-200 dark:hover:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    Cargadores Softland
                    <svg class="w-3 h-3 ml-0.5 group-hover:rotate-180 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                
                <!-- Opciones del Menú -->
                <div class="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-top-right scale-95 group-hover:scale-100">
                    <div class="py-1">
                        <button onclick="window.TSDLogic.exportSoftland('tarjetas')" class="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Tarjetas
                        </button>
                        <div class="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        <button onclick="window.TSDLogic.exportSoftland('bac_176')" class="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> BAC 1,76% (Renta)
                        </button>
                        <button onclick="window.TSDLogic.exportSoftland('bac_536')" class="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> BAC 5,36% (Ventas)
                        </button>
                        <div class="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                        <button onclick="window.TSDLogic.exportSoftland('davi_2')" class="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Davibank 2% (Comisión)
                        </button>
                        <button onclick="window.TSDLogic.exportSoftland('davi_5')" class="w-full text-left px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Davibank 5% (IVA)
                        </button>
                    </div>
                </div>
            </div>

            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <!-- Botón Visor PopUp -->
            <button type="button" onclick="window.TSDLogic.openRawViewer()" class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border border-slate-200 dark:border-slate-600">
                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                Visor Crudos
            </button>

            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <button id="btn-save-tsd" onclick="window.TSDLogic.saveTSDCierre()" class="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-black text-xs transition-all shadow-md shadow-purple-500/30 flex items-center gap-2 shrink-0 hover:scale-105">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                GUARDAR CONSOLIDADO TSD
            </button>
        </div>
    </div>

    <!-- Estilos en línea para la animación del borde infinito -->
    <style>
        @keyframes slide-infinite {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        .animate-slide-infinite { animation: slide-infinite 1.5s infinite linear; }
    </style>

    <div class="flex flex-col gap-3 mb-3 shrink-0 w-full">
        
        <!-- FILA 1: Métrica Superior y Botón de Acción -->
        <div class="flex justify-between items-end w-full">
            <!-- Panel de Métricas y Micro-Gráficos -->
            <div class="inline-flex flex-col bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors w-fit shrink-0">
                <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <span class="text-slate-500 dark:text-slate-400 ml-1">Métricas de Cruce:</span>
                    
                    <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span class="w-2.5 h-2.5 rounded-sm bg-[#fce4d6] dark:bg-[#7c6f69] border border-slate-300 dark:border-slate-600"></span> 
                        Auth: <span id="count-auth" class="text-slate-800 dark:text-white ml-0.5">0</span>
                    </div>
                    <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span class="w-2.5 h-2.5 rounded-sm bg-[#ddebf7] dark:bg-[#1e3a8a] border border-slate-300 dark:border-slate-600"></span> 
                        Tarj: <span id="count-tarjeta" class="text-slate-800 dark:text-white ml-0.5">0</span>
                    </div>
                    <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span class="w-2.5 h-2.5 rounded-sm bg-[#ffe699] dark:bg-[#b2a06b] border border-slate-300 dark:border-slate-600"></span> 
                        Man: <span id="count-manual" class="text-slate-800 dark:text-white ml-0.5">0</span>
                    </div>
                    <div class="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                    <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                        <span class="w-2.5 h-2.5 rounded-sm bg-[#fef08a] dark:bg-[#854d0e] border border-slate-300 dark:border-slate-600"></span> 
                        Sug: <span id="count-sugerencia" class="text-slate-800 dark:text-white ml-0.5">0</span>
                    </div>
                    <div class="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                    <div class="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        No Concil: <span id="count-noc" class="font-black ml-0.5">0</span>
                    </div>
                </div>
                <!-- Barra de Progreso Stacked (Micro-Chart) con Tooltips CSS -->
                <div class="w-full h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full flex overflow-visible shadow-inner relative">
                    <div id="bar-auth" class="h-full bg-[#fce4d6] dark:bg-[#7c6f69] transition-all duration-500 group relative cursor-pointer" style="width: 0%">
                        <span id="tt-auth" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">0%</span>
                    </div>
                    <div id="bar-tarj" class="h-full bg-[#ddebf7] dark:bg-[#1e3a8a] transition-all duration-500 group relative cursor-pointer" style="width: 0%">
                        <span id="tt-tarj" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">0%</span>
                    </div>
                    <div id="bar-man" class="h-full bg-[#ffe699] dark:bg-[#b2a06b] transition-all duration-500 group relative cursor-pointer" style="width: 0%">
                        <span id="tt-man" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">0%</span>
                    </div>
                    <div id="bar-sug" class="h-full bg-[#fef08a] dark:bg-[#854d0e] transition-all duration-500 group relative cursor-pointer" style="width: 0%">
                        <span id="tt-sug" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">0%</span>
                    </div>
                    <div id="bar-noc" class="h-full bg-red-400 dark:bg-red-600 transition-all duration-500 group relative cursor-pointer rounded-r-full" style="width: 0%">
                        <span id="tt-noc" class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-2 py-1 rounded text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg z-50">0%</span>
                    </div>
                </div>
            </div>

            <button id="btn-ingestar-tarjetas" onclick="window.TSDLogic.openCardModal()" class="bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-bold text-xs transition-colors border border-blue-200 dark:border-slate-600 shadow-sm flex items-center gap-2 shrink-0 h-fit mb-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
            Ingestar Histórico Tarjetas
            </button>

            <!-- (El botón de Guardar fue movido a la cabecera) -->
        </div>

        <!-- FILA 2: PANEL DE RESUMEN FINANCIERO -->
        <div class="w-full bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap lg:flex-nowrap gap-6 overflow-x-auto items-center">
            
            <!-- Bloque TSD -->
            <div class="flex flex-col min-w-[180px] border-r border-slate-200 dark:border-slate-700 pr-6 shrink-0">
                <span class="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span class="w-2 h-2 bg-purple-500 rounded-full shadow-sm"></span> Sist. TSD
                </span>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold text-slate-400">Total USD:</span>
                    <span id="dash-tsd-usd" class="font-mono text-sm font-black text-slate-800 dark:text-white ml-auto">$0.00</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-400">Total CRC:</span>
                    <span id="dash-tsd-crc" class="font-mono text-sm font-black text-slate-800 dark:text-white ml-auto">₡0.00</span>
                </div>
            </div>

            <!-- Bloque BAC -->
            <div class="flex flex-col flex-1 border-r border-slate-200 dark:border-slate-700 pr-6 shrink-0 min-w-[340px]">
                <span class="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span class="w-2 h-2 bg-red-500 rounded-full shadow-sm"></span> BAC Credomatic
                </span>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Bruto:</span> <span id="dash-bac-bruto" class="font-mono text-xs font-bold text-slate-800 dark:text-white ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Comisión:</span> <span id="dash-bac-com" class="font-mono text-xs font-bold text-red-500 dark:text-red-400 ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Ret. Venta:</span> <span id="dash-bac-retv" class="font-mono text-xs font-bold text-red-500 dark:text-red-400 ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Neto:</span> <span id="dash-bac-neto" class="font-mono text-sm font-black text-green-600 dark:text-green-500 ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Ret. Renta:</span> <span id="dash-bac-retr" class="font-mono text-xs font-bold text-red-500 dark:text-red-400 ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">ACI:</span> <span id="dash-bac-aci" class="font-mono text-xs font-bold text-red-500 dark:text-red-400 ml-auto">₡0.00</span></div>
                </div>
            </div>

            <!-- Bloque Davibank -->
            <div class="flex flex-col flex-1 border-r border-slate-200 dark:border-slate-700 pr-6 shrink-0 min-w-[340px]">
                <span class="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span class="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></span> Davibank
                </span>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Bruto:</span> <span id="dash-davi-bruto" class="font-mono text-xs font-bold text-slate-800 dark:text-white ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Comisión:</span> <span id="dash-davi-com" class="font-mono text-xs font-bold text-red-500 dark:text-red-400 ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Ret. IVA:</span> <span id="dash-davi-retv" class="font-mono text-xs font-bold text-red-500 dark:text-red-400 ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Neto:</span> <span id="dash-davi-neto" class="font-mono text-sm font-black text-green-600 dark:text-green-500 ml-auto">₡0.00</span></div>
                    <div class="flex items-center gap-2"><span class="text-[11px] font-bold text-slate-400">Ret. ISR:</span> <span id="dash-davi-retr" class="font-mono text-xs font-bold text-red-500 dark:text-red-400 ml-auto">₡0.00</span></div>
                </div>
            </div>

            <!-- Gran Total Bancos -->
            <div class="flex flex-col min-w-[180px] shrink-0 pl-2">
                <span class="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg> 
                    Total Bancos
                </span>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-bold text-slate-400">Bruto:</span> 
                    <span id="dash-tot-bruto" class="font-mono text-[15px] font-black text-slate-800 dark:text-white ml-auto">₡0.00</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-400">Neto:</span> 
                    <span id="dash-tot-neto" class="font-mono text-[15px] font-black text-green-600 dark:text-green-500 ml-auto">₡0.00</span>
                </div>
            </div>

        </div>
    </div>

    <!-- Modal de Carga de Tarjetas -->
    <div id="modal-cards-tsd" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] hidden flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col animate-fade-in-up">
            <div class="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                <h3 class="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span class="text-blue-600">💳</span> Cargar Histórico de Tarjetas
                </h3>
                <button onclick="document.getElementById('modal-cards-tsd').classList.add('hidden')" class="text-slate-400 hover:text-red-500 font-bold">✖</button>
            </div>
            <div class="p-4 space-y-4">
                
                <!-- Opción Individual -->
                <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Ingreso Individual</span>
                    <div class="flex gap-2">
                        <input type="text" id="single-contrato" placeholder="N° Contrato" class="w-1/2 p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-shadow">
                        <input type="text" id="single-tarjeta" placeholder="Últimos 4 (Ej: 0377)" maxlength="4" class="w-1/2 p-2 text-sm border rounded-lg dark:bg-slate-800 dark:border-slate-600 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-shadow font-mono">
                    </div>
                </div>

                <div class="flex items-center gap-2 opacity-50">
                    <div class="h-px bg-slate-300 dark:bg-slate-600 flex-grow"></div>
                    <span class="text-[10px] font-bold uppercase text-slate-500">O MASIVO</span>
                    <div class="h-px bg-slate-300 dark:bg-slate-600 flex-grow"></div>
                </div>

                <!-- Opción Masiva -->
                <div>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Carga Masiva (Pegar desde Excel)</span>
                    <textarea id="paste-zone-cards" class="w-full h-24 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 whitespace-pre text-nowrap" placeholder="Ejemplo:&#10;123456    XXXXXXXX0377&#10;123457    XXXXXXXX1234"></textarea>
                </div>

            </div>
            <div class="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                <button onclick="window.TSDLogic.processCardPaste()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-md transition-colors flex items-center gap-2">
                    Aplicar y Guardar
                </button>
            </div>
        </div>
    </div>

    <!-- Área Superior: Buscador Global de este Módulo -->
    <div class="flex justify-end mb-2 shrink-0">
        <div class="relative">
            <input type="text" id="search-tsd" placeholder="Filtrar resultados en ambas tablas..." 
                class="pl-8 pr-4 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-72 shadow-sm text-slate-700 dark:text-white">
            <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
    </div>

    <!-- Contenedor general sin restricciones de altura -->
    <div class="flex flex-col gap-8 w-full mt-2">
        
        <!-- TABLA 1: RESULTADOS CONCILIADOS (Éxitos) -->
        <div class="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="bg-blue-50 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 px-4 py-2 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                    <h3 class="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">Resultados Conciliados (Match Exitoso)</h3>
                </div>
                
                <div class="flex items-center gap-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded shadow-sm">
                    <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase" title="Resaltar en rojo las filas cuya diferencia sea igual o mayor">Alerta de Diferencia ≥</span>
                    <div class="flex items-center border-b border-blue-300 dark:border-blue-600">
                        <span class="text-red-500 font-bold text-xs mr-0.5">₡</span>
                        <input type="number" id="tsd-threshold" value="10000" min="0" step="1" oninput="window.TSDLogic.updateThreshold()" class="bg-transparent text-xs font-bold text-red-600 dark:text-red-400 outline-none w-16 text-center">
                    </div>
                </div>
            </div>
            <!-- Altura inicial definida en style, VanillaGrid la ajustará desde ahí -->
            <div id="table-matched-tsd" style="height: 500px;" class="w-full relative border-none">
                <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50 z-0">
                    <span class="text-sm font-medium">Ejecute el cruce para ver resultados.</span>
                </div>
            </div>
        </div>

        <!-- TABLA 2: EXCEPCIONES Y PENDIENTES (Huérfanos) -->
        <div class="flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="bg-orange-50 dark:bg-orange-900/30 border-b border-orange-200 dark:border-orange-800 px-4 py-2 flex justify-between items-center shrink-0">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h3 class="text-xs font-black text-orange-700 dark:text-orange-400 uppercase tracking-wider">Excepciones y Pendientes (No Conciliado)</h3>
                </div>
                <span class="text-[10px] text-orange-600 dark:text-orange-500 font-medium">Doble clic para analizar</span>
            </div>
            <!-- Altura inicial definida en style -->
            <div id="table-pending-tsd" style="height: 400px;" class="w-full relative border-none">
                <!-- Se inyecta via JS -->
            </div>
        </div>

    </div>
</div>