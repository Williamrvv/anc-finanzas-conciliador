window.TSDLogic = {
    // Definición de columnas exactas que se mostrarán en el PopUp
    desiredColumns: [
        'Nº contrato', 
        'Nombre', 
        'Recibo', 
        'Monto', 
        'Tipo', 
        'Depós.', 
        'Depós. adic.', 
        'Venta ctdo', 
        'Ctas p/cob', 
        'Reembolso', 
        'Nº aut.', 
        'Fecha pago', 
        'Recib. por', 
        'ICD'
    ],

    fetchExchangeRate: function() {
        console.log("TC BCCR: Pendiente de integración SOAP.");
    },
    
    updateExchangeRate: function(val) {
        this.exchangeRate = parseFloat(val) || 1;
        if(this.data.tsd && this.data.tsd.length) {
            this.runMatchTSD();
        }
    },

    processTSD: function(buf) {
        const wb = XLSX.read(new Uint8Array(buf), {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, {header: 1});

        // 1. Encontrar la fila de Encabezados Reales
        let headerIdx = -1;
        for(let i=0; i<Math.min(rawRows.length, 20); i++) {
            const rowStr = JSON.stringify(rawRows[i]).toLowerCase();
            // Validamos que tenga columnas clave
            if(rowStr.includes('contrato') && rowStr.includes('monto') && rowStr.includes('tipo')) {
                headerIdx = i; break;
            }
        }
        
        if(headerIdx === -1) return alert("No se encontró la fila de encabezados 'Nº contrato', 'Monto', etc.");

        const excelHeaders = rawRows[headerIdx];
        
        // 2. Mapear Nombres de Columna -> Índice en Excel (Búsqueda Robusta y Sanitizada)
        const colMap = {};
        
        // CORRECCIÓN: Usamos Array.from() para eliminar huecos (sparse arrays) y forzamos String
        const excelHeadersLower = Array.from(excelHeaders || []).map(h => String(h || '').toLowerCase().trim());
        
        this.desiredColumns.forEach(desiredName => {
            if(!desiredName) return;
            const target = String(desiredName).toLowerCase().trim();
            
            const idx = excelHeadersLower.findIndex(h => {
                // Si la celda del header está vacía, no es coincidencia
                if (!h) return false;
                
                // Coincidencia Exacta
                if (h === target) return true;
                
                // Lógica Fuzzy para "Nº aut." (Variaciones comunes)
                if (target.includes('aut.')) {
                    return h.includes('aut') && (h.includes('n') || h.includes('#'));
                }
                
                // Lógica Fuzzy para "Depósitos" (Tildes o abreviaturas)
                if (target.includes('depós')) {
                    return h.includes('dep') && h.includes('adic') === target.includes('adic');
                }
                
                return false;
            });
            colMap[desiredName] = idx;
        });

        console.log("TSD Column Mapping:", colMap); // Para depuración

        // Validaciones críticas
        if (colMap['Nº contrato'] === -1) return alert("Falta columna: Nº contrato");
        if (colMap['Monto'] === -1) return alert("Falta columna: Monto");
        // Si no encuentra Auth, advertir pero no bloquear (para que cargue al menos lo demás)
        if (colMap['Nº aut.'] === -1) console.warn("Advertencia: No se detectó columna 'Nº aut.'");

        const cleanData = [];
        let totalTSD = 0;

        // 3. Procesar Filas (Saltando header)
        for(let i = headerIdx + 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            if(!row || row.length === 0) continue;

            const firstCell = String(row[0]||'').toLowerCase();
            if(firstCell.includes('total general') || firstCell.includes('nota :')) break;

            const idxNombre = colMap['Nombre'];
            const idxMonto = colMap['Monto'];
            const idxAuth = colMap['Nº aut.']; 
            
            const nombre = row[idxNombre];
            const rawMonto = row[idxMonto];

            // FILTRO: Ignorar filas sin nombre (subtotales)
            if (!nombre || String(nombre).trim() === '') continue;

            // Limpieza de Monto
            let m = 0;
            if (typeof rawMonto === 'number') {
                m = rawMonto;
            } else if (typeof rawMonto === 'string') {
                let clean = rawMonto.replace(/\s/g, '').replace(',', '.');
                m = parseFloat(clean) || 0;
            }

            if (m === 0) continue; 

            totalTSD += m;

            // EXTRACCIÓN ROBUSTA DE AUTORIZACIÓN
            let auth = '';
            // Si encontramos la columna
            if (idxAuth !== -1) {
                const val = row[idxAuth];
                if (val !== undefined && val !== null) {
                    // Convertir a string, trim, y limpiar todo lo que no sea alfanumérico
                    // (Ojo: Si hay guiones o puntos en la autorización real, adecuar regex)
                    auth = String(val).trim().replace(/[^a-zA-Z0-9]/g, '');
                }
            }

            const rowObj = {
                _enabled: true,
                _auth: auth,
                _monto_usd: m,
                _monto: m,
                _contrato: row[colMap['Nº contrato']], 
                _tipo: row[colMap['Tipo']],           
            };

            // Mapeo Secuencial para el PopUp
            this.desiredColumns.forEach((colName, seqIdx) => {
                const excelIdx = colMap[colName];
                let val = '';
                
                if (excelIdx !== -1) {
                    val = row[excelIdx];
                    if (['Monto', 'Depós.', 'Venta ctdo', 'Reembolso'].includes(colName) && typeof val === 'string') {
                        val = parseFloat(val.replace(/\s/g, '').replace(',', '.')) || 0;
                    }
                }
                rowObj[String(seqIdx)] = val;
            });

            cleanData.push(rowObj);
        }

        // 4. Guardar en Estado Global
        this.data.tsd = cleanData;
        
        // CORRECCIÓN CRÍTICA: Inicializar headers si no existen
        this.data.headers = this.data.headers || {};
        this.data.headers.tsd = this.desiredColumns;
        
        document.getElementById('tsd-total').innerText = this.formatMoney(totalTSD);
        document.getElementById('card-tsd').classList.remove('hidden');
        
        const drop = document.getElementById('drop-tsd');
        if(drop) {
            const st = document.getElementById('status-tsd');
            if(st) { 
                st.innerText = `${cleanData.length} filas`; 
                st.classList.remove('hidden'); 
                st.classList.add('text-purple-600'); 
            }
            drop.classList.remove('border-slate-300', 'hover:border-purple-500');
            drop.classList.add('border-purple-500', 'bg-purple-50', 'dark:bg-purple-900/20');
        }

        if(this.switchTab) this.switchTab('tsd');
        this.runMatchTSD();
    },

    runMatchTSD: function() {
        if(!this.data.tsd || !this.data.tsd.length) return;

        const tcInput = document.getElementById('tsd-exchange-rate');
        const tc = parseFloat(tcInput ? tcInput.value : 1); 

        this.data.tsd.forEach(r => {
            if(tc !== 1) r._monto = r._monto_usd * tc;
            else r._monto = r._monto_usd; 
        });

        // 3. Crear Índice Maestro de Bancos (Auth -> Data)
        const bankIndex = {}; 

        // A. Indexar BAC (Monto Venta Bruta)
        if(this.data.detalle && this.data.detalle.length) {
            const h = this.data.headers.detalle || [];
            // Buscar columna "Autorización" o "Referencia"
            let iAuth = h.findIndex(s => s && s.toLowerCase().match(/autoriza|referencia/));
            if (iAuth === -1) iAuth = 11; // Fallback col 11

            this.data.detalle.forEach(r => {
                if(r._enabled) {
                    const rawVal = r._raw ? r._raw[iAuth] : r[String(iAuth)];
                    // Limpieza de Autorización (Eliminar espacios, guiones, puntos)
                    const auth = String(rawVal || '').trim().replace(/[^a-zA-Z0-9]/g, '');
                    
                    // CORRECCIÓN: Usar Monto Venta (r._venta) en lugar de Neto (r._neto)
                    if(auth) bankIndex[auth] = { bank: 'BAC', monto: r._venta }; 
                }
            });
        }

        // B. Indexar Scotia (Monto Original Bruto)
        if(this.data.scotia_detalle && this.data.scotia_detalle.length) {
            const h = this.data.headers.scotia_detalle || [];
            const iAuth = h.findIndex(s => s && s.toLowerCase().includes('autoriza')); 
            
            // Buscar columna "Monto Bruto" o "Monto Original"
            const iMontoBruto = h.findIndex(s => s && s.toLowerCase().match(/bruto|original/));
            
            this.data.scotia_detalle.forEach(r => {
                if(r._enabled) {
                    const authVal = r[String(iAuth)];
                    const auth = String(authVal || '').trim().replace(/[^a-zA-Z0-9]/g, '');
                    
                    // CORRECCIÓN: Usar Monto Bruto (r._bruto o columna específica)
                    // Si _bruto no existe pre-calculado, lo leemos del array original
                    let montoBruto = r._bruto; 
                    if (montoBruto === undefined && iMontoBruto !== -1) {
                         montoBruto = parseFloat(String(r[String(iMontoBruto)]).replace(/[^0-9.-]/g, '')) || 0;
                    }
                    // Fallback: Si no hay Bruto, usar Neto (aunque la regla dice Bruto)
                    if (montoBruto === undefined) montoBruto = Math.abs(r._neto); // Asumimos Neto si falla Bruto

                    if(auth) bankIndex[auth] = { bank: 'Scotia', monto: montoBruto };
                }
            });
        }

        const hasBanks = Object.keys(bankIndex).length > 0;
        const tableData = [];
        let matchBac = 0, matchScotia = 0, unmatched = 0;

        this.data.tsd.forEach(r => {
            if(!r._enabled) return; 

            const auth = r._auth;
            const match = bankIndex[auth]; 
            
            if (hasBanks && !match) {
                unmatched += r._monto;
                return;
            }

            let estado = 'Pendiente';
            let diff = r._monto;
            let banco = '-';
            let montoBanco = 0;

            if(match) {
                banco = match.bank;
                montoBanco = match.monto;
                diff = r._monto - montoBanco;
                
                if(Math.abs(diff) < 5) estado = 'Conciliado';
                else estado = 'Diferencia';

                if(banco === 'BAC') matchBac += r._monto;
                else matchScotia += r._monto;
            } else {
                unmatched += r._monto;
            }

            tableData.push({
                contrato: r._contrato,
                tipo: r._tipo,
                auth: auth,
                monto_tsd: r._monto,
                banco: banco,
                monto_banco: montoBanco,
                diff: diff,
                estado: estado
            });
        });

        const columns = [
            { title: "Contrato", field: "contrato", headerFilter: true, width: 120 },
            { title: "Tipo", field: "tipo", headerFilter: true, width: 60, hozAlign: "center" },
            { title: "Autorización", field: "auth", headerFilter: true, width: 100 },
            { title: "Monto TSD", field: "monto_tsd", hozAlign:"right", formatter: "money", bottomCalc: "sum" },
            { title: "Banco", field: "banco", headerFilter: true, width: 80, hozAlign: "center" },
            { title: "Monto Banco", field: "monto_banco", hozAlign:"right", formatter: "money", bottomCalc: "sum" },
            { title: "Diferencia", field: "diff", hozAlign:"right", formatter: "money", bottomCalc: "sum" },
            { title: "Estado", field: "estado", headerFilter: true, width: 100, hozAlign: "center",
              formatter: (cell) => {
                  const v = cell.getValue();
                  if(v === 'Conciliado') return `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">OK</span>`;
                  if(v === 'Diferencia') return `<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">DIF</span>`;
                  return `<span class="text-slate-400 text-[10px]">Pendiente</span>`;
              }
            }
        ];

        if (this.grids.tsd) {
            this.grids.tsd.updateData(tableData);
        } else {
            this.grids.tsd = new VanillaGrid("#table-result-tsd", tableData, columns, {
                searchInputId: "search-tsd"
            });
        }

        document.getElementById('tsd-match-bac').innerText = this.formatMoney(matchBac);
        document.getElementById('tsd-match-scotia').innerText = this.formatMoney(matchScotia);
        document.getElementById('tsd-unmatched').innerText = this.formatMoney(unmatched);
    }

    
};

