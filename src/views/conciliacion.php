<div class="flex flex-col min-h-full" id="conciliacion-module">
    
    <!-- HEADER GLOBAL -->
    <header class="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div class="flex items-center gap-6">
            <h1 class="text-xl font-bold text-slate-900 dark:text-white">Conciliación Bancaria</h1>
            <!-- TABS -->
            <nav class="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button onclick="window.ConciliacionFunctions.switchTab('bac')" id="tab-bac" class="px-4 py-1.5 text-sm font-bold rounded shadow bg-white text-red-600 dark:bg-slate-700 dark:text-white transition-all">BAC Credomatic</button>
                <button onclick="window.ConciliacionFunctions.switchTab('scotia')" id="tab-scotia" class="px-4 py-1.5 text-sm font-medium rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-all">Scotiabank</button>
                <button onclick="window.ConciliacionFunctions.switchTab('tsd')" id="tab-tsd" class="px-4 py-1.5 text-sm font-medium rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-all">
                    Consolidado TSD
                </button>
            </nav>
        </div>
        <div class="flex items-center gap-3">
            <input type="date" id="process-date" class="bg-slate-100 dark:bg-slate-700 border-none rounded text-xs font-bold py-1 px-2 text-slate-700 dark:text-white" value="<?php echo date('Y-m-d'); ?>">
        </div>
    </header>

    <!-- ÁREA DE CONTENIDO -->
    <div class="flex-grow relative mt-2">
        
        <!-- ==================== WORKSPACE BAC ==================== -->
         <!-- Instrucciones -->
        <div class="text-left pb-2">
            <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">
                <span class="inline-block animate-bounce mr-1">👇</span>
                Arrastra los documentos del banco para iniciar la consolidación automática
            </p>
        </div>
        <div id="workspace-bac" class="flex flex-col h-full gap-4">
            
            <!-- PANEL DE CONTROL BAC -->
            <div class="grid grid-cols-12 gap-3 h-32 shrink-0">
                
                <!-- 1. Drop Detalle (2 Cols) -->
                <div id="drop-bac-detalle" class="col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-red-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 transition-all group shadow-sm relative z-50">
                    <svg class="w-8 h-8 text-slate-300 group-hover:text-red-500 mb-1 transition-colors pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 9h1.5a1.5 1.5 0 010 3H10m0 3h.5a.5.5 0 00.5-.5V9"></path></svg>
                    <span class="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 uppercase text-center leading-tight pointer-events-none">Arrastra<br>Detallado BAC</span>
                    <input type="file" id="file-bac-detalle" class="hidden pointer-events-auto" accept=".csv">
                    <span id="status-bac-detalle" class="text-[9px] text-slate-400 truncate w-full px-1 mt-1 hidden"></span>
                </div>

                <!-- 2. Tarjeta Detalle (6 Cols - AHORA MÁS ANCHA) -->
                <div id="card-bac-detalle" class="col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg p-2 relative hidden shadow-sm group transition-all overflow-hidden" onclick="window.ConciliacionFunctions.openPopup('detalle')">
                    <button onclick="event.stopPropagation(); window.ConciliacionFunctions.openPopup('detalle')" class="absolute top-1 right-1 p-1 text-slate-400 hover:text-blue-600 opacity-50 group-hover:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-800/80 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <!-- Contenedor con Scroll Horizontal -->
                    <div class="overflow-x-auto h-full w-full">
                        <div id="bac-summary-container" class="h-full flex items-center min-w-[450px] w-full"></div>
                    </div>
                </div>

                <!-- 3. Drop Pagado (2 Cols) -->
                <div id="drop-bac-pagado" class="col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-green-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 transition-all group shadow-sm relative z-50">
                    <svg class="w-8 h-8 text-slate-300 group-hover:text-green-500 mb-1 transition-colors pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 9l-3 6m0-6l3 6"></path></svg>
                    <span class="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 uppercase text-center leading-tight pointer-events-none">Arrastra<br>Pagado BAC</span>
                    <input type="file" id="file-bac-pagado" class="hidden pointer-events-auto" accept=".xlsx, .xls">
                    <span id="status-bac-pagado" class="text-[9px] text-slate-400 truncate w-full px-1 mt-1 hidden"></span>
                </div>

                <!-- 4. Tarjeta Pagado (2 Cols) -->
                <div id="card-bac-pagado" class="col-span-2 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 hover:border-green-400 dark:hover:border-green-500 rounded-lg p-2 flex flex-col justify-center items-center relative hidden shadow-sm group transition-all cursor-pointer" onclick="window.ConciliacionFunctions.openPopup('pagado')">
                    <button onclick="event.stopPropagation(); window.ConciliacionFunctions.openPopup('pagado')" class="absolute top-1 right-1 p-1 text-green-600/50 hover:text-green-600 opacity-50 group-hover:opacity-100 transition-opacity z-10 bg-green-50/80 dark:bg-green-900/80 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <span class="text-[10px] text-green-600 uppercase font-bold tracking-wider mb-1 text-center leading-tight">Total Banco<br>(TF)</span>
                    <span id="sum-depositos" class="text-xl font-bold text-green-700 dark:text-green-400 font-mono">0</span>
                </div> 
            </div>

            <!-- Tabla Central BAC -->
            <!-- ÁREA CENTRAL (Scroll Page) -->
            <div class="flex flex-col gap-6">
                
                <!-- TABLA CENTRAL BAC (Altura Mínima 600px) -->
                <div class="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden h-[600px] shrink-0">
                    <!-- Toolbar -->
                    <div class="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <span class="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> Resultados BAC
                        </span>
                        
                        <div class="flex items-center gap-3">
                            <!-- Umbral BAC (Restaurado) -->
                            <div class="flex items-center bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 px-2 py-1">
                                <span class="text-[10px] font-bold text-slate-400 mr-2 uppercase">Diff Max:</span>
                                <span class="text-slate-400 font-bold text-xs mr-1">₡</span>
                                <input type="number" id="threshold-bac" value="2000" step="500" 
                                       oninput="window.ConciliacionFunctions.updateThreshold(this.value, 'bac')" 
                                       class="w-16 bg-transparent border-none text-xs font-bold text-right outline-none p-0 text-slate-700 dark:text-white">
                            </div>

                            <!-- Buscador BAC -->
                            <div class="relative w-64">
                                <input type="text" id="search-bac" class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600" placeholder="Filtrar resultados...">
                                <div class="absolute inset-y-0 left-0 flex items-center justify-center w-8 pointer-events-none text-slate-400">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Grid -->
                    <div id="table-result-bac" class="flex-grow overflow-hidden relative">
                        <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                            <span class="text-xs">Esperando archivos BAC...</span>
                        </div>
                    </div>
                </div>

                <!-- TABLA DE EXCEPCIONES BAC -->
                <div id="audit-bac" class="flex flex-col gap-2 mt-4 hidden">
                    <div class="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-t-lg flex justify-between items-center">
                        <h4 class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Excepciones y Pendientes (No Conciliado)
                        </h4>
                        <span class="text-[10px] text-orange-600 dark:text-orange-300">Doble clic para analizar</span>
                    </div>
                    
                    <!-- Contenedor Grid Excepciones -->
                    <div id="table-exceptions-bac" class="h-[300px] border border-orange-200 dark:border-orange-800 rounded-b-lg overflow-hidden shadow-sm"></div>
                </div>
                <!-- TABLA DIFERIDOS (SALDOS ARRASTRADOS) -->
                <div id="audit-deferred-bac" class="flex flex-col gap-2 mt-4 hidden">
                    <div class="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-t-lg flex justify-between items-center">
                        <h4 class="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Saldos Pendientes (Diferidos para Futuro)
                        </h4>
                    </div>
                    <div id="table-deferred-bac" class="h-[200px] border border-blue-200 dark:border-blue-800 rounded-b-lg overflow-hidden shadow-sm"></div>
                </div>

                <!-- TABLA CONCILIACIONES MANUALES -->
                <div id="audit-manual-bac" class="flex flex-col gap-2 mt-4 hidden group/manual">
                    <div class="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-t-lg flex justify-between items-center">
                        <h4 class="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Historial de Conciliaciones Manuales
                        </h4>
                        <span class="text-[10px] text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-800 px-2 py-0.5 rounded-full font-bold shadow-sm">
                            Registros Ajustados por Usuario
                        </span>
                    </div>
                    <div id="table-manual-bac" class="h-[250px] border border-purple-200 dark:border-purple-800 rounded-b-lg overflow-hidden shadow-sm"></div>
                </div>

            </div>
        </div>


        <!-- ==================== WORKSPACE SCOTIABANK ==================== -->
        <div id="workspace-scotia" class="flex flex-col h-full gap-4 hidden">
            
            <!-- Panel Control Scotia -->
            <div class="grid grid-cols-12 gap-3 h-32 shrink-0">
                <!-- Drop Detalle -->
                <div id="drop-scotia-detalle" class="col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-red-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 group transition-all relative z-50">
                    <svg class="w-8 h-8 text-slate-300 group-hover:text-red-500 mb-1 transition-colors pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 9l-3 6m0-6l3 6"></path></svg>
                    <span class="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 uppercase text-center leading-tight pointer-events-none">Arrastra<br>Detalle Scotia</span>
                    <input type="file" id="file-scotia-detalle" class="hidden pointer-events-auto" accept=".xlsx, .xls">
                    <span id="status-scotia-detalle" class="text-[9px] text-slate-400 truncate w-full px-1 mt-1 hidden"></span>
                </div>

                <!-- Tarjeta Detalle -->
                <div id="card-scotia-detalle" onclick="window.ConciliacionFunctions.openPopup('scotia_detalle')" class="col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 rounded-lg p-2 relative hidden flex-col group transition-all overflow-hidden">
                    <button onclick="window.ConciliacionFunctions.openPopup('scotia_detalle')" class="absolute top-1 right-1 p-1 text-slate-400 hover:text-red-600 opacity-50 group-hover:opacity-100 transition-opacity z-20 bg-white/80 dark:bg-slate-800/80 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <!-- Contenedor con Scroll Horizontal -->
                    <div class="overflow-x-auto h-full w-full">
                        <!-- Ancho Mínimo Fijo para la tabla de 3 filas -->
                        <div id="scotia-summary-container" class="h-full flex items-center justify-center min-w-[500px]"></div>
                    </div>
                </div>

                <!-- Drop Pagado -->
                <div id="drop-scotia-pagado" class="col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-green-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 group transition-all relative z-50">
                    <svg class="w-8 h-8 text-slate-300 group-hover:text-green-500 mb-1 transition-colors pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14 9l-3 6m0-6l3 6"></path></svg>
                    <span class="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 uppercase text-center leading-tight pointer-events-none">Arrastra<br>Pagado Scotia</span>
                    <input type="file" id="file-scotia-pagado" class="hidden pointer-events-auto" accept=".xlsx, .xls">
                    <span id="status-scotia-pagado" class="text-[9px] text-slate-400 truncate w-full px-1 mt-1 hidden"></span>
                </div>

                <!-- Tarjeta Pagado -->
                <div id="card-scotia-pagado" class="col-span-2 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 hover:border-green-400 dark:hover:border-green-500 rounded-lg p-2 flex flex-col justify-center items-center relative hidden group cursor-pointer transition-all" onclick="window.ConciliacionFunctions.openPopup('scotia_pagado')">
                    <div class="absolute top-2 right-2 p-1 bg-green-100 dark:bg-green-800 rounded-full text-green-600 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </div>
                    <span class="text-[10px] text-green-600 uppercase font-bold tracking-wider mb-1">Total Banco</span>
                    <span id="sc-total-pagado" class="text-xl font-bold text-green-700 dark:text-green-400 font-mono">0</span>
                </div>
            </div>

            <!-- Tabla Central Scotia -->
            <!-- ÁREA CENTRAL SCOTIA -->
            <div class="flex flex-col gap-6 pb-10">
                
                <!-- TABLA CENTRAL SCOTIA (Altura Fija + Scroll Interno) -->
                <div class="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden h-[600px] shrink-0">
                    <!-- Toolbar -->
                    <div class="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                        <span class="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-red-600"></span> Resultados Scotia
                        </span>
                        
                        <div class="flex items-center gap-3">
                            <!-- Umbral Scotia -->
                            <div class="flex items-center bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 px-2 py-1">
                                <span class="text-[10px] font-bold text-slate-400 mr-2 uppercase">Diff Max:</span>
                                <span class="text-slate-400 font-bold text-xs mr-1">₡</span>
                                <input type="number" id="threshold-scotia" value="2000" step="500" 
                                       oninput="window.ConciliacionFunctions.updateThreshold(this.value, 'scotia')" 
                                       class="w-16 bg-transparent border-none text-xs font-bold text-right outline-none p-0 text-slate-700 dark:text-white">
                            </div>

                            <!-- Buscador Scotia -->
                            <div class="relative w-64">
                                <input type="text" id="search-scotia" class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600" placeholder="Filtrar resultados...">
                                <div class="absolute inset-y-0 left-0 flex items-center justify-center w-8 pointer-events-none text-slate-400">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Contenedor Grid (Scroll Aquí) -->
                    <div id="table-result-scotia" class="flex-grow overflow-hidden relative">
                        <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                            <span class="text-xs">Esperando archivos Scotia...</span>
                        </div>
                    </div>
                </div>

                <!-- PANEL AUDITORÍA SCOTIA -->
                <div id="audit-scotia" class="grid grid-cols-1 md:grid-cols-2 gap-6 hidden">
                    <!-- 1. PENDIENTES DETALLE -->
                    <div class="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4 shadow-sm">
                        <h4 class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-3 flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Excepciones detalle Scotiabank
                        </h4>
                        <div id="audit-list-scotia-detalle" class="max-h-96 overflow-y-auto pr-2 space-y-1"></div>
                    </div>

                    <!-- 2. PENDIENTES BANCO -->
                    <div class="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 shadow-sm">
                        <h4 class="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-3 flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Excepciones pagado Scotiabank
                        </h4>
                        <div id="audit-list-scotia-pagado" class="max-h-96 overflow-y-auto pr-2 space-y-1"></div>
                    </div>
                </div>

            </div>
        </div>

        <!-- ==================== WORKSPACE TSD (CONSOLIDADO FINAL) ==================== -->
        <div id="workspace-tsd" class="flex flex-col h-full gap-4 hidden">
            
            <!-- Panel Control TSD -->
            <div class="grid grid-cols-12 gap-3 h-32 shrink-0">
                <!-- Drop TSD -->
                <div id="drop-tsd" class="col-span-2 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-purple-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 transition-all group shadow-sm relative z-50">
                    <svg class="w-8 h-8 text-slate-300 group-hover:text-purple-500 mb-1 transition-colors pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <span class="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 uppercase text-center leading-tight pointer-events-none">Cargar<br>Reporte TSD</span>
                    <input type="file" id="file-tsd" class="hidden pointer-events-auto" accept=".xlsx, .xls">
                    <span id="status-tsd" class="text-[9px] text-slate-400 truncate w-full px-1 mt-1 hidden"></span>
                </div>

                <!-- Tarjeta Resumen TSD -->
                <div id="card-tsd" onclick="window.ConciliacionFunctions.openPopup('tsd')" class="col-span-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 hidden shadow-sm flex flex-col justify-center relative group">
                    <button onclick="window.ConciliacionFunctions.openPopup('tsd')" class="absolute top-2 right-2 p-1 text-slate-300 hover:text-purple-600 opacity-50 group-hover:opacity-100 transition-opacity" title="Ver Datos TSD">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <div class="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <span class="text-[10px] text-slate-400 uppercase font-bold">Total TSD</span>
                            <div id="tsd-total" class="text-xl font-bold text-purple-600 font-mono">0</div>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 uppercase font-bold">Conciliado BAC</span>
                            <div id="tsd-match-bac" class="text-xl font-bold text-green-600 font-mono">0</div>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 uppercase font-bold">Conciliado Scotia</span>
                            <div id="tsd-match-scotia" class="text-xl font-bold text-red-600 font-mono">0</div>
                        </div>
                        <div>
                            <span class="text-[10px] text-slate-400 uppercase font-bold">Sin Match</span>
                            <div id="tsd-unmatched" class="text-xl font-bold text-orange-500 font-mono">0</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TABLA CENTRAL TSD -->
            <div class="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden h-[600px] shrink-0">
                <div class="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <span class="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-purple-600"></span> Consolidación Maestra
                    </span>
                    <div class="flex items-center gap-3">
                        <!-- Tipo de Cambio -->
                        <div class="flex items-center bg-purple-50 dark:bg-purple-900/30 rounded border border-purple-200 dark:border-purple-800 px-2 py-1" title="Tipo de Cambio Compra BCCR">
                            <span class="text-[10px] font-bold text-purple-600 dark:text-purple-300 mr-2 uppercase">TC Venta:</span>
                            <span class="text-purple-600 font-bold text-xs mr-1">₡</span>
                            <input type="number" id="tsd-exchange-rate" value="515" step="1.0" 
                                   oninput="window.ConciliacionFunctions.updateExchangeRate(this.value)" 
                                   class="w-16 bg-transparent border-none text-xs font-bold text-right outline-none p-0 text-purple-700 dark:text-white">
                        </div>
                        
                    </div>
                    <div class="relative w-64">
                        <input type="text" id="search-tsd" class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-purple-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600" placeholder="Buscar transacción...">
                    </div>
                </div>
                <div id="table-result-tsd" class="flex-grow overflow-hidden relative">
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                        <span class="text-xs">Carga el reporte TSD para cruzar con Bancos...</span>
                    </div>
                </div>
            </div>
            
            <!-- Auditoría TSD -->
            <div id="audit-tsd" class="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4 shadow-sm hidden">
                <h4 class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase mb-3 flex items-center gap-2">
                    ⚠️ Transacciones TSD No Encontradas en Bancos (Pendientes de Cobro)
                </h4>
                <div id="audit-list-tsd" class="max-h-60 overflow-y-auto pr-2 space-y-1 text-[10px]"></div>
            </div>
        </div>

    </div>
</div>

