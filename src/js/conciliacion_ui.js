window.ConciliacionLogic = {
    data: { 
        detalle: [], 
        pagado: [], 
        scotia_detalle: [], 
        scotia_pagado: [], 
        // Estructura completa desde el inicio
        files: {
            bac_detalle: [],
            bac_pagado: [],
            scotia_detalle: [],
            scotia_pagado: [],
            tsd: []
        },
        
    },
    grids: { bac: null, scotia: null }, // <--- Almacén de instancias
    activeTab: 'bac', // Estado actual

    switchTab: function(tab) {
        this.activeTab = tab;
        
        const tabs = {
            bac: document.getElementById('tab-bac'),
            scotia: document.getElementById('tab-scotia'),
            tsd: document.getElementById('tab-tsd')
        };
        const workspaces = {
            bac: document.getElementById('workspace-bac'),
            scotia: document.getElementById('workspace-scotia'),
            tsd: document.getElementById('workspace-tsd')
        };

        // Blindaje
        if (!tabs.bac || !tabs.scotia || !tabs.tsd) return;

        const activeClass = "bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-white font-bold";
        // Ajustamos color según el tab activo (Rojo BAC, Rojo Scotia, Morado TSD)
        const getActiveColor = (t) => t === 'bac' ? 'text-red-600' : (t === 'scotia' ? 'text-slate-800 dark:text-white' : 'text-purple-600');
        
        const inactiveClass = "text-slate-500 hover:text-slate-700 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-800";

        // Reset y Activar
        Object.keys(tabs).forEach(k => {
            const isActive = k === tab;
            // Quitamos clases viejas
            tabs[k].className = `px-4 py-1.5 text-sm rounded transition-all ${isActive ? "bg-white shadow-sm font-bold dark:bg-slate-700 " + getActiveColor(k) : inactiveClass}`;
            
            if (workspaces[k]) {
                if (isActive) workspaces[k].classList.remove('hidden');
                else workspaces[k].classList.add('hidden');
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

    data: { detalle: [], pagado: [] },
    table: null,

    init: function() {
        // Fusión de Lógica Modular
        if(window.BACLogic) Object.assign(this, window.BACLogic);
        if(window.ScotiaLogic) Object.assign(this, window.ScotiaLogic);
        if(window.TSDLogic) Object.assign(this, window.TSDLogic);
        
        console.log("Sistema Conciliación Iniciado", this.processCSV ? "con BAC" : "SIN BAC");
        
        this.setupUploads();
        this.fetchExchangeRate();
    },

    

    // --- 1. CONFIGURACIÓN TABULATOR ---
    getTableConfig: function(data, columns) {
        return {
            data: data,
            columns: columns,
            
            // Layout
            layout: "fitColumns",
            height: "550px", // Altura fija para forzar scroll y footer sticky
            
            // Comportamiento Excel
            keybindings: true,
            selectableRange: 1,
            selectableRangeColumns: true,
            selectableRangeRows: true,
            clipboard: "copy",
            clipboardCopyRowRange: "range",
            clipboardCopyConfig: { columnHeaders: false },
            movableColumns: true,

            // EVENTO CLAVE: Conectar selección con TU barra de HTML
            rangeSelectionChanged: function(range) {
                window.ConciliacionLogic.calculateStats(range);
            },
            
            // Limpieza al perder foco (opcional)
            dataLoaded: function() {
                document.getElementById('global-table-stats')?.classList.add('hidden');
            }
        };
    },

    // --- 2. LÓGICA DE AUTOSUMA (Conectada a index.php) ---
    calculateStats: function(range) {
        // Usamos TUS IDs del index.php
        const bar = document.getElementById('global-table-stats');
        if(!bar) return; 

        const cells = range.getCells();
        
        // Ocultar si hay menos de 2 celdas
        if(cells.length < 2) {
            bar.classList.add('hidden');
            return;
        }

        let sum = 0;
        let countNums = 0;

        cells.forEach(cell => {
            const val = cell.getValue();
            let num = 0;
            
            // Limpieza financiera
            if(typeof val === 'number') num = val;
            else if(typeof val === 'string') {
                // Quitar simbolos, letras y normalizar (1.000,00 -> 1000.00)
                let clean = val.replace(/[₡\sA-Za-z]/g, '');
                if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
                else if (clean.includes(',')) clean = clean.replace(',', '.');
                num = parseFloat(clean);
            }

            if(!isNaN(num)) {
                sum += num;
                if(num !== 0) countNums++;
            }
        });

        // Formateador
        const fmt = new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'});

        // Inyectar en TUS IDs: gst-count, gst-sum, gst-avg
        document.getElementById('gst-count').innerText = cells.length;
        document.getElementById('gst-sum').innerText = fmt.format(sum);
        
        // Promedio (Opcional, si el elemento existe en el HTML lo llenamos)
        const avgEl = document.getElementById('gst-avg');
        if(avgEl) avgEl.innerText = countNums > 0 ? fmt.format(sum/countNums) : '-';
        
        bar.classList.remove('hidden');
    },

    // --- 3. PROCESAMIENTO DE ARCHIVOS ---
    setupUploads: function() {
        console.log("🔧 Configurando Delegación Global de Dropzones...");

        // Lista de IDs permitidos
        const zones = {
            'drop-bac-detalle': { input: 'file-bac-detalle', type: 'csv' },
            'drop-bac-pagado': { input: 'file-bac-pagado', type: 'excel' },
            'drop-scotia-detalle': { input: 'file-scotia-detalle', type: 'scotia_detalle' },
            'drop-scotia-pagado': { input: 'file-scotia-pagado', type: 'scotia_pagado' },
            'drop-tsd': { input: 'file-tsd', type: 'tsd' }
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
                // Buscar a qué dropzone pertenece este input
                const dropId = Object.keys(zones).find(k => zones[k].input === e.target.id);
                if (dropId) {
                    console.log(`📂 Archivo seleccionado en input: ${e.target.id}`);
                    const config = zones[dropId];
                    if(e.target.files[0]) {
                        this.handleFileProcessing(e.target.files[0], dropId, config.type);
                        e.target.value = ''; // Reset
                    }
                }
            }
        });

        // 3. DRAG & DROP DELEGADO
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                const drop = e.target.closest('[id^="drop-"]');
                // Si no es un dropzone, prevenir default para evitar que el navegador abra el archivo
                if (!drop || !zones[drop.id]) return;

                e.preventDefault();
                e.stopPropagation();

                if (eventName === 'drop') {
                    const config = zones[drop.id];
                    if(e.dataTransfer.files[0]) {
                        this.handleFileProcessing(e.dataTransfer.files[0], drop.id, config.type);
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

        if (type === 'tsd') return this.data.tsd;

        const isDet = type === 'detalle';
        const rawData = isDet ? this.data.detalle : this.data.pagado;
        
        if(isDet && Array.isArray(rawData[0])) {
            return rawData.map(row => {
                const obj = {};
                row.forEach((val, idx) => {
                    let finalVal = val;

                    // A. CORRECCIÓN DE FECHAS (Columna 0)
                    // Asumimos formato inglés MM/DD/YYYY o YYYY-MM-DD -> DD/MM/YYYY
                    if(idx === 0 && val) {
                        const dateStr = String(val).trim();
                        // Intento simple de parseo
                        const parts = dateStr.split(/[-/]/); 
                        if(parts.length === 3) {
                            // Si es YYYY-MM-DD
                            if(parts[0].length === 4) finalVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
                            // Si es MM/DD/YYYY (común en CSVs )
                            else if(parts[2].length === 4) finalVal = `${parts[1]}/${parts[0]}/${parts[2]}`;
                        }
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
        else if (type === 'tsd') rawData = this.data.tsd; 
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
                     field: String(idx), // <--- ESTO ES LO IMPORTANTE (Match con row["0"])
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
                     field: String(idx), // <--- Coincide con rowObj["0"]
                     headerFilter: true,
                     formatter: (h.toLowerCase().includes('monto')) ? 'money' : undefined,
                     hozAlign: (h.toLowerCase().includes('monto')) ? 'right' : 'left'
                 }))
             ];
        } else if (type === 'tsd') {
             // Configuración TSD
             const realHeaders = this.data.headers.tsd || [];
             
             // Columnas Fijas
             columns = [
                 { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                 { title: "Auth", field: "_auth", headerFilter: true, width: 100, cssClass: "font-bold bg-purple-50" },
                 { title: "Monto Original", field: "_monto_usd", formatter: "money", hozAlign: "right" },
                 { title: "Monto CRC", field: "_monto", formatter: "money", hozAlign: "right", cssClass: "text-purple-700" }
             ];
             
             // Columnas Dinámicas (Defensivo contra huecos en headers)
             // Usamos forEach para asegurar que 'idx' sea el índice real del array original
             realHeaders.forEach((h, idx) => {
                 // Solo agregamos la columna si el header tiene texto (evita columnas fantasmas/null)
                 if (h && String(h).trim() !== '') {
                     columns.push({
                         title: h, 
                         field: String(idx), // Mantenemos el índice original como llave de datos
                         headerFilter: true, 
                         width: 120
                     });
                 }
             });

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
                <script>tailwind.config = { darkMode: 'class' }</script>
                <script src="/js/vanilla_grid.js"></script>
                <style>
                    /* Replico el scrollbar moderno aquí para consistencia visual */
                    ::-webkit-scrollbar { width: 10px; height: 10px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 5px; border: 2px solid #f8fafc; }
                    ::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                    .dark ::-webkit-scrollbar-thumb { background-color: #475569; border-color: #0f172a; }
                    body { font-family: ui-sans-serif, system-ui, sans-serif; }
                </style>
            </head>
            <body class="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 h-screen flex flex-col overflow-hidden p-4 select-none">
                
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

    recalculate: function() {
        // Recalcular Totales del Dashboard
        let total = 0;
        this.data.pagado.forEach(r => {
            if(r._enabled) total += r._monto;
        });
        document.getElementById('sum-depositos').innerText = this.formatMoney(total);
        
        // Correr el Match de nuevo (actualiza tabla principal)
        this.runMatch();
    },

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
        this.recalculateDetalle(); // BAC Detalle -> Tabla BAC
        this.recalculate(); // BAC Pagado -> Tabla BAC
        
        this.updateScotiaCard(); // Scotia Detalle (Tarjeta)
        this.recalculateScotiaPagado(); // Scotia Pagado (Tarjeta) -> Tabla Scotia (runMatchScotiabank)

        // 2. Recalcular TSD (Depende de los datos frescos de los bancos)
        // Si hay datos TSD cargados, corremos su cruce.
        if (this.data.tsd && this.data.tsd.length > 0) {
            this.runMatchTSD();
        }
    },

    // Modal de Detalles de Transacción (Cruce) - VERSIÓN VANILLA GRID
    openTransactionModal: function(data) {
        if(!data) return;

        // Datos del cruce
        const ventas = data.rowsDet || [];
        const banco = data.rowsPag || [];
        const diff = data.diff;
        
        // Preparar JSON
        const jsonVentas = JSON.stringify(ventas.map(v => ({...v, _selected: false}))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const jsonBanco = JSON.stringify(banco.map(b => ({...b, _selected: false}))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        
        const isDark = document.documentElement.classList.contains('dark');
        const bg = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800';
        
        const w = 1100, h = 600;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        const win = window.open("", "_blank", `width=${w},height=${h},top=${top},left=${left}`);
        
        if(!win) return alert("Ventana bloqueada.");

        win.document.write(`
            <!DOCTYPE html>
            <html class="${isDark ? 'dark' : ''}">
            <head>
                <title>Análisis: ${data.id}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script>tailwind.config = { darkMode: 'class' }</script>
                <script src="/js/vanilla_grid.js"></script>
                <style>
                    ::-webkit-scrollbar { width: 8px; height: 8px; }
                    ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
                    .dark ::-webkit-scrollbar-thumb { background-color: #475569; }
                </style>
            </head>
            <body class="${bg} p-4 flex flex-col h-screen overflow-hidden text-sm relative">
                
                <!-- HEADER (Igual) -->
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <!-- ... (mismo header) ... -->
                    <div>
                        <h1 class="text-xl font-bold flex items-center gap-2">
                            <span>🔎 Análisis de Transacción</span>
                            <span class="bg-blue-100 text-blue-800 text-sm px-2 py-0.5 rounded font-mono">${data.id}</span>
                        </h1>
                    </div>
                    <div class="text-right">
                        <span class="text-xs text-slate-400 uppercase font-bold mr-2">Diferencia Total:</span>
                        <span class="text-xl font-mono font-bold ${Math.abs(diff) > 5 ? 'text-red-500' : 'text-green-500'}">
                            ${this.formatMoney(diff)}
                        </span>
                    </div>
                </div>

                <!-- CONTENIDO (GRID 2 COLUMNAS) -->
                <div class="grid grid-cols-2 gap-4 flex-grow overflow-hidden h-full">
                    
                    <!-- IZQUIERDA: VENTAS + BOTÓN AJUSTE -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden relative">
                        <div class="${isDark ? 'bg-blue-900/20 text-blue-300 border-slate-700' : 'bg-blue-50 text-blue-700 border-blue-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center">
                            <span>Ventas Internas (Esperado)</span>
                            <button id="btn-add-adj" class="bg-white hover:bg-blue-100 text-blue-600 border border-blue-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors">
                                <span class="text-lg leading-none">+</span> Agregar Ajuste
                            </button>
                        </div>
                        <div id="grid-ventas" class="flex-grow relative bg-white dark:bg-slate-800"></div>
                    </div>

                    <!-- DERECHA: BANCO -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
                        <!-- ... (mismo header banco) ... -->
                        <div class="${isDark ? 'bg-green-900/20 text-green-300 border-slate-700' : 'bg-green-50 text-green-700 border-green-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center">
                            <span>Depósitos Bancarios (Recibido)</span>
                            <span class="bg-white dark:bg-slate-800 px-2 rounded text-[10px] shadow-sm">Total: ${this.formatMoney(data.pagado)}</span>
                        </div>
                        <div id="grid-banco" class="flex-grow relative bg-white dark:bg-slate-800"></div>
                    </div>
                </div>

                <!-- FOOTER ACTIVO (Igual) -->
                <!-- ... (mismo footer con calculadora) ... -->
                <div class="p-3 bg-slate-100 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700">
                    <div class="flex justify-between items-center">
                        <!-- CALCULADORA -->
                        <div class="flex items-center gap-4 text-sm">
                            <div class="flex flex-col">
                                <span class="text-[10px] text-slate-500 uppercase">Sel. Ventas</span>
                                <span id="sum-ventas" class="font-mono font-bold text-blue-600">₡0,00</span>
                            </div>
                            <div class="text-slate-400 font-bold">-</div>
                            <div class="flex flex-col">
                                <span class="text-[10px] text-slate-500 uppercase">Sel. Banco</span>
                                <span id="sum-banco" class="font-mono font-bold text-green-600">₡0,00</span>
                            </div>
                            <div class="text-slate-400 font-bold">=</div>
                            <div class="flex flex-col">
                                <span class="text-[10px] text-slate-500 uppercase">Diferencia</span>
                                <span id="sum-diff" class="font-mono font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-300">₡0,00</span>
                            </div>
                        </div>

                        <!-- BOTONES -->
                        <div class="flex gap-2">
                            <button id="btn-manual" disabled class="bg-purple-100 text-purple-400 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 cursor-not-allowed transition-colors border border-transparent">
                                <span>🤝</span> Conciliar Manualmente
                            </button>
                            <button id="btn-defer" class="bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 px-4 py-2 rounded text-sm font-bold transition-colors flex items-center gap-2">
                                <span>⏳</span> Diferir
                            </button>
                            <button onclick="window.close()" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm font-bold transition-colors">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- MODAL INTERNO DE AJUSTE -->
                <div id="modal-adj" class="absolute inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden flex items-center justify-center">
                    <div class="bg-white dark:bg-slate-800 rounded-lg shadow-2xl w-96 p-6 border border-slate-200 dark:border-slate-700">
                        <h3 class="text-lg font-bold mb-4 text-slate-800 dark:text-white">Agregar Ajuste Manual</h3>
                        
                        <div class="space-y-3">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Ajuste (Obligatorio)</label>
                                <select id="adj-type" multiple class="w-full p-2 text-sm border rounded bg-slate-50 dark:bg-slate-900 dark:border-slate-600 h-24">
                                    <option value="Contracargo">Contracargo</option>
                                    <option value="Devolución">Devolución</option>
                                    <option value="Mantenimiento">Mantenimiento</option>
                                    <option value="Ajuste Comisión">Ajuste por Comisión</option>
                                    <option value="Error Banco">Error del Banco</option>
                                </select>
                                <p class="text-[10px] text-slate-400 mt-1">Ctrl + Click para seleccionar varios</p>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Monto del Ajuste</label>
                                <input type="number" id="adj-amount" 
                                    class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded font-mono bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                                    placeholder="0.00">
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Justificación (Opcional)</label>
                                <textarea id="adj-reason" 
                                    class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded h-16 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors" 
                                    placeholder="Explique la razón..."></textarea>
                            </div>
                            
                            <div>
                                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Evidencia (Captura)</label>
                                <input type="file" id="adj-file" 
                                    class="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300 dark:hover:file:bg-blue-800 transition-colors cursor-pointer">
                            </div>
                        </div>

                        <div class="flex justify-end gap-2 mt-6">
                            <button onclick="document.getElementById('modal-adj').classList.add('hidden')" class="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                            <button id="btn-save-adj" class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-bold">Guardar Ajuste</button>
                        </div>
                    </div>
                </div>

                <script>
                    const rawVentas = JSON.parse('${jsonVentas}');
                    const rawBanco = JSON.parse('${jsonBanco}');
                    
                    // Definición de Columnas
                    const colsVentas = [
                        { title: "Sel", field: "_selected", formatter: "checkbox", hozAlign: "center", width: 40 },
                        { title: "Comercio", field: "3", headerFilter: true, width: 150, cssClass: "text-[10px]" },
                        { title: "Liquidación", field: "_liq", headerFilter: true, width: 100, cssClass: "font-mono text-blue-700 font-bold" },
                        { title: "Afiliado", field: "_id", headerFilter: true, width: 80, cssClass: "font-bold" },
                        { title: "Neto (-ACI)", field: "_netoACI", formatter: "money", hozAlign: "right" },
                        { 
                            title: "Archivo / Tipo", field: "_sourceFile", width: 100, headerFilter: true, cssClass: "text-[9px]",
                            formatter: (cell) => {
                                const row = cell.getRow();
                                if(row._isAdjustment) {
                                    // CORRECCIÓN: Usar comillas simples y concatenación (+) para no romper el template string del padre
                                    const types = row._adjTypes ? row._adjTypes.join(', ') : 'AJUSTE';
                                    const reason = row._adjReason || '';
                                    return '<span class="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-1 rounded font-bold text-[9px]" title="' + reason + '">' + types + '</span>';
                                }
                                return row._sourceFile;
                            }
                        }
                    ];

                    const colsBanco = [
                        { title: "Sel", field: "_selected", formatter: "checkbox", hozAlign: "center", width: 40 },
                        { title: "Afiliado", field: "_extractedId", headerFilter: true, width: 90, cssClass: "font-bold text-green-700" },
                        { title: "Ref (LIQ)", field: "_liqRef", headerFilter: true, width: 100, cssClass: "font-bold text-blue-700" },
                        { title: "Descripción", field: "_desc", headerFilter: true, width: 180, cssClass: "text-[10px]" },
                        { title: "Créditos", field: "_monto", formatter: "money", hozAlign: "right" },
                        { title: "Archivo", field: "_sourceFile", width: 80, headerFilter: true, cssClass: "text-[9px]" }
                    ];

                    // Helper Formato Moneda
                    const fmt = (n) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(n);

                    // Función de Recálculo
                    function updateCalc() {
                        let sumV = 0; let selV = [];
                        gVentas.displayData.forEach(r => { 
                            if(r._selected) { 
                                sumV += (r._netoACI || r._neto || 0); 
                                selV.push(r._uid); 
                            } 
                        });

                        let sumB = 0; let selB = [];
                        gBanco.displayData.forEach(r => { 
                            if(r._selected) { 
                                sumB += (r._monto || 0); 
                                selB.push(r._uid); 
                            } 
                        });

                        const diff = sumV - sumB;
                        
                        document.getElementById('sum-ventas').innerText = fmt(sumV);
                        document.getElementById('sum-banco').innerText = fmt(sumB);
                        const elDiff = document.getElementById('sum-diff');
                        elDiff.innerText = fmt(diff);
                        
                        const btn = document.getElementById('btn-manual');
                        const isValid = Math.abs(diff) < 1 && (selV.length > 0 || selB.length > 0);
                        
                        if(isValid) {
                            btn.disabled = false;
                            btn.className = "bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-colors shadow-md";
                            elDiff.className = "font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200";
                        } else {
                            btn.disabled = true;
                            btn.className = "bg-purple-100 text-purple-300 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 cursor-not-allowed border border-transparent";
                            elDiff.className = "font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200";
                        }
                        return { det: selV, pag: selB };
                    }

                    let gVentas, gBanco;
                    
                    window.onload = function() {
                        const opts = { onCheckboxChange: () => updateCalc() };
                        gVentas = new VanillaGrid("#grid-ventas", rawVentas, colsVentas, opts); 
                        gBanco = new VanillaGrid("#grid-banco", rawBanco, colsBanco, opts);     
                        
                        document.addEventListener('change', (e) => {
                            if(e.target.type === 'checkbox') setTimeout(updateCalc, 50);
                        });

                        // --- LÓGICA DE BOTONES ---

                        // 1. Abrir Modal Ajuste
                        document.getElementById('btn-add-adj').onclick = function() {
                            document.getElementById('modal-adj').classList.remove('hidden');
                        };

                        // 2. Guardar Ajuste
                        document.getElementById('btn-save-adj').onclick = function() {
                            const types = Array.from(document.getElementById('adj-type').selectedOptions).map(o => o.value);
                            const amount = parseFloat(document.getElementById('adj-amount').value);
                            const reason = document.getElementById('adj-reason').value;
                            
                            if(types.length === 0) return alert("Debe seleccionar al menos un Tipo de Ajuste.");
                            if(isNaN(amount) || amount === 0) return alert("Debe ingresar un monto válido (puede ser negativo).");

                            // Crear Fila Ficticia
                            const newRow = {
                                _uid: 'adj_' + Date.now(),
                                _id: 'AJUSTE',
                                _netoACI: amount,
                                _neto: amount,
                                _isAdjustment: true, // Flag importante
                                _adjTypes: types,
                                _adjReason: reason,
                                _selected: true, // Auto-seleccionar
                                _sourceFile: 'MANUAL'
                            };

                            // Inyectar en Grid Ventas
                            // VanillaGrid necesita actualizar data completa
                            const newData = [...gVentas.displayData, newRow];
                            gVentas.updateData(newData);
                            
                            // Cerrar modal y recalcular
                            document.getElementById('modal-adj').classList.add('hidden');
                            // Limpiar form
                            document.getElementById('adj-amount').value = '';
                            document.getElementById('adj-reason').value = '';
                            
                            updateCalc();
                        };

                        // 3. Conciliar Manualmente
                        document.getElementById('btn-manual').onclick = function() {
                            const selection = updateCalc();
                            
                            // Si hay ajustes manuales en la selección, los detectamos
                            // (Nota: La lógica de guardar estos ajustes en la BD real vendrá después)
                            
                            if(window.opener && window.opener.BACLogic) {
                                // Pasamos el motivo combinado si hay ajustes
                                let finalReason = "Conciliación Manual";
                                const adjustments = gVentas.displayData.filter(r => r._selected && r._isAdjustment);
                                if(adjustments.length > 0) {
                                    finalReason = "Ajuste: " + adjustments.map(a => a._adjTypes.join(', ')).join(' + ');
                                } else {
                                    const userReason = prompt("Justificación (Opcional):", "Ajuste manual");
                                    if(userReason === null) return;
                                    if(userReason) finalReason = userReason;
                                }

                                // IMPORTANTE: Si hay filas nuevas (ajustes), hay que enviarlas al padre para que las agregue a su memoria
                                if(adjustments.length > 0) {
                                    window.opener.BACLogic.injectAdjustments(adjustments);
                                }

                                window.opener.BACLogic.applyManualMatch(selection, finalReason);
                                window.close();
                            }
                        };

                        // 4. Diferir
                        document.getElementById('btn-defer').onclick = function() {
                            const selection = updateCalc();
                            const rowsToDefer = [];
                            // (Lógica de recolección igual a antes...)
                            gVentas.displayData.forEach(r => { if(r._selected) rowsToDefer.push({ type: 'venta', rawData: r }); });
                            gBanco.displayData.forEach(r => { if(r._selected) rowsToDefer.push({ type: 'banco', rawData: r }); });

                            if(rowsToDefer.length === 0) return alert("Seleccione filas para diferir.");

                            if(window.opener && window.opener.ConciliacionLogic) {
                                window.opener.ConciliacionLogic.deferRows(rowsToDefer);
                                window.close();
                            }
                        };
                    };
                </script>
                
                <!-- Barra Status Autosuma -->
                <div id="global-table-stats" class="fixed bottom-[60px] left-0 w-full bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 py-1 px-4 flex justify-end items-center gap-6 text-xs font-mono hidden z-50 shadow-md">
                    <div class="text-slate-500">SELECCIÓN:</div>
                    <div class="flex gap-2"><span class="text-slate-500">CNT:</span><span id="gst-count" class="font-bold">0</span></div>
                    <div class="flex gap-2"><span class="text-slate-500">SUM:</span><span id="gst-sum" class="font-bold">0</span></div>
                </div>
            </body>
            </html>
        `);
        win.document.close();
    },
};

// --- SHIM LEGACY (Para botón "X" de estadísticas) ---
window.TableFramework = {
    clear: function() {
        document.getElementById('global-table-stats').classList.add('hidden');
        // VanillaGrid maneja su propia selección, solo ocultamos la barra visual.
    }
};

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

    updateExchangeRate: function(v) {
        if(window.ConciliacionLogic && window.ConciliacionLogic.updateExchangeRate) {
            window.ConciliacionLogic.updateExchangeRate(v);
        }
    }
};
