window.TSDLogic = {
    lastTSD: [],
    lastBancos: [],
    blacklist: [], 
    manualMatches: [], 
    ws: { tsd: [], bancos: [], originalTsd: [], originalBancos: [], rowUid: null, isAutoMatch: false }, // Workspace State
    gridMatched: null,
    gridPending: null,

    init: function() {
        console.log("🚀 Módulo TSD Inicializado");
        
        if(this.gridMatched) { if (typeof this.gridMatched.destroy === 'function') this.gridMatched.destroy(); this.gridMatched = null; }
        if(this.gridPending) { if (typeof this.gridPending.destroy === 'function') this.gridPending.destroy(); this.gridPending = null; }
        
        this.blacklist = []; // Reiniciar blacklist al entrar
        
        if (window.flatpickr) {
            flatpickr("#tsd-date-picker", {
                mode: "range",
                dateFormat: "Y-m-d",
                locale: "es", 
                defaultDate: [new Date(), new Date()]
            });
        }
    },

    updateThreshold: function() {
        if (this.gridMatched && typeof this.gridMatched.render === 'function') this.gridMatched.render();
        if (this.gridPending && typeof this.gridPending.render === 'function') this.gridPending.render();
    },

    openRawViewer: function() {
        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas para consultar TSD.");

        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) {
            [start, end] = dateVal.split(' a ');
        }
        
        const width = 1200;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(`visor_crudos.php?start=${start}&end=${end}`, 'VisorCrudosIRI', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
    },

    fetchAndMatch: async function() {
        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas válido.");

        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) {
            [start, end] = dateVal.split(' a ');
        }

        const btn = document.getElementById('btn-run-match');
        const gridContainer = document.getElementById('table-result-tsd');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Consultando BD...';
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');

        const containerMatched = document.getElementById('table-matched-tsd');
        const containerPending = document.getElementById('table-pending-tsd');
        
        if (containerMatched && containerPending) {
            if(this.gridMatched) { if(typeof this.gridMatched.destroy === 'function') this.gridMatched.destroy(); this.gridMatched = null; }
            if(this.gridPending) { if(typeof this.gridPending.destroy === 'function') this.gridPending.destroy(); this.gridPending = null; }
            
            containerMatched.innerHTML = `
                <div class="absolute inset-0 flex flex-col items-center justify-center text-blue-500 w-full bg-slate-50/50 dark:bg-slate-900/50 z-10">
                    <svg class="animate-spin h-10 w-10 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span class="font-bold">Extrayendo datos...</span>
                </div>
            `;
            containerPending.innerHTML = '';
        }

        try {
            const res = await fetch(`api/get_cruce_m3.php?start=${start}&end=${end}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            // Inyectamos un _id único a la data cruda para poder rastrear qué añade/quita el usuario en el modal
            this.lastTSD = json.tsd.map((t, i) => { t._id = 't_' + i; return t; });
            this.lastBancos = json.bancos.map((b, i) => { b._id = 'b_' + i; return b; });

            // Limpiamos los manual matches de sesiones anteriores
            this.manualMatches = [];
            this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);

        } catch (error) {
            console.error(error);
            window.SysUI.alert("Error al obtener datos: " + error.message, "Fallo de Conexión", "error");
            if (gridContainer) {
                gridContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-red-400 gap-2 opacity-50">
                        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="text-sm font-medium">Error de consulta. Inténtelo nuevamente.</span>
                    </div>
                `;
            }
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    },

    openCardModal: function() {
        document.getElementById('paste-zone-cards').value = '';
        document.getElementById('status-cards-paste').classList.add('hidden');
        document.getElementById('modal-cards-tsd').classList.remove('hidden');
    },

    processCardPaste: async function() {
        const text = document.getElementById('paste-zone-cards').value;
        if (!text.trim()) return window.SysUI.alert("El área de texto está vacía.");

        const rows = text.split('\n');
        const tarjetas = [];

        rows.forEach(r => {
            const cols = r.split('\t'); 
            if (cols.length >= 2) {
                const contrato = String(cols[0]).trim();
                const tarjetaCruda = String(cols[1]).trim().replace(/[^a-zA-Z0-9]/g, '');
                
                if (contrato !== '' && tarjetaCruda !== '') {
                    const tarjeta4 = tarjetaCruda.slice(-4);
                    tarjetas.push({ contrato: contrato, tarjeta: tarjeta4 });
                }
            }
        });

        if (tarjetas.length === 0) return window.SysUI.alert("No se detectó un formato válido (Contrato \t Tarjeta).");

        const btn = document.querySelector('#modal-cards-tsd button[onclick="window.TSDLogic.processCardPaste()"]');
        const statusEl = document.getElementById('status-cards-paste');
        const originalText = btn ? btn.innerHTML : 'Guardar en Base de Datos';
        
        if (btn) {
            btn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Guardando...';
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
        }
        
        statusEl.innerHTML = `<span class="animate-pulse">Procesando ${tarjetas.length} registros. Por favor, espere...</span>`;
        statusEl.classList.remove('hidden');

        try {
            const res = await fetch('api/save_tarjetas_m3.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tarjetas: tarjetas })
            });
            const data = await res.json();
            
            if(data.success) {
                document.getElementById('modal-cards-tsd').classList.add('hidden');
                await window.SysUI.alert(`Se guardaron ${data.filas} tarjetas en el Historial con éxito.\n\nPor favor, presione "Ejecutar Cruce" nuevamente para aplicar los cambios a la tabla.`, "Ingesta Exitosa", "success");
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            window.SysUI.alert("Error: " + error.message, "Fallo al Guardar", "error");
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
            statusEl.classList.add('hidden');
        }
    },

    runMatchingAlgorithm: function(tsdData, bancosData) {
        console.log(`🧠 Ejecutando Algoritmo Multi-Match: ${tsdData.length} TSD vs ${bancosData.length} Bancos`);

        const gridData = [];
        let bancosDisponibles = [...bancosData]; 
        let pendientesTSD = [...tsdData]; 

        // Arreglos de blindaje: Aquí guardaremos la cédula (_id) de cada registro que logre hacer match
        const procesadosTSDIds = [];
        const procesadosBancosIds = [];

        const cleanStr = (str) => String(str || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const isBlacklisted = (knum, idTrans) => this.blacklist.includes(String(knum).trim() + '|' + String(idTrans).trim());
        const isSameMonto = (m1, m2) => Math.abs(parseFloat(m1) - parseFloat(m2)) < 2; 

        const processMatch = (tsdRow, bancoRow, matchType) => {
            const tsdArr = Array.isArray(tsdRow) ? tsdRow : [tsdRow];
            const bancoArr = Array.isArray(bancoRow) ? bancoRow : [bancoRow];
            
            // TRACKING ABSOLUTO: Anotamos los IDs procesados para el Rescate Final de Huérfanos
            tsdArr.forEach(t => procesadosTSDIds.push(t._id));
            bancoArr.forEach(b => procesadosBancosIds.push(b._id));

            // VALIDACIÓN ESTRICTA: Solo es "Múltiple" si de verdad hay más de 1 registro de algún lado
            const isMulti = tsdArr.length > 1 || bancoArr.length > 1;

            let finalMatchType = matchType;
            if (!isMulti) {
                if (matchType.includes('Auth Grupal')) finalMatchType = matchType.includes('Monto') ? 'Auth + Monto' : 'Auth Solo';
                if (matchType.includes('Tarjeta Grupal')) finalMatchType = matchType.includes('Monto') ? 'Tarjeta + Monto' : 'Tarjeta Solo';
            }

            const montoTSD = tsdArr.reduce((acc, curr) => acc + (parseFloat(curr.MontoCRC) || 0), 0);
            const montoBanco = bancoArr.reduce((acc, curr) => acc + (parseFloat(curr.Monto_Venta_Original) || 0), 0);
            const isNegative = montoTSD < 0;

            let bgColorClass = 'bg-[#fce4d6] dark:bg-[#7c6f69] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800'; 
            if (finalMatchType.includes('Tarjeta')) bgColorClass = 'bg-[#ddebf7] dark:bg-[#1e3a8a] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800'; 
            if (finalMatchType.includes('Sugerencia')) bgColorClass = 'bg-[#fef08a] dark:bg-[#854d0e] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800'; 
            if (finalMatchType === 'Manual') bgColorClass = 'bg-[#ffe699] dark:bg-[#b2a06b] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800 font-bold'; 
            if (isNegative) bgColorClass = 'bg-[#d9d9d9] dark:bg-[#262626] text-slate-900 dark:text-slate-300 border-b border-slate-400 dark:border-slate-900 font-bold';

            const contratoRep = isMulti ? `Varios (${tsdArr.length} registros)` : tsdArr[0].Contrato;
            const clienteRep = isMulti ? `Agrupación Múltiple (Doble clic para ver)` : tsdArr[0].Cliente;
            const authTSDRep = isMulti ? tsdArr[0].Autorizacion : tsdArr[0].Autorizacion;
            
            const tarjetaLimpia = cleanStr(tsdArr[0].Tarjeta_Ultimos4);
            const tarjetaRep = isMulti ? `****${tarjetaLimpia.slice(-4)}` : (tarjetaLimpia.length >= 4 ? `****${tarjetaLimpia.slice(-4)}` : 'S/D');
            
            const bancoRep = isMulti ? (bancoArr.length > 1 ? `Múltiples Bancos` : bancoArr[0].Banco) : bancoArr[0].Banco;
            const authBancoRep = isMulti ? bancoArr[0].Numero_Autorizacion : bancoArr[0].Numero_Autorizacion;

            gridData.push({
                _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                _tsdRaw: isMulti ? tsdArr : tsdArr[0], 
                _bancoRaw: isMulti ? bancoArr : bancoArr[0],
                _isMulti: isMulti,
                _rowClass: bgColorClass,
                Contrato: contratoRep,
                Cliente: clienteRep,
                TarjetaTSD: tarjetaRep,
                Autorizacion: authTSDRep,
                MontoTSD: montoTSD, 
                EstadoMatch: finalMatchType, 
                Banco_Nombre: bancoRep,
                Banco_Auth: authBancoRep,
                Banco_Monto: montoBanco, 
                Diferencia: montoTSD - montoBanco
            });
        };

        // --- FASE 0: CONCILIACIONES MANUALES DEL USUARIO ---
        this.manualMatches.forEach(mMatch => {
            const arrT = pendientesTSD.filter(t => mMatch.tsdArr.some(x => x._id === t._id));
            const arrB = bancosDisponibles.filter(b => mMatch.bancoArr.some(x => x._id === b._id));
            
            if (arrT.length > 0 || arrB.length > 0) {
                processMatch(arrT, arrB, 'Manual');
            }
            
            pendientesTSD = pendientesTSD.filter(t => !mMatch.tsdArr.some(x => x._id === t._id));
            bancosDisponibles = bancosDisponibles.filter(b => !mMatch.bancoArr.some(x => x._id === b._id));
        });

        // Guardamos la foto inicial limpia de lo extraído de la BD
        const blindajeTSD = [...tsdData]; 
        const blindajeBancos = [...bancosData];

        // --- FASE 1: 1 a 1 AUTH + MONTO (Confianza Máxima) ---
        let nextTSD = [];
        pendientesTSD.forEach(tsdRow => {
            const authTSD = cleanStr(tsdRow.Autorizacion);
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            let matchIdx = -1;
            if (authTSD !== '' && authTSD !== '0' && authTSD !== '000000') {
                matchIdx = bancosDisponibles.findIndex(b => cleanStr(b.Numero_Autorizacion) === authTSD && isSameMonto(b.Monto_Venta_Original, montoTSD) && !isBlacklisted(tsdRow.Contrato, b.IdTransaccion));
            }
            if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], 'Auth + Monto');
            else nextTSD.push(tsdRow);
        });
        pendientesTSD = nextTSD;

        const groupByAuthTSD = {};
        pendientesTSD.forEach(r => {
            const a = cleanStr(r.Autorizacion);
            if(a && a!=='0' && a!=='000000') { groupByAuthTSD[a] = groupByAuthTSD[a] || []; groupByAuthTSD[a].push(r); }
        });
        const groupByAuthBanco = {};
        bancosDisponibles.forEach(r => {
            const a = cleanStr(r.Numero_Autorizacion);
            if(a && a!=='0' && a!=='000000') { groupByAuthBanco[a] = groupByAuthBanco[a] || []; groupByAuthBanco[a].push(r); }
        });

        for (const auth in groupByAuthTSD) {
            if (groupByAuthBanco[auth]) {
                const arrT = groupByAuthTSD[auth];
                const arrB = groupByAuthBanco[auth];
                let hasBlacklist = arrT.some(t => arrB.some(b => isBlacklisted(t.Contrato, b.IdTransaccion)));
                if (!hasBlacklist) {
                    const sumT = arrT.reduce((acc, curr) => acc + (parseFloat(curr.MontoCRC) || 0), 0);
                    const sumB = arrB.reduce((acc, curr) => acc + (parseFloat(curr.Monto_Venta_Original) || 0), 0);
                    const mType = isSameMonto(sumT, sumB) ? 'Auth Grupal + Monto' : 'Auth Grupal Solo';
                    processMatch(arrT, arrB, mType);
                    pendientesTSD = pendientesTSD.filter(t => !arrT.includes(t));
                    bancosDisponibles = bancosDisponibles.filter(b => !arrB.includes(b));
                }
            }
        }

        nextTSD = [];
        pendientesTSD.forEach(tsdRow => {
            const tSegura = cleanStr(tsdRow.Tarjeta_Ultimos4).slice(-4);
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            let matchIdx = -1;
            if (tSegura !== '' && tSegura.length === 4) {
                matchIdx = bancosDisponibles.findIndex(b => cleanStr(b.Tarjeta_Ultimos4).slice(-4) === tSegura && isSameMonto(b.Monto_Venta_Original, montoTSD) && !isBlacklisted(tsdRow.Contrato, b.IdTransaccion));
            }
            if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], 'Tarjeta + Monto');
            else nextTSD.push(tsdRow);
        });
        pendientesTSD = nextTSD;

        const groupByCardTSD = {};
        pendientesTSD.forEach(r => {
            const c = cleanStr(r.Tarjeta_Ultimos4).slice(-4);
            if(c && c.length === 4) { groupByCardTSD[c] = groupByCardTSD[c] || []; groupByCardTSD[c].push(r); }
        });
        const groupByCardBanco = {};
        bancosDisponibles.forEach(r => {
            const c = cleanStr(r.Tarjeta_Ultimos4).slice(-4);
            if(c && c.length === 4) { groupByCardBanco[c] = groupByCardBanco[c] || []; groupByCardBanco[c].push(r); }
        });

        for (const card in groupByCardTSD) {
            if (groupByCardBanco[card]) {
                const arrT = groupByCardTSD[card];
                const arrB = groupByCardBanco[card];
                let hasBlacklist = arrT.some(t => arrB.some(b => isBlacklisted(t.Contrato, b.IdTransaccion)));
                if (!hasBlacklist) {
                    const sumT = arrT.reduce((acc, curr) => acc + (parseFloat(curr.MontoCRC) || 0), 0);
                    const sumB = arrB.reduce((acc, curr) => acc + (parseFloat(curr.Monto_Venta_Original) || 0), 0);
                    const mType = isSameMonto(sumT, sumB) ? 'Tarjeta Grupal + Monto' : 'Tarjeta Grupal Solo';
                    processMatch(arrT, arrB, mType);
                    pendientesTSD = pendientesTSD.filter(t => !arrT.includes(t));
                    bancosDisponibles = bancosDisponibles.filter(b => !arrB.includes(b));
                }
            }
        }

        nextTSD = [];
        pendientesTSD.forEach(tsdRow => {
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            let matchIdx = -1;
            if (Math.abs(montoTSD) > 0) { 
                matchIdx = bancosDisponibles.findIndex(b => isSameMonto(b.Monto_Venta_Original, montoTSD) && !isBlacklisted(tsdRow.Contrato, b.IdTransaccion));
            }
            if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], 'Sugerencia (Monto)');
            else nextTSD.push(tsdRow);
        });
        pendientesTSD = nextTSD;

        // --- FASE FINAL: RESCATE ABSOLUTO DE HUÉRFANOS ---
        // Todo lo que estaba en el blindaje inicial y NO fue anotado en `procesadosTSDIds` es huérfano.
        blindajeTSD.forEach(tsdRow => {
            if (!procesadosTSDIds.includes(tsdRow._id)) {
                const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
                const tSegura = cleanStr(tsdRow.Tarjeta_Ultimos4).slice(-4);
                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                    _tsdRaw: tsdRow, _bancoRaw: null, _rowClass: '', _isMulti: false,
                    Contrato: tsdRow.Contrato, Cliente: tsdRow.Cliente,
                    TarjetaTSD: tSegura !== '' ? `****${tSegura}` : 'S/D',
                    Autorizacion: tsdRow.Autorizacion, MontoTSD: montoTSD,
                    EstadoMatch: 'Pendiente', Banco_Nombre: '-', Banco_Auth: '-', Banco_Monto: 0, Diferencia: montoTSD
                });
            }
        });

        blindajeBancos.forEach(b => {
            if (!procesadosBancosIds.includes(b._id)) {
                const m = parseFloat(b.Monto_Venta_Original);
                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                    _tsdRaw: null, _bancoRaw: b, _isMulti: false,
                    _rowClass: 'text-slate-500 italic border-b border-slate-100 dark:border-slate-800',
                    Contrato: 'Solo Banco', Cliente: b.Nombre_Sucursal_Comercio,
                    TarjetaTSD: b.Tarjeta_Ultimos4 ? `****${b.Tarjeta_Ultimos4}` : 'S/D',
                    Autorizacion: '-', MontoTSD: 0,
                    EstadoMatch: 'Sobrante', Banco_Nombre: b.Banco, Banco_Auth: b.Numero_Autorizacion, Banco_Monto: m, Diferencia: 0 - m
                });
            }
        });

        gridData.sort((a, b) => {
            const getWeight = (row) => {
                if (row.EstadoMatch === 'Manual') return 0; // Manuales SIEMPRE arriba
                const isNegative = row.MontoTSD < 0 || row.Banco_Monto < 0;
                if (isNegative && row.EstadoMatch !== 'Pendiente' && row.EstadoMatch !== 'Sobrante') return 6; 
                if (row.EstadoMatch.includes('Auth')) return 1;
                if (row.EstadoMatch.includes('Tarjeta')) return 3;
                if (row.EstadoMatch.includes('Sugerencia')) return 5;
                return 7;
            };
            const weightA = getWeight(a), weightB = getWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            return String(a.Contrato).localeCompare(String(b.Contrato));
        });

        this.currentGridData = gridData;
        this.renderGrid(gridData);
    },

    renderGrid: function(data) {
        const matchedData = data.filter(r => r.EstadoMatch !== 'Pendiente' && r.EstadoMatch !== 'Sobrante');
        const pendingData = data.filter(r => r.EstadoMatch === 'Pendiente' || r.EstadoMatch === 'Sobrante');
        
        const fmtMoney = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v || 0).replace(/\./g, ' ');

        const columns = [
            { 
                title: "Contrato (TSD)", field: "Contrato", width: 140, headerFilter: true, 
                cssClass: "font-mono font-bold",
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    return val.includes('Varios') ? `<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">🔗 ${val}</span>` : val;
                }
            },
            { title: "Cliente", field: "Cliente", headerFilter: true, width: 220, cssClass: "truncate text-[10px]" },
            { title: "Tarjeta", field: "TarjetaTSD", width: 80, cssClass: "font-mono text-slate-500", hozAlign: "center" },
            { title: "Auth (TSD)", field: "Autorizacion", headerFilter: true, width: 90, cssClass: "font-mono", hozAlign: "center" },
            { title: "Monto", field: "MontoTSD", hozAlign: "right", formatter: "money", bottomCalc: "sum", bottomCalcFormatter: "money", cssClass: "font-bold" },
            
            { 
                title: "STATUS CRUCE", field: "EstadoMatch", headerFilter: true, width: 160, hozAlign: "center",
                cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-white/30 dark:bg-black/20 font-bold shadow-inner cursor-pointer",
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    if(val === 'Manual') return '<span class="text-amber-900 dark:text-amber-100 uppercase tracking-widest text-[10px]">🛠️ Manual</span>';
                    if(val === 'Auth + Monto') return '✔️ Auth+Monto';
                    if(val === 'Auth Grupal + Monto' || val === 'Auth Grupal Solo') return '<span class="text-blue-600 dark:text-blue-400">🔗 Auth Grupal</span>';
                    if(val === 'Auth Solo') return '✔️ Auth Solo';
                    if(val === 'Tarjeta + Monto') return '💳 Tarjeta+Monto';
                    if(val === 'Tarjeta Grupal + Monto' || val === 'Tarjeta Grupal Solo') return '<span class="text-blue-600 dark:text-blue-400">🔗 Tarjeta Grupal</span>';
                    if(val === 'Tarjeta Solo') return '💳 Tarjeta Solo';
                    if(val === 'Sugerencia (Monto)') return '<span class="text-amber-600 dark:text-amber-400">⚠️ Sugerencia</span>';
                    if(val === 'Pendiente' || val === 'Sobrante') return '<span class="text-red-500">❌ ' + val + '</span>';
                    return val;
                }
            },
            
            { title: "Banco", field: "Banco_Nombre", width: 100, hozAlign: "center", headerFilter: true, cssClass: "text-blue-700 dark:text-blue-400 font-bold" },
            { title: "Auth (Banco)", field: "Banco_Auth", headerFilter: true, width: 100, cssClass: "font-mono", hozAlign: "center" },
            { title: "Monto", field: "Banco_Monto", hozAlign: "right", formatter: "money", bottomCalc: "sum", bottomCalcFormatter: "money", cssClass: "font-bold" },
            { 
                title: "Diferencia", field: "Diferencia", hozAlign: "right", bottomCalc: "sum", bottomCalcFormatter: "money",
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    const thresholdInput = document.getElementById('tsd-threshold');
                    const threshold = thresholdInput ? Math.abs(parseFloat(thresholdInput.value)) || 0 : 10000;
                    
                    if (Math.abs(val) >= threshold) {
                        return `<span class="text-red-700 dark:text-red-300 font-black bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded shadow-sm border border-red-200 dark:border-red-800 text-sm">${fmtMoney(val)}</span>`;
                    }
                    return `<span class="font-bold bg-white/40 dark:bg-black/30 px-2 py-0.5 rounded text-sm">${fmtMoney(val)}</span>`;
                }
            }
        ];

        if (this.gridMatched) this.gridMatched.updateData(matchedData);
        else this.gridMatched = new VanillaGrid("#table-matched-tsd", matchedData, columns, { searchInputId: "search-tsd", threshold: 0, onRowDblClick: (row) => window.TSDLogic.openTransactionModal(row) });

        if (this.gridPending) this.gridPending.updateData(pendingData);
        else this.gridPending = new VanillaGrid("#table-pending-tsd", pendingData, columns, { searchInputId: "search-tsd", threshold: 0, onRowDblClick: (row) => window.TSDLogic.openTransactionModal(row) });
    },

    openTransactionModal: function(row) {
        if (!row) return;

        // 1. Preparar el Estado en el Workspace (Padre)
        const tRaw = row._tsdRaw ? (Array.isArray(row._tsdRaw) ? [...row._tsdRaw] : [row._tsdRaw]) : [];
        const bRaw = row._bancoRaw ? (Array.isArray(row._bancoRaw) ? [...row._bancoRaw] : [row._bancoRaw]) : [];
        
        this.ws = {
            tsd: [...tRaw], bancos: [...bRaw],
            originalTsd: [...tRaw], originalBancos: [...bRaw],
            rowUid: row._uid,
            isAutoMatch: row.EstadoMatch !== 'Pendiente' && row.EstadoMatch !== 'Sobrante' && row.EstadoMatch !== 'Manual'
        };

        // 2. Preparar los CSS de Tailwind (Usamos el script de CDN para el popup hijo)
        const isDark = document.documentElement.classList.contains('dark');
        
        // 3. Crear la Ventana Hija (PopUp Nativo del SO)
        const width = 1100;
        const height = 750;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        // Si ya hay una abierta, la cerramos
        if (this.wsWindow && !this.wsWindow.closed) this.wsWindow.close();
        
        this.wsWindow = window.open('', 'TSDEstacionManual', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
        
        // 4. Inyectar el Documento (HTML + Lógica Hija)
        const html = `
        <!DOCTYPE html>
        <html lang="es" class="${isDark ? 'dark' : ''}">
        <head>
            <meta charset="UTF-8">
            <title>Estación de Trabajo Manual - TSD</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <script>tailwind.config = { darkMode: 'class' };</script>
            <style>
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
                .dark ::-webkit-scrollbar-thumb { background-color: #475569; }
            </style>
        </head>
        <body class="bg-slate-100 dark:bg-slate-900 h-screen w-screen flex flex-col font-sans overflow-hidden">
            
            <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex justify-between items-center shrink-0 shadow-sm">
                <h2 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <span class="p-1.5 bg-amber-100 text-amber-700 rounded-lg">🛠️</span> Estación Manual
                </h2>
                <div class="flex items-center gap-6">
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Diferencia Neta</span>
                        <span id="ws-diff" class="text-2xl font-mono font-black">0.00</span>
                    </div>
                    <button onclick="saveAndClose()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all text-sm flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        Guardar Cambios
                    </button>
                </div>
            </header>

            <main class="flex-1 flex gap-4 p-4 overflow-hidden h-full">
                <!-- PANEL IZQUIERDO: TSD -->
                <div class="flex-1 flex flex-col gap-2 overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 flex justify-between items-center shrink-0">
                        <h3 class="font-black text-purple-700 dark:text-purple-400 text-xs tracking-wider">VINCULADOS A TSD</h3>
                        <span class="text-[10px] font-bold text-slate-400" id="ws-count-tsd">0</span>
                    </div>
                    <div class="h-[40%] overflow-auto p-2 space-y-1.5" id="ws-sel-tsd"></div>
                    <div class="bg-purple-50 dark:bg-purple-900/20 border-y border-purple-200 dark:border-purple-800 p-1.5 shrink-0 relative">
                        <input type="text" id="ws-search-tsd" oninput="renderUI()" placeholder="Buscar sobrantes en TSD (Contrato, Auth, Tarjeta, Monto)..." class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-800 dark:text-slate-200">
                        <span class="absolute left-3 top-2.5 text-purple-400 text-sm">🔍</span>
                    </div>
                    <div class="flex-1 overflow-auto p-2 bg-slate-50/50 dark:bg-slate-900/30" id="ws-sug-tsd"></div>
                </div>
                
                <!-- PANEL DERECHO: BANCOS -->
                <div class="flex-1 flex flex-col gap-2 overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 flex justify-between items-center shrink-0">
                        <h3 class="font-black text-blue-700 dark:text-blue-400 text-xs tracking-wider">VINCULADOS A BANCOS</h3>
                        <span class="text-[10px] font-bold text-slate-400" id="ws-count-bancos">0</span>
                    </div>
                    <div class="h-[40%] overflow-auto p-2 space-y-1.5" id="ws-sel-bancos"></div>
                    <div class="bg-blue-50 dark:bg-blue-900/20 border-y border-blue-200 dark:border-blue-800 p-1.5 shrink-0 relative">
                        <input type="text" id="ws-search-banco" oninput="renderUI()" placeholder="Buscar sobrantes en Banco (Auth, Tarjeta, Monto)..." class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 dark:text-slate-200">
                        <span class="absolute left-3 top-2.5 text-blue-400 text-sm">🔍</span>
                    </div>
                    <div class="flex-1 overflow-auto p-2 bg-slate-50/50 dark:bg-slate-900/30" id="ws-sug-bancos"></div>
                </div>
            </main>

            <script>
                const parentLogic = window.opener.TSDLogic;
                const fmt = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v).replace(/\\./g, ' ');
                const clean = (s) => String(s||'').toLowerCase().trim();

                // Inicializar datos estáticos desde el padre
                const allPendientesT = parentLogic.currentGridData.filter(r => r.EstadoMatch === 'Pendiente').flatMap(r => Array.isArray(r._tsdRaw) ? r._tsdRaw : [r._tsdRaw]);
                const allPendientesB = parentLogic.currentGridData.filter(r => r.EstadoMatch === 'Sobrante').flatMap(r => Array.isArray(r._bancoRaw) ? r._bancoRaw : [r._bancoRaw]);

                function renderUI() {
                    const ws = parentLogic.ws;
                    
                    const sumT = ws.tsd.reduce((a,c)=>a+(parseFloat(c.MontoCRC)||0), 0);
                    const sumB = ws.bancos.reduce((a,c)=>a+(parseFloat(c.Monto_Venta_Original)||0), 0);
                    const diff = sumT - sumB;
                    
                    const diffEl = document.getElementById('ws-diff');
                    diffEl.innerText = fmt(diff);
                    diffEl.className = \`text-2xl font-mono font-black \${Math.abs(diff) < 2 ? 'text-green-500' : 'text-red-500'}\`;
                    document.getElementById('ws-count-tsd').innerText = \`\${ws.tsd.length} Registros\`;
                    document.getElementById('ws-count-bancos').innerText = \`\${ws.bancos.length} Registros\`;

                    // 1. DIBUJAR SELECCIONADOS (ARRIBA)
                    document.getElementById('ws-sel-tsd').innerHTML = ws.tsd.map(t => \`
                        <div class="flex justify-between items-center p-2 bg-white dark:bg-slate-700 border-l-4 border-purple-500 border-y border-r border-slate-200 dark:border-slate-600 rounded-lg shadow-sm">
                            <div class="flex flex-col"><span class="font-bold text-[11px] font-mono text-slate-800 dark:text-white">\${t.Contrato}</span><span class="text-[10px] text-slate-500">Auth: <b class="text-slate-700 dark:text-slate-300">\${t.Autorizacion||'-'}</b> | ****\${t.Tarjeta_Ultimos4||'S/D'}</span></div>
                            <div class="flex items-center gap-3"><span class="font-mono font-bold text-sm \${t.MontoCRC < 0 ? 'text-red-500':'text-slate-800 dark:text-white'}">\${fmt(t.MontoCRC)}</span><button onclick="parentLogic.wsRemove('tsd', '\${t._id}'); renderUI();" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-0.5 rounded font-black text-lg transition-colors" title="Quitar">&times;</button></div>
                        </div>\`).join('') || '<div class="text-center text-slate-400 text-xs mt-10 italic">Vacío</div>';

                    document.getElementById('ws-sel-bancos').innerHTML = ws.bancos.map(b => \`
                        <div class="flex justify-between items-center p-2 bg-white dark:bg-slate-700 border-l-4 border-blue-500 border-y border-r border-slate-200 dark:border-slate-600 rounded-lg shadow-sm">
                            <div class="flex flex-col"><span class="font-bold text-[11px] text-blue-600 font-mono">\${b.Banco}</span><span class="text-[10px] text-slate-500">Auth: <b class="text-slate-700 dark:text-slate-300">\${b.Numero_Autorizacion||'-'}</b> | ****\${b.Tarjeta_Ultimos4||'S/D'}</span></div>
                            <div class="flex items-center gap-3"><span class="font-mono font-bold text-sm \${b.Monto_Venta_Original < 0 ? 'text-red-500':'text-slate-800 dark:text-white'}">\${fmt(b.Monto_Venta_Original)}</span><button onclick="parentLogic.wsRemove('bancos', '\${b._id}'); renderUI();" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-0.5 rounded font-black text-lg transition-colors" title="Quitar">&times;</button></div>
                        </div>\`).join('') || '<div class="text-center text-slate-400 text-xs mt-10 italic">Vacío</div>';

                    // 2. DIBUJAR SUGERENCIAS (ABAJO)
                    let availableT = allPendientesT.filter(t => !ws.tsd.some(w => w._id === t._id));
                    let availableB = allPendientesB.filter(b => !ws.bancos.some(w => w._id === b._id));

                    const termT = clean(document.getElementById('ws-search-tsd')?.value || '');
                    if (termT) availableT = availableT.filter(t => clean(t.Contrato).includes(termT) || clean(t.Autorizacion).includes(termT) || clean(t.MontoCRC).includes(termT) || clean(t.Tarjeta_Ultimos4).includes(termT));
                    else {
                        const bAuths = ws.bancos.map(b=>b.Numero_Autorizacion).filter(a=>a);
                        const bCards = ws.bancos.map(b=>b.Tarjeta_Ultimos4).filter(c=>c);
                        availableT = availableT.sort((a, b) => {
                            const wA = (bAuths.includes(a.Autorizacion) ? 10 : 0) + (bCards.includes(a.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(a.MontoCRC) - diff) < 2 ? 20 : 0);
                            const wB = (bAuths.includes(b.Autorizacion) ? 10 : 0) + (bCards.includes(b.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(b.MontoCRC) - diff) < 2 ? 20 : 0);
                            return wB - wA; 
                        });
                    }

                    document.getElementById('ws-sug-tsd').innerHTML = availableT.slice(0, 50).map(t => \`
                        <div class="flex justify-between items-center p-2 border-b border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 cursor-pointer transition-colors" onclick="parentLogic.wsAdd('tsd', '\${t._id}'); renderUI();">
                            <div class="flex flex-col"><span class="font-bold text-[10px] text-slate-700 dark:text-slate-200">\${t.Contrato} <span class="text-slate-400 font-normal">(\${t.Cliente})</span></span><span class="text-[9px] text-slate-400 font-mono">Auth: \${t.Autorizacion||'-'} | ****\${t.Tarjeta_Ultimos4||'S/D'}</span></div>
                            <div class="flex items-center gap-2"><span class="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">\${fmt(t.MontoCRC)}</span><span class="bg-purple-100 text-purple-700 rounded px-2 font-bold shadow-sm text-sm">+</span></div>
                        </div>\`).join('') || '<div class="text-center text-slate-400 text-xs mt-4">Sin sugerencias</div>';

                    const termB = clean(document.getElementById('ws-search-banco')?.value || '');
                    if (termB) availableB = availableB.filter(b => clean(b.Numero_Autorizacion).includes(termB) || clean(b.Tarjeta_Ultimos4).includes(termB) || clean(b.Monto_Venta_Original).includes(termB));
                    else {
                        const tAuths = ws.tsd.map(t=>t.Autorizacion).filter(a=>a);
                        const tCards = ws.tsd.map(t=>t.Tarjeta_Ultimos4).filter(c=>c);
                        availableB = availableB.sort((a, b) => {
                            const wA = (tAuths.includes(a.Numero_Autorizacion) ? 10 : 0) + (tCards.includes(a.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(a.Monto_Venta_Original) - sumT) < 2 ? 20 : 0);
                            const wB = (tAuths.includes(b.Numero_Autorizacion) ? 10 : 0) + (tCards.includes(b.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(b.Monto_Venta_Original) - sumT) < 2 ? 20 : 0);
                            return wB - wA;
                        });
                    }

                    document.getElementById('ws-sug-bancos').innerHTML = availableB.slice(0, 50).map(b => \`
                        <div class="flex justify-between items-center p-2 border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer transition-colors" onclick="parentLogic.wsAdd('bancos', '\${b._id}'); renderUI();">
                            <div class="flex flex-col"><span class="font-bold text-[10px] text-blue-600">\${b.Banco} <span class="text-slate-400 font-normal">(\${b.Nombre_Sucursal_Comercio})</span></span><span class="text-[9px] text-slate-400 font-mono">Auth: \${b.Numero_Autorizacion||'-'} | ****\${b.Tarjeta_Ultimos4||'S/D'}</span></div>
                            <div class="flex items-center gap-2"><span class="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">\${fmt(b.Monto_Venta_Original)}</span><span class="bg-blue-100 text-blue-700 rounded px-2 font-bold shadow-sm text-sm">+</span></div>
                        </div>\`).join('') || '<div class="text-center text-slate-400 text-xs mt-4">Sin sugerencias</div>';
                }

                function saveAndClose() {
                    parentLogic.wsSave();
                    window.close();
                }

                document.addEventListener('DOMContentLoaded', renderUI);
            </script>
        </body>
        </html>`;
        
        this.wsWindow.document.write(html);
        this.wsWindow.document.close();
    },

    // Funciones puente llamadas desde la ventana hija
    wsAdd: function(side, id) {
        if (side === 'tsd') this.ws.tsd.push(this.lastTSD.find(t => t._id === id));
        else this.ws.bancos.push(this.lastBancos.find(b => b._id === id));
    },

    wsRemove: function(side, id) {
        if (side === 'tsd') this.ws.tsd = this.ws.tsd.filter(t => t._id !== id);
        else this.ws.bancos = this.ws.bancos.filter(b => b._id !== id);
    },

    wsSave: function() {
        // Regla 1: Blindaje contra Auto-Unión.
        this.ws.originalTsd.forEach(t => {
            this.ws.originalBancos.forEach(b => {
                const key = String(t.Contrato).trim() + '|' + String(b.IdTransaccion).trim();
                if (!this.blacklist.includes(key)) this.blacklist.push(key);
            });
        });
        
        // Regla 2: Destrucción por Contenido (En lugar de por UID).
        // Sin importar si el rowUid cambió, buscaremos en la RAM si alguno de los registros originales de este match 
        // ya estaba metido en una combinación manual anterior, y la destruimos entera.
        const originTsdIds = this.ws.originalTsd.map(t => t._id);
        const originBancoIds = this.ws.originalBancos.map(b => b._id);
        
        this.manualMatches = this.manualMatches.filter(m => {
            // Conservar el match SOLO SI no contiene ninguno de los registros que estamos editando ahorita
            const hasTsdCollision = m.tsdArr.some(t => originTsdIds.includes(t._id));
            const hasBancoCollision = m.bancoArr.some(b => originBancoIds.includes(b._id));
            return !hasTsdCollision && !hasBancoCollision;
        });

        // Regla 3: Evaluación Final del Workspace.
        if (this.ws.tsd.length > 0 && this.ws.bancos.length > 0) {
            // Guardamos el nuevo grupo humano
            this.manualMatches.push({ 
                tsdArr: [...this.ws.tsd], 
                bancoArr: [...this.ws.bancos] 
            });
            if(window.SysUI) window.SysUI.alert("Conciliación manual aplicada. Se fijará al inicio de la tabla en amarillo.", "Éxito", "success");
        } else {
            // Si vació un lado, simplemente no lo agregamos a manualMatches. 
            // Como ya limpiamos los viejos en la Regla 2, la máquina los arrojará a Huérfanos obligatoriamente.
            if(window.SysUI) window.SysUI.alert("Datos desvinculados permanentemente. Reubicados en tabla inferior.", "Separados", "warning");
        }

        // Re-dibujar la tabla principal
        this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
    }
};