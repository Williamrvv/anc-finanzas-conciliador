window.BACLogic = {
    // Procesa el CSV de Detalle (BAC)
    processCSV: function(text, filename) {
        // 0. VALIDACIÓN DE DUPLICADOS (Seguridad)
        this.data.files = this.data.files || {};
        this.data.files.bac_detalle = this.data.files.bac_detalle || [];
        this.data.files.bac_pagado = this.data.files.bac_pagado || [];
        
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
            
            // RESTAURAR ESTADO VISUAL SI YA HABÍA ARCHIVOS
            this.updateFileList('bac_detalle'); 
            return; // Salir sin tocar nada más
        }
        this.data.headers = this.data.headers || {};
        this.data.headers.detalle = headerRow;

        const idxNeto = headerRow.findIndex(h => /Neto/i.test(h)); 
        const idxACI = headerRow.findIndex(h => /Ajuste.*Comisi/i.test(h)); 
        const idxLiq = headerRow.findIndex(h => /Liquidaci/i.test(h));
        console.log("DEBUG LIQ INDEX:", idxLiq);

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

            let valLiq = '';
            if (idxLiq !== -1 && row[idxLiq]) {
                // Limpiar comillas y espacios
                valLiq = String(row[idxLiq]).replace(/["']/g, '').trim();
            }

            return {
                _uid: 'det_' + Math.random().toString(36).substr(2, 9),
                _raw: row, 
                _id: row[0],
                _liq: valLiq,
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
        
        this.data.files = this.data.files || {};
        this.data.files.bac_detalle = this.data.files.bac_detalle || [];
        this.data.files.bac_pagado = this.data.files.bac_pagado || [];
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
        this.data.files = this.data.files || {};
        this.data.files.bac_detalle = this.data.files.bac_detalle || [];
        this.data.files.bac_pagado = this.data.files.bac_pagado || [];
        
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
            
            // RESTAURAR ESTADO VISUAL
            this.updateFileList('bac_pagado');
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

            const desc = String(row[iDesc] || '').trim(); // Aseguramos trim aquí
            
            // 1. Extraer ID del Afiliado (Primera palabra de la descripción)
            const parts = desc.split(' ');
            const extractedID = parts.length > 0 ? parts[0] : "SIN_ID";

            // 2. Extraer Referencia LIQ
            const liqMatch = desc.match(/LIQ\s*(\d+)/i);
            const liqRef = liqMatch ? liqMatch[1] : "";
            
            const isAFI = desc.toUpperCase().startsWith('AFI');

            const rowObj = {
                _uid: 'pag_' + Math.random().toString(36).substr(2, 9),
                _desc: desc,
                _extractedId: extractedID, // <--- Ahora sí está definida
                _liqRef: liqRef, 
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

        this.data.files = this.data.files || {};
        this.data.files.bac_detalle = this.data.files.bac_detalle || [];
        this.data.files.bac_pagado = this.data.files.bac_pagado || [];
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
            // Calculamos totales del grupo
            const sumDet = group.rows.filter(r => r._type === 'Venta').reduce((s, r) => s + (r._netoACI || r._neto || 0), 0);
            const sumPag = group.rows.filter(r => r._type === 'Banco').reduce((s, r) => s + (r._monto || 0), 0);
            
            gridData.push({
                uuid: group.id,
                id: group.rows[0]?._id || group.rows[0]?._extractedId || "MANUAL",
                count: group.rows.length,
                neto: sumDet,
                pagado: sumPag,
                diff: sumDet - sumPag,
                rowsDet: group.rows.filter(r => r._type === 'Venta'),
                rowsPag: group.rows.filter(r => r._type === 'Banco'),
                _isManual: true, // Flag importante
                _manualReason: group.reason
            });
        });

        allIds.forEach(id => {
            const dObj = det[id] || { count:0, sumNeto:0, rows:[] };
            const pObj = pag[id] || { sum:0, rows:[] };
            
            const diff = dObj.sumNeto - pObj.sum;
            const isMatch = Math.abs(diff) < 1 && dObj.sumNeto > 0 && pObj.sum > 0;

            if (isMatch) {
                // CASO A: Conciliación Perfecta por Afiliado
                gridData.push({
                    uuid: `${timeKey}-${id}`,
                    id: id,
                    count: dObj.count,
                    neto: dObj.sumNeto,
                    pagado: pObj.sum,
                    diff: diff,
                    rowsDet: dObj.rows,
                    rowsPag: pObj.rows
                });
            } else {
                // CASO B: No cuadra -> Intentar "Rescate por Liquidación"
                const rescueResult = this.tryMatchByLiquidation(dObj.rows, pObj.rows, id, timeKey);
                
                // 1. Agregar los rescatados a la tabla verde
                if (rescueResult.matched.length > 0) {
                    gridData.push(...rescueResult.matched);
                }

                // 2. Agregar los sobrantes reales a excepciones
                // Solo si queda algo pendiente (si no hay nada, es que se concilió todo por partes)
                if (rescueResult.residue.rowsDet.length > 0 || rescueResult.residue.rowsPag.length > 0) {
                    // Recalcular montos del residuo
                    const resDetSum = rescueResult.residue.rowsDet.reduce((s,r) => s + r._netoACI, 0);
                    const resPagSum = rescueResult.residue.rowsPag.reduce((s,r) => s + r._monto, 0);
                    
                    exceptions.push({
                        uuid: `${timeKey}-${id}-ERR`,
                        id: id,
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

        // 4. ACTUALIZAR TABLA PRINCIPAL (Nombres Corregidos)
        const columns = [
            { title: "ID Ref", field: "uuid", width: 140, headerFilter: true, visible: false }, 
            { 
                title: "Afiliado / LIQ", field: "id", width: 140, 
                formatter: (cell) => {
                    const r = cell.getRow(); 
                    let content = `<span class="font-bold">${r.id}</span>`;
                    
                    // A. Marca de Conciliación Manual (Grupo)
                    if(r._isManual) {
                        content += `<span class="ml-2 text-purple-600" title="${r._manualReason}">🤝</span>`;
                    }

                    // B. Marca de Ajuste Específico (Fila Ficticia)
                    // Buscamos si alguna fila interna es ajuste
                    const hasAdj = r.rowsDet && r.rowsDet.some(d => d._isAdjustment);
                    if(hasAdj) {
                        content += `<span class="ml-1 text-yellow-600" title="Contiene Ajuste Manual (Contracargo/Devolución)">🛠️</span>`;
                    }

                    return content;
                }
            }, 
            { title: "Trans.", field: "count", hozAlign: "center", bottomCalc: "sum" },
            // CAMBIO DE NOMBRE
            { title: "Detallado (esperado)", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            // CAMBIO DE NOMBRE
            { title: "Pagado (recibido)", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diff", hozAlign: "right", formatter: "money", bottomCalc: "sum" }
        ];

        const thresholdInput = document.getElementById('threshold-bac');
        const currentThreshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

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
                    id: `${afiId} - LIQ ${liq}`, // ID visual compuesto
                    count: detGroup.rows.length,
                    neto: detGroup.sum,
                    pagado: matchPagSum,
                    diff: diff,
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

        // Columnas específicas para Auditoría (Agregamos "Estado")
        const columns = [
            { title: "ID Ref", field: "uuid", visible: false },
            { title: "Afiliado", field: "id", width: 100, headerFilter: true },
            { 
                title: "Diagnóstico", field: "diff", width: 180, 
                formatter: (cell) => {
                    const row = cell.getRow(); // Acceso al objeto de datos
                    const neto = row.neto;
                    const pag = row.pagado;
                    
                    if(neto > 0 && pag === 0) return `<span class="text-orange-600 font-bold flex items-center gap-1">⚠ Falta Depósito</span>`;
                    if(neto === 0 && pag > 0) return `<span class="text-blue-600 font-bold flex items-center gap-1">ℹ Sobrante Banco</span>`;
                    return `<span class="text-red-600 font-bold flex items-center gap-1">❌ Diferencia Monto</span>`;
                }
            },
            { title: "EsDetallado (esperado)", field: "neto", hozAlign: "right", formatter: "money" },
            { title: "Pagado (recibido)", field: "pagado", hozAlign: "right", formatter: "money" },
            { title: "Diferencia", field: "diff", hozAlign: "right", formatter: "money", cssClass: "font-bold text-red-600 bg-red-50 dark:bg-red-900/10" }
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

        // 4. Recalcular Todo
        this.recalculateDetalle();
        this.runMatch();
        this.renderManualMatchesTable(); // Nueva tabla visual
        
        alert("✅ Conciliación manual aplicada correctamente.");
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
        if(!confirm("¿Deshacer esta conciliación manual y devolver los registros al flujo?")) return;

        // 1. Reactivar filas originales
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
        console.log("Inyectando Ajustes:", newRows);
        // Concatenar y guardar
        this.data.detalle = (this.data.detalle || []).concat(newRows);
        // Importante: No llama a runMatch aquí porque applyManualMatch lo hará inmediatamente después
    },

};