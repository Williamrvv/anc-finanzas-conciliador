window.ConciliacionLogic = {
    data: { detalle: [], pagado: [], scotia_detalle: [], scotia_pagado: [] },
    grids: { bac: null, scotia: null }, // <--- Almacén de instancias
    activeTab: 'bac', // Estado actual

    switchTab: function(tab) {
        this.activeTab = tab;
        const bacTab = document.getElementById('tab-bac');
        const scTab = document.getElementById('tab-scotia');
        const bacWS = document.getElementById('workspace-bac');
        const scWS = document.getElementById('workspace-scotia');

        const activeClass = "shadow bg-white text-red-600 dark:bg-slate-700 dark:text-white font-bold";
        const inactiveClass = "text-slate-500 hover:text-slate-700 dark:text-slate-400 font-medium";

        if(tab === 'bac') {
            bacTab.className = `px-4 py-1.5 text-sm rounded transition-all ${activeClass}`;
            scTab.className = `px-4 py-1.5 text-sm rounded transition-all ${inactiveClass}`;
            bacWS.classList.remove('hidden');
            scWS.classList.add('hidden');
        } else {
            scTab.className = `px-4 py-1.5 text-sm rounded transition-all ${activeClass}`;
            bacTab.className = `px-4 py-1.5 text-sm rounded transition-all ${inactiveClass}`;
            scWS.classList.remove('hidden');
            bacWS.classList.add('hidden');
        }
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

    processScotiabankPagado: function(buf) {
        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        // 1. Buscar cabecera
        let headerIdx = -1;
        for(let i=0; i<Math.min(rawRows.length, 20); i++) {
            const s = JSON.stringify(rawRows[i]).toLowerCase();
            if(s.includes('descripci') && s.includes('monto')) { headerIdx = i; break; }
        }
        if(headerIdx === -1) return alert("No se encontraron columnas Descripción/Monto.");

        // Guardar Headers
        this.data.headers = this.data.headers || {};
        const headers = rawRows[headerIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        this.data.headers.scotia_pagado = headers;

        const iDesc = headers.findIndex(h => h.toLowerCase().includes('descripci'));
        const iMonto = headers.findIndex(h => h.toLowerCase().includes('monto'));

        let total = 0;
        const processed = [];

        // 2. Procesar Datos
        for(let i = headerIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || !row.length) continue;

            const first = String(row[0]||'').toLowerCase();
            if(first.includes('total') || first.includes('resumen')) break;

            let m = row[iMonto];
            if(typeof m === 'string') m = parseFloat(m.replace(/\s/g,'').replace(',','.')) || 0;
            else if (typeof m !== 'number') m = 0;
            
            if (m !== 0) {
                total += m;
                
                const desc = String(row[iDesc] || '');
                const parts = desc.trim().replace(/\s+/g, ' ').split(' ');
                const extractedID = parts.length >= 4 ? parts[3] : "SIN_ID";

                const rowObj = {
                    _enabled: true,
                    _monto: m,
                    _extractedId: extractedID, 
                    _desc: desc
                };
                
                // GUARDADO CRÍTICO: Usar índice string ("0", "1")
                headers.forEach((h, idx) => rowObj[String(idx)] = row[idx]);
                
                processed.push(rowObj);
            }
        }

        // 3. ASIGNACIÓN CRÍTICA AL ESTADO GLOBAL
        this.data.scotia_pagado = processed;
        
        // UI
        document.getElementById('sc-total-pagado').innerText = this.formatMoney(total);
        document.getElementById('card-scotia-pagado').classList.remove('hidden');
        
        // Ejecutar Cruce y mostrar estado
        if(this.runMatchScotiabank) {
            if(this.switchTab) this.switchTab('scotia');
            this.runMatchScotiabank();
        }
        
        // Feedback Dropzone
        const dropzone = document.getElementById('drop-scotia-pagado');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-green-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            const status = document.getElementById('status-scotia-pagado');
            if(status) { 
                status.innerText = `Cargado: ${processed.length} filas`; 
                status.classList.remove('hidden');
                status.classList.add('text-green-600', 'font-bold'); 
            }
        }
        this.data.scotia_pagado = processed;
    },

    runMatchScotiabank: function() {
        // Validación Visual de Estado
        const hasDetalle = this.data.scotia_detalle && this.data.scotia_detalle.length > 0;
        const hasPagado = this.data.scotia_pagado && this.data.scotia_pagado.length > 0;

        if (!hasDetalle || !hasPagado) {
            console.log("Scotia: Esperando archivos complementarios...");
            const container = document.getElementById('table-result-scotia');
            if(container) {
                // UI: Estado "Esperando"
                container.innerHTML = `
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                        <div class="animate-pulse flex flex-col items-center">
                            <svg class="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <span class="text-xs font-bold">Esperando archivos Scotia...</span>
                        </div>
                        <div class="flex gap-4 mt-4 text-[10px] font-mono">
                            <span class="flex items-center gap-1 ${hasDetalle ? 'text-green-500' : 'text-slate-500'}">
                                <span class="w-2 h-2 rounded-full ${hasDetalle ? 'bg-green-500' : 'bg-slate-300'}"></span> Detalle
                            </span>
                            <span class="flex items-center gap-1 ${hasPagado ? 'text-green-500' : 'text-slate-500'}">
                                <span class="w-2 h-2 rounded-full ${hasPagado ? 'bg-green-500' : 'bg-slate-300'}"></span> Banco
                            </span>
                        </div>
                    </div>
                `;
            }
            return;
        }

        console.log("Iniciando Cruce Scotiabank Completo...");

        // ... (Aquí sigue la lógica de agrupación y cruce que ya tenías)
        // Copia el resto de la función anterior desde "const detGroup = {};" hacia abajo.
        
        const detGroup = {};
        const pagGroup = {};

        // 1. Agrupar Detalle
        const headersDet = this.data.headers.scotia_detalle || [];
        const iMerID = headersDet.findIndex(h => h && h.toLowerCase().includes('merid'));
        
        if (iMerID === -1) return alert("Error: No se encuentra la columna MerID.");

        this.data.scotia_detalle.forEach(r => {
            if(!r._enabled) return;
            const id = String(r[String(iMerID)] || 'DESCONOCIDO').trim();
            if(!detGroup[id]) detGroup[id] = { count: 0, neto: 0 };
            detGroup[id].count++;
            detGroup[id].neto += r._neto; 
        });

        // 2. Agrupar Pagado
        this.data.scotia_pagado.forEach(r => {
            if(!r._enabled) return;
            const id = String(r._extractedId).trim();
            if(!pagGroup[id]) pagGroup[id] = 0;
            pagGroup[id] += r._monto;
        });

        // 3. Unificar
        const allIds = new Set([...Object.keys(detGroup), ...Object.keys(pagGroup)]);
        const tableData = [];
        const timeKey = Date.now();

        allIds.forEach(id => {
            if(!id || id === 'SIN_ID' || id === 'undefined') return;
            const det = detGroup[id] || { count:0, neto:0 };
            const pag = pagGroup[id] || 0;
            const diff = det.neto - pag;

            tableData.push({
                uuid: `${timeKey}-${id}`,
                id: id,
                count: det.count,
                neto: det.neto,
                pagado: pag,
                diff: diff
            });
        });

        // 4. Renderizar
        const columns = [
            { title: "ID Ref", field: "uuid", visible: false },
            { title: "MerID / Comercio", field: "id", headerFilter: true, width: 150 },
            { title: "Trans.", field: "count", hozAlign: "center", bottomCalc: "sum" },
            { title: "Neto Esperado", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Depositado", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diff", hozAlign: "right", formatter: "money", bottomCalc: "sum" }
        ];

        // Leer umbral BAC específico
        const thresholdInput = document.getElementById('threshold-bac'); // <--- ID NUEVO
        const currentThreshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

        this.grids.scotia = new VanillaGrid("#table-result-scotia", tableData, columns, {
            threshold: currentThreshold,
            searchInputId: "search-scotia"
        });
        // 5. Renderizar Auditoría
        this.renderAudit('scotia');
    },

    // Función auxiliar para dibujar la tabla resumen HTML
    updateScotiaCard: function() {
        // Blindaje: Si no hay datos, salir o usar array vacío
        const data = this.data.scotia_detalle || [];
        if (data.length === 0) return; // Opcional: Ocultar tarjeta si no hay datos

        const sums = {
            pos: { bruto:0, com:0, iva:0, isr:0, neto:0 },
            neg: { bruto:0, com:0, iva:0, isr:0, neto:0 },
            tot: { bruto:0, com:0, iva:0, isr:0, neto:0 }
        };

        const headers = this.data.headers.scotia_detalle || [];
        const getIdx = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        
        const idxs = {
            bruto: getIdx('Monto Bruto'),
            com: getIdx('Monto Comisión'),
            iva: getIdx('Retención IVA'),
            isr: getIdx('Retención IS'),
            neto: getIdx('Monto Neto')
        };

        this.data.scotia_detalle.forEach(row => {
            if (!row._enabled) return;

            const netVal = row._neto;
            const isNeg = netVal < 0;
            const target = isNeg ? sums.neg : sums.pos;

            // Helper para leer del índice guardado "1", "5", etc.
            const getAbsVal = (idx) => {
                if(idx === -1) return 0;
                return Math.abs(row[String(idx)] || 0);
            };

            target.bruto += getAbsVal(idxs.bruto);
            target.com += getAbsVal(idxs.com);
            target.iva += getAbsVal(idxs.iva);
            target.isr += getAbsVal(idxs.isr);
            target.neto += Math.abs(netVal);
        });

        // Totales Netos
        Object.keys(sums.tot).forEach(k => sums.tot[k] = sums.pos[k] - sums.neg[k]);

        // Generar HTML Limpio
        const fmt = (n) => this.formatMoney(n);
        const thStyle = "px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider";
        const tdBase = "px-3 py-2 font-mono text-slate-700 dark:text-slate-300";
        const negClass = "text-red-500 dark:text-red-400";

        // HTML Tabla 3 Filas (Estilo Solicitado)
        const htmlTable = `
            <table class="w-full text-xs text-right border-collapse">
                <!-- Header con fondo suave -->
                <thead class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    <tr>
                        <th class="px-2 py-1.5 text-left w-1/5">Concepto</th>
                        <th class="px-2 py-1.5 w-1/5">Bruto</th>
                        <th class="px-2 py-1.5 w-1/5">Comis.</th>
                        <th class="px-2 py-1.5 w-1/5">Retenc.</th>
                        <th class="px-2 py-1.5 w-1/5 text-slate-600 dark:text-slate-300">Neto</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                    <!-- Acreditados -->
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td class="px-2 py-1.5 text-left font-sans font-bold text-green-600 dark:text-green-400">
                            Acreditados (+)
                        </td>
                        <td class="px-2">${fmt(sums.pos.bruto)}</td>
                        <td class="px-2 opacity-75">${fmt(sums.pos.com)}</td>
                        <td class="px-2 opacity-75">${fmt(sums.pos.iva + sums.pos.isr)}</td>
                        <td class="px-2 font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 rounded-sm">
                            ${fmt(sums.pos.neto)}
                        </td>
                    </tr>

                    <!-- Rebajados -->
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td class="px-2 py-1.5 text-left font-sans font-bold text-red-500 dark:text-red-400">
                            Rebajados (-)
                        </td>
                        <td class="px-2 text-red-400 dark:text-red-300">-${fmt(sums.neg.bruto)}</td>
                        <td class="px-2 text-red-400 dark:text-red-300/80">-${fmt(sums.neg.com)}</td>
                        <td class="px-2 text-red-400 dark:text-red-300/80">-${fmt(sums.neg.iva + sums.neg.isr)}</td>
                        <td class="px-2 font-bold text-red-500 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 rounded-sm">
                            -${fmt(sums.neg.neto)}
                        </td>
                    </tr>

                    <!-- Total Final -->
                    <tr class="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-600 font-bold text-slate-800 dark:text-white">
                        <td class="px-2 py-2 text-left font-sans">TOTAL FINAL</td>
                        <td class="px-2">${fmt(sums.tot.bruto)}</td>
                        <td class="px-2 opacity-75">${fmt(sums.tot.com)}</td>
                        <td class="px-2 opacity-75">${fmt(sums.tot.iva + sums.tot.isr)}</td>
                        <td class="px-2 text-sm text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-600">
                            ${fmt(sums.tot.neto)}
                        </td>
                    </tr>
                </tbody>
            </table>
        `;
        
        document.getElementById('scotia-summary-container').innerHTML = htmlTable;
        document.getElementById('card-scotia-detalle').classList.remove('hidden');
    },

    data: { detalle: [], pagado: [] },
    table: null,

    init: function() {
        console.log("Sistema Conciliación Iniciado");
        this.setupUploads();
        // this.setupSearch(); // <--- IMPORTANTE
    },

    recalculateDetalle: function() {
        let s = { v:0, c:0, rv:0, rr:0, n:0 };
        this.data.detalle.forEach(r => {
            if(r._enabled) { s.v+=r._venta; s.c+=r._comision; s.rv+=r._retV; s.rr+=r._retR; s.n+=r._neto; }
        });
        const fmt = this.formatMoney;

        // Tabla Horizontal Compacta para BAC
        const html = `
            <div class="flex items-center justify-around w-full gap-4">
                <div class="text-center">
                    <div class="text-[9px] text-slate-400 uppercase font-bold">Ventas</div>
                    <div class="font-mono font-bold text-slate-700 dark:text-slate-200">${fmt(s.v)}</div>
                </div>
                <div class="text-2xl text-slate-300 dark:text-slate-600 font-light">-</div>
                <div class="text-center">
                    <div class="text-[9px] text-red-400 uppercase font-bold">Deducciones</div>
                    <div class="font-mono text-red-500" title="Comisión + Retenciones">-${fmt(s.c + s.rv + s.rr)}</div>
                </div>
                <div class="text-2xl text-slate-300 dark:text-slate-600 font-light">=</div>
                <div class="text-center bg-blue-50 dark:bg-blue-900/30 rounded px-3 py-1">
                    <div class="text-[9px] text-blue-500 uppercase font-bold">Neto Esperado</div>
                    <div class="font-mono font-bold text-blue-700 dark:text-blue-300 text-sm">${fmt(s.n)}</div>
                </div>
            </div>
        `;
        
        document.getElementById('bac-summary-container').innerHTML = html;
        document.getElementById('card-bac-detalle').classList.remove('hidden');
        
        document.getElementById('card-bac-detalle')?.classList.remove('hidden');
        this.runMatch();
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
        if(statusEl) statusEl.innerText = "Procesando...";

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if(type === 'csv') this.processCSV(e.target.result);
                else if(type === 'scotia_detalle') this.processScotiabankDetalle(e.target.result);
                else if(type === 'scotia_pagado') this.processScotiabankPagado(e.target.result);
                else this.processExcel(e.target.result);
                
                if(statusEl) statusEl.innerText = file.name;
            } catch (err) {
                console.error(err);
                if(statusEl) statusEl.innerText = "Error";
            }
        };
        
        if(type === 'csv') reader.readAsText(file, 'ISO-8859-1'); 
        else reader.readAsArrayBuffer(file);
    },

    processCSV: function(text) {
        // 1. Parsing manual
        const rows = text.split(/\r\n|\n/).map(l => {
            if(!l.trim()) return null;
            let r=[], q=false, b=''; 
            for(let c of l){ 
                if(c=='"') q=!q; else if(c==',' && !q){ r.push(b); b=''; } else b+=c; 
            } 
            r.push(b); return r;
        }).filter(r => r && r.length > 5);

        // 2. Guardar Encabezados
        const headerRow = rows[0].map(h => h.replace(/["']/g, '').trim());
        this.data.headers = this.data.headers || {};
        this.data.headers.detalle = headerRow;

        // 3. Procesar Filas
        const cleanNum = (val) => parseFloat(String(val).replace(/["'\s]/g,'')) || 0;

        this.data.detalle = rows.slice(1).map(row => {
            return {
                _raw: row, 
                _id: row[0],
                _venta: cleanNum(row[8]),
                _comision: cleanNum(row[9]),
                _retV: cleanNum(row[10]),
                _retR: cleanNum(row[11]),
                _neto: cleanNum(row[12]),
                _enabled: true, 
                // Propiedades dinámicas
                ...headerRow.reduce((acc, h, idx) => {
                    acc[String(idx)] = row[idx];
                    return acc;
                }, {})
            };
        });
        
        // 4. Actualizar UI y Calcular
        // recalculateDetalle se encarga de dibujar el HTML y llamar a runMatch
        this.recalculateDetalle();
        
        // Feedback visual en el Dropzone
        const dropzone = document.getElementById('drop-bac-detalle');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-red-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            const status = document.getElementById('status-bac-detalle');
            if(status) { 
                // CORRECCIÓN: Mostrar conteo real
                status.innerText = `Cargado: ${this.data.detalle.length} filas`; 
                status.classList.add('text-green-600', 'font-bold'); 
            }
            if(status) { status.innerText = "Cargado"; status.classList.add('text-green-600', 'font-bold'); }
        }
    },

    processExcel: function(buf) {
        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        // 1. ENCONTRAR CABECERA
        let startRowIdx = -1;
        for(let i = 0; i < Math.min(rawRows.length, 30); i++) {
            const rowStr = JSON.stringify(rawRows[i] || []).toLowerCase();
            if(rowStr.includes('código') && rowStr.includes('descripci') && rowStr.includes('crédito')) {
                startRowIdx = i;
                break;
            }
        }

        if(startRowIdx === -1) return alert("No se encontró la fila de encabezados (Código/Descripción/Créditos).");

        const headers = rawRows[startRowIdx];
        const iCodigo = headers.findIndex(h => h && String(h).toLowerCase().includes('código'));
        const iDesc = headers.findIndex(h => h && String(h).toLowerCase().includes('descripci'));
        const iCredito = headers.findIndex(h => h && String(h).toLowerCase().includes('crédito'));

        if(iCodigo === -1) return alert("No se encontró la columna 'Código'.");

        // 2. PROCESAR DATOS
        const cleanData = [];
        let totalCreditosTF = 0;

        for(let i = startRowIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || row.length === 0) continue;

            const firstCell = String(row[0] || '').toLowerCase();
            if(firstCell.includes('total') || firstCell.includes('saldo final') || firstCell.includes('resumen')) break;

            const codigo = String(row[iCodigo] || '').toUpperCase();
            if(!codigo.includes('TF')) continue; 

            const montoRaw = row[iCredito];
            let m = 0;
            if(typeof montoRaw === 'number') m = montoRaw;
            else if(typeof montoRaw === 'string') m = parseFloat(m.replace(/\s/g,'').replace(',','.')) || 0;

            if(m > 0) totalCreditosTF += m;

            const rowObj = {
                _desc: String(row[iDesc] || ''),
                _monto: m,
                _enabled: true, 
                ...headers.reduce((acc, h, idx) => {
                    const key = h || `Col_${idx}`; 
                    acc[key] = row[idx];
                    return acc;
                }, {})
            };
            cleanData.push(rowObj);
        }

        this.data.headers = this.data.headers || {};
        this.data.headers.pagado = headers;
        this.data.pagado = cleanData;

        // UI: Actualizar Tarjeta y Totales
        const elTotal = document.getElementById('sum-depositos');
        if(elTotal) elTotal.innerText = this.formatMoney(totalCreditosTF);
        
        // Mostrar la tarjeta (si estaba oculta)
        const card = document.getElementById('card-bac-pagado');
        if(card) card.classList.remove('hidden');

        // Feedback Dropzone
        const dropzone = document.getElementById('drop-bac-pagado');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-green-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            const status = document.getElementById('status-bac-pagado');
            if(status) { status.innerText = "Cargado: " + cleanData.length + " filas"; status.classList.add('text-green-600', 'font-bold'); }
        }
        
        // Cambiar pestaña de forma segura
        if(typeof this.switchTab === 'function') this.switchTab('bac');
        
        // Intentar cruce (runMatch validará internamente si tiene ambos archivos)
        this.runMatch();
    },

    runMatch: function() {
        // Validación de Datos: Si falta alguno, no hacemos el cruce, pero no damos error.
        const hasDetalle = this.data.detalle && this.data.detalle.length > 0;
        const hasPagado = this.data.pagado && this.data.pagado.length > 0;

        if (!hasDetalle || !hasPagado) {
            const container = document.getElementById('table-result-bac');
            if(container) {
                // Estado: Cargando / Esperando
                container.innerHTML = `
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 animate-pulse">
                        <svg class="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="text-xs font-bold">Esperando archivo complementario...</span>
                        <div class="flex gap-4 mt-2 text-[10px]">
                            <span class="${hasDetalle ? 'text-green-500' : 'text-slate-300'}">● Detalle</span>
                            <span class="${hasPagado ? 'text-green-500' : 'text-slate-300'}">● Banco</span>
                        </div>
                    </div>
                `;
            }
            return;
        }

        // 1. Agrupar Detalle (Esperado)
        const det = {}, pag = {};
        this.data.detalle.forEach(r => {
            if(!r._enabled) return; // <--- Respetar Checkbox

            // Usamos las propiedades procesadas en processCSV
            const id = r._id;
            const net = r._neto;
            
            if(!det[id]) det[id]={id, count:0, sumNeto:0};
            det[id].count++; det[id].sumNeto+=net;
        });

        // 2. Agrupar Pagado (Banco) - Respetando Checkboxes (_enabled)
        this.data.pagado.forEach(r => {
            if(!r._enabled) return; // Solo si el usuario lo marcó
            const d = r._desc || ""; 
            const id = d.length > 3 ? d.split(' ')[0].substring(3) : ""; 
            if(id) { 
                if(!pag[id]) pag[id] = 0; 
                pag[id] += r._monto; 
            }
        });

        // 3. GENERADOR DE ID ÚNICO (Algoritmo Cronológico)
        // Formato: YYYYMMDDHHMMSS-AFILIADO
        // Esto garantiza ordenamiento temporal en SQL Server (Cluster Index Friendly)
        const now = new Date();
        const timeKey = now.getFullYear() +
            String(now.getMonth()+1).padStart(2,'0') +
            String(now.getDate()).padStart(2,'0') +
            String(now.getHours()).padStart(2,'0') +
            String(now.getMinutes()).padStart(2,'0') +
            String(now.getSeconds()).padStart(2,'0');

        // 4. Construir Tabla Final
        const tableData = Object.values(det).map(i => ({
            uuid: `${timeKey}-${i.id}`, // <--- ID ÚNICO GENERADO
            id: i.id, 
            count: i.count, 
            neto: i.sumNeto,
            pagado: pag[i.id]||0, 
            diff: i.sumNeto-(pag[i.id]||0)
        }));

        const columns = [
            // Columna oculta o visible pequeña para el ID (opcional visualmente)
            { title: "ID Ref", field: "uuid", width: 140, headerFilter: true, visible: false }, 
            { title: "Afiliado", field: "id", headerFilter: true, width: 100 }, 
            { title: "Trans.", field: "count", hozAlign: "center", bottomCalc: "sum" },
            { title: "Neto Esperado", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Depositado", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diff", hozAlign: "right", formatter: "money", bottomCalc: "sum" }
        ];

        // Leer umbral Scotia específico
        const thresholdInput = document.getElementById('threshold-scotia'); // <--- ID NUEVO
        const currentThreshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

        // Instanciar BAC
        this.grids.bac = new VanillaGrid("#table-result-bac", tableData, columns, {
            threshold: currentThreshold,
            searchInputId: "search-bac" 
        });
        
        // Auto-switch tab si es la primera carga
        if(this.activeTab !== 'bac') this.switchTab('bac');
        
        console.log("Grid BAC inicializado:", this.grids.bac);
        // 5. Renderizar Auditoría
        this.renderAudit('bac');
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
                    // Asumimos formato inglés MM/DD/YYYY o YYYY-MM-DD -> DD/MM/YYYY
                    if(idx === 0 && val) {
                        const dateStr = String(val).trim();
                        // Intento simple de parseo
                        const parts = dateStr.split(/[-/]/); 
                        if(parts.length === 3) {
                            // Si es YYYY-MM-DD
                            if(parts[0].length === 4) finalVal = `${parts[2]}/${parts[1]}/${parts[0]}`;
                            // Si es MM/DD/YYYY (común en CSVs gringos)
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
        // DEFINICIÓN CRÍTICA DE VARIABLES
        const isDet = type === 'detalle';
        const isScotia = type === 'scotia_detalle';
        
        // Selección de datos
        let rawData;
        if (isDet) rawData = this.data.detalle;
        else if (isScotia) rawData = this.data.scotia_detalle;
        else if (type === 'scotia_pagado') rawData = this.data.scotia_pagado; // <--- ¿ESTÁ ESTA LÍNEA?
        else rawData = this.data.pagado;
        
        
        if (!rawData || !rawData.length) return alert("Sin datos para mostrar");

        // Configurar Columnas
        let columns = [];
        if(isDet) {
            const sample = rawData[0];
            // Recuperamos headers reales
            const realHeaders = this.data.headers && this.data.headers.detalle ? this.data.headers.detalle : [];
            
            columns = [
                // Columna Checkbox
                { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                
                // Columnas de datos (Mapeadas por índice '0', '1', etc.)
                ...realHeaders.map((h, idx) => {
                    const isMoney = /monto|neto|comisi|retenci|importe/i.test(h);
                    return {
                        title: h || `Col ${idx}`,
                        field: String(idx),
                        headerFilter: true,
                        hozAlign: isMoney ? "right" : "left",
                        formatter: isMoney ? "money" : undefined
                    };
                })
            ];
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
        } else {
            // EXCEL: Agregamos columna de Control al inicio
            const rawCols = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
            
            columns = [
                // Columna Checkbox
                { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                
                // Resto de columnas
                ...rawCols.map(k => ({
                    title: k, 
                    field: k, 
                    headerFilter: true,
                    formatter: (k.toLowerCase().match(/monto|crédito|débito|saldo|importe/)) ? 'money' : undefined,
                    hozAlign: (k.toLowerCase().match(/monto|crédito|débito|saldo|importe/)) ? 'right' : 'left'
                }))
            ];
        }

        const w = 1200, h = 800;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        const win = window.open("", "_blank", `width=${w},height=${h},top=${top},left=${left}`);
        if(!win) return alert("Ventana bloqueada.");

        const isDark = document.documentElement.classList.contains('dark');

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
                                    searchInputId: "popup-search", // <--- CONEXIÓN AUTOMÁTICA
                                    autoFocusSearch: true,         // <--- UX: Escribir apenas abre
                                    
                                    // Callback REACTIVO en tiempo real
                                    onCheckboxChange: (row, field, val) => {
                                        if(window.opener && window.opener.ConciliacionLogic) {
                                            const logic = window.opener.ConciliacionLogic;
                                            
                                            // 1. SCOTIA DETALLE (Tarjeta Grande + Tabla Central)
                                            if ('${type}' === 'scotia_detalle') {
                                                logic.updateScotiaCard(); // Actualiza HTML Tarjeta
                                                logic.runMatchScotiabank(); // Actualiza Tabla Central
                                            } 
                                            // 2. SCOTIA PAGADO (Tarjeta Verde + Tabla Central)
                                            else if ('${type}' === 'scotia_pagado') {
                                                // Asegurarse de tener la función de recálculo simple
                                                if(logic.recalculateScotiaPagado) {
                                                    logic.recalculateScotiaPagado();
                                                } else {
                                                    // Fallback si no existe la función dedicada
                                                    logic.runMatchScotiabank();
                                                }
                                            }
                                            // 3. BAC DETALLE
                                            else if('${type}' === 'detalle') {
                                                logic.recalculateDetalle();
                                            } 
                                            // 4. BAC PAGADO
                                            else {
                                                logic.recalculate(); 
                                            }
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

    formatMoney: function(val) { return new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(val); },
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

    processScotiabankDetalle: function(buf) {
        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        // 1. Escanear cabeceras
        const headerIndices = [];
        rawRows.forEach((row, idx) => {
            const str = JSON.stringify(row).toLowerCase();
            if(str.includes('monto neto') && str.includes('fuente')) headerIndices.push(idx);
        });

        if(!headerIndices.length) return alert("No se encontraron encabezados de Scotiabank.");

        const headers = rawRows[headerIndices[0]].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        this.data.headers = this.data.headers || {};
        this.data.headers.scotia_detalle = headers;

        const getIdx = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        const cols = {
            bruto: getIdx('Monto Bruto'),
            comTot: getIdx('Monto Comisión Total'),
            retIva: getIdx('Monto Retención IVA'),
            retIsr: getIdx('Monto Retención IS'),
            neto: getIdx('Monto Neto')
        };

        const parseNum = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                return parseFloat(val.replace(/\s/g, '').replace(',', '.')) || 0;
            }
            return 0;
        };

        const processedData = [];

        // 2. Procesar Bloques
        headerIndices.forEach((startRow, blockIdx) => {
            const isNegative = blockIdx > 0; 
            const sign = isNegative ? -1 : 1;

            for(let i = startRow + 1; i < rawRows.length; i++) {
                const row = rawRows[i];
                if(!row || !row.length) continue;

                const first = String(row[0]||'').toLowerCase();
                if(first.includes('subtotales') || first.includes('agrupado')) {
                    if(headerIndices.includes(i)) break; 
                    if(first.includes('subtotales')) break; 
                    continue;
                }

                const vBruto = Math.abs(parseNum(row[cols.bruto]));
                const vNeto = Math.abs(parseNum(row[cols.neto]));

                if(vNeto === 0 && vBruto === 0) continue;

                // Guardar Fila
                const rowObj = {
                    _enabled: true,
                    _neto: vNeto * sign,
                };

                // GUARDADO CORREGIDO: Iteramos headers para llenar rowObj
                headers.forEach((h, idx) => {
                    let cellVal = row[idx];
                    
                    // Aplicar signo a columnas monetarias
                    if([cols.bruto, cols.comTot, cols.retIva, cols.retIsr, cols.neto].includes(idx)) {
                        cellVal = parseNum(cellVal) * sign;
                    }
                    
                    // Usamos el índice como llave ("0", "1")
                    rowObj[String(idx)] = cellVal; 
                });
                
                processedData.push(rowObj);
            }
        });

        // 1. PRIMERO: Guardar los datos procesados en el estado global
        // Si no hacemos esto, updateScotiaCard intentará leer 'undefined' y fallará.
        this.data.scotia_detalle = processedData;

        // 2. SEGUNDO: Actualizar la Tarjeta de Resumen (Ahora sí hay datos)
        this.updateScotiaCard();
        
        // 3. TERCERO: Cambiar Tab y Correr Match (Para mostrar "Esperando..." o resultados)
        if(this.switchTab) this.switchTab('scotia');
        this.runMatchScotiabank();

        // Feedback Dropzone
        const dropzone = document.getElementById('drop-scotia-detalle');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-red-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            const status = document.getElementById('status-scotia-detalle');
            if(status) { 
                status.innerText = `Cargado: ${processedData.length} filas`; 
                status.classList.remove('hidden');
                status.classList.add('text-green-600', 'font-bold'); 
            }
        }
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

    // Recálculo reactivo para Pagado Scotiabank
    recalculateScotiaPagado: function() {
        let total = 0;
        if(this.data.scotia_pagado) {
            this.data.scotia_pagado.forEach(r => {
                if(r._enabled) total += r._monto;
            });
        }
        // Actualizar UI
        const el = document.getElementById('sc-total-pagado');
        if(el) el.innerText = this.formatMoney(total);
        
        // Actualizar Tabla Central
        this.runMatchScotiabank();
        // Actualizar Tabla Central y Auditoría
        this.runMatchScotiabank(); 
        // Nota: runMatchScotiabank ya llama a renderAudit('scotia'), así que estamos cubiertos.
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
    }
};