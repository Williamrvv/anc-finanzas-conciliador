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

    // data: { detalle: [], pagado: [] },
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
                    if (m > 12) { let temp = d; d = m; m = temp; } // Intercambiar si es gringo
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
        
        // NUEVO: Extraer y enviar los encabezados reales para el Tooltip
        const headDet = this.data.headers && this.data.headers.detalle ? this.data.headers.detalle : [];
        const headPag = this.data.headers && this.data.headers.pagado ? this.data.headers.pagado : [];
        const jsonHeadersDet = JSON.stringify(headDet).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const jsonHeadersPag = JSON.stringify(headPag).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        
        const isDark = document.documentElement.classList.contains('dark');
        const bg = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800';
        
        // Aumentamos el tamaño para mejor UX sin ser pantalla completa
        const w = 1400, h = 850;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        const win = window.open("", "_blank", `width=${w},height=${h},top=${top},left=${left}`);
        
        // Detectar si ya está conciliado (Diferencia = 0 o es un grupo manual ya guardado)
        const diffVal = data.diferencia_val !== undefined ? data.diferencia_val : data.diff;
        const isReadOnly = Math.abs(diffVal) < 1 || data._isManual === true;
        
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
                        <span id="header-diff-display" class="text-xl font-mono font-bold ${Math.abs(diff) > 5 ? 'text-red-500' : 'text-green-500'}">
                            ${this.formatMoney(diff)}
                        </span>
                    </div>
                </div>

                <!-- CONTENIDO (GRID 2 COLUMNAS) -->
                <div class="grid grid-cols-2 gap-4 flex-grow overflow-hidden h-full">

                    <!-- DERECHA: BANCO -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
                        <!-- ... (mismo header banco) ... -->
                        <div class="${isDark ? 'bg-green-900/20 text-green-300 border-slate-700' : 'bg-green-50 text-green-700 border-green-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center">
                            <span>Pagado Bac (Recibido)</span>
                            <span class="bg-white dark:bg-slate-800 px-2 rounded text-[10px] shadow-sm">Total: ${this.formatMoney(data.pagado)}</span>
                        </div>
                        <div id="grid-banco" class="flex-grow relative bg-white dark:bg-slate-800"></div>
                    </div>
                    
                    <!-- IZQUIERDA: VENTAS + BOTÓN AJUSTE -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden relative">
                        <div class="${isDark ? 'bg-blue-900/20 text-blue-300 border-slate-700' : 'bg-blue-50 text-blue-700 border-blue-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center">
                            <span>Detallado Bac (Esperado)</span>
                            ${isReadOnly ? '' : `
                            <button id="btn-add-adj" class="bg-white hover:bg-blue-100 text-blue-600 border border-blue-200 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors shadow-sm">
                                <span class="text-lg leading-none">+</span> Agregar Ajuste
                            </button>
                            `}
                        </div>
                        <div id="grid-ventas" class="flex-grow relative bg-white dark:bg-slate-800"></div>
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
                        <div class="flex gap-3 items-center">
                            ${isReadOnly ? `
                                <span class="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 border border-green-200 dark:border-green-700">
                                    ✅ Transacción Conciliada
                                </span>
                            ` : `
                                <button id="btn-manual" disabled class="bg-purple-100 text-purple-400 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 cursor-not-allowed transition-colors border border-transparent">
                                    <span>🤝</span> Conciliar Manualmente
                                </button>
                            `}
                            <button onclick="window.close()" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm font-bold transition-colors shadow-sm">
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>

                <!-- MODAL AVANZADO DE INGRESO DE VENTA / AJUSTE -->
                <div id="modal-adj" class="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] hidden flex items-center justify-center overflow-y-auto p-4">
                    <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh]">
                        
                        <!-- Header Modal -->
                        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center shrink-0">
                            <div>
                                <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <span class="text-blue-600">➕</span> Ingresar Venta Faltante / Ajuste
                                </h3>
                                <p class="text-[10px] text-slate-500 mt-1">Complete los datos para inyectar una fila en el Detallado (Esperado).</p>
                            </div>
                            <button onclick="document.getElementById('modal-adj').classList.add('hidden')" class="text-slate-400 hover:text-red-500 transition-colors">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <!-- Body Modal (Scrollable) -->
                        <div class="p-6 overflow-y-auto flex-grow custom-scrollbar space-y-5">
                            
                            <!-- NUEVO: Destino y Tipo -->
                            <div class="grid grid-cols-1 gap-4 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                                <!-- Destino Oculto (Forzado a 'det') -->
                                <input type="hidden" id="fm-target" value="det">
                                
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Ajuste <span class="text-red-500">*</span></label>
                                    <select id="fm-type" class="w-full p-2 text-xs font-bold border rounded bg-white dark:bg-slate-900 dark:border-slate-600 outline-none focus:ring-1 focus:ring-purple-500 text-purple-700 dark:text-purple-300 shadow-sm">
                                        <option value="">-- Seleccione una opción --</option>
                                        <option value="Contracargo">Contracargo</option>
                                        <option value="Devolución">Devolución</option>
                                        <option value="Mantenimiento">Mantenimiento</option>
                                        <option value="Remisión">Remisión</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Bloque 1: Identificación -->
                            <div class="grid grid-cols-3 gap-4">
                                <div class="col-span-1">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Afiliado</label>
                                    <input type="text" id="fm-afil" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none">
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">N° Liquidación</label>
                                    <input type="text" id="fm-liq" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none font-mono">
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Comercial</label>
                                    <input type="text" id="fm-comercio" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none">
                                </div>
                            </div>

                            <!-- Bloque 2: Operación -->
                            <div class="grid grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Transac.</label>
                                    <input type="date" id="fm-ftrans" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Pago</label>
                                    <input type="date" id="fm-fpago" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">N° Tarjeta</label>
                                    <input type="text" id="fm-tarjeta" placeholder="****1234" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none font-mono">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Autorización</label>
                                    <input type="text" id="fm-auth" placeholder="000000" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none font-mono">
                                </div>
                            </div>

                            <!-- Bloque 3: Financiero (Calculadora) -->
                            <div>
                                <div class="flex items-center gap-2 mb-3">
                                    <div class="w-1/3">
                                        <label class="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Monto de Venta (MV)</label>
                                        <div class="relative">
                                            <span class="absolute left-2 top-1.5 text-slate-400 font-bold">₡</span>
                                            <input type="number" step="100" id="fm-mv" class="w-full p-1.5 pl-6 text-sm font-bold border-2 border-blue-300 dark:border-blue-600 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 focus:ring-0 outline-none transition-colors" placeholder="0.00">
                                        </div>
                                    </div>
                                    <div class="flex-grow text-[9px] text-slate-400 italic mt-3">Las retenciones se calculan solas. Si el destino es "Pagado (Banco)", el Monto Neto Final será lo depositado.</div>
                                </div>

                                <div class="grid grid-cols-4 gap-3">
                                    <div>
                                        <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Comisión (1.95%)</label>
                                        <input type="number" id="fm-com" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-red-600 dark:text-red-400 outline-none font-mono" placeholder="0.00">
                                    </div>
                                    <div>
                                        <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ret. Ventas (5.31%)</label>
                                        <input type="number" id="fm-retv" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-orange-600 dark:text-orange-400 outline-none font-mono" placeholder="0.00">
                                    </div>
                                    <div>
                                        <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ret. Rentas (1.76%)</label>
                                        <input type="number" id="fm-retr" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-orange-600 dark:text-orange-400 outline-none font-mono" placeholder="0.00">
                                    </div>
                                    <div>
                                        <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ajuste ACI</label>
                                        <input type="number" id="fm-aci" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-slate-700 dark:text-slate-300 outline-none font-mono" placeholder="0.00">
                                    </div>
                                </div>
                            </div>

                            <!-- Totalizador Final -->
                            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex justify-between items-center">
                                <span class="text-xs font-bold text-green-800 dark:text-green-400 uppercase">Monto Neto Final</span>
                                <span id="fm-neto-display" class="text-xl font-mono font-bold text-green-700 dark:text-green-300">₡0.00</span>
                            </div>

                            <!-- NUEVO: Auditoría (Justificación y Captura) -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Justificación (Auditoría)</label>
                                    <textarea id="fm-reason" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none h-20 resize-none" placeholder="Motivo del ajuste..."></textarea>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Evidencia Visual (Captura)</label>
                                    <div id="fm-evidence-zone" class="w-full h-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-slate-400 focus:outline-none focus:border-blue-500 focus:text-blue-500 transition-colors relative overflow-hidden" tabindex="0">
                                        <div id="fm-ev-text" class="text-[10px] text-center pointer-events-none">
                                            <span class="block text-lg mb-1">📋</span>
                                            Haz clic aquí y presiona <br> <kbd class="font-sans font-bold bg-white dark:bg-slate-800 px-1 rounded shadow-sm">Ctrl</kbd> + <kbd class="font-sans font-bold bg-white dark:bg-slate-800 px-1 rounded shadow-sm">V</kbd>
                                        </div>
                                        <img id="fm-ev-preview" class="absolute inset-0 w-full h-full object-contain hidden bg-slate-100 dark:bg-slate-800">
                                        <button id="fm-ev-clear" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hidden opacity-75 hover:opacity-100">×</button>
                                    </div>
                                    <input type="hidden" id="fm-evidence-b64">
                                </div>
                            </div>

                        </div>

                        <!-- Footer Modal -->
                        <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end gap-3 shrink-0">
                            <button onclick="document.getElementById('modal-adj').classList.add('hidden')" class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Cancelar</button>
                            <button id="btn-save-adj" class="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-md transition-all">Generar Registro</button>
                        </div>
                    </div>
                </div>

                <script>
                    const rawVentas = JSON.parse('${jsonVentas}');
                    const rawBanco = JSON.parse('${jsonBanco}');
                    const headersDet = JSON.parse('${jsonHeadersDet}');
                    const headersPag = JSON.parse('${jsonHeadersPag}');
                    const isReadOnly = ${isReadOnly};
                    
                    // Helper Formato Moneda nativo para el popup
                    const fmt = (n) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(n);

                    // --- HELPER 1: Tooltip de Ajustes Manuales ---
                    const generateTooltip = (row, isVenta) => {
                        const tipoAjuste = row._adjType || 'Ajuste Manual';
                        const justificacion = row._adjReason || 'Sin justificación proporcionada.';
                        const afil = row._id || row._extractedId || 'N/A';
                        const liq = row._liq || row._liqRef || 'N/A';
                        const comercio = row["3"] || (row._desc ? row._desc.replace(\`[\${tipoAjuste}] \`, '') : 'N/A');
                        const fTrans = row._fecha ? window.opener.ConciliacionLogic.formatDateCR(row._fecha) : 'N/A';
                        const fPago = row._fechaPago ? window.opener.ConciliacionLogic.formatDateCR(row._fechaPago) : 'N/A';

                        return \`
                            <div class="text-left min-w-[280px] max-w-[320px]">
                                <div class="border-b border-slate-200 dark:border-slate-600 pb-2 mb-2">
                                    <div class="font-bold text-slate-800 dark:text-white text-xs uppercase">\${tipoAjuste}</div>
                                    <div class="text-[9px] text-slate-500 dark:text-slate-400">Destino: \${isVenta ? 'Detallado (Ventas)' : 'Pagado (Banco)'}</div>
                                </div>
                                <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-slate-700 dark:text-slate-300 mb-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 p-1.5 rounded">
                                    <div><span class="text-slate-400 dark:text-slate-500 block">Afiliado:</span> <span class="font-mono font-bold">\${afil}</span></div>
                                    <div><span class="text-slate-400 dark:text-slate-500 block">Liquidación:</span> <span class="font-mono font-bold">\${liq}</span></div>
                                    <div class="col-span-2"><span class="text-slate-400 dark:text-slate-500 block">Comercio:</span> <span class="truncate block font-bold">\${comercio}</span></div>
                                    <div><span class="text-slate-400 dark:text-slate-500 block">F. Transacción:</span> \${fTrans}</div>
                                    <div><span class="text-slate-400 dark:text-slate-500 block">F. Pago:</span> \${fPago}</div>
                                    <div><span class="text-slate-400 dark:text-slate-500 block">Tarjeta:</span> <span class="font-mono">\${row._tarjeta || 'N/A'}</span></div>
                                    <div><span class="text-slate-400 dark:text-slate-500 block">Autorización:</span> <span class="font-mono">\${row._auth || 'N/A'}</span></div>
                                </div>
                                <div class="space-y-1 text-[10px] bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-700 mb-2">
                                    <div class="flex justify-between"><span>Monto Venta:</span> <span class="font-mono text-slate-800 dark:text-white">\${fmt(row._venta || 0)}</span></div>
                                    <div class="flex justify-between text-red-600 dark:text-red-400"><span>Comisión (1.95%):</span> <span class="font-mono">-\${fmt(row._comision || 0)}</span></div>
                                    <div class="flex justify-between text-orange-600 dark:text-orange-400"><span>Ret. Ventas (5.31%):</span> <span class="font-mono">-\${fmt(row._retV || 0)}</span></div>
                                    <div class="flex justify-between text-orange-600 dark:text-orange-400"><span>Ret. Rentas (1.76%):</span> <span class="font-mono">-\${fmt(row._retR || 0)}</span></div>
                                    <div class="flex justify-between text-slate-500 dark:text-slate-400"><span>Ajuste ACI:</span> <span class="font-mono">-\${fmt(row._aciOrig || 0)}</span></div>
                                    <div class="flex justify-between border-t border-slate-300 dark:border-slate-600 pt-1 mt-1 font-bold \${isVenta ? 'text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400'}">
                                        <span>NETO FINAL:</span> <span class="font-mono text-xs">\${fmt(isVenta ? row._netoACI : row._monto)}</span>
                                    </div>
                                </div>
                                <div>
                                    <div class="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Justificación:</div>
                                    <div class="text-[10px] text-slate-700 dark:text-slate-300 italic break-words whitespace-normal bg-white dark:bg-slate-700/30 p-1.5 rounded border-l-2 border-slate-400 dark:border-slate-500 shadow-sm">\${justificacion}</div>
                                    \${row._adjEvidence ? '<div class="text-[10px] text-blue-600 dark:text-blue-400 mt-2 font-bold flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> Incluye Evidencia Visual</div>' : ''}
                                </div>
                            </div>
                        \`;
                    };

                    // --- HELPER 2: Tooltip Extendido para Filas Normales (Scrollable & Smart) ---
                    const generateGenericTooltip = (row, isVenta) => {
                        const headers = isVenta ? headersDet : headersPag;
                        const origen = isVenta ? 'Detallado (Ventas)' : 'Pagado (Banco)';
                        
                        let html = \`
                            <div class="text-left min-w-[280px] max-w-[350px] text-[10px] flex flex-col max-h-[50vh]">
                                <div class="border-b border-slate-200 dark:border-slate-600 pb-2 mb-2 font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2 shrink-0">
                                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 
                                    Datos Originales <span class="text-[9px] text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-700 px-1.5 py-0.5 rounded">\${origen}</span>
                                </div>
                                <div class="overflow-y-auto custom-scrollbar pr-2 space-y-1.5 flex-grow">
                        \`;
                        
                        for(let key in row) {
                            // Ignorar objetos internos
                            if(typeof row[key] === 'object') continue;
                            
                            // BLOQUEO ANTIDUPLICADOS: Ocultar TODO lo que empiece con '_' 
                            // (porque ya viene en las columnas crudas '0','1'), excepto '_netoACI' que nosotros calculamos.
                            if(key.startsWith('_') && key !== '_netoACI') continue;
                            
                            let val = row[key];
                            if(val === null || val === undefined || val === '') continue;
                            
                            let displayKey = key;
                            
                            // Traductor de Headers
                            if (!isNaN(key) && headers[key]) {
                                displayKey = headers[key];
                            } else if (key === '_netoACI') {
                                displayKey = 'NETO (-ACI)';
                            }

                            const upperKey = displayKey.toUpperCase();

                            // 1. Formateo de Fechas CR (Aplica a cualquier columna que diga FECHA)
                            if (upperKey.includes('FECHA')) {
                                val = window.opener.ConciliacionLogic.formatDateCR(val);
                            } 
                            // 2. Formateo de Moneda Seguro (Evita NaN limpiando la data primero)
                            else if (/NETO|MONTO|VENTA|COMISI|RETENC|IMPORTE/i.test(upperKey)) {
                                let num = parseFloat(String(val).replace(/["'\\s₡,]/g, ''));
                                if (!isNaN(num)) {
                                    val = \`<span class="text-green-700 dark:text-green-400 font-bold">\${fmt(num)}</span>\`;
                                }
                            }

                            html += \`
                                <div class="flex flex-col border-b border-slate-100 dark:border-slate-700/50 pb-1">
                                    <span class="text-slate-400 dark:text-slate-500 font-bold uppercase text-[8px]">\${displayKey}</span> 
                                    <span class="text-slate-800 dark:text-slate-200 font-mono break-words whitespace-normal">\${val}</span>
                                </div>
                            \`;
                        }
                        html += '</div></div>';
                        return html;
                    };

                    // --- ELIMINAR AJUSTE MANUAL AL VUELO ---
                    window.deleteAdj = function(uid, target) {
                        if(!confirm("¿Eliminar este ajuste manual insertado?")) return;
                        if(target === 'det') {
                            gVentas.updateData(gVentas.displayData.filter(r => r._uid !== uid));
                        } else {
                            gBanco.updateData(gBanco.displayData.filter(r => r._uid !== uid));
                        }
                        updateCalc();
                        hideGlobalTooltip(); // Limpiar residuos visuales
                    };

                    // --- CONSTRUCCIÓN DE COLUMNAS INTELIGENTE ---
                    const colsVentas = [];
                    if(!isReadOnly) colsVentas.push({ title: "Sel", field: "_selected", formatter: "checkbox", hozAlign: "center", width: 40 });
                    
                    colsVentas.push(
                        { title: "Fecha", field: "_fecha", width: 80, cssClass: "text-[10px] text-slate-500", formatter: (cell) => window.opener.ConciliacionLogic.formatDateCR(cell.getValue()) },
                        { title: "Comercio", field: "3", headerFilter: true, width: 140, cssClass: "text-[10px] truncate" },
                        { title: "Liquidación", field: "_liq", headerFilter: true, width: 90, cssClass: "font-mono text-blue-700 font-bold text-[10px]" },
                        { title: "Neto (-ACI)", field: "_netoACI", formatter: "money", hozAlign: "right", cssClass: "font-bold" },
                        { 
                            title: "Origen / Detalles", field: "_sourceFile", width: 150, headerFilter: true,
                            formatter: (cell) => {
                                const row = cell.getRow();
                                if(row._isAdjustment) {
                                    const b64 = btoa(unescape(encodeURIComponent(generateTooltip(row, true))));
                                    return \`
                                        <div class="flex justify-between items-center w-full h-full">
                                            <div onmouseenter="showGlobalTooltip(this, '\${b64}')" onmouseleave="hideGlobalTooltip()" class="flex items-center gap-1 cursor-help">
                                                <span class="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-blue-200 dark:border-blue-700 truncate">\${row._adjType || 'Ajuste'} ℹ️</span>
                                            </div>
                                            \${isReadOnly ? '' : \`<button onclick="window.deleteAdj('\${row._uid}', 'det')" class="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 px-1 rounded shadow-sm transition-colors text-[10px]" title="Eliminar Ajuste">✖</button>\`}
                                        </div>
                                    \`;
                                }
                                
                                // Fila Normal -> Tooltip Genérico
                                const b64Gen = btoa(unescape(encodeURIComponent(generateGenericTooltip(row, true))));
                                return \`
                                    <div class="flex justify-between items-center w-full h-full group/info">
                                        <span class="text-[9px] text-slate-400 truncate w-[90px]" title="\${row._sourceFile}">\${row._sourceFile}</span>
                                        <div onmouseenter="showGlobalTooltip(this, '\${b64Gen}')" onmouseleave="hideGlobalTooltip()" class="text-blue-400 hover:text-blue-600 cursor-help transition-transform opacity-50 group-hover/info:opacity-100 bg-slate-100 dark:bg-slate-700 p-0.5 rounded">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        </div>
                                    </div>
                                \`;
                            }
                        }
                    );

                    const colsBanco = [];
                    if(!isReadOnly) colsBanco.push({ title: "Sel", field: "_selected", formatter: "checkbox", hozAlign: "center", width: 40 });
                    
                    colsBanco.push(
                        { title: "Fecha", field: "_fecha", width: 80, cssClass: "text-[10px] text-slate-500", formatter: (cell) => window.opener.ConciliacionLogic.formatDateCR(cell.getValue()) },
                        { title: "Afiliado", field: "_extractedId", headerFilter: true, width: 90, cssClass: "font-bold text-green-700" },
                        { title: "Ref (LIQ)", field: "_liqRef", headerFilter: true, width: 100, cssClass: "font-bold text-blue-700" },
                        { title: "Descripción", field: "_desc", headerFilter: true, width: 150, cssClass: "text-[10px] truncate" },
                        { title: "Créditos", field: "_monto", formatter: "money", hozAlign: "right", cssClass: "font-bold" },
                        { 
                            title: "Origen / Detalles", field: "_sourceFile", width: 150, headerFilter: true,
                            formatter: (cell) => {
                                const row = cell.getRow();
                                if(row._isAdjustment) {
                                    const b64 = btoa(unescape(encodeURIComponent(generateTooltip(row, false))));
                                    return \`
                                        <div class="flex justify-between items-center w-full h-full">
                                            <div onmouseenter="showGlobalTooltip(this, '\${b64}')" onmouseleave="hideGlobalTooltip()" class="flex items-center gap-1 cursor-help">
                                                <span class="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-green-200 dark:border-green-700 truncate">\${row._adjType || 'Ajuste'} ℹ️</span>
                                            </div>
                                            \${isReadOnly ? '' : \`<button onclick="window.deleteAdj('\${row._uid}', 'pag')" class="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 px-1 rounded shadow-sm transition-colors text-[10px]" title="Eliminar Ajuste">✖</button>\`}
                                        </div>
                                    \`;
                                }
                                
                                // Fila Normal -> Tooltip Genérico
                                const b64Gen = btoa(unescape(encodeURIComponent(generateGenericTooltip(row, false))));
                                return \`
                                    <div class="flex justify-between items-center w-full h-full group/info">
                                        <span class="text-[9px] text-slate-400 truncate w-[90px]" title="\${row._sourceFile}">\${row._sourceFile}</span>
                                        <div onmouseenter="showGlobalTooltip(this, '\${b64Gen}')" onmouseleave="hideGlobalTooltip()" class="text-blue-400 hover:text-blue-600 cursor-help transition-transform opacity-50 group-hover/info:opacity-100 bg-slate-100 dark:bg-slate-700 p-0.5 rounded">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        </div>
                                    </div>
                                \`;
                            }
                        }
                    );

                    // 1. Funciones Centrales
                    function updateCalc() {
                        let sumV = 0; let selV = [];
                        let globalSumV = 0; // Para el Header Superior
                        
                        if(gVentas && gVentas.displayData) {
                            gVentas.displayData.forEach(r => { 
                                const val = (r._netoACI || r._neto || 0);
                                globalSumV += val;
                                if(r._selected) { sumV += val; selV.push(r._uid); } 
                            });
                        }

                        let sumB = 0; let selB = [];
                        let globalSumB = 0; // Para el Header Superior
                        
                        if(gBanco && gBanco.displayData) {
                            gBanco.displayData.forEach(r => { 
                                const val = (r._monto || 0);
                                globalSumB += val;
                                if(r._selected) { sumB += val; selB.push(r._uid); } 
                            });
                        }

                        // --- Actualizar Diferencia Total Global (Arriba a la derecha) ---
                        currentGlobalDiff = globalSumV - globalSumB; // Asignamos a la variable global
                        const headerDiffEl = document.getElementById('header-diff-display');
                        if (headerDiffEl) {
                            headerDiffEl.innerText = fmt(currentGlobalDiff);
                            headerDiffEl.className = "text-xl font-mono font-bold " + (Math.abs(currentGlobalDiff) > 5 ? 'text-red-500' : 'text-green-500');
                        }

                        // --- Actualizar Calculadora de Selección Inferior ---
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
                    // Inicializamos con el valor matemático inyectado directamente desde la tabla
                    let currentGlobalDiff = ${diffVal}; 

                    // 2. Inicialización
                    window.onload = function() {
                        const opts = { onCheckboxChange: () => updateCalc() };
                        gVentas = new VanillaGrid("#grid-ventas", rawVentas, colsVentas, opts); 
                        gBanco = new VanillaGrid("#grid-banco", rawBanco, colsBanco, opts);     
                        
                        document.addEventListener('change', (e) => {
                            if(e.target.type === 'checkbox') setTimeout(updateCalc, 50);
                        });

                        // 3. Lógica Formulario Avanzado (Calculadora)
                        const elMV = document.getElementById('fm-mv');
                        const elCom = document.getElementById('fm-com');
                        const elRetV = document.getElementById('fm-retv');
                        const elRetR = document.getElementById('fm-retr');
                        const elAci = document.getElementById('fm-aci');
                        const elNetoDisp = document.getElementById('fm-neto-display');

                        const calcFinanzas = () => {
                            const mv = parseFloat(elMV.value) || 0;
                            const aci = parseFloat(elAci.value) || 0;
                            
                            if(document.activeElement === elMV || elCom.value === '') elCom.value = (mv * 0.0195).toFixed(2);
                            if(document.activeElement === elMV || elRetV.value === '') elRetV.value = (mv * 0.0531).toFixed(2);
                            if(document.activeElement === elMV || elRetR.value === '') elRetR.value = (mv * 0.0176).toFixed(2);

                            const com = parseFloat(elCom.value) || 0;
                            const rv = parseFloat(elRetV.value) || 0;
                            const rr = parseFloat(elRetR.value) || 0;

                            const netoPuro = mv - com - rv - rr;
                            const netoFinal = netoPuro - aci;

                            elNetoDisp.innerText = fmt(netoFinal);
                            return { mv, com, rv, rr, aci, netoPuro, netoFinal };
                        };

                        [elMV, elCom, elRetV, elRetR, elAci].forEach(el => el.addEventListener('input', calcFinanzas));

                        // 4. Eventos de Pegar Imagen (Ctrl+V)
                        const evZone = document.getElementById('fm-evidence-zone');
                        const evPreview = document.getElementById('fm-ev-preview');
                        const evB64 = document.getElementById('fm-evidence-b64');
                        const evText = document.getElementById('fm-ev-text');
                        const evClear = document.getElementById('fm-ev-clear');

                        evZone.addEventListener('paste', (e) => {
                            e.preventDefault();
                            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                            for (let index in items) {
                                const item = items[index];
                                if (item.kind === 'file' && item.type.startsWith('image/')) {
                                    const blob = item.getAsFile();
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        evPreview.src = event.target.result;
                                        evPreview.classList.remove('hidden');
                                        evB64.value = event.target.result;
                                        evText.classList.add('hidden');
                                        evClear.classList.remove('hidden');
                                    };
                                    reader.readAsDataURL(blob);
                                }
                            }
                        });

                        evClear.onclick = (e) => {
                            e.stopPropagation(); 
                            evPreview.src = '';
                            evPreview.classList.add('hidden');
                            evB64.value = '';
                            evText.classList.remove('hidden');
                            evClear.classList.add('hidden');
                        };

                        // 5. Abrir Modal y Autocompletar
                        document.getElementById('btn-add-adj').onclick = function() {
                            const srcAfil = rawBanco.length > 0 ? rawBanco[0]._extractedId : (rawVentas.length > 0 ? rawVentas[0]._id : '');
                            const srcLiq = rawBanco.length > 0 ? rawBanco[0]._liqRef : (rawVentas.length > 0 ? rawVentas[0]._liq : '');
                            
                            document.getElementById('fm-afil').value = srcAfil;
                            document.getElementById('fm-liq').value = srcLiq;
                            document.getElementById('fm-comercio').value = rawVentas.length > 0 ? (rawVentas[0]["3"] || '') : '';
                            
                            const today = new Date().toISOString().split('T')[0];
                            document.getElementById('fm-ftrans').value = today;
                            document.getElementById('fm-fpago').value = today;

                            // --- AUTOCOMPLETADO INTELIGENTE DEL MONTO ---
                            if (currentGlobalDiff !== 0) {
                                // Factor inverso matemático: Neto Inverso / Factor de Retenciones (0.9098)
                                let sugVenta = (currentGlobalDiff * -1) / 0.9098;
                                
                                document.getElementById('fm-mv').value = sugVenta.toFixed(2);
                                calcFinanzas(); // Forzar el recálculo visual inmediato
                            } else {
                                document.getElementById('fm-mv').value = '';
                                [elCom, elRetV, elRetR, elAci].forEach(el => el.value = '');
                                elNetoDisp.innerText = '₡0.00';
                            }

                            document.getElementById('modal-adj').classList.remove('hidden');
                        };

                        // 6. Guardar Ajuste / Crear Fila
                        document.getElementById('btn-save-adj').onclick = function() {
                            const type = document.getElementById('fm-type').value;
                            const target = document.getElementById('fm-target').value;
                            const reason = document.getElementById('fm-reason').value;
                            
                            if(!type) return alert("Debe seleccionar un Tipo de Ajuste.");
                            
                            const res = calcFinanzas();
                            if(res.mv === 0 && res.netoFinal === 0) return alert("Debe ingresar montos válidos.");

                            const newRow = {
                                _uid: 'man_' + Date.now(),
                                _isAdjustment: true,
                                _selected: true,
                                _sourceFile: 'Registro Manual',
                                _target: target,
                                _adjType: type,
                                _adjReason: reason,
                                _adjEvidence: evB64.value, 
                                _fecha: document.getElementById('fm-ftrans').value,
                                _fechaPago: document.getElementById('fm-fpago').value,
                                _tarjeta: document.getElementById('fm-tarjeta').value,
                                _auth: document.getElementById('fm-auth').value,
                            };

                            if (target === 'det') {
                                newRow._id = document.getElementById('fm-afil').value;
                                newRow._liq = document.getElementById('fm-liq').value;
                                newRow["3"] = document.getElementById('fm-comercio').value;
                                newRow._venta = res.mv;
                                newRow._comision = res.com;
                                newRow._retV = res.rv;
                                newRow._retR = res.rr;
                                newRow._aciOrig = res.aci; 
                                newRow._neto = res.netoPuro;
                                newRow._netoACI = res.netoFinal;

                                const newData = [...gVentas.displayData, newRow];
                                gVentas.updateData(newData);
                            } else {
                                newRow._extractedId = document.getElementById('fm-afil').value;
                                newRow._liqRef = document.getElementById('fm-liq').value;
                                newRow._desc = '[' + type + '] ' + document.getElementById('fm-comercio').value;
                                newRow._monto = res.netoFinal; 
                                
                                const newData = [...gBanco.displayData, newRow];
                                gBanco.updateData(newData);
                            }
                            
                            document.getElementById('modal-adj').classList.add('hidden');
                            [elMV, elCom, elRetV, elRetR, elAci, document.getElementById('fm-tarjeta'), document.getElementById('fm-auth'), document.getElementById('fm-reason')].forEach(e => e.value = '');
                            evClear.onclick(new Event('click')); 
                            
                            updateCalc();
                        };

                        // 7. Conciliar Manualmente
                        document.getElementById('btn-manual').onclick = function() {
                            const selection = updateCalc();
                            
                            if(window.opener && window.opener.ConciliacionLogic) {
                                let finalReason = "Conciliación Manual";
                                const adjVentas = gVentas.displayData.filter(r => r._selected && r._isAdjustment);
                                const adjBanco = gBanco.displayData.filter(r => r._selected && r._isAdjustment);
                                const adjustments = [...adjVentas, ...adjBanco];
                                
                                if(adjustments.length > 0) {
                                    const c = adjustments.length;
                                    const totalAjuste = adjustments.reduce((s, a) => s + (parseFloat(a._netoACI || a._monto) || 0), 0);
                                    finalReason = "Ajuste Manual (" + c + " fila/s) ₡ " + totalAjuste.toFixed(2);
                                } else {
                                    const userReason = prompt("Justificación (Opcional):", "Ajuste manual");
                                    if(userReason === null) return;
                                    if(userReason) finalReason = userReason;
                                }

                                if(adjustments.length > 0 && typeof window.opener.ConciliacionLogic.injectAdjustments === 'function') {
                                    window.opener.ConciliacionLogic.injectAdjustments(adjustments);
                                }

                                if(typeof window.opener.ConciliacionLogic.applyManualMatch === 'function') {
                                    window.opener.ConciliacionLogic.applyManualMatch(selection, finalReason);
                                } else {
                                    alert("El módulo actual aún no soporta Conciliación Manual.");
                                }
                                window.close();
                            }
                        };

                        // 8. Sincronización inicial
                        updateCalc();
                    };
                </script>
                
                <!-- Barra Status Autosuma -->
                <div id="global-table-stats" class="fixed bottom-[60px] left-0 w-full bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 py-1 px-4 flex justify-end items-center gap-6 text-xs font-mono hidden z-50 shadow-md">
                    <div class="text-slate-500">SELECCIÓN:</div>
                    <div class="flex gap-2"><span class="text-slate-500">CNT:</span><span id="gst-count" class="font-bold">0</span></div>
                    <div class="flex gap-2"><span class="text-slate-500">SUM:</span><span id="gst-sum" class="font-bold">0</span></div>
                </div>
                
                <!-- CONTENEDOR TOOLTIP FLOTANTE GLOBAL (Anti-Clipping) -->
                <div id="global-float-tooltip" class="fixed hidden bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-3 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-600 z-[99999] transform transition-opacity duration-200 opacity-0"></div>

                <script>
                    // Motor de Tooltip Global Interactivo
                    let hideTimeout = null;
                    const tt = document.getElementById('global-float-tooltip');

                    // Si el usuario pone el mouse SOBRE el propio tooltip, cancelamos el cierre.
                    tt.addEventListener('mouseenter', () => {
                        if (hideTimeout) clearTimeout(hideTimeout);
                    });

                    // Si el usuario saca el mouse del tooltip, lo escondemos.
                    tt.addEventListener('mouseleave', () => {
                        window.hideGlobalTooltip(true); // Cierre forzado
                    });

                    window.showGlobalTooltip = function(el, htmlB64) {
                        // Si estábamos a punto de cerrarlo, cancelar
                        if (hideTimeout) clearTimeout(hideTimeout);
                        
                        tt.innerHTML = decodeURIComponent(escape(atob(htmlB64)));
                        
                        // Habilitar interacción (pointer-events-auto) para que funcione el scroll
                        tt.classList.remove('pointer-events-none');
                        tt.classList.add('pointer-events-auto');
                        tt.classList.remove('hidden');
                        
                        // Calcular posición
                        const rect = el.getBoundingClientRect();
                        let top = rect.bottom + 5;
                        let left = rect.left;
                        
                        // Evitar desbordamiento
                        if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
                        // Ajuste inteligente: Si abajo no cabe, lo abrimos hacia arriba
                        if (top + 250 > window.innerHeight) top = rect.top - tt.offsetHeight - 5;
                        
                        tt.style.top = top + 'px';
                        tt.style.left = left + 'px';
                        
                        // Efecto fade in
                        setTimeout(() => tt.classList.remove('opacity-0'), 10);
                    };
                    
                    window.hideGlobalTooltip = function(force = false) {
                        const delay = force ? 50 : 300; // 300ms de gracia para llegar al tooltip
                        
                        hideTimeout = setTimeout(() => {
                            tt.classList.add('opacity-0');
                            tt.classList.remove('pointer-events-auto');
                            tt.classList.add('pointer-events-none');
                            setTimeout(() => {
                                // Doble chequeo por si el mouse volvió a entrar durante el fade-out
                                if(tt.classList.contains('opacity-0')) {
                                    tt.classList.add('hidden');
                                }
                            }, 200);
                        }, delay);
                    };
                </script>
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
