window.AuxiliarLogic = {
    lastTSD: [], lastBancos: [], blacklist: [], manualMatches: [],
    gridSug: null, gridLimbo: null,
    currentSugData: [], currentLimboData: [],

    init: function() {
        console.log("⚖️ Módulo Auxiliar Contable (M4) Inicializado");
        if(this.gridSug) { if (typeof this.gridSug.destroy === 'function') this.gridSug.destroy(); this.gridSug = null; }
        if(this.gridLimbo) { if (typeof this.gridLimbo.destroy === 'function') this.gridLimbo.destroy(); this.gridLimbo = null; }
        this.blacklist = [];
        this.manualMatches = [];
        
        // Auto-Extracción al iniciar el módulo
        this.fetchPendientes();
    },

    fetchPendientes: async function() {
        const loader = document.getElementById('m4-loader');
        if (loader) loader.classList.remove('hidden');

        try {
            const res = await fetch(`api/get_pendientes_m4.php`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            this.lastTSD = json.tsd.map((t, i) => { t._id = 't_' + i; return t; });
            this.lastBancos = json.bancos.map((b, i) => { b._id = 'b_' + i; return b; });

            this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
        } catch (error) {
            console.error(error);
            window.SysUI.alert("Error al reconstruir historial: " + error.message, "Fallo", "error");
        } finally {
            if (loader) loader.classList.add('hidden');
        }
    },

    runMatchingAlgorithm: function(tsdData, bancosData) {
        const gridData = [];
        let bancosDisponibles = [...bancosData]; 
        let pendientesTSD = [...tsdData]; 
        const procesadosTSDIds = []; const procesadosBancosIds = [];

        const cleanStr = (str) => String(str || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanAuth = (str) => { const a = cleanStr(str).replace(/^0+/, ''); return a === '' ? null : a; };
        const getCard = (str) => { const c = cleanStr(str).slice(-4); return c.length === 4 ? c : null; };
        const isBlacklisted = (knum, idTrans) => this.blacklist.includes(String(knum).trim() + '|' + String(idTrans).trim());
        const isSameMonto = (m1, m2) => Math.abs(parseFloat(m1) - parseFloat(m2)) < 2; 

        // MOTOR DE DIBUJO (M4: Todo lo automático es sugerencia)
        const processMatch = (tsdRow, bancoRow, reason, justificacion = '') => {
            const tsdArr = Array.isArray(tsdRow) ? tsdRow : [tsdRow];
            const bancoArr = Array.isArray(bancoRow) ? bancoRow : [bancoRow];
            
            tsdArr.forEach(t => procesadosTSDIds.push(t._id));
            bancoArr.forEach(b => procesadosBancosIds.push(b._id));

            const isMulti = tsdArr.length > 1 || bancoArr.length > 1;
            
            // En M4, a menos que sea manual, todo es Sugerencia
            let finalMatchType = reason === 'Manual' ? (justificacion ? `Manual|${justificacion}` : 'Manual') : `Sugerencia: ${reason}`;

            const montoTSD = tsdArr.reduce((acc, curr) => acc + (parseFloat(curr.MontoCRC) || 0), 0);
            const montoBanco = bancoArr.reduce((acc, curr) => acc + (parseFloat(curr.Monto_Venta_Original) || 0), 0);
            
            let bgColorClass = reason === 'Manual' 
                ? 'bg-[#ffe699] dark:bg-[#b2a06b] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800 font-bold'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-b border-amber-200 dark:border-amber-800';

            const contratoRep = isMulti ? `Varios (${tsdArr.length} reg)` : tsdArr[0].Contrato;
            const clienteRep = isMulti ? `Agrupación Múltiple` : tsdArr[0].Cliente; 
            const authTSDRep = isMulti ? tsdArr[0].Autorizacion : tsdArr[0].Autorizacion;
            const tarjetaLimpia = cleanStr(tsdArr[0].Tarjeta_Ultimos4);
            const tarjetaRep = isMulti ? `****${tarjetaLimpia.slice(-4)}` : (tarjetaLimpia.length >= 4 ? `****${tarjetaLimpia.slice(-4)}` : 'S/D');
            const bancoRep = isMulti ? (bancoArr.length > 1 ? `Múltiples Bancos` : bancoArr[0].Banco) : bancoArr[0].Banco;
            const authBancoRep = isMulti ? bancoArr[0].Numero_Autorizacion : bancoArr[0].Numero_Autorizacion;

            gridData.push({
                _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                _tsdRaw: isMulti ? tsdArr : tsdArr[0], _bancoRaw: isMulti ? bancoArr : bancoArr[0], _isMulti: isMulti,
                _rowClass: bgColorClass,
                Contrato: contratoRep, Cliente: clienteRep, TarjetaTSD: tarjetaRep, Autorizacion: authTSDRep,
                MontoTSD: { valor: montoTSD, recibo: isMulti ? '' : (tsdArr[0].Recibo_Detalle || ''), valueOf: function() { return this.valor; }, toString: function() { return this.valor.toString(); } }, 
                EstadoMatch: finalMatchType, Banco_Nombre: bancoRep, Banco_Auth: authBancoRep, Banco_Monto: montoBanco, 
                Diferencia: montoTSD - montoBanco
            });
        };

        // --- FASE 0: MANUALES DEL USUARIO ---
        this.manualMatches.forEach(mMatch => {
            const arrT = pendientesTSD.filter(t => mMatch.tsdArr.some(x => x._id === t._id));
            const arrB = bancosDisponibles.filter(b => mMatch.bancoArr.some(x => x._id === b._id));
            if (arrT.length > 0 || arrB.length > 0) processMatch(arrT, arrB, 'Manual', mMatch.justificacion);
            pendientesTSD = pendientesTSD.filter(t => !mMatch.tsdArr.some(x => x._id === t._id));
            bancosDisponibles = bancosDisponibles.filter(b => !mMatch.bancoArr.some(x => x._id === b._id));
        });

        const run1to1Phase = (keyGetterT, keyGetterB, matchLabel, reqSameMonto) => {
            let nextTSD = [];
            pendientesTSD.forEach(tsdRow => {
                const kT = keyGetterT(tsdRow); const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
                let matchIdx = -1;
                if (kT) matchIdx = bancosDisponibles.findIndex(b => keyGetterB(b) === kT && !isBlacklisted(tsdRow.Contrato, b.IdTransaccion) && (!reqSameMonto || isSameMonto(b.Monto_Venta_Original, montoTSD)));
                if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], matchLabel); else nextTSD.push(tsdRow);
            });
            pendientesTSD = nextTSD;
        };

        const getAuthT = r => cleanAuth(r.Autorizacion); const getAuthB = r => cleanAuth(r.Numero_Autorizacion);
        const getCardT = r => getCard(r.Tarjeta_Ultimos4); const getCardB = r => getCard(r.Tarjeta_Ultimos4);

        // EJECUCIÓN CASCADA M4 (1 a 1 únicamente por ahora para mantenerlo seguro)
        run1to1Phase(getAuthT, getAuthB, 'Auth+Monto', true);
        run1to1Phase(getAuthT, getAuthB, 'Auth Solo', false);
        run1to1Phase(getCardT, getCardB, 'Tarj+Monto', true);
        
        // --- FASE FINAL: HUÉRFANOS ---
        [...tsdData].forEach(tsdRow => {
            if (!procesadosTSDIds.includes(tsdRow._id)) {
                const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9), _tsdRaw: tsdRow, _bancoRaw: null, _rowClass: '', _isMulti: false,
                    Contrato: tsdRow.Contrato, Cliente: tsdRow.Cliente, TarjetaTSD: getCard(tsdRow.Tarjeta_Ultimos4) ? `****${getCard(tsdRow.Tarjeta_Ultimos4)}` : 'S/D',
                    Autorizacion: tsdRow.Autorizacion, MontoTSD: { valor: montoTSD, recibo: tsdRow.Recibo_Detalle || '', valueOf: function(){return this.valor;}, toString: function(){return this.valor.toString();} },
                    EstadoMatch: 'Limbo', Banco_Nombre: '-', Banco_Auth: '-', Banco_Monto: 0, Diferencia: montoTSD
                });
            }
        });

        [...bancosData].forEach(b => {
            if (!procesadosBancosIds.includes(b._id)) {
                const m = parseFloat(b.Monto_Venta_Original);
                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9), _tsdRaw: null, _bancoRaw: b, _isMulti: false,
                    _rowClass: 'text-slate-500 italic', Contrato: 'Solo Banco', Cliente: b.Nombre_Sucursal_Comercio,
                    TarjetaTSD: b.Tarjeta_Ultimos4 ? `****${b.Tarjeta_Ultimos4}` : 'S/D', Autorizacion: '-', MontoTSD: 0,
                    EstadoMatch: 'Limbo', Banco_Nombre: b.Banco, Banco_Auth: b.Numero_Autorizacion, Banco_Monto: m, Diferencia: 0 - m
                });
            }
        });

        let cSug = 0, cHuer = 0;
        gridData.forEach(r => { if(String(r.EstadoMatch).includes('Sugerencia') || String(r.EstadoMatch).includes('Manual')) cSug++; else cHuer++; });
        document.getElementById('count-m4-sug').innerText = cSug; document.getElementById('count-m4-huer').innerText = cHuer;

        this.currentSugData = gridData.filter(r => r.EstadoMatch !== 'Limbo');
        this.currentLimboData = gridData.filter(r => r.EstadoMatch === 'Limbo');
        this.renderGrid();
    },

    renderGrid: function() {
        const fmtMoney = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v||0).replace(/\./g, ' ');

        const columns = [
            { title: "Contrato", field: "Contrato", width: 120, cssClass: "font-mono font-bold" },
            { title: "Cliente", field: "Cliente", width: 160, cssClass: "truncate text-[10px]" },
            { title: "Auth TSD", field: "Autorizacion", width: 90, cssClass: "font-mono", hozAlign: "center" },
            { 
                title: "Monto TSD", field: "MontoTSD", width: 130, hozAlign: "right", bottomCalc: "sum", bottomCalcFormatter: "money",
                formatter: (cell) => {
                    const val = cell.getValue();
                    const valor = val && 'valor' in val ? val.valor : val;
                    return `<span class="font-bold">${fmtMoney(valor)}</span>`;
                }
            },
            { 
                title: "ESTADO AUX", field: "EstadoMatch", width: 170, hozAlign: "center",
                cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-white/30 dark:bg-black/20 font-bold",
                formatter: (cell) => {
                    const val = String(cell.getValue());
                    if(val.startsWith('Manual')) return `<span class="text-amber-800">🛠️ Manual</span>`;
                    if(val.startsWith('Sugerencia')) return `<span class="text-amber-600">💡 ${val.replace('Sugerencia: ','')}</span>`;
                    return `<span class="text-slate-400">👻 Limbo</span>`;
                }
            },
            { title: "Banco", field: "Banco_Nombre", width: 90, hozAlign: "center", cssClass: "text-blue-600 font-bold" },
            { title: "Auth Banco", field: "Banco_Auth", width: 90, cssClass: "font-mono", hozAlign: "center" },
            { title: "Monto", field: "Banco_Monto", hozAlign: "right", formatter: "money", bottomCalc: "sum" },
            { title: "Dif", field: "Diferencia", hozAlign: "right", formatter: "money", cssClass: "font-bold text-red-500" }
        ];

        if (this.gridSug) this.gridSug.updateData(this.currentSugData);
        else this.gridSug = new VanillaGrid("#table-sug-m4", this.currentSugData, columns, { searchInputId: "search-m4" });

        if (this.gridLimbo) this.gridLimbo.updateData(this.currentLimboData);
        else this.gridLimbo = new VanillaGrid("#table-limbo-m4", this.currentLimboData, columns, { searchInputId: "search-m4" });
    }
};