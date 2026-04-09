window.BACLogic = {
    // Procesa el CSV de Detalle (BAC)
    // Procesa el CSV de Detalle (BAC) con Soporte Multi-Archivo Seguro
    processCSV: async function(text, filename) {
        // 0. VALIDACIÓN DE DUPLICADOS
        this.data.files = this.data.files || {};
        this.data.files.bac_detalle = this.data.files.bac_detalle || [];
        this.data.files.bac_pagado = this.data.files.bac_pagado || [];
        
        if (filename && this.data.files.bac_detalle.includes(filename)) {
            await SysUI.alert(`⚠️ El archivo "${filename}" ya fue cargado previamente.\n\nSe omitirá para evitar duplicar datos.`, "Archivo Duplicado", "warning");
            const status = document.getElementById('status-bac-detalle');
            if(status) {
                const prev = status.innerHTML;
                this.updateFileList('bac_detalle');
                setTimeout(() => status.innerHTML = prev, 2000); 
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

        if (rows.length === 0) return;

        // 1. IDENTIFICAR ENCABEZADOS DEL ARCHIVO ACTUAL
        const currentHeaders = rows[0].map(h => String(h).replace(/["']/g, '').trim());
        const strHeaders = currentHeaders.join(' ').toLowerCase();

        if (!strHeaders.includes('neto') || !strHeaders.includes('comis')) {
            await SysUI.alert("⛔ Error de Formato:\n\nEl archivo no parece ser un reporte detallado de BAC.\nFaltan columnas clave ('Monto Neto' o 'Comisión').", "Error", "error");
            this.updateFileList('bac_detalle'); 
            return; 
        }

        // 2. LÓGICA "MASTER HEADER" (Soporte Multi-Archivo)
        this.data.headers = this.data.headers || {};
        if (!this.data.headers.detalle || this.data.headers.detalle.length === 0) {
            this.data.headers.detalle = [...currentHeaders];
        }
        const masterHeaders = this.data.headers.detalle;

        // Mapa de traducción: IndiceArchivoActual -> IndiceMaster
        const indexMap = {};
        currentHeaders.forEach((currH, currIdx) => {
            const masterIdx = masterHeaders.findIndex(mh => mh.toLowerCase() === currH.toLowerCase());
            if (masterIdx !== -1) {
                indexMap[currIdx] = masterIdx;
            } else {
                const newMasterIdx = masterHeaders.length;
                masterHeaders.push(currH);
                indexMap[currIdx] = newMasterIdx;
            }
        });

        // 3. BUSCAR COLUMNAS CLAVE EN EL ARCHIVO ACTUAL
        const idxNeto = currentHeaders.findIndex(h => /Neto/i.test(h)); 
        const idxACI = currentHeaders.findIndex(h => /Ajuste.*Comisi/i.test(h)); 
        const idxLiq = currentHeaders.findIndex(h => /Liquidaci/i.test(h));
        const idxFecha = currentHeaders.findIndex(h => /fecha/i.test(h)); 

        const cleanNum = (val) => {
            if(!val) return 0;
            let clean = String(val).replace(/["'\s]/g, '');
            if(clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
            else if((clean.match(/\./g) || []).length > 1) clean = clean.replace(/\./g, '');
            const num = parseFloat(clean);
            return Math.round((num + Number.EPSILON) * 100) / 100 || 0;
        };

        // 4. EXTRAER Y MAPEAR FILAS
        const newRows = rows.slice(1).map(row => {
            const valNeto = idxNeto !== -1 ? cleanNum(row[idxNeto]) : cleanNum(row[12]);
            const valACI = idxACI !== -1 ? cleanNum(row[idxACI]) : 0;

            let valLiq = '';
            if (idxLiq !== -1 && row[idxLiq]) {
                valLiq = String(row[idxLiq]).replace(/["']/g, '').trim();
            }

            // Mapear celdas al Master Header
            const mappedData = {};
            currentHeaders.forEach((h, currIdx) => {
                const mIdx = indexMap[currIdx];
                let cellVal = row[currIdx];
                if (currIdx === idxLiq) cellVal = String(cellVal || '').replace(/["']/g, '').trim();
                mappedData[String(mIdx)] = cellVal;
            });

            return {
                _uid: 'det_' + Math.random().toString(36).substr(2, 9),
                _raw: row, 
                _id: row[0],
                _liq: valLiq,
                _fecha: idxFecha !== -1 ? row[idxFecha] : "", 
                _venta: cleanNum(row[8]), 
                _comision: cleanNum(row[9]), 
                _retV: cleanNum(row[10]), 
                _retR: cleanNum(row[11]), 
                _neto: valNeto,
                _netoACI: valNeto - valACI, 
                _enabled: true, 
                _sourceFile: filename,
                ...mappedData
            };
        });
        
        this.data.detalle = (this.data.detalle || []).concat(newRows);
        
        if(filename && !this.data.files.bac_detalle.includes(filename)) {
            this.data.files.bac_detalle.push(filename);
        }

        this.recalculateDetalle();
        this.updateFileList('bac_detalle');

        const dropzone = document.getElementById('drop-bac-detalle');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-red-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
        }
    },

    // Procesa el Excel de Pagado (BAC) con Soporte Multi-Archivo Seguro
    processExcel: async function(buf, filename) {
        // 0. VALIDACIÓN DE DUPLICADOS
        this.data.files = this.data.files || {};
        this.data.files.bac_detalle = this.data.files.bac_detalle || [];
        this.data.files.bac_pagado = this.data.files.bac_pagado || [];
        
        if (filename && this.data.files.bac_pagado.includes(filename)) {
            await SysUI.alert(`⚠️ El archivo "${filename}" ya fue cargado previamente.\n\nSe omitirá para evitar duplicar datos.`, "Archivo Duplicado", "warning");
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

        // Buscar inicio de datos
        let startRowIdx = -1;
        for(let i = 0; i < Math.min(rawRows.length, 30); i++) {
            const rowStr = JSON.stringify(rawRows[i] || []).toLowerCase();
            if(rowStr.includes('código') && rowStr.includes('descripci') && rowStr.includes('crédito')) {
                startRowIdx = i;
                break;
            }
        }

        if(startRowIdx === -1) {
            await SysUI.alert("⛔ Error de Formato:\n\nEl archivo Excel no tiene la estructura de 'Pagos Diarios' de BAC.\n\nSe buscaban las columnas:\n- Código\n- Descripción\n- Créditos", "Error de Lectura", "error");
            return; 
        }

        // 1. IDENTIFICAR ENCABEZADOS DEL ARCHIVO ACTUAL
        const currentHeaders = rawRows[startRowIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        
        // 2. LÓGICA "MASTER HEADER"
        this.data.headers = this.data.headers || {};
        if (!this.data.headers.pagado || this.data.headers.pagado.length === 0) {
            this.data.headers.pagado = [...currentHeaders];
        }
        const masterHeaders = this.data.headers.pagado;

        // Mapeo
        const indexMap = {};
        currentHeaders.forEach((currH, currIdx) => {
            // Se agregó "mh && currH &&" para evitar errores si la celda es null o undefined
            const masterIdx = masterHeaders.findIndex(mh => mh && currH && String(mh).toLowerCase() === String(currH).toLowerCase());
            if (masterIdx !== -1) {
                indexMap[currIdx] = masterIdx;
            } else {
                const newMasterIdx = masterHeaders.length;
                masterHeaders.push(currH);
                indexMap[currIdx] = newMasterIdx;
            }
        });

        // 3. ÍNDICES ACTUALES
        const iCodigo = currentHeaders.findIndex(h => h && String(h).toLowerCase().includes('código'));
        const iDesc = currentHeaders.findIndex(h => h && String(h).toLowerCase().includes('descripci'));
        const iCredito = currentHeaders.findIndex(h => h && String(h).toLowerCase().includes('crédito'));
        const iFecha = currentHeaders.findIndex(h => h && String(h).toLowerCase().includes('fecha'));

        const missing = [];
        if(iCodigo === -1) missing.push("Código");
        if(iDesc === -1) missing.push("Descripción");
        if(iCredito === -1) missing.push("Crédito");

        if(missing.length > 0) {
            await SysUI.alert(`⛔ Archivo Inválido:\n\nFaltan las siguientes columnas obligatorias:\n- ${missing.join('\n- ')}`, "Columnas Faltantes", "error");
            this.updateFileList('bac_pagado');
            return;
        }

        // 4. MAPEO DE DATOS
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

            const desc = String(row[iDesc] || '').trim(); 
            
            const parts = desc.split(' ');
            const extractedID = parts.length > 0 ? parts[0] : "SIN_ID";
            const liqMatch = desc.match(/LIQ\s*(\d+)/i);
            const liqRef = liqMatch ? liqMatch[1] : "";
            const isAFI = desc.toUpperCase().startsWith('AFI');

            // Mapear al Master Header
            const mappedData = {};
            currentHeaders.forEach((h, currIdx) => {
                const mIdx = indexMap[currIdx];
                mappedData[String(mIdx)] = row[currIdx];
            });

            const rowObj = {
                _uid: 'pag_' + Math.random().toString(36).substr(2, 9),
                _desc: desc,
                _extractedId: extractedID, 
                _liqRef: liqRef, 
                _monto: m,
                _fecha: iFecha !== -1 ? row[iFecha] : "", 
                _enabled: isAFI, 
                _sourceFile: filename,
                ...mappedData
            };
            cleanData.push(rowObj);
        }

        this.data.pagado = (this.data.pagado || []).concat(cleanData);

        const totalGlobalPagado = this.data.pagado.reduce((acc, r) => {
            return acc + (r._enabled ? r._monto : 0);
        }, 0);

        if(filename && !this.data.files.bac_pagado.includes(filename)) {
            this.data.files.bac_pagado.push(filename);
        }

        const elTotal = document.getElementById('sum-depositos');
        if(elTotal) elTotal.innerText = this.formatMoney(totalGlobalPagado);
        
        document.getElementById('card-bac-pagado').classList.remove('hidden');
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
            <div class="flex flex-row justify-between items-center w-full h-full px-2 py-1">
                <!-- 1. VENTAS BRUTAS -->
                <div class="flex flex-col justify-center px-3 border-r border-slate-200 dark:border-slate-700 shrink-0">
                    <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Ventas Totales</span>
                    <span class="font-mono font-black text-slate-800 dark:text-white text-2xl truncate drop-shadow-sm">${fmt(s.v)}</span>
                </div>

                <!-- 2. DEDUCCIONES (Línea de Ensamblaje) -->
                <div class="flex items-center justify-center flex-grow px-2 gap-2 sm:gap-4 overflow-hidden">
                    <div class="flex flex-col items-center">
                        <span class="text-[8px] sm:text-[9px] font-bold text-red-500 uppercase bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full mb-1 border border-red-100 dark:border-red-800 tracking-wide">Comis 1.95%</span>
                        <span class="text-xs font-mono font-bold text-red-600 dark:text-red-400 truncate">-${fmt(s.c)}</span>
                    </div>
                    <span class="text-slate-300 dark:text-slate-600 text-lg font-light">-</span>
                    
                    <div class="flex flex-col items-center">
                        <span class="text-[8px] sm:text-[9px] font-bold text-orange-500 uppercase bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded-full mb-1 border border-orange-100 dark:border-orange-800 tracking-wide">R.Ven 5.31%</span>
                        <span class="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 truncate">-${fmt(s.rv)}</span>
                    </div>
                    <span class="text-slate-300 dark:text-slate-600 text-lg font-light">-</span>
                    
                    <div class="flex flex-col items-center">
                        <span class="text-[8px] sm:text-[9px] font-bold text-amber-600 uppercase bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full mb-1 border border-amber-100 dark:border-amber-800 tracking-wide">R.Ren 1.76%</span>
                        <span class="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 truncate">-${fmt(s.rr)}</span>
                    </div>
                </div>

                <!-- 3. NETO ESPERADO -->
                <div class="flex flex-col justify-center min-w-[160px] pl-3 border-l border-slate-200 dark:border-slate-700 shrink-0">
                    <div class="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-3 py-2 w-full text-center border border-blue-200 dark:border-blue-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 group-hover:w-1.5 transition-all"></div>
                        <span class="text-[9px] text-blue-600 dark:text-blue-400 uppercase font-black block mb-0.5 tracking-widest pl-1">Neto Esperado</span>
                        <span class="font-mono font-black text-blue-700 dark:text-blue-400 text-2xl block truncate pl-1">${fmt(s.n_aci)}</span>
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

        if (!hasDetalle && !hasPagado) {
            const container = document.getElementById('table-result-bac');
            if(container) container.innerHTML = '<div class="text-center text-slate-400 p-10 font-bold">Esperando archivos...</div>';
            return;
        }

        // 1. Agrupar Detalle (Ventas)
        const det = {};
        this.data.detalle.forEach(r => {
            if(!r._enabled) return;
            const id = r._id;
            const net = r._netoACI; // Usamos Neto - ACI
            if(!det[id]) det[id]={id, count:0, sumNeto:0, rows: []};
            det[id].count++; 
            det[id].sumNeto += net;
            det[id].rows.push(r);
        });

        // 2. Agrupar Pagado (Bancos)
        const pag = {};
        this.data.pagado.forEach(r => {
            if(!r._enabled) return;
            const d = r._desc || ""; 
            const id = d.length > 3 ? d.split(' ')[0].substring(3) : "SIN_ID"; 
            if(id) { 
                if(!pag[id]) pag[id] = { id, sum: 0, rows: [] }; 
                pag[id].sum += r._monto; 
                pag[id].rows.push(r);
            }
        });

        // 3. PROCESAMIENTO INTELIGENTE (DOBLE PASADA)
        const now = new Date();
        const timeKey = now.getTime();
        const allIds = new Set([...Object.keys(det), ...Object.keys(pag)]);
        
        const gridData = [];     // Tabla Verde
        const exceptions = [];   // Tabla Roja

        // A. Inyectar Conciliaciones Manuales (Ya procesadas)
        this.manualMatches.forEach(group => {
            const sumDet = group.rows.filter(r => r._type === 'Venta').reduce((s, r) => s + (r._netoACI || r._neto || 0), 0);
            const sumPag = group.rows.filter(r => r._type === 'Banco').reduce((s, r) => s + (r._monto || 0), 0);
            
            gridData.push({
                uuid: group.id,
                id: group.rows[0]?._id || group.rows[0]?._extractedId || "MANUAL",
                count: group.rows.length,
                neto: sumDet,
                pagado: sumPag,
                diferencia_val: sumDet - sumPag, 
                rowsDet: group.rows.filter(r => r._type === 'Venta'),
                rowsPag: group.rows.filter(r => r._type === 'Banco'),
                _isManual: true, 
                _groupID: group.id,
                _manualReason: group.reason,
                // UI: Azul pastel translúcido estático
                _rowClass: "bg-blue-50 dark:bg-blue-900/20 border-l-[4px] border-l-blue-400 font-medium text-slate-800 dark:text-slate-200" 
            });
        });

        allIds.forEach(id => {
            const dObj = det[id] || { count:0, sumNeto:0, rows:[] };
            const pObj = pag[id] || { sum:0, rows:[] };
            
            // DETECCIÓN DE SALDOS ANTERIORES:
            const isHistorical = dObj.rows.some(r => r._isHistorical) || pObj.rows.some(r => r._isHistorical);
            const classRow = isHistorical ? "bg-amber-50 dark:bg-amber-900/20 border-l-[4px] border-l-amber-500 font-medium" : "";

            const diff = dObj.sumNeto - pObj.sum;
            const isMatch = Math.abs(diff) < 1 && dObj.sumNeto > 0 && pObj.sum > 0;

            if (isMatch) {
                // CASO A: Conciliación Perfecta
                gridData.push({
                    uuid: `${timeKey}-${id}`,
                    id: id,
                    count: dObj.count,
                    neto: dObj.sumNeto,
                    pagado: pObj.sum,
                    diferencia_val: diff, 
                    rowsDet: dObj.rows,
                    rowsPag: pObj.rows,
                    // PROPAGACIÓN DE HISTÓRICOS (Color Ámbar para recuperaciones)
                    _isHistoricalGroup: isHistorical,
                    _rowClass: classRow
                });
            } else {
                // CASO B: Rescate por Liquidación
                const rescueResult = this.tryMatchByLiquidation(dObj.rows, pObj.rows, id, timeKey);
                
                if (rescueResult.matched.length > 0) {
                    // Propagar la clase histórica a las filas rescatadas
                    const markedMatched = rescueResult.matched.map(m => {
                        const mIsHistorical = m.rowsDet.some(r => r._isHistorical) || m.rowsPag.some(r => r._isHistorical);
                        return {
                            ...m,
                            _isHistoricalGroup: mIsHistorical,
                            _rowClass: mIsHistorical ? "bg-amber-50 dark:bg-amber-900/20 border-l-[4px] border-l-amber-500 font-medium" : ""
                        };
                    });
                    gridData.push(...markedMatched);
                }

                if (rescueResult.residue.rowsDet.length > 0 || rescueResult.residue.rowsPag.length > 0) {
                    const resDetSum = rescueResult.residue.rowsDet.reduce((s,r) => s + r._netoACI, 0);
                    const resPagSum = rescueResult.residue.rowsPag.reduce((s,r) => s + r._monto, 0);
                    
                    // EXTRAER FECHA EXACTA
                    let f = "N/A";
                    if (rescueResult.residue.rowsDet.length > 0 && rescueResult.residue.rowsDet[0]._fecha) {
                        f = rescueResult.residue.rowsDet[0]._fecha;
                    } else if (rescueResult.residue.rowsPag.length > 0 && rescueResult.residue.rowsPag[0]._fecha) {
                        f = rescueResult.residue.rowsPag[0]._fecha;
                    }
                    if(f !== "N/A") f = window.ConciliacionLogic.formatDateCR(f); 
                    
                    exceptions.push({
                        uuid: `${timeKey}-${id}-ERR`,
                        id: id,
                        fecha: f,
                        count: rescueResult.residue.rowsDet.length,
                        neto: resDetSum,
                        pagado: resPagSum,
                        diff: resDetSum - resPagSum,
                        rowsDet: rescueResult.residue.rowsDet,
                        rowsPag: rescueResult.residue.rowsPag
                    });
                }
            }
        });

        // 4. ACTUALIZAR TABLA PRINCIPAL
        const columns = [
            { title: "ID Ref", field: "uuid", width: 140, headerFilter: true, visible: false }, 
            { 
                title: "Afiliado / LIQ", field: "id", width: 220, 
                formatter: (cell) => {
                    const r = cell.getRow(); 
                    let content = `<span class="font-bold">${r.id}</span>`;
                    
                    // Inyectar Badge si es histórico
                    if(r._isHistoricalGroup) content += `<span class="ml-2 bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm tracking-wider" title="Contiene saldos pendientes de días anteriores">⏳ PENDIENTE</span>`;
                    if(r._isManual) {
                        content += `<span class="ml-2 text-purple-600" title="${r._manualReason}">🤝</span>`;
                        // BOTÓN ELIMINAR DIRECTO EN LA TABLA
                        content += `<button onclick="window.ConciliacionLogic.undoManualMatch('${r._groupID}')" class="ml-2 bg-red-100 hover:bg-red-200 text-red-600 px-1.5 py-0.5 rounded text-[9px] shadow-sm font-bold uppercase transition-colors" title="Eliminar ajuste y restaurar">Deshacer</button>`;
                    }
                    const hasAdj = (r.rowsDet && r.rowsDet.some(d => d._isAdjustment)) || (r.rowsPag && r.rowsPag.some(d => d._isAdjustment));
                    if(hasAdj) content += `<span class="ml-1 text-yellow-600" title="Contiene Fila Ficticia">🛠️</span>`;
                    return content;
                }
            },
            { title: "Trans.", field: "count", hozAlign: "center", bottomCalc: "sum" },
            { title: "Pagado (recibido)", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Detallado (esperado)", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diferencia_val", hozAlign: "right", formatter: "money", bottomCalc: "sum" }
            
        ];

        // Lectura segura del umbral (si el input está comentado en HTML, usa 2000 por defecto)
        const thresholdInput = document.getElementById('threshold-bac');
        const currentThreshold = thresholdInput && thresholdInput.value ? parseFloat(thresholdInput.value) : 2000;

        // Indexar para Doble Clic
        this.data.processed = this.data.processed || {};
        this.data.processed.bac_matches = {}; 
        [...gridData, ...exceptions].forEach(item => {
            this.data.processed.bac_matches[item.id] = item; // Usamos ID (AFI o AFI-LIQ)
            // Hack para excepciones con mismo ID base: usar UUID
            this.data.processed.bac_matches[item.uuid] = item; 
        });

        if (this.grids.bac) {
            this.grids.bac.updateData(gridData);
        } else {
            this.grids.bac = new VanillaGrid("#table-result-bac", gridData, columns, {
                threshold: currentThreshold,
                searchInputId: "search-bac",
                onRowDblClick: (rowData) => {
                    window.ConciliacionLogic.openTransactionModal(rowData);
                }
            });
        }
        
        // 5. Renderizar Auditoría (con nombres corregidos)
        this.renderBACAudit(exceptions);
    },

    // Sub-función lógica para intentar casar por Liquidación
    tryMatchByLiquidation: function(rowsDet, rowsPag, afiId, timeKey) {
        const matched = [];
        const unmatchedDet = [];
        let unmatchedPag = [...rowsPag]; // Copia para ir consumiendo

        // 1. Agrupar Detalle por Liquidación
        const detByLiq = {};
        rowsDet.forEach(r => {
            const liq = r._liq ? String(r._liq).trim() : "SIN_LIQ";
            if(!detByLiq[liq]) detByLiq[liq] = { sum: 0, rows: [] };
            detByLiq[liq].sum += r._netoACI;
            detByLiq[liq].rows.push(r);
        });

        // 2. Buscar esa Liquidación en el Pagado
        Object.keys(detByLiq).forEach(liq => {
            if (liq === "SIN_LIQ") {
                // Si no tiene liquidación, va directo a residuo
                unmatchedDet.push(...detByLiq[liq].rows);
                return;
            }

            const detGroup = detByLiq[liq];
            
            // Buscar en Pagado filas con ese _liqRef
            // Filtramos el array de pagados pendientes
            const matchPagRows = unmatchedPag.filter(p => String(p._liqRef).trim() === liq);
            const matchPagSum = matchPagRows.reduce((s, p) => s + p._monto, 0);

            const diff = detGroup.sum - matchPagSum;

            // SI CUADRA LA LIQUIDACIÓN (Tolerancia 1 colón)
            if (Math.abs(diff) < 1 && matchPagRows.length > 0) {
                // ¡MATCH! -> A Tabla Verde
                matched.push({
                    uuid: `${timeKey}-${afiId}-${liq}`,
                    id: `${afiId} - LIQ ${liq}`, 
                    count: detGroup.rows.length,
                    neto: detGroup.sum,
                    pagado: matchPagSum,
                    diferencia_val: diff, 
                    rowsDet: detGroup.rows,
                    rowsPag: matchPagRows
                });

                // Quitar los usados de unmatchedPag
                unmatchedPag = unmatchedPag.filter(p => String(p._liqRef).trim() !== liq);
            } else {
                // NO CUADRA -> A Residuo
                unmatchedDet.push(...detGroup.rows);
            }
        });

        return {
            matched: matched,
            residue: {
                rowsDet: unmatchedDet,
                rowsPag: unmatchedPag
            }
        };
    },

    // Renderiza la tabla de excepciones (roja/naranja)
    renderBACAudit: function(exceptions) {
        const container = document.getElementById('audit-bac');
        if(!container) return;

        if(exceptions.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');

        // Columnas Auditoría: Con Totales y Ordenadas
        const columns = [
            { title: "Fecha", field: "fecha", width: 90, headerFilter: true, cssClass: "text-slate-500 font-mono text-[10px]" },
            { title: "Afiliado", field: "id", width: 100, headerFilter: true },
            { 
                title: "Diagnóstico", field: "diff", width: 180, 
                formatter: (cell) => {
                    const row = cell.getRow();
                    if(row.neto > 0 && row.pagado === 0) return `<span class="text-orange-600 font-bold flex items-center gap-1">⚠ Falta Depósito</span>`;
                    if(row.neto === 0 && row.pagado > 0) return `<span class="text-blue-600 font-bold flex items-center gap-1">ℹ Sobrante Banco</span>`;
                    return `<span class="text-red-600 font-bold flex items-center gap-1">❌ Diferencia Monto</span>`;
                }
            },
            { title: "Pagado (recibido)", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Detallado (esperado)", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diff", hozAlign: "right", formatter: "money", bottomCalc: "sum", cssClass: "font-bold text-red-600 bg-red-50 dark:bg-red-900/10" }
        ];

        // Instanciar Grid de Excepciones
        // Guarda en this.grids.bac_audit para no perder referencia
        if (this.grids.bac_audit) {
            this.grids.bac_audit.updateData(exceptions);
        } else {
            this.grids.bac_audit = new VanillaGrid("#table-exceptions-bac", exceptions, columns, {
                threshold: 0, // No aplica umbral aquí, todo es excepción
                // Habilitar Doble Clic también aquí
                onRowDblClick: (rowData) => {
                // Usar UUID para buscar en el índice global y asegurar que pasamos todos los metadatos (rowsDet/rowsPag)
                const fullData = window.ConciliacionLogic.data.processed.bac_matches[rowData.uuid];
                window.ConciliacionLogic.openTransactionModal(fullData || rowData);
            }
            });
        }
    },

    // Eliminar archivo Detalle y recalcular
    removeFileDetalle: function(filename) {
        if(!confirm(`¿Eliminar los datos de "${filename}"?`)) return;

        // 1. Filtrar Datos (Borrar filas)
        this.data.detalle = this.data.detalle.filter(row => row._sourceFile !== filename);
        
        // 2. CORRECCIÓN CRÍTICA: Borrar nombre del registro de archivos
        // Aseguramos que se reasigne el array filtrado
        this.data.files.bac_detalle = this.data.files.bac_detalle.filter(f => f !== filename);

        // 3. Refrescar UI
        this.recalculateDetalle();
        this.updateFileList('bac_detalle');
        
        // Reset Dropzone si no quedan archivos
        const drop = document.getElementById('drop-bac-detalle');
        if(this.data.files.bac_detalle.length === 0) { // Usar length de archivos, es más seguro
            drop.classList.remove('border-green-500', 'bg-green-50');
            drop.classList.add('border-slate-300', 'bg-white');
            // Limpiar status completamente
            document.getElementById('status-bac-detalle').innerHTML = '';
            document.getElementById('status-bac-detalle').classList.add('hidden');
        }
    },

    // Eliminar archivo Pagado y recalcular
    removeFilePagado: function(filename) {
        if(!confirm(`¿Eliminar los datos de "${filename}"?`)) return;

        this.data.pagado = this.data.pagado.filter(row => row._sourceFile !== filename);
        
        // CORRECCIÓN CRÍTICA
        this.data.files.bac_pagado = this.data.files.bac_pagado.filter(f => f !== filename);

        const total = this.data.pagado.reduce((acc, r) => acc + (r._enabled ? r._monto : 0), 0);
        document.getElementById('sum-depositos').innerText = this.formatMoney(total);

        this.updateFileList('bac_pagado');
        this.runMatch();

        if(this.data.files.bac_pagado.length === 0) {
            const drop = document.getElementById('drop-bac-pagado');
            drop.classList.remove('border-green-500', 'bg-green-50');
            drop.classList.add('border-slate-300', 'bg-white');
            document.getElementById('card-bac-pagado').classList.add('hidden');
            document.getElementById('status-bac-pagado').innerHTML = '';
            document.getElementById('status-bac-pagado').classList.add('hidden');
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

        // Diseño UX Robusto (Anti-Flicker)
        status.innerHTML = `
            <div class="font-bold text-[10px] ${colorText} cursor-help flex items-center gap-1 relative z-20">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                ${count} Archivo${count !== 1 ? 's' : ''}
            </div>
            
            <!-- LISTA FLOTANTE -->
            <div class="hidden group-hover:block absolute left-0 top-full pt-2 z-[100] min-w-[200px]">
                <!-- Flecha decorativa -->
                <div class="absolute top-1 left-4 w-2 h-2 bg-slate-800 rotate-45"></div>
                
                <!-- Contenedor Real -->
                <div class="bg-slate-800 text-white rounded shadow-xl border border-slate-600 p-1">
                    <div class="text-[9px] font-bold text-slate-400 border-b border-slate-600 pb-1 mb-1 px-1 flex justify-between items-center">
                        <span>Archivos Cargados:</span>
                        <span class="text-[8px] bg-slate-700 px-1 rounded">${count}</span>
                    </div>
                    <div class="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar">
                        ${listItems}
                    </div>
                </div>
            </div>
        `;
        // Asegurar clases necesarias en el padre para que el absolute funcione
        status.parentElement.classList.add('group', 'relative'); 
        status.classList.remove('hidden');
    },

    // Almacén de filas diferidas manualmente (arrastre de saldo)
    deferredRows: { det: [], pag: [] },

    // Función para marcar filas como diferidas desde el PopUp
    // Función para marcar filas como diferidas desde el PopUp
    deferRows: function(rowsToDefer) {
        console.log("🚀 Iniciando diferimiento. Items recibidos:", rowsToDefer.length);
        let changed = false;

        rowsToDefer.forEach(item => {
            const targetUid = item.rawData._uid; 
            if (!targetUid) {
                console.error("❌ Error: Fila sin UID recibida del popup", item);
                return;
            }

            // Lógica unificada para buscar en Detalle o Pagado
            const isVenta = item.type === 'venta';
            const targetArray = isVenta ? this.data.detalle : this.data.pagado;
            const targetDeferred = isVenta ? this.deferredRows.det : this.deferredRows.pag;

            // Buscamos el índice en el array principal
            const idx = targetArray.findIndex(r => r._uid === targetUid);

            if (idx !== -1) {
                // Modificamos el estado
                targetArray[idx]._enabled = false;
                targetArray[idx]._deferred = true;
                
                // Lo agregamos a la lista de diferidos (Evitando duplicados)
                if (!targetDeferred.some(d => d._uid === targetUid)) {
                    targetDeferred.push(targetArray[idx]);
                }
                
                console.log(`✅ Diferido: ${isVenta ? 'Venta' : 'Banco'} [${targetUid}]`);
                changed = true;
            } else {
                console.warn(`⚠️ No se encontró el registro original: ${targetUid}`);
            }
        });

        if (changed) {
            console.log("Cambios aplicados. Recalculando...");
            
            // 1. Forzar limpieza visual (opcional pero ayuda)
            document.getElementById('sum-depositos').innerText = '...'; 

            // 2. Ejecutar cascada completa
            this.recalculateDetalle(); // Actualiza Tarjeta Arriba
            
            // Recalcular Total Global Pagado (Tarjeta Verde)
            const totalPag = this.data.pagado.reduce((acc, r) => acc + (r._enabled ? r._monto : 0), 0);
            document.getElementById('sum-depositos').innerText = this.formatMoney(totalPag);

            this.runMatch();           // Actualiza Tablas Verde y Roja
            this.renderDeferredTable(); // Muestra Tabla Azul
            
            alert(`✅ ${rowsToDefer.length} registro(s) movidos a "Saldos Pendientes".\nLa conciliación se ha recalculado.`);
        } else {
            alert("⚠️ No se pudieron aplicar cambios.\nRevise la consola para más detalles.");
        }
    },

    // Renderiza la tabla de "Saldos para Mañana"
    renderDeferredTable: function() {
        const container = document.getElementById('audit-deferred-bac'); // Nuevo contenedor en HTML
        if(!container) return;

        const allDeferred = [
            ...this.deferredRows.det.map(r => ({ ...r, _type: 'Venta', _montoVisual: r._netoACI })),
            ...this.deferredRows.pag.map(r => ({ ...r, _type: 'Banco', _montoVisual: r._monto }))
        ];

        if(allDeferred.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');

        // Instanciar Grid Simple
        const columns = [
            { 
                title: "", width: 40, hozAlign: "center", 
                formatter: (cell) => {
                    const r = cell.getRow();
                    return `<div onclick="window.ConciliacionLogic.restoreRow('${r._uid}', '${r._type}')" class="text-green-600 font-bold cursor-pointer hover:scale-125" title="Restaurar a Conciliación">↩</div>`;
                }
            },
            { title: "Tipo", field: "_type", width: 80, headerFilter: true },
            { title: "Referencia", field: "_id", width: 200, formatter: (cell) => {
                const r = cell.getRow(); 
                return r._desc || r._id || 'N/A';
            }},
            { title: "Monto", field: "_montoVisual", formatter: "money", hozAlign: "right" },
            { title: "Archivo Origen", field: "_sourceFile", width: 120 }
        ];

        if(this.grids.bac_deferred) {
            this.grids.bac_deferred.updateData(allDeferred);
        } else {
            this.grids.bac_deferred = new VanillaGrid("#table-deferred-bac", allDeferred, columns);
        }
    },

    // Restaura una fila diferida al flujo principal
    restoreRow: function(uid, type) {
        if(!confirm("¿Devolver este registro a la conciliación activa?")) return;

        const isVenta = type === 'Venta';
        
        // 1. Quitar de la lista de diferidos
        if (isVenta) {
            this.deferredRows.det = this.deferredRows.det.filter(r => r._uid !== uid);
            // 2. Reactivar en lista principal
            const original = this.data.detalle.find(r => r._uid === uid);
            if (original) { original._enabled = true; delete original._deferred; }
        } else {
            this.deferredRows.pag = this.deferredRows.pag.filter(r => r._uid !== uid);
            const original = this.data.pagado.find(r => r._uid === uid);
            if (original) { original._enabled = true; delete original._deferred; }
        }

        // 3. Recalcular todo
        this.recalculateDetalle();
        this.runMatch();
        this.renderDeferredTable();
    },

    // Almacén de conciliaciones manuales
    manualMatches: [], // Array de grupos { id: 'manual_1', rows: [], reason: '...' }

    // Función para aplicar conciliación manual desde el PopUp
    applyManualMatch: function(selection, reason) {
        // selection = { det: [ids...], pag: [ids...] }
        console.log("Aplicando Conciliación Manual:", selection, reason);

        const groupID = 'man_' + Date.now();
        const matchedRows = [];

        // 1. Marcar Detalle
        selection.det.forEach(uid => {
            const row = this.data.detalle.find(r => r._uid === uid);
            if(row) {
                row._enabled = false; // Sacar del flujo automático
                row._manualMatch = groupID;
                row._manualReason = reason;
                matchedRows.push({...row, _type: 'Venta'});
            }
        });

        // 2. Marcar Pagado
        selection.pag.forEach(uid => {
            const row = this.data.pagado.find(r => r._uid === uid);
            if(row) {
                row._enabled = false;
                row._manualMatch = groupID;
                row._manualReason = reason;
                matchedRows.push({...row, _type: 'Banco'});
            }
        });

        // 3. Guardar Grupo
        this.manualMatches.push({
            id: groupID,
            reason: reason,
            rows: matchedRows,
            timestamp: new Date()
        });

        // 4. FORZAR RECALCULO VISUAL (Esto hace que la fila desaparezca y pase a conciliados)
        this.recalculateDetalle();
        this.runMatch();
        if (typeof this.renderManualMatchesTable === 'function') this.renderManualMatchesTable();

        SysUI.alert(`Se han conciliado manualmente las transacciones bajo el motivo: "${reason}"`, "Conciliación Exitosa", "success");
        
        // Animación de enfoque en la fila
        setTimeout(() => {
            const tableContainer = document.getElementById('table-manual-bac');
            if (tableContainer) {
                tableContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Resaltar temporalmente (Flash Verde)
                tableContainer.classList.add('ring-4', 'ring-green-400', 'bg-green-50', 'transition-all', 'duration-1000');
                setTimeout(() => tableContainer.classList.remove('ring-4', 'ring-green-400', 'bg-green-50'), 2000);
            }
        }, 500);
        
    },

    // Renderiza la tabla de conciliados manuales con UX mejorada
    renderManualMatchesTable: function() {
        const container = document.getElementById('audit-manual-bac'); 
        if(!container) return;

        if(this.manualMatches.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');

        // Aplanamos datos para el Grid
        const flatRows = this.manualMatches.flatMap(group => 
            group.rows.map(r => ({
                ...r, 
                _groupID: group.id,
                _groupReason: group.reason,
                _timestamp: group.timestamp.toLocaleTimeString(),
                _montoVisual: r._type === 'Venta' ? r._netoACI : r._monto,
                _refVisual: r._type === 'Venta' ? (r._id || 'N/A') : (r._extractedId || r._desc || 'N/A')
            }))
        );

        const columns = [
            { 
                title: "", width: 40, hozAlign: "center", 
                formatter: (cell) => {
                    const r = cell.getRow();
                    return `<div onclick="window.ConciliacionLogic.undoManualMatch('${r._groupID}')" class="text-red-500 font-bold cursor-pointer hover:scale-125 transition-transform" title="Deshacer esta conciliación">✖</div>`;
                }
            },
            { 
                title: "Motivo / Justificación", field: "_groupReason", width: 200, 
                formatter: (cell) => {
                    const val = cell.getValue();
                    return `<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-purple-200 uppercase tracking-wide">${val}</span>`;
                }
            },
            { title: "Hora", field: "_timestamp", width: 80, cssClass: "text-slate-400 text-[10px]" },
            { 
                title: "Tipo", field: "_type", width: 80, 
                formatter: (cell) => {
                    const val = cell.getValue();
                    return val === 'Venta' ? `<span class="text-blue-600 font-bold">Venta</span>` : `<span class="text-green-600 font-bold">Banco</span>`;
                }
            },
            { title: "Referencia", field: "_refVisual", width: 150, cssClass: "font-mono" },
            { title: "Monto", field: "_montoVisual", formatter: "money", hozAlign: "right", cssClass: "font-bold" }
        ];

        // Instanciar o Actualizar
        if(this.grids.bac_manual) {
            this.grids.bac_manual.updateData(flatRows);
        } else {
            this.grids.bac_manual = new VanillaGrid("#table-manual-bac", flatRows, columns);
        }
        
        // Scroll automático al nuevo elemento (UX)
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    // Deshacer conciliación manual
    undoManualMatch: function(groupID) {
        if(!confirm("¿Deshacer esta conciliación y restaurar los datos iniciales? Las filas creadas manualmente se eliminarán permanentemente.")) return;

        // 1. DESTRUIR filas de ajuste ficticio (purga total)
        this.data.detalle = this.data.detalle.filter(r => !(r._manualMatch === groupID && r._isAdjustment));
        this.data.pagado = this.data.pagado.filter(r => !(r._manualMatch === groupID && r._isAdjustment));

        // 2. Reactivar filas reales originales
        this.data.detalle.forEach(r => { if(r._manualMatch === groupID) { r._enabled = true; delete r._manualMatch; } });
        this.data.pagado.forEach(r => { if(r._manualMatch === groupID) { r._enabled = true; delete r._manualMatch; } });

        // 2. Eliminar grupo
        this.manualMatches = this.manualMatches.filter(g => g.id !== groupID);

        // 3. Recalcular
        this.recalculateDetalle();
        this.runMatch();
        this.renderManualMatchesTable();
    },

    // Inyectar filas de ajuste manual (creadas en el popup)
    injectAdjustments: function(newRows) {
        console.log("Inyectando Ajustes a Ventas BAC:", newRows);
        newRows.forEach(row => {
            this.data.detalle.push(row); 
        });
    },

    // Recalcula los totales de la tarjeta verde (BAC Pagado)
    recalculateBACPagado: function() {
        let total = 0;
        this.data.pagado.forEach(r => {
            if(r._enabled) total += r._monto;
        });
        const el = document.getElementById('sum-depositos');
        if(el) el.innerText = this.formatMoney(total);
        
        this.runMatch();
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
                <title>IRI - Análisis BAC: ${data.id}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script>tailwind.config = { darkMode: 'class' }</script>
                <script src="/js/vanilla_grid.js"></script>
                <script src="/js/sys_ui.js"></script>
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
                            <span>🔎 IRI - Análisis de Ajuste BAC</span>
                            <span class="bg-blue-100 text-blue-800 text-sm px-2 py-0.5 rounded font-mono">${data.id}</span>
                        </h1>
                    </div>
                     <div class="text-right ${isReadOnly ? 'hidden' : ''}">
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
                    
                     <!-- IZQUIERDA: VENTAS -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden relative">
                        <div class="${isDark ? 'bg-blue-900/20 text-blue-300 border-slate-700' : 'bg-blue-50 text-blue-700 border-blue-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center">
                            <span>Detallado Bac (Esperado)</span>
                            <span class="bg-white dark:bg-slate-800 px-2 rounded text-[10px] shadow-sm">Total: ${this.formatMoney(data.neto)}</span>
                        </div>
                        <div id="grid-ventas" class="flex-grow relative bg-white dark:bg-slate-800"></div>
                    </div>
                </div>

                <!-- FOOTER ACTIVO (Calculadora y Botones) -->
                <div class="p-3 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-300 dark:border-slate-700">
                    <div class="flex justify-between items-center">
                        
                        <!-- LADO IZQUIERDO: Acción + Calculadora -->
                        <div class="flex items-center gap-6 text-sm">
                            ${isReadOnly ? '' : `
                                <button id="btn-add-adj" class="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-colors shadow-sm">
                                    <span class="text-base leading-none">+</span> Agregar Ajuste
                                </button>
                                <div class="w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
                                
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Sel. Pagado</span>
                                    <span id="sum-banco" class="font-mono font-bold text-green-600 dark:text-green-400">₡0,00</span>
                                </div>
                                <div class="text-slate-400 dark:text-slate-500 font-bold">-</div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Sel. Detallado</span>
                                    <span id="sum-ventas" class="font-mono font-bold text-blue-600 dark:text-blue-400">₡0,00</span>
                                </div>
                                <div class="text-slate-400 dark:text-slate-500 font-bold">=</div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Diferencia</span>
                                    <span id="sum-diff" class="font-mono font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 shadow-inner">₡0,00</span>
                                </div>
                            `}
                        </div>

                        <!-- LADO DERECHO: Acciones Finales -->
                        <div class="flex gap-3 items-center">
                            ${isReadOnly ? `
                                <span class="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 border border-green-200 dark:border-green-800 shadow-sm">
                                    ✅ Transacción Conciliada
                                </span>
                            ` : `
                                <button id="btn-manual" disabled class="bg-purple-100 dark:bg-slate-700 text-purple-400 dark:text-slate-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 cursor-not-allowed transition-colors border border-transparent shadow-sm">
                                    <span>🤝</span> Conciliar Manualmente
                                </button>
                            `}
                            <button onclick="window.close()" class="bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-4 py-2 rounded text-sm font-bold transition-colors shadow-sm">
                                Cerrar Ventana
                            </button>
                        </div>
                    </div>
                </div>

                <!-- MODAL AVANZADO DE INGRESO DE AJUSTE -->
                <div id="modal-adj" class="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] hidden flex items-center justify-center overflow-y-auto p-4 transition-all duration-300">
                    <!-- Tarjeta Principal (Se agregó id="form-card") -->
                    <div id="form-card" class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh] animate-fade-in-up transition-all duration-300 origin-bottom">
                        
                        <!-- Header Modal Estilo Ventana -->
                        <div class="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center shrink-0">
                            <div>
                                <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <span class="text-blue-600">➕</span> Ingresar Ajuste
                                </h3>
                            </div>
                            <!-- Controles de Ventana (Estilo Windows/Mac mixto) -->
                            <div class="flex items-center gap-2">
                                <!-- Botón Minimizar (_) -->
                                <button type="button" onclick="window.toggleGhostMode()" title="Minimizar Formulario" class="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors flex items-center justify-center w-8 h-8">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"></path></svg>
                                </button>
                                <!-- Botón Cerrar (X) -->
                                <button onclick="document.getElementById('modal-adj').classList.add('hidden')" title="Cerrar Formulario" class="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors flex items-center justify-center w-8 h-8">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Body Modal -->
                        <div class="p-6 overflow-y-auto flex-grow custom-scrollbar space-y-5">

                            <!-- Tipo de Ajuste -->
                            <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Ajuste <span class="text-red-500">*</span></label>
                                <select id="fm-type" class="w-full p-2 text-xs font-bold border rounded bg-white dark:bg-slate-900 dark:border-slate-600 outline-none focus:ring-1 focus:ring-purple-500 text-purple-700 dark:text-purple-300 shadow-sm cursor-pointer">
                                    <option value="">-- Seleccione una opción --</option>
                                    <option value="Contracargo">Contracargo</option>
                                    <option value="Devolución">Devolución</option>
                                    <option value="Mantenimiento">Mantenimiento</option>
                                    <option value="Remisión">Remisión</option>
                                </select>
                            </div>

                            <!-- Identificación (Se autocompleta con Ventas) -->
                            <div class="grid grid-cols-3 gap-4">
                                <div class="col-span-1">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Afiliado</label>
                                    <input type="text" id="fm-afil" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none">
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">N° Liquidación</label>
                                    <input type="text" id="fm-liq" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none font-mono">
                                </div>
                                <div class="col-span-1">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Comercial</label>
                                    <input type="text" id="fm-comercio" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none">
                                </div>
                            </div>

                            <!-- Operación -->
                            <div class="grid grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Transac.</label><input type="date" id="fm-ftrans" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none"></div>
                                <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Pago</label><input type="date" id="fm-fpago" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none"></div>
                                <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">N° Tarjeta</label><input type="text" id="fm-tarjeta" placeholder="****1234" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none font-mono"></div>
                                <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Autorización</label><input type="text" id="fm-auth" placeholder="000000" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none font-mono"></div>
                            </div>

                            <!-- CALCULADORA INVERSA -->
                            <div class="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/30 dark:bg-blue-900/10">
                                <div class="flex items-center gap-4 mb-4">
                                    <div class="w-1/3">
                                        <label class="block text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">Monto Neto Final</label>
                                        <div class="relative">
                                            <span class="absolute left-2 top-1.5 text-slate-400 font-bold">₡</span>
                                            <!-- Este input ahora es la base matemática -->
                                            <input type="number" step="0.01" id="fm-neto" class="w-full p-1.5 pl-6 text-sm font-bold border-2 border-blue-400 rounded bg-white dark:bg-slate-900 text-blue-900 dark:text-white focus:ring-0 outline-none transition-colors" placeholder="0.00">
                                        </div>
                                    </div>
                                    <div class="flex-grow text-[9px] text-slate-500 italic mt-3">Ingrese el monto neto que desea justificar. El sistema calculará el Monto Venta sumando las comisiones y retenciones inferiores.</div>
                                </div>

                                <div class="grid grid-cols-4 gap-3">
                                    <div><label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Comisión (1.95%)</label><input type="number" id="fm-com" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 outline-none font-mono" placeholder="0.00"></div>
                                    <div><label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ret. Ventas (5.31%)</label><input type="number" id="fm-retv" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 outline-none font-mono" placeholder="0.00"></div>
                                    <div><label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ret. Rentas (1.76%)</label><input type="number" id="fm-retr" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 text-orange-600 dark:text-orange-400 outline-none font-mono" placeholder="0.00"></div>
                                    
                                    <!-- ACI con Checkbox Integrado -->
                                    <div>
                                        <label class="flex items-center gap-1 text-[9px] font-bold text-slate-500 uppercase mb-1 cursor-pointer">
                                            <input type="checkbox" id="fm-aci-check" class="accent-blue-600"> ACI (0.42%)
                                        </label>
                                        <input type="number" id="fm-aci" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 outline-none font-mono" placeholder="0.00">
                                    </div>
                                </div>
                            </div>

                            <!-- TOTALIZADOR VENTA -->
                            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex justify-between items-center shadow-inner">
                                <span id="fm-dynamic-title" class="text-sm font-bold text-green-800 dark:text-green-400 uppercase">Monto Final Ajuste</span>
                                <span id="fm-venta-display" class="text-2xl font-mono font-bold text-green-700 dark:text-green-300">₡0.00</span>
                            </div>

                            <!-- Auditoría (Justificación y Captura) -->
                            <div class="grid grid-cols-2 gap-4">
                                <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Justificación</label><textarea id="fm-reason" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:text-white outline-none h-20 resize-none" placeholder="Motivo..."></textarea></div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Evidencia Visual</label>
                                    <div id="fm-evidence-zone" class="w-full h-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-slate-400 focus:outline-none focus:border-blue-500 focus:text-blue-500 transition-colors relative overflow-hidden" tabindex="0">
                                        <div id="fm-ev-text" class="text-[10px] text-center pointer-events-none"><span class="block text-lg mb-1">📋</span>Haz clic y presiona <br> <kbd class="font-sans font-bold bg-white dark:bg-slate-800 px-1 rounded">Ctrl</kbd> + <kbd class="font-sans font-bold bg-white dark:bg-slate-800 px-1 rounded">V</kbd></div>
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
                    
                    <!-- Pestaña de Ventana Minimizada (Estilo Taskbar) -->
                    <div id="btn-restore-ghost" class="fixed bottom-4 right-4 z-[200] hidden">
                        <button onclick="window.toggleGhostMode()" title="Restaurar Formulario" class="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white border border-slate-600 shadow-lg px-4 py-2 rounded-md hover:bg-slate-700 dark:hover:bg-slate-600 transition-all font-bold text-xs pointer-events-auto">
                            <span class="text-blue-400">➕</span> Ingresar Ajuste
                            <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                        </button>
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
                    window.deleteAdj = function(uid) {
                        if(!confirm("¿Eliminar este ajuste manual insertado?")) return;
                        gVentas.updateData(gVentas.displayData.filter(r => r._uid !== uid));
                        updateCalc();
                        hideGlobalTooltip(); 
                    };

                     // --- CONSTRUCCIÓN DE COLUMNAS INTELIGENTE ---
                    let idxComercio = Object.keys(headersDet).find(k => headersDet[k] && (headersDet[k].toLowerCase().includes('comercio') || headersDet[k].toLowerCase().includes('fantasia'))) || "3";
                    let idxAuth = Object.keys(headersDet).find(k => headersDet[k] && headersDet[k].toLowerCase().includes('autori')) || "11";

                    const colsVentas = [];
                    if(!isReadOnly) colsVentas.push({ title: "Sel", field: "_selected", formatter: "checkbox", hozAlign: "center", width: 40 });
                    
                    colsVentas.push(
                        { title: "Fecha", field: "_fecha", width: 80, cssClass: "text-[10px] text-slate-500", formatter: (cell) => window.opener.ConciliacionLogic.formatDateCR(cell.getValue()) },
                        { title: "Comercio", field: idxComercio, headerFilter: true, width: 140, cssClass: "text-[10px] truncate" },
                        { title: "Liquidación", field: "_liq", headerFilter: true, width: 90, cssClass: "font-mono text-blue-700 font-bold text-[10px]" },
                        { title: "Autorización", field: idxAuth, headerFilter: true, width: 90, cssClass: "font-mono text-[10px]" },
                        { title: "Monto Venta", field: "_venta", formatter: "money", hozAlign: "right", cssClass: "text-slate-500 font-mono" },
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

                        // --- Actualiza la Calculadora de Selección Inferior ---
                        const diff = sumB - sumV;
                        currentFooterDiff = diff; 
                        
                        document.getElementById('sum-ventas').innerText = fmt(sumV);
                        document.getElementById('sum-banco').innerText = fmt(sumB);
                        const elDiff = document.getElementById('sum-diff');
                        elDiff.innerText = fmt(diff);
                        
                        // --- SINCRONIZACIÓN DINÁMICA CON EL MODAL ---
                        const modalAdj = document.getElementById('modal-adj');
                        if (modalAdj && !modalAdj.classList.contains('hidden')) {
                            const elNeto = document.getElementById('fm-neto');
                            if (currentFooterDiff !== 0) {
                                elNeto.value = currentFooterDiff.toFixed(2); 
                            } else {
                                elNeto.value = '';
                            }
                            // Recalcular todo el formulario automáticamente
                            if (typeof window.calcFinanzas === 'function') {
                                window.calcFinanzas();
                            }
                        }

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
                    let currentGlobalDiff = ${diffVal}; 
                    // Variables para exponer la selección actual del footer matemáticamente perfecta
                    let currentFooterDiff = 0; 

                    // 2. Inicialización
                    window.onload = function() {
                        const opts = { onCheckboxChange: () => updateCalc() };
                        
                        // Opciones especiales para el Banco (Con Smart Check)
                        const optsBanco = { 
                            onCheckboxChange: (row, field, isChecked) => {
                                // Si se marcó un check y tiene un número de liquidación válido
                                if (isChecked && row._liqRef && row._liqRef.trim() !== '') {
                                    const targetLiq = row._liqRef.trim();
                                    let changed = false;
                                    
                                    // Buscar en Ventas y marcar los que coincidan
                                    gVentas.displayData.forEach(vRow => {
                                        if (vRow._liq && vRow._liq.trim() === targetLiq && !vRow._selected) {
                                            vRow._selected = true;
                                            changed = true;
                                        }
                                    });
                                    
                                    // Si marcamos algo en Ventas, repintamos la tabla izquierda para que se vea el check puesto
                                    if (changed) {
                                        gVentas.render();
                                    }
                                }
                                updateCalc();
                            } 
                        };

                        gVentas = new VanillaGrid("#grid-ventas", rawVentas, colsVentas, opts); 
                        gBanco = new VanillaGrid("#grid-banco", rawBanco, colsBanco, optsBanco);     
                        
                        document.addEventListener('change', (e) => {
                            if(e.target.type === 'checkbox') setTimeout(updateCalc, 50);
                        });

                        // --- 3. Lógica Formulario Avanzado (Calculadora Inversa) ---
                        const elNeto = document.getElementById('fm-neto');
                        const elCom = document.getElementById('fm-com');
                        const elRetV = document.getElementById('fm-retv');
                        const elRetR = document.getElementById('fm-retr');
                        const elAci = document.getElementById('fm-aci');
                        const chkAci = document.getElementById('fm-aci-check');
                        const elVentaDisp = document.getElementById('fm-venta-display');
                        const elType = document.getElementById('fm-type');
                        const elDynamicTitle = document.getElementById('fm-dynamic-title');

                        // Cambiar título dinámico y Lógica de Mantenimiento
                        elType.addEventListener('change', (e) => {
                            const val = e.target.value;
                            elDynamicTitle.innerText = val ? 'Monto Final ' + val : "Monto Final Ajuste";
                            
                            // Bloquear comisiones si es Mantenimiento
                            const isMantenimiento = val === 'Mantenimiento';
                            [elCom, elRetV, elRetR, elAci].forEach(input => {
                                input.readOnly = isMantenimiento;
                                if (isMantenimiento) {
                                    input.classList.add('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed', 'opacity-70');
                                } else {
                                    input.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed', 'opacity-70');
                                }
                            });
                            
                            // Forzar recálculo tras el cambio de modo
                            window.calcFinanzas();
                        });

                        window.calcFinanzas = (e) => {
                            let neto = parseFloat(elNeto.value) || 0;
                            let isAci = chkAci.checked;
                            let isMantenimiento = elType.value === 'Mantenimiento';

                            // Si el usuario cambia el Neto o el Checkbox ACI, recalculamos
                            if (!e || e.target === elNeto || e.target === chkAci || e.target === elType) {
                                
                                if (isMantenimiento) {
                                    // En mantenimiento, el Monto de Venta es exactamente igual al Neto (0% comisiones)
                                    elCom.value = '0.00';
                                    elRetV.value = '0.00';
                                    elRetR.value = '0.00';
                                    elAci.value = '0.00';
                                } else {
                                    // Ingeniería Inversa Normal: Venta = Neto / (1 - Porcentajes)
                                    let factorRetenciones = 0.0195 + 0.0531 + 0.0176 + (isAci ? 0.0042 : 0);
                                    let ventaOriginal = neto / (1 - factorRetenciones);

                                    elCom.value = (ventaOriginal * 0.0195).toFixed(2);
                                    elRetV.value = (ventaOriginal * 0.0531).toFixed(2);
                                    elRetR.value = (ventaOriginal * 0.0176).toFixed(2);
                                    elAci.value = isAci ? (ventaOriginal * 0.0042).toFixed(2) : '0.00';
                                }
                            }

                            // Calcular Venta sumando todo (por si el usuario editó las comisiones a mano)
                            let com = parseFloat(elCom.value) || 0;
                            let retv = parseFloat(elRetV.value) || 0;
                            let retr = parseFloat(elRetR.value) || 0;
                            let aci = parseFloat(elAci.value) || 0;

                            let ventaFinal = neto + com + retv + retr + aci;
                            elVentaDisp.innerText = fmt(ventaFinal);

                            return { neto: neto, com, rv: retv, rr: retr, aci, venta: ventaFinal };
                        };

                        [elNeto, elCom, elRetV, elRetR, elAci, chkAci].forEach(el => el.addEventListener('input', window.calcFinanzas));
                        chkAci.addEventListener('change', window.calcFinanzas);

                        // --- 4. RESTAURADO Y MEJORADO: Eventos de Pegar Imagen (Ctrl+V Global) ---
                        const evZone = document.getElementById('fm-evidence-zone');
                        const evPreview = document.getElementById('fm-ev-preview');
                        const evB64 = document.getElementById('fm-evidence-b64');
                        const evText = document.getElementById('fm-ev-text');
                        const evClear = document.getElementById('fm-ev-clear');

                        window.addEventListener('paste', (e) => {
                            // Solo actuar si el Modal de Ajustes está abierto y NO está minimizado
                            const modal = document.getElementById('modal-adj');
                            if (!modal || modal.classList.contains('hidden') || modal.classList.contains('pointer-events-none')) return;

                            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                            let imageFound = false;

                            for (let index in items) {
                                const item = items[index];
                                if (item.kind === 'file' && item.type.startsWith('image/')) {
                                    imageFound = true;
                                    const blob = item.getAsFile();
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        // Efecto visual flash de éxito
                                        evZone.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
                                        setTimeout(() => evZone.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'), 500);

                                        evPreview.src = event.target.result;
                                        evPreview.classList.remove('hidden');
                                        evB64.value = event.target.result;
                                        evText.classList.add('hidden');
                                        evClear.classList.remove('hidden');
                                    };
                                    reader.readAsDataURL(blob);
                                    break; // Tomar la primera imagen
                                }
                            }
                            if (imageFound) e.preventDefault();
                        });

                        evClear.onclick = (e) => {
                            if(e) e.stopPropagation(); 
                            evPreview.src = '';
                            evPreview.classList.add('hidden');
                            evB64.value = '';
                            evText.classList.remove('hidden');
                            evClear.classList.add('hidden');
                        };
                        // ------------------------------------------------------------------------

                        // 5. Abrir Modal y Autocompletar
                        document.getElementById('btn-add-adj').onclick = function() {
                            // Filtrar las filas seleccionadas ignorando los ajustes manuales previos
                            const seleccionados = gVentas.displayData.filter(r => r._selected && !r._isAdjustment);
                            let filaBase = null;

                            if (seleccionados.length > 0) {
                                // Tomar el último seleccionado válido como referencia
                                filaBase = seleccionados[seleccionados.length - 1];
                            }

                            // Autocompletar con la fila base
                            document.getElementById('fm-afil').value = filaBase ? (filaBase._id || '') : '';
                            document.getElementById('fm-liq').value = filaBase ? (filaBase._liq || '') : '';
                            
                            // Buscar "Comercio" en el mapeo inteligente
                            let comercioStr = '';
                            if (filaBase) {
                                let idxComercio = Object.keys(headersDet).find(k => headersDet[k] && headersDet[k].toLowerCase().includes('comercio'));
                                comercioStr = idxComercio ? filaBase[idxComercio] : (filaBase["3"] || '');
                                if (String(comercioStr).includes('/')) comercioStr = ''; // Evitar fechas accidentales
                            }
                            document.getElementById('fm-comercio').value = comercioStr;
                            
                            const today = new Date().toISOString().split('T')[0];
                            document.getElementById('fm-ftrans').value = today;
                            document.getElementById('fm-fpago').value = today;

                            // Leer Diferencia matemática pura de la variable global (Evita bug de comas/puntos)
                            if (currentFooterDiff !== 0) {
                                elNeto.value = currentFooterDiff.toFixed(2); 
                            } else {
                                elNeto.value = '';
                            }
                            
                            // Reseteo visual
                            elType.value = '';
                            elDynamicTitle.innerText = "Monto Final Ajuste";
                            chkAci.checked = false;
                            window.calcFinanzas();

                            document.getElementById('modal-adj').classList.remove('hidden');
                        };

                        // 6. Guardar Ajuste / Crear Fila
                        document.getElementById('btn-save-adj').onclick = function() {
                            const type = elType.value;
                            const reason = document.getElementById('fm-reason').value;
                            const ftrans = document.getElementById('fm-ftrans').value;
                            
                            if(!type) return alert("Debe seleccionar un Tipo de Ajuste.");
                            if(!ftrans) return alert("La Fecha de Transacción es obligatoria.");
                            
                            const res = window.calcFinanzas();
                            if(res.venta === 0 && res.neto === 0) return alert("Debe ingresar un Monto Neto válido.");

                            // Obtener el índice real de Comercio para guardarlo donde VanillaGrid lo busca
                            let idxComercio = Object.keys(headersDet).find(k => headersDet[k] && (headersDet[k].toLowerCase().includes('comercio') || headersDet[k].toLowerCase().includes('fantasia'))) || "3";
                            let idxAuth = Object.keys(headersDet).find(k => headersDet[k] && headersDet[k].toLowerCase().includes('autori')) || "11";

                            const newRow = {
                                _uid: 'man_' + Date.now(),
                                _isAdjustment: true,
                                _selected: true,
                                _sourceFile: 'Registro Manual',
                                _adjType: type,
                                _adjReason: reason,
                                _adjEvidence: evB64.value, 
                                _fecha: ftrans,
                                _fechaPago: document.getElementById('fm-fpago').value,
                                _tarjeta: document.getElementById('fm-tarjeta').value,
                                _auth: document.getElementById('fm-auth').value,
                                
                                // Variables BAC Nativas (Van directo a Ventas)
                                _id: document.getElementById('fm-afil').value,
                                _liq: document.getElementById('fm-liq').value,
                                [idxComercio]: document.getElementById('fm-comercio').value,
                                [idxAuth]: document.getElementById('fm-auth').value,
                                _venta: res.venta,
                                _comision: res.com,
                                _retV: res.rv,
                                _retR: res.rr,
                                _aciOrig: res.aci, 
                                _neto: res.neto, 
                                _netoACI: res.neto
                            };

                            // Inyección Directa y Única a Ventas
                            const newData = [...gVentas.displayData, newRow];
                            gVentas.updateData(newData);
                            
                            document.getElementById('modal-adj').classList.add('hidden');
                            [elNeto, elCom, elRetV, elRetR, elAci, document.getElementById('fm-tarjeta'), document.getElementById('fm-auth'), document.getElementById('fm-reason')].forEach(e => e.value = '');
                            evClear.onclick(new Event('click')); 
                            
                            updateCalc();
                        };

                        // 7. Conciliar Manualmente
                        document.getElementById('btn-manual').onclick = async function() {
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
                                    // CAMBIO AL NUEVO PROMPT
                                    const userReason = await SysUI.prompt("Ingrese una justificación para forzar esta conciliación:", "Justificación Requerida", "Ajuste manual");
                                    if(!userReason) return;
                                    finalReason = userReason;
                                }

                                if(adjustments.length > 0) window.opener.ConciliacionLogic.injectAdjustments(adjustments);
                                window.opener.ConciliacionLogic.applyManualMatch(selection, finalReason);
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

                    // Al entrar en el área del tooltip (incluso en su padding invisible)
                    tt.addEventListener('mouseenter', () => {
                        if (hideTimeout) {
                            clearTimeout(hideTimeout);
                            hideTimeout = null;
                        }
                        // Asegurar que se vea
                        tt.classList.remove('opacity-0', 'hidden');
                    });

                    // Al salir del área del tooltip, destruir sin contemplación
                    tt.addEventListener('mouseleave', (e) => {
                        window.hideGlobalTooltip(true);
                    });

                    window.showGlobalTooltip = function(el, htmlB64) {
                        // Limpiar cualquier intento de cierre previo
                        if (hideTimeout) {
                            clearTimeout(hideTimeout);
                            hideTimeout = null;
                        }
                        
                        tt.innerHTML = decodeURIComponent(escape(atob(htmlB64)));
                        
                        // Habilitar interacción para el scroll y mostrar
                        tt.classList.remove('pointer-events-none', 'hidden');
                        tt.classList.add('pointer-events-auto');
                        
                        // Calcular posición
                        const rect = el.getBoundingClientRect();
                        // Reducimos la brecha a 0 para que el mouse no "toque fondo" en el trayecto
                        let top = rect.bottom; 
                        let left = rect.left;
                        
                        if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
                        if (top + 250 > window.innerHeight) top = rect.top - tt.offsetHeight;
                        
                        tt.style.top = top + 'px';
                        tt.style.left = left + 'px';
                        
                        // Pequeño hack: Agregar un "padding top" invisible temporal para crear un puente 
                        // físico por donde el mouse pueda viajar sin disparar mouseleave en el intermedio.
                        tt.style.paddingTop = '10px';
                        tt.style.marginTop = '-10px';
                        
                        setTimeout(() => tt.classList.remove('opacity-0'), 10);
                    };
                    
                    window.hideGlobalTooltip = function(force = false) {
                        // Le damos más tiempo (400ms) para que el usuario mueva el ratón desde la i hasta el cuadro.
                        const delay = force ? 10 : 400; 
                        
                        if (hideTimeout) clearTimeout(hideTimeout);
                        
                        hideTimeout = setTimeout(() => {
                            tt.classList.add('opacity-0');
                            tt.classList.remove('pointer-events-auto');
                            tt.classList.add('pointer-events-none');
                            
                            setTimeout(() => {
                                // Doble chequeo final
                                if(tt.classList.contains('opacity-0')) {
                                    tt.classList.add('hidden');
                                    tt.innerHTML = ''; // Limpiar RAM y dom
                                }
                            }, 200);
                        }, delay);
                    };

                    // Lógica para el Modo Fantasma del Formulario (Estilo Ventana Minimizada)
                    window.toggleGhostMode = function() {
                        const modal = document.getElementById('modal-adj');
                        const card = document.getElementById('form-card'); // Ahora es 100% seguro
                        const btnRestore = document.getElementById('btn-restore-ghost');

                        if (modal.classList.contains('pointer-events-none')) {
                            // Restaurar
                            modal.classList.remove('pointer-events-none');
                            
                            // Fondo negro suave con blur
                            modal.classList.remove('bg-transparent');
                            modal.classList.add('bg-black/60', 'backdrop-blur-sm');
                            
                            // Subir tarjeta
                            card.classList.remove('opacity-0', 'translate-y-40', 'scale-95', 'pointer-events-none');
                            card.classList.add('opacity-100', 'translate-y-0', 'scale-100');
                            
                            btnRestore.classList.add('hidden');
                        } else {
                            // Minimizar
                            modal.classList.add('pointer-events-none'); // Permitir clics a las tablas
                            
                            // Fondo 100% transparente sin blur
                            modal.classList.add('bg-transparent');
                            modal.classList.remove('bg-black/60', 'backdrop-blur-sm');
                            
                            // Bajar y ocultar tarjeta (Efecto "Hundirse")
                            card.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
                            card.classList.add('opacity-0', 'translate-y-40', 'scale-95', 'pointer-events-none');
                            
                            // Mostrar barra de tareas
                            btnRestore.classList.remove('hidden');
                        }
                    };
                </script>
            </body>
            </html>
        `);
        win.document.close();
    },

};