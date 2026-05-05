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
            <div class="flex flex-col px-3 relative">
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Rango de Fechas</span>
                <div class="flex items-center gap-2 border-b border-slate-300 dark:border-slate-600 pb-1">
                    <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <input type="text" id="tsd-date-picker" class="bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer w-48 text-center" placeholder="Seleccione fechas...">
                </div>
            </div>
            
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <!-- Alerta de Diferencia Visual -->
            <div class="flex flex-col px-3 relative">
                <span class="text-[10px] font-bold text-slate-400 uppercase mb-0.5" title="Resaltar diferencias mayores o iguales a este monto">Alerta Dif. (₡)</span>
                <div class="flex items-center gap-1 border-b border-slate-300 dark:border-slate-600 pb-1">
                    <span class="text-red-500 font-bold text-xs">≥</span>
                    <input type="number" id="tsd-threshold" value="10000" min="0" step="1" oninput="window.TSDLogic.updateThreshold()" class="bg-transparent text-sm font-bold text-red-600 dark:text-red-400 outline-none w-20 text-center">
                </div>
            </div>
            
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

            <!-- Botón Visor PopUp -->
            <button type="button" onclick="window.TSDLogic.openRawViewer()" class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2 border border-slate-200 dark:border-slate-600">
                <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                Visor datos crudos
            </button>
            
            <div class="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
            
            <button id="btn-run-match" onclick="window.TSDLogic.fetchAndMatch()" class="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold text-sm transition-all shadow-md shadow-purple-500/20 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Ejecutar Cruce
            </button>
        </div>
    </div>

    <div class="flex justify-between items-center mb-3 shrink-0">
        <!-- Leyenda de Colores con Contadores -->
        <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
            <span class="text-slate-500 dark:text-slate-400 ml-2">Simbología:</span>
            
            <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <span class="w-3 h-3 rounded-full bg-[#fce4d6] dark:bg-[#7c6f69] border border-slate-300 dark:border-slate-600"></span> 
                Auth <span id="count-auth" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5">0</span>
            </div>
            <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <span class="w-3 h-3 rounded-full bg-[#ddebf7] dark:bg-[#1e3a8a] border border-slate-300 dark:border-slate-600"></span> 
                Tarjeta <span id="count-tarjeta" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5">0</span>
            </div>
            <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <span class="w-3 h-3 rounded-full bg-[#ffe699] dark:bg-[#655b3d] border border-slate-300 dark:border-slate-600"></span> 
                Sugerencia <span id="count-sugerencia" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5">0</span>
            </div>
            <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <span class="w-3 h-3 rounded-full bg-[#d9d9d9] dark:bg-[#262626] border border-slate-300 dark:border-slate-600"></span> 
                Negativos <span id="count-negativos" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5">0</span>
            </div>
            <div class="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                <span class="w-3 h-3 rounded-full bg-[#ffe699] dark:bg-[#b2a06b] border border-slate-300 dark:border-slate-600"></span> 
                Manual <span id="count-manual" class="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-0.5">0</span>
            </div>
        </div>

        <button id="btn-ingestar-tarjetas" onclick="window.TSDLogic.openCardModal()" class="bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-bold text-xs transition-colors border border-blue-200 dark:border-slate-600 shadow-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
            Ingestar Histórico Tarjetas
        </button>
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
            <div class="bg-blue-50 dark:bg-blue-900/40 border-b border-blue-200 dark:border-blue-800 px-4 py-2 flex items-center gap-2 shrink-0">
                <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                <h3 class="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">Resultados Conciliados (Match Exitoso)</h3>
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