window.AuxiliarLogic = {
    lastTSD: [], lastBancos: [], blacklist: [], manualMatches: [], customTags: [],
    gridSug: null, gridLimbo: null, gridHistorial: null,
    currentSugData: [], currentLimboData: [], currentHistorialData: [],

    // Diccionario Universal de Tailwind para evitar purga
    // Nombre en español y color de muestra de cada tono (también se usa al exportar)
    COLORES_ES: {
        'red': { nombre: 'Rojo', hex: '#fecaca' }, 'orange': { nombre: 'Naranja', hex: '#fed7aa' },
        'amber': { nombre: 'Ámbar', hex: '#fde68a' }, 'yellow': { nombre: 'Amarillo', hex: '#fef08a' },
        'lime': { nombre: 'Lima', hex: '#d9f99d' }, 'emerald': { nombre: 'Esmeralda', hex: '#a7f3d0' },
        'teal': { nombre: 'Turquesa', hex: '#99f6e4' }, 'cyan': { nombre: 'Cian', hex: '#a5f3fc' },
        'sky': { nombre: 'Celeste', hex: '#bae6fd' }, 'blue': { nombre: 'Azul', hex: '#bfdbfe' },
        'indigo': { nombre: 'Índigo', hex: '#c7d2fe' }, 'violet': { nombre: 'Violeta', hex: '#ddd6fe' },
        'purple': { nombre: 'Morado', hex: '#e9d5ff' }, 'fuchsia': { nombre: 'Fucsia', hex: '#f5d0fe' },
        'pink': { nombre: 'Rosado', hex: '#fbcfe8' }, 'rose': { nombre: 'Rosa intenso', hex: '#fecdd3' },
        'slate': { nombre: 'Gris', hex: '#e2e8f0' }
    },

    // Devuelve el color de fondo (hex) que le toca a una fila al exportarla
    getColorExport: function(row) {
        let color = null;
        if (row._categoriaId === 1 || row._categoriaId === 2) {
            const nombre = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
            const tag = this.customTags.find(t => Number(t.EsSistema) === 1 && t.Nombre === nombre);
            color = tag ? tag.ColorCSS : (row._categoriaId === 1 ? 'rose' : 'fuchsia');
        } else if (row._colorEtiq) {
            const tag = this.customTags.find(t => t.IdEtiqueta.toString() === row._colorEtiq.toString());
            if (tag) color = tag.ColorCSS;
        }
        return color && this.COLORES_ES[color] ? this.COLORES_ES[color].hex : null;
    },

    // Tonos FUERTES para filas de Contracargos/Devoluciones (clases literales, a prueba de Tailwind)
    TW_COLORS_FUERTE: {
        'red': 'bg-red-100 text-red-800 border-l-[3px] border-l-red-500 border-b border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-b-red-800',
        'orange': 'bg-orange-100 text-orange-800 border-l-[3px] border-l-orange-500 border-b border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-b-orange-800',
        'amber': 'bg-amber-100 text-amber-800 border-l-[3px] border-l-amber-500 border-b border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-b-amber-800',
        'yellow': 'bg-yellow-100 text-yellow-800 border-l-[3px] border-l-yellow-500 border-b border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-b-yellow-800',
        'lime': 'bg-lime-100 text-lime-800 border-l-[3px] border-l-lime-500 border-b border-lime-300 dark:bg-lime-900/30 dark:text-lime-300 dark:border-b-lime-800',
        'emerald': 'bg-emerald-100 text-emerald-800 border-l-[3px] border-l-emerald-500 border-b border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-b-emerald-800',
        'teal': 'bg-teal-100 text-teal-800 border-l-[3px] border-l-teal-500 border-b border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-b-teal-800',
        'cyan': 'bg-cyan-100 text-cyan-800 border-l-[3px] border-l-cyan-500 border-b border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-b-cyan-800',
        'sky': 'bg-sky-100 text-sky-800 border-l-[3px] border-l-sky-500 border-b border-sky-300 dark:bg-sky-900/30 dark:text-sky-300 dark:border-b-sky-800',
        'blue': 'bg-blue-100 text-blue-800 border-l-[3px] border-l-blue-500 border-b border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-b-blue-800',
        'indigo': 'bg-indigo-100 text-indigo-800 border-l-[3px] border-l-indigo-500 border-b border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-b-indigo-800',
        'violet': 'bg-violet-100 text-violet-800 border-l-[3px] border-l-violet-500 border-b border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-b-violet-800',
        'purple': 'bg-purple-100 text-purple-800 border-l-[3px] border-l-purple-500 border-b border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-b-purple-800',
        'fuchsia': 'bg-fuchsia-100 text-fuchsia-800 border-l-[3px] border-l-fuchsia-500 border-b border-fuchsia-300 dark:bg-fuchsia-900/30 dark:text-fuchsia-300 dark:border-b-fuchsia-800',
        'pink': 'bg-pink-100 text-pink-800 border-l-[3px] border-l-pink-500 border-b border-pink-300 dark:bg-pink-900/30 dark:text-pink-300 dark:border-b-pink-800',
        'rose': 'bg-rose-100 text-rose-800 border-l-[3px] border-l-rose-500 border-b border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-b-rose-800',
        'slate': 'bg-slate-200 text-slate-800 border-l-[3px] border-l-slate-500 border-b border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-b-slate-700'
    },

    // Lee el color guardado de la etiqueta del sistema y lo devuelve en tono fuerte
    getEstiloSistema: function(catId, italic) {
        const nombre = catId === 1 ? 'Contracargos' : 'Devoluciones';
        const tag = (this.customTags || []).find(t => Number(t.EsSistema) === 1 && t.Nombre === nombre);
        const color = tag ? tag.ColorCSS : (catId === 1 ? 'rose' : 'fuchsia');
        const base = this.TW_COLORS_FUERTE[color] || this.TW_COLORS_FUERTE[catId === 1 ? 'rose' : 'fuchsia'];
        return base + (italic ? ' italic' : '');
    },

    TW_COLORS: {
        'red': 'bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900',
        'orange': 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-900',
        'amber': 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900',
        'yellow': 'bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900',
        'lime': 'bg-lime-50 text-lime-700 border-lime-300 dark:bg-lime-900/20 dark:text-lime-400 dark:border-lime-900',
        'emerald': 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900',
        'teal': 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-900',
        'cyan': 'bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-900',
        'sky': 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-900',
        'blue': 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900',
        'indigo': 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900',
        'violet': 'bg-violet-50 text-violet-700 border-violet-300 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-900',
        'purple': 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900',
        'fuchsia': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-300 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 dark:border-fuchsia-900',
        'pink': 'bg-pink-50 text-pink-700 border-pink-300 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-900',
        'rose': 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900',
        'slate': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700'
    },

    fetchTags: async function() {
        try {
            const res = await fetch('api/mantenimiento_etiquetas_m4.php');
            const json = await res.json();
            if(json.success) this.customTags = json.data;
            this.injectLegend();
        } catch(e) { console.error("Error al cargar etiquetas", e); }
    },

    injectLegend: function() {
        const container = document.getElementById('m4-view-bandeja');
        if (!container) return;
        const old = document.getElementById('etiq-legend');
        if (old) old.remove();

        let html = '<div id="etiq-legend" class="flex flex-wrap gap-2.5 p-2.5 mb-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 items-center animate-fade-in-up"><span class="text-xs font-bold uppercase text-slate-500 mr-1">Etiquetas:</span>';
        this.customTags.forEach(tag => {
            const css = this.TW_COLORS[tag.ColorCSS] || this.TW_COLORS['slate'];
            html += `<span onclick="window.AuxiliarLogic.openTagManager()" class="${css} border-b-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm select-none cursor-pointer hover:scale-105 hover:shadow-md transition-transform" title="${tag.Descripcion || ''} — Clic para administrar etiquetas">🏷️ ${tag.Nombre}</span>`;
        });
        html += '</div>';
        container.children[0].insertAdjacentHTML('afterend', html);
    },

    init: async function() {
        console.log("⚖️ Módulo Auxiliar Contable (M4) Inicializado");
        if(this.gridSug) { if (typeof this.gridSug.destroy === 'function') this.gridSug.destroy(); this.gridSug = null; }
        if(this.gridLimbo) { if (typeof this.gridLimbo.destroy === 'function') this.gridLimbo.destroy(); this.gridLimbo = null; }
        if(this.gridHistorial) { if (typeof this.gridHistorial.destroy === 'function') this.gridHistorial.destroy(); this.gridHistorial = null; }
        
        this.blacklist = [];
        this.manualMatches = [];
        await this.fetchTags();
        
        this.blacklist = [];
        this.manualMatches = [];
        
        // Iniciar Calendario
        if (window.flatpickr) {
            flatpickr("#m4-historial-date", {
                mode: "range", dateFormat: "Y-m-d", locale: "es",
                // Buscar al cerrar el calendario; si la fecha no cambió, NO recargar
                onClose: () => {
                    const v = document.getElementById('m4-historial-date').value;
                    if (v && v !== window.AuxiliarLogic._lastDateQuery) window.AuxiliarLogic.fetchHistorial();
                }
            });
        }
        
        this.switchTab('bandeja');
        this.injectLegend();
        this.fetchPendientes();
    },

    switchTab: function(tabName) {
        const btnB = document.getElementById('tab-m4-bandeja');
        const btnH = document.getElementById('tab-m4-historial');
        const viewB = document.getElementById('m4-view-bandeja');
        const viewH = document.getElementById('m4-view-historial');
        const actionBar = document.getElementById('m4-action-bar');

        if (tabName === 'bandeja') {
            btnB.className = "px-5 py-1.5 text-sm font-bold rounded-md bg-white dark:bg-slate-700 shadow text-orange-600 dark:text-orange-400 transition-all flex items-center gap-2";
            btnH.className = "px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2";
            viewB.classList.remove('hidden'); 
            viewB.classList.add('flex');
            viewH.classList.remove('flex'); 
            viewH.classList.add('hidden');
            actionBar.classList.remove('hidden');
        } else {
            btnB.className = "px-5 py-1.5 text-sm font-bold rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all flex items-center gap-2";
            btnH.className = "px-5 py-1.5 text-sm font-bold rounded-md bg-white dark:bg-slate-700 shadow text-orange-600 dark:text-orange-400 transition-all flex items-center gap-2";
            viewB.classList.remove('flex'); 
            viewB.classList.add('hidden');
            viewH.classList.remove('hidden'); 
            viewH.classList.add('flex');
            actionBar.classList.add('hidden');
            
            // Si el historial está vacío, cargar automáticamente el último registro disponible
            if(this.currentHistorialData.length === 0) this.fetchHistorial(null, true);
        }
    },

    fetchHistorial: async function(global = null, ultimo = false) {
        let url = 'api/get_historial_m4.php';
        if (global) {
            url += `?field=${global.field}&term=${encodeURIComponent(global.term)}`;
        } else if (ultimo) {
            url += `?ultimo=1`; // El servidor resuelve la fecha del último registro
        } else {
            const dateVal = document.getElementById('m4-historial-date').value;
            if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas.");
            let start = dateVal, end = dateVal;
            if (dateVal.includes(' a ')) { [start, end] = dateVal.split(' a '); }
            url += `?start=${start}&end=${end}`;
            this._lastDateQuery = dateVal; // Memoria anti-recarga
        }
        this.isGlobalMode = !!global;

        document.body.classList.add('cursor-wait');
        try {
            const res = await fetch(url);
            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            // Modo "último": el calendario refleja la fecha real del último registro
            if (ultimo && json.fechaUltimo) {
                const inp = document.getElementById('m4-historial-date');
                if (inp && inp._flatpickr) inp._flatpickr.setDate([json.fechaUltimo, json.fechaUltimo], false);
                this._lastDateQuery = inp ? inp.value : '';
            }

            // AGRUPACIÓN MULTIPLEXADA EN RAM (Al estilo processMatch)
            const groups = {};
            json.data.forEach(r => {
                const id = r.IdMatchTSD;
                if (!groups[id]) {
                    groups[id] = {
                        IdMatchTSD: id, TipoCruce: r.TipoCruceTSD, Folio: r.Folio || 'S/D', FechaFolio: r.FechaFolio || '-',
                        Justificacion: r.Justificacion || '', EvidenciaB64: r.EvidenciaB64 || null, tsdArr: [], bancoArr: []
                    };
                }
                if (r.Banco === 'TSD') groups[id].tsdArr.push(r);
                else groups[id].bancoArr.push(r);
                if (r.Justificacion) groups[id].Justificacion = r.Justificacion;
                if (r.EvidenciaB64) groups[id].EvidenciaB64 = r.EvidenciaB64;
            });


            this.currentHistorialData = Object.values(groups).map(g => {
                const tsdArr = g.tsdArr;
                const bancoArr = g.bancoArr;
                const isMulti = tsdArr.length > 1 || bancoArr.length > 1;

                // Sumas con Regla de Magnitudes
                const sumT = tsdArr.map(c => parseFloat(c.MontoCRC) || 0).sort((a,b) => Math.abs(b)-Math.abs(a)).reduce((a,b)=>a+b, 0);
                const sumB = bancoArr.map(c => parseFloat(c.MontoCRC) || 0).sort((a,b) => Math.abs(b)-Math.abs(a)).reduce((a,b)=>a+b, 0);
                
                const absT = Math.abs(sumT), absB = Math.abs(sumB), gap = Math.abs(absT - absB);
                const diffReal = absT >= absB ? (sumT < 0 ? -gap : gap) : (sumB < 0 ? -gap : gap);

                const t0 = tsdArr.length > 0 ? tsdArr[0] : {};
                const b0 = bancoArr.length > 0 ? bancoArr[0] : {};

                let tarjetaLimpia = String(t0.Tarjeta || '').replace(/[^a-zA-Z0-9]/g, '');
                const tarjetaRep = tarjetaLimpia.length >= 4 ? `****${tarjetaLimpia.slice(-4)}` : 'S/D';

                // Índice de búsqueda profunda: expone TODOS los miembros del grupo (visible aun si la celda dice "Varios")
                const norm = (v) => String(v ?? '').toLowerCase();
                const todos = [...tsdArr, ...bancoArr];
                const _filtro = {
                    contrato: tsdArr.map(c => norm(c.Contrato)).join(' '),
                    afiliado: todos.map(c => norm(c.Afiliado)).join(' '),
                    auth: todos.map(c => norm(c.Autorizacion)).join(' '),
                    tarjeta: todos.map(c => norm(c.Tarjeta).replace(/[^a-z0-9]/g, '')).join(' '),
                    cliente: tsdArr.map(c => norm(c.Cliente)).join(' '),
                    banco: bancoArr.map(c => norm(c.Banco)).join(' '),
                    liquidacion: bancoArr.map(c => norm(c.Liquidacion)).join(' ')
                };
                _filtro.all = Object.values(_filtro).join(' ');

                // Dimensiones para los filtros universales y miembros para los gráficos
                const uniq = (arr) => [...new Set(arr.filter(x => x))];
                // Marca por convención de nombre: sufijo (A)=Alamo, (E)=Enterprise, (N)=National
                const marcaDe = (nombre) => {
                    const m = String(nombre || '').trim().match(/\(([AEN])\)$/i);
                    return m ? ({ A: 'Alamo', E: 'Enterprise', N: 'National' })[m[1].toUpperCase()] : null;
                };
                const _dims = {
                    bancos: uniq(bancoArr.map(c => c.Banco)),
                    tarjetas: uniq(tsdArr.map(c => c.TipoTarjeta)),
                    ccs: uniq(todos.map(c => c.CentroCosto)),
                    sucs: uniq(todos.map(c => c.Sucursal)),
                    marcas: uniq(todos.map(c => marcaDe(c.Sucursal)))
                };

                // Etiqueta del grupo: la del primer miembro que tenga una (color y nota)
                const colorEtiq = todos.map(c => c.ColorEtiqueta).find(x => x) || null;
                const notaEtiq = todos.map(c => c.NotaUsuario).find(x => x) || '';
                const tagGrupo = colorEtiq ? (this.customTags || []).find(t => t.IdEtiqueta.toString() === colorEtiq.toString()) : null;
                const claseEtiq = (tagGrupo && this.TW_COLORS[tagGrupo.ColorCSS])
                    ? this.TW_COLORS[tagGrupo.ColorCSS] + ' border-b'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50';

                return {
                    _uid: g.IdMatchTSD,
                    _filtro,
                    _dims,
                    _tsdArr: tsdArr,
                    _bancoArr: bancoArr,
                    _colorEtiq: colorEtiq,
                    _notaEtiq: notaEtiq,
                    _rowClass: claseEtiq,
                    Contrato: isMulti ? `Varios (${tsdArr.length} reg)` : (t0.Contrato || 'Solo Banco'),
                    Cliente: isMulti ? `Agrupación Múltiple` : (t0.Cliente || '-'),
                    TarjetaTSD: tarjetaRep,
                    Autorizacion: t0.Autorizacion || '-',
                    MontoTSD: { valor: sumT, recibo: isMulti ? '' : (t0.Recibo_Detalle || ''), valueOf: function(){return this.valor;} },
                    TipoCruce: { tipo: g.TipoCruce, justificacion: g.Justificacion, evidencia: g.EvidenciaB64, valueOf: function(){return this.tipo;} },
                    Banco_Nombre: isMulti ? (bancoArr.length > 1 ? `Múltiples Bancos` : (b0.Banco || '-')) : (b0.Banco || 'Solo TSD'),
                    Banco_Auth: b0.Autorizacion || '-',
                    Banco_Monto: sumB,
                    Diferencia: diffReal,
                    Folio: g.Folio,
                    FechaFolio: g.FechaFolio
                };
            });

            this.historialMaster = this.currentHistorialData;
            this.poblarFiltrosHist(); // Los selects se llenan con lo que trae la propia información
            this.applyHistorialFilter(); // Filtros universales + búsqueda + dashboards, en modo normal y global
            this.updateGlobalBadge();
        } catch (error) {
            window.SysUI.alert("Error al cargar historial: " + error.message, "Fallo", "error");
        } finally {
            document.body.classList.remove('cursor-wait');
        }
    },

    renderHistorialGrid: function() {
        const fmtMoney = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v||0).replace(/\./g, ' ');

        const columns = [
            { title: "Contrato", field: "Contrato", width: 120, cssClass: "font-mono font-bold" },
            { 
                title: "Cliente / Notas", field: "Cliente", width: 180, cssClass: "text-[10px]",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    const val = (typeof cell === 'object' && cell.getValue ? cell.getValue() : cell) || '-';
                    let nota = '';
                    if (row._notaEtiq) {
                        nota = `<div class="mt-1 text-[9px] font-bold italic leading-tight text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-black/20 p-1 rounded border border-slate-200 dark:border-slate-600 break-words whitespace-normal max-w-full"><span class="mr-1">💬</span>${row._notaEtiq}</div>`;
                    }
                    return `<div><span class="truncate" title="${val}">${val}</span>${nota}</div>`;
                }
            },
            { title: "Auth TSD", field: "Autorizacion", width: 90, cssClass: "font-mono", hozAlign: "center" },
            { 
                title: "Monto TSD", field: "MontoTSD", width: 130, hozAlign: "right", bottomCalc: "sum",
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-800 dark:text-white">${fmtMoney(val)}</span>`,
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    const valor = val && 'valor' in val ? val.valor : val;
                    const recibo = val && 'recibo' in val ? val.recibo : '';
                    const recHtml = recibo ? `<div class="text-[9px] text-orange-600 dark:text-orange-400 italic truncate font-medium mt-0.5" title="${recibo}">${recibo}</div>` : '';
                    return `<div class="flex flex-col justify-center items-end h-full"><span class="font-bold text-slate-800 dark:text-slate-200">${fmtMoney(valor)}</span>${recHtml}</div>`;
                }
            },
            { 
                title: "RESOLUCIÓN APLICADA", field: "TipoCruce", width: 180, hozAlign: "center",
                cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-green-50/50 dark:bg-green-900/10 font-bold",
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    const tipoString = val && typeof val === 'object' ? val.tipo : val;
                    const justString = val && typeof val === 'object' ? val.justificacion : '';
                    const evString = val && typeof val === 'object' ? val.evidencia : null;
                    
                    let extrasHtml = justString ? `<div class="text-[9px] text-green-700 dark:text-green-400 font-normal mt-0.5 truncate max-w-[160px] mx-auto italic" title="${justString}">"${justString}"</div>` : '';
                    if (evString) {
                        extrasHtml += `<div class="text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-0.5 flex items-center gap-1 justify-center"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> Evidencia Visual</div>`;
                    }
                    return `<div class="flex flex-col items-center"><span class="text-green-800 dark:text-green-300 uppercase tracking-widest text-[10px]">✅ ${tipoString.replace('[AUX] ', '')}</span>${extrasHtml}</div>`;
                }
            },
            { title: "Banco", field: "Banco_Nombre", width: 100, hozAlign: "center", cssClass: "text-blue-600 font-bold" },
            { title: "Auth Banco", field: "Banco_Auth", width: 90, cssClass: "font-mono", hozAlign: "center" },
            { 
                title: "Monto", field: "Banco_Monto", hozAlign: "right", formatter: "money", bottomCalc: "sum",
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-800 dark:text-white">${fmtMoney(val)}</span>`, cssClass: "font-bold" 
            },
            { 
                title: "Dif", field: "Diferencia", hozAlign: "right", bottomCalc: "sum",
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-500 dark:text-slate-400">${fmtMoney(val)}</span>`,
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    // Diseño neutro/pacífico: El dato ya está auditado y cerrado, no requiere alertas visuales.
                    return `<span class="font-medium text-slate-500 dark:text-slate-400 text-sm">${fmtMoney(val)}</span>`;
                }
            },
            { 
                title: "Datos de Cierre", field: "Folio", width: 140,
                formatter: (cell) => {
                    const row = (typeof cell === 'object' && typeof cell.getRow === 'function') ? cell.getRow() : cell;
                    return `<div class="flex flex-col"><span class="text-[10px] font-mono text-slate-500 font-bold" title="${row.Folio}">${row.Folio.substring(0, 15)}...</span><span class="text-[9px] text-slate-400">📅 ${row.FechaFolio}</span></div>`;
                }
            }
        ];

        if (this.gridHistorial) this.gridHistorial.updateData(this.currentHistorialData);
        else {
            this.gridHistorial = new VanillaGrid("#table-historial-m4", this.currentHistorialData, columns, { 
                onRowDblClick: (r) => window.AuxiliarLogic.openForenseModal(r),
                onRowContextMenu: (r, e, menu) => window.AuxiliarLogic.abrirMenuEtiquetasHistorial(r, e, menu)
            });
            this.bindHistorialFilter();
        }
    },

    // --- FILTRO PROFUNDO DEL HISTORIAL (M4) ---
    bindHistorialFilter: function() {
        const input = document.getElementById('search-m4-historial');
        const scope = document.getElementById('m4-hist-scope');
        if (!input || !scope || input.dataset.bound) return;
        input.dataset.bound = '1';

        const labels = { contrato:'Contrato', afiliado:'Afiliado', auth:'Autorización', tarjeta:'Tarjeta', cliente:'Cliente', banco:'Banco', liquidacion:'Liquidación' };
        let timer = null;
        input.addEventListener('input', () => {
            if (scope.value !== 'all') return; // Ámbitos específicos = SQL bajo demanda (Enter/lupa), jamás por tecla
            clearTimeout(timer);
            timer = setTimeout(() => this.applyHistorialFilter(), 250);
        });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.triggerHistorialSearch(); });
        scope.addEventListener('change', () => {
            input.placeholder = scope.value === 'all' ? 'Buscar en todo el historial...' : `Buscar por ${labels[scope.value]} en toda la BD...`;
            input.focus();
            if (scope.value === 'all') this.applyHistorialFilter();
        });
    },

    triggerHistorialSearch: function() {
        const scope = document.getElementById('m4-hist-scope')?.value || 'all';
        const term = (document.getElementById('search-m4-historial')?.value || '').trim();
        if (scope === 'all') return this.applyHistorialFilter();
        if (term.length < 3) return window.SysUI.alert("Ingrese al menos 3 caracteres para la búsqueda global.");
        this.fetchHistorial({ field: scope, term });
    },

    updateGlobalBadge: function() {
        const badge = document.getElementById('m4-hist-global-badge');
        const dateBox = document.getElementById('m4-historial-date');
        if (!badge) return;
        badge.classList.toggle('hidden', !this.isGlobalMode);
        badge.classList.toggle('inline-flex', !!this.isGlobalMode);
        if (dateBox) dateBox.classList.toggle('opacity-40', !!this.isGlobalMode);
    },

    exitGlobalMode: function() {
        this.isGlobalMode = false;
        const input = document.getElementById('search-m4-historial');
        if (input) input.value = '';
        this.updateGlobalBadge();
        if (document.getElementById('m4-historial-date').value) this.fetchHistorial();
        else { this.historialMaster = []; this.currentHistorialData = []; this.renderHistorialGrid(); }
    },

    applyHistorialFilter: function() {
        const term = (document.getElementById('search-m4-historial')?.value || '').toLowerCase().trim();
        const scope = document.getElementById('m4-hist-scope')?.value || 'all';
        // Tarjetas: comparación sin símbolos para que "1234" haga match con "****1234"
        const needle = scope === 'tarjeta' ? term.replace(/[^a-z0-9]/g, '') : term;

        let data = !needle
            ? (this.historialMaster || [])
            : (this.historialMaster || []).filter(r => r._filtro && r._filtro[scope].includes(needle));

        // FILTROS UNIVERSALES (multi-selección): la tabla y los gráficos beben de la misma agua
        const selF = this._fhSel || {};
        const pasa = (dims, escogidos) => !escogidos || escogidos.length === 0 || (dims || []).some(v => escogidos.includes(v));
        data = data.filter(r => r._dims
            && pasa(r._dims.marcas, selF.marca)
            && pasa(r._dims.bancos, selF.banco)
            && pasa(r._dims.tarjetas, selF.tarjeta)
            && pasa(r._dims.ccs, selF.cc)
            && pasa(r._dims.sucs, selF.sucursal));

        this.currentHistorialData = data;
        this.renderHistorialGrid();
        this.renderHistorialDash(data);
    },

   // Filtros multi-selección: dropdowns con checkboxes (la data manda, nada viene de afuera)
    _fhSel: { marca: [], banco: [], tarjeta: [], cc: [], sucursal: [] },
    _fhDefs: [
        { id: 'fh-marca',    key: 'marca',    dim: 'marcas',   etiqueta: '🚗 Marca' },
        { id: 'fh-banco',    key: 'banco',    dim: 'bancos',   etiqueta: '🏦 Banco' },
        { id: 'fh-tarjeta',  key: 'tarjeta',  dim: 'tarjetas', etiqueta: '💳 Tipo Tarjeta' },
        { id: 'fh-cc',       key: 'cc',       dim: 'ccs',      etiqueta: '🏢 Centro de Costo' },
        { id: 'fh-sucursal', key: 'sucursal', dim: 'sucs',     etiqueta: '📍 Sucursal' }
    ],
    poblarFiltrosHist: function() {
        const master = this.historialMaster || [];
        const juntar = (k) => [...new Set(master.flatMap(r => (r._dims && r._dims[k]) || []))].sort();
        this._fhDefs.forEach(def => {
            const cont = document.getElementById(def.id);
            if (!cont) return;
            const lista = juntar(def.dim);
            // Conserva solo selecciones que siguen existiendo en la data
            this._fhSel[def.key] = (this._fhSel[def.key] || []).filter(v => lista.includes(v));
            const sel = this._fhSel[def.key];
            const resumen = sel.length === 0 ? 'Todos' : (sel.length === 1 ? sel[0] : `${sel.length} seleccionados`);
            const activo = sel.length > 0;
            cont.innerHTML = `
                <button type="button" onclick="window.AuxiliarLogic.toggleFhPanel('${def.id}')"
                    class="text-xs p-1.5 pr-2 rounded-lg border ${activo ? 'border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white bg-white dark:bg-slate-900'} outline-none cursor-pointer flex items-center gap-1 transition-colors">
                    <span class="font-bold">${def.etiqueta}:</span> <span class="max-w-[120px] truncate">${resumen}</span> <span class="text-[8px] opacity-60">▼</span>
                </button>
                <div data-fh-panel class="hidden absolute z-40 mt-1 left-0 max-h-56 w-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl p-1">
                    ${lista.length === 0 ? '<div class="text-[10px] text-slate-400 p-2">Sin datos</div>' : lista.map(v => `
                        <label class="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer">
                            <input type="checkbox" ${sel.includes(String(v)) ? 'checked' : ''} value="${String(v).replace(/"/g, '&quot;')}" onchange="window.AuxiliarLogic.toggleFhValor('${def.key}', this)" class="accent-blue-600">
                            <span class="truncate">${v}</span>
                        </label>`).join('')}
                </div>`;
        });
        // Cierre de paneles por clic afuera (se registra una sola vez)
        if (!this._fhOutsideBound) {
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#fh-marca, #fh-banco, #fh-tarjeta, #fh-cc, #fh-sucursal')) {
                    document.querySelectorAll('[data-fh-panel]').forEach(p => p.classList.add('hidden'));
                }
            });
            this._fhOutsideBound = true;
        }
    },
    toggleFhPanel: function(id) {
        const panel = document.querySelector(`#${id} [data-fh-panel]`);
        const estabaAbierto = panel && !panel.classList.contains('hidden');
        document.querySelectorAll('[data-fh-panel]').forEach(p => p.classList.add('hidden'));
        if (panel && !estabaAbierto) panel.classList.remove('hidden');
    },
    toggleFhValor: function(key, chk) {
        const arr = this._fhSel[key] || (this._fhSel[key] = []);
        if (chk.checked) { if (!arr.includes(chk.value)) arr.push(chk.value); }
        else { this._fhSel[key] = arr.filter(v => v !== chk.value); }
        this.applyHistorialFilter();
        this.poblarFiltrosHist(); // Refresca los resúmenes de los botones
        this.toggleFhPanel(this._fhDefs.find(d => d.key === key).id); // Mantiene el panel abierto para seguir marcando
    },

    // Abre el Visor de Crudos en contexto M4 (bancos + TSD desde base de datos) en ventana popup
    abrirVisorCrudos: function() {
        const dateVal = document.getElementById('m4-historial-date')?.value || '';
        if (!dateVal) return window.SysUI.alert("Seleccione primero un rango de fechas en el calendario del historial.", "Sin fechas", "info");
        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) { [start, end] = dateVal.split(' a '); }
        const width = Math.round(window.screen.width * 0.9), height = Math.round(window.screen.height * 0.85);
        const left = Math.round((window.screen.width - width) / 2), top = Math.round((window.screen.height - height) / 2);
        window.open(`visor_crudos.php?start=${start}&end=${end}&ctx=m4`, 'VisorCrudosIRI_M4', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
    },

    limpiarFiltrosHist: function() {
        this._fhSel = { marca: [], banco: [], tarjeta: [], cc: [], sucursal: [] };
        this.poblarFiltrosHist();
        this.applyHistorialFilter();
    },

    // Dashboards con barras hechas en casa (sin librerías, todo del propio sistema)
    renderHistorialDash: function(data) {
        if (typeof Chart === 'undefined') return;
        const fmt = (n) => '₡' + Math.round(n).toLocaleString('es-CR');
        const dark = document.documentElement.classList.contains('dark');
        const tick = dark ? '#94a3b8' : '#475569';

        // Anti-duplicidad: cada lado se cuenta UNA vez. TSD desde _tsdArr, banco desde _bancoArr.
        let totalTSD = 0, totalBanco = 0, totalCom = 0, totalRet = 0;
        const porCC = {};
        const ccNombre = {}; // Traducción: código de CC -> nombre de sucursal
        const porEntidad = {}; // { 'BAC': {tsd, banco}, ... }
        const porBanco = {};   // { 'BAC': {bruto, com, ret, neto} }
        const porTarjeta = {}; // { 'VISA': monto, ... } Ingreso bruto por tipo de tarjeta

        (data || []).forEach(r => {
            (r._tsdArr || []).forEach(t => {
                totalTSD += Number(t.MontoCRC) || 0;
                // Tipo de Tarjeta: SOLO desde TSD (única fuente real de la marca)
                const tt = String(t.TipoTarjeta || '').trim().toUpperCase() || 'S/D';
                porTarjeta[tt] = (porTarjeta[tt] || 0) + (Number(t.MontoCRC) || 0);
                // Centro de Costo: SOLO desde TSD (CC y nombre de sucursal)
                const cc = t.CentroCosto || 'Sin CC';
                porCC[cc] = (porCC[cc] || 0) + (Number(t.MontoCRC) || 0);
                if (cc !== 'Sin CC' && t.Sucursal) ccNombre[cc] = t.Sucursal;
            });
            (r._bancoArr || []).forEach(b => {
                const monto = Number(b.MontoBrutoBanco) || 0;
                totalBanco += monto;
                totalCom += Number(b.Comision) || 0;
                totalRet += Number(b.Retenciones) || 0;
                const bk = b.Banco || '?';
                if (!porBanco[bk]) porBanco[bk] = { bruto: 0, com: 0, ret: 0, neto: 0 };
                porBanco[bk].bruto += monto;
                porBanco[bk].com += Number(b.Comision) || 0;
                porBanco[bk].ret += Number(b.Retenciones) || 0;
                porBanco[bk].neto += Number(b.MontoNetoBanco) || 0;
                if (!porEntidad[bk]) porEntidad[bk] = { tsd: 0, banco: 0 };
                porEntidad[bk].banco += monto;
            });
            // El TSD del grupo se atribuye a la(s) entidad(es) bancaria(s) con que casó
            const bancosGrupo = [...new Set((r._bancoArr || []).map(b => b.Banco).filter(Boolean))];
            const tsdGrupo = (r._tsdArr || []).reduce((a, t) => a + (Number(t.MontoCRC) || 0), 0);
            if (bancosGrupo.length && tsdGrupo) {
                const parte = tsdGrupo / bancosGrupo.length;
                bancosGrupo.forEach(bk => { if (!porEntidad[bk]) porEntidad[bk] = { tsd: 0, banco: 0 }; porEntidad[bk].tsd += parte; });
            } else if (tsdGrupo) {
                if (!porEntidad['Solo TSD']) porEntidad['Solo TSD'] = { tsd: 0, banco: 0 };
                porEntidad['Solo TSD'].tsd += tsdGrupo;
            }
        });

        // --- FILA DE KPIs (las dos verdades + la brecha) ---
        const brecha = totalTSD - totalBanco;
        const kpis = document.getElementById('dash-m4-kpis');
        if (kpis) {
            const card = (label, val, color) => `
                <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5">
                    <div class="text-[9px] font-bold uppercase text-slate-400">${label}</div>
                    <div class="text-sm font-black ${color}">${fmt(val)}</div>
                </div>`;
            kpis.innerHTML =
                card('📋 Facturado (TSD)', totalTSD, 'text-blue-600 dark:text-blue-400') +
                card('🏦 Reportado (Banco)', totalBanco, 'text-emerald-600 dark:text-emerald-400') +
                card(Math.abs(brecha) < 1 ? '✅ Brecha (cuadrado)' : '⚠️ Brecha', brecha, Math.abs(brecha) < 1 ? 'text-slate-500' : 'text-red-500') +
                card('✂️ Comisiones + Retenc.', totalCom + totalRet, 'text-amber-600 dark:text-amber-400');
        }

        // Limpia gráficos previos (evita superposición de Chart.js)
        ['_chCC', '_chVS', '_chBanco', '_chTarjeta'].forEach(k => { if (this[k]) { this[k].destroy(); this[k] = null; } });

        // --- DONA: Ingresos por CC (Top 10 + Otros) ---
        const ctxCC = document.getElementById('ch-hist-cc');
        if (ctxCC) {
            let lista = Object.entries(porCC).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
            let otros = 0;
            if (lista.length > 10) { lista.slice(10).forEach(x => otros += x[1]); lista = lista.slice(0, 10); }
            const codigos = lista.map(x => x[0]).concat(otros ? ['—'] : []);
            // Rótulo = nombre de sucursal (si no hay, cae al código del CC)
            const labels = lista.map(x => ccNombre[x[0]] || x[0]).concat(otros ? ['Otros'] : []);
            const vals = lista.map(x => Math.abs(x[1])).concat(otros ? [Math.abs(otros)] : []);
            const palette = ['#6366f1','#3b82f6','#0ea5e9','#14b8a6','#10b981','#84cc16','#eab308','#f59e0b','#f97316','#ef4444','#94a3b8'];
            this._chCC = new Chart(ctxCC.getContext('2d'), {
                type: 'doughnut',
                data: { labels, datasets: [{ data: vals, backgroundColor: palette.slice(0, labels.length), borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: tick, font: { size: 10 }, boxWidth: 12 } }, tooltip: { callbacks: { label: (c) => c.label + (codigos[c.dataIndex] && codigos[c.dataIndex] !== '—' ? ' · CC ' + codigos[c.dataIndex] : '') + ': ' + fmt(c.raw) } } } }
            });
        }

        // --- BARRAS: TSD vs Banco por entidad ---
        const ctxVS = document.getElementById('ch-hist-vs');
        if (ctxVS) {
            const ents = Object.keys(porEntidad);
            this._chVS = new Chart(ctxVS.getContext('2d'), {
                type: 'bar',
                data: { labels: ents, datasets: [
                    { label: 'Facturado (TSD)', data: ents.map(e => porEntidad[e].tsd), backgroundColor: '#3b82f6' },
                    { label: 'Reportado (Banco)', data: ents.map(e => porEntidad[e].banco), backgroundColor: '#10b981' }
                ] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tick, font: { size: 10 } } }, tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmt(c.raw) } } }, scales: { x: { ticks: { color: tick, font: { size: 10 } } }, y: { ticks: { color: tick, callback: (v) => '₡' + (v / 1000) + 'k' } } } }
            });
        }

        // --- BARRAS: Ingreso Bruto por Tipo de Tarjeta ---
        const ctxTar = document.getElementById('ch-hist-tarjeta');
        if (ctxTar) {
            const listaTar = Object.entries(porTarjeta).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
            const palTar = ['#3b82f6','#6366f1','#0ea5e9','#14b8a6','#10b981','#84cc16','#eab308','#f59e0b','#f97316','#ef4444','#94a3b8'];
            this._chTarjeta = new Chart(ctxTar.getContext('2d'), {
                type: 'bar',
                data: { labels: listaTar.map(x => x[0]), datasets: [{ label: 'Ingreso Bruto', data: listaTar.map(x => x[1]), backgroundColor: palTar.slice(0, Math.max(listaTar.length, 1)) }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => 'Ingreso Bruto: ' + fmt(c.raw) } } }, scales: { x: { ticks: { color: tick, font: { size: 10 } } }, y: { ticks: { color: tick, callback: (v) => '₡' + (v / 1000) + 'k' } } } }
            });
        }

        // --- BARRAS SEPARADAS: Bruto · Comisiones · Retenciones · Neto por banco ---
        const ctxB = document.getElementById('ch-hist-banco');
        if (ctxB) {
            const bancos = Object.keys(porBanco);
            this._chBanco = new Chart(ctxB.getContext('2d'), {
                type: 'bar',
                data: { labels: bancos, datasets: [
                    { label: 'Ingreso Bruto', data: bancos.map(b => porBanco[b].bruto), backgroundColor: '#3b82f6' },
                    { label: 'Comisiones', data: bancos.map(b => porBanco[b].com), backgroundColor: '#f59e0b' },
                    { label: 'Retenciones', data: bancos.map(b => porBanco[b].ret), backgroundColor: '#ef4444' },
                    { label: 'Ingreso Neto', data: bancos.map(b => porBanco[b].neto), backgroundColor: '#10b981' }
                ] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tick, font: { size: 10 } } }, tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmt(c.raw) } } }, scales: { x: { ticks: { color: tick } }, y: { ticks: { color: tick, callback: (v) => '₡' + (v / 1000) + 'k' } } } }
            });
        }
    },

    fetchPendientes: async function() {
        const loader = document.getElementById('m4-loader');
        if (loader) loader.classList.remove('hidden');

        try {
            const res = await fetch(`api/get_pendientes_m4.php`);
            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            // Sellar usando las llaves primarias de BD para evitar "secuestros" de memoria
            this.lastTSD = json.tsd.map(t => { t._id = 't_' + t.ID_Transaccion; return t; });
            this.lastBancos = json.bancos.map(b => { b._id = 'b_' + b.IdTransaccion; return b; });

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
        const isBlacklisted = (idTsd, idTrans) => this.blacklist.includes(String(idTsd).trim() + '|' + String(idTrans).trim());
        const isSameMonto = (m1, m2) => Math.abs(parseFloat(m1) - parseFloat(m2)) < 2; 

        // DETECTOR INTELIGENTE DE CATEGORÍAS (Contracargos / Devoluciones)
        const detectCategory = (tArr, bArr) => {
            let isContra = false; let isDevol = false;
            const checkStr = (str) => String(str || '').toLowerCase();
            
            // Se quitan tildes y se busca la RAÍZ de la palabra: "Devolución", "devolucion",
            // "DEVOLUCIONES", "devuelto/a" o "reembolsos" caen igual, sin importar cómo lo escriban.
            const sinTildes = (s) => checkStr(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            (tArr || []).forEach(t => {
                const rec = sinTildes(t.Recibo_Detalle);
                if (rec.includes('contracargo') || rec.includes('contra cargo') || rec.includes('chargeback') || rec.includes('charge back')) isContra = true;
                if (rec.includes('devoluc') || rec.includes('devuelt') || rec.includes('reembols') || rec.includes('refund')) isDevol = true;
            });
            
            (bArr || []).forEach(b => {
                const tipo = checkStr(b.TipoAjuste);
                const desc = checkStr(b.Nombre_Sucursal_Comercio);
                const just = checkStr(b.Justificacion);
                if (tipo.includes('contracargo') || desc.includes('contracargo') || just.includes('contracargo')) isContra = true;
                if (tipo.includes('devoluci') || desc.includes('devoluci') || just.includes('devoluci') || tipo.includes('remisión') || tipo.includes('remision')) isDevol = true;
            });
            
            if (isContra) return 1; // Prioridad 1: Contracargos
            if (isDevol) return 2;  // Prioridad 2: Devoluciones
            return 3;               // Prioridad 3: Operación Regular
        };

        // MOTOR DE DIBUJO (M4: Todo lo automático es sugerencia)
        const processMatch = (tsdRow, bancoRow, reason, justificacion = '') => {
            const tsdArr = Array.isArray(tsdRow) ? tsdRow : [tsdRow];
            const bancoArr = Array.isArray(bancoRow) ? bancoRow : [bancoRow];
            
            tsdArr.forEach(t => procesadosTSDIds.push(t._id));
            bancoArr.forEach(b => procesadosBancosIds.push(b._id));

            const isMulti = tsdArr.length > 1 || bancoArr.length > 1;
            
            // En M4, a menos que sea manual, todo es Sugerencia
            let finalMatchType = reason === 'Manual' ? (justificacion ? `Manual|${justificacion}` : 'Manual') : `Sugerencia: ${reason}`;

            // Colocar primero los datos en orden de mayor a menor (por magnitud) para sumar correctamente positivos y negativos
            const montoTSD = tsdArr
                .map(curr => parseFloat(curr.MontoCRC) || 0)
                .sort((a, b) => Math.abs(b) - Math.abs(a))
                .reduce((acc, val) => acc + val, 0);

            const montoBanco = bancoArr
                .map(curr => parseFloat(curr.Monto_Venta_Original) || 0)
                .sort((a, b) => Math.abs(b) - Math.abs(a))
                .reduce((acc, val) => acc + val, 0);
            
            let bgColorClass = reason === 'Manual'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-100 border-b border-green-200 dark:border-green-800 font-bold'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-b border-amber-200 dark:border-amber-800';

            // Si es la Fase 9 (Sugerencia por Monto), le damos un color amarillo alerta para que destaque en el Limbo
            if (reason === 'Monto Igual') {
                bgColorClass = 'bg-[#fef08a] dark:bg-[#854d0e] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800';
            }
            if (reason.includes('Ajuste Interno')) {
                bgColorClass = 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-100 border-b border-cyan-200 dark:border-cyan-800';
            }
            if (reason.includes('Ajuste Menor')) {
                bgColorClass = 'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-900 dark:text-fuchsia-100 border-b border-fuchsia-300 dark:border-fuchsia-700 font-bold shadow-sm';
            }

            // Blindaje: Extracción segura en caso de que sea un Ajuste Manual de 1 solo lado
            const t0 = tsdArr.length > 0 ? tsdArr[0] : {};
            const b0 = bancoArr.length > 0 ? bancoArr[0] : {};

            const contratoRep = isMulti ? tsdArr.map(t=>t.Contrato).join(', ') : (t0.Contrato || 'Solo Banco');
            const clienteRep = isMulti ? tsdArr.map(t=>t.Cliente).join(', ') : (t0.Cliente || '-'); 
            const authTSDRep = isMulti ? tsdArr.map(t=>t.Autorizacion).join(', ') : (t0.Autorizacion || '-');
            
            const tarjetaRep = isMulti 
                ? tsdArr.map(t => cleanStr(t.Tarjeta_Ultimos4).length >= 4 ? `****${cleanStr(t.Tarjeta_Ultimos4).slice(-4)}` : 'S/D').join(', ')
                : (cleanStr(t0.Tarjeta_Ultimos4).length >= 4 ? `****${cleanStr(t0.Tarjeta_Ultimos4).slice(-4)}` : 'S/D');
            
            const bancoRep = isMulti ? bancoArr.map(b=>b.Banco).join(', ') : (b0.Banco || 'Solo TSD');
            const authBancoRep = isMulti ? bancoArr.map(b=>b.Numero_Autorizacion).join(', ') : (b0.Numero_Autorizacion || '-');

            // Diferencia Contable Real: Tomar el mayor, restarle el menor y conservar el signo del mayor
            const absT = Math.abs(montoTSD);
            const absB = Math.abs(montoBanco);
            const gap = Math.abs(absT - absB);
            
            let diffReal = 0;
            if (absT >= absB) {
                diffReal = montoTSD < 0 ? -gap : gap;
            } else {
                diffReal = montoBanco < 0 ? -gap : gap;
            }

            let catId = detectCategory(tsdArr, bancoArr);

            // Propagar etiquetas a las sugerencias (Prioridad TSD, luego Banco)
            const colorEtiq = t0.ColorEtiqueta || b0.ColorEtiqueta || null;
            // La etiqueta puesta por el usuario MANDA sobre la sugerencia automática
            if (colorEtiq && (catId === 1 || catId === 2)) catId = 3;

            const notaEtiq = t0.NotaUsuario || b0.NotaUsuario || null;
            const dbId = t0.ID_Transaccion || b0.IdTransaccion || null;

            // Diccionario explícito para que Tailwind no borre las clases
            const rowStyles = {
                'yellow': 'bg-yellow-50 dark:bg-yellow-900/10 border-b border-yellow-200 dark:border-yellow-900',
                'emerald': 'bg-emerald-50 dark:bg-emerald-900/10 border-b border-emerald-200 dark:border-emerald-900',
                'cyan': 'bg-cyan-50 dark:bg-cyan-900/10 border-b border-cyan-200 dark:border-cyan-900',
                'slate': 'bg-slate-200 dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-700'
            };

            // Pintar color de fondo si tiene etiqueta y no es de alta prioridad (Contracargo/Devolución/Manual)
            if (catId === 3 && colorEtiq && !bgColorClass.includes('font-bold')) { 
                // colorEtiq guarda el NÚMERO de la etiqueta: se traduce a su color real en la paleta
                const tagSug = this.customTags.find(t => t.IdEtiqueta.toString() === colorEtiq.toString());
                if (tagSug && this.TW_COLORS[tagSug.ColorCSS]) {
                    bgColorClass = this.TW_COLORS[tagSug.ColorCSS] + ' border-b';
                }
            }

            gridData.push({
                _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                _tsdRaw: isMulti ? tsdArr : tsdArr[0], _bancoRaw: isMulti ? bancoArr : bancoArr[0], _isMulti: isMulti,
                _rowClass: bgColorClass,
                _categoriaId: catId, _dbId: dbId, _colorEtiq: colorEtiq, _notaEtiq: notaEtiq,
                Contrato: contratoRep, Cliente: clienteRep, TarjetaTSD: tarjetaRep, Autorizacion: authTSDRep,
                MontoTSD: { valor: montoTSD, recibo: isMulti ? '' : (t0.Recibo_Detalle || ''), valueOf: function() { return this.valor; }, toString: function() { return this.valor.toString(); } }, 
                EstadoMatch: finalMatchType, Banco_Nombre: bancoRep, Banco_Auth: authBancoRep, Banco_Monto: montoBanco, 
                Diferencia: diffReal
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

        // --- HELPERS DE BÚSQUEDA ---
        const run1to1Phase = (keyGetterT, keyGetterB, matchLabel, requireSameMonto, maxTolerance = null) => {
            let nextTSD = [];
            pendientesTSD.forEach(tsdRow => {
                const kT = keyGetterT(tsdRow); 
                const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
                let matchIdx = -1;
                if (kT) {
                    matchIdx = bancosDisponibles.findIndex(b => {
                        const kB = keyGetterB(b);
                        const montoBanco = parseFloat(b.Monto_Venta_Original) || 0;
                        let valid = kB === kT && !isBlacklisted(tsdRow.ID_Transaccion, b.IdTransaccion);
                        
                        if (requireSameMonto) {
                            valid = valid && isSameMonto(montoBanco, montoTSD);
                        } else if (maxTolerance !== null) {
                            const gap = Math.abs(Math.abs(montoTSD) - Math.abs(montoBanco));
                            valid = valid && (gap < maxTolerance);
                        }
                        return valid;
                    });
                }
                if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], matchLabel); 
                else nextTSD.push(tsdRow);
            });
            pendientesTSD = nextTSD;
        };

        const runGroupPhase = (keyGetterT, keyGetterB, matchLabelExact, matchLabelSolo, strictMonto, maxTolerance = null) => {
            const groupT = {}, groupB = {};
            pendientesTSD.forEach(r => { const k = keyGetterT(r); if(k) { groupT[k] = groupT[k]||[]; groupT[k].push(r); } });
            bancosDisponibles.forEach(r => { const k = keyGetterB(r); if(k) { groupB[k] = groupB[k]||[]; groupB[k].push(r); } });

            for (const k in groupT) {
                if (groupB[k]) {
                    const arrT = groupT[k], arrB = groupB[k];
                    if (!arrT.some(t => arrB.some(b => isBlacklisted(t.ID_Transaccion, b.IdTransaccion)))) {
                        const sumT = arrT.map(c => parseFloat(c.MontoCRC) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
                        const sumB = arrB.map(c => parseFloat(c.Monto_Venta_Original) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
                        
                        if (isSameMonto(sumT, sumB)) {
                            processMatch(arrT, arrB, matchLabelExact);
                            pendientesTSD = pendientesTSD.filter(t => !arrT.includes(t));
                            bancosDisponibles = bancosDisponibles.filter(b => !arrB.includes(b));
                        } else if (!strictMonto) {
                            let valid = true;
                            if (maxTolerance !== null) {
                                const gap = Math.abs(Math.abs(sumT) - Math.abs(sumB));
                                if (gap >= maxTolerance) valid = false;
                            }
                            if (valid) {
                                processMatch(arrT, arrB, matchLabelSolo);
                                pendientesTSD = pendientesTSD.filter(t => !arrT.includes(t));
                                bancosDisponibles = bancosDisponibles.filter(b => !arrB.includes(b));
                            }
                        }
                    }
                }
            }
        };

        const getAuthT = r => cleanAuth(r.Autorizacion); 
        const getAuthB = r => cleanAuth(r.Numero_Autorizacion);
        const getCardT = r => getCard(r.Tarjeta_Ultimos4); 
        const getCardB = r => getCard(r.Tarjeta_Ultimos4);

        // =========================================================
        // EJECUCIÓN CASCADA M4 (Clon exacto de 9 Fases del Módulo 3)
        // =========================================================
        run1to1Phase(getAuthT, getAuthB, 'Auth+Monto', true);           // Fase 1
        runGroupPhase(getAuthT, getAuthB, 'Auth Grupal+Monto', '', true); // Fase 2
        run1to1Phase(getAuthT, getAuthB, 'Auth Solo', false);           // Fase 3
        runGroupPhase(getAuthT, getAuthB, '', 'Auth Grupal Solo', false); // Fase 4
        
        run1to1Phase(getCardT, getCardB, 'Tarj+Monto', true);           // Fase 5
        runGroupPhase(getCardT, getCardB, 'Tarj Grupal+Monto', '', true); // Fase 6
        
        // --- LIMITE DE TOLERANCIA ESTRICTA (10,000 COLONES) PARA CRUCES SOLO POR TARJETA ---
        run1to1Phase(getCardT, getCardB, 'Tarj Solo', false, 10000);           // Fase 7
        runGroupPhase(getCardT, getCardB, '', 'Tarj Grupal Solo', false, 10000); // Fase 8

        // --- FASE 8.5: AJUSTES INTERNOS (CANCELACIÓN DENTRO DE LA MISMA FUENTE) ---
        const runInternalOffsetPhase = () => {
            // 1. TSD vs TSD (Por Contrato)
            let nextTSD = [];
            let usedTSD = new Set();
            for (let i = 0; i < pendientesTSD.length; i++) {
                if (usedTSD.has(i)) continue;
                let t1 = pendientesTSD[i];
                let k1 = String(t1.Contrato || '').trim().toUpperCase();
                if (!k1 || k1 === 'S/D') { nextTSD.push(t1); continue; }

                let m1 = parseFloat(t1.MontoCRC) || 0;
                let matchIdx = -1;

                for (let j = i + 1; j < pendientesTSD.length; j++) {
                    if (usedTSD.has(j)) continue;
                    let t2 = pendientesTSD[j];
                    let k2 = String(t2.Contrato || '').trim().toUpperCase();
                    
                    if (k1 === k2) {
                        let m2 = parseFloat(t2.MontoCRC) || 0;
                        let key = String(t1.ID_Transaccion).trim() + '|' + String(t2.ID_Transaccion).trim();
                        let reverseKey = String(t2.ID_Transaccion).trim() + '|' + String(t1.ID_Transaccion).trim();

                        // Signos opuestos y brecha menor a 10,000 + Blindaje Blacklist
                        if ((m1 * m2 < 0) && Math.abs(m1 + m2) < 10000 && !this.blacklist.includes(key) && !this.blacklist.includes(reverseKey)) {
                            matchIdx = j; break;
                        }
                    }
                }

                if (matchIdx !== -1) {
                    usedTSD.add(matchIdx);
                    processMatch([t1, pendientesTSD[matchIdx]], [], 'Ajuste Interno TSD');
                } else {
                    nextTSD.push(t1);
                }
            }
            pendientesTSD = nextTSD;

            // 2. Banco vs Banco (Por Autorización)
            let nextBancos = [];
            let usedBancos = new Set();
            for (let i = 0; i < bancosDisponibles.length; i++) {
                if (usedBancos.has(i)) continue;
                let b1 = bancosDisponibles[i];
                let k1 = getAuthB(b1);
                if (!k1) { nextBancos.push(b1); continue; }

                let m1 = parseFloat(b1.Monto_Venta_Original) || 0;
                let matchIdx = -1;

                for (let j = i + 1; j < bancosDisponibles.length; j++) {
                    if (usedBancos.has(j)) continue;
                    let b2 = bancosDisponibles[j];
                    let k2 = getAuthB(b2);

                    if (k1 === k2) {
                        let m2 = parseFloat(b2.Monto_Venta_Original) || 0;
                        let key = String(b1.IdTransaccion).trim() + '|' + String(b2.IdTransaccion).trim();
                        let reverseKey = String(b2.IdTransaccion).trim() + '|' + String(b1.IdTransaccion).trim();

                        // Signos opuestos y brecha menor a 10,000 + Blindaje Blacklist
                        if ((m1 * m2 < 0) && Math.abs(m1 + m2) < 10000 && !this.blacklist.includes(key) && !this.blacklist.includes(reverseKey)) {
                            matchIdx = j; break;
                        }
                    }
                }

                if (matchIdx !== -1) {
                    usedBancos.add(matchIdx);
                    processMatch([], [b1, bancosDisponibles[matchIdx]], 'Ajuste Interno Banco');
                } else {
                    nextBancos.push(b1);
                }
            }
            bancosDisponibles = nextBancos;
        };
        runInternalOffsetPhase();

        // Fase 9: Sugerencia Pura (Monto Solo)
        let nextTSD = [];
        pendientesTSD.forEach(tsdRow => {
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            let matchIdx = -1;
            if (Math.abs(montoTSD) > 0) { 
                matchIdx = bancosDisponibles.findIndex(b => isSameMonto(b.Monto_Venta_Original, montoTSD) && !isBlacklisted(tsdRow.ID_Transaccion, b.IdTransaccion));
            }
            if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], 'Monto Igual');
            else nextTSD.push(tsdRow);
        });
        pendientesTSD = nextTSD;

        // --- FASE 10: AJUSTE MENOR (MONTOS < 10000 SOLITARIOS) ---
        let finalTSD = [];
        pendientesTSD.forEach(tsdRow => {
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            const keyMenor = String(tsdRow.ID_Transaccion).trim() + '|MENOR';
            if (Math.abs(montoTSD) > 0 && Math.abs(montoTSD) < 10000 && !this.blacklist.includes(keyMenor)) { 
                processMatch(tsdRow, [], 'Ajuste Menor');
            } else {
                finalTSD.push(tsdRow);
            }
        });
        pendientesTSD = finalTSD;

        let finalBancos = [];
        bancosDisponibles.forEach(bRow => {
            const montoBanco = parseFloat(bRow.Monto_Venta_Original) || 0;
            const keyMenor = String(bRow.IdTransaccion).trim() + '|MENOR';
            if (Math.abs(montoBanco) > 0 && Math.abs(montoBanco) < 10000 && !this.blacklist.includes(keyMenor)) { 
                processMatch([], bRow, 'Ajuste Menor');
            } else {
                finalBancos.push(bRow);
            }
        });
        bancosDisponibles = finalBancos;
        
        // --- FASE FINAL: PENDIENTES (Sin Pareja) ---
        [...tsdData].forEach(tsdRow => {
            if (!procesadosTSDIds.includes(tsdRow._id)) {
                const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
                let catId = detectCategory([tsdRow], []);
                // La etiqueta puesta por el usuario MANDA sobre la sugerencia automática
                if (tsdRow.ColorEtiqueta && (catId === 1 || catId === 2)) catId = 3;
                
                const rowStyles = { 'orange': 'bg-orange-50 dark:bg-orange-900/10 border-b border-orange-200 dark:border-orange-900', 'amber': 'bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-900', 'yellow': 'bg-yellow-50 dark:bg-yellow-900/10 border-b border-yellow-200 dark:border-yellow-900', 'lime': 'bg-lime-50 dark:bg-lime-900/10 border-b border-lime-200 dark:border-lime-900', 'emerald': 'bg-emerald-50 dark:bg-emerald-900/10 border-b border-emerald-200 dark:border-emerald-900', 'teal': 'bg-teal-50 dark:bg-teal-900/10 border-b border-teal-200 dark:border-teal-900', 'cyan': 'bg-cyan-50 dark:bg-cyan-900/10 border-b border-cyan-200 dark:border-cyan-900', 'blue': 'bg-blue-50 dark:bg-blue-900/10 border-b border-blue-200 dark:border-blue-900', 'indigo': 'bg-indigo-50 dark:bg-indigo-900/10 border-b border-indigo-200 dark:border-indigo-900', 'purple': 'bg-purple-50 dark:bg-purple-900/10 border-b border-purple-200 dark:border-purple-900', 'slate': 'bg-slate-200 dark:bg-slate-800/80 border-b border-slate-300 dark:border-slate-700' };

                let bgClass = '';
                if (catId === 1 || catId === 2) bgClass = this.getEstiloSistema(catId, false);
                else if (tsdRow.ColorEtiqueta) {
                    const tagObj = this.customTags.find(t => t.IdEtiqueta.toString() === tsdRow.ColorEtiqueta.toString());
                    if (tagObj) bgClass = this.TW_COLORS[tagObj.ColorCSS] || '';
                }

                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9), _tsdRaw: tsdRow, _bancoRaw: null, _rowClass: bgClass, _isMulti: false,
                    _categoriaId: catId, _dbId: tsdRow.ID_Transaccion, _colorEtiq: tsdRow.ColorEtiqueta, _notaEtiq: tsdRow.NotaUsuario,
                    Contrato: tsdRow.Contrato, Cliente: tsdRow.Cliente, TarjetaTSD: getCard(tsdRow.Tarjeta_Ultimos4) ? `****${getCard(tsdRow.Tarjeta_Ultimos4)}` : 'S/D',
                    Autorizacion: tsdRow.Autorizacion, MontoTSD: { valor: montoTSD, recibo: tsdRow.Recibo_Detalle || '', valueOf: function(){return this.valor;}, toString: function(){return this.valor.toString();} },
                    EstadoMatch: 'Pendiente', Banco_Nombre: '-', Banco_Auth: '-', Banco_Monto: 0, Diferencia: montoTSD
                });
            }
        });

        [...bancosData].forEach(b => {
            if (!procesadosBancosIds.includes(b._id)) {
                const m = parseFloat(b.Monto_Venta_Original);
                let catId = detectCategory([], [b]);
                // La etiqueta puesta por el usuario MANDA sobre la sugerencia automática
                if (b.ColorEtiqueta && (catId === 1 || catId === 2)) catId = 3;
                
                const rowStyles = { 'orange': 'bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 italic border-b border-orange-200 dark:border-orange-900', 'amber': 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 italic border-b border-amber-200 dark:border-amber-900', 'yellow': 'bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-400 italic border-b border-yellow-200 dark:border-yellow-900', 'lime': 'bg-lime-50 dark:bg-lime-900/10 text-lime-700 dark:text-lime-400 italic border-b border-lime-200 dark:border-lime-900', 'emerald': 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 italic border-b border-emerald-200 dark:border-emerald-900', 'teal': 'bg-teal-50 dark:bg-teal-900/10 text-teal-700 dark:text-teal-400 italic border-b border-teal-200 dark:border-teal-900', 'cyan': 'bg-cyan-50 dark:bg-cyan-900/10 text-cyan-700 dark:text-cyan-400 italic border-b border-cyan-200 dark:border-cyan-900', 'blue': 'bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 italic border-b border-blue-200 dark:border-blue-900', 'indigo': 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-400 italic border-b border-indigo-200 dark:border-indigo-900', 'purple': 'bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400 italic border-b border-purple-200 dark:border-purple-900', 'slate': 'bg-slate-200 dark:bg-slate-800/80 text-slate-700 dark:text-slate-400 italic border-b border-slate-300 dark:border-slate-700' };

                let bgClass = 'text-slate-500 italic border-b border-slate-100 dark:border-slate-800';
                if (catId === 1 || catId === 2) bgClass = this.getEstiloSistema(catId, true);
                else if (b.ColorEtiqueta) {
                    const tagObj = this.customTags.find(t => t.IdEtiqueta.toString() === b.ColorEtiqueta.toString());
                    if (tagObj) bgClass = this.TW_COLORS[tagObj.ColorCSS] + ' italic';
                }

                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9), _tsdRaw: null, _bancoRaw: b, _isMulti: false,
                    _categoriaId: catId, _dbId: b.IdTransaccion, _colorEtiq: b.ColorEtiqueta, _notaEtiq: b.NotaUsuario,
                    _rowClass: bgClass, Contrato: 'Solo Banco', Cliente: b.Nombre_Sucursal_Comercio,
                    TarjetaTSD: b.Tarjeta_Ultimos4 ? `****${b.Tarjeta_Ultimos4}` : 'S/D', Autorizacion: '-', MontoTSD: { valor: 0, recibo: '', valueOf: function(){return this.valor;} },
                    EstadoMatch: 'Pendiente', Banco_Nombre: b.Banco, Banco_Auth: b.Numero_Autorizacion, Banco_Monto: m, Diferencia: 0 - m
                });
            }
        });

        // --- ORDENAMIENTO ESTRICTO DE 9 FASES Y BLOQUES ---
        gridData.sort((a, b) => {
            // 1. Categoría Principal (1: Contracargos, 2: Devoluciones, 3: Regulares)
            if (a._categoriaId !== b._categoriaId) return a._categoriaId - b._categoriaId;
            
            // 2. Agrupación Semántica (Agrupar por ID de etiqueta, los etiquetados van primero)
            const idA = a._colorEtiq ? parseInt(a._colorEtiq) : 999999;
            const idB = b._colorEtiq ? parseInt(b._colorEtiq) : 999999;
            if (idA !== idB) return idA - idB;

            // 3. Peso original del algoritmo (Para los que tienen el mismo color o no tienen)
            const getWeight = (row) => {
                const st = String(row.EstadoMatch);
                if (st.startsWith('Manual')) return 0;
                if (st.includes('Auth+Monto')) return 1;
                if (st.includes('Auth Grupal+Monto')) return 2;
                if (st.includes('Auth Solo')) return 3;
                if (st.includes('Auth Grupal Solo')) return 4;
                if (st.includes('Tarj+Monto')) return 5;
                if (st.includes('Tarj Grupal+Monto')) return 6;
                if (st.includes('Tarj Solo')) return 7;
                if (st.includes('Tarj Grupal Solo')) return 8;
                if (st.includes('Monto Igual')) return 9; // Sugerencia de Monto
                return 10; // Pendientes Puros
            };
            const wA = getWeight(a), wB = getWeight(b);
            if (wA !== wB) return wA - wB;
            return String(a.Contrato).localeCompare(String(b.Contrato));
        });

        let cAprob = 0, cSug = 0, cHuer = 0;
        gridData.forEach(r => { 
            const st = String(r.EstadoMatch);
            
            if (st.startsWith('Manual')) {
                cAprob++; // Aprobados por el usuario
            } else {
                cHuer++; // Todo lo que no está aprobado, sigue siendo Huérfano
                
                // Sub-contador: De este total de huérfanos, ¿cuántos tienen sugerencia del algoritmo?
                if (st.startsWith('Sugerencia') && !st.includes('Monto Igual')) {
                    cSug++; 
                }
            }
        });
        
        const elAprob = document.getElementById('count-m4-aprob');
        const elSug = document.getElementById('count-m4-sug');
        const elHuer = document.getElementById('count-m4-huer');
        if (elAprob) elAprob.innerText = cAprob;
        if (elSug) elSug.innerText = cSug; 
        if (elHuer) elHuer.innerText = cHuer;

        // SEPARACIÓN FÍSICA APROBACIÓN EXPLÍCITA:
        // Tabla Superior (Aprobadas): SOLAMENTE lo que el usuario ha guardado en el PopUp (Manual)
        this.currentSugData = gridData.filter(r => String(r.EstadoMatch).startsWith('Manual'));
        // Tabla Inferior (Bandeja): Todo lo demás (Sugerencias 1 a 9 y Pendientes)
        this.currentLimboData = gridData.filter(r => !String(r.EstadoMatch).startsWith('Manual'));
        
        this.renderGrid();
    },

    renderGrid: function() {
        const fmtMoney = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v||0).replace(/\./g, ' ');

        const renderMulti = (row, isTsdSide, field) => {
            const raw = isTsdSide ? row._tsdRaw : row._bancoRaw;
            if (!raw || (Array.isArray(raw) && raw.length === 0)) return '<span class="text-slate-300 dark:text-slate-600">-</span>';
            const arr = Array.isArray(raw) ? raw : [raw];
            return '<div class="flex flex-col h-full w-full">' + arr.map(t => {
                let val = '';
                if (field === 'Contrato') val = t.Contrato || 'S/D';
                else if (field === 'Cliente') val = `<div class="truncate" title="${t.Cliente || 'S/D'}">${t.Cliente || 'S/D'}</div>`;
                else if (field === 'Autorizacion') val = t.Autorizacion || '-';
                else if (field === 'MontoTSD') val = `<div class="flex flex-col items-end w-full"><span class="font-bold text-slate-800 dark:text-slate-200">${fmtMoney(parseFloat(t.MontoCRC) || 0)}</span>${t.Recibo_Detalle ? `<div class="text-[9px] text-orange-600 truncate mt-0.5 w-full text-right" title="${t.Recibo_Detalle}">${t.Recibo_Detalle}</div>` : ''}</div>`;
                else if (field === 'Banco_Nombre') val = t.Banco || '-';
                else if (field === 'Banco_Auth') val = t.Numero_Autorizacion || '-';
                else if (field === 'Banco_Monto') val = `<div class="w-full text-right">${fmtMoney(parseFloat(t.Monto_Venta_Original) || 0)}</div>`;
                
                return `<div class="flex-1 flex flex-col justify-center border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 py-1.5 min-h-[36px]">${val}</div>`;
            }).join('') + '</div>';
        };

        const columns = [
            { 
                title: "Contrato", field: "Contrato", width: 150, cssClass: "font-mono font-bold pt-1",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    let badge = '';
                    
                    if (row._categoriaId === 1 || row._categoriaId === 2) {
                        const nombreSis = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
                        const tagSis = window.AuxiliarLogic.customTags.find(t => Number(t.EsSistema) === 1 && t.Nombre === nombreSis);
                        const cssSis = window.AuxiliarLogic.TW_COLORS[tagSis ? tagSis.ColorCSS : (row._categoriaId === 1 ? 'rose' : 'fuchsia')] || '';
                        const icono = row._categoriaId === 1 ? '🛑' : '🔄';
                        badge = `<span class="block mb-1 text-[9px] font-black uppercase ${cssSis} border px-1 py-0.5 rounded w-max tracking-wider shadow-sm select-none">${icono} ${nombreSis}</span>`;
                    } else if (row._colorEtiq) {
                        const tagObj = window.AuxiliarLogic.customTags.find(t => t.IdEtiqueta.toString() === row._colorEtiq.toString());
                        if (tagObj) {
                            const css = window.AuxiliarLogic.TW_COLORS[tagObj.ColorCSS] || window.AuxiliarLogic.TW_COLORS['slate'];
                            badge = `<span class="block mb-1 text-[9px] font-black uppercase ${css} border px-1 py-0.5 rounded w-max tracking-wider shadow-sm select-none" title="${tagObj.Descripcion || ''}">🏷️ ${tagObj.Nombre}</span>`;
                        }
                    }

                    if (row._isMulti) {
                        return `<div>${badge}${renderMulti(row, true, 'Contrato')}</div>`;
                    }
                    
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    return `<div>${badge}${val}</div>`;
                }
            },
            { 
                title: "Cliente / Notas", field: "Cliente", width: 180, cssClass: "text-[10px]",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    const cleanVal = val || '-';
                    
                    let textClass = 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600';
                    if (row._colorEtiq) {
                        const tObj = window.AuxiliarLogic.customTags.find(t => t.IdEtiqueta.toString() === row._colorEtiq.toString());
                        if (tObj) textClass = `text-${tObj.ColorCSS}-700 dark:text-${tObj.ColorCSS}-300 border-${tObj.ColorCSS}-300 dark:border-${tObj.ColorCSS}-700`;
                    }
                    let notaHtml = row._notaEtiq ? `<div class="mt-1 text-[9px] font-bold ${textClass} italic leading-tight bg-white/50 dark:bg-black/20 p-1.5 rounded border shadow-sm break-words whitespace-normal max-w-full"><span class="mr-1">💬</span>${row._notaEtiq}</div>` : '';
                    
                    let contentHtml = '';
                    if (row._isMulti) {
                        contentHtml = renderMulti(row, true, 'Cliente');
                    } else {
                        contentHtml = `<div class="truncate" title="${cleanVal}">${cleanVal}</div>`;
                    }

                    return `
                    <div class="flex flex-col relative pr-6 min-h-[20px]">
                        <div class="flex justify-between items-center w-full">
                            ${contentHtml}
                        </div>
                        ${(!row._isMulti && row._dbId) ? `<button onclick="event.stopPropagation(); window.AuxiliarLogic.openEtiquetaModal('${row._uid}')" class="absolute right-0 top-0 opacity-40 hover:opacity-100 transition-opacity p-0.5 bg-slate-200 dark:bg-slate-700 rounded hover:bg-blue-100 hover:text-blue-600 text-slate-800 dark:text-white" title="Añadir Etiqueta">🏷️</button>` : ''}
                        ${notaHtml}
                    </div>`;
                }
            },
            { 
                title: "Auth TSD", field: "Autorizacion", width: 90, cssClass: "font-mono", hozAlign: "center",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, true, 'Autorizacion');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Monto TSD / Detalle", field: "MontoTSD", width: 150, hozAlign: "right", bottomCalc: "sum",
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-800 dark:text-white">${fmtMoney(val)}</span>`,
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, true, 'MontoTSD');

                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    const valor = typeof val === 'object' && val !== null && 'valor' in val ? val.valor : val;
                    const recibo = typeof val === 'object' && val !== null && 'recibo' in val ? val.recibo : '';
                    
                    const recHtml = recibo ? `<div class="text-[9px] text-orange-600 dark:text-orange-400 italic truncate font-medium mt-0.5" title="${recibo}">${recibo}</div>` : '';
                    return `<div class="flex flex-col justify-center items-end h-full"><span class="font-bold text-slate-800 dark:text-slate-200">${fmtMoney(valor)}</span>${recHtml}</div>`;
                },
                headerFilterFunc: (term, val) => {
                    const strVal = typeof val === 'object' && val !== null ? `${val.valor} ${val.recibo}` : String(val);
                    return String(strVal).toLowerCase().includes(String(term).toLowerCase());
                }
            },
            { 
                title: "ESTADO AUX", field: "EstadoMatch", width: 180, hozAlign: "center",
                cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-white/30 dark:bg-black/20 font-bold",
                formatter: (cell) => {
                    const val = String(cell.getValue());
                    if(val.startsWith('Manual')) return `<span class="text-green-700 dark:text-green-400">✅ Aprobado Manual</span>`;
                    if(val.includes('Monto Igual')) return `<span class="text-amber-600 dark:text-amber-400">⚠️ Sug: Monto Igual</span>`;
                    if(val.includes('Ajuste Menor')) return `<span class="text-purple-600 dark:text-purple-400">✂️ ${val.replace('Sugerencia: ','')}</span>`;
                    if(val.includes('Ajuste Interno')) return `<span class="text-cyan-600 dark:text-cyan-400">🔄 ${val.replace('Sugerencia: ','').replace('Ajuste Interno ', 'Ajuste ')}</span>`;
                    if(val.startsWith('Sugerencia')) return `<span class="text-amber-700 dark:text-amber-300">💡 ${val.replace('Sugerencia: ','')}</span>`;
                    return `<span class="text-slate-500 font-bold">⏳ Pendiente</span>`;
                }
            },
            { 
                title: "Banco", field: "Banco_Nombre", width: 90, hozAlign: "center", cssClass: "text-blue-600 font-bold",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, false, 'Banco_Nombre');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Auth Banco", field: "Banco_Auth", width: 90, cssClass: "font-mono", hozAlign: "center",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, false, 'Banco_Auth');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Monto", field: "Banco_Monto", hozAlign: "right", bottomCalc: "sum",
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-800 dark:text-white">${fmtMoney(val)}</span>`,
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, false, 'Banco_Monto');
                    return fmtMoney(typeof cell === 'object' && cell.getValue ? cell.getValue() : cell);
                }
            },
            { title: "Dif", field: "Diferencia", hozAlign: "right", formatter: "money", cssClass: "font-bold text-red-500" },
            {
                title: "📝 Nota", field: "_notaEtiq", width: 200, cssClass: "text-[10px]",
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    if (!val) return '<span class="text-slate-300 dark:text-slate-600">-</span>';
                    return `<div class="italic font-medium text-slate-600 dark:text-slate-300 break-words whitespace-normal leading-tight" title="${val}">💬 ${val}</div>`;
                }
            }
        ];

        if (this.gridSug) this.gridSug.updateData(this.currentSugData);
        else this.gridSug = new VanillaGrid("#table-sug-m4", this.currentSugData, columns, { searchInputId: "search-m4", onRowDblClick: (r) => window.AuxiliarLogic.openTransactionModal(r) });

        if (this.gridLimbo) this.gridLimbo.updateData(this.currentLimboData);
        else this.gridLimbo = new VanillaGrid("#table-limbo-m4", this.currentLimboData, columns, { 
            searchInputId: "search-m4", 
            onRowDblClick: (r) => window.AuxiliarLogic.openTransactionModal(r),
            onRowContextMenu: (r, e, menu) => window.AuxiliarLogic.abrirMenuEtiquetas(r, e, menu),
            exportRowColor: (r) => window.AuxiliarLogic.getColorExport(r)
        });
    },

    openTransactionModal: function(row) {
        if (!row) return;

        const tRaw = row._tsdRaw ? (Array.isArray(row._tsdRaw) ? [...row._tsdRaw] : [row._tsdRaw]) : [];
        const bRaw = row._bancoRaw ? (Array.isArray(row._bancoRaw) ? [...row._bancoRaw] : [row._bancoRaw]) : [];
        
        let justTexto = '';
        if (String(row.EstadoMatch).startsWith('Manual|')) justTexto = row.EstadoMatch.split('|')[1] || '';
        
        this.ws = {
            tsd: [...tRaw], bancos: [...bRaw],
            originalTsd: [...tRaw], originalBancos: [...bRaw],
            rowUid: row._uid, justificacion: justTexto
        };

        const isDark = document.documentElement.classList.contains('dark');
        const width = 1100, height = 750;
        const left = (screen.width - width) / 2, top = (screen.height - height) / 2;
        
        if (this.wsWindow && !this.wsWindow.closed) this.wsWindow.close();
        this.wsWindow = window.open('', 'AuxiliarManual', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
        
        const html = `
        <!DOCTYPE html>
        <html lang="es" class="${isDark ? 'dark' : ''}">
        <head>
            <meta charset="UTF-8">
            <title>Estación Auxiliar Histórica</title>
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
                    <span class="p-1.5 bg-orange-100 text-orange-700 rounded-lg">⚖️</span> Estación Auxiliar
                </h2>
                <div class="flex items-center gap-6">
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Diferencia Neta</span>
                        <span id="ws-diff" class="text-2xl font-mono font-black">0.00</span>
                    </div>
                    <button onclick="saveAndClose()" class="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all text-sm flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        Aprobar Ajuste Manual
                    </button>
                </div>
            </header>

            <main class="flex-1 flex gap-4 p-4 overflow-hidden h-full">
                <!-- PANEL TSD -->
                <div class="flex-1 flex flex-col gap-2 overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 flex justify-between items-center shrink-0">
                        <h3 class="font-black text-purple-700 dark:text-purple-400 text-xs tracking-wider">TSD HISTÓRICO</h3>
                        <span class="text-[10px] font-bold text-slate-400" id="ws-count-tsd">0</span>
                    </div>
                    <div class="h-[40%] overflow-auto p-2 space-y-1.5" id="ws-sel-tsd"></div>
                    <div class="bg-purple-50 dark:bg-purple-900/20 border-y border-purple-200 dark:border-purple-800 p-1.5 shrink-0 relative">
                        <input type="text" id="ws-search-tsd" oninput="renderUI()" placeholder="Buscar en TSD (Contrato, Auth, Monto)..." class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-xs outline-none">
                        <span class="absolute left-3 top-2.5 text-purple-400 text-sm">🔍</span>
                    </div>
                    <div class="flex-1 overflow-auto p-2 bg-slate-50/50 dark:bg-slate-900/30" id="ws-sug-tsd"></div>
                </div>
                
                <!-- PANEL BANCOS -->
                <div class="flex-1 flex flex-col gap-2 overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 flex justify-between items-center shrink-0">
                        <h3 class="font-black text-blue-700 dark:text-blue-400 text-xs tracking-wider">BANCOS HISTÓRICO</h3>
                        <span class="text-[10px] font-bold text-slate-400" id="ws-count-bancos">0</span>
                    </div>
                    <div class="h-[40%] overflow-auto p-2 space-y-1.5" id="ws-sel-bancos"></div>
                    <div class="bg-blue-50 dark:bg-blue-900/20 border-y border-blue-200 dark:border-blue-800 p-1.5 shrink-0 relative">
                        <input type="text" id="ws-search-banco" oninput="renderUI()" placeholder="Buscar en Banco (Auth, Tarjeta, Monto)..." class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-xs outline-none">
                        <span class="absolute left-3 top-2.5 text-blue-400 text-sm">🔍</span>
                    </div>
                    <div class="flex-1 overflow-auto p-2 bg-slate-50/50 dark:bg-slate-900/30" id="ws-sug-bancos"></div>
                </div>
            </main>

            <footer id="ws-footer" class="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 shrink-0 hidden">
                <div class="flex flex-col max-w-4xl mx-auto">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Justificación Auxiliar (Opcional)</span>
                    <input type="text" id="ws-just" placeholder="Escriba aquí el motivo del cruce histórico..." class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-700 dark:text-slate-200">
                </div>
            </footer>

            <!-- MODAL NATIVO DEL POPUP PARA AJUSTE MENOR -->
            <div id="ws-mini-modal" class="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300">
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col" id="ws-mini-card">
                    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <h3 class="text-lg font-bold text-amber-600 dark:text-amber-400">⚠️ Ajuste Menor Detectado</h3>
                    </div>
                    <div class="px-6 py-5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        Ha dejado una única transacción menor a ₡10,000.
                        
                        ¿Desea guardarla como 'Ajuste Menor' (se marcará como conciliada sola) o prefiere cancelar y dejarla pendiente?
                    </div>
                    <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                        <button onclick="closeMiniModal()" class="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-colors">Cancelar</button>
                        <button onclick="confirmMiniModal()" class="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors">Confirmar Ajuste</button>
                    </div>
                </div>
            </div>

            <script>
                // Funciones del Mini-Modal
                function openMiniModal() {
                    const overlay = document.getElementById('ws-mini-modal');
                    const card = document.getElementById('ws-mini-card');
                    overlay.classList.remove('hidden');
                    requestAnimationFrame(() => {
                        overlay.classList.remove('opacity-0');
                        card.classList.remove('scale-95');
                    });
                }
                
                function closeMiniModal() {
                    const overlay = document.getElementById('ws-mini-modal');
                    const card = document.getElementById('ws-mini-card');
                    overlay.classList.add('opacity-0');
                    card.classList.add('scale-95');
                    setTimeout(() => overlay.classList.add('hidden'), 300);
                }

                async function confirmMiniModal() {
                    closeMiniModal();
                    const justInput = document.getElementById('ws-just');
                    let justificacion = justInput ? justInput.value.trim() : '';
                    justificacion = justificacion ? justificacion : 'Aprobación Manual (Ajuste Menor)';
                    
                    const proceed = await parentLogic.wsSave(justificacion, true);
                    if (proceed !== false) window.close();
                }

                // Se utiliza 'var' en lugar de 'const' para evitar el error de "Identifier has already been declared"
                // cuando el navegador recicla la memoria de la ventana emergente al cerrarla y abrirla muy rápido.
                var parentLogic = window.opener.AuxiliarLogic;
                var fmt = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v).replace(/\\./g, ' ');
                var clean = (s) => String(s||'').toLowerCase().trim();

                // Extraemos todo el contenido de la tabla inferior (Sugerencias + Pendientes) para alimentar el PopUp
                var limboData = parentLogic.currentLimboData || [];
                // flatMap extrae los arrays de sugerencias grupales, y .filter(Boolean) remueve los nulos (ej: si un Pendiente era solo de banco, TSD es null)
                var allPendientesT = limboData.flatMap(r => Array.isArray(r._tsdRaw) ? r._tsdRaw : [r._tsdRaw]).filter(Boolean);
                var allPendientesB = limboData.flatMap(r => Array.isArray(r._bancoRaw) ? r._bancoRaw : [r._bancoRaw]).filter(Boolean);

                function buildCard(t, isTsd, isSelected) {
                    const bgColor = isTsd ? 'purple' : 'blue';
                    const iconAction = isSelected ? '&times;' : '+';
                    const btnClass = isSelected ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-0.5 font-black text-lg' : \`bg-\${bgColor}-100 text-\${bgColor}-700 px-2 font-bold shadow-sm text-sm hover:bg-\${bgColor}-200\`;
                    
                    const wrapClass = isSelected 
                        ? \`flex flex-col p-2 bg-white dark:bg-slate-700 border-l-4 border-\${bgColor}-500 border-y border-r border-slate-200 dark:border-slate-600 rounded-lg shadow-sm\` 
                        : "flex flex-col p-2 border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer";
                    
                    const side = isTsd ? 'tsd' : 'bancos';
                    const id = t._id;
                    const topL = isTsd ? t.Contrato : t.Banco;
                    const topR = isTsd ? t.Cliente : t.Nombre_Sucursal_Comercio;
                    const monto = isTsd ? t.MontoCRC : t.Monto_Venta_Original;
                    const auth = isTsd ? t.Autorizacion : t.Numero_Autorizacion;
                    const card = t.Tarjeta_Ultimos4;
                    const fecha = isTsd ? t.Fecha : (t.FechaTransaccion || t.Fecha_Pago_Excel);

                    // --- Construir Acordeón Específico según la Fuente ---
                    let detallesHtml = '';
                    if (isTsd) {
                        detallesHtml = \`
                        <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                            <div class="col-span-2 text-slate-600 dark:text-slate-300"><b>Recibo/Detalle:</b> \${t.Recibo_Detalle || '<i>Sin descripción</i>'}</div>
                            <div><b>Fecha Pago:</b> \${t.Fecha || '-'}</div>
                            <div><b>Tipo Tarjeta:</b> \${t.Tipo || '-'}</div>
                            <div><b>ICD:</b> \${t.ICD || '-'}</div>
                            <div><b>Sucursal:</b> \${t.Sucursal || '-'} (\${t.SucursalCod || '-'})</div>
                            <div class="col-span-2 truncate" title="\${t.RecibidoPor}"><b>Agente:</b> \${t.RecibidoPor || '-'}</div>
                            <div class="col-span-2 border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                                <b class="text-green-600 dark:text-green-400">Monto Origen USD:</b> $\${t.MontoUSD || 0} <span class="text-slate-400 ml-2">(T.C. Aplicado: ₡\${t.TC || 1})</span>
                            </div>
                        </div>\`;
                    } else {
                        detallesHtml = \`
                        <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                            <div><b>Fecha Pago (Excel):</b> \${t.Fecha_Pago_Excel || '-'}</div>
                            <div><b>Folio Origen:</b> \${t.Folio_Cierre || '-'}</div>
                            <div class="col-span-2"><b>Afiliado/MerID:</b> \${t.Afiliado_MerID || '-'}</div>
                            <div class="col-span-2"><b>Terminal:</b> \${t.Codigo_Sucursal_Terminal || '-'}</div>
                            <div class="col-span-2 text-amber-600 dark:text-amber-500 mt-1 border-t border-amber-100 dark:border-amber-900/30 pt-1 hidden" id="ajuste-\${id}">
                                <b>Ajuste Manual Orig:</b> \${t.TipoAjuste || ''} - \${t.Justificacion || ''}
                            </div>
                        </div>\`;
                    }

                    return \`
                    <div class="\${wrapClass}">
                        <div class="flex justify-between items-start" \${!isSelected ? \`onclick="parentLogic.wsAdd('\${side}', '\${id}'); renderUI();"\` : ''}>
                            <div class="flex flex-col w-full pr-2">
                                <span class="font-bold text-[11px] text-\${bgColor}-600 dark:text-\${bgColor}-400 font-mono">\${topL}</span>
                                <span class="text-[10px] text-slate-500 truncate" title="\${topR}">\${topR || '-'}</span>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <span class="font-mono font-bold text-sm \${monto < 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}">\${fmt(monto)}</span>
                                <button onclick="event.stopPropagation(); parentLogic.ws\${isSelected?'Remove':'Add'}('\${side}', '\${id}'); renderUI();" class="\${btnClass} rounded transition-colors">\${iconAction}</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1.5" \${!isSelected ? \`onclick="parentLogic.wsAdd('\${side}', '\${id}'); renderUI();"\` : ''}>
                            <span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-mono">Auth: <b>\${auth||'-'}</b></span>
                            <span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-mono">Tarj: ****\${card||'S/D'}</span>
                            <span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px]">📅 \${fecha||'-'}</span>
                        </div>
                        
                        <details class="mt-1.5 group" onclick="event.stopPropagation();">
                            <summary class="text-[9px] text-\${bgColor}-600 dark:text-\${bgColor}-400 cursor-pointer hover:underline list-none font-medium flex items-center gap-1 select-none [&::-webkit-details-marker]:hidden">
                                <svg class="w-3 h-3 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg> 
                                Más información \${isTsd ? 'TSD' : 'Banco'}
                            </summary>
                            \${detallesHtml}
                        </details>
                        
                        <script>
                            // Script inline para mostrar la justificación solo si es un ajuste manual de origen
                            if (!\${isTsd} && '\${t.TipoAjuste}' !== '' && '\${t.TipoAjuste}' !== 'undefined') {
                                document.getElementById('ajuste-\${id}').classList.remove('hidden');
                            }
                        <\\/script>
                    </div>\`;
                }

                function renderUI() {
                    const ws = parentLogic.ws;
                    
                    // Colocar primero los datos en orden de mayor a menor (por magnitud) para sumar correctamente positivos y negativos
                    const sumT = ws.tsd
                        .map(c => c ? (parseFloat(c.MontoCRC) || 0) : 0)
                        .sort((a, b) => Math.abs(b) - Math.abs(a))
                        .reduce((acc, val) => acc + val, 0);

                    const sumB = ws.bancos
                        .map(c => c ? (parseFloat(c.Monto_Venta_Original) || 0) : 0)
                        .sort((a, b) => Math.abs(b) - Math.abs(a))
                        .reduce((acc, val) => acc + val, 0);
                    
                    // Diferencia Contable Real: Tomar el mayor, restarle el menor y conservar el signo del mayor
                    const absT = Math.abs(sumT);
                    const absB = Math.abs(sumB);
                    const gap = Math.abs(absT - absB); // Brecha absoluta para las sugerencias
                    
                    let diff = 0;
                    if (absT >= absB) {
                        diff = sumT < 0 ? -gap : gap;
                    } else {
                        diff = sumB < 0 ? -gap : gap;
                    }
                    
                    const diffEl = document.getElementById('ws-diff');
                    diffEl.innerText = fmt(diff);
                    diffEl.className = \`text-2xl font-mono font-black \${Math.abs(diff) < 2 ? 'text-green-500' : 'text-red-500'}\`;
                    document.getElementById('ws-count-tsd').innerText = ws.tsd.length;
                    document.getElementById('ws-count-bancos').innerText = ws.bancos.length;

                    document.getElementById('ws-sel-tsd').innerHTML = ws.tsd.map(t => buildCard(t, true, true)).join('') || '<div class="text-center text-slate-400 text-xs mt-10 italic">Vacío</div>';
                    document.getElementById('ws-sel-bancos').innerHTML = ws.bancos.map(b => buildCard(b, false, true)).join('') || '<div class="text-center text-slate-400 text-xs mt-10 italic">Vacío</div>';

                    let availableT = allPendientesT.filter(t => t && !ws.tsd.some(w => w._id === t._id));
                    let availableB = allPendientesB.filter(b => b && !ws.bancos.some(w => w._id === b._id));

                    const termT = clean(document.getElementById('ws-search-tsd')?.value || '');
                    if (termT) availableT = availableT.filter(t => clean(t.Contrato).includes(termT) || clean(t.Autorizacion).includes(termT) || clean(t.MontoCRC).includes(termT));
                    else availableT = availableT.sort((a,b) => Math.abs(parseFloat(a.MontoCRC)-gap) - Math.abs(parseFloat(b.MontoCRC)-gap));

                    document.getElementById('ws-sug-tsd').innerHTML = availableT.slice(0,50).map(t => buildCard(t, true, false)).join('');

                    const termB = clean(document.getElementById('ws-search-banco')?.value || '');
                    if (termB) availableB = availableB.filter(b => clean(b.Numero_Autorizacion).includes(termB) || clean(b.Monto_Venta_Original).includes(termB));
                    else availableB = availableB.sort((a,b) => Math.abs(parseFloat(a.Monto_Venta_Original)-gap) - Math.abs(parseFloat(b.Monto_Venta_Original)-gap));

                    document.getElementById('ws-sug-bancos').innerHTML = availableB.slice(0,50).map(b => buildCard(b, false, false)).join('');

                    const footer = document.getElementById('ws-footer');
                    if (ws.tsd.length > 0 && ws.bancos.length > 0) footer.classList.remove('hidden');
                    else footer.classList.add('hidden');
                }

                async function saveAndClose() {
                    const justInput = document.getElementById('ws-just');
                    let justificacion = justInput ? justInput.value.trim() : '';
                    
                    let isAjusteMenor = false;
                    if (parentLogic.ws.tsd.length === 1 && parentLogic.ws.bancos.length === 0 && Math.abs(parseFloat(parentLogic.ws.tsd[0].MontoCRC) || 0) < 10000) {
                        isAjusteMenor = true;
                    } else if (parentLogic.ws.bancos.length === 1 && parentLogic.ws.tsd.length === 0 && Math.abs(parseFloat(parentLogic.ws.bancos[0].Monto_Venta_Original) || 0) < 10000) {
                        isAjusteMenor = true;
                    }

                    if (isAjusteMenor) {
                        openMiniModal();
                        return; // Se interrumpe el flujo; el usuario decidirá en el mini modal
                    }

                    const proceed = await parentLogic.wsSave(justificacion, false);
                    if (proceed !== false) window.close();
                }

                document.addEventListener('DOMContentLoaded', () => {
                    const justInput = document.getElementById('ws-just');
                    if (justInput) justInput.value = parentLogic.ws.justificacion || '';
                    renderUI();
                });
            </script>
        </body>
        </html>`;
        
        this.wsWindow.document.write(html);
        this.wsWindow.document.close();
    },

    wsAdd: function(side, id) {
        if (side === 'tsd') {
            const found = this.lastTSD.find(t => t && t._id === id);
            // Evitamos agregar si no existe o si ya fue agregado previamente a la lista
            if (found && !this.ws.tsd.some(x => x._id === id)) this.ws.tsd.push(found);
        } else {
            const found = this.lastBancos.find(b => b && b._id === id);
            if (found && !this.ws.bancos.some(x => x._id === id)) this.ws.bancos.push(found);
        }
    },

    wsRemove: function(side, id) {
        // Filtramos asegurándonos de que t no sea undefined para evitar crashes
        if (side === 'tsd') this.ws.tsd = this.ws.tsd.filter(t => t && t._id !== id);
        else this.ws.bancos = this.ws.bancos.filter(b => b && b._id !== id);
    },

    wsSave: async function(justificacion = '', isAjusteMenor = false) {
        const removedTsd = this.ws.originalTsd.filter(t => !this.ws.tsd.some(x => x._id === t._id));
        const removedBancos = this.ws.originalBancos.filter(b => !this.ws.bancos.some(x => x._id === b._id));

        // Regla 1: Blindaje contra Auto-Unión Exacta (Blacklist de Cruces Rotos)
        // Registrar rechazo de Ajustes Menores para que la Fase 10 no los vuelva a atrapar
        removedTsd.forEach(t => this.blacklist.push(String(t.ID_Transaccion).trim() + '|MENOR'));
        removedBancos.forEach(b => this.blacklist.push(String(b.IdTransaccion).trim() + '|MENOR'));
        // A. TSD vs Banco
        this.ws.originalTsd.forEach(t => {
            this.ws.originalBancos.forEach(b => {
                // En M4 usamos ID_Transaccion para ser perfectamente exactos (Igual que M3)
                const key = String(t.ID_Transaccion).trim() + '|' + String(b.IdTransaccion).trim();
                if (!this.blacklist.includes(key)) this.blacklist.push(key);
            });
        });
        // B. TSD vs TSD (Evitar re-agrupar Ajustes Internos)
        for (let i = 0; i < this.ws.originalTsd.length; i++) {
            for (let j = i + 1; j < this.ws.originalTsd.length; j++) {
                const key = String(this.ws.originalTsd[i].ID_Transaccion).trim() + '|' + String(this.ws.originalTsd[j].ID_Transaccion).trim();
                const reverseKey = String(this.ws.originalTsd[j].ID_Transaccion).trim() + '|' + String(this.ws.originalTsd[i].ID_Transaccion).trim();
                if (!this.blacklist.includes(key)) this.blacklist.push(key);
                if (!this.blacklist.includes(reverseKey)) this.blacklist.push(reverseKey);
            }
        }
        // C. Banco vs Banco (Evitar re-agrupar Ajustes Internos)
        for (let i = 0; i < this.ws.originalBancos.length; i++) {
            for (let j = i + 1; j < this.ws.originalBancos.length; j++) {
                const key = String(this.ws.originalBancos[i].IdTransaccion).trim() + '|' + String(this.ws.originalBancos[j].IdTransaccion).trim();
                const reverseKey = String(this.ws.originalBancos[j].IdTransaccion).trim() + '|' + String(this.ws.originalBancos[i].IdTransaccion).trim();
                if (!this.blacklist.includes(key)) this.blacklist.push(key);
                if (!this.blacklist.includes(reverseKey)) this.blacklist.push(reverseKey);
            }
        }
        
        const originTsdIds = this.ws.originalTsd.map(t => t._id);
        const originBancoIds = this.ws.originalBancos.map(b => b._id);
        
        this.manualMatches = this.manualMatches.filter(m => {
            const hasTsdCollision = m.tsdArr.some(t => originTsdIds.includes(t._id));
            const hasBancoCollision = m.bancoArr.some(b => originBancoIds.includes(b._id));
            return !hasTsdCollision && !hasBancoCollision;
        });

        // REGLA DE ORO ACTUALIZADA: Válido si vincula TSD vs Banco, O si vincula múltiples TSD (Ajuste Interno), O múltiples Bancos
        const validTsdBanco = this.ws.tsd.length > 0 && this.ws.bancos.length > 0;
        const validTsdInterno = this.ws.tsd.length > 1 && this.ws.bancos.length === 0;
        const validBancoInterno = this.ws.bancos.length > 1 && this.ws.tsd.length === 0;
        
        if (isAjusteMenor && !justificacion) {
            justificacion = 'Aprobación Manual (Ajuste Menor)';
        }

        const isValidMatch = validTsdBanco || validTsdInterno || validBancoInterno || isAjusteMenor;

        if (isValidMatch) {
            this.manualMatches.push({ tsdArr: [...this.ws.tsd], bancoArr: [...this.ws.bancos], justificacion: justificacion });
        }

        this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);

        // --- RASTREO DE NUEVAS SUGERENCIAS EN M4 ---
        const newMatches = [];
        this.currentLimboData.forEach(row => {
            // Solo nos interesan las filas que son Sugerencias Automáticas
            if (!String(row.EstadoMatch).startsWith('Sugerencia')) return;

            const rowTsdIds = (Array.isArray(row._tsdRaw) ? row._tsdRaw : [row._tsdRaw]).filter(Boolean).map(t => t._id);
            const rowBancoIds = (Array.isArray(row._bancoRaw) ? row._bancoRaw : [row._bancoRaw]).filter(Boolean).map(b => b._id);

            const hasRemovedTsd = removedTsd.some(rt => rowTsdIds.includes(rt._id));
            const hasRemovedBanco = removedBancos.some(rb => rowBancoIds.includes(rb._id));

            if (hasRemovedTsd || hasRemovedBanco) {
                newMatches.push(row);
            }
        });

        if (newMatches.length > 0) {
            let msg = "El algoritmo encontró <b>nuevas sugerencias</b> para los datos liberados:\n\n";
            newMatches.forEach(nm => {
                const monto = nm.MontoTSD.valor !== undefined ? nm.MontoTSD.valor : nm.MontoTSD;
                msg += `📌 <b>Contrato:</b> ${nm.Contrato} | <b>Banco:</b> ${nm.Banco_Nombre} | <b>Tipo:</b> ${nm.EstadoMatch.replace('Sugerencia: ','')}\n`;
            });
            msg += "\nRevise la tabla superior (Sugerencias del Algoritmo) para auditar y aprobar.";
            setTimeout(() => window.SysUI.alert(msg, "¡Nuevas Sugerencias Encontradas!", "info"), 500);
        } else if (!isValidMatch) {
            if(window.SysUI) window.SysUI.alert("Datos desvinculados correctamente. Han regresado a la bandeja de pendientes y no se emparejarán automáticamente entre ellos.", "Separados", "warning");
        }
        return true;
    },

    // --------------------------------------------------------
    // MOTOR DE GUARDADO A BASE DE DATOS (M4)
    // --------------------------------------------------------
    saveAprobaciones: async function() {
        if (!this.currentSugData || this.currentSugData.length === 0) {
            return window.SysUI.alert("No hay ajustes manuales en la tabla superior para aprobar.\n\nHaga doble clic en una sugerencia de la tabla inferior para auditarla y aprobarla primero.", "Tabla Vacía", "warning");
        }

        const confirmado = await window.SysUI.confirm(
            `¿Desea guardar definitivamente estas conciliaciones?\n\n` + 
            `✔️ Se registrarán <b>${this.currentSugData.length}</b> agrupaciones aprobadas manualmente en la Base de Datos.\n\n` +
            `❌ Las sugerencias y datos huérfanos de la tabla inferior permanecerán en estado "PENDIENTE" esperando una próxima revisión.`,
            "Aprobar y Guardar Auxiliar",
            "info"
        );

        if (!confirmado) return;

        // Construcción del Payload (Solo los aprobados)
        const payloadAprobados = [];
        this.currentSugData.forEach(row => {
            const arrT = Array.isArray(row._tsdRaw) ? row._tsdRaw : [row._tsdRaw];
            const arrB = Array.isArray(row._bancoRaw) ? row._bancoRaw : [row._bancoRaw];
            
            let justif = null;
            const strStatus = String(row.EstadoMatch);
            if (strStatus.startsWith('Manual|')) { justif = strStatus.split('|')[1]; }

            payloadAprobados.push({
                IdMatchTSD: 'aux_tsd_' + Math.random().toString(36).substr(2, 10), // Matrimonio Único (Prefijo Auxiliar)
                TipoCruce: '[AUX] ' + strStatus.split('|')[0], // Sellado de Auditoría M4
                Justificacion: justif,
                TSD: arrT.map(t => t.ID_Transaccion), // Extraemos los IDs que hay que actualizar
                Bancos: arrB.map(b => b.IdTransaccion) 
            });
        });

        // Feedback Visual
        const btn = document.getElementById('btn-save-m4');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<svg class="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> GUARDANDO...';
        btn.disabled = true;
        document.body.classList.add('cursor-wait');

        try {
            // Llamamos a nuestro nuevo endpoint M4
            const res = await fetch('api/save_auxiliar_m4.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aprobados: payloadAprobados })
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error);

            await window.SysUI.alert("Las conciliaciones han sido aprobadas y guardadas exitosamente en el historial contable.", "Operación Exitosa", "success");
            
            // Recargar la pantalla para vaciar los aprobados y refrescar el limbo
            this.fetchPendientes();

        } catch (error) {
            window.SysUI.alert("Hubo un error al conectar con la Base de Datos:\n\n" + error.message, "Fallo Crítico", "error");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            document.body.classList.remove('cursor-wait');
        }
    },

    openForenseModal: async function(row) {
        if (!row || !row._uid) return;
        document.body.classList.add('cursor-wait');
        
        try {
            const res = await fetch(`api/get_forense_m4.php?id=${row._uid}`);
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            const fmt = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v||0).replace(/\./g, ' ');

            // 1. ORIGEN: TSD (Izquierda)
            const htmlTSD = data.tsd.map(t => {
                const monto = parseFloat(t.MontoCRC) || parseFloat(t.MontoBruto) || 0;
                return `
                <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md transition-shadow group">
                    <div class="absolute top-0 left-0 w-1 h-full bg-purple-500 rounded-l-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">Contrato TSD</p>
                            <h4 class="font-black text-slate-800 dark:text-white text-lg">${t.Contrato || 'S/D'}</h4>
                        </div>
                        <div class="text-right">
                            <span class="font-black text-2xl ${monto < 0 ? 'text-red-500':'text-slate-800 dark:text-white'}">${fmt(monto)}</span>
                        </div>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-4 truncate" title="${t.Cliente}">👤 ${t.Cliente || '-'}</p>
                    
                    <div class="flex flex-wrap gap-2 mb-4">
                        <span class="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200 dark:border-slate-700">Auth: <b class="text-slate-800 dark:text-white">${t.Autorizacion||'-'}</b></span>
                        <span class="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200 dark:border-slate-700">Tarj: ****${t.Tarjeta_Ultimos4||'S/D'}</span>
                    </div>

                    <div class="mt-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400 space-y-3 border border-slate-100 dark:border-slate-700/50">
                        <p class="text-xs font-bold text-slate-500 uppercase mb-2">Detalles Operativos</p>
                        <div class="flex justify-between"><span class="font-medium">Recibo/Detalle:</span> <span class="font-bold text-orange-600 truncate max-w-[150px]" title="${t.Recibo_Detalle}">${t.Recibo_Detalle || 'S/D'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Fecha Transacción:</span> <span class="font-mono">${t.FechaPago || t.FechaTransaccion || '-'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Agente:</span> <span class="truncate max-w-[150px]" title="${t.RecibidoPor}">${t.RecibidoPor || '-'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Sucursal:</span> <span>${t.SucursalNombre || '-'} (${t.SucursalCod || '-'})</span></div>
                        <div class="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                            <span class="font-bold text-blue-600 dark:text-blue-400">Monto Origen USD:</span>
                            <span class="font-mono font-bold text-base">$${t.MontoUSD || 0} <span class="text-xs font-normal text-slate-400">(TC: ₡${t.TipoCambio || 1})</span></span>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // 2. TRÁNSITO: DETALLADO (Centro)
            const htmlDetallado = data.detallado.map(d => {
                const isBac = d.Banco === 'BAC';
                const monto = parseFloat(isBac ? d.BacMonto : d.ScoMonto) || 0;
                const neto = parseFloat(isBac ? d.BacNeto : d.ScoNeto) || 0;
                const com = parseFloat(isBac ? d.BacCom : d.ScoCom) || 0;
                const rVenta = parseFloat(isBac ? d.RETENCION_VENTAS : d.Monto_Retencion_IVA) || 0;
                const rRenta = parseFloat(isBac ? d.RETENCION_RENTA : d.Monto_Retencion_ISR) || 0;
                
                return `
                <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md transition-shadow group">
                    <div class="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Liquidación Bancaria</p>
                            <h4 class="font-black text-slate-800 dark:text-white text-lg">${d.Banco}</h4>
                        </div>
                        <div class="text-right">
                            <span class="font-black text-2xl ${monto < 0 ? 'text-red-500':'text-slate-800 dark:text-white'}">${fmt(monto)}</span>
                        </div>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-4 truncate" title="${isBac ? d.NOMBRECOMERCIO : d.Nombre}">🏢 ${isBac ? d.NOMBRECOMERCIO : d.Nombre || '-'}</p>
                    
                    <div class="flex flex-wrap gap-2 mb-4">
                        <span class="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200 dark:border-slate-700">Auth: <b class="text-slate-800 dark:text-white">${d.Autorizacion||'-'}</b></span>
                        <span class="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200 dark:border-slate-700">Tarj: ****${d.Tarjeta ? d.Tarjeta.slice(-4) : 'S/D'}</span>
                    </div>

                    <div class="mt-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400 space-y-3 border border-slate-100 dark:border-slate-700/50">
                        <p class="text-xs font-bold text-slate-500 uppercase mb-2">Desglose Financiero</p>
                        <div class="flex justify-between"><span class="font-medium">Monto Bruto:</span> <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${fmt(monto)}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Comisión Banco:</span> <span class="font-mono text-red-500">${fmt(com)}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Retención Ventas/IVA:</span> <span class="font-mono text-red-500">${fmt(rVenta)}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Retención Renta/ISR:</span> <span class="font-mono text-red-500">${fmt(rRenta)}</span></div>
                        <div class="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <span class="font-bold text-green-600 dark:text-green-500">Monto Neto a Depositar:</span>
                            <span class="font-mono font-black text-lg text-green-600 dark:text-green-500">${fmt(neto)}</span>
                        </div>
                        <div class="pt-3 mt-3 flex justify-between text-xs text-slate-400">
                            <span>Afiliado: ${isBac ? d.NUMERO_AFILIADO : d.MerID}</span>
                            <span>Terminal: ${isBac ? d.BacTerm : d.ScoTerm}</span>
                        </div>
                        ${d.EvidenciaB64 ? `
                        <div class="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 flex justify-center">
                            <button onclick="window.showForenseEvidence(this.getAttribute('data-img'))" data-img="${d.EvidenciaB64}" class="w-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-2 rounded-lg text-xs font-bold border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> 
                                Ver Evidencia Visual del Ajuste
                            </button>
                        </div>` : ''}
                    </div>
                </div>`;
            }).join('');

            // 3. DESTINO: PAGADO (Derecha)
            const htmlPagado = data.pagado.map(p => {
                const isBac = p.Banco === 'BAC';
                const ref = isBac ? p.BacRef : p.ScoRef;
                const fecha = isBac ? p.BacFecha : p.ScoFecha;
                const desc = isBac ? p.BacDesc : p.ScoDesc;
                const monto = isBac ? parseFloat(p.BacCred||0) : parseFloat(p.ScoMonto||0);
                
                return `
                <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md transition-shadow group">
                    <div class="absolute top-0 left-0 w-1 h-full bg-teal-500 rounded-l-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs font-bold text-teal-500 uppercase tracking-wider mb-1">Depósito Cuenta</p>
                            <h4 class="font-black text-slate-800 dark:text-white text-lg">Abono Real</h4>
                        </div>
                        <div class="text-right">
                            <span class="font-black text-2xl text-teal-600 dark:text-teal-400">+${fmt(monto)}</span>
                        </div>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 mb-4 font-mono">Ref: ${ref || 'S/D'}</p>
                    
                    <div class="flex flex-wrap gap-2 mb-4">
                        <span class="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200 dark:border-slate-700">📅 ${fecha || '-'}</span>
                    </div>

                    <details class="[&::-webkit-details-marker]:hidden cursor-pointer">
                        <summary class="text-sm font-bold text-slate-400 hover:text-teal-600 transition-colors list-none flex items-center gap-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            Descripción del Extracto
                        </summary>
                        <div class="mt-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-500 dark:text-slate-400 italic border border-slate-100 dark:border-slate-700/50">
                            "${desc || 'Sin descripción en el extracto bancario'}"
                        </div>
                    </details>
                </div>`;
            }).join('') || `
                <div class="flex flex-col items-center justify-center h-48 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center">
                    <span class="text-4xl mb-4 text-slate-300">📄</span>
                    <span class="text-base font-bold text-slate-400">Sin depósito bancario registrado</span>
                    <span class="text-sm text-slate-500">Es posible que sea una transacción de ajuste manual, o el depósito aún no se ha reflejado.</span>
                </div>`;

            // CREAR E INYECTAR MODAL
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[99999] flex justify-center items-center p-4 lg:p-8 animate-fade-in-up';
            modal.innerHTML = `
                <div class="bg-slate-50 dark:bg-slate-900 w-full max-w-6xl h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">
                    
                    <!-- HEADER MODERNO -->
                    <div class="bg-white dark:bg-slate-800 px-8 py-5 flex justify-between items-center shrink-0 z-10 shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                            </div>
                            <div>
                                <h2 class="text-xl font-black text-slate-800 dark:text-white tracking-tight">Timeline de Transacción</h2>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">Folio: ${row.Folio}</span>
                                    <span class="text-slate-400 text-xs font-medium">📅 ${row.FechaFolio}</span>
                                </div>
                            </div>
                        </div>
                        <button class="text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 w-9 h-9 rounded-full flex items-center justify-center transition-colors" onclick="this.closest('.fixed').remove()">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <!-- TIMELINE INDICATOR -->
                    <div class="px-8 py-3 bg-slate-100 dark:bg-slate-800/50 flex justify-between items-center text-xs font-black tracking-widest uppercase text-slate-400 shrink-0">
                        <div class="flex-1 text-center text-purple-600 dark:text-purple-400">1. Origen Interno (TSD)</div>
                        <div class="text-slate-300 dark:text-slate-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></div>
                        <div class="flex-1 text-center text-blue-600 dark:text-blue-400">2. Procesamiento Adquirente (Banco)</div>
                        <div class="text-slate-300 dark:text-slate-600"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></div>
                        <div class="flex-1 text-center text-teal-600 dark:text-teal-400">3. Aterrizaje en Cuenta (Depósito)</div>
                    </div>

                    <!-- 3 COLUMNAS -->
                    <div class="flex-1 flex overflow-hidden p-6 gap-6 relative">
                        <!-- Conectores de fondo -->
                        <div class="absolute top-1/2 left-[33%] w-6 border-t-2 border-dashed border-slate-300 dark:border-slate-600 -translate-y-1/2 z-0"></div>
                        <div class="absolute top-1/2 left-[66%] w-6 border-t-2 border-dashed border-slate-300 dark:border-slate-600 -translate-y-1/2 z-0"></div>

                        <!-- COLUMNA 1: TSD -->
                        <div class="flex-1 flex flex-col overflow-hidden z-10">
                            <div class="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">${htmlTSD}</div>
                        </div>

                        <!-- COLUMNA 2: Detallado -->
                        <div class="flex-1 flex flex-col overflow-hidden z-10">
                            <div class="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">${htmlDetallado}</div>
                        </div>

                        <!-- COLUMNA 3: Pagado -->
                        <div class="flex-1 flex flex-col overflow-hidden z-10">
                            <div class="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar">${htmlPagado}</div>
                        </div>
                    </div>
                    
                    <!-- FOOTER AUDITORÍA -->
                    <div class="bg-white dark:bg-slate-800 px-8 py-4 shrink-0 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                        <div class="flex items-center gap-3">
                            <span class="flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600 text-base">✓</span>
                            <span class="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Resolución: <span class="text-slate-900 dark:text-white">${row.TipoCruce.tipo}</span></span>
                        </div>
                        <div class="text-sm text-slate-500 italic max-w-xl truncate" title="${row.TipoCruce.justificacion}">
                            ${row.TipoCruce.justificacion ? `"${row.TipoCruce.justificacion}"` : 'Sin justificación registrada'}
                        </div>
                    </div>
                </div>

                <style>
                    /* Custom scrollbar para las columnas */
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 6px; }
                    .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                    .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
                </style>
                <script>
                    // Motor Interactivo del Modal Forense para ver Evidencias
                    window.showForenseEvidence = function(b64) {
                        const overlay = document.createElement('div');
                        overlay.className = 'fixed inset-0 z-[999999] bg-slate-900/90 backdrop-blur-md flex justify-center items-center p-4 opacity-0 transition-opacity duration-300';
                        overlay.innerHTML = \`
                            <div class="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-2xl relative max-w-5xl w-full flex flex-col transform scale-95 transition-transform duration-300">
                                <div class="flex justify-between items-center p-3 mb-2 border-b border-slate-200 dark:border-slate-700">
                                    <h3 class="font-bold text-slate-800 dark:text-white flex items-center gap-2"><span class="text-blue-500">🖼️</span> Evidencia del Ajuste Manual</h3>
                                    <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg p-1.5 transition-colors">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                                <div class="overflow-auto flex justify-center items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-2" style="max-height: 80vh;">
                                    <img src="\${b64}" class="max-w-full h-auto object-contain rounded">
                                </div>
                            </div>
                        \`;
                        document.body.appendChild(overlay);
                        requestAnimationFrame(() => {
                            overlay.classList.remove('opacity-0');
                            overlay.querySelector('div').classList.remove('scale-95');
                        });
                    };
                </script>
            `;
            
            document.body.appendChild(modal);

        } catch (error) {
            window.SysUI.alert("Error al cargar la trazabilidad: " + error.message, "Fallo", "error");
        } finally {
            document.body.classList.remove('cursor-wait');
        }
    },

    openTagManager: async function() {
        const paleta = ['slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
        
        let htmlList = `<div class="space-y-2 mb-4 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">`;
        if (this.customTags.length === 0) htmlList += `<div class="text-xs text-center text-slate-400 italic">No hay etiquetas creadas.</div>`;
        
        this.customTags.forEach(tag => {
            const css = this.TW_COLORS[tag.ColorCSS] || this.TW_COLORS['slate'];
            htmlList += `
            <div class="flex justify-between items-center bg-white dark:bg-slate-700/50 p-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                <div>
                    <span class="${css} px-2 py-0.5 rounded text-[10px] font-bold shadow-sm border select-none">🏷️ ${tag.Nombre}</span>
                    <div class="text-[9px] text-slate-500 mt-1">${tag.Descripcion || 'Sin descripción'}</div>
                </div>
                <div class="flex items-center gap-1.5">
                    <select onchange="this.style.backgroundColor=(window.AuxiliarLogic.COLORES_ES[this.value]||{}).hex||'#e2e8f0'; window.AuxiliarLogic.updateTagColor(${tag.IdEtiqueta}, this.value)" title="Cambiar color" class="text-[10px] border border-slate-200 dark:border-slate-600 rounded p-1 outline-none cursor-pointer text-slate-800" style="background-color:${(window.AuxiliarLogic.COLORES_ES[tag.ColorCSS] || {}).hex || '#e2e8f0'}">
                        ${Object.entries(window.AuxiliarLogic.COLORES_ES).map(([c, info]) => `<option value="${c}" style="background-color:${info.hex};color:#1e293b" ${tag.ColorCSS === c ? 'selected' : ''}>⬤ ${info.nombre}</option>`).join('')}
                    </select>
                    <button onclick="window.AuxiliarLogic.editTag(${tag.IdEtiqueta})" class="text-blue-500 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 p-1.5 rounded transition-colors" title="Editar nombre y descripción">✏️</button>
                    ${Number(tag.EsSistema) === 1
                        ? `<span class="text-slate-400 bg-slate-100 dark:bg-slate-700 p-1.5 rounded select-none" title="Etiqueta del sistema: no se puede eliminar">🔒</span>`
                        : `<button onclick="window.AuxiliarLogic.deleteTag(${tag.IdEtiqueta})" class="text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 p-1.5 rounded transition-colors" title="Eliminar">🗑️</button>`}
                </div>
            </div>`;
        });
        htmlList += `</div>`;

        let colorPicker = `<div class="flex flex-wrap gap-2 mb-3">`;
        paleta.forEach(c => {
            colorPicker += `<div onclick="document.querySelectorAll('.pal-color').forEach(el=>el.classList.remove('ring-4', 'ring-slate-400', 'scale-110')); this.classList.add('ring-4', 'ring-slate-400', 'scale-110'); document.getElementById('new-tag-color').value='${c}';" class="pal-color w-6 h-6 rounded-full cursor-pointer transition-all bg-${c}-400 hover:bg-${c}-500 shadow-sm"></div>`;
        });
        colorPicker += `</div><input type="hidden" id="new-tag-color" value="">`;

        const html = `
            ${htmlList}
            <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-3">Crear Nueva Etiqueta</h4>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <input type="text" id="new-tag-name" placeholder="Nombre (Ej: Urgente)" class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                    <input type="text" id="new-tag-desc" placeholder="Descripción (Opcional)" class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                </div>
                <div class="text-[10px] font-bold text-slate-500 uppercase mb-2">Color del Sistema</div>
                ${colorPicker}
                <button id="btn-create-tag" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs shadow-md transition-colors mt-2">Guardar Nueva Etiqueta</button>
            </div>
        `;

        // Eliminamos el overlay anterior si existe
        if (this._tagModalOverlay) this._tagModalOverlay.remove();

        const overlay = document.createElement('div');
        this._tagModalOverlay = overlay;
        overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 select-none';
        
        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col">
                <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                    <h3 class="text-base font-bold text-slate-800 dark:text-white">⚙️ Administrador de Etiquetas</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-slate-400 hover:text-red-500 transition-colors">✖</button>
                </div>
                <div class="p-6">${html}</div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => { overlay.classList.remove('opacity-0'); overlay.querySelector('div').classList.remove('scale-95'); });

        // Evento de crear
        document.getElementById('btn-create-tag').onclick = async () => {
            const nombre = document.getElementById('new-tag-name').value.trim();
            const desc = document.getElementById('new-tag-desc').value.trim();
            const color = document.getElementById('new-tag-color').value;

            if (!nombre || !color) return window.SysUI.alert("El nombre y el color son obligatorios.");

            try {
                const res = await fetch('api/mantenimiento_etiquetas_m4.php', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ Nombre: nombre, Descripcion: desc, ColorCSS: color })
                });
                const json = await res.json();
                if(!json.success) throw new Error(json.error);
                
                overlay.remove();
                await this.fetchTags(); // Recarga BD y Leyenda
                this.openTagManager();  // Reabre para ver los cambios
                this.runMatchingAlgorithm(this.lastTSD, this.lastBancos); // Reordenar tabla
            } catch(e) { window.SysUI.alert("Error: " + e.message); }
        };
    },

    editTag: async function(id) {
        const tag = this.customTags.find(t => t.IdEtiqueta.toString() === id.toString());
        if (!tag) return;
        const esSis = Number(tag.EsSistema) === 1;
        if (this._tagModalOverlay) this._tagModalOverlay.remove();

        const html = `
            <div class="space-y-3 text-left">
                <div>
                    <label class="text-[10px] font-bold uppercase text-slate-500">Nombre ${esSis ? '(fijo: etiqueta del sistema)' : ''}</label>
                    <input id="edit-tag-nombre" value="${tag.Nombre}" ${esSis ? 'disabled' : ''} maxlength="50" class="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
                </div>
                <div>
                    <label class="text-[10px] font-bold uppercase text-slate-500">Descripción</label>
                    <input id="edit-tag-desc" value="${tag.Descripcion || ''}" maxlength="150" class="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>`;

        const choice = await window.SysUI._createModal("✏️ Editar Etiqueta", html, [
            {text: 'Cancelar', value: null, class: 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Guardar', value: 'save', class: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors'}
        ], "info");

        if (choice === 'save') {
            try {
                const res = await fetch('api/mantenimiento_etiquetas_m4.php', {
                    method: 'PUT', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        IdEtiqueta: tag.IdEtiqueta,
                        ColorCSS: tag.ColorCSS,
                        Nombre: document.getElementById('edit-tag-nombre').value.trim(),
                        Descripcion: document.getElementById('edit-tag-desc').value.trim()
                    })
                });
                const json = await res.json();
                if(!json.success) throw new Error(json.error);
                await this.fetchTags();
                if (this.lastTSD && this.lastBancos) this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
            } catch(e) { window.SysUI.alert("No se pudo editar: " + e.message, "Fallo", "error"); }
        }
        this.openTagManager(); // Vuelve a la ventana de mantenimiento
    },

    updateTagColor: async function(id, color) {
        try {
            const res = await fetch('api/mantenimiento_etiquetas_m4.php', {
                method: 'PUT', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ IdEtiqueta: id, ColorCSS: color })
            });
            const json = await res.json();
            if(!json.success) throw new Error(json.error);

            await this.fetchTags(); // Recarga etiquetas y leyenda con el color nuevo
            if (this.lastTSD && this.lastBancos) this.runMatchingAlgorithm(this.lastTSD, this.lastBancos); // Repinta las filas
        } catch(e) { window.SysUI.alert("No se pudo cambiar el color: " + e.message, "Fallo", "error"); }
    },

    deleteTag: async function(id) {
        if(!confirm("¿Eliminar esta etiqueta? Las transacciones que la tengan volverán a la normalidad.")) return;
        try {
            const res = await fetch('api/mantenimiento_etiquetas_m4.php', {
                method: 'DELETE', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ IdEtiqueta: id })
            });
            const json = await res.json();
            if(!json.success) throw new Error(json.error);
            
            if (this._tagModalOverlay) this._tagModalOverlay.remove();
            await this.fetchTags();
            this.openTagManager();
            this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
        } catch(e) { window.SysUI.alert("Error: " + e.message); }
    },

    // --- NOTA MASIVA: aplica una nota a todas las filas marcadas con ✓ ---
    abrirNotaMasiva: async function() {
        // Lee la selección REAL de la tabla (las celdas pintadas de azul, como en Excel)
        const idx = new Set();
        if (this.gridLimbo && this.gridLimbo.selection) {
            this.gridLimbo.selection.forEach(td => { if (td.dataset && td.dataset.r !== undefined) idx.add(parseInt(td.dataset.r)); });
        }
        const sel = [...idx].map(i => this.gridLimbo.displayData[i]).filter(r => r && r._dbId);
        if (sel.length === 0) {
            return window.SysUI.alert("Primero seleccione una o varias celdas (clic o arrastre) en las filas de la tabla de pendientes.", "Sin selección", "info");
        }
        return this._notaParaFilas(sel);
    },

    // Nota para UNA sola línea: la fila donde se hizo clic derecho
    abrirNotaLinea: async function(uid) {
        document.getElementById('vg-context-menu')?.remove();
        const row = this.currentLimboData.find(r => r._uid === uid);
        if (!row || !row._dbId) return;
        return this._notaParaFilas([row]);
    },

    // Motor compartido del modal de notas (recibe las filas destino ya resueltas)
    _notaParaFilas: async function(sel) {
        // Precarga la nota existente de la primera seleccionada (si la hay)
        this._notaTmp = sel[0]._notaEtiq || '';
        const html = `
            <div class="text-left space-y-2">
                <div class="text-xs text-slate-500">La nota se aplicará a <b>${sel.length}</b> transacción(es). Si alguna ya tenía nota, se actualizará.</div>
                <textarea oninput="window.AuxiliarLogic._notaTmp = this.value" rows="3" maxlength="255" placeholder="Escriba la nota..." class="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">${this._notaTmp}</textarea>
            </div>`;

        const choice = await window.SysUI._createModal("📝 Agregar / Actualizar Nota", html, [
            {text: 'Cancelar', value: null, class: 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Guardar Nota', value: 'save', class: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors'}
        ], "info");
        if (choice !== 'save') return;

        const nota = (this._notaTmp || '').trim();
        try {
            // Guarda en base de datos (conservando el color que ya tenga cada fila)
            await Promise.all(sel.map(r => fetch('api/save_etiqueta_m4.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: r._dbId, color: r._colorEtiq || '', nota: nota })
            }).then(x => x.json()).then(j => { if (!j.success) throw new Error(j.error); })));

            // La fila visible se estampa de una vez, y la memoria queda al día para el repintado
            sel.forEach(r => {
                r._notaEtiq = nota;
                const t = this.lastTSD.find(x => x.ID_Transaccion === r._dbId); if (t) t.NotaUsuario = nota;
                const b = this.lastBancos.find(x => x.IdTransaccion === r._dbId); if (b) b.NotaUsuario = nota;
            });
            this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
        } catch (e) {
            window.SysUI.alert("No se pudo guardar la nota: " + e.message, "Fallo", "error");
        }
    },

    // --- ETIQUETAS EN EL HISTORIAL: aplica a todas las filas con celdas seleccionadas ---
    abrirMenuEtiquetasHistorial: function(row, e, menu) {
        if (!row || !row._uid) return;

        // Filas destino: las que tengan celdas seleccionadas; si no hay selección, la fila del clic
        const idx = new Set();
        if (this.gridHistorial && this.gridHistorial.selection) {
            this.gridHistorial.selection.forEach(td => { if (td.dataset && td.dataset.r !== undefined) idx.add(parseInt(td.dataset.r)); });
        }
        let objetivo = [...idx].map(i => this.gridHistorial.displayData[i]).filter(r => r && r._uid);
        if (objetivo.length === 0) objetivo = [row];
        this._etiqObjetivoHist = objetivo;

        const css = (c) => this.TW_COLORS[c] || this.TW_COLORS['slate'];
        const items = (this.customTags || []).map(tag => `
            <div onclick="window.AuxiliarLogic.asignarEtiquetaHistorial('${tag.IdEtiqueta}')"
                 class="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="${tag.Descripcion || ''}">
                <span class="w-3 h-3 rounded-full border shadow-sm ${css(tag.ColorCSS)}"></span>
                <span class="text-xs text-slate-700 dark:text-slate-200">${tag.Nombre}</span>
            </div>`).join('');

        const anchoSubmenu = 200;
        const abrirIzquierda = (e.clientX + 180 + anchoSubmenu) > window.innerWidth;
        const ladoClase = abrirIzquierda ? 'right-full' : 'left-full';
        const flecha = abrirIzquierda ? '◀' : '▶';
        menu.insertAdjacentHTML('beforeend', `
            <div class="border-t border-slate-200 dark:border-slate-600 my-1"></div>
            <div class="group relative flex flex-col cursor-pointer transition-colors">
                <div class="flex justify-between items-center px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <div class="flex items-center gap-2">
                        <span>🏷️</span> <span class="text-xs text-slate-700 dark:text-slate-200 font-bold">Etiquetar selección (${objetivo.length})</span>
                    </div>
                    <span class="text-[10px] text-slate-400">${flecha}</span>
                </div>
                <div class="hidden group-hover:flex flex-col absolute ${ladoClase} top-0 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-xl py-1 max-h-56 overflow-y-auto custom-scrollbar z-50">
                    ${items || '<div class="px-4 py-2 text-xs italic text-slate-400">No hay etiquetas creadas</div>'}
                    <div class="border-t border-slate-200 dark:border-slate-600 my-1 mx-2"></div>
                    <div onclick="window.AuxiliarLogic.asignarEtiquetaHistorial('')" class="px-4 py-1.5 cursor-pointer text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors font-bold">🚫 Quitar etiqueta</div>
                </div>
            </div>
        `);
    },

    asignarEtiquetaHistorial: async function(idEtiqueta) {
        document.getElementById('vg-context-menu')?.remove();
        const grupos = this._etiqObjetivoHist || [];
        if (grupos.length === 0) return;

        // Cada grupo etiqueta a TODOS sus miembros (transacciones TSD y banco) en la Maestra
        const miembros = grupos.flatMap(g => [...(g._tsdArr || []), ...(g._bancoArr || [])]).filter(m => m.IdTransaccion);
        try {
            await Promise.all(miembros.map(m => fetch('api/save_etiqueta_m4.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: m.IdTransaccion, color: idEtiqueta, nota: m.NotaUsuario || '' })
            }).then(x => x.json()).then(j => { if (!j.success) throw new Error(j.error); })));

            // Estampar memoria local y repintar de inmediato (sin recargar del servidor)
            const tagObj = idEtiqueta ? (this.customTags || []).find(t => t.IdEtiqueta.toString() === idEtiqueta.toString()) : null;
            const clase = (tagObj && this.TW_COLORS[tagObj.ColorCSS])
                ? this.TW_COLORS[tagObj.ColorCSS] + ' border-b'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
            grupos.forEach(g => {
                g._colorEtiq = idEtiqueta || null;
                g._rowClass = clase;
                [...(g._tsdArr || []), ...(g._bancoArr || [])].forEach(m => { m.ColorEtiqueta = idEtiqueta || null; });
            });
            if (this.gridHistorial) this.gridHistorial.updateData(this.currentHistorialData);
        } catch (e) {
            window.SysUI.alert("No se pudo etiquetar: " + e.message, "Fallo", "error");
        }
    },

    // --- SECCIÓN DE ETIQUETAS Y NOTAS DENTRO DEL MENÚ NATIVO ---
    abrirMenuEtiquetas: function(row, e, menu) {
        if (!row || !row._dbId) return; // Las agrupaciones "Varios" se etiquetan en PopUp

        // 1. Botones de Nota (línea individual y selección masiva)
        menu.insertAdjacentHTML('beforeend', `
            <div onclick="window.AuxiliarLogic.abrirNotaLinea('${row._uid}')" class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span>📌</span> <span class="text-xs text-slate-700 dark:text-slate-200 font-bold">Agregar nota a esta línea</span>
            </div>
            <div onclick="window.AuxiliarLogic.abrirNotaMasiva()" class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span>📝</span> <span class="text-xs text-slate-700 dark:text-slate-200 font-bold">Escribir nota a selección</span>
            </div>
            <div class="border-t border-slate-200 dark:border-slate-600 my-1"></div>
        `);

        // 2. Información de Sugerencia Automática (Solo lectura visual)
        if (row._categoriaId === 1 || row._categoriaId === 2) {
            const nombre = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
            menu.insertAdjacentHTML('beforeend', `
                <div class="px-3 py-1.5 text-[10px] text-slate-400 italic">🤖 Sugerencia aut: <b>${nombre}</b></div>
                <div class="border-t border-slate-200 dark:border-slate-600 my-1"></div>
            `);
        }

        // 3. Generar HTML de la lista de etiquetas
        const css = (c) => this.TW_COLORS[c] || this.TW_COLORS['slate'];
        const items = this.customTags.map(tag => `
            <div onclick="window.AuxiliarLogic.asignarEtiquetaRapida('${row._uid}', '${tag.IdEtiqueta}')"
                 class="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="${tag.Descripcion || ''}">
                <span class="w-3 h-3 rounded-full border shadow-sm ${css(tag.ColorCSS)}"></span>
                <span class="text-xs text-slate-700 dark:text-slate-200">${tag.Nombre}</span>
            </div>`).join('');

        // 4. Inyectar Submenú LATERAL (flyout que elige su lado según el espacio en pantalla)
        const anchoSubmenu = 200;
        const abrirIzquierda = (e.clientX + 180 + anchoSubmenu) > window.innerWidth;
        const ladoClase = abrirIzquierda ? 'right-full' : 'left-full';
        const flecha = abrirIzquierda ? '◀' : '▶';
        menu.insertAdjacentHTML('beforeend', `
            <div class="group relative flex flex-col cursor-pointer transition-colors">
                <div class="flex justify-between items-center px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <div class="flex items-center gap-2">
                        <span>🏷️</span> <span class="text-xs text-slate-700 dark:text-slate-200 font-bold">Asignar Etiqueta</span>
                    </div>
                    <span class="text-[10px] text-slate-400">${flecha}</span>
                </div>

                <!-- Flyout lateral (aparece al hover, al costado del menú) -->
                <div class="hidden group-hover:flex flex-col absolute ${ladoClase} top-0 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-xl py-1 max-h-56 overflow-y-auto custom-scrollbar z-50">
                    ${items || '<div class="px-4 py-2 text-xs italic text-slate-400">No hay etiquetas creadas</div>'}
                    <div class="border-t border-slate-200 dark:border-slate-600 my-1 mx-2"></div>
                    <div onclick="window.AuxiliarLogic.asignarEtiquetaRapida('${row._uid}', '')" class="px-4 py-1.5 cursor-pointer text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors font-bold">🚫 Quitar etiqueta</div>
                </div>
            </div>
        `);
    },

    asignarEtiquetaRapida: async function(uid, idEtiqueta) {
        document.getElementById('vg-context-menu')?.remove();
        const row = this.currentLimboData.find(r => r._uid === uid);
        if (!row || !row._dbId) return;

        try {
            const res = await fetch('api/save_etiqueta_m4.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: row._dbId, color: idEtiqueta, nota: row._notaEtiq || '' }) // La nota escrita se conserva
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Actualiza la memoria para que el repintado no pierda el cambio
            const tMatch = this.lastTSD.find(t => t.ID_Transaccion === row._dbId);
            if (tMatch) { tMatch.ColorEtiqueta = idEtiqueta || null; }
            const bMatch = this.lastBancos.find(b => b.IdTransaccion === row._dbId);
            if (bMatch) { bMatch.ColorEtiqueta = idEtiqueta || null; }

            this.runMatchingAlgorithm(this.lastTSD, this.lastBancos); // Repinta y reagrupa solo
        } catch (err) {
            window.SysUI.alert("No se pudo guardar la etiqueta: " + err.message, "Fallo", "error");
        }
    },

    openEtiquetaModal: async function(uid) {
        // Buscar fila en Limbo Data
        const row = this.currentLimboData.find(r => r._uid === uid);
        if (!row || !row._dbId) return;

        let selectHtml = `<div class="flex flex-wrap gap-2 mb-4 justify-center">`;
        
        // Botón "Sin Etiqueta"
        selectHtml += `
            <div onclick="document.querySelectorAll('.etiq-btn').forEach(el=>el.classList.remove('ring-2', 'ring-slate-500', 'scale-105')); this.classList.add('ring-2', 'ring-slate-500', 'scale-105'); document.getElementById('modal-etiq-color').value='';" 
                 class="etiq-btn px-3 py-1.5 rounded-full cursor-pointer transition-all border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold shadow-sm select-none ${!row._colorEtiq ? 'ring-2 ring-slate-500 scale-105' : ''}">
                 🚫 Sin Etiqueta
            </div>`;

        // Generar Píldoras con nombres desde BD
        this.customTags.forEach(tag => {
            const isSel = row._colorEtiq && row._colorEtiq.toString() === tag.IdEtiqueta.toString();
            const css = this.TW_COLORS[tag.ColorCSS] || this.TW_COLORS['slate'];
            selectHtml += `
            <div onclick="document.querySelectorAll('.etiq-btn').forEach(el=>el.classList.remove('ring-2', 'ring-slate-500', 'scale-105')); this.classList.add('ring-2', 'ring-slate-500', 'scale-105'); document.getElementById('modal-etiq-color').value='${tag.IdEtiqueta}';" 
                 class="etiq-btn px-3 py-1.5 rounded-full cursor-pointer transition-all shadow-sm border select-none ${css} ${isSel ? 'ring-2 ring-slate-500 scale-105' : ''}" title="${tag.Descripcion || ''}">
                 ${tag.Nombre}
            </div>`;
        });
        selectHtml += `</div><input type="hidden" id="modal-etiq-color" value="${row._colorEtiq || ''}">`;

        const html = `
            <div class="text-sm text-slate-600 dark:text-slate-300 mb-3 text-center">Clasifique la transacción para agruparla y escriba un detalle.</div>
            ${selectHtml}
            <textarea id="modal-etiq-nota" class="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none resize-none h-24 focus:ring-2 focus:ring-blue-500 shadow-inner" placeholder="Escriba su nota/investigación aquí...">${row._notaEtiq || ''}</textarea>
        `;

        const choice = await window.SysUI._createModal("🏷️ Etiqueta de Seguimiento", html, [
            {text: 'Cancelar', value: null, class: 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Guardar Etiqueta', value: 'save', class: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors'}
        ], "info");

        if (choice === 'save') {
            const color = document.getElementById('modal-etiq-color').value;
            const nota = document.getElementById('modal-etiq-nota').value.trim();

            try {
                const res = await fetch('api/save_etiqueta_m4.php', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: row._dbId, color: color, nota: nota })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);

                // Modificar el origen real (RAM maestra) para que no se pierda al re-dibujar
                const tMatch = this.lastTSD.find(t => t.ID_Transaccion === row._dbId);
                if (tMatch) { tMatch.ColorEtiqueta = color; tMatch.NotaUsuario = nota; }
                
                const bMatch = this.lastBancos.find(b => b.IdTransaccion === row._dbId);
                if (bMatch) { bMatch.ColorEtiqueta = color; bMatch.NotaUsuario = nota; }

                // Re-evaluar todo el algoritmo para que las filas, sugerencias y CSS se regeneren automáticamente
                this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
            } catch (err) {
                window.SysUI.alert("Error al guardar la etiqueta: " + err.message, "Fallo", "error");
            }
        }
    }
};