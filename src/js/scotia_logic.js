window.ScotiaLogic = {

    processScotiabankDetalle: async function(buf, filename) {
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

        // 1. Detectar la Fila de Encabezados
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

        // 2. NORMALIZACIÓN "MASTER HEADER"
        const currentHeaders = rawRows[mainHeaderIdx].map(h => h ? String(h).trim() : `Col_${Math.random()}`);
        
        this.data.headers = this.data.headers || {};
        if (!this.data.headers.scotia_detalle || this.data.headers.scotia_detalle.length === 0) {
            this.data.headers.scotia_detalle = [...currentHeaders]; 
        }
        const masterHeaders = this.data.headers.scotia_detalle;

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

        // 3. Índices de lectura
        const getCurrIdx = (name) => currentHeaders.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        
        const currCols = {
            merId: getCurrIdx('merid'),
            bruto: getCurrIdx('monto bruto'),
            neto: getCurrIdx('monto neto'),
            com: getCurrIdx('monto comisión') !== -1 ? getCurrIdx('monto comisión') : getCurrIdx('monto comision'),
            iva: getCurrIdx('retención iva') !== -1 ? getCurrIdx('retención iva') : getCurrIdx('retencion iva'),
            isr: getCurrIdx('retención isr') !== -1 ? getCurrIdx('retención isr') : getCurrIdx('retencion is'),
            fecha: getCurrIdx('fecha'),
            fechaPago: getCurrIdx('fecha pago'),
            moneda: getCurrIdx('moneda'),
            nombre: getCurrIdx('nombre'),
            transaccion: getCurrIdx('transacci'),
            orig: getCurrIdx('monto orig'),
            pCom: getCurrIdx('% comisión total') !== -1 ? getCurrIdx('% comisión total') : getCurrIdx('% comision total'),
            pIva: getCurrIdx('% retención iva') !== -1 ? getCurrIdx('% retención iva') : getCurrIdx('% retencion iva')
        };
        
        const masterFechaIdx = masterHeaders.findIndex(h => h && h.toLowerCase().includes('fecha'));

        // PARSEADOR NUMÉRICO UNIVERSAL (Respeta Negativos Contables)
        const parseNum = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            if (typeof v === 'number') return v;
            let str = String(v).trim().replace(/['"\s₡$]/g, '');
            let isNegative = false;
            if (str.endsWith('-')) { isNegative = true; str = str.slice(0, -1); } 
            else if (str.startsWith('(') && str.endsWith(')')) { isNegative = true; str = str.slice(1, -1); } 
            else if (str.startsWith('-')) { isNegative = true; str = str.substring(1); }
            
            if (str.includes(',') && str.includes('.')) str = str.replace(/,/g, ''); 
            else if (str.includes(',')) {
                if ((str.match(/,/g) || []).length > 1) str = str.replace(/,/g, '');
                else str = str.replace(',', '.');
            }
            const num = parseFloat(str);
            if (isNaN(num)) return 0;
            return isNegative ? -Math.abs(num) : Math.abs(num);
        };

        const newRows = [];
        let currentMode = 'LOTE'; 

        for(let i = mainHeaderIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || row.length === 0) continue;

            const rowStr = JSON.stringify(row).toLowerCase();

            if(rowStr.includes('agrupado por') && rowStr.includes('transacción')) {
                currentMode = rowStr.includes('ajuste') ? 'AJUSTE' : 'LOTE';
                continue; 
            }
            if(rowStr.includes('monto neto') || rowStr.includes('subtotales')) continue;

            let workingRow = [...row];
            let rawMerId = String(workingRow[currCols.merId] || '').trim();
            if (rawMerId.startsWith("'")) rawMerId = rawMerId.substring(1);
            if(rawMerId === '') continue;

            // Detección Inteligente de Ajustes
            let isAjusteRow = false;
            if (currCols.transaccion !== -1) {
                const valTrans = String(workingRow[currCols.transaccion] || '').toLowerCase();
                if (valTrans.includes('ajuste')) isAjusteRow = true;
            }
            if (currentMode === 'AJUSTE') isAjusteRow = true;

            // Extracción Matemática
            let finalBruto = parseNum(workingRow[currCols.bruto]);
            let finalNeto = parseNum(workingRow[currCols.neto]);
            let vCom = parseNum(workingRow[currCols.com]);
            let vIva = parseNum(workingRow[currCols.iva]);
            let vIsr = parseNum(workingRow[currCols.isr]);
            let vOrig = parseNum(workingRow[currCols.orig]);
            let vPCom = parseNum(workingRow[currCols.pCom]);
            let vPIva = parseNum(workingRow[currCols.pIva]);
            
            // INVERSIÓN TOTAL DE SIGNOS (AJUSTES)
            if (isAjusteRow) {
                if (finalBruto > 0) finalBruto = -finalBruto;
                if (finalNeto > 0) finalNeto = -finalNeto;
                if (vCom > 0) vCom = -vCom;
                if (vIva > 0) vIva = -vIva;
                if (vIsr > 0) vIsr = -vIsr;
                if (vOrig > 0) vOrig = -vOrig;
                if (vPCom > 0) vPCom = -vPCom;
                if (vPIva > 0) vPIva = -vPIva;
            }

            const mappedData = {};
            currentHeaders.forEach((h, currIdx) => {
                const mIdx = indexMap[currIdx];
                let cellVal = workingRow[currIdx];
                if (typeof cellVal === 'string' && cellVal.startsWith("'")) cellVal = cellVal.substring(1);
                mappedData[String(mIdx)] = cellVal;
            });

            // Inyectar negativos al Array Crudo
            if (isAjusteRow) {
                if (currCols.neto !== -1) mappedData[String(indexMap[currCols.neto])] = finalNeto;
                if (currCols.bruto !== -1) mappedData[String(indexMap[currCols.bruto])] = finalBruto;
                if (currCols.com !== -1) mappedData[String(indexMap[currCols.com])] = vCom;
                if (currCols.iva !== -1) mappedData[String(indexMap[currCols.iva])] = vIva;
                if (currCols.isr !== -1) mappedData[String(indexMap[currCols.isr])] = vIsr;
                if (currCols.orig !== -1) mappedData[String(indexMap[currCols.orig])] = vOrig;
                if (currCols.pCom !== -1) mappedData[String(indexMap[currCols.pCom])] = vPCom;
                if (currCols.pIva !== -1) mappedData[String(indexMap[currCols.pIva])] = vPIva;
            }
        
            // Extraer Moneda (Default CRC)
            const rawCurr = currCols.moneda !== -1 ? String(workingRow[currCols.moneda] || '').toUpperCase() : 'COLON';
            const detectedCurr = (rawCurr.includes('DOLAR') || rawCurr.includes('USD')) ? 'USD' : 'CRC';

            // LINK DE PAGO: la columna Nombre trae la palabra LINK (ALAMO LINK, etc.)
            const nombreCol = currCols.nombre !== -1 ? String(workingRow[currCols.nombre] || '') : '';
            const esLink = /\bLINK\b/.test(nombreCol.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase());

            const rowObj = {
                _uid: 'scodet_' + Math.random().toString(36).substr(2, 9), 
                _enabled: true,
                _extractedId: rawMerId, 
                _currency: detectedCurr, // <--- Bimonetarismo activado
                _esLink: esLink,         // link de pago (pasarela), cobrado en dólares
                _montoDolar: null,       // neto en USD; se llena al convertir
                _tcAplicado: null,
                _neto: finalNeto,
                _bruto: finalBruto,
                _comision: vCom,
                _iva: vIva,
                _isr: vIsr,
                _fecha: masterFechaIdx !== -1 ?
                    mappedData[String(masterFechaIdx)] : "",
                // Fecha Pago real de la transacción (columna específica, no el
                // primer "fecha" genérico). Es la que manda para consultar el
                // tipo de cambio de cada link de pago.
                _fechaPago: currCols.fechaPago !== -1 ?
                    workingRow[currCols.fechaPago] : null,
                _mode: currentMode,
                _sourceFile: filename,
                ...mappedData
            };
            
            newRows.push(rowObj);
        }
    
        // Los links de pago vienen en dólares: se convierten a colones ANTES de seguir
        await this._convertirLinksDetalle(newRows, currCols, indexMap);

        const filteredRows = await window.ConciliacionLogic.filterDuplicates(newRows, 'SCOTIA', 'DETALLADO');
        if(filteredRows.length === 0) return;

        this.data.scotia_detalle = (this.data.scotia_detalle || []).concat(filteredRows);
        
        if(filename && !this.data.files.scotia_detalle.includes(filename)) {
            this.data.files.scotia_detalle.push(filename);
        }
        
        this.updateScotiaCard();
        this.updateScotiaFileList('scotia_detalle'); 
        
        if(this.switchTab) this.switchTab('scotia');
        await this._propagarLinksAlPagado();
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
        if (data.length === 0) {
            const card = document.getElementById('card-scotia-detalle');
            if (card) card.classList.add('hidden');
            document.getElementById('scotia-summary-container').innerHTML = '';
            return;
        }

        let s = { v:0, c:0, iva:0, isr:0, n:0, count:0, adj:0 };
        
        this.data.scotia_detalle.forEach(r => {
            const isActivo = r._enabled || r._manualMatch !== undefined;
            if(isActivo) {
                s.count++;
                if (r._isAdjustment) {
                    s.adj++;
                } else {
                    s.v += (r._bruto || 0);
                }
                s.c += (r._comision || 0);
                s.iva += (r._iva || 0);
                s.isr += (r._isr || 0);
                s.n += (r._neto || 0);
            }
        });

        const fmt = this.formatMoney;
        
        const html = `
            <div class="flex flex-row justify-between items-center w-full h-full px-4 py-1.5 gap-6">
                <!-- 1. VENTAS BRUTAS Y METADATOS -->
                <div class="flex flex-col justify-center border-r border-slate-200 dark:border-slate-700 pr-6 shrink-0">
                    <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Ventas Totales</span>
                    <span class="font-mono font-black text-slate-800 dark:text-white text-2xl drop-shadow-sm">${fmt(s.v)}</span>
                    <span class="text-[9px] text-slate-400 mt-1 font-medium tracking-wide">
                        ${s.count} Registros ${s.adj > 0 ? `<span class="text-amber-500 font-bold ml-1">(${s.adj} Ajustes)</span>` : ''}
                    </span>
                </div>

                <!-- 2. DEDUCCIONES (Grid Compacto) -->
                <div class="flex-grow grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs font-mono">
                    <div class="flex flex-col bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50 shadow-sm">
                        <span class="text-[9px] font-bold text-slate-400 uppercase font-sans mb-0.5">Comisión</span>
                        <span class="text-red-500 font-bold">-${fmt(s.c)}</span>
                    </div>
                    <div class="flex flex-col bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50 shadow-sm">
                        <span class="text-[9px] font-bold text-slate-400 uppercase font-sans mb-0.5">Ret. IVA (5.31%)</span>
                        <span class="text-orange-500 font-bold">-${fmt(s.iva)}</span>
                    </div>
                    <div class="flex flex-col bg-slate-50 dark:bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-700/50 shadow-sm">
                        <span class="text-[9px] font-bold text-slate-400 uppercase font-sans mb-0.5">Ret. ISR (1.76%)</span>
                        <span class="text-amber-500 font-bold">-${fmt(s.isr)}</span>
                    </div>
                </div>

                <!-- 3. NETO ESPERADO -->
                <div class="flex flex-col justify-center min-w-[180px] pl-6 border-l border-slate-200 dark:border-slate-700 shrink-0">
                    <div class="bg-blue-50 dark:bg-blue-900/30 rounded-xl px-4 py-2 w-full text-left border border-blue-200 dark:border-blue-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                        <div class="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                        <span class="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-black block mb-0.5 tracking-widest pl-2">Neto Esperado</span>
                        <span class="font-mono font-black text-blue-700 dark:text-blue-400 text-2xl block truncate pl-2">${fmt(s.n)}</span>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('scotia-summary-container').innerHTML = html;
        document.getElementById('card-scotia-detalle').classList.remove('hidden');
    },

    // FUNCIÓN:Cambia un negativo a positivo (Contracargos/Devoluciones)
    flipScotiaSign: function(uid, reason) {
        const row = this.data.scotia_detalle.find(r => r._uid === uid);
        if (!row) return false;

        // 1. Validar Inteligencia: "Mantener siempre y cuando no afecten el balance"
        if (row._manualMatch) {
            const group = this.manualMatchesScotia.find(g => g.id === row._manualMatch);
            if (group) {
                // Simulamos el impacto matemático de invertir el signo
                const newNeto = Math.abs(row._neto);
                const sumDet = group.rows.filter(r => r._type === 'Venta').reduce((s, r) => s + (r._uid === uid ? newNeto : (r._neto || 0)), 0);
                const sumPag = group.rows.filter(r => r._type === 'Banco').reduce((s, r) => s + (r._monto || 0), 0);
                const newDiff = sumDet - sumPag;

                // Si la diferencia se rompe, abortamos para proteger el balance
                if (Math.abs(newDiff) >= 1) {
                    alert("⛔ Acción Denegada:\n\nEsta fila pertenece a una conciliación manual. Si cambia el signo a positivo, el balance dejará de ser 0.00.\n\nPor favor, deshaga la conciliación manual primero para poder editar el signo.");
                    return false;
                }
            }
        }

        // 2. Invertir valores principales en memoria RAM
        row._neto = Math.abs(row._neto);
        row._bruto = Math.abs(row._bruto);
        row._comision = Math.abs(row._comision);
        row._iva = Math.abs(row._iva);
        row._isr = Math.abs(row._isr);

        // 3. Invertir variables crudas mapeadas (Esto garantiza que SQL Server reciba positivos)
        const h = this.data.headers.scotia_detalle;
        const getIdx = (name) => h.findIndex(x => x && x.toLowerCase().includes(name.toLowerCase()));
        
        const idxs = {
            bruto: getIdx('monto bruto'),
            neto: getIdx('monto neto'),
            com: getIdx('monto comisión') !== -1 ? getIdx('monto comisión') : getIdx('monto comision'),
            iva: getIdx('retención iva') !== -1 ? getIdx('retención iva') : getIdx('retencion iva'),
            isr: getIdx('retención isr') !== -1 ? getIdx('retención isr') : getIdx('retencion is'),
            orig: getIdx('monto orig')
        };

        const toPositive = (val) => Math.abs(parseFloat(String(val).replace(/,/g,'')) || 0);

        Object.values(idxs).forEach(idx => {
            if(idx !== -1 && row[String(idx)]) {
                row[String(idx)] = toPositive(row[String(idx)]);
            }
        });

        // 4. Guardar Estado de Auditoría Visual
        row._signFlipped = true;
        row._flipReason = reason;

        // 5. Actualizar la clonación dentro del grupo manual (Si pasó la validación de balance)
        if (row._manualMatch) {
            const group = this.manualMatchesScotia.find(g => g.id === row._manualMatch);
            if (group) {
                const clone = group.rows.find(r => r._uid === uid);
                if (clone) { clone._neto = row._neto; clone._bruto = row._bruto; }
            }
        }

        // 6. Disparar Recálculo Completo de Scotia
        this.updateAll();
        return true;
    },

    // Procesa el Excel de Pagado (Scotiabank)
    processScotiabankPagado: async function(buf, filename) {
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
        const iTipo = headers.findIndex(h => h && (String(h).toLowerCase().includes('crédito') || String(h).toLowerCase().includes('credito') || String(h).toLowerCase().includes('débito') || String(h).toLowerCase().includes('debito') || String(h).toLowerCase().includes('tipo')));

        const newRows = [];

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
                let str = rawM.trim().replace(/['"\s₡$]/g, '');
                let isNegative = false;
                if (str.endsWith('-')) { isNegative = true; str = str.slice(0, -1); } 
                else if (str.startsWith('(') && str.endsWith(')')) { isNegative = true; str = str.slice(1, -1); } 
                else if (str.startsWith('-')) { isNegative = true; str = str.substring(1); }
                
                if (str.includes(',') && str.includes('.')) str = str.replace(/,/g, ''); 
                else if (str.includes(',')) {
                    if ((str.match(/,/g) || []).length > 1) str = str.replace(/,/g, '');
                    else str = str.replace(',', '.');
                }
                const num = parseFloat(str);
                m = isNaN(num) ? 0 : (isNegative ? -Math.abs(num) : Math.abs(num));
            }
            
            // INTELIGENCIA BANCARIA: Si la columna de tipo dice "Débito", forzar a negativo
            if (iTipo !== -1) {
                const tipoStr = String(row[iTipo] || '').toLowerCase();
                if (tipoStr.includes('débito') || tipoStr.includes('debito')) {
                    if (m > 0) m = -m;
                }
            }
            
            // Inyectar a la celda original cruda para que viaje negativo a la BD
            row[iMonto] = m;
            
            if (m !== 0) {
                const desc = String(row[iDesc] || '').trim();
                
                // EXTRACCIÓN INTELIGENTE DE MerID (Soporta "PCA 3793754 COMERCIO 61680500")
                let extractedID = "SIN_ID";
                const comercioMatch = desc.match(/COMERCIO\s+(\d+)/i);
                
                if (comercioMatch) {
                    extractedID = comercioMatch[1]; // Tomar el número exactamente después de "COMERCIO"
                } else {
                    // Fallback: Tomar la ÚLTIMA secuencia de números (evita atrapar el número de PCA)
                    const nums = desc.match(/\b\d{7,15}\b/g);
                    if (nums && nums.length > 0) extractedID = nums[nums.length - 1];
                }

                // Si no tiene un MerID válido y no es un ajuste interno del banco, lo omitimos
                if (extractedID === "SIN_ID" && !desc.toUpperCase().includes('AJUSTE')) continue;
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

        // FILTRO ANTI-DUPLICADOS
        const filteredRows = await window.ConciliacionLogic.filterDuplicates(newRows, 'SCOTIA', 'PAGADO');
        if(filteredRows.length === 0) return;

        // 3. ACUMULAR DATOS
        this.data.scotia_pagado = (this.data.scotia_pagado || []).concat(filteredRows);
        
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
            await this._propagarLinksAlPagado();
            this.runMatchScotiabank();
        }
        
        const dropzone = document.getElementById('drop-scotia-pagado');
        if(dropzone) {
            dropzone.classList.remove('border-slate-300', 'hover:border-green-500');
            dropzone.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
        }
    },

    // Ejecuta el cruce de conciliación Scotia
    // =====================================================================
    // LINKS DE PAGO (pasarela) — cobrados en DÓLARES en un archivo aparte.
    // Se convierten a colones con el tipo de cambio de TSD de la Fecha Pago,
    // guardando aparte el monto original en dólares.
    // =====================================================================
    _tcCache: {},

    // Un pedido por fecha; el resultado queda en caché mientras dure la sesión
    obtenerTipoCambio: async function(fechaISO) {
        if (!fechaISO) fechaISO = new Date().toISOString().slice(0, 10);
        if (this._tcCache[fechaISO]) return this._tcCache[fechaISO];
        try {
            const res = await fetch('api/get_tipo_cambio.php?fecha=' + encodeURIComponent(fechaISO));
            const j = await res.json();
            if (!j.success || !j.tipoCambio) throw new Error(j.error || 'Sin tipo de cambio');
            this._tcCache[fechaISO] = j.tipoCambio;
            return j.tipoCambio;
        } catch (e) {
            if (window.SysUI) SysUI.alert('No se pudo obtener el tipo de cambio de TSD para ' + fechaISO + '.\n\nLos links de pago quedarán en dólares hasta que se resuelva.', 'Tipo de cambio', 'error');
            return null;
        }
    },

    // Normaliza cualquier fecha del Excel a YYYY-MM-DD
    _fechaISO: function(v) {
        if (v === null || v === undefined || v === '') return null;
        if (v instanceof Date) {
            return v.getFullYear() + '-' +
                   String(v.getMonth() + 1).padStart(2, '0') + '-' +
                   String(v.getDate()).padStart(2, '0');
        }

        const t = String(v).trim().split(' ')[0];   // descarta la hora si viniera

        // XLSX.read sin cellDates entrega las fechas como número de serie de
        // Excel (6/7/2026 llega como 46209). Antes esto no se contemplaba, se
        // devolvía null y el llamador caía al tipo de cambio de HOY.
        // Mismo criterio que ConciliacionLogic.formatDateCR.
        if (t !== '' && !isNaN(t) && Number(t) > 10000 && Number(t) < 99999) {
            const ms = (Number(t) - 25569) * 86400 * 1000;
            const d = new Date(ms);
            return d.getUTCFullYear() + '-' +
                   String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
                   String(d.getUTCDate()).padStart(2, '0');
        }

        let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
        m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);   // dd/mm/yyyy
        if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
        return null;
    },

    _r2: function(n) { return Math.round((Number(n) || 0) * 100) / 100; },

    // Convierte las filas de link de pago del DETALLE.
    // Redondeo: bruto, neto, IVA e ISR se redondean a 2 decimales y la comisión
    // absorbe la diferencia, para que neto+comisión+IVA+ISR == bruto exacto.
    _convertirLinksDetalle: async function(rows, currCols, indexMap) {
        const links = rows.filter(r => r._esLink && !r._tcAplicado);
        if (!links.length) return;

        const k = (idx) => (idx !== -1 && indexMap ? String(indexMap[idx]) : null);
        const kBruto = k(currCols.bruto), kNeto = k(currCols.neto), kCom = k(currCols.com);
        const kIva = k(currCols.iva), kIsr = k(currCols.isr), kOrig = k(currCols.orig);

        // Agrupar por Fecha Pago real de cada fila: antes se tomaba la fecha de
        // la PRIMERA transacción del lote y ese único tipo de cambio se
        // aplicaba a todas, aunque el archivo trajera varios días distintos.
        const grupos = {};
        const sinFecha = [];
        links.forEach(r => {
            const fecha = this._fechaISO(r._fechaPago || r._fecha);
            // Sin Fecha Pago legible NO se convierte: caer al día de hoy es
            // exactamente el error que hacía que todo usara el TC del día.
            if (!fecha) { sinFecha.push(r); return; }
            (grupos[fecha] = grupos[fecha] || []).push(r);
        });

        if (sinFecha.length && window.SysUI) {
            window.SysUI.alert(
                sinFecha.length + ' link(s) de pago no traen una Fecha Pago legible.\n\n' +
                'Esas filas quedaron SIN convertir (siguen en dólares). Revise la columna "Fecha Pago" del Excel.',
                'Tipo de cambio', 'warning'
            );
        }

        for (const fecha of Object.keys(grupos)) {
            const tc = await this.obtenerTipoCambio(fecha);
            if (!tc) continue;   // sin tipo de cambio ese día: esas filas quedan sin convertir

            grupos[fecha].forEach(r => {
                const usdNeto = r._neto;
                const brutoC = this._r2(r._bruto * tc);
                const netoC  = this._r2(r._neto  * tc);
                const ivaC   = this._r2(r._iva   * tc);
                const isrC   = this._r2(r._isr   * tc);
                const comC   = this._r2(brutoC - netoC - ivaC - isrC);   // absorbe el redondeo

                r._montoDolar = usdNeto;      // lo que realmente se pagó, en dólares
                r._tcAplicado = tc;
                r._bruto = brutoC; r._neto = netoC; r._comision = comC; r._iva = ivaC; r._isr = isrC;

                // Las celdas crudas también viajan convertidas a la base de datos
                if (kBruto) r[kBruto] = brutoC;
                if (kNeto)  r[kNeto]  = netoC;
                if (kCom)   r[kCom]   = comC;
                if (kIva)   r[kIva]   = ivaC;
                if (kIsr)   r[kIsr]   = isrC;
                if (kOrig)  r[kOrig]  = brutoC;
            });
        }
        // Deliberadamente NO se llama a mostrarTipoCambio aquí: el indicador
        // "tc-indicador" (arriba, junto al botón de tema) es solo informativo
        // del tipo de cambio del día en curso y no debe reflejar el TC
        // histórico usado en una conversión de link de pago.
    },

    // El PAGADO no dice en qué moneda viene: hereda la marca del DETALLE.
    // El comercio de la descripción puede venir recortado ("COMERCIO 90631"
    // contra MerID "90631045"), así que se acepta por prefijo y se promueve
    // al MerID completo para que el agrupador existente los una.
    _propagarLinksAlPagado: async function() {
        const det = this.data.scotia_detalle || [];
        const pag = this.data.scotia_pagado || [];
        if (!det.length || !pag.length) return;

        const merIdsLink = [...new Set(det.filter(r => r._esLink)
            .map(r => String(r._extractedId || '').trim()).filter(Boolean))];
        if (!merIdsLink.length) return;

        const pendientes = pag.filter(p => !p._tcAplicado);
        for (const p of pendientes) {
            const idPag = String(p._extractedId || '').trim();
            if (!idPag || idPag === 'SIN_ID') continue;

            // Coincidencia exacta o el del banco es prefijo del MerID completo
            const merFull = merIdsLink.find(m => m === idPag || (idPag.length >= 4 && m.startsWith(idPag)));
            if (!merFull) continue;

            // El TC lo HEREDA del detalle con el que emparejó. Nunca se consulta
            // por separado: dos consultas independientes pueden caer en fechas
            // distintas y romper un cruce que debe ser exacto.
            const filaDet = det.find(d => d._esLink && String(d._extractedId).trim() === merFull && d._tcAplicado);
            const tc = filaDet ? filaDet._tcAplicado
                               : await this.obtenerTipoCambio(this._fechaISO(p._fecha));
            if (!tc) continue;

            p._esLink = true;
            p._extractedId = merFull;              // se promueve para que agrupe
            p._montoDolar = p._monto;              // original en dólares
            p._tcAplicado = tc;
            p._monto = this._r2(p._monto * tc);    // ya en colones

            // La celda cruda del monto también debe viajar convertida
            const hs = (this.data.headers && this.data.headers.scotia_pagado) || [];
            const iMonto = hs.findIndex(h => h && String(h).toLowerCase().includes('monto'));
            if (iMonto !== -1) p[String(iMonto)] = p._monto;
        }
    },

    // Indicador discreto junto al botón de tema
    mostrarTipoCambio: function(tc) {
        const el = document.getElementById('tc-indicador');
        if (!el || !tc) return;
        el.textContent = 'TC: ' + Number(tc).toFixed(2);
        el.classList.remove('hidden');
    },

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

        // 1. Agrupar Detalle (Homologado por ID Extraído)
        this.data.scotia_detalle.forEach(r => {
            if(!r._enabled) return;
            // Usamos _extractedId o _id para garantizar que el MerID sea el mismo que el del banco
            const id = String(r._extractedId || r._id || 'DESCONOCIDO').trim();
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
            const isMatch = Math.abs(diff) <= window.ConciliacionLogic.TOLERANCIA && Math.abs(det.neto) > 0;

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
                    const matchIdx = unmatchedPag.findIndex(p => Math.abs(dRow._neto - p._monto) <= window.ConciliacionLogic.TOLERANCIA);
                    
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
                        content += `<button onclick="window.ConciliacionLogic.undoManualScotiaMatch('${r._groupID}')" class="btn-deshacer ml-2 bg-red-100 hover:bg-red-200 text-red-600 px-1.5 py-0.5 rounded text-[9px] shadow-sm font-bold uppercase transition-colors" title="Eliminar ajuste y restaurar">Deshacer</button>`;
                    }
                    const esLinkGrupo = (r.rowsDet && r.rowsDet.some(d => d._esLink)) || (r.rowsPag && r.rowsPag.some(d => d._esLink));
                    if (esLinkGrupo) {
                        // TC realmente aplicado a las filas de ESTE grupo (no el
                        // indicador superior, que es solo el TC del día en curso).
                        const tcsLink = [...new Set(
                            [...(r.rowsDet || []), ...(r.rowsPag || [])]
                                .filter(d => d._esLink && d._tcAplicado)
                                .map(d => Number(d._tcAplicado).toFixed(2))
                        )];
                        const tcTexto = tcsLink.length === 1
                            ? `TC ${tcsLink[0]}`
                            : (tcsLink.length > 1 ? `TC ${tcsLink.join(' / ')}` : 'TC pendiente');

                        content += `<span class="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold align-middle bg-violet-100 text-violet-700 border border-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-600" title="Link de pago (pasarela) — cobrado en dólares y convertido a colones">&#128279; LINK · ${tcTexto}</span>`;
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
        // MODO SÓLO LECTURA: blindaje en la función núcleo, no sólo en el botón
        if (this._soloLectura) { if (this._avisoSoloLectura) this._avisoSoloLectura(); return; }
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
        // MODO SÓLO LECTURA: otro usuario tiene el control de esta conciliación
        if (this._soloLectura) {
            if (window.SysUI) SysUI.alert("Está en <b>modo sólo lectura</b>: no puede deshacer conciliaciones.", "Acción bloqueada", "warning");
            return;
        }
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
        // 1. Filtrar Array Principal
        this.data.scotia_detalle = this.data.scotia_detalle.filter(row => row._sourceFile !== filename);
        this.data.files.scotia_detalle = this.data.files.scotia_detalle.filter(f => f !== filename);

        // 2. Destruir Grupos Manuales que contenían elementos de este archivo
        if (this.manualMatchesScotia) {
            this.manualMatchesScotia = this.manualMatchesScotia.filter(group => {
                const hasDeletedRow = group.rows.some(r => r._type === 'Venta' && r._sourceFile === filename);
                if (hasDeletedRow) {
                    const pagadosAfectados = group.rows.filter(r => r._type === 'Banco');
                    pagadosAfectados.forEach(p => {
                        const original = this.data.scotia_pagado.find(o => o._uid === p._uid);
                        if (original) { original._enabled = true; delete original._manualMatch; }
                    });
                    return false; 
                }
                return true; 
            });
        }

        // 3. Recalcular cascada completa
        this.updateScotiaCard();
        this.updateScotiaFileList('scotia_detalle'); 
        this.recalculateScotiaPagado(); // Fuerza a que los Pagados liberados regresen al pool de cruce
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
        
        const isReadOnly = Math.abs(diff) <= (500) || data._isManual === true; //tolerancia popUp
        
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

                <div class="grid grid-cols-2 gap-4 flex-grow overflow-hidden h-full min-h-0">
                    <!-- DERECHA: BANCO -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden min-h-0">
                        <div class="${isDark ? 'bg-green-900/20 text-green-300 border-slate-700' : 'bg-green-50 text-green-700 border-green-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center shrink-0">
                            <span>Pagado Scotia (Recibido)</span>
                            <span class="bg-white dark:bg-slate-800 px-2 rounded text-[10px] shadow-sm">Total: ₡ <span id="lbl-tot-pag">${data.pagado.toLocaleString('en-US', {minimumFractionDigits:2})}</span></span>
                        </div>
                        <div id="grid-banco" class="flex-grow relative min-h-0 bg-white dark:bg-slate-800"></div>
                    </div>
                    
                     <!-- IZQUIERDA: VENTAS SCOTIA -->
                    <div class="flex flex-col h-full border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden relative min-h-0">
                        <div class="${isDark ? 'bg-red-900/20 text-red-300 border-slate-700' : 'bg-red-50 text-red-700 border-red-100'} p-2 text-xs font-bold uppercase border-b flex justify-between items-center shrink-0">
                            <span>Detalle Scotia (Esperado)</span>
                            <span class="bg-white dark:bg-slate-800 px-2 rounded text-[10px] shadow-sm">Total: ₡ <span id="lbl-tot-det">${data.neto.toLocaleString('en-US', {minimumFractionDigits:2})}</span></span>
                        </div>
                        <div id="grid-ventas" class="flex-grow relative min-h-0 bg-white dark:bg-slate-800"></div>
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
                        let tipo = elType.value;
                        let isMantenimiento = tipo === 'Mantenimiento';
                        let isParcial = tipo === 'Contracargo' || tipo === 'Devolución';

                        // Si el usuario cambia el Neto, la Tasa o el Tipo de Ajuste, recalculamos
                        if (!e || e.target === elNeto || e.target === elTasa || e.target === elType) {
                            if (isMantenimiento) {
                                // 0% Comisiones e Impuestos
                                elCom.value = '0.00'; elIva.value = '0.00'; elIsr.value = '0.00';
                            } else if (isParcial) {
                                // Cálculo Directo sobre el Monto Neto: Solo aplica la comisión del banco seleccionada
                                elCom.value = (neto * tasaComision).toFixed(2);
                                elIva.value = '0.00'; // Forzado a cero
                                elIsr.value = '0.00'; // Forzado a cero
                            } else {
                                // Cálculo Directo sobre el Monto Neto: Aplica TODOS los porcentajes
                                elCom.value = (neto * tasaComision).toFixed(2);
                                elIva.value = (neto * 0.0530).toFixed(2);
                                elIsr.value = (neto * 0.0176).toFixed(2);
                            }
                        }

                        let com = parseFloat(elCom.value) || 0;
                        let iva = parseFloat(elIva.value) || 0;
                        let isr = parseFloat(elIsr.value) || 0;
                        
                        // Bruto = Neto + Comisiones + Impuestos
                        let brutoFinal = neto + com + iva + isr;
                        elVentaDisp.innerText = fmt(brutoFinal);

                        return { neto, com, iva, isr, bruto: brutoFinal };
                    };

                    [elNeto, elCom, elIva, elIsr, elTasa].forEach(el => el.addEventListener('input', window.calcFinanzas));

                    // --- EVENTOS DEL MODAL SCOTIA (Protegidos contra Modo Lectura) ---
                    const btnAddAdj = document.getElementById('btn-add-adj');
                    if (btnAddAdj) {
                        btnAddAdj.onclick = function() {
                            if (window.ConciliacionLogic && window.ConciliacionLogic._soloLectura) { window.ConciliacionLogic._avisoSoloLectura(); return; }
                            const selVentas = gVentas.displayData.filter(r => r._selected && !r._isAdjustment);
                            const selBanco = gBanco.displayData.filter(r => r._selected && !r._isAdjustment);
                            
                            let filaBase = null;
                            let fromBanco = false;

                            // JERARQUÍA: 1. Ventas | 2. Banco
                            if (selVentas.length > 0) {
                                filaBase = selVentas[selVentas.length - 1];
                            } else if (selBanco.length > 0) {
                                filaBase = selBanco[selBanco.length - 1];
                                fromBanco = true;
                            }

                            // Extraer Afiliado
                            const extractedAfil = filaBase ? (fromBanco ? filaBase._extractedId : filaBase[idxMerId]) : '';
                            document.getElementById('fm-afil').value = extractedAfil || '';
                            
                            // Extraer Comercio (Búsqueda Cruzada Inteligente)
                            let comValue = '';
                            if (filaBase) {
                                if (!fromBanco) {
                                    comValue = filaBase[idxComercio] || '';
                                } else {
                                    // Buscar el MerID en la tabla de Ventas
                                    if (extractedAfil) {
                                        const filaVentaEncontrada = gVentas.displayData.find(v => v[idxMerId] === extractedAfil || v._extractedId === extractedAfil);
                                        if (filaVentaEncontrada) {
                                            comValue = filaVentaEncontrada[idxComercio] || '';
                                        }
                                    }
                                }
                            }
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
                            if (window.ConciliacionLogic && window.ConciliacionLogic._soloLectura) { window.ConciliacionLogic._avisoSoloLectura(); return; }
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
                                MerID: document.getElementById('fm-afil').value, // <--- Obligatorio para PHP
                                [comercioIdx]: document.getElementById('fm-comercio').value,
                                [idxAuth]: document.getElementById('fm-auth').value,
                                
                                // MATEMÁTICA PURA: Respetar el signo exacto del Auto-Calculador
                                _bruto: res.bruto || 0,
                                _neto: res.neto || 0,
                                "Monto Orig": res.bruto || 0,
                                "Monto Comisión": res.com || 0,
                                "Retención IVA": res.iva || 0,
                                "Retención ISR": res.isr || 0
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
                            if (window.ConciliacionLogic && window.ConciliacionLogic._soloLectura) { window.ConciliacionLogic._avisoSoloLectura(); return; }
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
                        // OJO: esto corre DENTRO del popup (window.open), así que la lógica
                        // vive en window.opener. El fallback evita romper si se pierde.
                        const TOL = (window.opener && window.opener.ConciliacionLogic) ? window.opener.ConciliacionLogic.TOLERANCIA : 2000;
                        const isValid = Math.abs(currentFooterDiff) <= TOL && (selCountV > 0 || selCountB > 0);
                        
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
                        const optsVentas = { resize: false, onCheckboxChange: () => updateCalc() };
                        
                        // Opciones especiales para el Banco (Con Smart Check para Scotiabank)
                        const optsBanco = { 
                            resize: false,
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