window.BACLogic = {
    // Procesa el CSV de Detalle (BAC)
    processCSV: function(text, filename) {
        // 0. VALIDACIÓN DE DUPLICADOS (Seguridad)
        // Inicializar estructura si no existe
        this.data.files = this.data.files || { bac_detalle: [], bac_pagado: [] };
        
        // Si el archivo ya está en la lista, detenemos todo.
        if (filename && this.data.files.bac_detalle.includes(filename)) {
            alert(`⚠️ El archivo "${filename}" ya fue cargado previamente.\n\nSe omitirá para evitar duplicar datos.`);
            
            // Opcional: Feedback visual en el status
            const status = document.getElementById('status-bac-detalle');
            if(status) {
                const prev = status.innerHTML;
                this.updateFileList('bac_detalle');
                setTimeout(() => status.innerHTML = prev, 2000); // Restaurar vista anterior
            }
            return; 
        }
        const rows = text.split(/\r\n|\n/).map(l => {
            if(!l.trim()) return null;
            let r=[], q=false, b=''; 
            for(let c of l){ 
                if(c=='"') q=!q; else if(c==',' && !q){ r.push(b); b=''; } else b+=c; 
            } 
            r.push(b); return r;
        }).filter(r => r && r.length > 5);

        const headerRow = rows[0].map(h => String(h).replace(/["']/g, '').trim());
        // VALIDACIÓN DE ESTRUCTURA (Smart Check)
        const strHeaders = headerRow.join(' ').toLowerCase();
        // Debe tener al menos Neto y Comisión para ser un reporte válido de BAC
        if (!strHeaders.includes('neto') || !strHeaders.includes('comis')) {
            alert("⛔ Error de Formato:\n\nEl archivo no parece ser un reporte detallado de BAC.\nFaltan columnas clave ('Monto Neto' o 'Comisión').");
            return; // Detener proceso
        }
        this.data.headers = this.data.headers || {};
        this.data.headers.detalle = headerRow;

        const idxNeto = headerRow.findIndex(h => /Neto/i.test(h)); 
        const idxACI = headerRow.findIndex(h => /Ajuste.*Comisi/i.test(h)); 
        const idxLiq = headerRow.findIndex(h => /Liquidaci/i.test(h));

        const cleanNum = (val) => {
            if(!val) return 0;
            let clean = String(val).replace(/["'\s]/g, '');
            if(clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
            else if((clean.match(/\./g) || []).length > 1) clean = clean.replace(/\./g, '');
            const num = parseFloat(clean);
            return Math.round((num + Number.EPSILON) * 100) / 100 || 0;
        };

        const newRows = rows.slice(1).map(row => {
            const valNeto = idxNeto !== -1 ? cleanNum(row[idxNeto]) : cleanNum(row[12]);
            const valACI = idxACI !== -1 ? cleanNum(row[idxACI]) : 0;

            return {
                _raw: row, 
                _id: row[0],
                _venta: cleanNum(row[8]), 
                _comision: cleanNum(row[9]), 
                _retV: cleanNum(row[10]), 
                _retR: cleanNum(row[11]), 
                _neto: valNeto,
                _netoACI: valNeto - valACI, 
                _enabled: true, 
                _sourceFile: filename,
                ...headerRow.reduce((acc, h, idx) => {
                    let val = row[idx];
                    if (idx === idxLiq) val = String(val || '').replace(/["']/g, '').trim();
                    acc[String(idx)] = val;
                    return acc;
                }, {})
            };
        });
        
        this.data.detalle = (this.data.detalle || []).concat(newRows);
        
        this.data.files = this.data.files || { bac_detalle: [], bac_pagado: [] };
        if(filename && !this.data.files.bac_detalle.includes(filename)) {
            this.data.files.bac_detalle.push(filename);
        }

        this.recalculateDetalle();
        
        // 2. Actualizar Lista Visual usando el Helper Centralizado
        this.updateFileList('bac_detalle');

        const dropzone = document.getElementById('drop-bac-detalle');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-red-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
        }
    },

    // Procesa el Excel de Pagado (BAC)
    processExcel: function(buf, filename) {
        // 0. VALIDACIÓN DE DUPLICADOS (Seguridad)
        this.data.files = this.data.files || { bac_detalle: [], bac_pagado: [] };
        
        if (filename && this.data.files.bac_pagado.includes(filename)) {
            alert(`⚠️ El archivo "${filename}" ya fue cargado previamente.\n\nSe omitirá para evitar duplicar datos.`);
            
            const status = document.getElementById('status-bac-pagado');
            if(status) {
                const prev = status.innerHTML;
                status.innerHTML = `<span class="text-red-500 font-bold">⛔ Ya existe</span>`;
                setTimeout(() => status.innerHTML = prev, 2000);
            }
            return;
        }
        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        let startRowIdx = -1;
        for(let i = 0; i < Math.min(rawRows.length, 30); i++) {
            const rowStr = JSON.stringify(rawRows[i] || []).toLowerCase();
            if(rowStr.includes('código') && rowStr.includes('descripci') && rowStr.includes('crédito')) {
                startRowIdx = i;
                break;
            }
        }

        if(startRowIdx === -1) {
            alert("⛔ Error de Formato:\n\nEl archivo Excel no tiene la estructura de 'Pagos Diarios' de BAC.\n\nSe buscaban las columnas:\n- Código\n- Descripción\n- Créditos");
            return; 
        }

        const headers = rawRows[startRowIdx];
        const iCodigo = headers.findIndex(h => h && String(h).toLowerCase().includes('código'));
        const iDesc = headers.findIndex(h => h && String(h).toLowerCase().includes('descripci'));
        const iCredito = headers.findIndex(h => h && String(h).toLowerCase().includes('crédito'));

        // Validación Estricta
        const missing = [];
        if(iCodigo === -1) missing.push("Código");
        if(iDesc === -1) missing.push("Descripción");
        if(iCredito === -1) missing.push("Crédito");

        if(missing.length > 0) {
            alert(`⛔ Archivo Inválido:\n\nFaltan las siguientes columnas obligatorias:\n- ${missing.join('\n- ')}`);
            return;
        }

        const cleanData = [];
        
        for(let i = startRowIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || row.length === 0) continue;

            const firstCell = String(row[0] || '').toLowerCase();
            if(firstCell.includes('total') || firstCell.includes('saldo final') || firstCell.includes('resumen')) break;

            const montoRaw = row[iCredito];
            let m = 0;
            if(typeof montoRaw === 'number') m = montoRaw;
            else if(typeof montoRaw === 'string') m = parseFloat(montoRaw.replace(/\s/g,'').replace(',','.')) || 0;

            const desc = String(row[iDesc] || '');
            const isAFI = desc.toUpperCase().trim().startsWith('AFI');

            const rowObj = {
                _desc: desc,
                _monto: m,
                _enabled: isAFI, 
                _sourceFile: filename,
                ...headers.reduce((acc, h, idx) => {
                    acc[String(idx)] = row[idx];
                    return acc;
                }, {})
            };
            cleanData.push(rowObj);
        }

        this.data.headers = this.data.headers || {};
        this.data.headers.pagado = headers;
        
        this.data.pagado = (this.data.pagado || []).concat(cleanData);

        const totalGlobalPagado = this.data.pagado.reduce((acc, r) => {
            return acc + (r._enabled ? r._monto : 0);
        }, 0);

        this.data.files = this.data.files || { bac_detalle: [], bac_pagado: [] };
        if(filename && !this.data.files.bac_pagado.includes(filename)) {
            this.data.files.bac_pagado.push(filename);
        }

        const elTotal = document.getElementById('sum-depositos');
        if(elTotal) elTotal.innerText = this.formatMoney(totalGlobalPagado);
        
        // CORRECCIÓN: Mostrar tarjeta
        document.getElementById('card-bac-pagado').classList.remove('hidden');

        // 2. Actualizar Lista Visual usando el Helper Centralizado
        this.updateFileList('bac_pagado');

        const dropzone = document.getElementById('drop-bac-pagado');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-green-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
        }
        
        if(this.switchTab) this.switchTab('bac');
        this.runMatch();
    },

    recalculateDetalle: function() {
        if(!this.data.detalle || !this.data.detalle.length) return;
        let s = { v:0, c:0, rv:0, rr:0, n_aci:0 }; 
        this.data.detalle.forEach(r => {
            if(r._enabled) { s.v+=r._venta; s.c+=r._comision; s.rv+=r._retV; s.rr+=r._retR; s.n_aci+=r._netoACI; }
        });
        const fmt = this.formatMoney;

        const html = `
            <div class="grid grid-cols-12 gap-4 items-center w-full h-full px-2">
                <div class="col-span-3 flex flex-col justify-center border-r border-slate-100 dark:border-slate-700 pr-2">
                    <span class="text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1">Ventas Totales</span>
                    <span class="font-mono font-bold text-slate-700 dark:text-slate-200 text-sm truncate" title="${fmt(s.v)}">${fmt(s.v)}</span>
                </div>
                <div class="col-span-5 flex flex-col justify-center text-[10px] space-y-1 border-r border-slate-100 dark:border-slate-700 pr-2">
                    <div class="flex justify-between">
                        <span class="text-red-400">Comisión</span>
                        <span class="font-mono text-red-500 font-bold">-${fmt(s.c)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-orange-400">Ret. Ventas (5.31%)</span>
                        <span class="font-mono text-orange-500">-${fmt(s.rv)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-orange-400">Ret. Renta (1.76%)</span>
                        <span class="font-mono text-orange-500">-${fmt(s.rr)}</span>
                    </div>
                </div>
                <div class="col-span-4 flex flex-col justify-center items-end pl-2">
                    <div class="bg-blue-50 dark:bg-blue-900/30 rounded-lg px-3 py-2 w-full text-center border border-blue-100 dark:border-blue-800">
                        <span class="text-[9px] text-blue-500 uppercase font-bold block mb-1">Neto Esperado (-ACI)</span>
                        <span class="font-mono font-bold text-blue-700 dark:text-blue-300 text-base block truncate">${fmt(s.n_aci)}</span>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('bac-summary-container').innerHTML = html;
        document.getElementById('card-bac-detalle').classList.remove('hidden');
        this.runMatch();
    },

    runMatch: function() {
        const hasDetalle = this.data.detalle && this.data.detalle.length > 0;
        const hasPagado = this.data.pagado && this.data.pagado.length > 0;

        if (!hasDetalle || !hasPagado) {
            const container = document.getElementById('table-result-bac');
            if(container) {
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

        const det = {}, pag = {};
        
        this.data.detalle.forEach(r => {
            if(!r._enabled) return;
            const id = r._id;
            const net = r._netoACI; 
            if(!det[id]) det[id]={id, count:0, sumNeto:0};
            det[id].count++; det[id].sumNeto+=net;
        });

        this.data.pagado.forEach(r => {
            if(!r._enabled) return;
            const d = r._desc || ""; 
            const id = d.length > 3 ? d.split(' ')[0].substring(3) : ""; 
            if(id) { 
                if(!pag[id]) pag[id] = 0; 
                pag[id] += r._monto; 
            }
        });

        const now = new Date();
        const timeKey = now.getTime();

        const tableData = Object.values(det).map(i => ({
            uuid: `${timeKey}-${i.id}`, 
            id: i.id, 
            count: i.count, 
            neto: i.sumNeto,
            pagado: pag[i.id]||0, 
            diff: i.sumNeto-(pag[i.id]||0)
        }));

        const columns = [
            { title: "ID Ref", field: "uuid", width: 140, headerFilter: true, visible: false }, 
            { title: "Afiliado", field: "id", headerFilter: true, width: 100 }, 
            { title: "Trans.", field: "count", hozAlign: "center", bottomCalc: "sum" },
            { title: "Neto Esperado", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Depositado", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diff", hozAlign: "right", formatter: "money", bottomCalc: "sum" }
        ];

        const thresholdInput = document.getElementById('threshold-bac');
        const currentThreshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

        if (this.grids.bac) {
            this.grids.bac.updateData(tableData);
        } else {
            this.grids.bac = new VanillaGrid("#table-result-bac", tableData, columns, {
                threshold: currentThreshold,
                searchInputId: "search-bac"
            });
        }
        
        this.renderAudit('bac');
    },

    // Eliminar archivo Detalle y recalcular
    removeFileDetalle: function(filename) {
        if(!confirm(`¿Eliminar los datos de "${filename}"?`)) return;

        // 1. Filtrar Datos: Mantener solo los que NO son de este archivo
        this.data.detalle = this.data.detalle.filter(row => row._sourceFile !== filename);
        
        // 2. Actualizar Lista de Archivos
        this.data.files.bac_detalle = this.data.files.bac_detalle.filter(f => f !== filename);

        // 3. Refrescar UI
        this.recalculateDetalle();
        this.updateFileList('bac_detalle');
        
        // Feedback
        const drop = document.getElementById('drop-bac-detalle');
        if(this.data.detalle.length === 0) {
            drop.classList.remove('border-green-500', 'bg-green-50');
            drop.classList.add('border-slate-300', 'bg-white');
        }
    },

    // Eliminar archivo Pagado y recalcular
    removeFilePagado: function(filename) {
        if(!confirm(`¿Eliminar los datos de "${filename}"?`)) return;

        // 1. Filtrar Datos
        this.data.pagado = this.data.pagado.filter(row => row._sourceFile !== filename);
        
        // 2. Actualizar Lista
        this.data.files.bac_pagado = this.data.files.bac_pagado.filter(f => f !== filename);

        // 3. Recalcular Total Global
        const total = this.data.pagado.reduce((acc, r) => acc + (r._enabled ? r._monto : 0), 0);
        document.getElementById('sum-depositos').innerText = this.formatMoney(total);

        // 4. Refrescar UI y Match
        this.updateFileList('bac_pagado');
        this.runMatch();

        const drop = document.getElementById('drop-bac-pagado');
        if(this.data.pagado.length === 0) {
            drop.classList.remove('border-green-500', 'bg-green-50');
            drop.classList.add('border-slate-300', 'bg-white');
            document.getElementById('card-bac-pagado').classList.add('hidden');
        }
    },

    // Helper para actualizar la lista visual (DRY)
    updateFileList: function(type) {
        const isDet = type === 'bac_detalle';
        const files = isDet ? this.data.files.bac_detalle : this.data.files.bac_pagado;
        const status = document.getElementById(isDet ? 'status-bac-detalle' : 'status-bac-pagado');
        
        if(!status) return;

        if(files.length === 0) {
            status.innerHTML = '';
            status.classList.add('hidden');
            return;
        }

        const count = files.length;
        const colorText = isDet ? 'text-green-600' : 'text-green-700';
        
        // HTML con Botón de Eliminar (X)
        const listItems = files.map(f => `
            <div class="flex justify-between items-center bg-slate-700 p-1 rounded hover:bg-slate-600 transition-colors group/item">
                <span class="truncate text-[9px] text-slate-300 w-32" title="${f}">• ${f}</span>
                <button onclick="window.ConciliacionLogic.${isDet ? 'removeFileDetalle' : 'removeFilePagado'}('${f}')" 
                        class="text-red-400 hover:text-red-200 p-0.5 rounded ml-2 opacity-0 group-hover/item:opacity-100 transition-opacity" title="Eliminar archivo">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        `).join('');

        status.innerHTML = `
            <div class="font-bold text-[10px] ${colorText} cursor-help flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                ${count} Archivo${count !== 1 ? 's' : ''}
            </div>
            
            <!-- LISTA FLOTANTE MEJORADA -->
            <div class="hidden group-hover:block absolute top-full left-0 mt-1 w-48 bg-slate-800 rounded shadow-xl border border-slate-600 p-1 z-[100]">
                <div class="text-[9px] font-bold text-slate-400 border-b border-slate-600 pb-1 mb-1 px-1">Archivos Cargados:</div>
                <div class="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                    ${listItems}
                </div>
            </div>
        `;
        status.parentElement.classList.add('group', 'relative');
        status.classList.remove('hidden');
    }
};