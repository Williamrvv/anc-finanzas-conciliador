window.AuxiliarLogic = {
    lastTSD: [], lastBancos: [], blacklist: [], manualMatches: [], customTags: [],
    gridSug: null, gridLimbo: null, gridHistorial: null,
    currentSugData: [], currentLimboData: [], currentHistorialData: [],

    // Estado temporal compartido del Auxiliar.
    // Nunca guarda los datos fuente: únicamente decisiones manuales.
    _autoSaveBorradorM4Timer: null,
    _ultimoSnapshotBorradorM4: null,
    _borradorM4Existe: false,
    _borradorM4Disponible: false,
    _datosM4Cargados: false,
    _guardandoBorradorM4: false,

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
        // La etiqueta MANUAL del usuario tiene prioridad sobre la sugerencia automática
        if (row._colorEtiq) {
            const tag = this.customTags.find(t => t.IdEtiqueta.toString() === row._colorEtiq.toString());
            if (tag) color = tag.ColorCSS;
        } else if (row._categoriaId === 1 || row._categoriaId === 2) {
            const nombre = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
            const tag = this.customTags.find(t => Number(t.EsSistema) === 1 && t.Nombre === nombre);
            color = tag ? tag.ColorCSS : (row._categoriaId === 1 ? 'rose' : 'fuchsia');
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
            if(json.success) { this.customTags = json.data; this._aplicarOrdenGuardado(); }
            this.injectLegend(); 
        } catch(e) { console.error("Error al cargar etiquetas", e); }
    },

    // --- FILTRO MULTI-SELECT POR ETIQUETA (los chips se acumulan como OR) ---
    _tagFilter: [],
    aplicarFiltroEtiqueta: function() {
        if (!this.gridLimbo) return;
        const sel = this._tagFilter || [];
        if (sel.length === 0) { this.gridLimbo.updateData(this._ordenarFilas(this.currentLimboData)); return; }

        // Las etiquetas de SISTEMA viven en dos identidades: el marcado manual (_colorEtiq)
        // y la detección automática (_categoriaId: Contracargos=1, Devoluciones=2).
        // El filtro atrapa ambas.
        const catsSel = new Set();
        sel.forEach(id => {
            const tag = (this.customTags || []).find(t => t.IdEtiqueta.toString() === id.toString());
            if (tag && Number(tag.EsSistema) === 1) {
                if (tag.Nombre === 'Contracargos') catsSel.add(1);
                if (tag.Nombre === 'Devoluciones') catsSel.add(2);
            }
        });

        const data = this.currentLimboData.filter(r =>
            (r._colorEtiq && sel.some(id => id.toString() === r._colorEtiq.toString())) ||
            catsSel.has(r._categoriaId)
        );
        this.gridLimbo.updateData(this._ordenarFilas(data));
    },
    toggleFiltroEtiqueta: function(idEtiqueta) {
        // Multi-select: cada chip se enciende/apaga de forma independiente y se acumulan (OR)
        const sel = this._tagFilter || [];
        const ya = sel.some(id => id.toString() === idEtiqueta.toString());
        this._tagFilter = ya ? sel.filter(id => id.toString() !== idEtiqueta.toString()) : [...sel, idEtiqueta];
        this.injectLegend();          // Repinta los chips (activos con anillo azul)
        this.aplicarFiltroEtiqueta(); // Repinta la tabla
    },

    // =====================================================================
    // ORDEN DE ETIQUETAS (persistente en el navegador) Y PRIORIDAD DE LA TABLA
    // =====================================================================
    _LS_ORDEN: 'm4_orden_etiquetas',
    _LS_PRIORIDAD: 'm4_prioridad_orden',

    _leerOrdenGuardado: function() {
        try {
            const v = JSON.parse(localStorage.getItem(this._LS_ORDEN));
            return Array.isArray(v) ? v.map(String) : [];
        } catch (e) { return []; }
    },
    _guardarOrden: function(ids) {
        try { localStorage.setItem(this._LS_ORDEN, JSON.stringify(ids.map(String))); } catch (e) {}
    },

    getPrioridad: function() {
        try { return localStorage.getItem(this._LS_PRIORIDAD) === 'categorias' ? 'categorias' : 'sugerencias'; }
        catch (e) { return 'sugerencias'; }
    },
    setPrioridad: function(valor) {
        try { localStorage.setItem(this._LS_PRIORIDAD, valor); } catch (e) {}
        this.injectLegend();
        this.aplicarFiltroEtiqueta();
    },

    // Reordena customTags según lo guardado. Las etiquetas NUEVAS van al final
    // y las borradas desaparecen solas: nunca se pierde ni se inventa nada.
    _aplicarOrdenGuardado: function() {
        const pos = new Map(this._leerOrdenGuardado().map((id, i) => [String(id), i]));
        const AL_FINAL = Number.MAX_SAFE_INTEGER;
        this.customTags.sort((a, b) => {
            const ia = pos.has(String(a.IdEtiqueta)) ? pos.get(String(a.IdEtiqueta)) : AL_FINAL;
            const ib = pos.has(String(b.IdEtiqueta)) ? pos.get(String(b.IdEtiqueta)) : AL_FINAL;
            return ia - ib;
        });
        this._guardarOrden(this.customTags.map(t => t.IdEtiqueta));
    },

    // Etiqueta efectiva de una fila: la manual manda; si no, la detectada por el sistema.
    _tagDeFila: function(row) {
        if (row._colorEtiq) return String(row._colorEtiq);
        if (row._categoriaId === 1 || row._categoriaId === 2) {
            const nombre = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
            const t = (this.customTags || []).find(x => Number(x.EsSistema) === 1 && x.Nombre === nombre);
            if (t) return String(t.IdEtiqueta);
        }
        return null;
    },

    // ORDEN MAESTRO de la bandeja. Array.sort es estable: los empates conservan
    // su posición original, así que reordenar nunca revuelve datos.
    _ordenarFilas: function(arr) {
        if (!Array.isArray(arr)) return [];
        const orden = new Map((this.customTags || []).map((t, i) => [String(t.IdEtiqueta), i]));
        const SIN_TAG = orden.size + 1;
        const recientes = this._ajustesRecientes || [];
        const prio = this.getPrioridad();

        return arr.slice().sort((a, b) => {
            // Nivel 0: ajustes recién creados y sin clasificar, siempre arriba (sólo esta sesión)
            const ra = (recientes.includes(String(a._dbId)) && !a._colorEtiq) ? 0 : 1;
            const rb = (recientes.includes(String(b._dbId)) && !b._colorEtiq) ? 0 : 1;
            if (ra !== rb) return ra - rb;

            // Nivel 1 y 2: según la preferencia del usuario
            const sa = a.EstadoMatch === 'Pendiente' ? 1 : 0;   // 0 = sugerencia del algoritmo
            const sb = b.EstadoMatch === 'Pendiente' ? 1 : 0;
            const ka = this._tagDeFila(a), kb = this._tagDeFila(b);
            const ta = orden.has(ka) ? orden.get(ka) : SIN_TAG;
            const tb = orden.has(kb) ? orden.get(kb) : SIN_TAG;

            return (prio === 'categorias') ? ((ta - tb) || (sa - sb)) : ((sa - sb) || (ta - tb));
        });
    },

    // Guía visual de inserción: una línea luminosa ENTRE dos chips.
    // Nunca se resalta el chip destino, para no dar la falsa idea de reemplazo.
    _lineaDrop: function() {
        let l = document.getElementById('etiq-drop-line');
        if (!l) {
            l = document.createElement('span');
            l.id = 'etiq-drop-line';
            l.style.cssText = 'width:3px; align-self:stretch; min-height:26px; flex:none;' +
                'border-radius:2px; pointer-events:none;' +
                'background:linear-gradient(180deg,#818cf8,#4f46e5);' +
                'box-shadow:0 0 9px rgba(99,102,241,.95), 0 0 18px rgba(99,102,241,.45);';
        }
        return l;
    },
    _quitarLineaDrop: function() {
        const l = document.getElementById('etiq-drop-line');
        if (l && l.parentNode) l.parentNode.removeChild(l);
        this._dropDestino = null;
    },

    // Arrastrar chips para reordenar.
    _engancharArrastre: function() {
        const chips = document.querySelectorAll('#etiq-legend .etiq-chip');
        chips.forEach(chip => {
            chip.addEventListener('dragstart', (e) => {
                this._dragTagId = chip.dataset.tagId;
                chip.style.opacity = '.35';
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    try { e.dataTransfer.setData('text/plain', chip.dataset.tagId); } catch (err) {}
                }
            });

            chip.addEventListener('dragend', () => {
                chip.style.opacity = '';
                this._quitarLineaDrop();
                this._dragTagId = null;
            });

            chip.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!this._dragTagId) return;
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

                // Mitad izquierda => insertar ANTES; mitad derecha => DESPUÉS
                const r = chip.getBoundingClientRect();
                const antes = e.clientX < (r.left + r.width / 2);

                const linea = this._lineaDrop();
                const ref = antes ? chip : chip.nextSibling;
                if (ref === linea) { this._dropDestino = { id: chip.dataset.tagId, antes }; return; }
                if (linea.nextSibling !== ref || linea.parentNode !== chip.parentNode) {
                    chip.parentNode.insertBefore(linea, ref);
                }
                this._dropDestino = { id: chip.dataset.tagId, antes };
            });

            chip.addEventListener('drop', (e) => {
                e.preventDefault();
                const origen = this._dragTagId || (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
                const dest = this._dropDestino;
                this._quitarLineaDrop();
                if (!origen || !dest) return;
                this._moverEtiquetaEntre(origen, dest.id, dest.antes);
            });
        });
    },

    // Inserta el chip movido en el hueco indicado. El índice del destino se calcula
    // DESPUÉS de sacar el elemento, así el resultado es el mismo se arrastre
    // hacia la izquierda o hacia la derecha (evita el clásico error de ±1).
    _moverEtiquetaEntre: function(idOrigen, idDestino, antes) {
        const arr = this.customTags || [];
        const i = arr.findIndex(t => String(t.IdEtiqueta) === String(idOrigen));
        if (i < 0) return;
        const [movido] = arr.splice(i, 1);

        const j = arr.findIndex(t => String(t.IdEtiqueta) === String(idDestino));
        if (j < 0) { arr.splice(i, 0, movido); return; }   // destino inválido: se deja como estaba
        arr.splice(antes ? j : j + 1, 0, movido);

        this._guardarOrden(arr.map(t => t.IdEtiqueta));
        this.injectLegend();            // repinta los chips en el nuevo orden
        this.aplicarFiltroEtiqueta();   // re-ordena la tabla en vivo, respetando el filtro
    },

    injectLegend: function() {
        const container = document.getElementById('m4-view-bandeja');
        if (!container) return;
        const old = document.getElementById('etiq-legend');
        if (old) old.remove();

        let html = '<div id="etiq-legend" class="flex flex-wrap gap-2.5 p-2.5 mb-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm shrink-0 items-center animate-fade-in-up"><span class="text-xs font-bold uppercase text-slate-500 mr-1">Etiquetas:</span>';
        this.customTags.forEach(tag => {
            const css = this.TW_COLORS[tag.ColorCSS] || this.TW_COLORS['slate'];
            const activo = (this._tagFilter || []).some(id => id.toString() === tag.IdEtiqueta.toString());
            const anillo = activo ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-slate-800 scale-105' : '';
            html += `<span draggable="true" data-tag-id="${tag.IdEtiqueta}" onclick="window.AuxiliarLogic.toggleFiltroEtiqueta('${tag.IdEtiqueta}')" class="etiq-chip ${css} ${anillo} border-b-2 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm select-none cursor-grab active:cursor-grabbing hover:scale-105 hover:shadow-md transition-transform" title="${tag.Descripcion || ''} — Clic: filtrar por esta etiqueta · Arrastrar: cambiar el orden">${activo ? '✅' : '🏷️'} ${tag.Nombre}</span>`;
        });
        html += `<span onclick="window.AuxiliarLogic.openTagManager()" class="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap select-none cursor-pointer border border-dashed border-slate-400 dark:border-slate-500 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Crear, editar o eliminar etiquetas">✏️ Editar</span>`;

        // Selector de prioridad: qué manda al ordenar la bandeja
        const prio = this.getPrioridad();
        const btn = (v, txt, tip) => `<button onclick="window.AuxiliarLogic.setPrioridad('${v}')" title="${tip}" class="px-2 py-1 rounded-md border text-[10px] transition-colors ${prio === v ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}">${txt}</button>`;
        html += `<span class="ml-auto flex items-center gap-1">
            <span class="text-[10px] font-bold uppercase text-slate-400 mr-1">Primero:</span>
            ${btn('sugerencias', 'Sugerencias', 'Las coincidencias del algoritmo arriba; dentro de cada bloque, el orden de las etiquetas')}
            ${btn('categorias', 'Categorías', 'Agrupa por etiqueta según el orden de los chips; dentro de cada etiqueta, primero las sugerencias')}
        </span>`;

        html += '</div>';
        container.children[0].insertAdjacentHTML('afterend', html);
        this._engancharArrastre();   // los chips se re-crean en cada pintado
    },

    _borradorApiM4: async function(action, payload = {}) {
        const res = await fetch('api/borrador_auxiliar_m4.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify(Object.assign({
                action: action
            }, payload))
        });

        const raw = await res.text();

        let data;

        try {
            data = JSON.parse(raw);
        } catch (e) {
            throw new Error(
                `Respuesta no JSON del endpoint de borrador M4 (HTTP ${res.status}).`
            );
        }

        if (!res.ok || !data.success) {
            throw new Error(
                data.error ||
                `Error HTTP ${res.status} al procesar el borrador M4.`
            );
        }

        return data;
    },

    _crearSnapshotBorradorM4: function() {
        return {
            manualMatches: (this.manualMatches || []).map(match => ({
                tsdIds: (match.tsdArr || [])
                    .map(t => String(t.ID_Transaccion || ''))
                    .filter(Boolean),

                bancoIds: (match.bancoArr || [])
                    .map(b => String(b.IdTransaccion || ''))
                    .filter(Boolean),

                justificacion: match.justificacion || '',
                motivo: match.motivo || null
            })),

            blacklist: Array.from(
                new Set(
                    (this.blacklist || [])
                        .map(x => String(x || ''))
                        .filter(Boolean)
                )
            )
        };
    },

    _aplicarSnapshotBorradorM4: function(snapshot) {
        snapshot = snapshot || {};

        const mapaTSD = new Map(
            (this.lastTSD || []).map(t => [
                String(t.ID_Transaccion),
                t
            ])
        );

        const mapaBancos = new Map(
            (this.lastBancos || []).map(b => [
                String(b.IdTransaccion),
                b
            ])
        );

        const normalizarIds = arr =>
            Array.from(
                new Set(
                    (Array.isArray(arr) ? arr : [])
                        .map(String)
                        .filter(Boolean)
                )
            );

        // =========================================================
        // MANUAL MATCHES
        // ---------------------------------------------------------
        // Se restaura un grupo ÚNICAMENTE si todavía existen TODOS
        // sus miembros. Nunca reconstruimos una agrupación parcial.
        // =========================================================
        const reconstruidos = [];

        (Array.isArray(snapshot.manualMatches)
            ? snapshot.manualMatches
            : []
        ).forEach(match => {

            const tsdIds = normalizarIds(match.tsdIds);
            const bancoIds = normalizarIds(match.bancoIds);

            if (tsdIds.length === 0 && bancoIds.length === 0) {
                return;
            }

            const tsdArr = tsdIds
                .map(id => mapaTSD.get(id))
                .filter(Boolean);

            const bancoArr = bancoIds
                .map(id => mapaBancos.get(id))
                .filter(Boolean);

            const tsdCompleto = tsdArr.length === tsdIds.length;
            const bancoCompleto = bancoArr.length === bancoIds.length;

            if (!tsdCompleto || !bancoCompleto) {
                return;
            }

            reconstruidos.push({
                tsdArr: tsdArr,
                bancoArr: bancoArr,
                justificacion: match.justificacion || '',
                motivo: match.motivo || null
            });
        });

        this.manualMatches = reconstruidos;

        // =========================================================
        // BLACKLIST
        // ---------------------------------------------------------
        // También eliminamos decisiones asociadas a transacciones
        // que ya dejaron de existir entre los pendientes.
        // =========================================================
        const idsActuales = new Set([
            ...mapaTSD.keys(),
            ...mapaBancos.keys()
        ]);

        this.blacklist = Array.from(
            new Set(
                (Array.isArray(snapshot.blacklist)
                    ? snapshot.blacklist
                    : []
                )
                .map(String)
                .filter(key => {
                    const partes = key.split('|');

                    if (partes.length !== 2) return false;

                    if (partes[1] === 'MENOR') {
                        return idsActuales.has(partes[0]);
                    }

                    return (
                        idsActuales.has(partes[0]) &&
                        idsActuales.has(partes[1])
                    );
                })
            )
        );
    },

    guardarBorradorM4: async function(opciones = {}) {
        const forzar = opciones.forzar === true;

        if (
            !this._datosM4Cargados ||
            !this._borradorM4Disponible
        ) {
            return {
                guardado: false,
                motivo: 'no_disponible'
            };
        }

        if (this._guardandoBorradorM4) {
            return {
                guardado: false,
                motivo: 'ocupado'
            };
        }

        const snapshot = this._crearSnapshotBorradorM4();
        const dataJson = JSON.stringify(snapshot);

        const vacio =
            snapshot.manualMatches.length === 0 &&
            snapshot.blacklist.length === 0;

        if (vacio) {
            if (this._borradorM4Existe) {
                this._guardandoBorradorM4 = true;

                try {
                    await this._borradorApiM4('delete');

                    this._borradorM4Existe = false;
                    this._ultimoSnapshotBorradorM4 = dataJson;

                    return {
                        guardado: true,
                        eliminado: true
                    };

                } finally {
                    this._guardandoBorradorM4 = false;
                }
            }

            this._ultimoSnapshotBorradorM4 = dataJson;

            return {
                guardado: false,
                motivo: 'sin_cambios'
            };
        }

        if (
            !forzar &&
            dataJson === this._ultimoSnapshotBorradorM4
        ) {
            return {
                guardado: false,
                motivo: 'sin_cambios'
            };
        }

        this._guardandoBorradorM4 = true;

        try {
            await this._borradorApiM4('save', {
                dataJson: dataJson
            });

            this._borradorM4Existe = true;
            this._ultimoSnapshotBorradorM4 = dataJson;

            return {
                guardado: true
            };

        } finally {
            this._guardandoBorradorM4 = false;
        }
    },

    startAutoSaveBorradorM4: function() {
        this.stopAutoSaveBorradorM4();

        this._autoSaveBorradorM4Timer = setInterval(() => {
            this.guardarBorradorM4().catch(error => {
                console.error(
                    'Error en autoguardado Auxiliar M4:',
                    error
                );
            });
        }, 5 * 60 * 1000);
    },

    stopAutoSaveBorradorM4: function() {
        if (this._autoSaveBorradorM4Timer) {
            clearInterval(this._autoSaveBorradorM4Timer);
            this._autoSaveBorradorM4Timer = null;
        }
    },

    guardarBorradorManualM4: async function() {
        const btn = document.getElementById('btn-save-draft-m4');

        if (!btn) return;

        const originalHtml = btn.innerHTML;

        const mostrarEstado = (texto) => {
            btn.innerHTML = texto;

            setTimeout(() => {
                if (btn) btn.innerHTML = originalHtml;
            }, 1400);
        };

        if (
            !this._datosM4Cargados ||
            !this._borradorM4Disponible
        ) {
            mostrarEstado('NO DISPONIBLE');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = 'GUARDANDO...';

        try {
            const resultado = await this.guardarBorradorM4({
                forzar: true
            });

            btn.disabled = false;

            if (
                resultado &&
                resultado.motivo === 'sin_cambios'
            ) {
                mostrarEstado('SIN CAMBIOS');
            } else {
                mostrarEstado('BORRADOR GUARDADO');
            }

        } catch (error) {
            console.error(
                'No se pudo guardar el borrador M4:',
                error
            );

            btn.disabled = false;
            mostrarEstado('ERROR AL GUARDAR');
        }
    },

    init: async function() {
        console.log("⚖️ Módulo Auxiliar Contable (M4) Inicializado");

        if(this.gridSug) {
            if (typeof this.gridSug.destroy === 'function') this.gridSug.destroy();
            this.gridSug = null;
        }

        if(this.gridLimbo) {
            if (typeof this.gridLimbo.destroy === 'function') this.gridLimbo.destroy();
            this.gridLimbo = null;
        }

        if(this.gridHistorial) {
            if (typeof this.gridHistorial.destroy === 'function') this.gridHistorial.destroy();
            this.gridHistorial = null;
        }

        this.stopAutoSaveBorradorM4();

        this.blacklist = [];
        this.manualMatches = [];

        this._datosM4Cargados = false;
        this._borradorM4Disponible = false;
        this._borradorM4Existe = false;
        this._ultimoSnapshotBorradorM4 = null;

        await this.fetchTags();

        // Iniciar Calendario
        if (window.flatpickr) {
            flatpickr("#m4-historial-date", {
                mode: "range", dateFormat: "Y-m-d", locale: "es",

                // Buscar al cerrar el calendario; si la fecha no cambió, NO recargar
                onClose: () => {
                    const v = document.getElementById('m4-historial-date').value;

                    if (
                        v &&
                        v !== window.AuxiliarLogic._lastDateQuery
                    ) {
                        window.AuxiliarLogic.fetchHistorial();
                    }
                }
            });
        }

        this.switchTab('bandeja');
        this.injectLegend();

        await this.fetchPendientes();

        // Respaldo adicional. Los cambios manuales también se guardan
        // inmediatamente; este reloj funciona únicamente como seguro.
        this.startAutoSaveBorradorM4();
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
                    ccs: uniq(tsdArr.map(c => c.CentroCosto)),      
                    sucs: uniq(tsdArr.map(c => c.Sucursal)),        
                    marcas: uniq(tsdArr.map(c => marcaDe(c.Sucursal)))
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
                    const row = (typeof cell === 'object' && cell) ? (cell.getRow ? cell.getRow() : (cell.getData ? cell.getData() : cell)) : cell;
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
                    const row = (typeof cell === 'object' && typeof cell.getRow === 'function') ? cell.getRow() : cell;
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    const tipoString = val && typeof val === 'object' ? val.tipo : val;
                    const justString = val && typeof val === 'object' ? val.justificacion : '';
                    const evString = val && typeof val === 'object' ? val.evidencia : null;
                    
                    let extrasHtml = justString ? `<div class="text-[9px] text-green-700 dark:text-green-400 font-normal mt-0.5 truncate max-w-[160px] mx-auto italic" title="${justString}">"${justString}"</div>` : '';
                    if (evString) {
                        extrasHtml += `<div class="text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-0.5 flex items-center gap-1 justify-center"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg> Evidencia Visual</div>`;
                    }
                    
                    // Nombre de la etiqueta al pie (manual manda sobre automática), estilo discreto como el recibo de Monto TSD
                    let etiqNombre = null;
                    if (row && row._colorEtiq) {
                        const tE = window.AuxiliarLogic.customTags.find(t => t.IdEtiqueta.toString() === row._colorEtiq.toString());
                        if (tE) etiqNombre = tE.Nombre;
                    } else if (row && (row._categoriaId === 1 || row._categoriaId === 2)) {
                        etiqNombre = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
                    }
                    const etiqHtml = etiqNombre ? `<div class="text-[9px] text-slate-400 dark:text-slate-500 font-normal mt-0.5 normal-case tracking-normal">🏷️ ${etiqNombre}</div>` : '';
                    return `<div class="flex flex-col items-center"><span class="text-green-800 dark:text-green-300 uppercase tracking-widest text-[10px]">✅ ${tipoString.replace('[AUX] ', '')}</span>${extrasHtml}${etiqHtml}</div>`;
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
            if (scope.value !== 'all') return; // Ámbitos específicos = SQL bajo demanda (Enter), jamás por tecla
            clearTimeout(timer);
            timer = setTimeout(() => this.applyHistorialFilter(), 1000); // Espera ~1s tras el último carácter
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
        else { this.historialMaster = []; this.currentHistorialData = []; this.renderHistorialGrid(); this.renderBancosConciliadosM4(); }
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
        this._ccSeleccionados = (selF.cc && selF.cc.length > 0) ? selF.cc.map(String) : null;
        this._sucSeleccionadas = (selF.sucursal && selF.sucursal.length > 0) ? selF.sucursal.map(String) : null;
        this.renderHistorialGrid();
        this.renderHistorialDash(data);
        this.renderBancosConciliadosM4();
    },

    // Trae la conciliación bancaria interna (Detallado vs Pagado por IdMatch) desde su endpoint
    renderBancosConciliadosM4: async function() {
        let dateVal = document.getElementById('m4-historial-date')?.value || '';
        if (!dateVal) return;
        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) { [start, end] = dateVal.split(' a '); }

        const traer = async (banco) => {
            try {
                const res = await fetch(`api/get_conciliados_banco_m4.php?start=${start}&end=${end}&banco=${banco}`);
                const j = await res.json();
                return j.success ? j.data : [];
            } catch { return []; }
        };
        const [bac, davi] = await Promise.all([traer('BAC'), traer('Davibank')]);

        // La diferencia se calcula a NIVEL DE GRUPO (match): depósito del grupo vs suma de netos del grupo
        const prep = (rows) => {
            const sumas = {};
            rows.forEach(r => { sumas[r.IdMatch] = (sumas[r.IdMatch] || 0) + (Number(r.DetNeto) || 0); });
            rows.forEach(r => {
                r._netoGrupo = sumas[r.IdMatch];
                r._dif = r.PagMonto === null ? null : (Number(r.PagMonto) || 0) - sumas[r.IdMatch];
            });
            return rows;
        };
        prep(bac); prep(davi);

        const fmt = (v) => '₡' + (Number(v) || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const D = (c) => (c && typeof c.getRow === 'function' ? c.getRow() : c);
        const cols = [
            { title: "Afiliado", field: "Afiliado", width: 95, cssClass: "font-mono" },
            { title: "Comercio", field: "Comercio", width: 150 },
            { title: "Tarjeta", field: "Tarjeta", width: 95, cssClass: "font-mono" },
            { title: "Autorización", field: "Autorizacion", width: 100, cssClass: "font-mono" },
            { title: "Venta (Bruto)", field: "DetBruto", width: 115, formatter: (c) => fmt(D(c).DetBruto) },
            { title: "Comisión", field: "DetComision", width: 100, formatter: (c) => fmt(D(c).DetComision) },
            { title: "Retenciones", field: "DetRetenciones", width: 105, formatter: (c) => fmt(D(c).DetRetenciones) },
            { title: "Neto Venta", field: "DetNeto", width: 115, cssClass: "font-bold", formatter: (c) => fmt(D(c).DetNeto) },
            { title: "Depósito (grupo)", field: "PagMonto", width: 125, cssClass: "font-bold text-blue-600 dark:text-blue-400", formatter: (c) => { const r = D(c); return r.PagMonto === null ? '<span class="text-slate-400 italic">Sin depósito</span>' : fmt(r.PagMonto); } },
            { title: "Dif. Grupo", field: "_dif", width: 100, formatter: (c) => { const r = D(c); if (r._dif === null) return '<span class="text-slate-400">—</span>'; return `<span class="${Math.abs(r._dif) < 1 ? 'text-green-600' : 'text-red-500 font-bold'}">${fmt(r._dif)}</span>`; } },
            { title: "CC", field: "CentroCosto", width: 80, cssClass: "font-mono" },
            { title: "Folio", field: "Folio", width: 120, cssClass: "font-mono text-[10px]" }
        ];

        const cBac = document.getElementById('count-bac-m4'); if (cBac) cBac.textContent = bac.length;
        const cDavi = document.getElementById('count-davi-m4'); if (cDavi) cDavi.textContent = davi.length;

        if (this.gridBacM4) this.gridBacM4.updateData(bac);
        else this.gridBacM4 = new VanillaGrid("#table-bac-m4", bac, cols, {});

        if (this.gridDaviM4) this.gridDaviM4.updateData(davi);
        else this.gridDaviM4 = new VanillaGrid("#table-davi-m4", davi, cols.map(c => ({...c})), {});
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
        let dateVal = document.getElementById('m4-historial-date')?.value || '';
        // Desde Pendientes (o si nunca se abrió Historial) el selector puede estar vacío → caer al último registro
        if (!dateVal) {
            const hoy = new Date().toISOString().slice(0, 10);
            dateVal = this._lastDateQuery || `${hoy} a ${hoy}`;
        }
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
        // Formato de moneda consistente: ₡ con separador de miles (espacio) y sin decimales
        const fmt = (n) => new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n || 0).replace(/\./g, ' ');
        // Formato compacto para etiquetas sobre las barras (evita saturar): ₡1,2M / ₡340k
        const fmtCorto = (n) => {
            const v = Math.abs(n || 0);
            if (v >= 1000000) return '₡' + (n / 1000000).toFixed(1).replace('.', ',') + 'M';
            if (v >= 1000) return '₡' + Math.round(n / 1000) + 'k';
            return '₡' + Math.round(n || 0);
        };
        const dark = document.documentElement.classList.contains('dark');
        const tick = dark ? '#94a3b8' : '#475569';
        // Tamaños de fuente unificados para todos los gráficos (más grandes y legibles)
        const FS = { eje: 14, leyenda: 14, etiqueta: 13, tooltip: 14 };
        const tooltipFont = { titleFont: { size: FS.tooltip + 1, weight: 'bold' }, bodyFont: { size: FS.tooltip }, padding: 10 };

        // Anti-duplicidad: cada lado se cuenta UNA vez. TSD desde _tsdArr, banco desde _bancoArr.
        let totalTSD = 0, totalBanco = 0, totalCom = 0, totalRet = 0;
        const porCC = {};
        const ccNombre = {}; // Traducción: código de CC -> nombre de sucursal
        const porEntidad = {}; // { 'BAC': {tsd, banco}, ... }
        const porBanco = {};   // { 'BAC': {bruto, com, ret, neto} }
        const porTarjeta = {}; // { 'VISA': monto, ... } Ingreso bruto por tipo de tarjeta
        const porSucursalBanco = {}; // { 'Belen': {BAC: monto, DAVI: monto}, ... } % de cobro por banco en cada sucursal

        const ccFiltro = this._ccSeleccionados;   // null = sin filtro de CC
        const sucFiltro = this._sucSeleccionadas; // null = sin filtro de sucursal
        (data || []).forEach(r => {
            (r._tsdArr || []).forEach(t => {
                // Cuando hay filtro de CC, solo cuentan las transacciones TSD de ese CC
                if (ccFiltro && !ccFiltro.includes(String(t.CentroCosto))) return;
                if (sucFiltro && !sucFiltro.includes(String(t.Sucursal))) return;
                totalTSD += Number(t.MontoCRC) || 0;
                // Tipo de Tarjeta: SOLO desde TSD (única fuente real de la marca)
                const tt = String(t.TipoTarjeta || '').trim().toUpperCase() || 'S/D';
                porTarjeta[tt] = (porTarjeta[tt] || 0) + (Number(t.MontoCRC) || 0);
                // Centro de Costo: SOLO desde TSD (CC y nombre de sucursal)
                const cc = t.CentroCosto || 'Sin CC';
                porCC[cc] = (porCC[cc] || 0) + (Number(t.MontoCRC) || 0);
                if (cc !== 'Sin CC' && t.Sucursal) ccNombre[cc] = t.Sucursal;
            });
            // Reparto de cobro por banco por sucursal. Usamos la sucursal de TSD del grupo
            // (mismo vocabulario que el filtro), no b.Sucursal que viene del diccionario y no coincide.
            const sucGrupo = String((r._tsdArr && r._tsdArr[0] && r._tsdArr[0].Sucursal) || 'Sin sucursal').trim();
            // Respeta el filtro de sucursal contra el nombre de TSD (el mismo que marca el usuario)
            if (!sucFiltro || sucFiltro.includes(sucGrupo)) {
                (r._bancoArr || []).forEach(b => {
                    const banco = String(b.Banco || '').toUpperCase().includes('BAC') ? 'BAC' : 'DAVI';
                    if (!porSucursalBanco[sucGrupo]) porSucursalBanco[sucGrupo] = { BAC: 0, DAVI: 0 };
                    porSucursalBanco[sucGrupo][banco] += Number(b.MontoBrutoBanco) || 0;
                });
            }
            (r._bancoArr || []).forEach(b => {
                const monto = Number(b.MontoBrutoBanco) || 0;
                totalBanco += monto;
                totalCom += Number(b.Comision) || 0;
                totalRet += Number(b.Retenciones) || 0;
                const bk = b.Banco || '?';
                if (!porBanco[bk]) porBanco[bk] = { bruto: 0, com: 0, ret: 0, neto: 0, comInt: 0, retVentas: 0, retRenta: 0, retIVA: 0, retISR: 0 };
                porBanco[bk].bruto += monto;
                porBanco[bk].com += Number(b.Comision) || 0;
                porBanco[bk].ret += Number(b.Retenciones) || 0;
                porBanco[bk].neto += Number(b.MontoNetoBanco) || 0;
                // Desglose fino (los campos vacíos del banco contrario simplemente suman 0)
                porBanco[bk].comInt    += (Number(b.ComInternacionalBAC) || 0) + (Number(b.ComInternacionalDavi) || 0);
                porBanco[bk].retVentas += Number(b.RetVentasBAC) || 0;
                porBanco[bk].retRenta  += Number(b.RetRentaBAC) || 0;
                porBanco[bk].retIVA    += Number(b.RetIVADavi) || 0;
                porBanco[bk].retISR    += Number(b.RetISRDavi) || 0;
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
            const totalCC = vals.reduce((a, v) => a + v, 0);
            this._chCC = new Chart(ctxCC.getContext('2d'), {
                type: 'doughnut',
                data: { labels, datasets: [{ data: vals, backgroundColor: palette.slice(0, labels.length), borderWidth: 0 }] },
                plugins: [ChartDataLabels],
                options: { responsive: true, maintainAspectRatio: false, plugins: {
                    legend: { position: 'right', labels: { color: tick, font: { size: FS.leyenda }, boxWidth: 14 } },
                    tooltip: { callbacks: { label: (c) => c.label + (codigos[c.dataIndex] && codigos[c.dataIndex] !== '—' ? ' · CC ' + codigos[c.dataIndex] : '') + ': ' + fmt(c.raw) } },
                    datalabels: {
                        color: '#fff', font: { size: FS.etiqueta, weight: 'bold' },
                        display: (ctx) => totalCC > 0 && (ctx.dataset.data[ctx.dataIndex] / totalCC) > 0.05,
                        formatter: (val) => fmtCorto(val)
                    }
                } }
            });
        }

        // --- BARRAS APILADAS 100%: reparto del cobro por banco en cada sucursal ---
        const ctxVS = document.getElementById('ch-hist-vs');
        if (ctxVS) {
            // Ordenar sucursales por volumen total (las de más movimiento primero)
            const sucs = Object.keys(porSucursalBanco)
                .filter(s => (porSucursalBanco[s].BAC + porSucursalBanco[s].DAVI) > 0)
                .sort((a, b) => (porSucursalBanco[b].BAC + porSucursalBanco[b].DAVI) - (porSucursalBanco[a].BAC + porSucursalBanco[a].DAVI));
            const pct = (parte, suc) => { const t = porSucursalBanco[suc].BAC + porSucursalBanco[suc].DAVI; return t > 0 ? (parte / t) * 100 : 0; };
            // Ancho dinámico: cada sucursal necesita ~30px para que la barra vertical y su rótulo (rotado) se lean
            const canvasVS = ctxVS.canvas || ctxVS;
            if (canvasVS && canvasVS.parentElement) canvasVS.parentElement.style.width = Math.max(sucs.length * 30 + 60, 300) + 'px';
            this._chVS = new Chart(ctxVS.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: sucs,
                    datasets: [
                        { label: 'Davibank', data: sucs.map(s => pct(porSucursalBanco[s].DAVI, s)), backgroundColor: '#16a34a', _raw: sucs.map(s => porSucursalBanco[s].DAVI) },
                        { label: 'BAC',      data: sucs.map(s => pct(porSucursalBanco[s].BAC, s)),  backgroundColor: '#dc2626', _raw: sucs.map(s => porSucursalBanco[s].BAC) }
                    ]
                },
                options: {
                    indexAxis: 'x', // barras VERTICALES
                    responsive: true, maintainAspectRatio: false,
                    // 'nearest' + intersect:true => el tooltip lee SOLO el segmento exacto bajo el cursor (no el vecino)
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                        legend: { position: 'top', labels: { color: tick, font: { size: FS.leyenda }, boxWidth: 14 } },
                        datalabels: {
                            color: '#fff', font: { size: FS.etiqueta - 2, weight: 'bold' },
                            display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 8,
                            formatter: (v) => Math.round(v) + '%'
                        },
                        tooltip: { callbacks: {
                            label: (c) => {
                                const monto = c.dataset._raw ? c.dataset._raw[c.dataIndex] : 0;
                                return `${c.dataset.label}: ${c.raw.toFixed(1)}% (${fmt(monto)})`;
                            }
                        } }
                    },
                    scales: {
                        x: { stacked: true, ticks: { color: tick, font: { size: FS.eje }, autoSkip: false, maxRotation: 90, minRotation: 90 }, grid: { display: false } },
                        y: { stacked: true, max: 100, ticks: { color: tick, font: { size: FS.eje }, callback: (v) => v + '%' }, grid: { color: tick + '22' } }
                    }
                }
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
                plugins: [ChartDataLabels],
                options: { responsive: true, maintainAspectRatio: false, plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => 'Ingreso Bruto: ' + fmt(c.raw) } },
                    datalabels: { anchor: 'end', align: 'top', color: tick, font: { size: FS.etiqueta, weight: 'bold' }, formatter: (v) => v > 0 ? fmtCorto(v) : '' }
                }, scales: { x: { ticks: { color: tick, font: { size: FS.eje } } }, y: { ticks: { color: tick, font: { size: FS.eje }, callback: (v) => '₡' + (v / 1000) + 'k' } } } }
            });
        }

        // --- BARRAS HORIZONTALES 100%: composición proporcional por banco (neutraliza la diferencia de volumen) ---
        const ctxB = document.getElementById('ch-hist-banco');
        if (ctxB) {
            const bancos = Object.keys(porBanco);
            // Base del 100% por banco: suma de todos los conceptos de cobro + neto
            const baseDe = (b) => {
                const p = porBanco[b];
                return p.com + p.comInt + p.retVentas + p.retRenta + p.retIVA + p.retISR + Math.max(p.neto, 0);
            };
            const pct = (parte, b) => { const base = baseDe(b); return base > 0 ? (parte / base) * 100 : 0; };
            // Un segmento por cada concepto de cobro; los que no aplican a un banco quedan en 0
            const segmentos = [
                { label: 'Comisión',         campo: 'com',       color: '#f59e0b' },
                { label: 'Comisión Internac.', campo: 'comInt',  color: '#fb923c' },
                { label: 'Ret. Ventas (BAC)', campo: 'retVentas', color: '#ef4444' },
                { label: 'Ret. Renta (BAC)',  campo: 'retRenta',  color: '#dc2626' },
                { label: 'Ret. IVA (Davi)',   campo: 'retIVA',    color: '#f43f5e' },
                { label: 'Ret. ISR (Davi)',   campo: 'retISR',    color: '#be123c' },
                { label: 'Ingreso Neto',      campo: 'neto',      color: '#10b981' }
            ];
            const datasets = segmentos.map(seg => ({
                label: seg.label,
                data: bancos.map(b => 0), // se calcula en recalcular()
                backgroundColor: seg.color,
                _raw: bancos.map(b => seg.campo === 'neto' ? Math.max(porBanco[b].neto, 0) : porBanco[b][seg.campo])
            }));

            // Re-normaliza los % usando SOLO los segmentos visibles → siempre suma 100%
            const recalcular = (chart) => {
                chart.data.datasets.forEach((ds, i) => {
                    const oculto = chart.getDatasetMeta(i).hidden;
                    ds.data = bancos.map((b, bi) => {
                        if (oculto) return 0;
                        let base = 0;
                        chart.data.datasets.forEach((d2, j) => {
                            if (!chart.getDatasetMeta(j).hidden) base += (d2._raw[bi] || 0);
                        });
                        return base > 0 ? ((ds._raw[bi] || 0) / base) * 100 : 0;
                    });
                });
                chart.update();
            };

            this._chBanco = new Chart(ctxB.getContext('2d'), {
                type: 'bar',
                data: { labels: bancos, datasets },
                plugins: [ChartDataLabels, { id: 'initRecalcBanco', afterInit: (chart) => recalcular(chart) }],
                options: {
                    indexAxis: 'y',
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: tick, font: { size: FS.leyenda }, boxWidth: 14 },
                            onClick: (e, legendItem, legend) => {
                                const chart = legend.chart;
                                const meta = chart.getDatasetMeta(legendItem.datasetIndex);
                                meta.hidden = meta.hidden === null ? !chart.data.datasets[legendItem.datasetIndex].hidden : null;
                                recalcular(chart);
                            }
                        },
                        tooltip: { callbacks: { label: (c) => {
                            const montoReal = c.dataset._raw ? c.dataset._raw[c.dataIndex] : 0;
                            return `${c.dataset.label}: ${fmt(montoReal)} (${c.raw.toFixed(1)}%)`;
                        } } },
                        datalabels: {
                            color: '#fff', font: { size: FS.etiqueta, weight: 'bold' },
                            // Solo muestra el monto si el segmento es lo bastante ancho para que quepa
                            display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 7,
                            formatter: (val, ctx) => {
                                const monto = ctx.dataset._raw[ctx.dataIndex] || 0;
                                return fmtCorto(monto);
                            }
                        }
                    },
                    scales: {
                       x: { stacked: true, max: 100, ticks: { color: tick, font: { size: FS.eje }, callback: (v) => v + '%' } },
                        y: { stacked: true, ticks: { color: tick, font: { size: FS.eje + 1, weight: 'bold' } } }
                    }
                }
            });
        }
    },

    fetchPendientes: async function() {
        const loader = document.getElementById('m4-loader');
        if (loader) loader.classList.remove('hidden');

        // Mientras reconstruimos la fuente, ningún autoguardado puede
        // escribir un estado parcial o desactualizado.
        this._datosM4Cargados = false;

        try {
            const res = await fetch(
                `api/get_pendientes_m4.php`,
                { cache: 'no-store' }
            );

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error);
            }

            // =====================================================
            // 1. FUENTE FRESCA
            // =====================================================
            this.lastTSD = json.tsd.map(t => {
                t._id = 't_' + t.ID_Transaccion;
                return t;
            });

            this.lastBancos = json.bancos.map(b => {
                b._id = 'b_' + b.IdTransaccion;
                return b;
            });

            // Nunca heredamos directamente la RAM anterior.
            this.blacklist = [];
            this.manualMatches = [];

            // =====================================================
            // 2. BORRADOR COMPARTIDO
            // =====================================================
            try {
                const borrador = await this._borradorApiM4('get');

                this._borradorM4Disponible = true;
                this._borradorM4Existe = !!borrador.existe;

                if (borrador.existe) {
                    // Guardamos primero el snapshot ORIGINAL del servidor.
                    // Si al reconstruir desaparecen filas viejas, después
                    // detectaremos la diferencia y limpiaremos el borrador.
                    this._ultimoSnapshotBorradorM4 =
                        borrador.dataJson || null;

                    const snapshot = JSON.parse(
                        borrador.dataJson || '{}'
                    );

                    this._aplicarSnapshotBorradorM4(snapshot);

                } else {
                    this._ultimoSnapshotBorradorM4 =
                        JSON.stringify(
                            this._crearSnapshotBorradorM4()
                        );
                }

            } catch (errorBorrador) {
                // La conciliación debe seguir funcionando incluso si
                // temporalmente falla el almacenamiento del borrador.
                // Pero deshabilitamos escrituras para no pisar un estado
                // remoto que no logramos leer.
                this._borradorM4Disponible = false;
                this._borradorM4Existe = false;
                this._ultimoSnapshotBorradorM4 = null;

                console.error(
                    'No se pudo cargar el borrador Auxiliar M4:',
                    errorBorrador
                );
            }

            // =====================================================
            // 3. ALGORITMO
            // -----------------------------------------------------
            // Primero quedaron aplicados los manuales válidos.
            // Ahora el algoritmo procesa todo lo nuevo que haya llegado.
            // =====================================================
            this.runMatchingAlgorithm(
                this.lastTSD,
                this.lastBancos
            );

            this._datosM4Cargados = true;

            // Si el borrador contenía registros que ya fueron conciliados
            // y por eso desaparecieron de pendientes, lo compactamos
            // silenciosamente en este mismo momento.
            if (this._borradorM4Disponible) {
                try {
                    await this.guardarBorradorM4();
                } catch (errorLimpieza) {
                    console.error(
                        'No se pudo compactar el borrador M4:',
                        errorLimpieza
                    );
                }
            }

            return true;

        } catch (error) {
            console.error(error);

            window.SysUI.alert(
                "Error al reconstruir historial: " + error.message,
                "Fallo",
                "error"
            );

            return false;

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
                const tipo = sinTildes(b.TipoAjuste);
                const desc = sinTildes(b.Nombre_Sucursal_Comercio);
                const just = sinTildes(b.Justificacion);
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

            // La etiqueta MANUAL del usuario manda sobre CUALQUIER color de sistema (incluido Ajuste Menor y Ajuste Interno).
            if (colorEtiq) {
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
            // El motivo se anexa al estado para que se lea en la columna ESTADO AUX
            const etq = mMatch.motivo === 'DEVOLUCION' ? 'Manual (Devolución Datáfono)'
                      : mMatch.motivo === 'INTERNO'    ? 'Manual (Ajuste Interno Bancos)'
                      : mMatch.motivo === 'MENOR'      ? 'Manual (Monto Menor)'
                      :                                  'Manual';
            if (arrT.length > 0 || arrB.length > 0) processMatch(arrT, arrB, etq, mMatch.justificacion);
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

                // La etiqueta puesta por el usuario MANDA sobre la sugerencia automática
                if (tsdRow.ColorEtiqueta && (catId === 1 || catId === 2)) catId = 3;

                let bgClass = '';
                if (tsdRow.ColorEtiqueta) {
                    const tagObj = this.customTags.find(t => t.IdEtiqueta.toString() === tsdRow.ColorEtiqueta.toString());
                    if (tagObj) bgClass = this.TW_COLORS[tagObj.ColorCSS] || '';
                } else if (catId === 1 || catId === 2) {
                    bgClass = this.getEstiloSistema(catId, false);
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
                if (b.ColorEtiqueta) {
                    const tagObj = this.customTags.find(t => t.IdEtiqueta.toString() === b.ColorEtiqueta.toString());
                    if (tagObj) bgClass = this.TW_COLORS[tagObj.ColorCSS] + ' italic';
                } else if (catId === 1 || catId === 2) {
                    bgClass = this.getEstiloSistema(catId, true);
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

        // Orden maestro (ajustes recientes, sugerencias y etiquetas) en un solo lugar
        this.currentLimboData = this._ordenarFilas(this.currentLimboData);

        // Aviso único: el ajuste recién editado encontró pareja por sí solo
        if (this._avisarSiCruza) {
            const idAviso = this._avisarSiCruza;
            this._avisarSiCruza = null;
            const f = this.currentLimboData.find(r => String(r._dbId) === idAviso);
            const cruzo = f && f._tsdRaw && (Array.isArray(f._tsdRaw) ? f._tsdRaw.length > 0 : true);
            if (cruzo && window.SysUI) {
                SysUI.alert('Con el dato nuevo, el algoritmo le encontró una posible pareja de TSD a este ajuste.\n\nRevísela y apruébela si corresponde.', 'Coincidencia encontrada', 'success');
            }
        }

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
                    
                    if (row._colorEtiq) {
                        const tagObj = window.AuxiliarLogic.customTags.find(t => t.IdEtiqueta.toString() === row._colorEtiq.toString());
                        if (tagObj) {
                            const css = window.AuxiliarLogic.TW_COLORS[tagObj.ColorCSS] || window.AuxiliarLogic.TW_COLORS['slate'];
                            badge = `<span class="block mb-1 text-[9px] font-black uppercase ${css} border px-1 py-0.5 rounded w-max tracking-wider shadow-sm select-none" title="${tagObj.Descripcion || ''}">🏷️ ${tagObj.Nombre}</span>`;
                        }
                    } else if (row._categoriaId === 1 || row._categoriaId === 2) {
                        const nombreSis = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
                        const tagSis = window.AuxiliarLogic.customTags.find(t => Number(t.EsSistema) === 1 && t.Nombre === nombreSis);
                        const cssSis = window.AuxiliarLogic.TW_COLORS[tagSis ? tagSis.ColorCSS : (row._categoriaId === 1 ? 'rose' : 'fuchsia')] || '';
                        const icono = row._categoriaId === 1 ? '🛑' : '🔄';
                        badge = `<span class="block mb-1 text-[9px] font-black uppercase ${cssSis} border px-1 py-0.5 rounded w-max tracking-wider shadow-sm select-none">${icono} ${nombreSis}</span>`;
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
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    const val = String(typeof cell === 'object' && cell.getValue ? cell.getValue() : cell);

                    // Texto discreto de la etiqueta al pie (manual manda sobre la sugerencia automática)
                    let etiqNombre = null;
                    if (row && row._colorEtiq) {
                        const tE = window.AuxiliarLogic.customTags.find(t => t.IdEtiqueta.toString() === row._colorEtiq.toString());
                        if (tE) etiqNombre = tE.Nombre;
                    } else if (row && (row._categoriaId === 1 || row._categoriaId === 2)) {
                        etiqNombre = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
                    }
                    const etiqHtml = etiqNombre ? `<div class="text-[9px] text-slate-400 dark:text-slate-500 font-normal mt-0.5 normal-case tracking-normal">🏷️ ${etiqNombre}</div>` : '';

                    let estado = '';
                    if(val.startsWith('Manual')) {
                        // El motivo viene entre paréntesis: "Manual (Devolución Datáfono)"
                        const m = val.split('|')[0].match(/\(([^)]+)\)/);
                        if (m) {
                            const tipo = m[1];
                            const ico = tipo.includes('Devolución') ? '↩️'
                                      : tipo.includes('Interno')    ? '🔄'
                                      : tipo.includes('Menor')      ? '✂️' : '✅';
                            const col = tipo.includes('Devolución') ? 'text-orange-600 dark:text-orange-400'
                                      : tipo.includes('Interno')    ? 'text-cyan-600 dark:text-cyan-400'
                                      : tipo.includes('Menor')      ? 'text-fuchsia-600 dark:text-fuchsia-400'
                                      :                               'text-green-700 dark:text-green-400';
                            estado = `<span class="${col} font-bold">${ico} ${tipo}</span>`;
                        } else {
                            estado = `<span class="text-green-700 dark:text-green-400">✅ Aprobado Manual</span>`;
                        }
                    }
                    else if(val.includes('Monto Igual')) estado = `<span class="text-amber-600 dark:text-amber-400">⚠️ Sug: Monto Igual</span>`;
                    else if(val.includes('Ajuste Menor')) estado = `<span class="text-purple-600 dark:text-purple-400">✂️ ${val.replace('Sugerencia: ','')}</span>`;
                    else if(val.includes('Ajuste Interno')) estado = `<span class="text-cyan-600 dark:text-cyan-400">🔄 ${val.replace('Sugerencia: ','').replace('Ajuste Interno ', 'Ajuste ')}</span>`;
                    else if(val.startsWith('Sugerencia')) estado = `<span class="text-amber-700 dark:text-amber-300">💡 ${val.replace('Sugerencia: ','')}</span>`;
                    else estado = `<span class="text-slate-500 font-bold">⏳ Pendiente</span>`;

                    return `<div class="flex flex-col items-center">${estado}${etiqHtml}</div>`;
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
                    // OJO: VanillaGrid entrega getRow(), NO getData(). Aquí vive el botón de borrado.
                    const row = (typeof cell === 'object' && cell) ? (cell.getRow ? cell.getRow() : (cell.getData ? cell.getData() : cell)) : cell;
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;

                    const nota = val
                        ? `<div class="italic font-medium text-slate-600 dark:text-slate-300 break-words whitespace-normal leading-tight" title="${val}">💬 ${val}</div>`
                        : '<span class="text-slate-300 dark:text-slate-600">-</span>';

                    const del = window.AuxiliarLogic._esAjusteBorrable(row)
                        ? window.AuxiliarLogic._btnEditarHtml(row._dbId)
                        : '';

                    if (!del) return nota;
                    return `<div class="flex items-center justify-between gap-2 w-full">
                                <div class="min-w-0 flex-1">${nota}</div>
                                ${del}
                            </div>`;
                }
            }
        ];

        if (this.gridSug) this.gridSug.updateData(this.currentSugData);
        else this.gridSug = new VanillaGrid("#table-sug-m4", this.currentSugData, columns, { searchInputId: "search-m4", onRowDblClick: (r) => window.AuxiliarLogic.openTransactionModal(r) });

        if (this.gridLimbo) this.aplicarFiltroEtiqueta();
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
                        <span class="absolute left-3 top-2.5 text-emerald-400 text-sm">🔍</span>
                        <div class="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-1 pl-1" id="ws-total-tsd">0 disponibles</div>
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
                        <input type="text" id="ws-search-banco" oninput="renderUI()" placeholder="Buscar por afiliado, MerID, comercio, autorización, tarjeta o monto..." class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-xs outline-none">
                        <span class="absolute left-3 top-2.5 text-blue-400 text-sm">🔍</span>
                        <div class="text-[9px] text-blue-500 dark:text-blue-400 font-bold mt-1 pl-1" id="ws-total-bancos">0 disponibles</div>
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
                        <h3 id="ws-mini-titulo" class="text-lg font-bold text-amber-600 dark:text-amber-400"></h3>
                    </div>
                    <div id="ws-mini-texto" class="px-6 py-5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed"></div>
                    <div id="ws-mini-campos" class="px-6 pb-4 hidden">
                        <div id="ws-campo-1">
                            <label id="ws-label-1" class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Asiento de Softland *</label>
                            <input id="ws-softland" placeholder="AS-2026-04512" class="w-full mb-3 px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500">
                        </div>
                        <div id="ws-campo-2">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detalle adicional (opcional)</label>
                            <input id="ws-detalle" placeholder="Información complementaria" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500">
                        </div>
                        <div id="ws-mini-error" class="hidden mt-2 text-[11px] text-red-600 font-bold"></div>
                    </div>
                    <div id="ws-mini-botones" class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap justify-end gap-2 border-t border-slate-100 dark:border-slate-700"></div>
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

                // Pinta el modal según el paso: elección de motivo o captura de datos
                function pintarMini(titulo, texto, botones, mostrarCampos) {
                    document.getElementById('ws-mini-titulo').innerText = titulo;
                    document.getElementById('ws-mini-texto').innerText = texto;
                    document.getElementById('ws-mini-campos').classList.toggle('hidden', !mostrarCampos);
                    document.getElementById('ws-mini-botones').innerHTML = botones;
                    const err = document.getElementById('ws-mini-error');
                    if (err) err.classList.add('hidden');
                    openMiniModal();
                }

                // 'var' y no 'const': la ventana emergente se recicla y el script se
                // vuelve a escribir en el mismo documento. Con 'const' el navegador
                // lanza "Identifier has already been declared" (misma razón que parentLogic).
                var btnGris = 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-colors';
                var btnNar  = 'bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors';
                var btnCya  = 'bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors';
                var btnFuc  = 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors';

                // PASO 1 — una sola fila bancaria
                function preguntarUno() {
                    pintarMini('Diferencia neta muy baja',
                        'Se ha detectado que la transacción tiene un monto muy bajo. Puede tratarse de un ajuste por monto menor o de una devolución a nivel de datáfono.\\n\\nIndique de cuál se trata.',
                        '<button onclick="closeMiniModal()" class="' + btnGris + '">Cancelar</button>' +
                        '<button onclick="pedirDatos(\\'MENOR\\')" class="' + btnFuc + '">Es un monto menor</button>' +
                        '<button onclick="pedirDatos(\\'DEVOLUCION\\')" class="' + btnNar + '">Es una devolución por datáfono</button>', false);
                }

                // PASO 1 — varias filas bancarias
                function preguntarVarios() {
                    pintarMini('Diferencia neta muy baja',
                        'Se ha detectado que la diferencia neta entre las transacciones es muy baja. Podría tratarse de un ajuste interno entre bancos o de una devolución a nivel de datáfono.\\n\\nIndique de cuál se trata.',
                        '<button onclick="closeMiniModal()" class="' + btnGris + '">Cancelar</button>' +
                        '<button onclick="pedirDatos(\\'INTERNO\\')" class="' + btnCya + '">Es un ajuste interno entre bancos</button>' +
                        '<button onclick="pedirDatos(\\'DEVOLUCION\\')" class="' + btnNar + '">Es una devolución por datáfono</button>', false);
                }

                // PASO 2 — captura de la justificación según el motivo
                function pedirDatos(motivo) {
                    // Se restauran los campos en cada apertura (el modal es reutilizado)
                    document.getElementById('ws-campo-2').style.display = '';
                    document.getElementById('ws-softland').value = '';
                    document.getElementById('ws-detalle').value = '';

                    if (motivo === 'DEVOLUCION') {
                        document.getElementById('ws-label-1').innerText = 'Asiento de Softland *';
                        document.getElementById('ws-softland').placeholder = 'AS-2026-04512';
                        pintarMini('Devolución a nivel de datáfono',
                            'Justifique la devolución. Esta transacción quedará conciliada sin contraparte de TSD.',
                            '<button onclick="closeMiniModal()" class="' + btnGris + '">Cancelar</button>' +
                            '<button onclick="confirmarMotivo(\\'DEVOLUCION\\')" class="' + btnNar + '">Guardar devolución</button>', true);
                    } else if (motivo === 'INTERNO') {
                        document.getElementById('ws-label-1').innerText = 'Motivo *';
                        document.getElementById('ws-softland').placeholder = 'Motivo del ajuste interno';
                        pintarMini('Ajuste interno entre bancos',
                            'Escriba el motivo del ajuste interno. Quedará conciliado sin contraparte de TSD.',
                            '<button onclick="closeMiniModal()" class="' + btnGris + '">Cancelar</button>' +
                            '<button onclick="confirmarMotivo(\\'INTERNO\\')" class="' + btnCya + '">Guardar ajuste interno</button>', true);
                    } else {
                        document.getElementById('ws-label-1').innerText = 'Justificación (opcional)';
                        document.getElementById('ws-softland').placeholder = 'Motivo del ajuste';
                        document.getElementById('ws-campo-2').style.display = 'none';
                        pintarMini('Ajuste por monto menor',
                            'Puede agregar una justificación si lo desea. Este campo es opcional.',
                            '<button onclick="closeMiniModal()" class="' + btnGris + '">Cancelar</button>' +
                            '<button onclick="confirmarMotivo(\\'MENOR\\')" class="' + btnFuc + '">Guardar monto menor</button>', true);
                    }
                    setTimeout(() => { const i = document.getElementById('ws-softland'); if (i) i.focus(); }, 80);
                }

                // PASO 3 — validar y guardar
                async function confirmarMotivo(motivo) {
                    const campo1 = (document.getElementById('ws-softland').value || '').trim();
                    const campo2 = (document.getElementById('ws-detalle').value || '').trim();
                    const err = document.getElementById('ws-mini-error');

                    if (motivo === 'DEVOLUCION' && !campo1) {
                        err.innerText = 'El asiento de Softland es obligatorio.'; err.classList.remove('hidden'); return;
                    }
                    if (motivo === 'INTERNO' && !campo1) {
                        err.innerText = 'El motivo es obligatorio.'; err.classList.remove('hidden'); return;
                    }

                    let justificacion;
                    if (motivo === 'DEVOLUCION') justificacion = '[SOFTLAND:' + campo1 + ']' + (campo2 ? ' ' + campo2 : '');
                    else if (motivo === 'INTERNO') justificacion = campo1 + (campo2 ? ' — ' + campo2 : '');
                    else justificacion = campo1 || 'Aprobación Manual (Ajuste Menor)';

                    closeMiniModal();
                    const proceed = await parentLogic.wsSave(justificacion, motivo === 'MENOR', motivo);
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
                                <b class="text-green-600 dark:text-green-400">Monto Origen USD:</b> $\${t.MontoUSD || 0} <span class="text-slate-400 ml-2">(T.C. Aplicado: ₡\${t.TipoCambio || 1})</span>
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

                    // Sin recorte: se muestran TODOS los pendientes del auxiliar
                    document.getElementById('ws-sug-tsd').innerHTML = availableT.map(t => buildCard(t, true, false)).join('');
                    const cntT = document.getElementById('ws-total-tsd');
                    if (cntT) cntT.innerText = availableT.length + (termT ? ' encontrados' : ' disponibles');

                    const termB = clean(document.getElementById('ws-search-banco')?.value || '');
                    if (termB) availableB = availableB.filter(b =>
                        clean(b.Numero_Autorizacion).includes(termB) ||
                        clean(b.Monto_Venta_Original).includes(termB) ||
                        clean(b.Afiliado_MerID).includes(termB) ||
                        clean(b.Nombre_Sucursal_Comercio).includes(termB) ||
                        clean(b.Codigo_Sucursal_Terminal).includes(termB) ||
                        clean(b.Tarjeta_Ultimos4).includes(termB) ||
                        clean(b.Banco).includes(termB));
                    else availableB = availableB.sort((a,b) => Math.abs(parseFloat(a.Monto_Venta_Original)-gap) - Math.abs(parseFloat(b.Monto_Venta_Original)-gap));

                    // Sin recorte: se muestran TODOS los pendientes del auxiliar
                    document.getElementById('ws-sug-bancos').innerHTML = availableB.map(b => buildCard(b, false, false)).join('');
                    const cntB = document.getElementById('ws-total-bancos');
                    if (cntB) cntB.innerText = availableB.length + (termB ? ' encontrados' : ' disponibles');

                    const footer = document.getElementById('ws-footer');
                    // Antes exigía filas en AMBOS lados, así que con sólo bancos el botón
                    // de aprobar nunca aparecía. Ahora basta con tener algo en la estación.
                    if (ws.tsd.length > 0 || ws.bancos.length > 0) footer.classList.remove('hidden');
                    else footer.classList.add('hidden');
                }

                async function saveAndClose() {
                    const justInput = document.getElementById('ws-just');
                    let justificacion = justInput ? justInput.value.trim() : '';
                    
                    const nT = parentLogic.ws.tsd.length;
                    const nB = parentLogic.ws.bancos.length;

                    // SOLO TSD: se respeta el comportamiento histórico, sin tocar nada
                    if (nT === 1 && nB === 0 && Math.abs(parseFloat(parentLogic.ws.tsd[0].MontoCRC) || 0) < 10000) {
                        pedirDatos('MENOR');
                        return;
                    }

                    // SOLO BANCOS: nunca se aprueba sin declarar un motivo
                    if (nB >= 1 && nT === 0) {
                        const neta = parentLogic.ws.bancos
                            .reduce((a, b) => a + (parseFloat(b.Monto_Venta_Original) || 0), 0);
                        const diferenciaBaja = Math.abs(neta) < (nB === 1 ? 10000 : 3000);

                        if (diferenciaBaja) { (nB === 1 ? preguntarUno : preguntarVarios)(); }
                        else { pedirDatos('DEVOLUCION'); }
                        return;
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

    wsSave: async function(justificacion = '', isAjusteMenor = false, motivo = null) {
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

        // REGLA DE ORO: TSD vs Banco, o varios TSD entre sí (ajuste interno de TSD).
        // Los BANCOS SOLOS ya NO se aprueban sin motivo: antes 'validBancoInterno'
        // dejaba pasar 2+ filas bancarias sin ninguna justificación (bug corregido).
        const validTsdBanco   = this.ws.tsd.length > 0 && this.ws.bancos.length > 0;
        const validTsdInterno = this.ws.tsd.length > 1 && this.ws.bancos.length === 0;

        // Bancos solos: sólo con uno de los tres motivos declarados por el usuario
        const soloBancos = this.ws.bancos.length >= 1 && this.ws.tsd.length === 0;
        const motivoOk   = ['MENOR', 'DEVOLUCION', 'INTERNO'].includes(motivo);
        const validBancoJustificado = soloBancos && motivoOk;

        if (isAjusteMenor && !justificacion) {
            justificacion = 'Aprobación Manual (Ajuste Menor)';
        }

        const isValidMatch = validTsdBanco || validTsdInterno || validBancoJustificado || isAjusteMenor;

        if (isValidMatch) {
            this.manualMatches.push({
                tsdArr: [...this.ws.tsd], bancoArr: [...this.ws.bancos],
                justificacion: justificacion, motivo: motivo
            });
        }

        this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);

        // Persistencia silenciosa inmediata.
        // Un error de borrador NO debe bloquear el algoritmo ni la conciliación.
        try {
            await this.guardarBorradorM4();
        } catch (errorBorrador) {
            console.error(
                'No se pudo guardar inmediatamente el borrador M4:',
                errorBorrador
            );
        }

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
    pedirFechaConciliacion: async function() {
        const ahora = new Date();
        const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

        const html = `
        <div class="space-y-3 text-left whitespace-normal" id="fc-m4-form">
            <p class="text-sm text-slate-600 dark:text-slate-300">
                Indique la <b>fecha contable</b> con la que se registrará esta conciliación.
            </p>
            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de conciliación *</label>
                <input type="date" id="fc-m4-fecha" value="${hoy}" max="${hoy}"
                    class="w-full p-2.5 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Se sugiere el día en curso. Puede fecharse hacia atrás si el movimiento
                corresponde a días anteriores, pero no hacia adelante.
            </p>
            <div id="fc-m4-error" class="hidden text-[11px] text-red-600 font-bold"></div>
            <button id="fc-m4-ok" class="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors">
                Confirmar y guardar
            </button>
        </div>`;

        return new Promise((resolve) => {
            window.SysUI._createModal('Fecha de la conciliación', html, [
                { text: 'Cancelar', value: false, class: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-lg font-bold transition-colors' }
            ], 'info', 'max-w-md').then(() => resolve(null));

            const btn = document.getElementById('fc-m4-ok');
            if (btn) btn.addEventListener('click', function () {
                const val = (document.getElementById('fc-m4-fecha') || {}).value || '';
                const err = document.getElementById('fc-m4-error');

                if (!val) {
                    err.innerText = 'Debe indicar una fecha.';
                    err.classList.remove('hidden');
                    return;
                }

                if (val > hoy) {
                    err.innerText = 'No se permite una fecha futura.';
                    err.classList.remove('hidden');
                    return;
                }

                const form = document.getElementById('fc-m4-form');
                const overlay = form ? form.closest('.fixed') : null;
                if (overlay) overlay.remove();
                resolve(val);
            });
        });
    },

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

        const fechaConciliacion = await this.pedirFechaConciliacion();
        if (!fechaConciliacion) return;

        // Construcción del Payload (Solo los aprobados)
        const payloadAprobados = [];
        this.currentSugData.forEach(row => {
            const arrT = Array.isArray(row._tsdRaw) ? row._tsdRaw : [row._tsdRaw];
            const arrB = Array.isArray(row._bancoRaw) ? row._bancoRaw : [row._bancoRaw];
            
            let justif = null;
            const strStatus = String(row.EstadoMatch);
            if (strStatus.startsWith('Manual|')) { justif = strStatus.split('|')[1]; }

            // ¿Este grupo salió de un motivo declarado (banco solo)? Se busca por sus IDs.
            const idsB = arrB.filter(Boolean).map(b => String(b.IdTransaccion));
            const mm = (this.manualMatches || []).find(m =>
                m.motivo && m.bancoArr.length === idsB.length &&
                m.bancoArr.every(x => idsB.includes(String(x.IdTransaccion || x._id).replace(/^b_/, '')))
            );
            const motivo = mm ? mm.motivo : null;

            const uid = () => 'aux_tsd_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 10);

            // Ojo: sólo se desglosa cuando hay filas BANCARIAS. Un ajuste menor de
            // sólo TSD lleva motivo 'MENOR' y debe seguir el camino normal de abajo.
            if (idsB.length > 0 && (motivo === 'DEVOLUCION' || motivo === 'INTERNO' || motivo === 'MENOR')) {
                const sello = motivo === 'DEVOLUCION' ? '[AUX] Devolución Datáfono (Sin TSD)'
                            : motivo === 'INTERNO'    ? '[AUX] Ajuste Interno Bancos (Sin TSD)'
                            :                           '[AUX] Ajuste Monto Menor (Sin TSD)';
                const tipoAud = motivo === 'DEVOLUCION' ? 'DEVOLUCION-DATAFONO'
                              : motivo === 'INTERNO'    ? 'AJUSTE-INTERNO-BANCOS'
                              :                           'AJUSTE-MONTO-MENOR';

                // Cada fila bancaria va SOLA, con su propio IdMatchTSD irrepetible
                arrB.filter(Boolean).forEach(b => {
                    payloadAprobados.push({
                        IdMatchTSD: uid(),
                        TipoCruce: sello,
                        Justificacion: justif,
                        TipoAjuste: tipoAud,
                        TSD: [],
                        Bancos: [b.IdTransaccion]
                    });
                });
                return;   // este grupo ya quedó desglosado
            }

            payloadAprobados.push({
                IdMatchTSD: uid(), // Matrimonio Único (Prefijo Auxiliar)
                TipoCruce: '[AUX] ' + strStatus.split('|')[0], // Sellado de Auditoría M4
                Justificacion: justif,
                TSD: arrT.filter(Boolean).map(t => t.ID_Transaccion),
                Bancos: arrB.filter(Boolean).map(b => b.IdTransaccion) 
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
                body: JSON.stringify({ aprobados: payloadAprobados, fechaConciliacion: fechaConciliacion })
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.error);

            await window.SysUI.alert("Las conciliaciones han sido aprobadas y guardadas exitosamente en el historial contable.", "Operación Exitosa", "success");
            
            // Recargar desde BD. Los registros recién conciliados dejarán de
            // venir como pendientes y el borrador se compactará automáticamente.
            await this.fetchPendientes();

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

            // Bloque desplegable con TODOS los campos que devuelve el endpoint.
            // Se genera solo: cualquier columna nueva del SELECT aparece sin tocar el JS.
            // Hoja de datos: rejilla de columnas con línea guía punteada.
            // Sin esto, en una tarjeta de 1600px la etiqueta y el valor quedan en
            // extremos opuestos y el ojo pierde el renglón.
            if (!document.getElementById('forense-hoja-css')) {
                const stH = document.createElement('style');
                stH.id = 'forense-hoja-css';
                stH.textContent = `
                .hoja-datos { display:grid; grid-template-columns:1fr; column-gap:2.5rem; }
                @media (min-width:1024px){ .hoja-datos{ grid-template-columns:repeat(2,1fr); } }
                @media (min-width:1500px){ .hoja-datos{ grid-template-columns:repeat(3,1fr); } }
                .hoja-datos > div {
                    display:flex; align-items:baseline; gap:.5rem;
                    padding:.45rem 0; border-bottom:1px dotted rgba(100,116,139,.28);
                }
                .hoja-datos > div > span:first-child { flex:none; }
                .hoja-datos > div > *:last-child { margin-left:auto; text-align:right; }
                .dark .hoja-datos > div { border-bottom-color:rgba(148,163,184,.22); }
                `;
                document.head.appendChild(stH);
            }

            // Ícono de copiar (mismo del Módulo 1: aparece al pasar el cursor)
            const icoCopy = '<svg class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';

            // CHIP copiable (para las cabeceras con etiqueta)
            const copiable = (etiqueta, valor, clase) => {
                const v = (valor === null || valor === undefined || valor === '') ? '' : String(valor).trim();
                if (!v) return `<span class="bg-slate-100 dark:bg-slate-900 text-slate-400 px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200 dark:border-slate-700">${etiqueta}: -</span>`;
                return `<span onclick="window.AuxiliarLogic.copiarForense('${v.replace(/'/g, "\\'")}', this)" title="Clic para copiar"
                    class="${clase || 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300'} px-3 py-1.5 rounded-md text-sm font-mono border border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all select-none flex items-center gap-1 group">
                    ${etiqueta}: <b class="text-slate-800 dark:text-white">${v}</b>${icoCopy}</span>`;
            };

            // VALOR copiable (para las filas del desglose, sin fondo)
            const cop = (valor, clase) => {
                const v = (valor === null || valor === undefined || valor === '') ? '' : String(valor).trim();
                if (!v) return '<span class="text-slate-400">-</span>';
                return `<span onclick="window.AuxiliarLogic.copiarForense('${v.replace(/'/g, "\\'")}', this)" title="Clic para copiar"
                    class="${clase || 'font-mono'} cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1 group"> 
                    ${v}${icoCopy}</span>`;
            };

            let _detId = 0;
            const bloqueCompleto = (obj, color) => {
                const omitir = ['EvidenciaB64'];
                const campos = Object.keys(obj || {})
                    .filter(k => !omitir.includes(k))
                    .filter(k => obj[k] !== null && obj[k] !== '' && String(obj[k]).trim() !== '')
                    .map(k => {
                        const etiqueta = k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
                        return `<div class="flex justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                                    <span class="text-[10px] uppercase text-slate-400 shrink-0">${etiqueta}</span>
                                    <span class="text-[11px] font-mono text-slate-700 dark:text-slate-200 text-right break-all">${obj[k]}</span>
                                </div>`;
                    }).join('');
                if (!campos) return '';
                const id = 'forense-full-' + (++_detId);
                return `<div class="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <button onclick="const e=document.getElementById('${id}');e.classList.toggle('hidden');this.querySelector('span').innerText=e.classList.contains('hidden')?'▾':'▴';"
                        class="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-wider ${color} hover:opacity-80 transition-opacity">
                        Ver todos los datos <span>▾</span>
                    </button>
                    <div id="${id}" class="hidden mt-2 max-h-52 overflow-y-auto pr-1">${campos}</div>
                </div>`;
            };

            // 1. ORIGEN: TSD (Izquierda)
            const htmlTSD = data.tsd.map(t => {
                const monto = parseFloat(t.MontoCRC) || parseFloat(t.MontoBruto) || 0;
                return `
                <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md transition-shadow group">
                    <div class="absolute top-0 left-0 w-1 h-full bg-purple-500 rounded-l-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">Contrato TSD</p>
                            <h4 class="font-black text-slate-800 dark:text-white text-lg cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors inline-flex items-center gap-1.5 group" onclick="window.AuxiliarLogic.copiarForense('${(t.Contrato||'').replace(/'/g, "\\'")}', this)" title="Clic para copiar el contrato">${t.Contrato || 'S/D'}${icoCopy}</h4>
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
                        <div class="hoja-datos">
                        <div class="flex justify-between"><span class="font-medium">Recibo/Detalle:</span> ${cop(t.Recibo_Detalle, 'font-bold text-orange-600')}</div>
                        <div class="flex justify-between"><span class="font-medium">Fecha Pago:</span> ${cop(t.FechaPago)}</div>
                        <div class="flex justify-between"><span class="font-medium">Fecha Transacción:</span> ${cop(t.FechaTransaccion)}</div>
                        <div class="flex justify-between"><span class="font-medium">Autorización:</span> ${cop(t.Autorizacion)}</div>
                        <div class="flex justify-between"><span class="font-medium">Tarjeta:</span> ${cop(t.Tarjeta_Ultimos4)}</div>
                        <div class="flex justify-between"><span class="font-medium">Agente:</span> <span class="truncate max-w-[150px]" title="${t.RecibidoPor}">${t.RecibidoPor || '-'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Sucursal:</span> <span>${t.SucursalNombre || '-'} (${t.SucursalCod || '-'})</span></div>
                        <div class="flex justify-between"><span class="font-medium">Tipo Tarjeta:</span> <span class="font-bold">${t.TipoTarjeta || '-'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">ICD:</span> <span class="font-mono">${t.ICD || '-'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Centro de Costo:</span> <span class="font-mono font-bold text-purple-600 dark:text-purple-400">${t.CentroCosto || '-'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Monto CRC:</span> <span class="font-mono">${fmt(t.MontoCRC)}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Folio Cierre:</span> <span class="font-mono text-[11px]">${t.IdCierre || '-'}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Id Transacción:</span> <span class="font-mono text-[10px] break-all">${t.IdTransaccion || '-'}</span></div>
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
                        ${copiable('Auth', d.Autorizacion)}
                        ${copiable('Tarj', d.Tarjeta ? d.Tarjeta.slice(-4) : '')}
                        ${copiable(isBac ? 'Afiliado' : 'MerID', isBac ? d.NUMERO_AFILIADO : d.MerID)}
                        ${copiable('Terminal', isBac ? d.BacTerm : d.ScoTerm)}
                    </div>

                    <div class="mt-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400 space-y-3 border border-slate-100 dark:border-slate-700/50">
                        <p class="text-xs font-bold text-slate-500 uppercase mb-2">Desglose Financiero</p>
                        <div class="hoja-datos">
                        <div class="flex justify-between"><span class="font-medium">Monto Bruto:</span> <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${fmt(monto)}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Comisión Banco:</span> <span class="font-mono text-red-500">${fmt(com)}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Retención Ventas/IVA:</span> <span class="font-mono text-red-500">${fmt(rVenta)}</span></div>
                        <div class="flex justify-between"><span class="font-medium">Retención Renta/ISR:</span> <span class="font-mono text-red-500">${fmt(rRenta)}</span></div>
                        </div>
                        <div class="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <span class="font-bold text-green-600 dark:text-green-500">Monto Neto a Depositar:</span>
                            <span class="font-mono font-black text-lg text-green-600 dark:text-green-500">${fmt(neto)}</span>
                        </div>
                        <div class="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                            <p class="text-xs font-bold text-slate-500 uppercase mb-2">Fechas del Banco</p>
                            <div class="hoja-datos">
                            ${isBac ? `
                            <div class="flex justify-between"><span class="font-medium">Fecha Transacción:</span> ${copiable('', d.BacFechaTrx, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">Cierre Datáfono:</span> ${copiable('', d.BacFechaCierreDat, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">Fecha de Pago:</span> ${copiable('', d.BacFechaPago, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">N° Liquidación:</span> ${copiable('', d.BacLiquidacion, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">Tipo Tarjeta:</span> <span class="font-bold">${d.BacTipoTarjeta || '-'}</span></div>
                            <div class="flex justify-between"><span class="font-medium">ACI:</span> <span class="font-mono text-red-500">${fmt(d.AJUSTE_COMISION_INTERNACIONAL)}</span></div>
                            <div class="flex justify-between"><span class="font-medium">Centro de Costo:</span> <span class="font-mono font-bold text-blue-600 dark:text-blue-400">${d.BacCentroCosto || '-'}</span></div>
                            ` : `
                            <div class="flex justify-between"><span class="font-medium">Fecha de Pago:</span> ${copiable('', d.ScoFechaPago, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">Fecha Lote/Ajuste:</span> ${copiable('', d.ScoFechaLote, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">N° Lote/Ajuste:</span> ${copiable('', d.ScoNumLote, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">N° Pago (PCA):</span> ${copiable('', d.ScoNumPago, 'bg-transparent border-0 !px-0 !py-0 text-xs')}</div>
                            <div class="flex justify-between"><span class="font-medium">Moneda:</span> <span class="font-bold">${d.ScoMoneda || '-'}</span></div>
                            <div class="flex justify-between"><span class="font-medium">Transacción:</span> <span>${d.ScoTransaccion || '-'}</span></div>
                            <div class="flex justify-between"><span class="font-medium">Estatus:</span> <span>${d.ScoEstatus || '-'}</span></div>
                            <div class="flex justify-between"><span class="font-medium">% Comisión:</span> <span class="font-mono">${d.ScoPorcCom || 0}</span></div>
                            <div class="flex justify-between"><span class="font-medium">Centro de Costo:</span> <span class="font-mono font-bold text-blue-600 dark:text-blue-400">${d.ScoCentroCosto || '-'}</span></div>
                            ${d.ScoMontoDolar ? `<div class="flex justify-between bg-violet-50 dark:bg-violet-900/20 -mx-2 px-2 py-1 rounded"><span class="font-bold text-violet-700 dark:text-violet-300">🔗 Link de pago (USD):</span> <span class="font-mono font-bold text-violet-700 dark:text-violet-300">$${d.ScoMontoDolar}</span></div>` : ''}
                            `}
                            </div>
                            <div class="flex justify-between pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                                <span>Folio: ${d.IdCierre || '-'}</span>
                                <span>Días: ${d.DiasAntiguedad ?? '-'}</span>
                            </div>
                        </div>
                        ${d.EvidenciaB64 ? `
                        <div class="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
                            <p class="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                Evidencia del Ajuste
                            </p>
                            <div class="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white">
                                <img src="${d.EvidenciaB64.startsWith('data:') ? d.EvidenciaB64 : 'data:image/png;base64,' + d.EvidenciaB64}"
                                     alt="Evidencia del ajuste"
                                     class="w-full h-auto block"
                                     style="image-rendering:-webkit-optimize-contrast;">
                            </div>
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

            // ============================================================
            // RESUMEN DEL FLUJO: totales y cantidad de registros por etapa
            // ============================================================
            const num = (v) => parseFloat(v) || 0;
            const totTSD = data.tsd.reduce((a, t) => a + num(t.MontoCRC || t.MontoBruto), 0);
            const totBrutoBanco = data.detallado.reduce((a, d) => a + num(d.Banco === 'BAC' ? d.BacMonto : d.ScoMonto), 0);
            const totNetoBanco  = data.detallado.reduce((a, d) => a + num(d.Banco === 'BAC' ? d.BacNeto  : d.ScoNeto),  0);
            const totDeposito   = data.pagado.reduce((a, p) => a + num(p.Banco === 'BAC' ? p.BacCred : p.ScoMonto), 0);
            const difConcilia   = totTSD - totNetoBanco;

            const etapa = (n, titulo, monto, sub, registros, color) => `
                <div onclick="window.AuxiliarLogic.irAEtapa(${n})" title="Clic para ver el detalle de esta etapa"
                     class="flex-1 min-w-[220px] bg-white dark:bg-slate-800 rounded-2xl p-5 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-400 hover:-translate-y-0.5 transition-all">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="w-7 h-7 rounded-full ${color} text-white text-sm font-black flex items-center justify-center shrink-0">${n}</span>
                        <span class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">${titulo}</span>
                    </div>
                    <div class="text-3xl font-black text-slate-800 dark:text-white font-mono tracking-tight">${fmt(monto)}</div>
                    <div class="text-sm text-slate-500 dark:text-slate-400 mt-1">${sub}</div>
                    <div class="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-lg">
                        ${registros} ${registros === 1 ? 'registro' : 'registros'}
                    </div>
                </div>`;

            const flecha = `<div class="hidden xl:flex items-center text-slate-300 dark:text-slate-600 shrink-0">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                </div>`;

            const cintaFlujo = `
                <div class="flex flex-wrap xl:flex-nowrap items-stretch gap-4 mb-6">
                    ${etapa(1, 'Origen Interno (TSD)', totTSD, 'Monto facturado en el core', data.tsd.length, 'bg-purple-500')}
                    ${flecha}
                    ${etapa(2, 'Procesamiento Banco', totNetoBanco, 'Neto a depositar · bruto ' + fmt(totBrutoBanco), data.detallado.length, 'bg-blue-500')}
                    ${flecha}
                    ${etapa(3, 'Aterrizaje en Cuenta', totDeposito, 'Abonos reales del extracto', data.pagado.length, 'bg-emerald-500')}
                    <div class="flex-1 min-w-[220px] rounded-2xl p-5 ring-1 shadow-sm ${Math.abs(difConcilia) < 2000 ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-300 dark:ring-emerald-700' : 'bg-red-50 dark:bg-red-900/20 ring-red-300 dark:ring-red-700'}">
                        <div class="text-sm font-bold uppercase tracking-wide mb-3 ${Math.abs(difConcilia) < 2000 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}">
                            ${Math.abs(difConcilia) < 2000 ? '✓ Diferencia' : '⚠ Diferencia'}
                        </div>
                        <div class="text-3xl font-black font-mono tracking-tight ${Math.abs(difConcilia) < 2000 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}">${fmt(difConcilia)}</div>
                        <div class="text-sm mt-1 ${Math.abs(difConcilia) < 2000 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-600 dark:text-red-500'}">TSD contra neto bancario</div>
                    </div>
                </div>`;

            // ============================================================
            // SECCIONES: si hay 1 registro se muestra directo; si hay varios,
            // se agrupa en un acordeón abierto por defecto.
            // ============================================================
            let _secId = 0;
            const seccion = (titulo, tarjetas, cantidad, colorTexto, colorBarra) => {
                if (cantidad === 0) return `
                    <div class="mb-6">
                        <h3 class="text-base font-black ${colorTexto} uppercase tracking-wide mb-3">${titulo}</h3>
                        <div class="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center ring-1 ring-dashed ring-slate-300 dark:ring-slate-600">
                            <span class="text-base font-bold text-slate-400">Sin registros en esta etapa</span>
                        </div>
                    </div>`;

                const cuerpo = `<div class="grid grid-cols-1 ${cantidad > 1 ? 'xl:grid-cols-2' : ''} gap-4">${tarjetas}</div>`;

                if (cantidad === 1) return `
                    <div class="mb-6">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="w-1.5 h-6 rounded-full ${colorBarra}"></span>
                            <h3 class="text-base font-black ${colorTexto} uppercase tracking-wide">${titulo}</h3>
                        </div>
                        ${cuerpo}
                    </div>`;

                const id = 'forense-sec-' + (++_secId);
                return `
                    <div class="mb-6">
                        <button onclick="const e=document.getElementById('${id}');e.classList.toggle('hidden');this.querySelector('.chev').innerText=e.classList.contains('hidden')?'▾':'▴';"
                            class="w-full flex items-center gap-2 mb-3 group">
                            <span class="w-1.5 h-6 rounded-full ${colorBarra}"></span>
                            <h3 class="text-base font-black ${colorTexto} uppercase tracking-wide">${titulo}</h3>
                            <span class="text-sm font-bold text-slate-500 bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 rounded-full">${cantidad}</span>
                            <span class="chev ml-auto text-lg ${colorTexto} group-hover:opacity-70">▴</span>
                        </button>
                        <div id="${id}">${cuerpo}</div>
                    </div>`;
            };

            // ============================================================
            // MODAL
            // ============================================================
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[99999] flex justify-center items-center p-3 lg:p-6 animate-fade-in-up';
            modal.innerHTML = `
                <div class="bg-slate-100 dark:bg-slate-900 w-full max-w-[1700px] h-[93vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-white/10">

                    <!-- CABECERA -->
                    <div class="bg-white dark:bg-slate-800 px-8 py-5 flex justify-between items-center shrink-0 z-10 shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
                            </div>
                            <div>
                                <h2 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Trazabilidad de la Transacción</h2>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-lg text-sm font-mono font-bold">Folio: ${row.Folio}</span>
                                    <span class="text-slate-500 text-sm font-medium">${row.FechaFolio}</span>
                                </div>
                            </div>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 transition-colors flex items-center justify-center text-xl font-bold shrink-0">✕</button>
                    </div>

                    <!-- CUERPO -->
                    <div class="flex-1 overflow-y-auto px-8 py-6">
                        ${cintaFlujo}
                        <div id="forense-etapa-1" class="scroll-mt-4">${seccion('1 · Origen Interno (TSD)', htmlTSD, data.tsd.length, 'text-purple-600 dark:text-purple-400', 'bg-purple-500')}</div>
                        <div id="forense-etapa-2" class="scroll-mt-4">${seccion('2 · Procesamiento Adquirente (Banco)', htmlDetallado, data.detallado.length, 'text-blue-600 dark:text-blue-400', 'bg-blue-500')}</div>
                        <div id="forense-etapa-3" class="scroll-mt-4">${seccion('3 · Aterrizaje en Cuenta (Depósitos)', htmlPagado, data.pagado.length, 'text-emerald-600 dark:text-emerald-400', 'bg-emerald-500')}</div>
                    </div>

                    <!-- PIE -->
                    <div class="bg-white dark:bg-slate-800 px-8 py-4 flex flex-wrap justify-between items-center gap-3 shrink-0 border-t border-slate-200 dark:border-slate-700">
                        <div class="flex items-center gap-3">
                            <span class="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex items-center justify-center font-bold">✓</span>
                            <span class="text-base font-black text-slate-700 dark:text-slate-200 uppercase tracking-wide">Resolución: ${row.TipoCruce.tipo || 'Manual'}</span>
                        </div>
                        <div class="text-sm text-slate-500 italic max-w-2xl truncate" title="${row.TipoCruce.justificacion || ''}">
                            ${row.TipoCruce.justificacion ? '"' + row.TipoCruce.justificacion + '"' : 'Sin justificación registrada'}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);

        } catch (error) {
            window.SysUI.alert("Error al cargar la trazabilidad: " + error.message, "Fallo", "error");
        } finally {
            document.body.classList.remove('cursor-wait');
        }
    },

    // =====================================================================
    // AJUSTE MANUAL M4  —  alta de movimientos bancarios sin conciliar
    // Reglas: Contracargo/Devolución -> Davibank | Mantenimiento -> BAC
    //         El banco siempre se puede cambiar a mano.
    //         Comisiones y retenciones se digitan manualmente, sin cálculo automático.
    // =====================================================================
    _ajusteSucursales: [],
    _ajustesRecientes: [],   // solo en memoria: flotan arriba hasta recargar

    // ¿Es un ajuste manual creado en el Auxiliar y todavía sin pareja de TSD?
    _esAjusteBorrable: function(row) {
        if (!row) return false;
        // Lo aprobado en pantalla ya salió de la bandeja: no se borra desde aquí.
        if (String(row.EstadoMatch || '').startsWith('Manual')) return false;
        const raw = Array.isArray(row._bancoRaw) ? row._bancoRaw : (row._bancoRaw ? [row._bancoRaw] : []);
        // Sólo filas con UN movimiento bancario (no grupos de varios depósitos).
        if (raw.length !== 1) return false;
        const b = raw[0] || {};
        // Detección tolerante: sirve la bandera calculada O el ArchivoOrigen crudo,
        // así el botón funciona aunque el servidor tenga una versión previa del SQL.
        if (Number(b.EsAjusteManual) === 1) return true;
        if (Number(b.EsAjusteM4) === 1) return true;
        return String(b.ArchivoOrigen || '').indexOf('AJUSTE-M4') === 0;
        // Nota: no exigimos ausencia de sugerencia de TSD. Una sugerencia NO es una
        // conciliación; el servidor revalida IdMatchTSD IS NULL antes de borrar.
    },

    // Botón discreto de edición. Reemplaza al de borrado: el eliminar vive
    // dentro del modal, para tener un solo control por fila.
    // Copiado al portapapeles con el mismo feedback visual del Módulo 1.
    // Es un MÉTODO del objeto (no una global dentro de un template), porque el
    // Timeline se inyecta en la página principal y sus onclick corren aquí.
    // Baja suavemente a la etapa elegida desde la cinta de resumen del Timeline
    irAEtapa: function(n) {
        const destino = document.getElementById('forense-etapa-' + n);
        if (!destino) return;
        destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Realce breve para que el ojo encuentre dónde aterrizó
        destino.style.transition = 'box-shadow .3s';
        destino.style.boxShadow = '0 0 0 3px rgba(59,130,246,.45)';
        destino.style.borderRadius = '1rem';
        setTimeout(function() { destino.style.boxShadow = ''; }, 1400);
    },

    copiarForense: function(valor, element) {
        var exito = function() {
            var originalHtml = element.innerHTML;
            element.innerHTML = '<span class="text-green-500 dark:text-green-400 flex items-center gap-1">&#9989; Copiado</span>';
            setTimeout(function() { element.innerHTML = originalHtml; }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(valor).then(exito).catch(function(err) { console.error('Error al copiar:', err); });
        } else {
            // Respaldo: navigator.clipboard sólo existe en HTTPS o localhost
            var ta = document.createElement('textarea');
            ta.value = valor; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); exito(); } catch (e) { console.error('Error al copiar:', e); }
            document.body.removeChild(ta);
        }
    },

    _btnEditarHtml: function(id) {
        return `<button onclick="event.stopPropagation(); window.AuxiliarLogic.abrirEdicionAjuste('${id}')"
                    title="Editar autorización o tarjeta / eliminar este ajuste manual"
                    class="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700 dark:hover:bg-indigo-900/60">
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Editar
                </button>`;
    },

    abrirEdicionAjuste: async function(id) {
        const fila = (this.currentLimboData || []).find(r => String(r._dbId) === String(id));
        const raw = fila && (Array.isArray(fila._bancoRaw) ? fila._bancoRaw[0] : fila._bancoRaw);
        const authAct = raw ? (raw.Numero_Autorizacion || '') : '';
        const tarjAct = raw ? (raw.Tarjeta_Ultimos4 || '') : '';

        const html = `
        <div class="space-y-3 text-left whitespace-normal" id="edit-adj-form">
            <div class="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded p-2">
                Ajuste <b class="font-mono">${id}</b><br>
                Sólo se pueden modificar la autorización y los últimos 4 de la tarjeta.
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Autorización</label>
                    <input id="edit-adj-auth" value="${authAct}" placeholder="000000"
                        class="w-full p-2 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tarjeta: últimos 4</label>
                    <input id="edit-adj-tarjeta" maxlength="4" value="${tarjAct}" placeholder="4471"
                        class="w-full p-2 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400">
                </div>
            </div>
            <div id="edit-adj-error" class="hidden text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 whitespace-pre-line"></div>

            <button id="edit-adj-save" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-bold shadow-md transition-colors">
                Guardar cambios
            </button>
            <button id="edit-adj-del" class="w-full text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 py-1.5 rounded-lg transition-colors">
                Eliminar este ajuste
            </button>
        </div>`;

        window.SysUI._createModal('Editar Ajuste Manual', html, [
            { text: 'Cancelar', value: false, class: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-lg font-bold transition-colors' }
        ], 'info', 'max-w-lg');

        document.getElementById('edit-adj-save').addEventListener('click', () => this.guardarEdicionAjuste(id));
        document.getElementById('edit-adj-del').addEventListener('click', () => this.eliminarAjusteManual(id));
        const f = document.getElementById('edit-adj-auth'); if (f) f.focus();
    },

    guardarEdicionAjuste: async function(id) {
        const g = (x) => document.getElementById(x);
        const errBox = g('edit-adj-error');
        const btn = g('edit-adj-save');
        const auth = ((g('edit-adj-auth') || {}).value || '').trim();
        const tarjeta = ((g('edit-adj-tarjeta') || {}).value || '').trim();

        if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; btn.classList.add('opacity-60'); }
        try {
            const res = await fetch('api/save_ajuste_m4.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', id, autorizacion: auth, tarjeta })
            });
            const data = await res.json();
            if (!data.success) {
                if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; btn.classList.remove('opacity-60'); }
                if (errBox) { errBox.innerText = data.error || 'No se pudo guardar.'; errBox.classList.remove('hidden'); }
                return;
            }

            const form = document.getElementById('edit-adj-form');
            const overlay = form ? form.closest('.fixed') : null;
            if (overlay) overlay.remove();

            // Si con el dato nuevo el algoritmo le encuentra pareja, se avisa UNA vez
            this._avisarSiCruza = String(id);
            await this.fetchPendientes();

        } catch (e) {
            if (btn) { btn.disabled = false; btn.innerHTML = 'Guardar cambios'; btn.classList.remove('opacity-60'); }
            if (errBox) { errBox.innerText = 'Error de conexión: ' + e.message; errBox.classList.remove('hidden'); }
        }
    },

    eliminarAjusteManual: async function(idTransaccion) {
        // Ya no hay botón de dos pasos: la confirmación se pide aquí.
        const ok = await window.SysUI.confirm(
            `Se eliminará definitivamente el ajuste <b>${idTransaccion}</b> junto con su detalle bancario, su folio y su respaldo de auditoría.\n\nEsta acción no se puede deshacer. ¿Continuar?`,
            "Eliminar ajuste manual", "warning"
        );
        if (!ok) return;

        // Cerrar el modal de edición si el borrado se pidió desde ahí
        const formEdit = document.getElementById('edit-adj-form');
        const ovEdit = formEdit ? formEdit.closest('.fixed') : null;
        if (ovEdit) ovEdit.remove();

        try {
            const res = await fetch('api/save_ajuste_m4.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: idTransaccion })
            });
            const data = await res.json();
            if (!data.success) {
                window.SysUI.alert(data.error || 'No se pudo eliminar el ajuste.', 'Fallo', 'error');
                return;
            }
            this._ajustesRecientes = (this._ajustesRecientes || []).filter(x => x !== String(idTransaccion));
            await this.fetchPendientes();
        } catch (e) {
            window.SysUI.alert('Error de conexión: ' + e.message, 'Fallo', 'error');
        }
    },

    abrirRegistroSoftland: function() {
        const ahora = new Date();
        const hoy =
            ahora.getFullYear() + '-' +
            String(ahora.getMonth() + 1).padStart(2, '0') + '-' +
            String(ahora.getDate()).padStart(2, '0');

        const html = `
        <div class="space-y-4 text-left whitespace-normal" id="softland-contable-form">

            <div class="text-[11px] text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                Registre el monto informado por la contabilidad de Softland para la fecha correspondiente.
                Este registro es independiente de las conciliaciones bancarias.
            </div>

            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Monto de contabilidad Softland *
                </label>
                <input id="softland-contable-monto"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    class="w-full p-2.5 text-sm font-mono font-bold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Fecha del monto *
                </label>
                <input id="softland-contable-fecha"
                    type="date"
                    value="${hoy}"
                    max="${hoy}"
                    class="w-full p-2.5 text-sm font-bold border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Referencia Softland *
                </label>
                <input id="softland-contable-referencia"
                    type="text"
                    maxlength="100"
                    placeholder="Número o referencia del registro en Softland"
                    class="w-full p-2.5 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
            </div>

            <div id="softland-contable-error"
                class="hidden text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
            </div>

            <button id="softland-contable-save"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors">
                Guardar registro Softland
            </button>
        </div>`;

        window.SysUI._createModal(
            'Contabilidad Softland',
            html,
            [
                {
                    text: 'Cancelar',
                    value: false,
                    class: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-lg font-bold transition-colors'
                }
            ],
            'info',
            'max-w-lg'
        );

        setTimeout(() => {
            const btn = document.getElementById('softland-contable-save');
            if (btn) {
                btn.addEventListener('click', () => this.guardarRegistroSoftland());
            }
        }, 0);
    },

    guardarRegistroSoftland: async function() {
        const montoInput = document.getElementById('softland-contable-monto');
        const fechaInput = document.getElementById('softland-contable-fecha');
        const referenciaInput = document.getElementById('softland-contable-referencia');
        const errorBox = document.getElementById('softland-contable-error');
        const btn = document.getElementById('softland-contable-save');

        if (!montoInput || !fechaInput || !referenciaInput) return;

        const montoRaw = montoInput.value.trim();
        const monto = Number(montoRaw);
        const fecha = fechaInput.value;
        const referencia = referenciaInput.value.trim();

        const ahora = new Date();
        const hoy =
            ahora.getFullYear() + '-' +
            String(ahora.getMonth() + 1).padStart(2, '0') + '-' +
            String(ahora.getDate()).padStart(2, '0');

        const mostrarError = (mensaje) => {
            if (!errorBox) return;
            errorBox.innerText = mensaje;
            errorBox.classList.remove('hidden');
        };

        if (errorBox) errorBox.classList.add('hidden');

        if (montoRaw === '' || !Number.isFinite(monto)) {
            return mostrarError('Debe indicar un monto válido.');
        }

        if (!fecha) {
            return mostrarError('Debe indicar la fecha correspondiente al monto.');
        }

        if (fecha > hoy) {
            return mostrarError('La fecha no puede estar en el futuro.');
        }

        if (!referencia) {
            return mostrarError('Debe indicar la referencia de Softland.');
        }

        if (btn) {
            btn.disabled = true;
            btn.innerText = 'Guardando...';
            btn.classList.add('opacity-60');
        }

        try {
            const res = await fetch('api/save_softland_contable_m4.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monto: monto,
                    fecha: fecha,
                    referencia: referencia
                })
            });

            const data = await res.json();

            if (!data.success) {
                mostrarError(data.error || 'No se pudo guardar el registro.');

                if (btn) {
                    btn.disabled = false;
                    btn.innerText = 'Guardar registro Softland';
                    btn.classList.remove('opacity-60');
                }

                return;
            }

            const form = document.getElementById('softland-contable-form');
            const overlay = form ? form.closest('.fixed') : null;
            if (overlay) overlay.remove();

            await window.SysUI.alert(
                `Registro Softland #${data.id} guardado correctamente.`,
                'Registro guardado',
                'success'
            );

        } catch (e) {
            mostrarError('Error de conexión: ' + e.message);

            if (btn) {
                btn.disabled = false;
                btn.innerText = 'Guardar registro Softland';
                btn.classList.remove('opacity-60');
            }
        }
    },

    abrirAjusteManual: async function() {
        this._ajusteCatManual = false;   // cada apertura vuelve a sugerir categoría
        const tags = this.customTags || [];
        const opsCat = tags.map(t => `<option value="${t.IdEtiqueta}">${t.Nombre}</option>`).join('');

        const html = `
        <div class="space-y-3 text-left whitespace-normal" id="adj-form">
            <!-- FILA 1: QUÉ Y DÓNDE -->
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de ajuste *</label>
                    <select id="adj-tipo" class="w-full p-2 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="Contracargo">Contracargo</option>
                        <option value="Devolución">Devolución</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Banco *</label>
                    <select id="adj-banco" class="w-full p-2 text-xs font-bold border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="DAVIBANK">Davibank</option>
                        <option value="BAC">BAC Credomatic</option>
                    </select>
                </div>
            </div>

            <!-- FILA 2: SUCURSAL (autocompleta afiliado/terminal/CC) -->
            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sucursal <span class="text-slate-400 normal-case font-normal">(opcional)</span></label>
                <div class="relative">
                    <input id="adj-sucursal" autocomplete="off" placeholder="Opcional — se puede completar después"
                        class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-400">
                    <div id="adj-suc-lista" class="hidden absolute z-[20] left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl text-xs"></div>
                </div>
                <div id="adj-sucursal-info" class="mt-1 text-[10px] text-slate-500 dark:text-slate-400 min-h-[14px]"></div>
            </div>

            <!-- FILA 3: FECHAS -->
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha del ajuste *</label>
                    <input type="date" id="adj-fecha" class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de pago *</label>
                    <input type="date" id="adj-fpago" class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                </div>
            </div>

            <!-- FILA 4: IDENTIFICADORES -->
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Autorización *</label>
                    <input id="adj-auth" placeholder="000000" class="w-full p-2 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tarjeta: últimos 4 dígitos *</label>
                    <input id="adj-tarjeta" maxlength="4" placeholder="4471" class="w-full p-2 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Asiento Softland *</label>
                    <input id="adj-softland" placeholder="AS-2026-04512" class="w-full p-2 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                </div>
            </div>

            <!-- FILA 5: MONTOS (cambia según banco) -->
            <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-900/40">
                <div class="grid grid-cols-2 gap-3 items-end">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto del ajuste *</label>
                        <input type="number" step="0.01" id="adj-neto" placeholder="0.00"
                            class="w-full p-2 text-sm font-bold font-mono border-2 border-orange-400 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                        <div class="text-[9px] text-slate-400 mt-0.5">Use signo negativo si resta.</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[10px] font-bold text-slate-500 uppercase">Total con cargos</div>
                        <div id="adj-bruto" class="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">₡0,00</div>
                    </div>
                </div>
                <div id="adj-montos-banco" class="grid grid-cols-4 gap-2 mt-3"></div>
            </div>

            <!-- FILA 6: CORTESÍA -> ya cae categorizado en el auxiliar -->
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Categoría del auxiliar</label>
                    <select id="adj-categoria" class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                        <option value="">Sin categoría (aparecerá arriba)</option>
                        ${opsCat}
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nota</label>
                    <input id="adj-nota" placeholder="Opcional" class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
                </div>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Motivo</label>
                <input id="adj-motivo" placeholder="Se guarda junto al asiento de Softland" class="w-full p-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none">
            </div>

            <div id="adj-error" class="hidden text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2 whitespace-pre-line"></div>

            <button id="adj-save-btn" class="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                Guardar ajuste
            </button>
        </div>`;

        window.SysUI._createModal('Nuevo Ajuste Manual', html, [
            { text: 'Cancelar', value: false, class: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-lg font-bold transition-colors' }
        ], 'info', 'max-w-3xl');

        // Valores por defecto cómodos: hoy en ambas fechas
        const hoy = new Date().toISOString().slice(0, 10);
        const fE = document.getElementById('adj-fecha'); if (fE) fE.value = hoy;
        const fP = document.getElementById('adj-fpago'); if (fP) fP.value = hoy;

        // Enganches
        document.getElementById('adj-tipo').addEventListener('change', (e) => this._ajusteTipoCambio(e.target.value));
        document.getElementById('adj-banco').addEventListener('change', () => { this._ajusteCargarSucursales(); this._ajustePintarMontos(); });
        const inpSucursal = document.getElementById('adj-sucursal');
        inpSucursal.addEventListener('input', () => this._ajusteBuscarSucursal());
        inpSucursal.addEventListener('focus', () => this._ajusteBuscarSucursal());
        inpSucursal.addEventListener('keydown', (e) => this._ajusteTeclaSucursal(e));
        inpSucursal.addEventListener('blur', () => {
            setTimeout(() => {
                const box = document.getElementById('adj-suc-lista');
                if (box) box.classList.add('hidden');
            }, 150);
        });
        document.getElementById('adj-neto').addEventListener('input', () => this._ajusteTotal());
        document.getElementById('adj-categoria').addEventListener('change', () => { this._ajusteCatManual = true; });
        document.getElementById('adj-save-btn').addEventListener('click', () => this.guardarAjusteManual());

        this._ajusteTipoCambio('Contracargo');   // arranca con la regla del tipo por defecto
        await this._ajusteCargarSucursales();
        const inpSuc = document.getElementById('adj-sucursal');
        if (inpSuc) inpSuc.focus();
    },

    // El tipo manda el banco (editable) y define si hay cálculo o no
    _ajusteTipoCambio: function(tipo) {
        const selBanco = document.getElementById('adj-banco');
        if (!selBanco) return;
        if (tipo === 'Contracargo' || tipo === 'Devolución') selBanco.value = 'DAVIBANK';
        else if (tipo === 'Mantenimiento') selBanco.value = 'BAC';
        this._ajusteAutoCategoria(tipo);
        this._ajusteCargarSucursales();
        this._ajustePintarMontos();
    },

    // Cortesía: si existe una categoría con nombre parecido al tipo, se elige sola.
    // Si el usuario ya escogió una a mano, se respeta su decisión.
    _ajusteAutoCategoria: function(tipo) {
        const sel = document.getElementById('adj-categoria');
        if (!sel || this._ajusteCatManual) return;

        const norm = (v) => String(v || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z]/g, '')
            .replace(/(es|s)$/, '');   // singular/plural: "Contracargos" == "Contracargo"

        const raiz = norm(tipo);
        if (!raiz) { sel.value = ''; return; }

        const match = (this.customTags || []).find(t => {
            const n = norm(t.Nombre);
            if (!n) return false;
            if (n === raiz) return true;
            return n.length >= 5 && raiz.length >= 5 && (n.includes(raiz) || raiz.includes(n));
        });

        sel.value = match ? String(match.IdEtiqueta) : '';
    },

    _ajusteCargarSucursales: async function() {
        const banco = (document.getElementById('adj-banco') || {}).value || 'DAVIBANK';
        try {
            const res = await fetch('api/get_sucursales_m4.php?banco=' + encodeURIComponent(banco));
            const json = await res.json();
            this._ajusteSucursales = (json && json.success) ? (json.data || []) : [];
        } catch (e) { this._ajusteSucursales = []; }

        this._ajusteSucIdx = -1;
        this._ajusteSucursalElegida();
    },

    // Normaliza para buscar sin importar tildes ni mayúsculas
    _ajusteNorm: function(v) {
        return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    // Búsqueda EN VIVO: filtra por cualquier parte del nombre mientras se escribe
    _ajusteBuscarSucursal: function() {
        const inp = document.getElementById('adj-sucursal');
        const box = document.getElementById('adj-suc-lista');
        if (!inp || !box) return;

        const q = this._ajusteNorm(inp.value).trim();
        const lista = (this._ajusteSucursales || []).filter(s => {
            if (!q) return true;
            return this._ajusteNorm(s.NombreSucursal).includes(q)
                || this._ajusteNorm(s.Afiliado).includes(q)
                || this._ajusteNorm(s.CodigoSucursal).includes(q);
        }).slice(0, 40);

        this._ajusteSucFiltradas = lista;
        this._ajusteSucIdx = -1;

        if (!lista.length) {
            box.innerHTML = `<div class="px-3 py-2 text-slate-400 italic">Sin coincidencias</div>`;
            box.classList.remove('hidden');
        } else {
            box.innerHTML = lista.map((s, i) => `
                <div data-i="${i}" class="adj-suc-item px-3 py-2 cursor-pointer hover:bg-orange-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <div class="font-bold text-slate-700 dark:text-slate-200">${s.NombreSucursal}</div>
                    <div class="text-[9px] text-slate-400">Afiliado ${s.Afiliado} · Terminal ${s.CodigoSucursal || '—'}</div>
                </div>`).join('');
            box.classList.remove('hidden');
            box.querySelectorAll('.adj-suc-item').forEach(el => {
                el.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    this._ajusteTomarSucursal(parseInt(el.dataset.i, 10));
                });
            });
        }
        this._ajusteSucursalElegida();
    },

    _ajusteTomarSucursal: function(i) {
        const s = (this._ajusteSucFiltradas || [])[i];
        if (!s) return;
        const inp = document.getElementById('adj-sucursal');
        if (inp) inp.value = s.NombreSucursal;
        const box = document.getElementById('adj-suc-lista');
        if (box) box.classList.add('hidden');
        // Guardamos el objeto EXACTO elegido: hay sucursales con el mismo nombre y
        // distinto afiliado, así que re-buscar por nombre tomaría el equivocado.
        this._ajusteSucSel = s;
        const info = document.getElementById('adj-sucursal-info');
        if (info) info.innerHTML = `<span class="text-emerald-600 dark:text-emerald-400">✓ Afiliado <b>${s.Afiliado}</b> · Terminal <b>${s.CodigoSucursal || '—'}</b> · CC <b>${s.CentroCosto || '—'}</b></span>`;
    },

    // Teclado: bajar, subir, elegir, cerrar
    _ajusteTeclaSucursal: function(e) {
        const box = document.getElementById('adj-suc-lista');
        if (!box || box.classList.contains('hidden')) return;
        const items = box.querySelectorAll('.adj-suc-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            this._ajusteSucIdx = (e.key === 'ArrowDown')
                ? Math.min((this._ajusteSucIdx ?? -1) + 1, items.length - 1)
                : Math.max((this._ajusteSucIdx ?? 0) - 1, 0);
            items.forEach((el, k) => el.classList.toggle('bg-orange-100', k === this._ajusteSucIdx));
            items[this._ajusteSucIdx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this._ajusteTomarSucursal(this._ajusteSucIdx >= 0 ? this._ajusteSucIdx : 0);
        } else if (e.key === 'Escape') {
            box.classList.add('hidden');
        }
    },

    // Con la sucursal se resuelven solos afiliado, terminal y centro de costo
    _ajusteSucursalElegida: function() {
        const val = (document.getElementById('adj-sucursal') || {}).value || '';
        const info = document.getElementById('adj-sucursal-info');
        const s = (this._ajusteSucursales || []).find(x => String(x.NombreSucursal).trim().toUpperCase() === val.trim().toUpperCase());
        this._ajusteSucSel = s || null;
        if (!info) return;
        info.innerHTML = s
            ? `<span class="text-emerald-600 dark:text-emerald-400">✓ Afiliado <b>${s.Afiliado}</b> · Terminal <b>${s.CodigoSucursal || '—'}</b> · CC <b>${s.CentroCosto || '—'}</b></span>`
            : (val ? '<span class="text-amber-600">Elija una sucursal de la lista</span>' : '');
    },

    // Bloque de montos: sin cálculo automático. El usuario escribe cada cifra;
    // el sistema sólo suma para mostrar el total. Cada banco tiene sus campos.
    _ajustePintarMontos: function() {
        const cont = document.getElementById('adj-montos-banco');
        if (!cont) return;
        const banco = (document.getElementById('adj-banco') || {}).value || 'DAVIBANK';

        const inp = (id, lbl, color) => `<div>
            <label class="block text-[9px] font-bold text-slate-500 uppercase mb-1">${lbl}</label>
            <input type="number" step="0.01" id="${id}" placeholder="0.00"
                class="w-full p-1.5 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 ${color} outline-none"></div>`;

        if (banco === 'BAC') {
            cont.innerHTML = inp('adj-com', 'Comisión', 'text-red-600')
                + inp('adj-ret1', 'Ret. Ventas', 'text-orange-600')
                + inp('adj-ret2', 'Ret. Renta', 'text-orange-600')
                + inp('adj-aci', 'ACI', 'text-orange-600');
        } else {
            cont.innerHTML = inp('adj-com', 'Comisión', 'text-red-600')
                + inp('adj-ret1', 'Ret. IVA', 'text-orange-600')
                + inp('adj-ret2', 'Ret. ISR', 'text-orange-600')
                + `<div class="flex items-end text-[9px] text-slate-400 italic pb-1">Montos manuales</div>`;
        }

        ['adj-com', 'adj-ret1', 'adj-ret2', 'adj-aci'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this._ajusteTotal());
        });
        this._ajusteTotal();
    },

    // Sólo suma lo que haya escrito el usuario y pinta el total. No calcula nada.
    _ajusteTotal: function() {
        const g = (id) => document.getElementById(id);
        const num = (id) => parseFloat((g(id) || {}).value) || 0;
        const total = num('adj-neto') + num('adj-com') + num('adj-ret1') + num('adj-ret2') + num('adj-aci');
        const disp = g('adj-bruto');
        if (disp) disp.innerText = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(total).replace(/\./g, ' ');
        return total;
    },

    guardarAjusteManual: async function() {
        const g = (id) => document.getElementById(id);
        const val = (id) => ((g(id) || {}).value || '').trim();
        const num = (id) => parseFloat((g(id) || {}).value) || 0;
        const btn = g('adj-save-btn');
        const errBox = g('adj-error');
        const mostrarError = (msg) => { if (errBox) { errBox.innerText = msg; errBox.classList.remove('hidden'); } };
        if (errBox) errBox.classList.add('hidden');

        const banco = val('adj-banco'), tipo = val('adj-tipo');
        const suc = this._ajusteSucSel;
        const neto = num('adj-neto');

        // Sucursal, autorización y tarjeta son OPCIONALES: se completan después.
        const faltan = [];
        if (!val('adj-fecha')) faltan.push('Fecha del ajuste');
        if (!val('adj-fpago')) faltan.push('Fecha de pago');
        if (!val('adj-softland')) faltan.push('ID de asiento Softland');
        if (!neto) faltan.push('Monto del ajuste');
        if (faltan.length) return mostrarError('Faltan datos obligatorios:\n• ' + faltan.join('\n• '));

        const bruto = this._ajusteTotal();

        const payload = {
            banco, tipo,
            fecha: val('adj-fecha'), fechaPago: val('adj-fpago'),
            sucursal: suc ? suc.NombreSucursal : '', afiliado: suc ? suc.Afiliado : '',
            terminal: suc ? suc.CodigoSucursal : '', centroCosto: suc ? suc.CentroCosto : '',
            autorizacion: val('adj-auth'), tarjeta: val('adj-tarjeta'),
            softland: val('adj-softland'), motivo: val('adj-motivo'),
            nota: val('adj-nota'), idEtiqueta: val('adj-categoria'),
            neto, bruto,
            comision: num('adj-com'), ret1: num('adj-ret1'), ret2: num('adj-ret2'),
            aci: num('adj-aci')
        };

        if (btn) { btn.disabled = true; btn.classList.add('opacity-60', 'cursor-wait'); btn.innerHTML = 'Guardando...'; }
        const restaurarBtn = () => {
            if (!btn) return;
            btn.disabled = false;
            btn.classList.remove('opacity-60', 'cursor-wait');
            btn.innerHTML = 'Guardar ajuste';
        };

        try {
            const res = await fetch('api/save_ajuste_m4.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) { restaurarBtn(); return mostrarError(data.error || 'No se pudo guardar el ajuste.'); }

            // Sin categoría => flota arriba hasta que se recargue la página
            if (data.sinCategoria) this._ajustesRecientes.push(String(data.id));

            const form = document.getElementById('adj-form');
            const overlay = form ? form.closest('.fixed') : null;
            if (overlay) overlay.remove();

            await window.SysUI.alert(`Ajuste registrado como <b>${data.id}</b>.\n\nYa está en la bandeja esperando su pareja de TSD.`, 'Ajuste creado', 'success');
            this.fetchPendientes();
        } catch (e) {
            restaurarBtn();
            mostrarError('Error de conexión: ' + e.message);
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

        const promesaModal = window.SysUI._createModal("✏️ Editar Etiqueta", html, [
            {text: 'Cancelar', value: null, class: 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Guardar', value: 'save', class: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors'}
        ], "info");

        // El modal se DESTRUYE del DOM antes de resolver la promesa: si leyéramos los
        // inputs después del await serían null. Capturamos los valores en vivo.
        let nombreNuevo = tag.Nombre;
        let descNueva = tag.Descripcion || '';
        const inpNom = document.getElementById('edit-tag-nombre');
        const inpDes = document.getElementById('edit-tag-desc');
        if (inpNom) inpNom.addEventListener('input', () => { nombreNuevo = inpNom.value; });
        if (inpDes) inpDes.addEventListener('input', () => { descNueva = inpDes.value; });

        const choice = await promesaModal;

        if (choice === 'save') {
            try {
                const res = await fetch('api/mantenimiento_etiquetas_m4.php', {
                    method: 'PUT', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        IdEtiqueta: tag.IdEtiqueta,
                        ColorCSS: tag.ColorCSS,
                        Nombre: String(nombreNuevo).trim(),
                        Descripcion: String(descNueva).trim()
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

        // ---- 1. DECLARAR TODO ANTES DE USARLO (evita TDZ de const) ----
        const css = (c) => this.TW_COLORS[c] || this.TW_COLORS['slate'];

        const items = this.customTags.map(tag => `
            <div onclick="window.AuxiliarLogic.asignarEtiquetaRapida('${row._uid}', '${tag.IdEtiqueta}')"
                 class="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="${tag.Descripcion || ''}">
                <span class="w-3 h-3 rounded-full border shadow-sm ${css(tag.ColorCSS)}"></span>
                <span class="text-xs text-slate-700 dark:text-slate-200">${tag.Nombre}</span>
            </div>`).join('');

        const itemsSel = this.customTags.map(tag => `
            <div onclick="window.AuxiliarLogic.asignarEtiquetaMasiva('${tag.IdEtiqueta}')"
                 class="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" title="${tag.Descripcion || ''}">
                <span class="w-3 h-3 rounded-full border shadow-sm ${css(tag.ColorCSS)}"></span>
                <span class="text-xs text-slate-700 dark:text-slate-200">${tag.Nombre}</span>
            </div>`).join('');

        // Espacio disponible: el flyout elige su lado
        const anchoSubmenu = 200;
        const abrirIzquierda = (e.clientX + 180 + anchoSubmenu) > window.innerWidth;
        const ladoClase = abrirIzquierda ? 'right-full' : 'left-full';
        const flecha = abrirIzquierda ? '◀' : '▶';

        // Filas con celdas seleccionadas (para el etiquetado masivo)
        const idxSel = new Set();
        if (this.gridLimbo && this.gridLimbo.selection) {
            this.gridLimbo.selection.forEach(td => { if (td.dataset && td.dataset.r !== undefined) idxSel.add(parseInt(td.dataset.r)); });
        }
        this._etiqObjetivoLimbo = [...idxSel].map(i => this.gridLimbo.displayData[i]).filter(r => r && r._dbId);
        const nSel = this._etiqObjetivoLimbo.length;

        const flyout = (titulo, contenido, quitarOnclick) => `
            <div class="group relative flex flex-col cursor-pointer transition-colors">
                <div class="flex justify-between items-center px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                    <div class="flex items-center gap-2">
                        <span>🏷️</span> <span class="text-xs text-slate-700 dark:text-slate-200 font-bold">${titulo}</span>
                    </div>
                    <span class="text-[10px] text-slate-400">${flecha}</span>
                </div>
                <div class="hidden group-hover:flex flex-col absolute ${ladoClase} top-0 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-xl py-1 max-h-56 overflow-y-auto custom-scrollbar z-50">
                    ${contenido || '<div class="px-4 py-2 text-xs italic text-slate-400">No hay etiquetas creadas</div>'}
                    <div class="border-t border-slate-200 dark:border-slate-600 my-1 mx-2"></div>
                    <div onclick="${quitarOnclick}" class="px-4 py-1.5 cursor-pointer text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors font-bold">🚫 Quitar etiqueta</div>
                </div>
            </div>`;

        // ---- 2. INYECTAR EN ORDEN ----
        // Notas
        menu.insertAdjacentHTML('beforeend', `
            <div onclick="window.AuxiliarLogic.abrirNotaLinea('${row._uid}')" class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span>📌</span> <span class="text-xs text-slate-700 dark:text-slate-200 font-bold">Agregar nota a esta línea</span>
            </div>
            <div onclick="window.AuxiliarLogic.abrirNotaMasiva()" class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span>📝</span> <span class="text-xs text-slate-700 dark:text-slate-200 font-bold">Agregar nota a seleccionadas</span>
            </div>
            <div class="border-t border-slate-200 dark:border-slate-600 my-1"></div>
        `);

        // Sugerencia automática (solo lectura)
        if (row._categoriaId === 1 || row._categoriaId === 2) {
            const nombre = row._categoriaId === 1 ? 'Contracargos' : 'Devoluciones';
            menu.insertAdjacentHTML('beforeend', `
                <div class="px-3 py-1.5 text-[10px] text-slate-400 italic">🤖 Sugerencia aut: <b>${nombre}</b></div>
                <div class="border-t border-slate-200 dark:border-slate-600 my-1"></div>
            `);
        }

        // Submenús de etiqueta
        menu.insertAdjacentHTML('beforeend', flyout('Asignar Etiqueta', items, `window.AuxiliarLogic.asignarEtiquetaRapida('${row._uid}', '')`));
        if (nSel > 1) {
            menu.insertAdjacentHTML('beforeend', flyout(`Etiquetar selección (${nSel})`, itemsSel, `window.AuxiliarLogic.asignarEtiquetaMasiva('')`));
        }
    },

    // Etiqueta (o actualiza la etiqueta de) TODAS las filas con celdas seleccionadas
    asignarEtiquetaMasiva: async function(idEtiqueta) {
        document.getElementById('vg-context-menu')?.remove();
        const filas = this._etiqObjetivoLimbo || [];
        if (filas.length === 0) return;
        try {
            await Promise.all(filas.map(r => fetch('api/save_etiqueta_m4.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: r._dbId, color: idEtiqueta, nota: r._notaEtiq || '' }) // La nota se conserva; la etiqueta se sobreescribe
            }).then(x => x.json()).then(j => { if (!j.success) throw new Error(j.error); })));

            // Estampar memoria para que el repintado no pierda el cambio
            filas.forEach(r => {
                const t = this.lastTSD.find(x => x.ID_Transaccion === r._dbId); if (t) t.ColorEtiqueta = idEtiqueta || null;
                const b = this.lastBancos.find(x => x.IdTransaccion === r._dbId); if (b) b.ColorEtiqueta = idEtiqueta || null;
            });
            this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
        } catch (e) {
            window.SysUI.alert("No se pudo etiquetar la selección: " + e.message, "Fallo", "error");
        }
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

        const promesaEtiq = window.SysUI._createModal("🏷️ Etiqueta de Seguimiento", html, [
            {text: 'Cancelar', value: null, class: 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Guardar Etiqueta', value: 'save', class: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors'}
        ], "info");

        // Mismo cuidado que en editTag: el DOM ya no existe después del await.
        let colorSel = row._colorEtiq || '';
        let notaSel = row._notaEtiq || '';
        const inpColor = document.getElementById('modal-etiq-color');
        const inpNota = document.getElementById('modal-etiq-nota');
        if (inpColor) {
            const sincroColor = () => { colorSel = inpColor.value; };
            inpColor.addEventListener('change', sincroColor);
            document.querySelectorAll('.etiq-btn').forEach(b => b.addEventListener('click', () => setTimeout(sincroColor, 0)));
        }
        if (inpNota) inpNota.addEventListener('input', () => { notaSel = inpNota.value; });

        const choice = await promesaEtiq;

        if (choice === 'save') {
            const color = colorSel;
            const nota = String(notaSel).trim();

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