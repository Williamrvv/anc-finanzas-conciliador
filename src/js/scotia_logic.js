window.ScotiaLogic = {
    // Procesa el Excel de Detalle (Scotiabank)
    // Procesa el Excel de Detalle (Scotiabank) - Multibloque LOTE/AJUSTE
    // Procesa el Excel de Detalle (Scotiabank) - Multibloque LOTE/AJUSTE y Multi-Archivo Seguro
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

        // 1. Detectar la Fila de Encabezados de este archivo específico
        let mainHeaderIdx = -1;
        for(let i=0; i<Math.min(rawRows.length, 30); i++) {
            const rowStr = JSON.stringify(rawRows[i] || []).toLowerCase();
            if(rowStr.includes('monto neto') && rowStr.includes('merid')) {
                mainHeaderIdx = i; break;
            }
        }

        if(mainHeaderIdx === -1) {
            alert(`⛔ Error de Formato en ${filename}:\n\nNo se encontraron los encabezados clave (Monto Neto, MerID).`);
            this.updateScotiaFileList('scotia_detalle'); 
            return;
        }

        // 2. NORMALIZACIÓN "MASTER HEADER" (Evita desalineación al subir múltiples archivos)
        const currentHeaders = rawRows[mainHeaderIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        
        this.data.headers = this.data.headers || {};
        // Si no hay master, el primer archivo dicta la estructura
        if (!this.data.headers.scotia_detalle || this.data.headers.scotia_detalle.length === 0) {
            this.data.headers.scotia_detalle = [...currentHeaders]; 
        }
        const masterHeaders = this.data.headers.scotia_detalle;

        // Crear mapa de traducción: índiceDelArchivoActual -> índiceMaestro
        const indexMap = {};
        currentHeaders.forEach((currH, currIdx) => {
            const masterIdx = masterHeaders.findIndex(mh => mh.toLowerCase() === currH.toLowerCase());
            if (masterIdx !== -1) {
                indexMap[currIdx] = masterIdx;
            } else {
                // Si el archivo trae una columna nueva, la añadimos al final del Master
                const newMasterIdx = masterHeaders.length;
                masterHeaders.push(currH);
                indexMap[currIdx] = newMasterIdx;
            }
        });

        // 3. Índices de lectura para ESTE archivo
        const getCurrIdx = (name) => currentHeaders.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        const currCols = {
            merId: getCurrIdx('merid'),
            bruto: getCurrIdx('monto bruto'),
            neto: getCurrIdx('monto neto'),
            com: getCurrIdx('monto comisión'),
            iva: getCurrIdx('retención iva'),
            isr: getCurrIdx('retención isr'),
            fecha: getCurrIdx('fecha'),
            moneda: getCurrIdx('moneda') 
        };
        if(currCols.bruto === -1) currCols.bruto = getCurrIdx('monto orig');
        if(currCols.isr === -1) currCols.isr = getCurrIdx('retención is');

        // Índice para variable global interna
        const masterFechaIdx = masterHeaders.findIndex(h => h && h.toLowerCase().includes('fecha'));

        // 4. Procesar Filas
        const newRows = [];
        let currentMode = 'LOTE'; 
        let multiplicador = 1;

        const parseNum = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace(/\s/g, '').replace(',', '.')) || 0;
            return 0;
        };

        // Comenzamos a leer JUSTO DESPUÉS del encabezado
        for(let i = mainHeaderIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || row.length === 0) continue;

            const rowStr = JSON.stringify(row).toLowerCase();

            // A. Detección de Cambio de Bloque (LOTE vs AJUSTE)
            if(rowStr.includes('agrupado por') && rowStr.includes('transacción')) {
                if(rowStr.includes('ajuste')) {
                    currentMode = 'AJUSTE';
                    multiplicador = -1; // INVERTIR SIGNO
                } else {
                    currentMode = 'LOTE';
                    multiplicador = 1;  // Positivo
                }
                continue; 
            }

            // B. Ignorar filas de subtotales
            if(rowStr.includes('monto neto') || rowStr.includes('subtotales')) continue;

            // --- CORRECCIÓN BUG EXCEL SCOTIABANK (COLUMNA FANTASMA) ---
            let workingRow = [...row];
            if (currCols.moneda !== -1) {
                const valMoneda = String(workingRow[currCols.moneda] || '').toUpperCase();
                const valNext = String(workingRow[currCols.moneda + 1] || '').toUpperCase();
                const isCurrency = (v) => v.includes('COLON') || v.includes('DOLAR') || v.includes('USD') || v.includes('CRC');
                
                if (!isCurrency(valMoneda) && isCurrency(valNext)) {
                    workingRow.splice(1, 1); // Borramos celda fantasma y realineamos
                }
            }

            // C. VALIDACIÓN CRÍTICA: Debe tener MerID
            const rawMerId = workingRow[currCols.merId];
            if(!rawMerId || String(rawMerId).trim() === '') continue;

            // D. Extracción de Datos usando los índices de ESTE archivo
            const vBruto = Math.abs(parseNum(workingRow[currCols.bruto]));
            const vNeto = Math.abs(parseNum(workingRow[currCols.neto]));
            
            const finalNeto = vNeto * multiplicador;
            const finalBruto = vBruto * multiplicador;
            const vCom = Math.abs(parseNum(workingRow[currCols.com])) * multiplicador;
            const vIva = Math.abs(parseNum(workingRow[currCols.iva])) * multiplicador;
            const vIsr = Math.abs(parseNum(workingRow[currCols.isr])) * multiplicador; 

            // E. Mapeo al Master Header
            const mappedData = {};
            currentHeaders.forEach((h, currIdx) => {
                const mIdx = indexMap[currIdx];
                let cellVal = workingRow[currIdx];
                // Limpiar la odiosa comilla simple de Excel
                if (typeof cellVal === 'string' && cellVal.startsWith("'")) cellVal = cellVal.substring(1);
                mappedData[String(mIdx)] = cellVal;
            });

            // Forzar montos negativos en el objeto para la tabla
            if (multiplicador === -1) {
                const mNetoIdx = indexMap[currCols.neto];
                const mBrutoIdx = indexMap[currCols.bruto];
                mappedData[String(mNetoIdx)] = finalNeto;
                mappedData[String(mBrutoIdx)] = finalBruto;
            }

            // F. Construir Objeto Final
            const rowObj = {
                _uid: 'scodet_' + Math.random().toString(36).substr(2, 9), 
                _enabled: true,
                _neto: finalNeto,
                _bruto: finalBruto,
                _comision: vCom,
                _iva: vIva,
                _isr: vIsr,
                _fecha: masterFechaIdx !== -1 ? mappedData[String(masterFechaIdx)] : "",
                _mode: currentMode,
                _sourceFile: filename,
                ...mappedData
            };
            
            newRows.push(rowObj);
        }

        // 5. ACUMULAR DATOS
        this.data.scotia_detalle = (this.data.scotia_detalle || []).concat(newRows);
        
        // 6. REGISTRAR ARCHIVO
        if(filename && !this.data.files.scotia_detalle.includes(filename)) {
            this.data.files.scotia_detalle.push(filename);
        }
        
        // 7. ACTUALIZAR UI
        this.updateScotiaCard();
        this.updateScotiaFileList('scotia_detalle'); 
        
        if(this.switchTab) this.switchTab('scotia');
        this.runMatchScotiabank();

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
        const iFecha = headers.findIndex(h => h && String(h).toLowerCase().includes('fecha'));

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
                const desc = String(row[iDesc] || '').trim();
                
                // REGLA FINANCIERA: Solo procesar transacciones que inicien con PCA
                if (!desc.toUpperCase().startsWith('PCA')) continue;

                const parts = desc.replace(/\s+/g, ' ').split(' ');
                const extractedID = parts.length >= 4 ? parts[3] : "SIN_ID";

                const rowObj = {
                    _uid: 'scopag_' + Math.random().toString(36).substr(2, 9),
                    _enabled: true,
                    _monto: m,
                    _extractedId: extractedID, 
                    _fecha: iFecha !== -1 ? row[iFecha] : "",
                    _desc: desc,
                    _sourceFile: filename,
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

        if (!hasDetalle && !hasPagado) {
            const container = document.getElementById('table-result-scotia');
            if(container) {
                if(this.grids && this.grids.scotia) this.grids.scotia = null;
                container.innerHTML = '<div class="text-center text-slate-400 p-10 font-bold">Esperando archivos...</div>';
            }
            return;
        }

        const detGroup = {};
        const pagGroup = {};

        const headersDet = this.data.headers.scotia_detalle || [];
        const iMerID = headersDet.findIndex(h => h && h.toLowerCase().includes('merid'));
        if (iMerID === -1 && hasDetalle) return alert("Error: No se encuentra la columna MerID.");

        // 1. Agrupar Detalle
        this.data.scotia_detalle.forEach(r => {
            if(!r._enabled) return;
            const id = String(r[String(iMerID)] || 'DESCONOCIDO').trim();
            if(!detGroup[id]) detGroup[id] = { count: 0, neto: 0, rows: [] };
            detGroup[id].count++;
            detGroup[id].neto += r._neto; 
            detGroup[id].rows.push(r);
        });

        // 2. Agrupar Pagado
        this.data.scotia_pagado.forEach(r => {
            if(!r._enabled) return;
            const id = String(r._extractedId).trim();
            if(!pagGroup[id]) pagGroup[id] = { sum: 0, rows: [] };
            pagGroup[id].sum += r._monto;
            pagGroup[id].rows.push(r);
        });

        const allIds = new Set([...Object.keys(detGroup), ...Object.keys(pagGroup)]);
        const gridData = [];
        const exceptions = [];
        const timeKey = Date.now();

        // A. Inyectar Conciliaciones Manuales (Ya procesadas)
        this.manualMatchesScotia.forEach(group => {
            const sumDet = group.rows.filter(r => r._type === 'Venta').reduce((s, r) => s + (r._neto || 0), 0);
            const sumPag = group.rows.filter(r => r._type === 'Banco').reduce((s, r) => s + (r._monto || 0), 0);
            
            gridData.push({
                uuid: group.id,
                id: group.rows[0]?._extractedId || group.rows[0]?._id || "MANUAL", 
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

        // 3. Evaluar Resto de datos (Homologado a BAC)
        allIds.forEach(id => {
            if(!id || id === 'SIN_ID' || id === 'undefined') return;
            
            const det = detGroup[id] || { count:0, neto:0, rows: [] };
            const pag = pagGroup[id] || { sum:0, rows: [] };

            // DETECCIÓN DE SALDO ANTERIOR
            const isHistorical = det.rows.some(r => r._isHistorical) || pag.rows.some(r => r._isHistorical);
            const classRow = isHistorical ? "bg-amber-50 dark:bg-amber-900/20 border-l-[4px] border-l-amber-500 font-medium" : "";
            
            const diff = det.neto - pag.sum;
            
            // Comparación financiera estricta (Tolerancia de 1 colón para ajustes de redondeo bancario)
            const isMatch = Math.abs(diff) <= 1.00 && Math.abs(det.neto) > 0;

            const rowData = {
                uuid: `${timeKey}-${id}`,
                id: id,
                count: det.count,
                neto: det.neto,
                pagado: pag.sum,
                diferencia_val: diff, // Columna neutral
                rowsDet: det.rows,
                rowsPag: pag.rows,
                // PROPAGACIÓN DE HISTÓRICOS (Color Ámbar)
                _isHistoricalGroup: isHistorical,
                _rowClass: classRow
            };

            if (isMatch) {
                gridData.push(rowData);
             } else {
                // DOBLE PASADA: Intentar rescatar por monto exacto individual si el total falla
                let unmatchedDet = [];
                let unmatchedPag = [...pag.rows];
                
                det.rows.forEach(dRow => {
                    // Buscar en pagados una transacción con el mismo monto exacto
                    const matchIdx = unmatchedPag.findIndex(p => Math.abs(dRow._neto - p._monto) < 1);
                    
                    if (matchIdx !== -1) {
                        const pRow = unmatchedPag.splice(matchIdx, 1)[0]; // Sacarlo
                        const isResHistorical = dRow._isHistorical || pRow._isHistorical;
                        
                        gridData.push({
                            uuid: `${timeKey}-${id}-resc-${dRow._uid}`,
                            id: `${id} (Rescate)`,
                            count: 1,
                            neto: dRow._neto,
                            pagado: pRow._monto,
                            diferencia_val: dRow._neto - pRow._monto,
                            rowsDet: [dRow],
                            rowsPag: [pRow],
                            _isHistoricalGroup: isResHistorical,
                            _rowClass: isResHistorical ? "bg-amber-50 dark:bg-amber-900/20 border-l-[4px] border-l-amber-500 font-medium" : ""
                        });
                    } else {
                        unmatchedDet.push(dRow);
                    }
                });

                // Si queda algo suelto, va a excepciones
                if (unmatchedDet.length > 0 || unmatchedPag.length > 0) {
                    const resDetSum = unmatchedDet.reduce((s,r) => s + r._neto, 0);
                    const resPagSum = unmatchedPag.reduce((s,r) => s + r._monto, 0);
                    
                    // Extraer fecha para excepciones
                    let f = "N/A";
                    if (unmatchedDet.length > 0 && unmatchedDet[0]._fecha) f = unmatchedDet[0]._fecha;
                    else if (unmatchedPag.length > 0 && unmatchedPag[0]._fecha) f = unmatchedPag[0]._fecha;
                    if (f !== "N/A" && window.ConciliacionLogic) f = window.ConciliacionLogic.formatDateCR(f);
                    
                    exceptions.push({
                        uuid: `${timeKey}-${id}-ERR`,
                        id: id,
                        fecha: f,
                        count: unmatchedDet.length,
                        neto: resDetSum,
                        pagado: resPagSum,
                        diferencia_val: resDetSum - resPagSum,
                        rowsDet: unmatchedDet,
                        rowsPag: unmatchedPag
                    });
                }
            }
        }); 

        // 4. Indexar Memoria para el PopUp
        this.data.processed = this.data.processed || {};
        this.data.processed.scotia_matches = {}; 
        [...gridData, ...exceptions].forEach(item => {
            this.data.processed.scotia_matches[item.id] = item;
            this.data.processed.scotia_matches[item.uuid] = item; 
        });

        // 5. Configurar Columnas
        const columns = [
            { title: "ID Ref", field: "uuid", visible: false },
            { 
                title: "MerID / Comercio", field: "id", headerFilter: true, width: 200, 
                formatter: (cell) => {
                    const r = cell.getRow(); 
                    let content = `<span class="font-bold">${r.id}</span>`;
                    if(r._isManual) {
                        content += `<span class="ml-2 text-purple-600" title="${r._manualReason}">🤝</span>`;
                        // BOTÓN ELIMINAR DIRECTO EN LA TABLA
                        content += `<button onclick="window.ConciliacionLogic.undoManualScotiaMatch('${r._groupID}')" class="ml-2 bg-red-100 hover:bg-red-200 text-red-600 px-1.5 py-0.5 rounded text-[9px] shadow-sm font-bold uppercase transition-colors" title="Eliminar ajuste y restaurar">Deshacer</button>`;
                    }
                    const hasAdj = (r.rowsDet && r.rowsDet.some(d => d._isAdjustment)) || (r.rowsPag && r.rowsPag.some(d => d._isAdjustment));
                    if(hasAdj) content += `<span class="ml-1 text-yellow-600" title="Contiene Fila Ficticia">🛠️</span>`;
                    return content;
                }
            },
            { title: "Trans.", field: "count", hozAlign: "center", bottomCalc: "sum" },
            { title: "Depositado (Banco)", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Neto Esperado (Ventas)", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { 
                title: "Diferencia", field: "diferencia_val", hozAlign: "right", formatter: "money", bottomCalc: "sum",
                cssClass: "text-slate-700 dark:text-slate-300 [&>span]:!text-slate-700 dark:[&>span]:!text-slate-300 [&>span]:!font-normal"
            }
        ];

        const thresholdInput = document.getElementById('threshold-scotia');
        const currentThreshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

        if (this.grids.scotia) {
            this.grids.scotia.updateData(gridData);
        } else {
            this.grids.scotia = new VanillaGrid("#table-result-scotia", gridData, columns, {
                threshold: currentThreshold,
                searchInputId: "search-scotia",
                onRowDblClick: (rowData) => {
                    if (window.ConciliacionLogic && typeof window.ConciliacionLogic.openScotiaTransactionModal === 'function') {
                        window.ConciliacionLogic.openScotiaTransactionModal(rowData);
                    }
                }
            });
        }
        
        // Renderizar Auditoría Homologada
        this.renderScotiaAudit(exceptions);
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

    // Renderiza la tabla de excepciones Scotia (Homologada a BAC)
    renderScotiaAudit: function(exceptions) {
        // En el HTML actual de Scotia, la auditoría está dividida en dos divs viejos.
        // Vamos a inyectar una tabla unificada en el contenedor principal de auditoría.
        const container = document.getElementById('audit-scotia');
        if(!container) return;

        if(exceptions.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');
        
        // Re-estructuramos el contenedor HTML al vuelo para que soporte VanillaGrid igual que el BAC
        if (!document.getElementById('table-exceptions-scotia')) {
            container.className = "flex flex-col gap-2 mt-4"; // Quitar el grid de 2 columnas viejo
            container.innerHTML = `
                <div class="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-t-lg flex justify-between items-center">
                    <h4 class="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        Excepciones y Pendientes (No Conciliado)
                    </h4>
                    <span class="text-[10px] text-orange-600 dark:text-orange-300">Doble clic para analizar</span>
                </div>
                <div id="table-exceptions-scotia" class="h-[300px] border border-orange-200 dark:border-orange-800 rounded-b-lg overflow-hidden shadow-sm"></div>
            `;
        }

        const columns = [
            { title: "Fecha", field: "fecha", width: 90, headerFilter: true, cssClass: "text-slate-500 font-mono text-[10px]" },
            { title: "MerID / Comercio", field: "id", width: 120, headerFilter: true },
            { 
                title: "Diagnóstico", field: "diferencia_val", width: 180, 
                formatter: (cell) => {
                    const row = cell.getRow();
                    if(row.neto > 0 && row.pagado === 0) return `<span class="text-orange-600 font-bold flex items-center gap-1">⚠ Falta Depósito</span>`;
                    if(row.neto === 0 && row.pagado > 0) return `<span class="text-blue-600 font-bold flex items-center gap-1">ℹ Sobrante Banco</span>`;
                    return `<span class="text-red-600 font-bold flex items-center gap-1">❌ Diferencia Monto</span>`;
                }
            },
            { title: "Depositado (Banco)", field: "pagado", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Neto Esperado (Ventas)", field: "neto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diferencia_val", hozAlign: "right", formatter: "money", bottomCalc: "sum", cssClass: "font-bold text-red-600 bg-red-50 dark:bg-red-900/10" }
        ];

        if (this.grids.scotia_audit) {
            this.grids.scotia_audit.updateData(exceptions);
        } else {
            this.grids.scotia_audit = new VanillaGrid("#table-exceptions-scotia", exceptions, columns, {
                threshold: 0,
                onRowDblClick: (rowData) => {
                    if (window.ConciliacionLogic && typeof window.ConciliacionLogic.openScotiaTransactionModal === 'function') {
                        // Rescatamos los datos completos (rowsDet y rowsPag) desde la memoria indexada
                        const fullData = window.ConciliacionLogic.data.processed.scotia_matches[rowData.uuid];
                        window.ConciliacionLogic.openScotiaTransactionModal(fullData || rowData);
                    }
                }
            });
        }
    },

    // --- FASE 3: MUTABILIDAD Y CONCILIACIÓN MANUAL SCOTIABANK ---

    manualMatchesScotia: [], 

    injectScotiaAdjustments: function(newRows) {
        console.log("Inyectando Ajustes a Ventas Scotia:", newRows);
        newRows.forEach(row => {
            this.data.scotia_detalle.push(row);
        });
    },

    applyManualScotiaMatch: function(selection, reason) {
        const groupID = 'sco_man_' + Date.now();
        const matchedRows = [];

        selection.det.forEach(uid => {
            const row = this.data.scotia_detalle.find(r => r._uid === uid);
            if(row) {
                row._enabled = false;
                row._manualMatch = groupID;
                row._manualReason = reason;
                matchedRows.push({...row, _type: 'Venta'});
            }
        });

        selection.pag.forEach(uid => {
            const row = this.data.scotia_pagado.find(r => r._uid === uid);
            if(row) {
                row._enabled = false;
                row._manualMatch = groupID;
                row._manualReason = reason;
                matchedRows.push({...row, _type: 'Banco'});
            }
        });

        this.manualMatchesScotia.push({
            id: groupID,
            reason: reason,
            rows: matchedRows,
            timestamp: new Date()
        });

        // Recalcular Y FORZAR RENDERIZADO DE TABLA
        this.updateScotiaCard();
        this.recalculateScotiaPagado();
        this.runMatchScotiabank();
        
        SysUI.alert(`Conciliación manual de Scotiabank aplicada.\nMotivo: "${reason}"`, "Éxito", "success");
        setTimeout(() => {
            const table = document.getElementById('table-result-scotia');
            if (table) { table.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }, 500);
    },

    undoManualScotiaMatch: function(groupID) {
        if(!confirm("¿Deshacer esta conciliación y restaurar los datos iniciales? Las filas creadas manualmente se eliminarán.")) return;

        // 1. Destruir ajustes ficticios
        this.data.scotia_detalle = this.data.scotia_detalle.filter(r => !(r._manualMatch === groupID && r._isAdjustment));
        this.data.scotia_pagado = this.data.scotia_pagado.filter(r => !(r._manualMatch === groupID && r._isAdjustment));

        // 2. Reactivar filas originales
        this.data.scotia_detalle.forEach(r => { if(r._manualMatch === groupID) { r._enabled = true; delete r._manualMatch; } });
        this.data.scotia_pagado.forEach(r => { if(r._manualMatch === groupID) { r._enabled = true; delete r._manualMatch; } });

        this.manualMatchesScotia = this.manualMatchesScotia.filter(g => g.id !== groupID);

        this.updateScotiaCard();
        this.recalculateScotiaPagado();
        this.renderScotiaManualTable();
    },

    // --- FASE 2: POPUP INTERACTIVO SCOTIABANK ---

    removeFileScotiaDetalle: async function(filename) {
        this.data.scotia_detalle = this.data.scotia_detalle.filter(row => row._sourceFile !== filename);
        this.data.files.scotia_detalle = this.data.files.scotia_detalle.filter(f => f !== filename);

        this.updateScotiaCard();
        this.updateScotiaFileList('scotia_detalle'); 
        this.runMatchScotiabank();
        
        if(this.data.files.scotia_detalle.length === 0) {
            const drop = document.getElementById('drop-scotia-detalle');
            drop.classList.remove('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            drop.classList.add('border-slate-300', 'bg-white', 'dark:bg-slate-800');
            document.getElementById('status-scotia-detalle').innerHTML = '';
            document.getElementById('status-scotia-detalle').classList.add('hidden');
        }
    },

    removeFileScotiaPagado: async function(filename) {
        this.data.scotia_pagado = this.data.scotia_pagado.filter(row => row._sourceFile !== filename);
        this.data.files.scotia_pagado = this.data.files.scotia_pagado.filter(f => f !== filename);

        const total = this.data.scotia_pagado.reduce((acc, r) => acc + (r._enabled ? r._monto : 0), 0);
        document.getElementById('sc-total-pagado').innerText = this.formatMoney(total);

        this.updateScotiaFileList('scotia_pagado');
        this.runMatchScotiabank();

        if(this.data.files.scotia_pagado.length === 0) {
            const drop = document.getElementById('drop-scotia-pagado');
            drop.classList.remove('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
            drop.classList.add('border-slate-300', 'bg-white', 'dark:bg-slate-800');
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

        if(!files || files.length === 0) {
            status.innerHTML = '';
            status.classList.add('hidden');
            return;
        }

        const count = files.length;

        status.innerHTML = `
            <div onclick="event.preventDefault(); event.stopPropagation(); window.ConciliacionLogic.manageFiles('${type}')" 
                 class="font-bold text-[10px] text-slate-700 dark:text-slate-200 cursor-pointer flex items-center justify-center gap-1.5 w-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors py-1 pointer-events-auto">
                <svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span>${count} Archivo${count !== 1 ? 's' : ''}</span>
                <span class="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-1.5 py-0.5 rounded-full text-[8px] uppercase tracking-wider ml-1">Ver</span>
            </div>
        `;
        status.className = "w-full absolute bottom-0 left-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 z-50 transition-all";
    },

    // 1. Prepara y limpia los datos antes de enviarlos a la nueva ventana
    getScotiaPopupData: function(type) {
        const rawData = type === 'scotia_detalle' ? this.data.scotia_detalle : this.data.scotia_pagado;
        if (!rawData) return [];

        return rawData.map(row => {
            const obj = { ...row };
            // Sanitización de celdas según los headers de Scotia
            Object.keys(obj).forEach(key => {
                let val = obj[key];
                
                // Limpiar Fechas (Punto 15)
                if (window.ConciliacionLogic && key === '_fecha' && val) {
                    obj[key] = window.ConciliacionLogic.formatDateCR(val);
                }

                // Asegurar que Neto y Bruto sean numéricos matemáticos reales (Punto 11: Respetar negativos)
                if (key === '_neto' || key === '_bruto' || key === '_monto') {
                    if (typeof val === 'string') {
                        let clean = val.replace(/["'\s₡]/g, '');
                        if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/,/g, '');
                        else if (clean.includes(',')) clean = clean.replace(',', '.');
                        obj[key] = parseFloat(clean) || 0;
                    }
                }
            });
            return obj;
        });
    },

    // 2. Abre la ventana de Análisis 
    openScotiaTransactionModal: function(data) {
        if(!data) return;

        const ventas = data.rowsDet || [];
        const banco = data.rowsPag || [];
        const diff = data.diferencia_val;
        
        const jsonVentas = JSON.stringify(ventas.map(v => ({...v, _selected: false}))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const jsonBanco = JSON.stringify(banco.map(b => ({...b, _selected: false}))).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        
        const headDet = this.data.headers && this.data.headers.scotia_detalle ? this.data.headers.scotia_detalle : [];
        const headPag = this.data.headers && this.data.headers.scotia_pagado ? this.data.headers.scotia_pagado : [];
        const jsonHeadersDet = JSON.stringify(headDet).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const jsonHeadersPag = JSON.stringify(headPag).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        
        const isDark = document.documentElement.classList.contains('dark');
        const w = 1400, h = 850;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        const win = window.open("", "_blank", `width=${w},height=${h},top=${top},left=${left}`);
        
        const isReadOnly = Math.abs(diff) < 1 || data._isManual === true;
        
        if(!win) return alert("Ventana bloqueada.");

        win.document.write(`
            <!DOCTYPE html>
            <html class="${isDark ? 'dark' : ''}">
            <head>
                <title>IRI - Análisis Scotia: ${data.id}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script>
                    tailwind.config = { darkMode: 'class', theme: { extend: { animation: { 'fade-in-up': 'fadeInUp 0.4s ease-out forwards' }, keyframes: { fadeInUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } } } } }
                </script>
                <script src="/js/vanilla_grid.js"></script>
                <style>
                    ::-webkit-scrollbar { width: 10px; height: 10px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 5px; border: 2px solid #f8fafc; }
                    .dark ::-webkit-scrollbar-thumb { background-color: #475569; border-color: #0f172a; }
                </style>
            </head>
            <body class="${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-800'} p-4 flex flex-col h-screen overflow-hidden text-sm animate-fade-in-up select-none">
                
                <div class="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
                    <div>
                        <h1 class="text-xl font-bold flex items-center gap-2">
                            <span>🔎 IRI - Análisis de Ajuste Scotia</span>   
                            <span class="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 text-sm px-2 py-0.5 rounded font-mono">${data.id}</span>
                        </h1>
                    </div>
                     <div class="text-right ${isReadOnly ? 'hidden' : ''}">
                        <span class="text-xs text-slate-400 uppercase font-bold mr-2">Diferencia Total:</span>
                        <span id="header-diff-display" class="text-xl font-mono font-bold ${Math.abs(diff) > 5 ? 'text-red-500' : 'text-green-500'}">
                            ${this.formatMoney(diff)}
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 flex-grow overflow-hidden h-full">
                    <!-- DERECHA: BANCO -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden">
                        <div class="${isDark ? 'bg-green-900/20 text-green-300 border-slate-700' : 'bg-green-50 text-green-700 border-green-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center">
                            <span>Pagado Scotia (Recibido)</span>
                            <span class="bg-white dark:bg-slate-800 px-2 rounded text-[10px] shadow-sm">Total: ₡ <span id="lbl-tot-pag">${data.pagado.toLocaleString('en-US', {minimumFractionDigits:2})}</span></span>
                        </div>
                        <div id="grid-banco" class="flex-grow relative bg-white dark:bg-slate-800"></div>
                    </div>
                    
                     <!-- IZQUIERDA: VENTAS SCOTIA -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden relative">
                        <div class="${isDark ? 'bg-red-900/20 text-red-300 border-slate-700' : 'bg-red-50 text-red-700 border-red-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center">
                            <span>Detalle Scotia (Esperado)</span>
                            <span class="bg-white dark:bg-slate-800 px-2 rounded text-[10px] shadow-sm">Total: ₡ <span id="lbl-tot-det">${data.neto.toLocaleString('en-US', {minimumFractionDigits:2})}</span></span>
                        </div>
                        <div id="grid-ventas" class="flex-grow relative bg-white dark:bg-slate-800"></div>
                    </div>
                </div>

                <div class="p-3 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-300 dark:border-slate-700 mt-4 rounded-lg">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-6 text-sm">
                            ${isReadOnly ? '' : `
                                <button id="btn-add-adj" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow-sm transition-colors">
                                    <span class="text-base leading-none">+</span> Agregar Ajuste
                                </button>
                                <div class="w-px h-8 bg-slate-300 dark:bg-slate-600"></div>
                                
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-slate-500 uppercase font-bold">Sel. Pagado</span>
                                    <span id="sum-banco" class="font-mono font-bold text-green-600 dark:text-green-400">₡0,00</span>
                                </div>
                                <div class="text-slate-400 font-bold">-</div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-slate-500 uppercase font-bold">Sel. Detallado</span>
                                    <span id="sum-ventas" class="font-mono font-bold text-red-600 dark:text-red-400">₡0,00</span>
                                </div>
                                <div class="text-slate-400 font-bold">=</div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] text-slate-500 uppercase">Diferencia</span>
                                    <span id="sum-diff" class="font-mono font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 shadow-inner">₡0,00</span>
                                </div>
                            `}
                        </div>
                        <div class="flex gap-3 items-center">
                            ${isReadOnly ? `
                                <span class="bg-green-100 text-green-800 px-4 py-2 rounded text-sm font-bold border border-green-200 shadow-sm">✅ Transacción Conciliada</span>
                            ` : `
                                <button id="btn-manual" disabled class="bg-purple-100 dark:bg-slate-700 text-purple-400 dark:text-slate-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 cursor-not-allowed transition-colors border border-transparent shadow-sm">
                                    <span>🤝</span> Conciliar Manualmente
                                </button>
                            `}
                            <button onclick="window.close()" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 rounded text-sm font-bold shadow-sm">Cerrar Ventana</button>
                        </div>
                    </div>
                </div>

                <div id="global-float-tooltip" class="fixed hidden bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-3 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-600 z-[99999] transform transition-opacity duration-200 opacity-0"></div>

                <script>
                    const rawVentas = JSON.parse('${jsonVentas}');
                    const rawBanco = JSON.parse('${jsonBanco}');
                    const headersDet = JSON.parse('${jsonHeadersDet}');
                    const headersPag = JSON.parse('${jsonHeadersPag}');
                    const isReadOnly = ${isReadOnly};
                    const diffVal = ${diff};
                    
                    const fmt = (n) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(n);

                    // TOOLTIP INTELIGENTE HOMOLOGADO
                    const generateGenericTooltip = (row, isVenta) => {
                        const headers = isVenta ? headersDet : headersPag;
                        const origen = isVenta ? 'Detalle (Scotiabank)' : 'Pagado (Scotiabank)';
                        let html = \`
                            <div class="text-left min-w-[280px] max-w-[350px] text-[10px] flex flex-col max-h-[50vh]">
                                <div class="border-b border-slate-200 dark:border-slate-600 pb-2 mb-2 font-bold text-slate-800 dark:text-white uppercase flex items-center gap-2 shrink-0">
                                    <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> 
                                    Datos Originales <span class="text-[9px] text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-700 px-1.5 py-0.5 rounded">\${origen}</span>
                                </div>
                                <div class="overflow-y-auto custom-scrollbar pr-2 space-y-1.5 flex-grow">
                        \`;
                        for(let key in row) {
                            if(typeof row[key] === 'object' || key.startsWith('_')) continue;
                            let val = row[key];
                            if(val === null || val === undefined || val === '') continue;
                            
                            let displayKey = !isNaN(key) && headers[key] ? headers[key] : key;
                            const upperKey = displayKey.toUpperCase();

                            if (upperKey.includes('FECHA') && window.opener.ConciliacionLogic) {
                                val = window.opener.ConciliacionLogic.formatDateCR(val);
                            } else if (/NETO|MONTO|BRUTO|COMISI|RETENC/i.test(upperKey)) {
                                let num = parseFloat(String(val).replace(/["'\\s₡,]/g, ''));
                                if (!isNaN(num)) val = \`<span class="\${num < 0 ? 'text-red-500' : 'text-green-600'} font-bold">\${fmt(num)}</span>\`;
                            }

                            html += \`<div class="flex flex-col border-b border-slate-100 dark:border-slate-700/50 pb-1">
                                <span class="text-slate-400 dark:text-slate-500 font-bold uppercase text-[8px]">\${displayKey}</span> 
                                <span class="text-slate-800 dark:text-slate-200 font-mono break-words whitespace-normal">\${val}</span>
                            </div>\`;
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
                    
                    // Inyectar HTML del Modal al DOM
                    document.body.insertAdjacentHTML('beforeend', \`
                        <div id="modal-adj" class="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] hidden flex items-center justify-center overflow-y-auto p-4 transition-all duration-300">
                            <!-- Tarjeta Principal -->
                            <div id="form-card" class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[95vh] transition-all duration-300 origin-bottom scale-100 opacity-100 translate-y-0">
                                
                                <!-- Header Modal -->
                                <div class="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center shrink-0">
                                    <div><h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2"><span class="text-red-600">➕</span> Ingresar Ajuste Scotia</h3></div>
                                    <div class="flex items-center gap-2">
                                        <button onclick="window.toggleGhostMode()" title="Minimizar" class="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors w-8 h-8"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path d="M20 12H4"></path></svg></button>
                                        <button onclick="document.getElementById('modal-adj').classList.add('hidden')" title="Cerrar" class="text-slate-400 hover:text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors w-8 h-8"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                    </div>
                                </div>
                                
                                <!-- Body Modal -->
                                <div class="p-6 overflow-y-auto flex-grow custom-scrollbar space-y-4">
                                    
                                    <!-- Tipo de Ajuste -->
                                    <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800">
                                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Ajuste</label>
                                        <select id="fm-type" class="w-full p-2 text-xs font-bold border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-red-700 dark:text-red-300 shadow-sm outline-none cursor-pointer">
                                            <option value="">-- Seleccione --</option>
                                            <option value="Contracargo">Contracargo</option>
                                            <option value="Devolución">Devolución</option>
                                            <option value="Mantenimiento">Mantenimiento</option>
                                            <option value="Remisión">Remisión</option>
                                        </select>
                                    </div>

                                    <!-- Identificación -->
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="col-span-1"><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">MerID (Afiliado)</label><input type="text" id="fm-afil" placeholder="MerID" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none"></div>
                                        <div class="col-span-1"><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Comercio</label><input type="text" id="fm-comercio" placeholder="Comercio" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none"></div>
                                    </div>

                                    <!-- Operación -->
                                    <div class="grid grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Transac.</label><input type="date" id="fm-ftrans" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none"></div>
                                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha Pago</label><input type="date" id="fm-fpago" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none"></div>
                                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">N° Tarjeta</label><input type="text" id="fm-tarjeta" placeholder="****1234" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none font-mono"></div>
                                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Autorización</label><input type="text" id="fm-auth" placeholder="000000" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none font-mono"></div>
                                    </div>
                                    
                                    <!-- Calculadora Inversa Scotia -->
                                    <div class="border border-red-200 dark:border-red-800 rounded-lg p-3 bg-red-50/30 dark:bg-red-900/10">
                                        <div class="flex items-center gap-4 mb-4">
                                            <div class="w-1/3">
                                                <label class="block text-[10px] font-bold text-red-700 dark:text-red-400 uppercase mb-1">Monto Neto Final (Dif)</label>
                                                <div class="relative">
                                                    <span class="absolute left-2 top-1.5 text-slate-400 font-bold">₡</span>
                                                    <input type="number" step="0.01" id="fm-neto" class="w-full p-1.5 pl-6 text-sm font-bold border-2 border-red-400 rounded bg-white dark:bg-slate-900 text-red-900 dark:text-white focus:ring-0 outline-none" placeholder="0.00">
                                                </div>
                                            </div>
                                            <div class="flex-grow text-[9px] text-slate-500 italic mt-3">Ingrese el monto neto a justificar. El sistema calculará el Monto Bruto hacia arriba.</div>
                                        </div>
                                        <div class="grid grid-cols-4 gap-3">
                                            <div>
                                                <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tasa Com. Banco</label>
                                                <select id="fm-tasa" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-slate-700 dark:text-slate-300 outline-none cursor-pointer">
                                                    <option value="0" selected>0.00%</option>
                                                    <option value="0.0195">1.95%</option>
                                                    <option value="0.025">2.50%</option>
                                                </select>
                                            </div>
                                            <div><label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Comisión (Dinero)</label><input type="number" id="fm-com" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-red-600 dark:text-red-400 outline-none font-mono" placeholder="0.00"></div>
                                            <div><label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ret. IVA (5.30%)</label><input type="number" id="fm-iva" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-orange-600 dark:text-orange-400 outline-none font-mono" placeholder="0.00"></div>
                                            <div><label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">Ret. ISR (1.76%)</label><input type="number" id="fm-isr" class="w-full p-1.5 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 text-orange-600 dark:text-orange-400 outline-none font-mono" placeholder="0.00"></div>
                                        </div>
                                    </div>

                                    <!-- Totalizador Bruto -->
                                    <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex justify-between items-center shadow-inner">
                                        <span id="fm-dynamic-title" class="text-sm font-bold text-green-800 dark:text-green-400 uppercase">Monto Bruto Final</span>
                                        <span id="fm-venta-display" class="text-2xl font-mono font-bold text-green-700 dark:text-green-300">₡0.00</span>
                                    </div>

                                    <!-- Auditoría -->
                                    <div class="grid grid-cols-2 gap-4">
                                        <div><label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Justificación</label><textarea id="fm-reason" class="w-full p-2 text-xs border rounded bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white outline-none h-20 resize-none" placeholder="Motivo..."></textarea></div>
                                        <div>
                                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Evidencia Visual</label>
                                            <div id="fm-evidence-zone" class="w-full h-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center relative"><div id="fm-ev-text" class="text-[10px] text-center text-slate-400 pointer-events-none">Ctrl+V para pegar imagen</div><img id="fm-ev-preview" class="absolute inset-0 w-full h-full object-contain hidden bg-slate-100 dark:bg-slate-800"><button id="fm-ev-clear" class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] hidden opacity-75 hover:opacity-100">×</button></div>
                                            <input type="hidden" id="fm-evidence-b64">
                                        </div>
                                    </div>
                                </div>

                                <!-- Footer Modal -->
                                <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end gap-3 shrink-0">
                                    <button onclick="document.getElementById('modal-adj').classList.add('hidden')" class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">Cancelar</button>
                                    <button id="btn-save-adj" class="px-6 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded font-bold shadow-md transition-colors">Generar Registro</button>
                                </div>
                            </div>
                            
                            <!-- Pestaña de Ventana Minimizada -->
                            <div id="btn-restore-ghost" class="fixed bottom-4 right-4 z-[200] hidden">
                                <button onclick="window.toggleGhostMode()" class="flex items-center gap-2 bg-slate-800 dark:bg-slate-700 text-white border border-slate-600 shadow-lg px-4 py-2 rounded-md hover:bg-slate-700 transition-all font-bold text-xs pointer-events-auto">
                                    <span class="text-red-400">➕</span> Ingresar Ajuste
                                </button>
                            </div>
                        </div>
                        <!-- Barra Status Autosuma Global (VanillaGrid busca este ID) -->
                        <div id="global-table-stats" class="fixed bottom-[60px] left-0 w-full bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 py-1 px-4 flex justify-end items-center gap-6 text-xs font-mono hidden z-50 shadow-md">
                            <div class="text-slate-500">SELECCIÓN:</div>
                            <div class="flex gap-2"><span class="text-slate-500">CNT:</span><span id="gst-count" class="font-bold">0</span></div>
                            <div class="flex gap-2"><span class="text-slate-500">SUM:</span><span id="gst-sum" class="font-bold">0</span></div>
                        </div>
                    \`);

                    // --- Búsqueda Inteligente de Índices (Lo subimos para que el Modal lo use) ---
                    const idxMerId = Object.keys(headersDet).find(k => headersDet[k] && headersDet[k].toLowerCase().includes('merid')) || "MERID_NO_FOUND";
                    const idxAuth = Object.keys(headersDet).find(k => headersDet[k] && headersDet[k].toLowerCase().includes('autori')) || "AUTH_NO_FOUND";
                    
                    // Aseguramos capturar "Fantasía", "Comercio" o "Razón Social" (Exclusivo de Scotia)
                    const idxComercio = Object.keys(headersDet).find(k => headersDet[k] && (headersDet[k].toLowerCase().includes('fantas') || headersDet[k].toLowerCase().includes('comercio') || headersDet[k].toLowerCase().includes('raz'))) || "2";

                    // --- LÓGICA DE CALCULADORA SCOTIABANK ---
                    const elNeto = document.getElementById('fm-neto');
                    const elCom = document.getElementById('fm-com');
                    const elIva = document.getElementById('fm-iva');
                    const elIsr = document.getElementById('fm-isr');
                    const elTasa = document.getElementById('fm-tasa');
                    const elType = document.getElementById('fm-type');
                    const elVentaDisp = document.getElementById('fm-venta-display');
                    const elDynamicTitle = document.getElementById('fm-dynamic-title');

                    elType.addEventListener('change', (e) => {
                        elDynamicTitle.innerText = e.target.value ? \`Monto Bruto \${e.target.value}\` : "Monto Bruto Final";
                        const isMantenimiento = e.target.value === 'Mantenimiento';
                        [elCom, elIva, elIsr, elTasa].forEach(el => {
                            el.disabled = isMantenimiento;
                            el.classList.toggle('opacity-50', isMantenimiento);
                        });
                        window.calcFinanzas();
                    });

                    window.calcFinanzas = (e) => {
                        let neto = parseFloat(elNeto.value) || 0;
                        let tasaVal = elTasa.value;
                        let tasaComision = tasaVal === "" ? 0 : parseFloat(tasaVal);
                        let isMantenimiento = elType.value === 'Mantenimiento';

                        if (!e || e.target === elNeto || e.target === elTasa || e.target === elType) {
                            if (isMantenimiento) {
                                elCom.value = '0.00'; elIva.value = '0.00'; elIsr.value = '0.00';
                            } else {
                                // Factor Scotia: Neto = Bruto * (1 - (TasaCom + 0.053 + 0.0176))
                                let factor = tasaComision + 0.053 + 0.0176;
                                let bruto = neto / (1 - factor);
                                elCom.value = (bruto * tasaComision).toFixed(2);
                                elIva.value = (bruto * 0.053).toFixed(2);
                                elIsr.value = (bruto * 0.0176).toFixed(2);
                            }
                        }

                        let com = parseFloat(elCom.value) || 0;
                        let iva = parseFloat(elIva.value) || 0;
                        let isr = parseFloat(elIsr.value) || 0;
                        let brutoFinal = neto + com + iva + isr;
                        elVentaDisp.innerText = fmt(brutoFinal);

                        return { neto, com, iva, isr, bruto: brutoFinal };
                    };

                    [elNeto, elCom, elIva, elIsr, elTasa].forEach(el => el.addEventListener('input', window.calcFinanzas));

                    // --- EVENTOS DEL MODAL SCOTIA (Protegidos contra Modo Lectura) ---
                    const btnAddAdj = document.getElementById('btn-add-adj');
                    if (btnAddAdj) {
                        btnAddAdj.onclick = function() {
                            // Ignoramos filas de ajuste previas para no copiar datos en blanco
                            const seleccionados = gVentas.displayData.filter(r => r._selected && !r._isAdjustment);
                            const filaBase = seleccionados.length > 0 ? seleccionados[seleccionados.length - 1] : null;

                            document.getElementById('fm-afil').value = filaBase ? filaBase[idxMerId] : '';
                            
                            // USAR EL ÍNDICE GLOBAL DECLARADO PREVIAMENTE
                            let comValue = filaBase ? filaBase[idxComercio] : '';
                            if (String(comValue).toLowerCase() === 'crc' || !isNaN(comValue)) comValue = ''; 
                            
                            document.getElementById('fm-comercio').value = comValue;

                            const today = new Date().toISOString().split('T')[0];
                            document.getElementById('fm-ftrans').value = today;
                            document.getElementById('fm-fpago').value = today;
                            
                            if (currentFooterDiff !== 0) elNeto.value = currentFooterDiff.toFixed(2);
                            else elNeto.value = '';

                            elType.value = '';
                            elTasa.value = '0';
                            elDynamicTitle.innerText = "Monto Bruto Final";
                            window.calcFinanzas();
                            document.getElementById('modal-adj').classList.remove('hidden');
                        };
                    }

                    // BLOQUE 3 (Reemplazo BtnSaveAdj Scotia - Inyección real):
                    // GUARDAR AJUSTE SCOTIA (Este botón vive dentro del modal, siempre existe, pero lo protegemos por seguridad)
                    const btnSaveAdj = document.getElementById('btn-save-adj');
                    if (btnSaveAdj) {
                        btnSaveAdj.onclick = function() {
                            const type = elType.value;
                            const ftrans = document.getElementById('fm-ftrans').value;
                            
                            if(!type) return alert("Seleccione un tipo de ajuste.");
                            if(!ftrans) return alert("La Fecha de Transacción es obligatoria.");
                            
                            const res = window.calcFinanzas();
                            if(res.bruto === 0 && res.neto === 0) return alert("Ingrese un Monto válido.");

                            let comercioIdx = Object.keys(headersDet).find(k => headersDet[k] && (headersDet[k].toLowerCase().includes('comercio') || headersDet[k].toLowerCase().includes('fantasia') || headersDet[k].toLowerCase().includes('raz'))) || "2";

                            const newRow = {
                                _uid: 'sco_man_' + Date.now(),
                                _isAdjustment: true,
                                _selected: true,
                                _sourceFile: 'Registro Manual',
                                _adjType: type,
                                _adjReason: document.getElementById('fm-reason').value,
                                _adjEvidence: document.getElementById('fm-evidence-b64').value,
                                _fecha: ftrans,
                                _fechaPago: document.getElementById('fm-fpago').value,
                                _tarjeta: document.getElementById('fm-tarjeta').value,
                                _auth: document.getElementById('fm-auth').value,
                                
                                [idxMerId]: document.getElementById('fm-afil').value,
                                [comercioIdx]: document.getElementById('fm-comercio').value,
                                [idxAuth]: document.getElementById('fm-auth').value,
                                _bruto: res.bruto,
                                _neto: res.neto,
                                "Monto Comisión": res.com,
                                "Retención IVA": res.iva,
                                "Retención ISR": res.isr
                            };

                            // Inyección directa al grid del popup
                            const newData = [...gVentas.displayData, newRow];
                            gVentas.updateData(newData);
                            
                            document.getElementById('modal-adj').classList.add('hidden');
                            
                            // Limpiar campos visuales tras guardar
                            [elNeto, elCom, elIva, elIsr, document.getElementById('fm-tarjeta'), document.getElementById('fm-auth'), document.getElementById('fm-reason')].forEach(e => e.value = '');
                            
                            // Disparar click en limpiar evidencia si existe
                            const btnClearEv = document.getElementById('fm-ev-clear');
                            if(btnClearEv && !btnClearEv.classList.contains('hidden')) btnClearEv.click();
                            
                            updateCalc();
                        };
                    }

                    // CONCILIAR MANUALMENTE SCOTIA
                    const btnManual = document.getElementById('btn-manual');
                    if (btnManual) {
                        btnManual.onclick = async function() { // AHORA ES ASÍNCRONA
                            const selection = {
                                det: gVentas.displayData.filter(r => r._selected).map(r => r._uid),
                                pag: gBanco.displayData.filter(r => r._selected).map(r => r._uid)
                            };
                            
                            if(window.opener && window.opener.ConciliacionLogic && window.opener.ConciliacionLogic.applyManualScotiaMatch) {
                                let finalReason = "Conciliación Manual Scotia";
                                const adjustments = gVentas.displayData.filter(r => r._selected && r._isAdjustment);
                                
                                if(adjustments.length > 0) {
                                    finalReason = "Ajuste Manual: " + adjustments.map(a => a._adjType).join(', ');
                                    window.opener.ConciliacionLogic.injectScotiaAdjustments(adjustments);
                                } else {
                                    // INYECTAMOS EL NUEVO SYSUI PROMPT MODERNO
                                    const userReason = await window.SysUI.prompt("Ingrese una justificación para forzar esta conciliación:", "Justificación Requerida", "Ajuste manual");
                                    if(!userReason) return;
                                    finalReason = userReason;
                                }
                                
                                window.opener.ConciliacionLogic.applyManualScotiaMatch(selection, finalReason);
                                window.close();
                            }
                        };
                    }

                    // EVENTOS PEGAR IMAGEN SCOTIA (CTRL+V GLOBAL)
                    window.addEventListener('paste', (e) => {
                        const modal = document.getElementById('modal-adj');
                        if (!modal || modal.classList.contains('hidden') || modal.classList.contains('pointer-events-none')) return;
                        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                        for (let index in items) {
                            const item = items[index];
                            if (item.kind === 'file' && item.type.startsWith('image/')) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    document.getElementById('fm-ev-preview').src = event.target.result;
                                    document.getElementById('fm-ev-preview').classList.remove('hidden');
                                    document.getElementById('fm-evidence-b64').value = event.target.result;
                                    document.getElementById('fm-ev-text').classList.add('hidden');
                                    document.getElementById('fm-ev-clear').classList.remove('hidden');
                                };
                                reader.readAsDataURL(item.getAsFile());
                                e.preventDefault(); break;
                            }
                        }
                    });
                    document.getElementById('fm-ev-clear').onclick = (e) => {
                        if(e) e.stopPropagation();
                        document.getElementById('fm-ev-preview').src = '';
                        document.getElementById('fm-ev-preview').classList.add('hidden');
                        document.getElementById('fm-evidence-b64').value = '';
                        document.getElementById('fm-ev-text').classList.remove('hidden');
                        document.getElementById('fm-ev-clear').classList.add('hidden');
                    };

                    // MODO FANTASMA (MINIMIZAR) - VERSIÓN REFORZADA
                    window.toggleGhostMode = function() {
                        const modal = document.getElementById('modal-adj');
                        const card = document.getElementById('form-card');
                        const btnRestore = document.getElementById('btn-restore-ghost');
                        
                        if (modal.classList.contains('pointer-events-none')) {
                            // Restaurar (Subir)
                            modal.classList.remove('pointer-events-none');
                            modal.classList.remove('bg-transparent');
                            modal.classList.add('bg-black/60', 'backdrop-blur-sm');
                            
                            card.classList.remove('hidden'); // Mostrar si estaba oculto duro
                            setTimeout(() => {
                                card.classList.remove('opacity-0', 'translate-y-40', 'scale-95');
                                card.classList.add('opacity-100', 'translate-y-0', 'scale-100');
                            }, 10);
                            
                            btnRestore.classList.add('hidden');
                        } else {
                            // Minimizar (Ocultar hacia abajo)
                            modal.classList.add('pointer-events-none'); 
                            modal.classList.add('bg-transparent');
                            modal.classList.remove('bg-black/60', 'backdrop-blur-sm');
                            
                            card.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
                            card.classList.add('opacity-0', 'translate-y-40', 'scale-95');
                            
                            // Ocultar por completo tras la animación para evitar clics fantasma
                            setTimeout(() => {
                                if (modal.classList.contains('pointer-events-none')) {
                                    card.classList.add('hidden');
                                }
                            }, 300);
                            
                            btnRestore.classList.remove('hidden');
                        }
                    };

                    // Búsqueda inteligente de índices originales (Reutilizamos variables ya declaradas)
                    const originalUpdateCalc = updateCalc;
                    updateCalc = function() {
                        originalUpdateCalc();
                        const modalAdj = document.getElementById('modal-adj');
                        if (modalAdj && !modalAdj.classList.contains('hidden')) {
                            if (currentFooterDiff !== 0) elNeto.value = currentFooterDiff.toFixed(2);
                            else elNeto.value = '';
                            window.calcFinanzas();
                        }
                    };

                    // (Aquí borraste las 4 líneas conflictivas)

                    // COLUMNAS SCOTIA (DETALLE)
                    const colsVentas = [];
                    if(!isReadOnly) colsVentas.push({ title: "Sel", field: "_selected", formatter: "checkbox", hozAlign: "center", width: 40 });
                    
                    colsVentas.push(
                        { title: "Fecha", field: "_fecha", width: 80, cssClass: "text-[10px] text-slate-500", formatter: (cell) => window.opener.ConciliacionLogic.formatDateCR(cell.getValue()) },
                        { title: headersDet[idxMerId] || "MerID", field: idxMerId, headerFilter: true, width: 100, cssClass: "font-mono font-bold text-slate-700" },
                        { title: headersDet[idxAuth] || "Autorización", field: idxAuth, headerFilter: true, width: 90, cssClass: "font-mono" },
                        { title: "Monto Bruto", field: "_bruto", formatter: "money", hozAlign: "right", cssClass: "text-slate-500" },
                        { title: "Monto Neto", field: "_neto", formatter: "money", hozAlign: "right", cssClass: "font-bold text-red-600" },
                        {
                            title: "Estado / Info", field: "_sourceFile", width: 140, headerFilter: true,
                            formatter: (cell) => {
                                const row = cell.getRow();
                                const b64Gen = btoa(unescape(encodeURIComponent(generateGenericTooltip(row, true))));
                                
                                // SI ES UNA FILA FICTICIA INYECTADA (Ajuste Manual Modal)
                                if(row._isAdjustment) {
                                    // Todo está escapado (\$) porque vive dentro de un Template String (\`) que será escrito en un documento hijo.
                                    return \`
                                        <div class="flex justify-between items-center w-full h-full">
                                            <div onmouseenter="showGlobalTooltip(this, '\${b64Gen}')" onmouseleave="hideGlobalTooltip()" class="flex items-center gap-1 cursor-help">
                                                <span class="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-red-200 dark:border-red-700 truncate">\${row._adjType || 'Ajuste'} ℹ️</span>
                                            </div>
                                            \${isReadOnly ? '' : \`<button onclick="window.deleteAdj('\${row._uid}')" class="text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 px-1.5 rounded shadow-sm transition-colors text-[10px]" title="Eliminar Ajuste">✖</button>\`}
                                        </div>
                                    \`;
                                }

                                // SI ES UNA FILA NORMAL O UN AJUSTE LOTE DEL BANCO
                                const isAjusteBanco = row._mode === 'AJUSTE';
                                let fileStr = \`<span class="text-[9px] text-slate-400 truncate w-[90px]" title="\${row._sourceFile}">\${row._sourceFile}</span>\`;
                                if(isAjusteBanco) fileStr = \`<span class="bg-red-100 text-red-700 px-1 rounded font-bold text-[9px] border border-red-200">AJUSTE LOTE</span>\`;

                                return \`<div class="flex justify-between items-center w-full h-full group/info">
                                    \${fileStr}
                                    <div onmouseenter="showGlobalTooltip(this, '\${b64Gen}')" onmouseleave="hideGlobalTooltip()" class="text-blue-400 hover:text-blue-600 cursor-help transition-transform opacity-50 group-hover/info:opacity-100 bg-slate-100 dark:bg-slate-700 p-0.5 rounded">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                </div>\`;
                            }
                        }
                    );

                    const colsBanco = [];
                    if(!isReadOnly) colsBanco.push({ title: "Sel", field: "_selected", formatter: "checkbox", hozAlign: "center", width: 40 });
                    colsBanco.push(
                        { title: "Fecha", field: "_fecha", width: 80, cssClass: "text-[10px] text-slate-500", formatter: (cell) => window.opener.ConciliacionLogic.formatDateCR(cell.getValue()) },
                        { title: "Ref Banco", field: "_extractedId", headerFilter: true, width: 90, cssClass: "font-bold text-green-700" },
                        { title: "Descripción", field: "_desc", headerFilter: true, width: 180, cssClass: "text-[10px] truncate" },
                        { title: "Monto", field: "_monto", formatter: "money", hozAlign: "right", cssClass: "font-bold" },
                        { 
                            title: "Estado / Info", field: "_sourceFile", width: 120, headerFilter: true,
                            formatter: (cell) => {
                                const row = cell.getRow();
                                const b64Gen = btoa(unescape(encodeURIComponent(generateGenericTooltip(row, false))));
                                return \`<div class="flex justify-between items-center w-full h-full group/info">
                                    <span class="text-[9px] text-slate-400 truncate w-[90px]" title="\${row._sourceFile}">\${row._sourceFile}</span>
                                    <div onmouseenter="showGlobalTooltip(this, '\${b64Gen}')" onmouseleave="hideGlobalTooltip()" class="text-blue-400 hover:text-blue-600 cursor-help transition-transform opacity-50 group-hover/info:opacity-100 bg-slate-100 dark:bg-slate-700 p-0.5 rounded">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                </div>\`;
                            }
                        }
                    );

                    // CALCULADORA
                    let currentFooterDiff = 0;
                    function updateCalc() {
                        if(isReadOnly) return;
                        
                        let sumV = 0, sumB = 0;
                        let selCountV = 0, selCountB = 0;
                        
                        if(gVentas) gVentas.displayData.forEach(r => { if(r._selected) { sumV += (r._neto || 0); selCountV++; }});
                        if(gBanco) gBanco.displayData.forEach(r => { if(r._selected) { sumB += (r._monto || 0); selCountB++; }});

                        // Visualmente ahora es Banco - Ventas
                        currentFooterDiff = sumB - sumV;
                        
                        document.getElementById('sum-ventas').innerText = fmt(sumV);
                        document.getElementById('sum-banco').innerText = fmt(sumB);
                        const elDiff = document.getElementById('sum-diff');
                        elDiff.innerText = fmt(currentFooterDiff);
                        
                        // LÓGICA DE BOTÓN CONCILIAR
                        const btn = document.getElementById('btn-manual');
                        const isValid = Math.abs(currentFooterDiff) < 1 && (selCountV > 0 || selCountB > 0);
                        
                        if(isValid) {
                            btn.disabled = false;
                            btn.className = "bg-purple-600 hover:bg-purple-700 text-white dark:bg-purple-700 dark:hover:bg-purple-600 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition-all shadow-md transform hover:scale-105";
                            elDiff.className = "font-mono font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 transition-colors";
                        } else {
                            btn.disabled = true;
                            btn.className = "bg-purple-100 dark:bg-slate-700 text-purple-400 dark:text-slate-500 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 cursor-not-allowed transition-colors border border-transparent shadow-sm";
                            elDiff.className = "font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 transition-colors";
                        }

                        // SINCRONIZACIÓN DIRECTA CON EL MODAL (Elimina la necesidad del hack)
                        const modalAdj = document.getElementById('modal-adj');
                        if (modalAdj && !modalAdj.classList.contains('hidden') && typeof window.calcFinanzas === 'function') {
                            const elNeto = document.getElementById('fm-neto');
                            if (elNeto) {
                                if (currentFooterDiff !== 0) elNeto.value = currentFooterDiff.toFixed(2);
                                else elNeto.value = '';
                                window.calcFinanzas();
                            }
                        }
                    }

                    // INICIALIZACIÓN
                    let gVentas, gBanco;
                    window.onload = function() {
                        const optsVentas = { onCheckboxChange: () => updateCalc() };
                        
                        // Opciones especiales para el Banco (Con Smart Check para Scotiabank)
                        const optsBanco = { 
                            onCheckboxChange: (row, field, isChecked) => {
                                // En Scotia, la referencia del banco ("_extractedId") cruza con el "MerID"
                                if (isChecked && row._extractedId && row._extractedId.trim() !== '' && row._extractedId !== 'SIN_ID') {
                                    const targetID = row._extractedId.trim();
                                    let changed = false;
                                    
                                    // Buscar en Ventas y marcar los que coincidan en idxMerId
                                    gVentas.displayData.forEach(vRow => {
                                        // Usar el índice dinámico del MerID que calculamos arriba en la cabecera
                                        if (vRow[idxMerId] && String(vRow[idxMerId]).trim() === targetID && !vRow._selected) {
                                            vRow._selected = true;
                                            changed = true;
                                        }
                                    });
                                    
                                    // Repintar para que aparezcan los checks azules de inmediato
                                    if (changed) {
                                        gVentas.render();
                                    }
                                }
                                updateCalc();
                            } 
                        };

                        gVentas = new VanillaGrid("#grid-ventas", rawVentas, colsVentas, optsVentas); 
                        gBanco = new VanillaGrid("#grid-banco", rawBanco, colsBanco, optsBanco);     
                        updateCalc();
                    };

                    // MOTOR TOOLTIP GLOBAL (Idéntico a BAC)
                    let hideTimeout = null;
                    const tt = document.getElementById('global-float-tooltip');
                    tt.addEventListener('mouseenter', () => { if (hideTimeout) clearTimeout(hideTimeout); tt.classList.remove('opacity-0', 'hidden'); });
                    tt.addEventListener('mouseleave', () => window.hideGlobalTooltip(true));

                    window.showGlobalTooltip = function(el, htmlB64) {
                        if (hideTimeout) clearTimeout(hideTimeout);
                        tt.innerHTML = decodeURIComponent(escape(atob(htmlB64)));
                        tt.classList.remove('pointer-events-none', 'hidden');
                        tt.classList.add('pointer-events-auto');
                        const rect = el.getBoundingClientRect();
                        let top = rect.bottom, left = rect.left;
                        if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
                        if (top + 250 > window.innerHeight) top = rect.top - tt.offsetHeight;
                        tt.style.top = top + 'px'; tt.style.left = left + 'px';
                        tt.style.paddingTop = '10px'; tt.style.marginTop = '-10px';
                        setTimeout(() => tt.classList.remove('opacity-0'), 10);
                    };
                    
                    window.hideGlobalTooltip = function(force = false) {
                        if (hideTimeout) clearTimeout(hideTimeout);
                        hideTimeout = setTimeout(() => {
                            tt.classList.add('opacity-0', 'pointer-events-none');
                            tt.classList.remove('pointer-events-auto');
                            setTimeout(() => { if(tt.classList.contains('opacity-0')) tt.classList.add('hidden'); }, 200);
                        }, force ? 10 : 400);
                    };
                </script>
            </body>
            </html>
        `);
        win.document.close();
    }
};