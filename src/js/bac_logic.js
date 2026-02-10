window.BACLogic = {
    // Procesa el CSV de Detalle (BAC)
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
        const cleanNum = (val) => {
            if(!val) return 0;
            let clean = String(val).replace(/["'\s]/g, '');
            if(clean.includes(',')) {
                clean = clean.replace(/\./g, '').replace(',', '.');
            } 
            else if((clean.match(/\./g) || []).length > 1) {
                clean = clean.replace(/\./g, '');
            }
            return parseFloat(clean) || 0;
        };

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
                ...headerRow.reduce((acc, h, idx) => {
                    acc[String(idx)] = row[idx];
                    return acc;
                }, {})
            };
        });
        
        this.recalculateDetalle();
        
        const dropzone = document.getElementById('drop-bac-detalle');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-red-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            const status = document.getElementById('status-bac-detalle');
            if(status) { 
                status.innerText = `Cargado: ${this.data.detalle.length} filas`; 
                status.classList.add('text-green-600', 'font-bold'); 
            }
        }
    },

    // Procesa el Excel de Pagado (BAC)
    processExcel: function(buf) {
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

        if(startRowIdx === -1) return alert("No se encontró la fila de encabezados (Código/Descripción/Créditos).");

        const headers = rawRows[startRowIdx];
        const iCodigo = headers.findIndex(h => h && String(h).toLowerCase().includes('código'));
        const iDesc = headers.findIndex(h => h && String(h).toLowerCase().includes('descripci'));
        const iCredito = headers.findIndex(h => h && String(h).toLowerCase().includes('crédito'));

        if(iCodigo === -1) return alert("No se encontró la columna 'Código'.");

        const cleanData = [];
        let totalCreditosTF = 0;

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

            if (m > 0 && isAFI) {
                totalCreditosTF += m;
            }

            const rowObj = {
                _desc: desc,
                _monto: m,
                _enabled: isAFI, 
                ...headers.reduce((acc, h, idx) => {
                    acc[String(idx)] = row[idx];
                    return acc;
                }, {})
            };
            cleanData.push(rowObj);
        }

        this.data.headers = this.data.headers || {};
        this.data.headers.pagado = headers;
        this.data.pagado = cleanData;

        const elTotal = document.getElementById('sum-depositos');
        if(elTotal) elTotal.innerText = this.formatMoney(totalCreditosTF);
        
        const card = document.getElementById('card-bac-pagado');
        if(card) card.classList.remove('hidden');

        const dropzone = document.getElementById('drop-bac-pagado');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-green-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            const status = document.getElementById('status-bac-pagado');
            if(status) { 
                status.innerText = `Cargado: ${cleanData.length} filas`; 
                status.classList.remove('hidden');
                status.classList.add('text-green-600', 'font-bold'); 
            }
        }
        
        if(this.switchTab) this.switchTab('bac');
        this.runMatch();
    },

    // Genera el HTML de la tarjeta resumen BAC
    recalculateDetalle: function() {
        if(!this.data.detalle || !this.data.detalle.length) return;
        let s = { v:0, c:0, rv:0, rr:0, n:0 };
        this.data.detalle.forEach(r => {
            if(r._enabled) { s.v+=r._venta; s.c+=r._comision; s.rv+=r._retV; s.rr+=r._retR; s.n+=r._neto; }
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
                        <span class="text-[9px] text-blue-500 uppercase font-bold block mb-1">Neto Esperado</span>
                        <span class="font-mono font-bold text-blue-700 dark:text-blue-300 text-base block truncate">${fmt(s.n)}</span>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('bac-summary-container').innerHTML = html;
        document.getElementById('card-bac-detalle').classList.remove('hidden');
        this.runMatch();
    },

    // Ejecuta el cruce de conciliación BAC
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
            const net = r._neto;
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
        
        console.log("Grid BAC actualizado");
        this.renderAudit('bac');
    }
};