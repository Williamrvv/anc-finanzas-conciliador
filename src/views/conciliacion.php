<div class="flex flex-col min-h-full animate-fade-in-up" id="conciliacion-module">
    
    <!-- HEADER GLOBAL -->
    <header class="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div class="flex items-center gap-6">
            <h1 class="text-xl font-bold text-slate-900 dark:text-white">Conciliación Bancaria</h1>
            <!-- TABS -->
            <nav class="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button onclick="window.ConciliacionFunctions.switchTab('bac')" id="tab-bac" class="px-4 py-1.5 text-sm font-bold rounded shadow bg-white text-red-600 dark:bg-slate-700 dark:text-white transition-all">BAC Credomatic</button>
                <button onclick="window.ConciliacionFunctions.switchTab('scotia')" id="tab-scotia" class="px-4 py-1.5 text-sm font-medium rounded text-slate-500 hover:text-slate-700 dark:text-slate-400 transition-all">Davibank</button>
            </nav>
        </div>
        <div class="flex items-center gap-3">            
            
            <!-- BOTÓN MANTENIMIENTO DICCIONARIO (Solo Admin/Conciliador) -->
            <button onclick="window.ConciliacionFunctions.openDiccionario()" title="Diccionario de Centros de Costo" class="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                Centros de Costos
            </button>

            <div class="w-px h-6 bg-slate-300 dark:bg-slate-700"></div>

            <!-- BOTÓN DISCRETO (Guardado Local) -->
            <button id="btn-conservar-borrador" onclick="window.ConciliacionFunctions.forceLocalSave()" title="Guardar borrador compartido en la base de datos" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                Conservar Borrador
            </button>

            <!-- BOTÓN DE GUARDADO MASIVO (Base de Datos) -->
            <button id="btn-save-snapshot" onclick="window.ConciliacionFunctions.saveSnapshot()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                Guardar Conciliación
            </button>
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

                <!-- 3. Drop Pagado (1 Col) -->
                <div id="drop-bac-pagado" class="col-span-2 xl:col-span-1 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-green-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 transition-all group shadow-sm relative z-50 overflow-hidden">
                    <!-- Agrupamos Imagen y Texto para que ambos hagan el efecto de zoom al pasar el mouse -->
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none group-hover:scale-105 transition-transform duration-300 mt-1">
                        <img src="assets/arrastra_xlsx_bac_pagado_claro.png" class="h-10 sm:h-12 w-auto object-contain block dark:hidden mb-1.5" alt="Icono Excel">
                        <img src="assets/arrastra_xlsx_bac_pagado_oscuro.png" class="h-10 sm:h-12 w-auto object-contain hidden dark:block mb-1.5" alt="Icono Excel">
                        <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 group-hover:text-green-600 uppercase text-center leading-tight">Arrastra<br>Pagado</span>
                    </div>
                    
                    <input type="file" id="file-bac-pagado" class="hidden pointer-events-auto" accept=".xlsx, .xls">
                    
                    <!-- Overlay inferior para el texto de éxito (archivos cargados) -->
                    <span id="status-bac-pagado" class="text-[9px] text-slate-400 truncate w-full px-1 hidden text-center absolute bottom-0 left-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm py-1"></span>
                </div>

                <!-- 4. Tarjeta Pagado (2 Cols) -->
                <div id="card-bac-pagado" class="col-span-2 xl:col-span-2 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 hover:border-green-400 dark:hover:border-green-500 rounded-lg p-2 flex flex-col justify-center items-center relative hidden shadow-sm group transition-all cursor-pointer" onclick="window.ConciliacionFunctions.openPopup('pagado')">
                    <button onclick="event.stopPropagation(); window.ConciliacionFunctions.openPopup('pagado')" class="absolute top-1 right-1 p-1 text-green-600/50 hover:text-green-600 opacity-50 group-hover:opacity-100 transition-opacity z-10 bg-green-50/80 dark:bg-green-900/80 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <span class="text-[9px] text-green-600 uppercase font-bold tracking-wider mb-1 text-center leading-tight">Total Banco<br>(Depósito)</span>
                    <span id="sum-depositos" class="text-lg font-bold text-green-700 dark:text-green-400 font-mono">0</span>
                </div> 
                
                <!-- 1. Drop Detalle (1 Col) -->
                <div id="drop-bac-detalle" class="col-span-2 xl:col-span-1 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-red-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 transition-all group shadow-sm relative z-50 overflow-hidden">
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none group-hover:scale-105 transition-transform duration-300 mt-1">
                        <img src="assets/arrastra_csv_bac_detallado_claro.png" class="h-10 sm:h-12 w-auto object-contain block dark:hidden mb-1.5" alt="Icono CSV">
                        <img src="assets/arrastra_csv_bac_detallado_oscuro.png" class="h-10 sm:h-12 w-auto object-contain hidden dark:block mb-1.5" alt="Icono CSV">
                        <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 group-hover:text-red-500 uppercase text-center leading-tight">Arrastra<br>Detallado</span>
                    </div>
                    
                    <input type="file" id="file-bac-detalle" class="hidden pointer-events-auto" accept=".csv">
                    <span id="status-bac-detalle" class="text-[9px] text-slate-400 truncate w-full px-1 hidden text-center absolute bottom-0 left-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm py-1"></span>
                </div>

                <!-- 2. Tarjeta Detalle (8 Cols - ESPACIO MAXIMIZADO) -->
                <div id="card-bac-detalle" class="col-span-6 xl:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 rounded-lg p-0 relative hidden shadow-sm group transition-all overflow-hidden" onclick="window.ConciliacionFunctions.openPopup('detalle')">
                    <button onclick="event.stopPropagation(); window.ConciliacionFunctions.openPopup('detalle')" class="absolute top-1 right-1 p-1 text-slate-400 hover:text-blue-600 opacity-50 group-hover:opacity-100 transition-opacity z-10 bg-white/80 dark:bg-slate-800/80 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <!-- Contenedor con Scroll Horizontal -->
                    <div class="overflow-x-auto h-full w-full">
                        <div id="bac-summary-container" class="h-full flex items-center min-w-[450px] w-full"></div>
                    </div>
                </div>
            </div>

           <!-- TABLA CENTRAL BAC (Altura Dinámica y Liberada) -->
                <div class="flex flex-col gap-2">
                    <!-- Toolbar Separado -->
                    <div class="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex justify-between items-center">
                        <span class="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span> Resultados BAC
                        </span>
                        
                        <div class="flex items-center gap-3">
                            <div class="relative w-64">
                                <input type="text" id="search-bac" class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600" placeholder="Filtrar resultados...">
                                <div class="absolute inset-y-0 left-0 flex items-center justify-center w-8 pointer-events-none text-slate-400">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Grid 100% Nativo y Ajustable -->
                    <!-- Nace en 500px, pero puede crecer infinitamente si el usuario lo estira -->
                    <div id="table-result-bac" style="height: 500px;" class="w-full min-h-[300px] h-auto resize-y overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm relative z-10">
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

            </div>
        </div>


        <!-- ==================== WORKSPACE SCOTIABANK ==================== -->
        <div id="workspace-scotia" class="flex flex-col h-full gap-4 hidden">
            
            <!-- Panel Control Scotia -->
            <div class="grid grid-cols-12 gap-3 h-32 shrink-0">

                <!-- Drop Pagado -->
                <div id="drop-scotia-pagado" class="col-span-2 xl:col-span-1 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-green-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 transition-all group shadow-sm relative z-50 overflow-hidden">
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none group-hover:scale-105 transition-transform duration-300 mt-1">
                        <img src="assets/arrastra_xlsx_pagado_scotia_claro.png" class="h-10 sm:h-12 w-auto object-contain block dark:hidden mb-1.5" alt="Icono Excel">
                        <img src="assets/arrastra_xlsx_pagado_scotia_oscuro.png" class="h-10 sm:h-12 w-auto object-contain hidden dark:block mb-1.5" alt="Icono Excel">
                        <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 group-hover:text-green-600 uppercase text-center leading-tight">Arrastra<br>Pagado</span>
                    </div>
                    
                    <input type="file" id="file-scotia-pagado" class="hidden pointer-events-auto" accept=".xlsx, .xls">
                    <span id="status-scotia-pagado" class="text-[9px] text-slate-400 truncate w-full px-1 hidden text-center absolute bottom-0 left-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm py-1"></span>
                </div>

                <!-- Tarjeta Pagado -->
                <div id="card-scotia-pagado" class="col-span-2 xl:col-span-2 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 hover:border-green-400 dark:hover:border-green-500 rounded-lg p-2 flex flex-col justify-center items-center relative hidden group cursor-pointer transition-all" onclick="window.ConciliacionFunctions.openPopup('scotia_pagado')">
                    <button onclick="event.stopPropagation(); window.ConciliacionFunctions.openPopup('scotia_pagado')" class="absolute top-1 right-1 p-1 text-green-600/50 hover:text-green-600 opacity-50 group-hover:opacity-100 transition-opacity z-10 bg-green-50/80 dark:bg-green-900/80 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <span class="text-[9px] text-green-600 uppercase font-bold tracking-wider mb-1 text-center leading-tight">Total Banco<br>(Depósito)</span>
                    <span id="sc-total-pagado" class="text-lg font-bold text-green-700 dark:text-green-400 font-mono">0</span>
                </div>
                
                <!-- Drop Detalle -->
                <div id="drop-scotia-detalle" class="col-span-2 xl:col-span-1 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-red-500 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white dark:bg-slate-800 transition-all group shadow-sm relative z-50 overflow-hidden">
                    <div class="flex flex-col items-center justify-center w-full h-full pointer-events-none group-hover:scale-105 transition-transform duration-300 mt-1">
                        <img src="assets/arrastra_xlsx_detallado_scotia_claro.png" class="h-10 sm:h-12 w-auto object-contain block dark:hidden mb-1.5" alt="Icono Excel">
                        <img src="assets/arrastra_xlsx_detallado_scotia_oscuro.png" class="h-10 sm:h-12 w-auto object-contain hidden dark:block mb-1.5" alt="Icono Excel">
                        <span class="text-[8px] sm:text-[9px] font-bold text-slate-400 group-hover:text-red-500 uppercase text-center leading-tight">Arrastra<br>Detallado</span>
                    </div>
                    
                    <input type="file" id="file-scotia-detalle" class="hidden pointer-events-auto" accept=".xlsx, .xls">
                    <span id="status-scotia-detalle" class="text-[9px] text-slate-400 truncate w-full px-1 hidden text-center absolute bottom-0 left-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm py-1"></span>
                </div>

                <!-- Tarjeta Detalle -->
                <div id="card-scotia-detalle" onclick="window.ConciliacionFunctions.openPopup('scotia_detalle')" class="col-span-6 xl:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-400 dark:hover:border-red-500 rounded-lg p-0 relative hidden flex-col group transition-all overflow-hidden">
                    <button onclick="window.ConciliacionFunctions.openPopup('scotia_detalle')" class="absolute top-1 right-1 p-1 text-slate-400 hover:text-red-600 opacity-50 group-hover:opacity-100 transition-opacity z-20 bg-white/80 dark:bg-slate-800/80 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                    </button>
                    <!-- Contenedor con Scroll Horizontal -->
                    <div class="overflow-x-auto h-full w-full">
                        <!-- Ancho Mínimo Fijo para la tabla de 3 filas -->
                        <div id="scotia-summary-container" class="h-full flex items-center justify-center min-w-[500px]"></div>
                    </div>
                </div>
            </div>

            <!-- ÁREA CENTRAL SCOTIA -->
            <div class="flex flex-col gap-6 pb-10">
                
                <!-- TABLA CENTRAL SCOTIA (Altura Dinámica y Liberada) -->
                <div class="flex flex-col gap-2">
                    <!-- Toolbar Separado -->
                    <div class="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex justify-between items-center">
                        <span class="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-red-600"></span> Resultados Scotia
                        </span>
                        
                        <div class="flex items-center gap-3">
                            <div class="relative w-64">
                                <input type="text" id="search-scotia" class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600" placeholder="Filtrar resultados...">
                                <div class="absolute inset-y-0 left-0 flex items-center justify-center w-8 pointer-events-none text-slate-400">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Grid 100% Nativo y Ajustable -->
                    <div id="table-result-scotia" style="height: 500px;" class="w-full min-h-[300px] h-auto resize-y overflow-hidden border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm relative z-10">
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

    </div>

    <!-- MODAL DICCIONARIO CC MINIMALISTA -->
    <div id="modal-diccionario" class="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden transform scale-95 transition-transform duration-300" id="modal-dicc-card">
            
            <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <span class="text-indigo-600">📚</span> Diccionario Maestro (Afiliado ➔ Centro Costo)
                </h3>
                <button onclick="window.ConciliacionFunctions.closeDiccionario()" class="text-slate-400 hover:text-red-500 transition-colors w-8 h-8 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/30">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            
            <div class="flex flex-col md:flex-row h-[600px] overflow-hidden">
                <!-- COLUMNA IZQUIERDA: FORMULARIO -->
                <div class="w-full md:w-1/3 bg-slate-50 dark:bg-slate-800/30 border-r border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-4 overflow-y-auto">
                    <div class="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300 p-3 rounded-lg text-[10px] border border-indigo-100 dark:border-indigo-800/50 font-medium">
                        Si el Afiliado ya existe, se actualizarán sus datos y se marcará como <b>ACTIVO</b> automáticamente.
                    </div>

                    <form id="form-dicc" onsubmit="window.ConciliacionFunctions.saveDiccionario(event)" class="flex flex-col gap-3">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Afiliado / MerID <span class="text-red-500">*</span></label>
                            <input type="text" id="dicc-afil" required class="w-full p-2 text-xs font-mono font-bold border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ej: 123456789">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Centro Costo (Softland) <span class="text-red-500">*</span></label>
                            <input type="text" id="dicc-cc" required class="w-full p-2 text-xs font-mono font-bold border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ej: 01-06-18">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Banco</label>
                                <select id="dicc-banco" class="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none">
                                    <option value="BAC">BAC</option>
                                    <option value="Davibank">Davibank</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cód. Sucursal</label>
                                <input type="text" id="dicc-cod" class="w-full p-2 text-xs font-mono border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none" placeholder="Ej: ACOC01">
                            </div>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Sucursal (Opcional)</label>
                            <input type="text" id="dicc-nom" class="w-full p-2 text-xs border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none" placeholder="Ej: COBANO">
                        </div>

                        <button type="submit" id="dicc-btn-save" class="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg shadow-sm transition-colors text-sm flex justify-center items-center gap-2">
                            Guardar Registro
                        </button>
                    </form>
                </div>

                <!-- COLUMNA DERECHA: TABLA -->
                <div class="w-full md:w-2/3 flex flex-col bg-white dark:bg-slate-800 relative">
                    <div class="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
                        <div class="relative w-64">
                            <input type="text" id="search-dicc" class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600 dark:text-white" placeholder="Buscar por afiliado o CC...">
                            <svg class="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] font-bold text-slate-500 flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" id="dicc-filter-active" checked onchange="window.ConciliacionFunctions.loadDiccionario()" class="accent-indigo-600 w-3 h-3"> Ocultar Inactivos
                            </label>
                        </div>
                    </div>
                    
                    <div id="grid-diccionario" class="flex-grow w-full border-none"></div>
                </div>
            </div>

        </div>
    </div>
</div>

