window.ScotiaLogic = {
    // Procesa el Excel de Detalle (Scotiabank)
    // Procesa el Excel de Detalle (Scotiabank) - Multibloque LOTE/AJUSTE
    processScotiabankDetalle: function(buf, filename) {
        // 0. VALIDACIÓN DE DUPLICADOS
        this.data.files = this.data.files || {};
        this.data.files.scotia_detalle = this.data.files.scotia_detalle || [];
        this.data.files.scotia_pagado = this.data.files.scotia_pagado || [];
        
        if (filename && this.data.files.scotia_detalle.includes(filename)) {
            alert(`⚠️ El archivo "${filename}" ya fue cargado previamente.`);
            return;
        }

        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        // 1. Detectar la Fila de Encabezados Principal
        let mainHeaderIdx = -1;
        for(let i=0; i<Math.min(rawRows.length, 30); i++) {
            const rowStr = JSON.stringify(rawRows[i]).toLowerCase();
            if(rowStr.includes('monto neto') && rowStr.includes('merid')) {
                mainHeaderIdx = i; break;
            }
        }

        if(mainHeaderIdx === -1) {
            alert("⛔ Error de Formato Scotiabank:\n\nNo se encontraron los encabezados clave:\n- Monto Neto\n- MerID");
            this.updateScotiaFileList('scotia_detalle'); // Restaurar UI
            return;
        }

        // Guardar encabezados
        const headers = rawRows[mainHeaderIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        this.data.headers = this.data.headers || {};
        this.data.headers.scotia_detalle = headers;

        // Mapeo de columnas
        const getIdx = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        const cols = {
            merId: getIdx('merid'),
            bruto: getIdx('monto bruto'),
            neto: getIdx('monto neto'),
            com: getIdx('monto comisión'),
            iva: getIdx('retención iva'),
            isr: getIdx('retención isr')
        };
        
        // Fallbacks
        if(cols.bruto === -1) cols.bruto = getIdx('monto orig');
        if(cols.isr === -1) cols.isr = getIdx('retención is');

        // 2. Procesar Filas (Temp Array)
        const newRows = [];
        let currentMode = 'LOTE'; 
        let multiplicador = 1;

        const parseNum = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace(/\s/g, '').replace(',', '.')) || 0;
            return 0;
        };

        for(let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || row.length === 0) continue;

            const rowStr = JSON.stringify(row).toLowerCase();

            // A. Detección de Cambio de Bloque (LOTE vs AJUSTE)
            if(rowStr.includes('agrupado por') && rowStr.includes('transacción')) {
                if(rowStr.includes('ajuste')) {
                    currentMode = 'AJUSTE';
                    multiplicador = -1; // <--- INVERTIR SIGNO (Negativo)
                } else {
                    currentMode = 'LOTE';
                    multiplicador = 1;  // Positivo
                }
                continue; // Saltamos la fila de título
            }

            // B. Ignorar filas de encabezados repetidos o subtotales
            if(rowStr.includes('monto neto') || rowStr.includes('subtotales')) continue;

            // C. VALIDACIÓN CRÍTICA: Debe tener MerID
            // Si la celda de MerID está vacía o es nula, ignoramos la fila por completo.
            const rawMerId = row[cols.merId];
            if(!rawMerId || String(rawMerId).trim() === '') continue;

            // D. Extracción de Datos
            const vBruto = Math.abs(parseNum(row[cols.bruto]));
            const vNeto = Math.abs(parseNum(row[cols.neto]));
            
            // Si es ajuste, aplicamos el negativo
            const finalNeto = vNeto * multiplicador;
            const finalBruto = vBruto * multiplicador; 

            // E. Construir Objeto
            const rowObj = {
                _enabled: true,
                _neto: finalNeto,
                _bruto: finalBruto, 
                _mode: currentMode,
                _sourceFile: filename,
                ...headers.reduce((acc, h, idx) => {
                    let cellVal = row[idx];
                    if (typeof cellVal === 'string' && cellVal.startsWith("'")) cellVal = cellVal.substring(1);
                    acc[String(idx)] = cellVal;
                    return acc;
                }, {})
            };
            
            // Forzar visualización negativa en columnas clave para el PopUp
            // Sobreescribimos el valor original en las columnas de Monto Neto y Bruto
            // para que VanillaGrid lo muestre rojo si es negativo.
            if (multiplicador === -1) {
                rowObj[String(cols.neto)] = finalNeto;
                rowObj[String(cols.bruto)] = finalBruto;
            }

            newRows.push(rowObj);
        }

        // 3. ACUMULAR DATOS
        this.data.scotia_detalle = (this.data.scotia_detalle || []).concat(newRows);
        
        // 4. REGISTRAR ARCHIVO
        if(filename && !this.data.files.scotia_detalle.includes(filename)) {
            this.data.files.scotia_detalle.push(filename);
        }
        
        // 5. ACTUALIZAR UI
        this.updateScotiaCard();
        this.updateScotiaFileList('scotia_detalle'); // <--- Llamada a la nueva UI
        
        if(this.switchTab) this.switchTab('scotia');
        this.runMatchScotiabank();

        // Feedback Dropzone (Estado OK)
        const dropzone = document.getElementById('drop-scotia-detalle');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-red-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
        }
    },

    // Genera la tarjeta HTML de resumen Scotia
    updateScotiaCard: function() {
        const data = this.data.scotia_detalle || [];
        if (data.length === 0) return;

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

        Object.keys(sums.tot).forEach(k => sums.tot[k] = sums.pos[k] - sums.neg[k]);

        const fmt = (n) => this.formatMoney(n);
        
        const htmlTable = `
            <table class="w-full text-xs text-right border-collapse">
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

    // Procesa el Excel de Pagado (Scotiabank)
    processScotiabankPagado: function(buf, filename) {
        // 0. VALIDACIÓN DE DUPLICADOS
        this.data.files = this.data.files || {};
        this.data.files.scotia_detalle = this.data.files.scotia_detalle || [];
        this.data.files.scotia_pagado = this.data.files.scotia_pagado || [];
        
        if (filename && this.data.files.scotia_pagado.includes(filename)) {
            alert(`⚠️ El archivo "${filename}" ya fue cargado previamente.`);
            return;
        }

        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        let headerIdx = -1;
        for(let i=0; i<Math.min(rawRows.length, 20); i++) {
            const s = JSON.stringify(rawRows[i]).toLowerCase();
            if(s.includes('descripci') && s.includes('monto')) { headerIdx = i; break; }
        }
        
        if(headerIdx === -1) {
            alert("⛔ Error de Formato Scotiabank:\n\nNo se encontraron las columnas 'Descripción' y 'Monto'.");
            this.updateScotiaFileList('scotia_pagado');
            return;
        }

        this.data.headers = this.data.headers || {};
        const headers = rawRows[headerIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        this.data.headers.scotia_pagado = headers;

        const iDesc = headers.findIndex(h => h.toLowerCase().includes('descripci'));
        const iMonto = headers.findIndex(h => h.toLowerCase().includes('monto'));

        const newRows = [];

        for(let i = headerIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || !row.length) continue;

            const first = String(row[0]||'').toLowerCase();
            if(first.includes('total') || first.includes('resumen')) break;

            let rawM = row[iMonto];
            let m = 0;

            if (typeof rawM === 'number') m = rawM;
            else if (typeof rawM === 'string') {
                let clean = rawM.replace(/[\s₡$]/g, '');
                // Detección formato USA/CR
                const commas = (clean.match(/,/g) || []).length;
                const dots = (clean.match(/\./g) || []).length;
                if (commas > 0 && dots > 0) {
                    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) m = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                    else m = parseFloat(clean.replace(/,/g, ''));
                } else if (commas > 0) m = parseFloat(clean.replace(/,/g, ''));
                else m = parseFloat(clean);
            }
            
            if (m !== 0) {
                const desc = String(row[iDesc] || '');
                const parts = desc.trim().replace(/\s+/g, ' ').split(' ');
                const extractedID = parts.length >= 4 ? parts[3] : "SIN_ID";

                const rowObj = {
                    _enabled: true,
                    _monto: m,
                    _extractedId: extractedID, 
                    _desc: desc,
                    _sourceFile: filename, // <--- NUEVO
                    ...headers.reduce((acc, h, idx) => {
                        let val = row[idx];
                        if (typeof val === 'string' && val.startsWith("'")) val = val.substring(1);
                        acc[String(idx)] = val;
                        return acc;
                    }, {})
                };
                newRows.push(rowObj);
            }
        }

        // 3. ACUMULAR DATOS
        this.data.scotia_pagado = (this.data.scotia_pagado || []).concat(newRows);
        
        // 4. REGISTRAR ARCHIVO
        if(filename && !this.data.files.scotia_pagado.includes(filename)) {
            this.data.files.scotia_pagado.push(filename);
        }

        // 5. CALCULAR TOTAL GLOBAL
        const total = this.data.scotia_pagado.reduce((acc, r) => acc + (r._enabled ? r._monto : 0), 0);
        document.getElementById('sc-total-pagado').innerText = this.formatMoney(total);
        document.getElementById('card-scotia-pagado').classList.remove('hidden');
        
        // 6. ACTUALIZAR UI
        this.updateScotiaFileList('scotia_pagado');

        if(this.runMatchScotiabank) {
            if(this.switchTab) this.switchTab('scotia');
            this.runMatchScotiabank();
        }
        
        const dropzone = document.getElementById('drop-scotia-pagado');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-green-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
        }
    },

    // Ejecuta el cruce de conciliación Scotia
    runMatchScotiabank: function() {
        const hasDetalle = this.data.scotia_detalle && this.data.scotia_detalle.length > 0;
        const hasPagado = this.data.scotia_pagado && this.data.scotia_pagado.length > 0;

        if (!hasDetalle || !hasPagado) {
            const container = document.getElementById('table-result-scotia');
            if(container) {
                if(this.grids && this.grids.scotia) this.grids.scotia = null;
                
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

        const detGroup = {};
        const pagGroup = {};

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

        this.data.scotia_pagado.forEach(r => {
            if(!r._enabled) return;
            const id = String(r._extractedId).trim();
            if(!pagGroup[id]) pagGroup[id] = 0;
            pagGroup[id] += r._monto;
        });

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

        const columns = [
            { title: "ID Ref", field: "uuid", visible: false },
            { title: "MerID / Comercio", field: "id", headerFilter: true, width: 150 },
            { title: "Trans.", field: "count", hozAlign: "center", bottomCalc: "sum" },
            { title: "Neto Esperado", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Depositado", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diff", hozAlign: "right", formatter: "money", bottomCalc: "sum" }
        ];

        const thresholdInput = document.getElementById('threshold-scotia');
        const currentThreshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

        if (this.grids.scotia) {
            this.grids.scotia.updateData(tableData);
        } else {
            this.grids.scotia = new VanillaGrid("#table-result-scotia", tableData, columns, {
                threshold: currentThreshold,
                searchInputId: "search-scotia"
            });
        }
        this.renderAudit('scotia');
    },

    // Recalcula cuando se activan/desactivan filas en el pagado
    recalculateScotiaPagado: function() {
        if(!this.data.scotia_pagado || !this.data.scotia_pagado.length) return;
        let total = 0;
        this.data.scotia_pagado.forEach(r => {
            if(r._enabled) total += r._monto;
        });
        
        const el = document.getElementById('sc-total-pagado');
        if(el) el.innerText = this.formatMoney(total);
        
        this.runMatchScotiabank();
    },

    // --- NUEVAS FUNCIONES DE GESTIÓN DE ARCHIVOS (SCOTIA) ---

    removeFileScotiaDetalle: function(filename) {
        if(!confirm(`¿Eliminar los datos de "${filename}"?`)) return;

        this.data.scotia_detalle = this.data.scotia_detalle.filter(row => row._sourceFile !== filename);
        
        // CORRECCIÓN CRÍTICA
        this.data.files.scotia_detalle = this.data.files.scotia_detalle.filter(f => f !== filename);

        this.updateScotiaCard();
        this.updateScotiaFileList('scotia_detalle'); // Asegúrate que esta función use la lista actualizada
        this.runMatchScotiabank();
        
        if(this.data.files.scotia_detalle.length === 0) {
            const drop = document.getElementById('drop-scotia-detalle');
            drop.classList.remove('border-green-500', 'bg-green-50');
            drop.classList.add('border-slate-300', 'bg-white');
            document.getElementById('status-scotia-detalle').innerHTML = '';
            document.getElementById('status-scotia-detalle').classList.add('hidden');
        }
    },

    removeFileScotiaPagado: function(filename) {
        if(!confirm(`¿Eliminar los datos de "${filename}"?`)) return;

        this.data.scotia_pagado = this.data.scotia_pagado.filter(row => row._sourceFile !== filename);
        
        // CORRECCIÓN CRÍTICA
        this.data.files.scotia_pagado = this.data.files.scotia_pagado.filter(f => f !== filename);

        const total = this.data.scotia_pagado.reduce((acc, r) => acc + (r._enabled ? r._monto : 0), 0);
        document.getElementById('sc-total-pagado').innerText = this.formatMoney(total);

        this.updateScotiaFileList('scotia_pagado');
        this.runMatchScotiabank();

        if(this.data.files.scotia_pagado.length === 0) {
            const drop = document.getElementById('drop-scotia-pagado');
            drop.classList.remove('border-green-500', 'bg-green-50');
            drop.classList.add('border-slate-300', 'bg-white');
            document.getElementById('card-scotia-pagado').classList.add('hidden');
            document.getElementById('status-scotia-pagado').innerHTML = '';
            document.getElementById('status-scotia-pagado').classList.add('hidden');
        }
    },

    updateScotiaFileList: function(type) {
        const isDet = type === 'scotia_detalle';
        const files = isDet ? this.data.files.scotia_detalle : this.data.files.scotia_pagado;
        const status = document.getElementById(isDet ? 'status-scotia-detalle' : 'status-scotia-pagado');
        
        if(!status) return;

        if(files.length === 0) {
            status.innerHTML = '';
            status.classList.add('hidden');
            return;
        }

        const count = files.length;
        const colorText = isDet ? 'text-green-600' : 'text-green-700'; // Detalle rojo (scotia) vs Pagado verde? Scotia suele ser Rojo en UI, pero mantenemos verde para éxito de carga.

        const listItems = files.map(f => `
            <div class="flex justify-between items-center bg-slate-700 p-1 rounded hover:bg-slate-600 transition-colors group/item">
                <span class="truncate text-[9px] text-slate-300 w-32" title="${f}">• ${f}</span>
                <button onclick="window.ConciliacionLogic.${isDet ? 'removeFileScotiaDetalle' : 'removeFileScotiaPagado'}('${f}')" 
                        class="text-red-400 hover:text-red-200 p-0.5 rounded ml-2 opacity-0 group-hover/item:opacity-100 transition-opacity" title="Eliminar archivo">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `).join('');

        status.innerHTML = `
            <div class="font-bold text-[10px] ${colorText} cursor-help flex items-center gap-1 relative z-20">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                ${count} Archivo${count !== 1 ? 's' : ''}
            </div>
            
            <div class="hidden group-hover:block absolute left-0 top-full pt-2 z-[100] min-w-[200px]">
                <div class="absolute top-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
                <div class="bg-slate-800 text-white rounded shadow-xl border border-slate-600 p-1">
                    <div class="text-[9px] font-bold text-slate-400 border-b border-slate-600 pb-1 mb-1 px-1 flex justify-between items-center">
                        <span>Archivos Scotia:</span>
                        <span class="text-[8px] bg-slate-700 px-1 rounded">${count}</span>
                    </div>
                    <div class="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                        ${listItems}
                    </div>
                </div>
            </div>
        `;
        status.parentElement.classList.add('group', 'relative');
        status.classList.remove('hidden');
    }
};