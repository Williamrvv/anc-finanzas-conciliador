window.ConciliacionLogic = {
    data: { 
        detalle: [], 
        pagado: [], 
        scotia_detalle: [], 
        scotia_pagado: [], 
        files: {
            bac_detalle: [],
            bac_pagado: [],
            scotia_detalle: [],
            scotia_pagado: []
        },
    },
    grids: { bac: null, scotia: null }, // <--- Almacén de instancias
    activeTab: 'bac', // Estado actual

    switchTab: function(tab) {
        this.activeTab = tab;
        
        const tabs = {
            bac: document.getElementById('tab-bac'),
            scotia: document.getElementById('tab-scotia')
        };
        const workspaces = {
            bac: document.getElementById('workspace-bac'),
            scotia: document.getElementById('workspace-scotia')
        };

        // Blindaje
        if (!tabs.bac || !tabs.scotia) return;

        const activeClass = "bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-white font-bold";
        const getActiveColor = (t) => t === 'bac' ? 'text-red-600' : 'text-slate-800 dark:text-white';
        
        const inactiveClass = "text-slate-500 hover:text-slate-700 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-800";

        // Reset y Activar
        Object.keys(tabs).forEach(k => {
            const isActive = k === tab;
            
            tabs[k].className = `px-4 py-1.5 text-sm rounded transition-all ${isActive ? "bg-white shadow-sm font-bold dark:bg-slate-700 " + getActiveColor(k) : inactiveClass}`;
            
            const ws = workspaces[k];
            if (ws) {
                if (isActive) {
                    ws.classList.remove('hidden');
                    // Truco UX (Reflow): Quitar la clase, leer el DOM, volver a ponerla para reiniciar la animación
                    ws.classList.remove('animate-fade-in-up');
                    void ws.offsetWidth; 
                    ws.classList.add('animate-fade-in-up');
                } else {
                    ws.classList.add('hidden');
                    ws.classList.remove('animate-fade-in-up');
                }
            }
        });
    },

    // Genera listas de items excluidos (Checkboxes desmarcados)
    renderAudit: function(bank) {
        const isBac = bank === 'bac';
        
        // 1. Obtener Datos Crudos (Para Excluidos Manuales)
        const rawDet = (isBac ? this.data.detalle : this.data.scotia_detalle) || [];
        const rawPag = (isBac ? this.data.pagado : this.data.scotia_pagado) || [];
        
        // 2. Obtener Datos Grid (Para No Cruzados / Diferencias Totales)
        const gridInstance = isBac ? this.grids.bac : this.grids.scotia;
        const gridData = (gridInstance && gridInstance.options.data) ? gridInstance.options.data : [];

        // IDs DOM
        const pfx = isBac ? 'bac' : 'scotia';
        const container = document.getElementById(`audit-${pfx}`);
        if(!container) return;

        // --- CONSTRUCTOR DE ITEMS ---
        // Vamos a crear un array unificado de objetos { label, monto, tipo }
        
        // A. DETALLE PENDIENTE
        const itemsDetalle = [];
        
        // A1. Excluidos Manualmente (Checkbox)
        rawDet.forEach(r => {
            if (!r._enabled) {
                itemsDetalle.push({
                    label: r._id || r.id || 'Sin ID', // Ajustar según estructura BAC/Scotia
                    desc: r._desc || 'Excluido Manual',
                    monto: r._monto || r._neto || 0, // Ajustar propiedades
                    reason: 'user'
                });
            }
        });

        // A2. Sobrantes del Grid (Venta existe, Pago es 0)
        // OJO: Solo si NO fueron excluidos (para no duplicar)
        gridData.forEach(r => {
            // Si hay Neto Esperado pero NO hay Pago, es un sobrante del detalle
            if (Math.abs(r.neto) > 0 && r.pagado === 0) {
                itemsDetalle.push({
                    label: r.id,
                    desc: 'No encontrado en Banco',
                    monto: r.neto,
                    reason: 'system'
                });
            }
        });

        // B. BANCO PENDIENTE
        const itemsBanco = [];

        // B1. Excluidos Manualmente
        rawPag.forEach(r => {
            if (!r._enabled) {
                itemsBanco.push({
                    label: r._extractedId || r._desc || 'Sin ID',
                    desc: 'Excluido Manual',
                    monto: r._monto || 0,
                    reason: 'user'
                });
            }
        });

        // B2. Sobrantes del Grid (Pago existe, Venta es 0)
        gridData.forEach(r => {
            if (r.neto === 0 && Math.abs(r.pagado) > 0) {
                itemsBanco.push({
                    label: r.id,
                    desc: 'No encontrado en Detalle',
                    monto: r.pagado,
                    reason: 'system'
                });
            }
        });

        // --- RENDERIZADO HTML ---
        const renderList = (items, colorClass) => {
            if (items.length === 0) return '<div class="text-slate-400 italic text-xs p-2">Todo conciliado o vacío.</div>';
            
            // Ordenar por monto descendente
            items.sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto));

            return items.map(item => `
                <div class="flex justify-between items-center p-2 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-sm transition-shadow">
                    <div class="overflow-hidden">
                        <div class="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate w-40" title="${item.label}">
                            ${item.label}
                        </div>
                        <div class="text-[9px] ${item.reason === 'user' ? 'text-slate-400' : 'text-red-400 font-bold'} truncate">
                            ${item.desc}
                        </div>
                    </div>
                    <div class="text-xs font-mono font-bold ${colorClass}">
                        ${this.formatMoney(item.monto)}
                    </div>
                </div>
            `).join('');
        };

        document.getElementById(`audit-list-${pfx}-detalle`).innerHTML = renderList(itemsDetalle, 'text-orange-600 dark:text-orange-400');
        document.getElementById(`audit-list-${pfx}-pagado`).innerHTML = renderList(itemsBanco, 'text-blue-600 dark:text-blue-400');

        // Mostrar Panel
        if (gridInstance) {
            container.classList.remove('hidden');
        }
    },

    // data: { detalle: [], pagado: [] },
    table: null,

    init: async function() {
        // Fusión de Lógica Modular
        if(window.BACLogic) Object.assign(this, window.BACLogic);
        if(window.ScotiaLogic) Object.assign(this, window.ScotiaLogic);
        
        console.log("Sistema Conciliación Iniciado");
        
        // Evitar que el drag&drop se duplique al recargar la vista
        if (!this._uploadsConfigured) {
            this.setupUploads();
            this._uploadsConfigured = true;
        }
        
        // --- MOTOR DE RECUPERACIÓN LOCAL (DRAFT) ---
        const draftStr = localStorage.getItem('conciliacion_draft');
        if (draftStr) {
            const choice = await window.SysUI.confirm(
                "Se ha detectado un proceso de conciliación guardado en el navegador.\n\n¿Desea restaurar su progreso donde lo dejó?", 
                "Borrador Encontrado", 
                "info"
            );
            if (choice) {
                this.restoreDraftFromLocal(draftStr);
            } else {
                localStorage.removeItem('conciliacion_draft');
                this.loadPendientes(); // Si rechaza el borrador, cargar los pendientes frescos de la BD
            }
        } else {
            // Flujo Normal: Traer saldos arrastrados de la BD
            this.loadPendientes();
        }

        // INICIAR RELOJ DE AUTO-GUARDADO
        this.startAutoSave();
    },

    // --- GESTIÓN DE ESTADO LOCAL ---
    resetState: function() {
        console.log("🧹 Purgando estado de memoria y DOM fantasma...");
        
        // Apagar el reloj si se cierra o limpia la sesión
        if (this._autoSaveInterval) {
            clearInterval(this._autoSaveInterval);
            this._autoSaveInterval = null;
        }

        this.data = {
            detalle: [], pagado: [], scotia_detalle: [], scotia_pagado: [],
            files: { bac_detalle: [], bac_pagado: [], scotia_detalle: [], scotia_pagado: [] },
            headers: {}, processed: {}
        };
        // Destruir las instancias de los grids para forzar su re-creación
        this.grids = { bac: null, scotia: null, bac_audit: null, scotia_audit: null, bac_manual: null, bac_deferred: null };
        
        // Reset Variables Locales de Módulos
        if (this.manualMatches) this.manualMatches = [];
        if (this.manualMatchesScotia) this.manualMatchesScotia = [];
        if (this.deferredRows) this.deferredRows = { det: [], pag: [] };
    },

    hasUnsavedData: function() {
        // Verifica si hay archivos cargados ignorando el "Saldos Históricos" (porque eso viene de BD automáticamente)
        const checkFiles = (arr) => arr && arr.filter(f => f !== 'Saldos Históricos').length > 0;
        return checkFiles(this.data.files.bac_detalle) || 
               checkFiles(this.data.files.bac_pagado) || 
               checkFiles(this.data.files.scotia_detalle) || 
               checkFiles(this.data.files.scotia_pagado);
    },

    saveDraftToLocal: function(isAutoSave = false) {
        try {
            const draft = {
                data: this.data,
                manualBAC: this.manualMatches || [],
                manualScotia: this.manualMatchesScotia || [],
                deferred: this.deferredRows || { det: [], pag: [] }
            };
            localStorage.setItem('conciliacion_draft', JSON.stringify(draft));
            
            if (!isAutoSave) {
                // Guardado por salida (Router): Purgamos la pantalla
                this.resetState(); 
                console.log("💾 Borrador guardado por navegación en LocalStorage.");
            } else {
                // Auto-Guardado en segundo plano: Dejamos la pantalla intacta y mostramos Toast
                console.log(`⏱️ [Auto-Save] Progreso respaldado automáticamente a las ${new Date().toLocaleTimeString()}`);
                this.showAutoSaveToast();
            }
        } catch (e) {
            console.error("Fallo al guardar en LocalStorage:", e);
            // Solo molestamos al usuario con el alert si fue manual, si es auto-save fallamos silenciosamente
            if (!isAutoSave) alert("El volumen de datos es demasiado grande para el almacenamiento local del navegador.");
        }
    },

    // --- MOTOR DE AUTO-GUARDADO (CADA 1 MINUTOS) ---
    startAutoSave: function() {
        // 1. Limpiar cualquier intervalo fantasma anterior
        if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);
        
        // 2. Ejecutar cada 180,000 milisegundos (3 minutos)
        this._autoSaveInterval = setInterval(() => {
            // Solo sobrescribir el archivo si hay datos (no acumula, reemplaza)
            if (this.hasUnsavedData()) {
                this.saveDraftToLocal(true);
            }
        }, 60000);
    },

    showAutoSaveToast: function() {
        let toast = document.getElementById('auto-save-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'auto-save-toast';
            toast.className = 'fixed bottom-4 left-4 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] px-3 py-1.5 rounded-full shadow-lg z-[9999] opacity-0 transition-opacity duration-500 flex items-center gap-2 pointer-events-none select-none';
            toast.innerHTML = '<span class="text-green-400 animate-pulse">●</span> Progreso guardado';
            document.body.appendChild(toast);
        }
        
        // Mostrar
        toast.classList.remove('opacity-0');
        
        // Ocultar suavemente después de 3 segundos
        setTimeout(() => {
            toast.classList.add('opacity-0');
        }, 3000);
    },

    restoreDraftFromLocal: function(draftStr) {
        console.log("📦 Restaurando borrador local...");
        const draft = JSON.parse(draftStr);
        
        this.data = draft.data;
        this.manualMatches = draft.manualBAC || [];
        this.manualMatchesScotia = draft.manualScotia || [];
        this.deferredRows = draft.deferred || { det: [], pag: [] };

        // Disparar las funciones de renderizado para re-dibujar las pantallas
        setTimeout(() => {
            this.updateFileList('bac_detalle');
            this.updateFileList('bac_pagado');
            this.updateScotiaFileList('scotia_detalle');
            this.updateScotiaFileList('scotia_pagado');

            if (this.data.files.bac_detalle.length || this.data.files.bac_pagado.length) {
                // Forzar visualización de tarjetas BAC
                if(this.data.files.bac_detalle.length) document.getElementById('card-bac-detalle')?.classList.remove('hidden');
                if(this.data.files.bac_pagado.length) document.getElementById('card-bac-pagado')?.classList.remove('hidden');
                
                if(this.recalculateDetalle) this.recalculateDetalle();
                if(this.recalculateBACPagado) this.recalculateBACPagado();
                if(this.renderManualMatchesTable) this.renderManualMatchesTable();
                if(this.renderDeferredTable) this.renderDeferredTable();
            }
            if (this.data.files.scotia_detalle.length || this.data.files.scotia_pagado.length) {
                // Forzar visualización de tarjetas Scotia
                if(this.data.files.scotia_detalle.length) document.getElementById('card-scotia-detalle')?.classList.remove('hidden');
                if(this.data.files.scotia_pagado.length) document.getElementById('card-scotia-pagado')?.classList.remove('hidden');

                if(this.updateScotiaCard) this.updateScotiaCard();
                if(this.recalculateScotiaPagado) this.recalculateScotiaPagado();
            }
        }, 100);
    },

    // ==========================================================
    // MOTOR DE ARRASTRE DE SALDOS (HISTÓRICOS)
    // ==========================================================
    loadPendientes: async function() {
        try {
            const res = await fetch('api/get_pendientes.php');
            const json = await res.json();
            
            if (!json.success || !json.data || json.data.length === 0) return;

            let counts = { bac: 0, scotia: 0 };
            
            json.data.forEach(r => {
                // Color Ámbar para diferenciar lo histórico
                const historyClass = "bg-amber-50 dark:bg-amber-900/20 border-l-[4px] border-l-amber-500 font-medium";
                let fechaCr = r.FechaTransaccion ? r.FechaTransaccion.split('-').reverse().join('/') : '';
                
                const baseObj = {
                    _uid: r.IdTransaccion,
                    _fecha: fechaCr,
                    _enabled: true,
                    _isHistorical: true,
                    _rowClass: historyClass,
                    _sourceFile: "Arrastre " + (r.DiasAntiguedad ? `(${r.DiasAntiguedad} días)` : '(Pendiente)')
                };

                if (r.Origen === 'AJUSTE') {
                    baseObj._isAdjustment = true;
                    baseObj._adjType = r.TipoAjuste;
                    baseObj._adjReason = r.Justificacion;
                    baseObj._adjEvidence = r.EvidenciaB64;
                }

                if (r.Banco === 'BAC') {
                    counts.bac++;
                    if (r.Origen === 'DETALLADO' || r.Origen === 'AJUSTE') {
                        this.data.detalle.push({
                            ...baseObj,
                            _id: r.Afiliado_MerID,
                            _liq: r.Liquidacion || r.Autorizacion,
                            _venta: parseFloat(r.MontoBruto || 0),
                            _netoACI: parseFloat(r.MontoNeto || 0),
                            _comision: parseFloat(r.BacComision || 0),
                            _retV: parseFloat(r.RetencionVentas || 0),
                            _retR: parseFloat(r.RetencionRenta || 0),
                            _aciOrig: parseFloat(r.AjusteACI || 0),
                            "3": "Saldo Histórico", // Comercio fallback
                            "11": r.Autorizacion // Auth fallback
                        });
                    } else if (r.Origen === 'PAGADO') {
                        this.data.pagado.push({
                            ...baseObj,
                            _extractedId: r.Afiliado_MerID,
                            _liqRef: r.Autorizacion,
                            _monto: parseFloat(r.MontoNeto || 0),
                            _desc: `Arrastre: ${r.Afiliado_MerID} LIQ ${r.Autorizacion}`
                        });
                    }
                } 
                else if (r.Banco === 'SCOTIA') {
                    counts.scotia++;
                    if (r.Origen === 'DETALLADO' || r.Origen === 'AJUSTE') {
                        this.data.scotia_detalle.push({
                            ...baseObj,
                            _bruto: parseFloat(r.MontoBruto || 0),
                            _neto: parseFloat(r.MontoNeto || 0),
                            _mode: (r.Lote === 'AJUSTE' || r.Origen === 'AJUSTE') ? 'AJUSTE' : 'LOTE',
                            "MerID": r.Afiliado_MerID, // Usamos la llave visual para el PopUp
                            "Autorizacion": r.Autorizacion,
                            "Monto Comisión": parseFloat(r.ScotiaComision || 0),
                            "Retención IVA": parseFloat(r.RetencionIVA || 0),
                            "Retención ISR": parseFloat(r.RetencionISR || 0)
                        });
                    } else if (r.Origen === 'PAGADO') {
                        this.data.scotia_pagado.push({
                            ...baseObj,
                            _extractedId: r.Afiliado_MerID,
                            _monto: parseFloat(r.MontoNeto || 0),
                            _desc: `Arrastre Scotia: ${r.Afiliado_MerID}`
                        });
                    }
                }
            });

            // Actualizar visualmente si se encontraron datos
            if (counts.bac > 0) {
                this.data.files.bac_detalle = ["Saldos Históricos"];
                this.updateFileList('bac_detalle');
                if(this.recalculateDetalle) this.recalculateDetalle();
                console.log(`📥 Rescatados ${counts.bac} saldos históricos de BAC`);
            }
            if (counts.scotia > 0) {
                this.data.files.scotia_detalle = ["Saldos Históricos"];
                this.updateFileList('scotia_detalle');
                if(this.updateScotiaCard) this.updateScotiaCard();
                if(this.runMatchScotiabank) this.runMatchScotiabank();
                console.log(`📥 Rescatados ${counts.scotia} saldos históricos de Scotia`);
            }

        } catch (err) {
            console.error("Error cargando históricos:", err);
        }
    },

    

    // // --- 1. CONFIGURACIÓN TABULATOR ---
    // getTableConfig: function(data, columns) {
    //     return {
    //         data: data,
    //         columns: columns,
            
    //         // Layout
    //         layout: "fitColumns",
    //         height: "550px", // Altura fija para forzar scroll y footer sticky
            
    //         // Comportamiento Excel
    //         keybindings: true,
    //         selectableRange: 1,
    //         selectableRangeColumns: true,
    //         selectableRangeRows: true,
    //         clipboard: "copy",
    //         clipboardCopyRowRange: "range",
    //         clipboardCopyConfig: { columnHeaders: false },
    //         movableColumns: true,

    //         // EVENTO CLAVE: Conectar selección con TU barra de HTML
    //         rangeSelectionChanged: function(range) {
    //             window.ConciliacionLogic.calculateStats(range);
    //         },
            
    //         // Limpieza al perder foco (opcional)
    //         dataLoaded: function() {
    //             document.getElementById('global-table-stats')?.classList.add('hidden');
    //         }
    //     };
    // },

    // // --- 2. LÓGICA DE AUTOSUMA (Conectada a index.php) ---
    // calculateStats: function(range) {
    //     // Usamos TUS IDs del index.php
    //     const bar = document.getElementById('global-table-stats');
    //     if(!bar) return; 

    //     const cells = range.getCells();
        
    //     // Ocultar si hay menos de 2 celdas
    //     if(cells.length < 2) {
    //         bar.classList.add('hidden');
    //         return;
    //     }

    //     let sum = 0;
    //     let countNums = 0;

    //     cells.forEach(cell => {
    //         const val = cell.getValue();
    //         let num = 0;
            
    //         // Limpieza financiera
    //         if(typeof val === 'number') num = val;
    //         else if(typeof val === 'string') {
    //             // Quitar simbolos, letras y normalizar (1.000,00 -> 1000.00)
    //             let clean = val.replace(/[₡\sA-Za-z]/g, '');
    //             if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
    //             else if (clean.includes(',')) clean = clean.replace(',', '.');
    //             num = parseFloat(clean);
    //         }

    //         if(!isNaN(num)) {
    //             sum += num;
    //             if(num !== 0) countNums++;
    //         }
    //     });

    //     // Formateador
    //     const fmt = new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'});

    //     // Inyectar en TUS IDs: gst-count, gst-sum, gst-avg
    //     document.getElementById('gst-count').innerText = cells.length;
    //     document.getElementById('gst-sum').innerText = fmt.format(sum);
        
    //     // Promedio (Opcional, si el elemento existe en el HTML lo llenamos)
    //     const avgEl = document.getElementById('gst-avg');
    //     if(avgEl) avgEl.innerText = countNums > 0 ? fmt.format(sum/countNums) : '-';
        
    //     bar.classList.remove('hidden');
    // },

    // --- 3. PROCESAMIENTO DE ARCHIVOS ---
    setupUploads: function() {
        console.log("🔧 Configurando Delegación Global de Dropzones...");

        // Lista de IDs permitidos
        const zones = {
            'drop-bac-detalle': { input: 'file-bac-detalle', type: 'csv' },
            'drop-bac-pagado': { input: 'file-bac-pagado', type: 'excel' },
            'drop-scotia-detalle': { input: 'file-scotia-detalle', type: 'scotia_detalle' },
            'drop-scotia-pagado': { input: 'file-scotia-pagado', type: 'scotia_pagado' }
        };

        // 1. CLICK DELEGADO (Atrapa clicks en cualquier parte del documento)
        document.body.addEventListener('click', (e) => {
            // Buscamos si el clic fue dentro de un dropzone conocido
            const drop = e.target.closest('[id^="drop-"]'); 
            if (drop && zones[drop.id]) {
                const config = zones[drop.id];
                const input = document.getElementById(config.input);
                
                // Evitar loop infinito si el click fue en el input mismo
                if (e.target !== input && input) {
                    console.log(`🖱️ Click delegado detectado en: ${drop.id}`);
                    input.click();
                }
            }
        });

        // 2. CHANGE DELEGADO (Detectar cuando el usuario eligió archivo)
        document.body.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'file') {
                const dropId = Object.keys(zones).find(k => zones[k].input === e.target.id);
                if (dropId) {
                    const config = zones[dropId];
                    // NUEVO: Iterar sobre todos los archivos seleccionados
                    if(e.target.files.length > 0) {
                        Array.from(e.target.files).forEach(file => {
                            this.handleFileProcessing(file, dropId, config.type);
                        });
                        e.target.value = ''; // Reset
                    }
                }
            }
        });

        // 3. DRAG & DROP DELEGADO
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                const drop = e.target.closest('[id^="drop-"]');
                if (!drop || !zones[drop.id]) return;

                e.preventDefault();
                e.stopPropagation();

                if (eventName === 'drop') {
                    const config = zones[drop.id];
                    // NUEVO: Iterar sobre todos los archivos arrastrados a la vez
                    if(e.dataTransfer.files.length > 0) {
                        Array.from(e.dataTransfer.files).forEach(file => {
                            this.handleFileProcessing(file, drop.id, config.type);
                        });
                    }
                    drop.classList.remove('bg-slate-100');
                }
            }, false);
        });
    },

    // Nueva función auxiliar para procesar (separada de la configuración)
    handleFileProcessing: function(file, dropId, type) {
        console.log(`⚙️ Procesando: ${file.name} (${type})`);
        
        const statusId = dropId.replace('drop-', 'status-');
        const statusEl = document.getElementById(statusId);
        
        // 1. Mostrar estado "Procesando" inmediatamente
        if(statusEl) {
            // Si ya hay contenido (lista de archivos), no lo borramos, solo mostramos carga
            if(!statusEl.innerHTML.includes('svg')) {
                statusEl.innerText = "Procesando...";
            }
            statusEl.classList.remove('hidden');
            statusEl.classList.remove('text-red-500'); 
            statusEl.classList.add('text-blue-500', 'animate-pulse'); 
        }

        const reader = new FileReader();
        
        // CRÍTICO: Asegurarse de recibir (e) aquí
        reader.onload = (e) => {
            try {
                // DETECCIÓN DE FORMATO Y ENVÍO A LÓGICA ESPECÍFICA
                // Se pasa e.target.result (contenido) y file.name (nombre)
                
                if(type === 'csv') {
                    // BAC Detalle
                    this.processCSV(e.target.result, file.name);
                } 
                else if(type === 'scotia_detalle') {
                    // Scotia Detalle (Aún no adaptado para multi-archivo, pasamos solo contenido por ahora)
                    this.processScotiabankDetalle(e.target.result, file.name);
                } 
                else if(type === 'scotia_pagado') {
                    // Scotia Pagado
                    this.processScotiabankPagado(e.target.result, file.name);
                } 
                else if(type === 'tsd') {
                    // TSD (Reporte Maestro)
                    this.processTSD(e.target.result);
                } 
                else {
                    // Excel Genérico (BAC Pagado por defecto en la config actual)
                    this.processExcel(e.target.result, file.name);
                }
                
                // 2. Éxito: Quitar animación de carga del status
                if(statusEl) {
                    statusEl.classList.remove('text-blue-500', 'animate-pulse');
                    statusEl.classList.add('text-green-600', 'font-bold');
                    // Nota: El texto exacto lo actualiza la función process... específica
                }
            } catch (err) {
                console.error(err);
                // Solo mostrar error visual si NO hay archivos cargados previamente
                // Si ya hay archivos, asumimos que el usuario quiere seguir viendo su lista
                if(statusEl && !statusEl.innerHTML.includes('svg')) {
                    statusEl.innerText = "Error lectura";
                    statusEl.classList.remove('text-blue-500', 'animate-pulse');
                    statusEl.classList.add('text-red-500');
                } else {
                    // Restaurar estado visual (volver a pintar la lista verde)
                    // Esto requiere volver a llamar a updateFileList desde el contexto adecuado, 
                    // pero como catch es genérico, simplemente quitamos la animación de carga.
                    if(statusEl) statusEl.classList.remove('animate-pulse');
                }
            }
        };
        
        // Leer según tipo
        if(type === 'csv') reader.readAsText(file, 'ISO-8859-1'); 
        else reader.readAsArrayBuffer(file);
    },

    // Función auxiliar para buscar en todas las columnas
    matchAny: function(data, filterParams) {
        // filterParams.value es lo que escribió el usuario
        const term = filterParams.value.toLowerCase();
        // Recorre todos los valores de la fila
        return Object.values(data).some(val => {
            return String(val).toLowerCase().includes(term);
        });
    },

    // --- POPUP CON MOTOR VANILLA GRID ---
    getPopupData: function(type) {
        console.log("--> SOLICITANDO POPUP:", type);
        if (type === 'scotia_pagado') {
            console.log("--> RETORNANDO DATA:", this.data.scotia_pagado);
            return this.data.scotia_pagado;
        }
        // Ya vienen con formato de Grid (llaves "0", "1"...) y no necesitan conversión.
        if (type === 'scotia_detalle') return this.data.scotia_detalle;

        const isDet = type === 'detalle';
        const rawData = isDet ? this.data.detalle : this.data.pagado;
        
        if(isDet && Array.isArray(rawData[0])) {
            return rawData.map(row => {
                const obj = {};
                row.forEach((val, idx) => {
                    let finalVal = val;

                    // A. CORRECCIÓN DE FECHAS (Columna 0)
                     if(idx === 0 && val) {
                        finalVal = window.ConciliacionLogic.formatDateCR(val);
                    }

                    // B. CORRECCIÓN DE NÚMEROS (Columnas 8 a 12)
                    // Convertir "1000.50" (string) a 1000.50 (number) para que el formatter funcione
                    if([8, 9, 10, 11, 12].includes(idx)) {
                        // Limpiar comillas, espacios y convertir a Float
                        let clean = String(val).replace(/["'\s]/g, '');
                        let num = parseFloat(clean);
                        // Si es número válido, lo asignamos. Si no, dejamos 0.
                        finalVal = isNaN(num) ? 0 : num;
                    }

                    obj[idx] = finalVal;
                });
                return obj;
            });
        }
        return rawData;
    },

    openPopup: function(type) {
        // 1. Variables y Datos
        const isDet = type === 'detalle';
        const isScotia = type === 'scotia_detalle';
        
        let rawData;
        if (isDet) rawData = this.data.detalle;
        else if (isScotia) rawData = this.data.scotia_detalle;
        else if (type === 'scotia_pagado') rawData = this.data.scotia_pagado; 
        else rawData = this.data.pagado;
        
        if (!rawData || !rawData.length) return alert("Sin datos para mostrar");

        // 2. DECLARACIÓN (Aquí debe nacer la variable)
        let columns = []; 
        if (isDet) {
            const realHeaders = this.data.headers && this.data.headers.detalle ? this.data.headers.detalle : [];
            
            columns = [
                { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false }
            ];

            let aciAdded = false; // Bandera de control

            realHeaders.forEach((h, idx) => {
                const headerStr = String(h).trim();
                const upper = headerStr.toUpperCase();
                
                // REGLAS DE FORMATO:
                // 1. Liquidación -> TEXTO (Sin formatter)
                // 2. Montos (Neto, Bruto, Comision, Ajuste, Retencion) -> MONEDA
                
                const isLiq = upper.includes('LIQUIDACION') || upper.includes('REFERENCIA');
                // Regex para detectar campos monetarios
                const isMoney = !isLiq && /MONTO|NETO|BRUTO|COMISION|RETENCION|AJUSTE/i.test(upper);

                // Agregar columna original
                columns.push({
                    title: headerStr,
                    field: String(idx),
                    headerFilter: true,
                    width: isMoney ? 130 : 160,
                    // Si es dinero -> 'money'. Si es Liquidación -> undefined (texto plano)
                    formatter: isMoney ? "money" : undefined, 
                    hozAlign: isMoney ? "right" : "left",
                    cssClass: isMoney ? "font-mono" : ""
                });

                // INYECCIÓN AGRESIVA: Si dice "NETO", ponemos "Neto-ACI" al lado
                if (!aciAdded && upper.includes('NETO')) {
                    columns.push({
                        title: "Neto - ACI", 
                        field: "_netoACI", 
                        formatter: "money", 
                        hozAlign: "right",
                        width: 140,
                        headerFilter: true,
                        cssClass: "font-mono font-bold text-blue-700 bg-blue-50 border-l-2 border-blue-200" 
                    });
                    aciAdded = true;
                }
            });

            // FALLBACK: Si no encontró la palabra "NETO", agregar al final
            if (!aciAdded) {
                columns.push({
                    title: "Neto - ACI (Calc)", 
                    field: "_netoACI", 
                    formatter: "money", 
                    hozAlign: "right",
                    width: 140,
                    cssClass: "font-bold text-blue-700 bg-blue-50"
                });
            }
        } else if (isScotia) {
             const realHeaders = this.data.headers.scotia_detalle || [];
             columns = [
                 { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                 
                 // CORRECCIÓN CRÍTICA: Usamos 'idx' como field
                 ...realHeaders.map((h, idx) => ({
                     title: h, 
                     field: String(idx), 
                     headerFilter: true,
                     width: 130,
                     formatter: (h.includes('Monto') || h.includes('%')) ? 'money' : undefined,
                     hozAlign: (h.includes('Monto') || h.includes('%')) ? 'right' : 'left'
                 }))
             ];
        } else if (type === 'scotia_pagado') {
             const realHeaders = this.data.headers.scotia_pagado || []; 
             columns = [
                 { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                 { title: "ID Extraído", field: "_extractedId", headerFilter: true, width: 120, cssClass:"bg-blue-50 font-bold text-xs" },
                 
                 // CORRECCIÓN VISUAL: Usamos String(idx) para encontrar los datos
                 ...realHeaders.map((h, idx) => ({
                     title: h, 
                     field: String(idx), 
                     headerFilter: true,
                     formatter: (h.toLowerCase().includes('monto')) ? 'money' : undefined,
                     hozAlign: (h.toLowerCase().includes('monto')) ? 'right' : 'left'
                 }))
             ];

        } else {
            // EXCEL GENÉRICO (BAC PAGADO): Usar headers reales si existen
            const realHeaders = this.data.headers.pagado || [];
            
            if (realHeaders.length > 0) {
                 columns = [
                    { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false }
                ];
                
                // Mapeo defensivo
                realHeaders.forEach((h, idx) => {
                    if (h && String(h).trim() !== '') {
                        columns.push({
                            title: h, 
                            field: String(idx), // Índice real
                            headerFilter: true,
                            formatter: (String(h).toLowerCase().match(/monto|crédito|débito|saldo|importe/)) ? 'money' : undefined,
                            hozAlign: (String(h).toLowerCase().match(/monto|crédito|débito|saldo|importe/)) ? 'right' : 'left'
                        });
                    }
                });

            } else {
                // Fallback (solo si algo falla en la carga de headers)
                const rawCols = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
                columns = [
                    { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                    ...rawCols.map(k => ({ title: k, field: k, headerFilter: true }))
                ];
            }
        }

        const w = 1200, h = 800;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        const win = window.open("", "_blank", `width=${w},height=${h},top=${top},left=${left}`);
        if(!win) return alert("Ventana bloqueada.");

        const isDark = document.documentElement.classList.contains('dark');
        const bg = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800';
        
        // Estilos Adaptables
        const headerClass = isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-100 text-blue-700';
        const cardClass = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300';
        const inputClass = isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800';

        win.document.write(`
            <!DOCTYPE html>
            <html lang="es" class="${isDark ? 'dark' : ''}">
            <head>
                <meta charset="UTF-8">
                <title>Detalle - ANC Finanzas</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script>
                    tailwind.config = { 
                        darkMode: 'class',
                        theme: {
                            extend: {
                                animation: { 'fade-in-up': 'fadeInUp 0.4s ease-out forwards' },
                                keyframes: { fadeInUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } }
                            }
                        }
                    }
                </script>
                <script src="/js/vanilla_grid.js"></script>
                <style>
                    ::-webkit-scrollbar { width: 10px; height: 10px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 5px; border: 2px solid #f8fafc; }
                    ::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                    .dark ::-webkit-scrollbar-thumb { background-color: #475569; border-color: #0f172a; }
                    body { font-family: ui-sans-serif, system-ui, sans-serif; }
                </style>
            </head>
            <body class="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 h-screen flex flex-col overflow-hidden p-4 select-none animate-fade-in-up">
                
                <!-- HEADER CON BUSCADOR -->
                <div class="flex justify-between items-center mb-4 gap-4">
                    <div class="flex items-center gap-4">
                        <div>
                            <h1 class="text-xl font-bold flex items-center gap-2">
                                ${isDet ? '<span class="text-red-600">📄</span> Detalle (CSV)' : '<span class="text-green-600">📊</span> Pagado (Excel)'}
                            </h1>
                        </div>
                    </div>

                    <!-- BUSCADOR GLOBAL INYECTADO -->
                    <div class="flex-grow max-w-md relative">
                        <div class="absolute inset-y-0 left-0 flex items-center justify-center w-10 pointer-events-none">
                            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input type="text" id="popup-search" 
                            class="block w-full p-2 pl-10 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white" 
                            placeholder="Buscar en esta tabla">
                    </div>

                    <button onclick="window.close()" class="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded text-sm font-bold transition-colors whitespace-nowrap">
                        Cerrar Ventana
                    </button>
                </div>

                <div id="popup-grid" class="flex-grow overflow-hidden relative shadow-lg rounded-lg border border-slate-300 dark:border-slate-700"></div>

                <div id="global-table-stats" class="fixed bottom-0 left-0 w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 py-1 px-4 flex justify-end items-center gap-6 text-xs font-mono hidden z-50">
                    <div class="text-slate-500">SELECCIÓN:</div>
                    <div class="flex gap-2"><span class="text-slate-500">CNT:</span><span id="gst-count" class="font-bold">0</span></div>
                    <div class="flex gap-2"><span class="text-slate-500">SUM:</span><span id="gst-sum" class="font-bold">0</span></div>
                </div>

                <script>
                    window.onload = function() {
                        if(window.opener && window.opener.ConciliacionLogic) {
                            const data = window.opener.ConciliacionLogic.getPopupData('${type}');
                            const columns = ${JSON.stringify(columns)};
                            
                            setTimeout(() => {
                                // Instanciamos el Grid pasando solo el ID del buscador y las opciones
                                new VanillaGrid("#popup-grid", data, columns, { 
                                    threshold: 0,
                                    searchInputId: "popup-search", 
                                    autoFocusSearch: true,         
                                    // Callback REACTIVO en tiempo real
                                    onCheckboxChange: (row, field, val) => {
                                        if(window.opener && window.opener.ConciliacionLogic) {
                                            // Llamamos al orquestador para que todo el sistema se sincronice
                                            // (BAC afecta a TSD, Scotia afecta a TSD, etc.)
                                            window.opener.ConciliacionLogic.updateAll();
                                        }
                                    }
                                });
                            }, 50);
                        } else {
                            document.body.innerHTML = '<div class="p-10 text-red-500">Error: Conexión perdida.</div>';
                        }
                    };
                </script>
            </body>
            </html>
        `);
        win.document.close();
    },

    // Formateador de fechas a estándar CR (DD/MM/YYYY)
    formatDateCR: function(val) {
        if (!val) return "";
        let str = String(val).trim().split(' ')[0]; // Quitar horas si existen

        // 1. Si es número de serie de Excel (ej: 45310 -> 18/01/2026)
        if (!isNaN(str) && Number(str) > 10000 && Number(str) < 99999) {
            const date = new Date((Number(str) - 25569) * 86400 * 1000);
            const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
            const d = String(utcDate.getDate()).padStart(2, '0');
            const m = String(utcDate.getMonth() + 1).padStart(2, '0');
            return `${d}/${m}/${utcDate.getFullYear()}`;
        }

        // 2. Si ya trae separadores (CSV)
        if (str.includes('/') || str.includes('-')) {
            const parts = str.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                } else if (parts[2].length === 4) { // DD/MM/YYYY o MM/DD/YYYY
                    let d = parseInt(parts[0]);
                    let m = parseInt(parts[1]);
                    if (m > 12) { let temp = d; d = m; m = temp; } 
                    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${parts[2]}`;
                }
            }
        }

        // 3. Cadenas numéricas pegadas
        if (str.length === 8 && !isNaN(str)) {
             if (str.startsWith('20')) return `${str.substring(6,8)}/${str.substring(4,6)}/${str.substring(0,4)}`;
             else return `${str.substring(0,2)}/${str.substring(2,4)}/${str.substring(4,8)}`;
        }

        return str;
    },

    formatMoney: function(val) { 
        // Forzamos formato CR: ₡ 1 000,00
        // Intl 'es-CR' a veces usa punto para miles. Lo corregimos manualmente.
        let fmt = new Intl.NumberFormat('es-CR', {
            style: 'currency', 
            currency: 'CRC',
            minimumFractionDigits: 2
        }).format(val);
        
        // Si el sistema generó puntos para miles (ej: 1.000,00), los cambiamos por espacio
        if (fmt.includes('.') && fmt.includes(',')) {
            fmt = fmt.replace(/\./g, ' ');
        }
        return fmt;
    },
    moneyFormatter: function(cell) { return window.ConciliacionLogic.formatMoney(cell.getValue()); },
    diffFormatter: function(cell) {
        const val = cell.getValue();
        const el = cell.getElement();
        
        // Leer dinámicamente el input del DOM
        const thresholdInput = document.getElementById('threshold-input');
        const threshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

        // Reset estilos previos
        el.style.color = ""; el.style.backgroundColor = "";

        if(Math.abs(val) > threshold) { 
            // Rojo Alerta
            el.style.color = "#dc2626"; 
            el.style.fontWeight = "bold"; 
            el.style.backgroundColor = "rgba(220, 38, 38, 0.1)"; 
        }
        else if (val === 0) { 
            // Verde Perfecto
            el.style.color = "#16a34a"; 
            el.style.fontWeight = "bold"; 
        }
        return window.ConciliacionLogic.formatMoney(val);
    },
    exportResults: function() { if(this.table) this.table.download("xlsx", "Conciliacion.xlsx"); },

    // Actualiza el umbral en el grid específico
    updateThreshold: function(val, bank) {
        const num = (val === '' || val === null) ? 0 : parseFloat(val);
        
        if (bank === 'bac' && this.grids.bac) {
            this.grids.bac.updateOption('threshold', num);
        } else if (bank === 'scotia' && this.grids.scotia) {
            this.grids.scotia.updateOption('threshold', num);
        } else {
            // Fallback (actualizar ambos si no se especifica)
            if (this.grids.bac) this.grids.bac.updateOption('threshold', num);
            if (this.grids.scotia) this.grids.scotia.updateOption('threshold', num);
        }
    },

    // Retorna un Set con todos los IDs normalizados de los bancos
    getBankAuths: function() {
        const auths = new Set();
        
        // BAC Detalle (Columna Referencia/Auth)
        if(this.data.detalle) {
            // Asumimos que la col 11 (o busca 'autoriza') es la clave
            const h = this.data.headers.detalle || [];
            const idx = h.findIndex(s => s && s.toLowerCase().includes('autoriza')) || 11;
            this.data.detalle.forEach(r => {
                if(r._enabled && r[idx]) auths.add(String(r[idx]).trim().replace(/[^a-zA-Z0-9]/g, ''));
            });
        }

        // Scotia Detalle
        if(this.data.scotia_detalle) {
            const h = this.data.headers.scotia_detalle || [];
            const idx = h.findIndex(s => s && s.toLowerCase().includes('autoriza'));
            this.data.scotia_detalle.forEach(r => {
                if(r._enabled) {
                    const val = r[String(idx)];
                    if(val) auths.add(String(val).trim().replace(/[^a-zA-Z0-9]/g, ''));
                }
            });
        }
        return auths;
    },

    // ORQUESTADOR MAESTRO DE ACTUALIZACIÓN
    updateAll: function() {
        console.log("🔄 Recalculando Sistema Completo...");

        // 1. Recalcular Bancos (Actualiza sus tablas y sus totales en memoria)
        // Nota: Estas funciones ya actualizan sus propias tarjetas y grids
        if(typeof this.recalculateDetalle === 'function') this.recalculateDetalle(); // BAC Detalle -> Tabla BAC
        if(typeof this.recalculateBACPagado === 'function') this.recalculateBACPagado(); // BAC Pagado -> Tabla BAC
        
        this.updateScotiaCard(); // Scotia Detalle (Tarjeta)
        this.recalculateScotiaPagado(); // Scotia Pagado (Tarjeta) -> Tabla Scotia (runMatchScotiabank)

    },

    // ==========================================================
    // MÓDULO DE PERSISTENCIA (GUARDADO INDEPENDIENTE)
    // ==========================================================
    preparePayload: function(bancoObjetivo) {
        const payload = {
            fecha_cierre: document.getElementById('process-date').value,
            transacciones: []
        };
        const processedUids = new Set();

        const processGroup = (group, banco) => {
            const diff = group.diferencia_val !== undefined ? group.diferencia_val : group.diff;
            const isMatch = Math.abs(diff) < 1 || group._isManual === true;
            const estado = isMatch ? 'CONCILIADO' : 'PENDIENTE';
            const idMatch = isMatch ? group.uuid : null; 

            (group.rowsDet || []).forEach(r => {
                if (processedUids.has(r._uid)) return;
                processedUids.add(r._uid);
                payload.transacciones.push(this.formatTransactionRecord(r, banco, 'DETALLADO', estado, idMatch));
            });

            (group.rowsPag || []).forEach(r => {
                if (processedUids.has(r._uid)) return;
                processedUids.add(r._uid);
                payload.transacciones.push(this.formatTransactionRecord(r, banco, 'PAGADO', estado, idMatch));
            });
        };

        // ESCANEAR SOLO EL BANCO SELECCIONADO
        if (bancoObjetivo === 'bac' && this.data.processed && this.data.processed.bac_matches) {
            Object.values(this.data.processed.bac_matches).forEach(g => processGroup(g, 'BAC'));
            
            if (this.deferredRows) {
                (this.deferredRows.det || []).forEach(r => {
                    if(!processedUids.has(r._uid)) {
                        processedUids.add(r._uid);
                        payload.transacciones.push(this.formatTransactionRecord(r, 'BAC', 'DETALLADO', 'PENDIENTE', null));
                    }
                });
                (this.deferredRows.pag || []).forEach(r => {
                    if(!processedUids.has(r._uid)) {
                        processedUids.add(r._uid);
                        payload.transacciones.push(this.formatTransactionRecord(r, 'BAC', 'PAGADO', 'PENDIENTE', null));
                    }
                });
            }
        }

        if (bancoObjetivo === 'scotia' && this.data.processed && this.data.processed.scotia_matches) {
            Object.values(this.data.processed.scotia_matches).forEach(g => processGroup(g, 'SCOTIA'));
        }

        return payload;
    },

    formatTransactionRecord: function(r, banco, defaultOrigen, estado, idMatch) {
        const isAjuste = r._isAdjustment === true;
        const origen = isAjuste ? 'AJUSTE' : defaultOrigen;

        // Rescate de Referencia para los Pagados (Como no van a la tabla detalle, lo guardamos en Autorizacion)
        let authVal = r._auth;
        if (defaultOrigen === 'PAGADO') authVal = r._liqRef || r.Lote || r._auth || null;

        let record = {
            IdTransaccion: r._uid, Banco: banco, Origen: origen, Estado: estado, IdMatch: idMatch,
            Afiliado_MerID: r._id || r._extractedId || null, Autorizacion: authVal, 
            MontoBruto: r._venta || r._bruto || r._monto || 0,
            MontoNeto: r._netoACI !== undefined ? r._netoACI : (r._neto !== undefined ? r._neto : (r._monto || 0)),
            ArchivoOrigen: r._sourceFile || 'Sistema Local',
            TipoAjuste: r._adjType || null, Justificacion: r._adjReason || r._manualReason || null, EvidenciaB64: r._adjEvidence || null,
            Liquidacion: r._liq || r._liqRef || null, Comision: r._comision || r['Monto Comisión'] || 0,
            RetencionVentas: r._retV || 0, RetencionRenta: r._retR || 0, AjusteACI: (r._neto && r._netoACI) ? (r._neto - r._netoACI) : (r._aciOrig || 0),
            Lote: r._mode === 'AJUSTE' ? 'AJUSTE' : null, RetencionIVA: r['Retención IVA'] || 0, RetencionISR: r['Retención IS'] || r['Retención ISR'] || 0
        };

        if (banco === 'SCOTIA' && origen !== 'PAGADO') {
            const headSc = this.data.headers.scotia_detalle || [];
            const idxLote = headSc.findIndex(h => h && h.toLowerCase().includes('lote'));
            const idxAuth = headSc.findIndex(h => h && h.toLowerCase().includes('autori'));
            if (idxLote !== -1 && r[idxLote]) record.Lote = String(r[idxLote]).trim();
            if (idxAuth !== -1 && r[idxAuth]) record.Autorizacion = String(r[idxAuth]).trim();
        }
        if (banco === 'BAC' && origen !== 'PAGADO' && !record.Autorizacion) {
             const headBac = this.data.headers.detalle || [];
             const idxAuth = headBac.findIndex(h => h && h.toLowerCase().includes('autori'));
             if (idxAuth !== -1 && r[idxAuth]) record.Autorizacion = String(r[idxAuth]).trim();
        }

        // --- NUEVO: CAPTURA INTELIGENTE DE TARJETA PARA EL MÓDULO TSD ---
        let tarjetaVal = r._tarjeta || null; // Prioridad 1: Ajustes manuales del popup
        if (!isAjuste && origen !== 'PAGADO') {
            const headArr = banco === 'BAC' ? (this.data.headers.detalle || []) : (this.data.headers.scotia_detalle || []);
            const idxTar = headArr.findIndex(h => h && h.toLowerCase().includes('tarjeta'));
            if (idxTar !== -1 && r[idxTar]) {
                // Limpiamos la tarjeta (quitamos espacios, guiones o asteriscos si quieres)
                tarjetaVal = String(r[idxTar]).replace(/[\s-]/g, '').trim();
            }
        }
        record.Tarjeta = tarjetaVal;
        // ----------------------------------------------------------------

        // BLINDAJE ABSOLUTO DE FECHAS PARA SQL SERVER (Debe ser YYYY-MM-DD)
        if (r._fecha) {
            let d = String(r._fecha).trim().split(' ')[0]; // Cortar la hora si viene pegada
            
            // Si trae formato Excel numérico por error (ej. 45310), usar nuestra función de rescate global
            if (!isNaN(d) && Number(d) > 10000) {
                d = this.formatDateCR(d); // Lo convierte a DD/MM/YYYY localmente
            }

            if (d.includes('/') || d.includes('-')) {
                let parts = d.split(/[\/-]/);
                if (parts.length === 3) {
                    // Determinar qué parte es el año
                    if (parts[0].length === 4) {
                        // Formato YYYY-MM-DD (Ya está perfecto, solo nos aseguramos del relleno)
                        record.FechaTransaccion = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
                    } else if (parts[2].length === 4) {
                        // Viene como DD/MM/YYYY o MM/DD/YYYY
                        let day = parseInt(parts[0]);
                        let month = parseInt(parts[1]);
                        
                        // Heurística de Scotiabank: Si el "mes" es mayor a 12, es porque está al revés (Formato Gringo: M/D/Y)
                        if (month > 12) { 
                            let temp = day; 
                            day = month; 
                            month = temp; 
                        }
                        
                        record.FechaTransaccion = `${parts[2]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    } else {
                        record.FechaTransaccion = null; // Formato incomprensible, mandar nulo para no crashear
                    }
                } else {
                    record.FechaTransaccion = null;
                }
            } else {
                record.FechaTransaccion = null; // Cadena sucia, mandar nulo
            }
        } else { 
            record.FechaTransaccion = null; 
        }

        return record;
    },

    saveSnapshot: async function() {
        const bancoActual = this.activeTab; 

        const nombreBanco = bancoActual === 'bac' ? 'BAC Credomatic' : 'Davibank';
        const payload = this.preparePayload(bancoActual);
        
        if (payload.transacciones.length === 0) {
            return alert(`No hay transacciones procesadas de ${nombreBanco} para guardar.`);
        }

        // Calcular Estadísticas y Total de Dinero Conciliado
        const stats = { conciliados: 0, pendientes: 0 };
        let totalDinero = 0;

        payload.transacciones.forEach(t => {
            // Evaluamos ÚNICAMENTE el Detallado (Esperado) para no duplicar conteos con el Banco
            if (t.Origen === 'DETALLADO') {
                if (t.Estado === 'CONCILIADO') {
                    stats.conciliados++;
                    totalDinero += parseFloat(t.MontoNeto || 0);
                } else {
                    stats.pendientes++;
                }
            }
        });

        // Adjuntar el total calculado al payload para enviarlo a PHP
        payload.total_conciliado = totalDinero;

        // Se eliminó el símbolo '₡' manual porque formatMoney ya lo incluye nativamente
        const confMsg = `Se procederá a consolidar y aislar las excepciones en Base de Datos.\n\n` +
                        `• Transacciones Conciliadas: <b class="text-green-600">${stats.conciliados}</b>\n` +
                        `• Transacciones Pendientes: <b class="text-red-500">${stats.pendientes}</b>\n` +
                        `• Total Procesado: <b class="text-blue-600">${this.formatMoney(totalDinero)}</b>`;

        if (!(await SysUI.confirm(confMsg, `¿Registrar Cierre de ${nombreBanco}?`, "warning"))) return;

        const btn = document.getElementById('btn-save-snapshot');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = 'Guardando...';
        btn.disabled = true;

        try {
            const res = await fetch('api/save_conciliacion.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (data.success) {
                // Éxito: Limpiamos borrador, mostramos mensaje y reiniciamos la vista limpiamente
                localStorage.removeItem('conciliacion_draft');
                await SysUI.alert(`Transacciones guardadas en Base de Datos: ${data.filas_insertadas}\nID de Cierre: #${data.id_cierre}`, `✅ Cierre de ${nombreBanco} Exitoso`, "success");
                
                window.ConciliacionLogic.resetState();
                window.loadView('conciliacion', false); // Recargar pantalla automáticamente
            } else {
                throw new Error(data.error || "Error desconocido");
            }
        } catch (error) {
            console.error(error);
            alert("❌ Fallo al guardar: " + error.message);
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    },

    
};

// // --- SHIM LEGACY (Para botón "X" de estadísticas) ---
// window.TableFramework = {
//     clear: function() {
//         document.getElementById('global-table-stats').classList.add('hidden');
//         // VanillaGrid maneja su propia selección, solo ocultamos la barra visual.
//     }
// };

// 1. Inicializador (Punto de entrada desde el Router)
window.initConciliacion = function() { 
    // Usamos setTimeout para dar un respiro al renderizado del DOM
    setTimeout(() => {
        if(window.ConciliacionLogic) {
            window.ConciliacionLogic.init();
        }
    }, 100); 
};

// 2. Funciones Globales (Para onclicks en HTML)
window.ConciliacionFunctions = {
    openPopup: function(t) { 
        window.ConciliacionLogic.openPopup(t); 
    },
    
    switchTab: function(t) {
        window.ConciliacionLogic.switchTab(t);
    },
    
    updateThreshold: function(v, bank) {
        window.ConciliacionLogic.updateThreshold(v, bank);
    },
    
    exportToExcel: function() { 
        alert("Exportar pendiente."); 
    },
    
    saveSnapshot: function() {
        window.ConciliacionLogic.saveSnapshot();
    },

    forceLocalSave: function() {
        if(window.ConciliacionLogic) {
            window.ConciliacionLogic.saveDraftToLocal(true);
        }
    }
};

