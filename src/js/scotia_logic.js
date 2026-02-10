window.ScotiaLogic = {
    // Procesa el Excel de Detalle (Scotiabank)
    // Procesa el Excel de Detalle (Scotiabank) - Multibloque LOTE/AJUSTE
    processScotiabankDetalle: function(buf) {
        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        // 1. Detectar la Fila de Encabezados Principal
        // Buscamos la fila que tenga las columnas clave
        let mainHeaderIdx = -1;
        for(let i=0; i<Math.min(rawRows.length, 30); i++) {
            const rowStr = JSON.stringify(rawRows[i]).toLowerCase();
            if(rowStr.includes('monto neto') && rowStr.includes('merid') && rowStr.includes('autorización')) {
                mainHeaderIdx = i; break;
            }
        }

        if(mainHeaderIdx === -1) return alert("No se encontraron encabezados de Scotiabank (Monto Neto/MerID/Autorización).");

        // Guardar encabezados limpios
        const headers = rawRows[mainHeaderIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        this.data.headers = this.data.headers || {};
        this.data.headers.scotia_detalle = headers;

        // Mapeo de columnas
        const getIdx = (name) => headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        const cols = {
            merId: getIdx('merid'),
            auth: getIdx('autorización'),
            bruto: getIdx('monto bruto'), // O Monto Orig
            neto: getIdx('monto neto'),
            // Columnas para la tarjeta resumen
            com: getIdx('monto comisión'),
            iva: getIdx('retención iva'),
            isr: getIdx('retención isr') // A veces es IS o ISR
        };
        
        // Fallback si no encuentra "Monto Bruto", busca "Monto Orig"
        if(cols.bruto === -1) cols.bruto = getIdx('monto orig');
        if(cols.isr === -1) cols.isr = getIdx('retención is');

        // 2. Procesar Filas con Lógica de Bloques (LOTE vs AJUSTE)
        const processedData = [];
        let currentMode = 'LOTE'; // Por defecto positivo, pero buscamos la etiqueta
        let multiplicador = 1;

        // Helper limpieza numérica
        const parseNum = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace(/\s/g, '').replace(',', '.')) || 0;
            return 0;
        };

        // Recorremos desde el inicio para detectar los títulos de bloque "Agrupado Por:"
        for(let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || row.length === 0) continue;

            const rowStr = JSON.stringify(row).toLowerCase();

            // A. Detección de Cambio de Bloque
            if(rowStr.includes('agrupado por') && rowStr.includes('transacción')) {
                if(rowStr.includes('ajuste')) {
                    currentMode = 'AJUSTE';
                    multiplicador = -1; // <--- INVERTIR SIGNO
                } else {
                    currentMode = 'LOTE';
                    multiplicador = 1;
                }
                continue; // Saltamos la fila de título
            }

            // B. Ignorar filas de encabezados repetidos o subtotales
            if(rowStr.includes('monto neto') || rowStr.includes('subtotales')) continue;

            // C. Validar que sea una fila de datos (debe tener MerID y Monto)
            const rawNeto = row[cols.neto];
            if(rawNeto === undefined || rawNeto === null || String(rawNeto).trim() === '') continue;

            // D. Extracción de Datos
            const vBruto = Math.abs(parseNum(row[cols.bruto]));
            const vNeto = Math.abs(parseNum(row[cols.neto]));
            
            // Si es ajuste, aplicamos el negativo
            const finalNeto = vNeto * multiplicador;
            const finalBruto = vBruto * multiplicador; // El bruto también se resta para cuadrar TSD

            // E. Construir Objeto
            const rowObj = {
                _enabled: true,
                _neto: finalNeto,
                _bruto: finalBruto, // <--- Guardamos Bruto explícito para TSD Match
                _mode: currentMode // Para auditoría o debug
            };

            // Copiar todas las columnas originales por índice
            headers.forEach((h, idx) => {
                let cellVal = row[idx];
                // Limpiar comilla simple de Excel ('123 -> 123)
                if (typeof cellVal === 'string' && cellVal.startsWith("'")) cellVal = cellVal.substring(1);
                rowObj[String(idx)] = cellVal; 
            });

            processedData.push(rowObj);
        }

        console.log(`Procesados ${processedData.length} registros Scotia. Último modo: ${currentMode}`);

        this.data.scotia_detalle = processedData;
        
        // Actualizar UI
        this.updateScotiaCard();
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
    processScotiabankPagado: function(buf) {
        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        let headerIdx = -1;
        for(let i=0; i<Math.min(rawRows.length, 20); i++) {
            const s = JSON.stringify(rawRows[i]).toLowerCase();
            if(s.includes('descripci') && s.includes('monto')) { headerIdx = i; break; }
        }
        if(headerIdx === -1) return alert("No se encontraron columnas Descripción/Monto.");

        this.data.headers = this.data.headers || {};
        const headers = rawRows[headerIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        this.data.headers.scotia_pagado = headers;

        const iDesc = headers.findIndex(h => h.toLowerCase().includes('descripci'));
        const iMonto = headers.findIndex(h => h.toLowerCase().includes('monto'));

        let total = 0;
        const processed = [];

        for(let i = headerIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || !row.length) continue;

            const first = String(row[0]||'').toLowerCase();
            if(first.includes('total') || first.includes('resumen')) break;

            let rawM = row[iMonto];
            let m = 0;

            if (typeof rawM === 'number') {
                m = rawM;
            } else if (typeof rawM === 'string') {
                let clean = rawM.replace(/[\s₡$]/g, '');
                const commas = (clean.match(/,/g) || []).length;
                const dots = (clean.match(/\./g) || []).length;

                if (commas > 0 && dots > 0) {
                    if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
                        m = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
                    } else {
                        m = parseFloat(clean.replace(/,/g, ''));
                    }
                } else if (commas > 0) {
                    m = parseFloat(clean.replace(/,/g, ''));
                } else {
                    m = parseFloat(clean);
                }
            }
            
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
                
                headers.forEach((h, idx) => {
                    let val = row[idx];
                    if (typeof val === 'string' && val.startsWith("'")) val = val.substring(1);
                    rowObj[String(idx)] = val; 
                });
                
                processed.push(rowObj);
            }
        }

        this.data.scotia_pagado = processed;
        
        document.getElementById('sc-total-pagado').innerText = this.formatMoney(total);
        document.getElementById('card-scotia-pagado').classList.remove('hidden');
        
        if(this.runMatchScotiabank) {
            if(this.switchTab) this.switchTab('scotia');
            this.runMatchScotiabank();
        }
        
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
    },

    // Ejecuta el cruce de conciliación Scotia
    runMatchScotiabank: function() {
        const hasDetalle = this.data.scotia_detalle && this.data.scotia_detalle.length > 0;
        const hasPagado = this.data.scotia_pagado && this.data.scotia_pagado.length > 0;

        if (!hasDetalle || !hasPagado) {
            const container = document.getElementById('table-result-scotia');
            if(container) {
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
    }
};