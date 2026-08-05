window.ConciliacionLogic = {
    data: { 
        detalle: [], 
        pagado: [], 
        scotia_detalle: [], 
        scotia_pagado: [], 
        files: {
            bac_detalle: [],
            bac_pagado: [],
            scotia_detalle: [],
            scotia_pagado: []
        },
    },
    grids: { bac: null, scotia: null }, // <--- Almacén de instancias
    activeTab: 'bac', // Estado actual

    switchTab: function(tab) {
        this.activeTab = tab;
        
        const tabs = {
            bac: document.getElementById('tab-bac'),
            scotia: document.getElementById('tab-scotia')
        };
        const workspaces = {
            bac: document.getElementById('workspace-bac'),
            scotia: document.getElementById('workspace-scotia')
        };

        // Blindaje
        if (!tabs.bac || !tabs.scotia) return;

        const activeClass = "bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-white font-bold";
        const getActiveColor = (t) => t === 'bac' ? 'text-red-600' : 'text-slate-800 dark:text-white';
        
        const inactiveClass = "text-slate-500 hover:text-slate-700 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-800";

        // Reset y Activar
        Object.keys(tabs).forEach(k => {
            const isActive = k === tab;
            
            tabs[k].className = `px-4 py-1.5 text-sm rounded transition-all ${isActive ? "bg-white shadow-sm font-bold dark:bg-slate-700 " + getActiveColor(k) : inactiveClass}`;
            
            const ws = workspaces[k];
            if (ws) {
                if (isActive) {
                    ws.classList.remove('hidden');
                    // Truco UX (Reflow): Quitar la clase, leer el DOM, volver a ponerla para reiniciar la animación
                    ws.classList.remove('animate-fade-in-up');
                    void ws.offsetWidth; 
                    ws.classList.add('animate-fade-in-up');
                } else {
                    ws.classList.add('hidden');
                    ws.classList.remove('animate-fade-in-up');
                }
            }
        });
    },

    // Genera listas de items excluidos (Checkboxes desmarcados)
    renderAudit: function(bank) {
        const isBac = bank === 'bac';
        
        // 1. Obtener Datos Crudos (Para Excluidos Manuales)
        const rawDet = (isBac ? this.data.detalle : this.data.scotia_detalle) || [];
        const rawPag = (isBac ? this.data.pagado : this.data.scotia_pagado) || [];
        
        // 2. Obtener Datos Grid (Para No Cruzados / Diferencias Totales)
        const gridInstance = isBac ? this.grids.bac : this.grids.scotia;
        const gridData = (gridInstance && gridInstance.options.data) ? gridInstance.options.data : [];

        // IDs DOM
        const pfx = isBac ? 'bac' : 'scotia';
        const container = document.getElementById(`audit-${pfx}`);
        if(!container) return;

        // --- CONSTRUCTOR DE ITEMS ---
        // Vamos a crear un array unificado de objetos { label, monto, tipo }
        
        // A. DETALLE PENDIENTE
        const itemsDetalle = [];
        
        // A1. Excluidos Manualmente (Checkbox)
        rawDet.forEach(r => {
            if (!r._enabled) {
                itemsDetalle.push({
                    label: r._id || r.id || 'Sin ID', // Ajustar según estructura BAC/Scotia
                    desc: r._desc || 'Excluido Manual',
                    monto: r._monto || r._neto || 0, // Ajustar propiedades
                    reason: 'user'
                });
            }
        });

        // A2. Sobrantes del Grid (Venta existe, Pago es 0)
        // OJO: Solo si NO fueron excluidos (para no duplicar)
        gridData.forEach(r => {
            // Si hay Neto Esperado pero NO hay Pago, es un sobrante del detalle
            if (Math.abs(r.neto) > 0 && r.pagado === 0) {
                itemsDetalle.push({
                    label: r.id,
                    desc: 'No encontrado en Banco',
                    monto: r.neto,
                    reason: 'system'
                });
            }
        });

        // B. BANCO PENDIENTE
        const itemsBanco = [];

        // B1. Excluidos Manualmente
        rawPag.forEach(r => {
            if (!r._enabled) {
                itemsBanco.push({
                    label: r._extractedId || r._desc || 'Sin ID',
                    desc: 'Excluido Manual',
                    monto: r._monto || 0,
                    reason: 'user'
                });
            }
        });

        // B2. Sobrantes del Grid (Pago existe, Venta es 0)
        gridData.forEach(r => {
            if (r.neto === 0 && Math.abs(r.pagado) > 0) {
                itemsBanco.push({
                    label: r.id,
                    desc: 'No encontrado en Detalle',
                    monto: r.pagado,
                    reason: 'system'
                });
            }
        });

        // --- RENDERIZADO HTML ---
        const renderList = (items, colorClass) => {
            if (items.length === 0) return '<div class="text-slate-400 italic text-xs p-2">Todo conciliado o vacío.</div>';
            
            // Ordenar por monto descendente
            items.sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto));

            return items.map(item => `
                <div class="flex justify-between items-center p-2 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-sm transition-shadow">
                    <div class="overflow-hidden">
                        <div class="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate w-40" title="${item.label}">
                            ${item.label}
                        </div>
                        <div class="text-[9px] ${item.reason === 'user' ? 'text-slate-400' : 'text-red-400 font-bold'} truncate">
                            ${item.desc}
                        </div>
                    </div>
                    <div class="text-xs font-mono font-bold ${colorClass}">
                        ${this.formatMoney(item.monto)}
                    </div>
                </div>
            `).join('');
        };

        document.getElementById(`audit-list-${pfx}-detalle`).innerHTML = renderList(itemsDetalle, 'text-orange-600 dark:text-orange-400');
        document.getElementById(`audit-list-${pfx}-pagado`).innerHTML = renderList(itemsBanco, 'text-blue-600 dark:text-blue-400');

        // Mostrar Panel
        if (gridInstance) {
            container.classList.remove('hidden');
        }
    },

    // data: { detalle: [], pagado: [] },
    table: null,

    init: async function() {
        // Fusión de Lógica Modular
        if(window.BACLogic) Object.assign(this, window.BACLogic);
        if(window.ScotiaLogic) Object.assign(this, window.ScotiaLogic);
        
        console.log("Sistema Conciliación Iniciado");
        
        // Evitar que el drag&drop se duplique al recargar la vista
        if (!this._uploadsConfigured) {
            this.setupUploads();
            this._uploadsConfigured = true;
        }
        
        // --- CARGA MULTIUSUARIO (BORRADOR COMPARTIDO EN BD) ---
        // 1) SIEMPRE traer primero los pendientes/diferidos de BD (son la autoridad)
        await this.loadPendientes();

        // 2) ¿Hay un borrador compartido EN CURSO? (metadatos livianos, sin bajar los MB)
        try {
            const meta = await this._borradorApi('meta');
            if (meta && meta.existe) {
                if (meta.ocupado) {
                    // Otro usuario con latido fresco -> MODO SÓLO LECTURA (carga el trabajo, no deja editar)
                    const full = await this._borradorApi('get');
                    if (full && full.existe) {
                        this._dbDraftVersion = full.version;
                        this.restoreDraftFromLocal(JSON.parse(full.dataJson));
                    }
                    this._activarSoloLectura(meta.ocupadoPor);
                    await window.SysUI.alert(
                        `El usuario <b>${meta.ocupadoPor}</b> está trabajando en una conciliación en este momento.\n\nNo pueden trabajar dos personas a la vez, así que se cargó su trabajo en <b>MODO SÓLO LECTURA</b>: puede consultarlo, pero no editar ni guardar.\n\nRecargue la página más tarde para verificar si ya quedó libre.`,
                        "Conciliación ocupada", "warning"
                    );
                } else {
                // Decisión de entrada: CARGAR el borrador o EMPEZAR DESDE CERO (igual que hoy,
                // con la diferencia de que ahora puede ser el autoguardado de OTRO usuario).
                let decidido = false;
                while (!decidido) {
                    const cargar = await window.SysUI.confirm(
                        `Existe una conciliación en curso, último autoguardado hecho por <b>${meta.usuarioInicio}</b> (${meta.usuarioUltimo}).\n\nAceptar = CARGAR y continuar ese trabajo.\nCancelar = EMPEZAR DESDE CERO.`,
                        "Borrador encontrado", "info"
                    );
                    if (cargar) {
                        const full = await this._borradorApi('get');
                        if (full && full.existe) {
                            this._dbDraftVersion = full.version;
                            this.restoreDraftFromLocal(JSON.parse(full.dataJson)); // MERGE encima de lo pendiente
                            if (!meta.iniciadoPorMi) {
                                this._mostrarBannerColaboracion(meta.usuarioInicio);
                                await window.SysUI.alert(
                                    "Estás continuando una conciliación iniciada por otro usuario. A partir de ahora, lo que guardes queda bajo tu responsabilidad.",
                                    "Trabajo compartido", "info"
                                );
                            }
                        }
                        decidido = true;
                    } else {
                        // Empezar desde cero: advertir que se elimina el autoguardado ajeno y se sobrescribe
                        const confirmar = await window.SysUI.confirm(
                            `Si empieza desde cero se ELIMINARÁ el último autoguardado hecho por <b>${meta.usuarioInicio}</b> y se sobrescribirá con el suyo.\n\n(Los datos diferidos/pendientes NO se borran.)\n\n¿Confirma empezar desde cero?`,
                            "Empezar desde cero", "warning"
                        );
                        if (confirmar) {
                            await this._borradorApi('delete');
                            this._dbDraftVersion = null; // su trabajo creará un borrador nuevo
                            decidido = true;
                        }
                        // Si no confirma, vuelve a mostrar la decisión.
                    }
                }
                }
            }
        } catch (e) {
            // Nunca abortar el init por un fallo del borrador: los relojes deben arrancar igual
            console.error("No se pudo consultar el borrador compartido:", e);
        }

        // 3) Relojes: latido de presencia (1 min) + autoguardado pesado (10 min)
        this.startAutoSave();
        this.startHeartbeat();

        // BLOQUEO ANTI-DESASTRES (F5 o Cerrar Pestaña)
        window.onbeforeunload = (e) => {
            if (this.hasUnsavedData()) {
                const msg = "Tienes archivos cargados que no se han guardado en la Base de Datos. ¿Seguro que deseas salir?";
                e.returnValue = msg;
                return msg;
            }
        };
    },

    // --- GESTIÓN DE ESTADO LOCAL ---
    resetState: function() {
        console.log("🧹 Purgando estado de memoria y DOM fantasma...");
        
        if (this._autoSaveInterval) {
            clearInterval(this._autoSaveInterval);
            this._autoSaveInterval = null;
        }

        // 1. MUTACIÓN DIRECTA: Vaciar arrays existentes (Destruye referencias de memoria)
        const purge = (arr) => { if (Array.isArray(arr)) arr.length = 0; };
        
        if (this.data) {
            purge(this.data.detalle); purge(this.data.pagado);
            purge(this.data.scotia_detalle); purge(this.data.scotia_pagado);
            if (this.data.files) {
                purge(this.data.files.bac_detalle); purge(this.data.files.bac_pagado);
                purge(this.data.files.scotia_detalle); purge(this.data.files.scotia_pagado);
            }
            this.data.headers = {}; this.data.processed = {};
        }

        // Matar Zombis de Conciliación Manual (En la clase principal)
        purge(this.manualMatches);
        purge(this.manualMatchesScotia);
        if (this.deferredRows) { purge(this.deferredRows.det); purge(this.deferredRows.pag); }

        // Matar Zombis en las clases Lógicas hijas (Evita resurrección)
        if (window.BACLogic) {
            purge(window.BACLogic.manualMatches);
            if (window.BACLogic.deferredRows) { purge(window.BACLogic.deferredRows.det); purge(window.BACLogic.deferredRows.pag); }
        }
        if (window.ScotiaLogic) {
            purge(window.ScotiaLogic.manualMatchesScotia);
        }

        // Destrucción de Grids (Libera eventos del DOM)
        if (this.grids) {
            Object.keys(this.grids).forEach(k => {
                if (this.grids[k]) {
                    if (typeof this.grids[k].destroy === 'function') this.grids[k].destroy();
                    this.grids[k] = null;
                }
            });
        }

        // 2. LIMPIEZA DE DOM
        const domGrids = [
            'table-result-bac', 'table-exceptions-bac', 'table-deferred-bac', 'table-manual-bac',
            'table-result-scotia', 'table-exceptions-scotia',
            'bac-summary-container', 'scotia-summary-container'
        ];
        domGrids.forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });

        const drops = ['drop-bac-detalle', 'drop-bac-pagado', 'drop-scotia-detalle', 'drop-scotia-pagado'];
        drops.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('border-green-500', 'bg-green-50', 'dark:bg-green-900/20'); el.classList.add('border-slate-300', 'bg-white', 'dark:bg-slate-800'); }
        });

        const cards = ['card-bac-detalle', 'card-bac-pagado', 'card-scotia-detalle', 'card-scotia-pagado', 'audit-bac', 'audit-scotia', 'audit-manual-bac', 'audit-deferred-bac'];
        cards.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });
        
        const statusIds = ['status-bac-detalle', 'status-bac-pagado', 'status-scotia-detalle', 'status-scotia-pagado'];
        statusIds.forEach(id => { const el = document.getElementById(id); if(el) { el.innerHTML = ''; el.classList.add('hidden'); }});

        ['sum-depositos', 'sc-total-pagado'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = '0'; });
    },

    hasUnsavedData: function() {
        // Verifica si hay archivos cargados ignorando el "Saldos Históricos" (porque eso viene de BD automáticamente)
        const checkFiles = (arr) => arr && arr.filter(f => f !== 'Saldos Históricos').length > 0;
        return checkFiles(this.data.files.bac_detalle) || 
               checkFiles(this.data.files.bac_pagado) || 
               checkFiles(this.data.files.scotia_detalle) || 
               checkFiles(this.data.files.scotia_pagado);
    },

    // Guarda el borrador COMPARTIDO en BD (snapshot atómico). tipo: 'auto' | 'manual'
    saveDraftToLocal: async function(tipo = 'auto') {
        if (tipo === true || tipo === false) tipo = 'auto'; // compat. con llamadas viejas (boolean)

        if (this._soloLectura) return { ok: false, soloLectura: true };
        if (this._bloqueadoPorOtro) return { ok: false, bloqueado: true };
        if (this._online === false) return { ok: false, offline: true }; // sin conexión: ya avisamos

        // Anti-solape: el autoguardado se salta si hay uno en curso; el manual aborta el que corre
        if (this._saveInProgress) {
            if (tipo === 'auto') return { ok: false, skipped: true };
            if (this._saveAbort) this._saveAbort.abort();
        }

        // Snapshot ATÓMICO en este instante (JSON.stringify es síncrono: nada se cuela a mitad)
        const dataJson = JSON.stringify({
            data: this.data,
            manualBAC: this.manualMatches || [],
            manualScotia: this.manualMatchesScotia || [],
            deferred: this.deferredRows || { det: [], pag: [] }
        });
        const tamano = dataJson.length;

        this._saveInProgress = true;
        this._saveAbort = new AbortController();
        const signal = this._saveAbort.signal;

        const enviar = (baseVersion) => this._borradorApi('save',
            { dataJson, baseVersion: baseVersion || 0, tipo, tamano, comprimido: 0 }, { signal });

        try {
            let r = await enviar(this._dbDraftVersion);
            // Conflicto de versión (mismo dueño): refresco y reintento UNA vez
            if (r && r.conflict) {
                this._dbDraftVersion = r.version;
                r = await enviar(this._dbDraftVersion);
            }
            if (r && r.ok) {
                this._dbDraftVersion = r.version;
                if (tipo === 'auto') this.showAutoSaveToast();
            }
            return r;
        } catch (e) {
            if (e.name === 'AbortError') return { ok: false, aborted: true }; // lo canceló un guardado manual
            this._setOnline(false); // fallo de red -> modo offline
            throw e;
        } finally {
            this._saveInProgress = false;
            this._saveAbort = null;
        }
    },

    // --- AUTOGUARDADO PESADO (CADA 10 MINUTOS) ---
    startAutoSave: function() {
        if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);
        if (this._soloLectura) return; // en sólo lectura no se autoguarda
        this._autoSaveInterval = setInterval(() => {
            // Si el usuario salió del Módulo 2, apagar el reloj
            if (!this._moduloAbierto()) { clearInterval(this._autoSaveInterval); this._autoSaveInterval = null; return; }
            if (this._soloLectura || this._bloqueadoPorOtro || this._online === false) return;
            if (this.hasUnsavedData()) {
                this.saveDraftToLocal('auto').catch(() => {}); // se salta solo si ya hay uno en curso
            }
        }, 300000); // 5 minutos
    },

    // El Módulo 2 está abierto si su contenedor sigue en el DOM (el router reemplaza #app)
    _moduloAbierto: function() {
        return !!document.getElementById('conciliacion-module');
    },

    showAutoSaveToast: function() {
        let toast = document.getElementById('auto-save-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'auto-save-toast';
            toast.className = 'fixed bottom-4 left-4 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] px-3 py-1.5 rounded-full shadow-lg z-[9999] opacity-0 transition-opacity duration-500 flex items-center gap-2 pointer-events-none select-none';
            toast.innerHTML = '<span class="text-green-400 animate-pulse">●</span> Progreso guardado';
            document.body.appendChild(toast);
        }
        
        // Mostrar
        toast.classList.remove('opacity-0');
        
        // Ocultar suavemente después de 3 segundos
        setTimeout(() => {
            toast.classList.add('opacity-0');
        }, 3000);
    },

    // ==========================================================
    // MULTIUSUARIO: API, LATIDO, CONEXIÓN Y UI DE GUARDADO
    // ==========================================================
    _dbDraftVersion: null,
    _saveInProgress: false,
    _saveAbort: null,
    _bloqueadoPorOtro: false,
    _soloLectura: false,
    _online: true,
    _heartbeatInterval: null,

    _borradorApi: async function(action, payload = {}, opts = {}) {
        const res = await fetch('api/heartbeat_borrador.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ action, modulo: 'M2' }, payload)),
            signal: opts.signal || undefined
        });
        return await res.json();
    },

    // Latido de presencia cada 1 min (SOLO mientras el Módulo 2 esté abierto)
    startHeartbeat: function() {
        if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
        if (this._soloLectura) return; // en sólo lectura no reclamamos presencia
        const beat = async () => {
            // Si el usuario salió del Módulo 2, apagar el latido (libera el candado por vencimiento)
            if (!this._moduloAbierto()) { this.stopHeartbeat(); this._limpiarSoloLectura(); return; }
            try {
                const r = await this._borradorApi('beat');
                this._setOnline(true);
                if (r && r.ocupado) {
                    if (!this._soloLectura) {
                        this._activarSoloLectura(r.ocupadoPor);
                        window.SysUI.alert(
                            `El usuario <b>${r.ocupadoPor}</b> está trabajando en una conciliación en este momento.\n\nSe activó el <b>MODO SÓLO LECTURA</b>: su trabajo ya no se está guardando. Recargue la página más tarde para verificar si quedó libre.`,
                            "Conciliación ocupada", "warning"
                        );
                    }
                } else {
                    this._bloqueadoPorOtro = false;
                    if (r && r.version != null && this._dbDraftVersion == null) this._dbDraftVersion = r.version;
                }
            } catch (e) {
                this._setOnline(false); // sin conexión: seguir trabajando, pero sin guardar
            }
        };
        beat();
        this._heartbeatInterval = setInterval(beat, 60000); // 1 minuto
    },

    stopHeartbeat: function() {
        if (this._heartbeatInterval) clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = null;
    },

    // Al abandonar el Módulo 2 no debe quedar rastro del modo sólo lectura
    _limpiarSoloLectura: function() {
        const el = document.getElementById('solo-lectura-banner');
        if (el && el.parentNode) el.parentNode.removeChild(el);
        document.body.classList.remove('modo-solo-lectura');
    },

    // Aviso único cuando se intenta una acción bloqueada en sólo lectura
    _avisoSoloLectura: function() {
        if (window.SysUI) {
            SysUI.alert("Está en <b>modo sólo lectura</b> porque otro usuario tiene esta conciliación.\n\nNo es posible crear ajustes ni guardar cambios.", "Acción bloqueada", "warning");
        }
    },

    // MODO SÓLO LECTURA: apaga relojes, bloquea edición y avisa hasta que se recargue
    _activarSoloLectura: function(usuario) {
        this._soloLectura = true;
        this._bloqueadoPorOtro = true;

        if (this._autoSaveInterval) { clearInterval(this._autoSaveInterval); this._autoSaveInterval = null; }
        this.stopHeartbeat();

        // Bloqueo por CSS: cubre también los botones que nacen después (popups)
        if (!document.getElementById('solo-lectura-style')) {
            const st = document.createElement('style');
            st.id = 'solo-lectura-style';
            st.textContent = `body.modo-solo-lectura #btn-save-snapshot,
                body.modo-solo-lectura #btn-conservar-borrador,
                body.modo-solo-lectura #btn-add-adj,
                body.modo-solo-lectura #btn-save-adj,
                body.modo-solo-lectura #btn-manual,
                body.modo-solo-lectura .btn-deshacer {
                    pointer-events: none !important;
                    opacity: .45 !important;
                    cursor: not-allowed !important;
                    filter: grayscale(1);
                }
                /* Cinta por ENCIMA del header global, en el flujo normal de la página.
                   Nada de position:fixed: el módulo usa animate-fade-in-up y un ancestro
                   con transform rompe el anclaje al viewport. Así se ve de entrada. */
                #solo-lectura-banner {
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    width: 100%; padding: 7px 12px; box-sizing: border-box;
                    background: linear-gradient(90deg,#b45309,#f59e0b,#b45309);
                    color: #fff; font-size: 11px; font-weight: 700; letter-spacing: .03em;
                    box-shadow: 0 2px 10px rgba(0,0,0,.22);
                    animation: slBannerIn .35s cubic-bezier(.34,1.56,.64,1);
                }
                @keyframes slBannerIn { from { opacity:0; max-height:0; } to { opacity:1; max-height:60px; } }`;
            document.head.appendChild(st);
        }
        document.body.classList.add('modo-solo-lectura');
        document.body.style.paddingTop = '';      // limpieza de versiones anteriores
        document.body.style.paddingBottom = '';
        ['btn-save-snapshot', 'btn-conservar-borrador', 'btn-add-adj', 'btn-save-adj', 'btn-manual'].forEach(id => {
            const b = document.getElementById(id);
            if (b) b.disabled = true;
        });

        // Anuncio persistente (se va sólo al recargar el sitio)
        let el = document.getElementById('solo-lectura-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'solo-lectura-banner';
            // Primer elemento de la página: queda arriba del header global y se ve
            // apenas entra el usuario. Se retira solo al salir del módulo.
            document.body.insertBefore(el, document.body.firstChild);
        }
        el.innerHTML = `<span>👁</span> MODO SÓLO LECTURA — ${usuario || 'otro usuario'} está trabajando en una conciliación. Recargue para reintentar.`;
    },

    // Aviso persistente de conexión perdida
    _setOnline: function(ok) {
        if (this._online === ok) return;
        this._online = ok;
        let el = document.getElementById('offline-warning');
        if (!ok) {
            if (!el) {
                el = document.createElement('div');
                el.id = 'offline-warning';
                el.className = 'fixed top-4 right-4 bg-red-600 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl z-[9999] flex items-center gap-2 max-w-xs';
                el.innerHTML = '<span class="animate-pulse text-base leading-none">⚠</span><span>Sin conexión — tu progreso <b>no se está guardando</b>. Podés seguir trabajando; se reanudará al volver la conexión.</span>';
                document.body.appendChild(el);
            }
        } else if (el) {
            el.remove();
        }
    },

    // Banner discreto cuando continúo el trabajo de otra persona
    _mostrarBannerColaboracion: function(usuarioInicio) {
        let el = document.getElementById('colab-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'colab-banner';
            el.className = 'fixed bottom-4 right-4 bg-indigo-600 text-white text-[11px] px-3 py-1.5 rounded-full shadow-lg z-[9998] flex items-center gap-2 select-none';
            document.body.appendChild(el);
        }
        el.innerHTML = `<span class="animate-pulse">◆</span> Continuando cierre de <b>${usuarioInicio}</b>`;
    },

    // Estados visuales del botón "Conservar Borrador" + barra JUSTO DEBAJO del botón
    _posBarraBajoBtn: function(btn) {
        let bar = document.getElementById('save-progress-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'save-progress-bar';
            bar.style.cssText = 'position:fixed;height:3px;width:0;z-index:9999;background:#3b82f6;border-radius:2px;transition:width .35s ease;box-shadow:0 0 8px rgba(59,130,246,.7)';
            document.body.appendChild(bar);
        }
        if (btn) {
            const rect = btn.getBoundingClientRect();
            bar.style.left = rect.left + 'px';
            bar.style.top = (rect.bottom + 3) + 'px';
            bar._btnWidth = rect.width;
        }
        return bar;
    },
    _btnGuardando: function(btn) {
        // Fijar el ancho ANTES de cambiar el texto para que el botón no encoja y la barra calce
        if (btn) {
            if (btn._orig == null) btn._orig = btn.innerHTML;
            btn.style.width = btn.offsetWidth + 'px';
        }
        const bar = this._posBarraBajoBtn(btn);
        bar.style.background = '#3b82f6';
        bar.style.width = '0';
        const full = bar._btnWidth || 120;
        requestAnimationFrame(() => { bar.style.width = (full * 0.8) + 'px'; });
        if (btn) {
            btn.disabled = true;
            btn.classList.add('opacity-70', 'cursor-not-allowed');
            btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"></path></svg> Guardando...';
        }
    },
    _btnGuardado: function(btn) {
        const bar = this._posBarraBajoBtn(btn);
        bar.style.background = '#22c55e';
        bar.style.width = (bar._btnWidth || 120) + 'px';
        setTimeout(() => { bar.style.width = '0'; }, 1200);
        if (btn) {
            btn.classList.remove('opacity-70', 'cursor-not-allowed');
            btn.classList.add('!bg-green-500', '!text-white', '!border-green-500');
            btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> ¡Guardado!';
            setTimeout(() => this._btnReset(btn), 5000);
        }
    },
    _btnReset: function(btn) {
        const bar = document.getElementById('save-progress-bar');
        if (bar) bar.style.width = '0';
        if (btn) {
            btn.disabled = false;
            btn.style.width = ''; // liberar el ancho fijado
            btn.classList.remove('opacity-70', 'cursor-not-allowed', '!bg-green-500', '!text-white', '!border-green-500');
            if (btn._orig != null) btn.innerHTML = btn._orig;
        }
    },

    restoreDraftFromLocal: function(draftObj) {
        console.log("📦 Restaurando borrador masivo (IndexedDB)...");
        
        // 1. FUSIONAR el borrador ENCIMA de lo pendiente ya cargado (no reemplazar)
        //    De-dup por _uid: los pendientes de BD (frescos) mandan; se agrega solo la capa humana.
        const d = draftObj.data || {};
        this.data = this.data || {};
        const seen = new Set();
        ['detalle', 'pagado', 'scotia_detalle', 'scotia_pagado'].forEach(k => {
            if (!Array.isArray(this.data[k])) this.data[k] = [];
            this.data[k].forEach(r => { if (r && r._uid != null) seen.add(String(r._uid)); });
        });
        ['detalle', 'pagado', 'scotia_detalle', 'scotia_pagado'].forEach(k => {
            (d[k] || []).forEach(r => {
                if (r && r._uid != null && seen.has(String(r._uid))) return; // ya presente (pendiente de BD)
                this.data[k].push(r);
                if (r && r._uid != null) seen.add(String(r._uid));
            });
        });
        this.data.files = this.data.files || { bac_detalle: [], bac_pagado: [], scotia_detalle: [], scotia_pagado: [] };
        ['bac_detalle', 'bac_pagado', 'scotia_detalle', 'scotia_pagado'].forEach(f => {
            const u = new Set(this.data.files[f] || []);
            ((d.files && d.files[f]) || []).forEach(x => u.add(x));
            this.data.files[f] = Array.from(u);
        });
        this.data.headers = Object.assign({}, d.headers || {}, this.data.headers || {});
        this.data.processed = this.data.processed || {};
        this.manualMatches = draftObj.manualBAC || [];
        this.manualMatchesScotia = draftObj.manualScotia || [];
        this.deferredRows = draftObj.deferred || { det: [], pag: [] };

        // 2. Destruir instancias previas (Zombis) de las tablas para forzar que nazcan de nuevo
        this.grids = { bac: null, scotia: null, bac_audit: null, scotia_audit: null, bac_manual: null, bac_deferred: null };

        // 3. Darle al navegador 2 ciclos de renderizado (requestAnimationFrame) 
        // para asegurarse de que el HTML de las pestañas ya está inyectado y calculable.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                
                // A. Restaurar Listas de Archivos Visuales
                this.updateFileList('bac_detalle');
                this.updateFileList('bac_pagado');
                this.updateScotiaFileList('scotia_detalle');
                this.updateScotiaFileList('scotia_pagado');

                // B. Restaurar BAC si tiene datos
                if (this.data.files.bac_detalle.length || this.data.files.bac_pagado.length) {
                    
                    // Asegurar que las tarjetas estén visibles antes de calcular
                    const cardDet = document.getElementById('card-bac-detalle');
                    const cardPag = document.getElementById('card-bac-pagado');
                    const dropDet = document.getElementById('drop-bac-detalle');
                    const dropPag = document.getElementById('drop-bac-pagado');

                    if(this.data.files.bac_detalle.length && cardDet) {
                        cardDet.classList.remove('hidden');
                        dropDet.classList.remove('border-slate-300');
                        dropDet.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
                    }
                    if(this.data.files.bac_pagado.length && cardPag) {
                        cardPag.classList.remove('hidden');
                        dropPag.classList.remove('border-slate-300');
                        dropPag.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
                    }
                    
                    // Disparar cadena de cálculo (esto instanciará VanillaGrid internamente)
                    if(this.recalculateDetalle) this.recalculateDetalle();
                    if(this.recalculateBACPagado) this.recalculateBACPagado();
                    if(this.renderManualMatchesTable) this.renderManualMatchesTable();
                    if(this.renderDeferredTable) this.renderDeferredTable();
                }

                // C. Restaurar Scotia si tiene datos
                if (this.data.files.scotia_detalle.length || this.data.files.scotia_pagado.length) {
                    
                    const cardScDet = document.getElementById('card-scotia-detalle');
                    const cardScPag = document.getElementById('card-scotia-pagado');
                    const dropScDet = document.getElementById('drop-scotia-detalle');
                    const dropScPag = document.getElementById('drop-scotia-pagado');

                    if(this.data.files.scotia_detalle.length && cardScDet) {
                        cardScDet.classList.remove('hidden');
                        dropScDet.classList.remove('border-slate-300');
                        dropScDet.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
                    }
                    if(this.data.files.scotia_pagado.length && cardScPag) {
                        cardScPag.classList.remove('hidden');
                        dropScPag.classList.remove('border-slate-300');
                        dropScPag.classList.add('border-green-500', 'bg-green-50', 'dark:bg-green-900/20');
                    }

                    // Disparar cadena de cálculo
                    if(this.updateScotiaCard) this.updateScotiaCard();
                    if(this.recalculateScotiaPagado) this.recalculateScotiaPagado();
                    if(this.runMatchScotiabank) this.runMatchScotiabank();
                }

                console.log("✅ Restauración visual completada.");
            });
        });
    },

    // ==========================================================
    // MOTOR DE ARRASTRE DE SALDOS (HISTÓRICOS)
    // ==========================================================
    loadPendientes: async function() {
        try {
            const res = await fetch('api/get_pendientes.php');
            const json = await res.json();
            if (!json.success || !json.data || json.data.length === 0) return;

            // NOMBRES EXACTOS DE LOS EXCELS/CSV PARA QUE EL MATCH NO DUPLIQUE COLUMNAS
            const defH = {
                bacDet: ["NUMERO_AFILIADO", "NOMBRECOMERCIO", "FECHA_TRANSACCION", "FECHA_CIERRE_DATAFONO", "FECHA_PAGO", "NUMERO_DE_TARJETA", "AUTORIZACION", "TERMINAL", "MONTO_VENTA", "COMISION", "RETENCION_VENTAS", "RETENCION_RENTA", "MONTONETO", "NUMERO_LIQUIDACION", "NUMERO_CUENTA", "TIPO_CAMBIO", "AJUSTE_COMISION_INTERNACIONAL", "TIPO_TARJETA"],
                bacPag: ["Fecha", "Referencia", "Código", "Descripción", "Débitos", "Créditos", "Balance"],
                scoDet: ["Fuente", "Fecha Pago", "Moneda", "Transacción", "Razón Social", "MerID", "Nombre", "Fecha Lote/Ajuste", "Número Lote/Ajuste", "Terminal", "Número Pago", "Número Autorización", "Número Tarjeta", "Monto Orig", "Monto Bruto", "Monto Comisión Total", "% Comisión Total", "Comisión Int", "% Comisión Int", "Retención IVA", "% Retención IVA", "Retención IS", "Monto Neto", "Estatus"],
                scoPag: ["Número Referencia", "Fecha Movimiento", "Descripción", "Monto", "Saldo", "Crédito/Débito"]
            };
            this.data.headers = this.data.headers || {};
            if(!this.data.headers.detalle) this.data.headers.detalle = defH.bacDet;
            if(!this.data.headers.pagado) this.data.headers.pagado = defH.bacPag;
            if(!this.data.headers.scotia_detalle) this.data.headers.scotia_detalle = defH.scoDet;
            if(!this.data.headers.scotia_pagado) this.data.headers.scotia_pagado = defH.scoPag;

            // Mapeadores DB -> Array Numérico Visual
            const mapBacDet = ["NUMERO_AFILIADO", "NOMBRECOMERCIO", "BAC_FTRANS", "FECHA_CIERRE_DATAFONO", "BAC_FPAGO", "NUMERO_DE_TARJETA", "BAC_AUTH", "BAC_TERM", "MONTO_VENTA", "BacComision", "RetencionVentas", "RetencionRenta", "BAC_NETO", "Liquidacion", "NUMERO_CUENTA", "TIPO_CAMBIO", "AjusteACI", "TIPO_TARJETA"];
            const mapBacPag = ["PBacF", "PBacRef", "PBacCod", "PBacDesc", "PBacDeb", "PBacCred", "PBacBal"];
            const mapScoDet = ["Fuente", "ScoFPago", "Moneda", "Transaccion", "Razon_Social", "MerID", "Nombre", "Fecha_Lote_Ajuste", "Lote", "ScoTerm", "Numero_Pago", "ScoAuth", "ScoTarj", "Monto_Orig", "ScoBruto", "ScoCom", "Porc_Comision_Total", "Monto_Comision_Int", "Porc_Comision_Int", "RetencionIVA", "Porc_Retencion_IVA", "RetencionISR", "ScoNeto", "Estatus"];
            const mapScoPag = ["PScoRef", "PScoF", "PScoDesc", "PScoM", "PScoSal", "PScoCD"];

            const buildRow = (dbRow, mapDict) => {
                let obj = {};
                mapDict.forEach((dbKey, idx) => { obj[String(idx)] = dbRow[dbKey] || ''; });
                return obj;
            };

            let counts = { bac: 0, scotia: 0 };
            
            json.data.forEach(r => {
                const historyClass = "bg-amber-50 dark:bg-amber-900/20 border-l-[4px] border-l-amber-500 font-medium";
                let fechaCr = r.FechaTransaccion ? r.FechaTransaccion.split('-').reverse().join('/') : '';
                
                const baseObj = {
                    _uid: r.IdTransaccion,
                    _fecha: fechaCr,
                    _enabled: true,
                    _isHistorical: true, 
                    _isFromDB: true, // <--- Nueva Bandera de Protección
                    _rowClass: historyClass,
                    _sourceFile: "Arrastre BD " + (r.DiasAntiguedad ? `(${r.DiasAntiguedad} días)` : '(Pendiente)')
                };

                if (r.Origen === 'AJUSTE') {
                    baseObj._isAdjustment = true; baseObj._adjType = r.TipoAjuste;
                    baseObj._adjReason = r.Justificacion; baseObj._adjEvidence = r.EvidenciaB64;
                }

                if (r.Banco === 'BAC') {
                    counts.bac++;
                    if (r.Origen === 'DETALLADO' || r.Origen === 'AJUSTE') {
                        this.data.detalle.push({ ...baseObj, ...buildRow(r, mapBacDet),
                            _id: r.Afiliado_MerID, _liq: r.Liquidacion || r.Autorizacion,
                            _venta: parseFloat(r.MontoBruto || 0), _netoACI: parseFloat(r.MontoNeto || 0),
                            _comision: parseFloat(r.BacComision || 0), _retV: parseFloat(r.RetencionVentas || 0),
                            _retR: parseFloat(r.RetencionRenta || 0), _aciOrig: parseFloat(r.AjusteACI || 0),
                            "3": r.NOMBRECOMERCIO, "11": r.Autorizacion
                        });
                    } else if (r.Origen === 'PAGADO') {
                        this.data.pagado.push({ ...baseObj, ...buildRow(r, mapBacPag),
                            _extractedId: r.Afiliado_MerID, _liqRef: r.Autorizacion, _monto: parseFloat(r.MontoNeto || 0),
                            _desc: r.PBacDesc
                        });
                    }
                }
                // Aceptamos ambos nombres para compatibilidad retroactiva y nueva
                else if (r.Banco === 'SCOTIA' || r.Banco === 'DAVIBANK') {
                    counts.scotia++;
                    // Normalización de Moneda
                    const dbCurr = String(r.Moneda || 'COLON').toUpperCase().includes('DOLAR') ? 'USD' : 'CRC';
                        
                    if (r.Origen === 'DETALLADO' || r.Origen === 'AJUSTE') {
                        this.data.scotia_detalle.push({ ...baseObj, ...buildRow(r, mapScoDet),
                            _extractedId: r.Afiliado_MerID, // <--- CRÍTICO: Identidad para el cruce
                            _currency: dbCurr,             // <--- CRÍTICO: Moneda para el cruce
                            _bruto: parseFloat(r.MontoBruto || 0), _neto: parseFloat(r.MontoNeto || 0),
                            _mode: (r.Lote === 'AJUSTE' || r.Origen === 'AJUSTE') ? 'AJUSTE' : 'LOTE'
                        });
                    } else if (r.Origen === 'PAGADO') {
                        this.data.scotia_pagado.push({ ...baseObj, ...buildRow(r, mapScoPag),
                            _extractedId: r.Afiliado_MerID, 
                            _currency: dbCurr,
                            _monto: parseFloat(r.MontoNeto || 0),
                            _desc: r.PScoDesc
                        });
                    }
                }
            });
    
            if (counts.bac > 0) {
                this.data.files.bac_detalle = ["Saldos Históricos"]; this.updateFileList('bac_detalle');
                if(this.recalculateDetalle) this.recalculateDetalle();
            }
            if (counts.scotia > 0) {
                this.data.files.scotia_detalle = ["Saldos Históricos"]; this.updateFileList('scotia_detalle');
                if(this.updateScotiaCard) this.updateScotiaCard();
                if(this.runMatchScotiabank) this.runMatchScotiabank();
            }
        } catch (err) { console.error("Error cargando históricos:", err); }
    },

    // --- 3. PROCESAMIENTO DE ARCHIVOS ---
    setupUploads: function() {
        console.log("🔧 Configurando Delegación Global de Dropzones...");

        // Lista de IDs permitidos
        const zones = {
            'drop-bac-detalle': { input: 'file-bac-detalle', type: 'csv' },
            'drop-bac-pagado': { input: 'file-bac-pagado', type: 'excel' },
            'drop-scotia-detalle': { input: 'file-scotia-detalle', type: 'scotia_detalle' },
            'drop-scotia-pagado': { input: 'file-scotia-pagado', type: 'scotia_pagado' }
        };

        // 1. CLICK DELEGADO (Atrapa clicks en cualquier parte del documento)
        document.body.addEventListener('click', (e) => {
            // Buscamos si el clic fue dentro de un dropzone conocido
            const drop = e.target.closest('[id^="drop-"]'); 
            if (drop && zones[drop.id]) {
                const config = zones[drop.id];
                const input = document.getElementById(config.input);
                
                // Evitar loop infinito si el click fue en el input mismo
                if (e.target !== input && input) {
                    console.log(`🖱️ Click delegado detectado en: ${drop.id}`);
                    input.click();
                }
            }
        });

        // 2. CHANGE DELEGADO (Detectar cuando el usuario eligió archivo)
        document.body.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'file') {
                const dropId = Object.keys(zones).find(k => zones[k].input === e.target.id);
                if (dropId) {
                    const config = zones[dropId];
                    // NUEVO: Iterar sobre todos los archivos seleccionados
                    if(e.target.files.length > 0) {
                        Array.from(e.target.files).forEach(file => {
                            this.handleFileProcessing(file, dropId, config.type);
                        });
                        e.target.value = ''; // Reset
                    }
                }
            }
        });

        // 3. DRAG & DROP DELEGADO
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, (e) => {
                const drop = e.target.closest('[id^="drop-"]');
                if (!drop || !zones[drop.id]) return;

                e.preventDefault();
                e.stopPropagation();

                if (eventName === 'drop') {
                    const config = zones[drop.id];
                    // NUEVO: Iterar sobre todos los archivos arrastrados a la vez
                    if(e.dataTransfer.files.length > 0) {
                        Array.from(e.dataTransfer.files).forEach(file => {
                            this.handleFileProcessing(file, drop.id, config.type);
                        });
                    }
                    drop.classList.remove('bg-slate-100');
                }
            }, false);
        });
    },

    // Nueva función auxiliar para procesar (separada de la configuración)
    handleFileProcessing: function(file, dropId, type) {
        console.log(`⚙️ Procesando: ${file.name} (${type})`);
        
        const statusId = dropId.replace('drop-', 'status-');
        const statusEl = document.getElementById(statusId);
        
        // 1. Mostrar estado "Procesando" inmediatamente
        if(statusEl) {
            // Si ya hay contenido (lista de archivos), no lo borramos, solo mostramos carga
            if(!statusEl.innerHTML.includes('svg')) {
                statusEl.innerText = "Procesando...";
            }
            statusEl.classList.remove('hidden');
            statusEl.classList.remove('text-red-500'); 
            statusEl.classList.add('text-blue-500', 'animate-pulse'); 
        }

        const reader = new FileReader();
        
        // CRÍTICO: Asegurarse de recibir (e) aquí
        reader.onload = async (e) => {
            try {
                // DETECCIÓN DE FORMATO (Ahora con Await estricto)
                if(type === 'csv') {
                    await this.processCSV(e.target.result, file.name);
                } 
                else if(type === 'scotia_detalle') {
                    await this.processScotiabankDetalle(e.target.result, file.name);
                } 
                else if(type === 'scotia_pagado') {
                    await this.processScotiabankPagado(e.target.result, file.name);
                } 
                else if(type === 'tsd') {
                    await this.processTSD(e.target.result);
                } 
                else {
                    await this.processExcel(e.target.result, file.name);
                }
                
                // 2. Éxito: Quitar animación de carga del status
                if(statusEl) {
                    statusEl.classList.remove('text-blue-500', 'animate-pulse');
                    statusEl.classList.add('text-green-600', 'font-bold');
                    // Nota: El texto exacto lo actualiza la función process... específica
                }
            } catch (err) {
                console.error(err);
                // Solo mostrar error visual si NO hay archivos cargados previamente
                // Si ya hay archivos, asumimos que el usuario quiere seguir viendo su lista
                if(statusEl && !statusEl.innerHTML.includes('svg')) {
                    statusEl.innerText = "Error lectura";
                    statusEl.classList.remove('text-blue-500', 'animate-pulse');
                    statusEl.classList.add('text-red-500');
                } else {
                    // Restaurar estado visual (volver a pintar la lista verde)
                    // Esto requiere volver a llamar a updateFileList desde el contexto adecuado, 
                    // pero como catch es genérico, simplemente quitamos la animación de carga.
                    if(statusEl) statusEl.classList.remove('animate-pulse');
                }
            }
        };
        
        // Leer según tipo
        if(type === 'csv') reader.readAsText(file, 'ISO-8859-1'); 
        else reader.readAsArrayBuffer(file);
    },

    // Función auxiliar para buscar en todas las columnas
    matchAny: function(data, filterParams) {
        // filterParams.value es lo que escribió el usuario
        const term = filterParams.value.toLowerCase();
        // Recorre todos los valores de la fila
        return Object.values(data).some(val => {
            return String(val).toLowerCase().includes(term);
        });
    },

    // --- POPUP CON MOTOR VANILLA GRID ---
    getPopupData: function(type) {
        let rawData = [];
        let headers = [];
        
        if (type === 'detalle') { rawData = this.data.detalle; headers = this.data.headers.detalle; }
        else if (type === 'pagado') { rawData = this.data.pagado; headers = this.data.headers.pagado; }
        else if (type === 'scotia_detalle') { rawData = this.data.scotia_detalle; headers = this.data.headers.scotia_detalle; }
        else if (type === 'scotia_pagado') { rawData = this.data.scotia_pagado; headers = this.data.headers.scotia_pagado; }

        if (!rawData || rawData.length === 0) return [];

        return rawData.map(row => {
            const obj = { ...row };
            
            Object.keys(obj).forEach(key => {
                // Ignorar llaves internas del sistema (_uid, _enabled, etc.)
                if (key.startsWith('_')) return;
                
                let val = obj[key];
                if (val === null || val === undefined || val === '') return;
                
                const headerName = headers[key] ? String(headers[key]).toUpperCase() : '';

                // 1. Limpieza de Fechas (Para mostrar formato CR: DD/MM/YYYY)
                if (headerName.includes('FECHA')) {
                    obj[key] = window.ConciliacionLogic.formatDateCR(val);
                }
                
                // 2. Limpieza Financiera Extrema (Para que el Grid pueda sumar sin fallar por comas)
                if (/MONTO|VENTA|COMISION|RETENCION|NETO|BRUTO|DEBITO|CREDITO|BALANCE|SALDO|AJUSTE/i.test(headerName)) {
                    if (typeof val === 'string') {
                        let clean = val.replace(/["'\s₡$]/g, '');
                        // Manejo avanzado de comas de miles y decimales
                        if (clean.includes(',') && clean.includes('.')) clean = clean.replace(/,/g, '');
                        else if (clean.includes(',')) clean = clean.replace(',', '.');
                        
                        const num = parseFloat(clean);
                        obj[key] = isNaN(num) ? val : num;
                    }
                }
            });
            return obj;
        });
    },

    openPopup: function(type) {
        // 1. Variables y Datos
        const isDet = type === 'detalle';
        const isScotia = type === 'scotia_detalle';
        
        let rawData;
        if (isDet) rawData = this.data.detalle;
        else if (isScotia) rawData = this.data.scotia_detalle;
        else if (type === 'scotia_pagado') rawData = this.data.scotia_pagado; 
        else rawData = this.data.pagado;
        
        if (!rawData || !rawData.length) return alert("Sin datos para mostrar");

        // 2. DECLARACIÓN (Aquí debe nacer la variable)
        let columns = []; 
        // BANDERILLA VISUAL REUTILIZABLE (Con botón inteligente de Acción para Scotia)
        const colEstado = { 
            title: isScotia ? "ESTADO / ACCIÓN" : "TIPO DATO", 
            field: "_isHistorical", 
            width: isScotia ? 130 : 100, 
            hozAlign: "center", 
            headerFilter: false, 
            formatter: (cell) => {
                const r = cell.getRow();
                let badge = r._isHistorical ? '<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded text-[9px] font-bold shadow-sm" title="Recuperado de la Base de Datos">⏳ HIST</span>' : '<span class="bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded text-[9px] font-bold shadow-sm" title="Recién subido">🆕 NUEVO</span>';
                
                // INYECCIÓN DE ACCIÓN DISCRETA: Convertir a Positivo (Solo Scotia Detalle)
                if (isScotia && r._neto < 0 && !r._signFlipped && !r._isHistorical) {
                    badge += ` <button onclick="event.stopPropagation(); window.flipSign('${r._uid}')" class="ml-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] shadow-sm transition-colors" title="Convertir a Positivo">🔄</button>`;
                } else if (isScotia && r._signFlipped) {
                    badge += ` <span class="ml-1 bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm" title="${r._flipReason}">🔄 POS</span>`;
                }
                return badge;
            }
        };

        if (isDet) {
            const realHeaders = this.data.headers && this.data.headers.detalle ? this.data.headers.detalle : [];
            
            columns = [
                { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                colEstado
            ];

            let aciAdded = false; // Bandera de control

            realHeaders.forEach((h, idx) => {
                const headerStr = String(h).trim();
                const upper = headerStr.toUpperCase();
                
                // REGLAS DE FORMATO:
                // 1. Liquidación -> TEXTO (Sin formatter)
                // 2. Montos (Neto, Bruto, Comision, Ajuste, Retencion) -> MONEDA
                
                const isLiq = upper.includes('LIQUIDACION') || upper.includes('REFERENCIA');
                // Regex para detectar campos monetarios
                const isMoney = !isLiq && /MONTO|NETO|BRUTO|COMISION|RETENCION|AJUSTE/i.test(upper);

                // Agregar columna original
                columns.push({
                    title: headerStr,
                    field: String(idx),
                    headerFilter: true,
                    width: isMoney ? 130 : 160,
                    // Si es dinero -> 'money'. Si es Liquidación -> undefined (texto plano)
                    formatter: isMoney ? "money" : undefined, 
                    hozAlign: isMoney ? "right" : "left",
                    cssClass: isMoney ? "font-mono" : ""
                });

                // INYECCIÓN AGRESIVA: Si dice "NETO", ponemos "Neto-ACI" al lado
                if (!aciAdded && upper.includes('NETO')) {
                    columns.push({
                        title: "Neto - ACI", 
                        field: "_netoACI", 
                        formatter: "money", 
                        hozAlign: "right",
                        width: 140,
                        headerFilter: true,
                        cssClass: "font-mono font-bold text-blue-700 bg-blue-50 border-l-2 border-blue-200" 
                    });
                    aciAdded = true;
                }
            });

            // FALLBACK: Si no encontró la palabra "NETO", agregar al final
            if (!aciAdded) {
                columns.push({
                    title: "Neto - ACI (Calc)", 
                    field: "_netoACI", 
                    formatter: "money", 
                    hozAlign: "right",
                    width: 140,
                    cssClass: "font-bold text-blue-700 bg-blue-50"
                });
            }
        } else if (isScotia) {
             const realHeaders = this.data.headers.scotia_detalle || [];
             columns = [
                 { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                 colEstado, // <-- Banderilla inyectada
                 // CORRECCIÓN CRÍTICA: Usamos 'idx' como field
                 ...realHeaders.map((h, idx) => ({
                     title: h, 
                     field: String(idx), 
                     headerFilter: true,
                     width: 130,
                     formatter: (h.includes('Monto') || h.includes('%')) ? 'money' : undefined,
                     hozAlign: (h.includes('Monto') || h.includes('%')) ? 'right' : 'left'
                 }))
             ];
        } else if (type === 'scotia_pagado') {
             const realHeaders = this.data.headers.scotia_pagado || []; 
             columns = [
                 { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                 colEstado, // <-- Banderilla inyectada
                 { title: "ID Extraído", field: "_extractedId", headerFilter: true, width: 120, cssClass:"bg-blue-50 font-bold text-xs" },
                 
                 // CORRECCIÓN VISUAL: Usamos String(idx) para encontrar los datos
                 ...realHeaders.map((h, idx) => ({
                     title: h, 
                     field: String(idx), 
                     headerFilter: true,
                     formatter: (h.toLowerCase().includes('monto')) ? 'money' : undefined,
                     hozAlign: (h.toLowerCase().includes('monto')) ? 'right' : 'left'
                 }))
             ];

        } else {
            // EXCEL GENÉRICO (BAC PAGADO): Usar headers reales si existen
            const realHeaders = this.data.headers.pagado || [];
            
            if (realHeaders.length > 0) {
                 columns = [
                    { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false }
                ];
                
                // Mapeo defensivo
                realHeaders.forEach((h, idx) => {
                    if (h && String(h).trim() !== '') {
                        columns.push({
                            title: h, 
                            field: String(idx), // Índice real
                            headerFilter: true,
                            formatter: (String(h).toLowerCase().match(/monto|crédito|débito|saldo|importe/)) ? 'money' : undefined,
                            hozAlign: (String(h).toLowerCase().match(/monto|crédito|débito|saldo|importe/)) ? 'right' : 'left'
                        });
                    }
                });

            } else {
                // Fallback (solo si algo falla en la carga de headers)
                const rawCols = Object.keys(rawData[0]).filter(k => !k.startsWith('_'));
                columns = [
                    { title: "USAR", field: "_enabled", formatter: "checkbox", hozAlign: "center", width: 60, headerFilter: false },
                    ...rawCols.map(k => ({ title: k, field: k, headerFilter: true }))
                ];
            }
        }

        const w = 1200, h = 800;
        const left = (screen.width - w) / 2;
        const top = (screen.height - h) / 2;
        const win = window.open("", "_blank", `width=${w},height=${h},top=${top},left=${left}`);
        if(!win) return alert("Ventana bloqueada.");

        const isDark = document.documentElement.classList.contains('dark');
        const bg = isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800';
        
        // Estilos Adaptables
        const headerClass = isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-100 text-blue-700';
        const cardClass = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300';
        const inputClass = isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-800';

        win.document.write(`
            <!DOCTYPE html>
            <html lang="es" class="${isDark ? 'dark' : ''}">
            <head>
                <meta charset="UTF-8">
                <title>Detalle - ANC Finanzas</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <script>
                    tailwind.config = { 
                        darkMode: 'class',
                        theme: {
                            extend: {
                                animation: { 'fade-in-up': 'fadeInUp 0.4s ease-out forwards' },
                                keyframes: { fadeInUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } }
                            }
                        }
                    }
                </script>
                <script src="/js/vanilla_grid.js"></script>
                <style>
                    ::-webkit-scrollbar { width: 10px; height: 10px; }
                    ::-webkit-scrollbar-track { background: transparent; }
                    ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 5px; border: 2px solid #f8fafc; }
                    ::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
                    .dark ::-webkit-scrollbar-thumb { background-color: #475569; border-color: #0f172a; }
                    body { font-family: ui-sans-serif, system-ui, sans-serif; }
                </style>
            </head>
            <!-- Se quitó el p-4 del body. Ahora el body es un contenedor 100% puro -->
            <body class="bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 h-screen overflow-hidden flex flex-col m-0 p-0 select-none animate-fade-in-up">
                
                <!-- HEADER (Tamaño Fijo) -->
                <div class="flex justify-between items-center px-4 pt-4 pb-2 gap-4 shrink-0">
                    <div class="flex items-center gap-4">
                        <div>
                            <h1 class="text-xl font-bold flex items-center gap-2">
                                ${isDet ? '<span class="text-red-600">📄</span> Detalle (CSV)' : '<span class="text-green-600">📊</span> Pagado (Excel)'}
                            </h1>
                        </div>
                    </div>

                    <div class="flex-grow max-w-md relative">
                        <div class="absolute inset-y-0 left-0 flex items-center justify-center w-10 pointer-events-none">
                            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input type="text" id="popup-search" 
                            class="block w-full p-2 pl-10 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white" 
                            placeholder="Buscar en esta tabla">
                    </div>

                    <button onclick="window.close()" class="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded text-sm font-bold transition-colors whitespace-nowrap shadow-sm">
                        Cerrar Ventana
                    </button>
                </div>

                <!-- CONTENEDOR GRID (El Truco: flex-grow + relative + min-h-0) -->
                <div class="flex-grow relative min-h-0">
                    <div id="popup-grid" class="absolute top-0 left-4 right-4 bottom-4 shadow-lg rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 flex flex-col"></div>
                </div>

                <!-- BARRA ESTADÍSTICAS (Tamaño Fijo Inferior) -->
                <div id="global-table-stats" class="shrink-0 w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 py-1.5 px-4 flex justify-end items-center gap-6 text-xs font-mono hidden z-50">
                    <div class="text-slate-500">SELECCIÓN:</div>
                    <div class="flex gap-2"><span class="text-slate-500">CNT:</span><span id="gst-count" class="font-bold">0</span></div>
                    <div class="flex gap-2"><span class="text-slate-500">SUM:</span><span id="gst-sum" class="font-bold">0</span></div>
                </div>

                <script>
                    window.onload = function() {
                        if(window.opener && window.opener.ConciliacionLogic) {
                            const data = window.opener.ConciliacionLogic.getPopupData('${type}');
                            const columns = ${JSON.stringify(columns)};
                            
                            setTimeout(() => {
                                window.vGrid = new VanillaGrid("#popup-grid", data, columns, { 
                                    threshold: 0,
                                    resize: false, 
                                    searchInputId: "popup-search", 
                                    autoFocusSearch: true,         
                                    onCheckboxChange: (row, field, val) => {
                                        if(window.opener && window.opener.ConciliacionLogic) {
                                            window.opener.ConciliacionLogic.updateAll();
                                        }
                                    }
                                });
                            }, 50); 

                            // --- ACCIÓN GLOBAL PARA CAMBIAR SIGNO ---
                            window.flipSign = async function(uid) {
                                const html = \`
                                    <div class="mb-3 text-sm text-slate-600 dark:text-slate-300">Seleccione la justificación para convertir todos los montos de esta fila a positivo:</div>
                                    <select id="flip-reason" class="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-bold cursor-pointer">
                                        <option value="Contracargos positivos">Contracargos positivos</option>
                                        <option value="Devoluciones positivas">Devoluciones positivas</option>
                                    </select>
                                \`;
                                
                                // Usamos el SysUI del PopUp
                                const choice = await window.SysUI._createModal("Invertir Signo a Positivo", html, [
                                    {text: 'Cancelar', value: null, class: 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 font-bold transition-colors'},
                                    {text: 'Aplicar Cambio', value: 'apply', class: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors'}
                                ], "info");

                                if (choice === 'apply') {
                                    const reason = document.getElementById('flip-reason').value;
                                    if (window.opener && window.opener.ConciliacionLogic && window.opener.ConciliacionLogic.flipScotiaSign) {
                                        const success = window.opener.ConciliacionLogic.flipScotiaSign(uid, reason);
                                        if (success) {
                                            // Actualizar tabla del popup en tiempo real sin recargar la ventana
                                            const newData = window.opener.ConciliacionLogic.getPopupData('${type}');
                                            if (window.vGrid) window.vGrid.updateData(newData);
                                        }
                                    }
                                }
                            };

                        } else {
                            document.body.innerHTML = '<div class="p-10 text-red-500 font-bold">Error: Conexión perdida con la ventana principal.</div>';
                        }
                    };
                </script>
            </body>
            </html>
        `);
        win.document.close();
    },

    // Formateador de fechas a estándar CR (DD/MM/YYYY)
    formatDateCR: function(val) {
        if (!val) return "";
        let str = String(val).trim().split(' ')[0]; // Quitar horas si existen

        // 1. Si es número de serie de Excel (ej: 45310 -> 18/01/2026)
        if (!isNaN(str) && Number(str) > 10000 && Number(str) < 99999) {
            const date = new Date((Number(str) - 25569) * 86400 * 1000);
            const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
            const d = String(utcDate.getDate()).padStart(2, '0');
            const m = String(utcDate.getMonth() + 1).padStart(2, '0');
            return `${d}/${m}/${utcDate.getFullYear()}`;
        }

        // 2. Si ya trae separadores (CSV)
        if (str.includes('/') || str.includes('-')) {
            const parts = str.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) { // YYYY-MM-DD
                    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
                } else if (parts[2].length === 4) { // DD/MM/YYYY o MM/DD/YYYY
                    let d = parseInt(parts[0]);
                    let m = parseInt(parts[1]);
                    if (m > 12) { let temp = d; d = m; m = temp; } 
                    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${parts[2]}`;
                }
            }
        }

        // 3. Cadenas numéricas pegadas
        if (str.length === 8 && !isNaN(str)) {
             if (str.startsWith('20')) return `${str.substring(6,8)}/${str.substring(4,6)}/${str.substring(0,4)}`;
             else return `${str.substring(0,2)}/${str.substring(2,4)}/${str.substring(4,8)}`;
        }

        return str;
    },

    formatMoney: function(val) { 
        // Forzamos formato CR: ₡ 1 000,00
        // Intl 'es-CR' a veces usa punto para miles. Lo corregimos manualmente.
        let fmt = new Intl.NumberFormat('es-CR', {
            style: 'currency', 
            currency: 'CRC',
            minimumFractionDigits: 2
        }).format(val);
        
        // Si el sistema generó puntos para miles (ej: 1.000,00), los cambiamos por espacio
        if (fmt.includes('.') && fmt.includes(',')) {
            fmt = fmt.replace(/\./g, ' ');
        }
        return fmt;
    },
    moneyFormatter: function(cell) { return window.ConciliacionLogic.formatMoney(cell.getValue()); },
    diffFormatter: function(cell) {
        const val = cell.getValue();
        const el = cell.getElement();
        
        // Leer dinámicamente el input del DOM
        const thresholdInput = document.getElementById('threshold-input');
        const threshold = thresholdInput ? parseFloat(thresholdInput.value) : 2000;

        // Reset estilos previos
        el.style.color = ""; el.style.backgroundColor = "";

        if(Math.abs(val) > threshold) { 
            // Rojo Alerta
            el.style.color = "#dc2626"; 
            el.style.fontWeight = "bold"; 
            el.style.backgroundColor = "rgba(220, 38, 38, 0.1)"; 
        }
        else if (val === 0) { 
            // Verde Perfecto
            el.style.color = "#16a34a"; 
            el.style.fontWeight = "bold"; 
        }
        return window.ConciliacionLogic.formatMoney(val);
    },
    exportResults: function() { if(this.table) this.table.download("xlsx", "Conciliacion.xlsx"); },

    // Actualiza el umbral en el grid específico
    updateThreshold: function(val, bank) {
        const num = (val === '' || val === null) ? 0 : parseFloat(val);
        
        if (bank === 'bac' && this.grids.bac) {
            this.grids.bac.updateOption('threshold', num);
        } else if (bank === 'scotia' && this.grids.scotia) {
            this.grids.scotia.updateOption('threshold', num);
        } else {
            // Fallback (actualizar ambos si no se especifica)
            if (this.grids.bac) this.grids.bac.updateOption('threshold', num);
            if (this.grids.scotia) this.grids.scotia.updateOption('threshold', num);
        }
    },

    // Retorna un Set con todos los IDs normalizados de los bancos
    getBankAuths: function() {
        const auths = new Set();
        
        // BAC Detalle (Columna Referencia/Auth)
        if(this.data.detalle) {
            // Asumimos que la col 11 (o busca 'autoriza') es la clave
            const h = this.data.headers.detalle || [];
            const idx = h.findIndex(s => s && s.toLowerCase().includes('autoriza')) || 11;
            this.data.detalle.forEach(r => {
                if(r._enabled && r[idx]) auths.add(String(r[idx]).trim().replace(/[^a-zA-Z0-9]/g, ''));
            });
        }

        // Scotia Detalle
        if(this.data.scotia_detalle) {
            const h = this.data.headers.scotia_detalle || [];
            const idx = h.findIndex(s => s && s.toLowerCase().includes('autoriza'));
            this.data.scotia_detalle.forEach(r => {
                if(r._enabled) {
                    const val = r[String(idx)];
                    if(val) auths.add(String(val).trim().replace(/[^a-zA-Z0-9]/g, ''));
                }
            });
        }
        return auths;
    },

    // ORQUESTADOR MAESTRO DE ACTUALIZACIÓN
    updateAll: function() {
        console.log("🔄 Recalculando Sistema Completo...");

        // 1. Recalcular Bancos (Actualiza sus tablas y sus totales en memoria)
        // Nota: Estas funciones ya actualizan sus propias tarjetas y grids
        if(typeof this.recalculateDetalle === 'function') this.recalculateDetalle(); // BAC Detalle -> Tabla BAC
        if(typeof this.recalculateBACPagado === 'function') this.recalculateBACPagado(); // BAC Pagado -> Tabla BAC
        
        this.updateScotiaCard(); // Scotia Detalle (Tarjeta)
        this.recalculateScotiaPagado(); // Scotia Pagado (Tarjeta) -> Tabla Scotia (runMatchScotiabank)

    },

    // ==========================================================
    // MÓDULO DE PERSISTENCIA (GUARDADO INDEPENDIENTE)
    // ==========================================================
    // ESCUDO ANTI-DUPLICADOS (CON INDEXACIÓN DE GEMELOS)
    filterDuplicates: async function(rows, banco, origen) {
        if(rows.length === 0) return rows;

        const toast = document.createElement('div');
        toast.id = 'dup-toast';
        toast.className = 'fixed top-4 right-4 bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg shadow-xl z-[99999] text-xs font-bold flex items-center gap-3 animate-fade-in-up';
        toast.innerHTML = '<svg class="animate-spin text-blue-500 w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Validando Base de Datos...';
        document.body.appendChild(toast);

        // Rastreador de gemelos
        const hashCounts = {};

        try {
            const hashStrs = rows.map(r => {
                const rec = this.formatTransactionRecord(r, banco, origen, 'PENDIENTE', null);
                // Si la fila es idéntica a otra, le sumamos 1 al contador
                hashCounts[rec.HashString] = (hashCounts[rec.HashString] || 0) + 1;
                // Devolvemos el Hash con el índice (Ej: BAC|...|2500|-1)
                return rec.HashString + "-" + hashCounts[rec.HashString];
            });

            const res = await fetch('api/check_duplicates.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashes: hashStrs })
            });

            const data = await res.json();
            
            if (data.success && data.duplicados.length > 0) {
                const dupSet = new Set(data.duplicados);
                // Comparamos usando el hash indexado
                const filteredRows = rows.filter((r, i) => !dupSet.has(hashStrs[i]));
                const omitidos = rows.length - filteredRows.length; 

                if (filteredRows.length === 0) {
                    window.SysUI.alert(`El archivo completo ha sido rechazado.\n\nLas ${omitidos} transacciones ya fueron guardadas previamente en la Base de Datos.`, "Archivo Ya Procesado", "warning");
                } else {
                    window.SysUI.alert(`Se omitieron <b>${omitidos}</b> transacciones duplicadas (ya procesadas).\n\nSe cargarán <b>${filteredRows.length}</b> registros nuevos.`, "Limpieza de Duplicados", "info");
                }

                toast.remove();
                return filteredRows;
            }
        } catch(e) { console.error("Error validando duplicados:", e); }

        toast.remove();
        return rows; // Retornamos TODOS los datos si están limpios
    },

    // PREPARAR EL PAQUETE DE DATOS
    preparePayload: function(bancoObjetivo) {
        const payload = {
            transacciones: []
        };
        const processedUids = new Set();
        // Rastreador global de Hashes para el Guardado
        const payloadHashCounts = {};

        const processGroup = (group, banco) => {
            const diff = group.diferencia_val !== undefined ? group.diferencia_val : group.diff;
            const isMatch = Math.abs(diff) < 1 || group._isManual === true;
            const estado = isMatch ? 'CONCILIADO' : 'PENDIENTE';
            const idMatch = isMatch ? group.uuid : null; 

            (group.rowsDet || []).forEach(r => {
                if (processedUids.has(r._uid)) return;
                processedUids.add(r._uid);
                const rec = this.formatTransactionRecord(r, banco, 'DETALLADO', estado, idMatch);
                
                // Si es un dato nuevo (no viene de BD), le aplicamos la indexación de gemelos
                payloadHashCounts[rec.HashString] = (payloadHashCounts[rec.HashString] || 0) + 1;
                rec.HashString = rec.HashString + "-" + payloadHashCounts[rec.HashString];
                payload.transacciones.push(rec);
            });

            (group.rowsPag || []).forEach(r => {
                if (processedUids.has(r._uid)) return;
                processedUids.add(r._uid);
                const rec = this.formatTransactionRecord(r, banco, 'PAGADO', estado, idMatch);
                
                payloadHashCounts[rec.HashString] = (payloadHashCounts[rec.HashString] || 0) + 1;
                rec.HashString = rec.HashString + "-" + payloadHashCounts[rec.HashString];
                payload.transacciones.push(rec);
            });
        };

        if (bancoObjetivo === 'bac' && this.data.processed && this.data.processed.bac_matches) {
            Object.values(this.data.processed.bac_matches).forEach(g => processGroup(g, 'BAC'));
            if (this.deferredRows) {
                (this.deferredRows.det || []).forEach(r => {
                    if(!processedUids.has(r._uid)) { 
                        processedUids.add(r._uid); 
                        const rec = this.formatTransactionRecord(r, 'BAC', 'DETALLADO', 'PENDIENTE', null);
                        if (!rec.SourceHash) {
                            payloadHashCounts[rec.HashString] = (payloadHashCounts[rec.HashString] || 0) + 1;
                            rec.HashString = rec.HashString + "-" + payloadHashCounts[rec.HashString];
                        }
                        payload.transacciones.push(rec); 
                    }
                });
                (this.deferredRows.pag || []).forEach(r => {
                    if(!processedUids.has(r._uid)) { 
                        processedUids.add(r._uid); 
                        const rec = this.formatTransactionRecord(r, 'BAC', 'PAGADO', 'PENDIENTE', null);
                        if (!rec.SourceHash) {
                            payloadHashCounts[rec.HashString] = (payloadHashCounts[rec.HashString] || 0) + 1;
                            rec.HashString = rec.HashString + "-" + payloadHashCounts[rec.HashString];
                        }
                        payload.transacciones.push(rec); 
                    }
                });
            }
        }

        if (bancoObjetivo === 'scotia' && this.data.processed && this.data.processed.scotia_matches) {
            Object.values(this.data.processed.scotia_matches).forEach(g => processGroup(g, 'SCOTIA'));
        }

        return payload;
    },

    formatTransactionRecord: function(r, banco, defaultOrigen, estado, idMatch) {
        const isAjuste = r._isAdjustment === true;
        const origen = isAjuste ? 'AJUSTE' : defaultOrigen;

        let record = {
            IdTransaccion: r._uid, Banco: banco, Origen: origen, Estado: estado, IdMatch: idMatch,
            Afiliado_MerID: (r._extractedId || r._id || '').toString().trim() || null, 
            MontoBruto: r._venta || r._bruto || r._monto || 0,
            MontoNeto: r._netoACI !== undefined ? r._netoACI : (r._neto !== undefined ? r._neto : (r._monto || 0)),
            ArchivoOrigen: r._sourceFile || 'Sistema Local',
            TipoAjuste: r._adjType || null, Justificacion: r._adjReason || r._manualReason || null, EvidenciaB64: r._adjEvidence || null,
            IsFromDB: r._isFromDB || false // <--- Lo empaquetamos
        };

        // BLINDAJE DE FECHAS MAESTRAS
        if (r._fecha) {
            let d = String(r._fecha).trim().split(' ')[0]; 
            if (!isNaN(d) && Number(d) > 10000) d = this.formatDateCR(d);
            if (d.includes('/') || d.includes('-')) {
                let parts = d.split(/[\/-]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) record.FechaTransaccion = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
                    else {
                        let day = parseInt(parts[0]), month = parseInt(parts[1]);
                        if (month > 12) { let temp = day; day = month; month = temp; }
                        record.FechaTransaccion = `${parts[2]}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    }
                } else record.FechaTransaccion = null;
            } else record.FechaTransaccion = null;
        } else record.FechaTransaccion = null;

        // EXTRACCIÓN MASIVA 1 A 1
        const getV = (headerName, headersArr) => {
            if (!headersArr) return null;
            const idx = headersArr.findIndex(h => h && h.toLowerCase().includes(headerName.toLowerCase()));
            return idx !== -1 ? r[String(idx)] : null;
        };
        const cleanN = (v) => {
            if (v === null || v === undefined || v === '') return 0;
            if (typeof v === 'number') return v;
            let str = String(v).trim().replace(/['"\s₡$]/g, '');
            
            // Detección de formatos negativos contables: "-1500", "1500-", "(1500)"
            let isNegative = false;
            if (str.endsWith('-')) { isNegative = true; str = str.slice(0, -1); } 
            else if (str.startsWith('(') && str.endsWith(')')) { isNegative = true; str = str.slice(1, -1); } 
            else if (str.startsWith('-')) { isNegative = true; str = str.substring(1); }
            
            // Reparación de comas y puntos (Múltiples formatos)
            if (str.includes(',') && str.includes('.')) {
                str = str.replace(/,/g, ''); 
            } else if (str.includes(',')) {
                if ((str.match(/,/g) || []).length > 1) str = str.replace(/,/g, '');
                else str = str.replace(',', '.');
            }
            const dotParts = str.split('.');
            if (dotParts.length > 2) str = dotParts.slice(0, -1).join('') + '.' + dotParts.pop();

            const num = parseFloat(str);
            if (isNaN(num)) return 0;
            return isNegative ? -Math.abs(num) : Math.abs(num);
        };
        // NUEVO: Limpiador de Fechas Seriales de Excel
        const cleanD = (v) => v ? window.ConciliacionLogic.formatDateCR(v) : null;

        record.RawBAC = null; record.RawScotia = null; record.RawPagadoBAC = null; record.RawPagadoScotia = null;

        if (banco === 'BAC' && origen !== 'PAGADO') {
            const h = this.data.headers.detalle || [];
            
            // Rescate inteligente del nombre comercial desde el modal
            let comercioManual = '';
            if (isAjuste) {
                let idxComercio = Object.keys(h).find(k => h[k] && (h[k].toLowerCase().includes('comercio') || h[k].toLowerCase().includes('fantasia'))) || "3";
                comercioManual = r[idxComercio] || '';
            }

            record.RawBAC = {
                NUMERO_AFILIADO: getV('AFILIADO', h) || r._id,
                NOMBRECOMERCIO: getV('COMERCIO', h) || getV('FANTASIA', h) || comercioManual,
                FECHA_TRANSACCION: cleanD(getV('TRANSACCION', h) || r._fecha), // <-- Rescate de Fecha Modal
                FECHA_CIERRE_DATAFONO: cleanD(getV('CIERRE', h) || r._fecha),
                FECHA_PAGO: cleanD(getV('PAGO', h) || r._fechaPago || r._fecha), // <-- Rescate de Fecha Pago Modal
                NUMERO_DE_TARJETA: getV('TARJETA', h) || r._tarjeta, // <-- Rescate Tarjeta Modal
                AUTORIZACION: getV('AUTORIZA', h) || r._auth, // <-- Rescate Auth Modal
                TERMINAL: getV('TERMINAL', h),
                MONTO_VENTA: cleanN(getV('VENTA', h) || r._venta),
                COMISION: cleanN(getV('COMISION', h) || r._comision),
                RETENCION_VENTAS: cleanN(getV('RETENCION', h) || r._retV),
                RETENCION_RENTA: cleanN(getV('RENTA', h) || r._retR),
                MONTONETO: cleanN(getV('NETO', h) || r._neto),
                NUMERO_LIQUIDACION: getV('LIQUIDACION', h) || r._liq,
                NUMERO_CUENTA: getV('CUENTA', h),
                TIPO_CAMBIO: cleanN(getV('CAMBIO', h)),
                AJUSTE_COMISION_INTERNACIONAL: cleanN(getV('AJUSTE', h) || r._aciOrig),
                TIPO_TARJETA: getV('TIPO_TARJETA', h)
            };
        } 
        else if (banco === 'SCOTIA' && origen !== 'PAGADO') {
            const h = this.data.headers.scotia_detalle || [];
            
            let comercioManual = '';
            if (isAjuste) {
                let idxComercio = Object.keys(h).find(k => h[k] && (h[k].toLowerCase().includes('comercio') || h[k].toLowerCase().includes('fantasia') || h[k].toLowerCase().includes('raz'))) || "2";
                comercioManual = r[idxComercio] || '';
            }

            // EXTRACCIÓN PLANA
            let vOrig = cleanN(getV('Monto Orig', h) || r['Monto Orig']);
            let vBruto = cleanN(getV('Monto Bruto', h) || r._bruto);
            let vComTot = cleanN(getV('Monto Comisión Total', h) || getV('Monto Comision Total', h) || r._comision || r['Monto Comisión']);
            let vPComTot = cleanN(getV('% Comisión Total', h) || getV('% Comision Total', h) || r['% Comisión Total']);
            let vComInt = cleanN(getV('Comisión Int', h) || getV('Comision Int', h));
            let vPComInt = cleanN(getV('% Comisión Int', h) || getV('% Comision Int', h));
            let vRetIva = cleanN(getV('Retención IVA', h) || getV('Retencion IVA', h) || r._iva || r['Retención IVA']);
            let vPRetIva = cleanN(getV('% Retención IVA', h) || getV('% Retencion IVA', h) || r['% Retención IVA']);
            let vRetIsr = cleanN(getV('Retención IS', h) || getV('Retencion IS', h) || r._isr || r['Retención ISR']);
            let vNeto = cleanN(getV('Monto Neto', h) || r._neto);

            // BLINDAJE DE NEGATIVOS: Si es Ajuste, TODO se vuelve negativo
            let isAjusteRow = isAjuste || String(getV('Transacci', h) || r._mode || '').toUpperCase().includes('AJUSTE');
            
            if (isAjusteRow) {
                if (vOrig > 0) vOrig = -vOrig;
                if (vBruto > 0) vBruto = -vBruto;
                if (vComTot > 0) vComTot = -vComTot;
                if (vPComTot > 0) vPComTot = -vPComTot;
                if (vComInt > 0) vComInt = -vComInt;
                if (vPComInt > 0) vPComInt = -vPComInt;
                if (vRetIva > 0) vRetIva = -vRetIva;
                if (vPRetIva > 0) vPRetIva = -vPRetIva;
                if (vRetIsr > 0) vRetIsr = -vRetIsr;
                if (vNeto > 0) vNeto = -vNeto;
                
                // Forzar el tronco principal a negativo también
                if (record.MontoBruto > 0) record.MontoBruto = -record.MontoBruto;
                if (record.MontoNeto > 0) record.MontoNeto = -record.MontoNeto;
            }

            record.RawScotia = {
                Fuente: getV('Fuente', h),
                Fecha_Pago: cleanD(getV('Fecha Pago', h) || r._fechaPago || r._fecha), 
                Moneda: getV('Moneda', h),
                Transaccion: getV('Transacci', h),
                Razon_Social: getV('Razón', h) || getV('Razon', h),
                MerID: getV('MerID', h) || r._extractedId || r._id,
                Nombre: getV('Nombre', h) || r._desc || comercioManual,
                Fecha_Lote_Ajuste: cleanD(getV('Fecha Lote', h) || r._fecha), 
                Numero_Lote_Ajuste: getV('Número Lote', h) || getV('Numero Lote', h) || r._liq,
                Terminal: getV('Terminal', h),
                Numero_Pago: getV('Número Pago', h) || getV('Numero Pago', h) || getV('Pago', h),
                Numero_Autorizacion: getV('Autoriza', h) || r._auth, 
                Numero_Tarjeta: getV('Tarjeta', h) || r._tarjeta, 
                Monto_Orig: vOrig,
                Monto_Bruto: vBruto,
                Monto_Comision_Total: vComTot,
                Porc_Comision_Total: vPComTot,
                Monto_Comision_Int: vComInt,
                Porc_Comision_Int: vPComInt,
                Monto_Retencion_IVA: vRetIva,
                Porc_Retencion_IVA: vPRetIva,
                Monto_Retencion_ISR: vRetIsr,
                Monto_Neto: vNeto,
                Estatus: getV('Estatus', h)
            };
        }
        else if (banco === 'BAC' && origen === 'PAGADO') {
            const h = this.data.headers.pagado || [];
            record.RawPagadoBAC = {
                Fecha: cleanD(getV('Fecha', h) || r._fecha),
                Descripcion: getV('Descripci', h) || r._desc,
                Referencia: getV('Referencia', h) || r._liqRef,
                Codigo: getV('Código', h) || getV('Codigo', h) || r._codigo, 
                Debitos: cleanN(getV('Débito', h) || getV('Debito', h)) || cleanN(r._debito), 
                Creditos: cleanN(r._monto), 
                Balance: cleanN(getV('Saldo', h) || getV('Balance', h))
            };
        }
        else if (banco === 'SCOTIA' && origen === 'PAGADO') {
            const h = this.data.headers.scotia_pagado || [];
            record.RawPagadoScotia = {
                Numero_Referencia: getV('Referencia', h),
                Fecha_Movimiento: cleanD(getV('Fecha', h) || r._fecha),
                Descripcion: getV('Descripci', h) || r._desc,
                Monto: cleanN(getV('Monto', h)) || cleanN(r._monto),
                Saldo: cleanN(getV('Saldo', h)),
                Credito_Debito: getV('Crédito', h) || getV('Credito', h) || getV('Débito', h) || getV('Debito', h) || getV('Tipo', h)
            };
        }

        // --- ASIGNACIÓN FUERTE DE AUTORIZACIÓN Y TARJETA ---
        let auth = r._auth || null;
        let tarj = r._tarjeta || null;

        if (record.RawBAC) {
            auth = record.RawBAC.AUTORIZACION || auth;
            tarj = record.RawBAC.NUMERO_DE_TARJETA || tarj;
        } else if (record.RawScotia) {
            auth = record.RawScotia.Numero_Autorizacion || auth;
            tarj = record.RawScotia.Numero_Tarjeta || tarj;
        } else if (record.RawPagadoBAC) {
            auth = record.RawPagadoBAC.Referencia || r._liqRef || auth;
        } else if (record.RawPagadoScotia) {
            auth = record.RawPagadoScotia.Numero_Referencia || auth;
        }

        // Limpiar guiones o espacios de la tarjeta (Ej: 4532********1234)
        record.Autorizacion = auth ? String(auth).trim() : null;
        record.Tarjeta = tarj ? String(tarj).replace(/[\s-]/g, '').trim() : null;

        // CREACIÓN DEL SÚPER HASH BASADO EN DATOS ESTRICTOS
        let comercio = '', term = '', liq = '', saldo = '';
        
        if (record.RawBAC) {
            comercio = record.RawBAC.NOMBRECOMERCIO || ''; term = record.RawBAC.TERMINAL || ''; liq = record.RawBAC.NUMERO_LIQUIDACION || '';
        } else if (record.RawScotia) {
            comercio = record.RawScotia.Nombre || record.RawScotia.Razon_Social || ''; term = record.RawScotia.Terminal || ''; liq = record.RawScotia.Numero_Lote_Ajuste || record.RawScotia.Numero_Pago || '';
        } else if (record.RawPagadoBAC) {
            comercio = record.RawPagadoBAC.Descripcion || ''; liq = record.RawPagadoBAC.Referencia || record.RawPagadoBAC.Codigo || ''; saldo = record.RawPagadoBAC.Balance || '';
        } else if (record.RawPagadoScotia) {
            comercio = record.RawPagadoScotia.Descripcion || ''; liq = record.RawPagadoScotia.Numero_Referencia || ''; saldo = record.RawPagadoScotia.Saldo || '';
        }

        const cStr = (str) => String(str).trim().toUpperCase();
        record.HashString = `${record.Banco}|${record.Origen}|${record.FechaTransaccion || ''}|${cStr(comercio)}|${cStr(record.Afiliado_MerID || '')}|${cStr(term)}|${cStr(record.Autorizacion || '')}|${cStr(record.Tarjeta || '')}|${cStr(liq)}|${record.MontoBruto || 0}|${record.MontoNeto || 0}|${saldo}`;

        return record;
    },
  
    saveSnapshot: async function() {
        // 1. Apagar Auto-Save para evitar crear borradores zombis durante el proceso
        if (this._autoSaveInterval) clearInterval(this._autoSaveInterval);

        // 2. Extraer datos de ambos bancos de forma independiente
        const payloadBAC = this.preparePayload('bac');
        const payloadScotia = this.preparePayload('scotia');

        const stats = {
            bac: { conc: 0, pend: 0, money: 0, hasData: payloadBAC.transacciones.length > 0 },
            sco: { conc: 0, pend: 0, money: 0, hasData: payloadScotia.transacciones.length > 0 }
        };

        const countStats = (payloadArr, targetStat) => {
            payloadArr.forEach(t => {
                if (t.Origen === 'DETALLADO') {
                    if (t.Estado === 'CONCILIADO') {
                        targetStat.conc++;
                        targetStat.money += parseFloat(t.MontoNeto || 0);
                    } else {
                        targetStat.pend++;
                    }
                }
            });
        };

        if (stats.bac.hasData) countStats(payloadBAC.transacciones, stats.bac);
        if (stats.sco.hasData) countStats(payloadScotia.transacciones, stats.sco);

        if (!stats.bac.hasData && !stats.sco.hasData) {
            this.startAutoSave(); 
            return window.SysUI.alert("No hay datos procesados en memoria para guardar.", "Sin datos", "warning");
        }

        // 3. CONSTRUIR MODAL INTERACTIVO DE RESUMEN
        let html = `<div class="space-y-4 text-sm text-slate-700 dark:text-slate-300 select-none">
            <p>Seleccione los bancos que desea consolidar. Lo que <b>no seleccione</b> se guardará automáticamente como borrador.</p>
            <div class="space-y-3">`;

        if (stats.bac.hasData) {
            html += `
            <label class="flex items-start gap-3 p-3 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                <input type="checkbox" id="chk-save-bac" class="mt-1 w-4 h-4 accent-red-600" checked>
                <div class="flex-grow">
                    <strong class="text-red-600 dark:text-red-400 block mb-1">BAC Credomatic</strong>
                    <div class="flex justify-between text-xs mb-1"><span>Conciliados: <b class="text-green-600">${stats.bac.conc}</b></span><span>Pendientes: <b class="text-amber-600">${stats.bac.pend}</b></span></div>
                    <div class="text-xs border-t border-red-200 dark:border-red-900/30 mt-1 pt-1">Total a Conciliar: <b class="font-mono text-slate-800 dark:text-white">${this.formatMoney(stats.bac.money)}</b></div>
                </div>
            </label>`;
        }

        if (stats.sco.hasData) {
            html += `
            <label class="flex items-start gap-3 p-3 border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors shadow-sm">
                <input type="checkbox" id="chk-save-sco" class="mt-1 w-4 h-4 accent-blue-600" checked>
                <div class="flex-grow">
                    <strong class="text-blue-600 dark:text-blue-400 block mb-1">Davibank (Scotiabank)</strong>
                    <div class="flex justify-between text-xs mb-1"><span>Conciliados: <b class="text-green-600">${stats.sco.conc}</b></span><span>Pendientes: <b class="text-amber-600">${stats.sco.pend}</b></span></div>
                    <div class="text-xs border-t border-blue-200 dark:border-blue-900/30 mt-1 pt-1">Total a Conciliar: <b class="font-mono text-slate-800 dark:text-white">${this.formatMoney(stats.sco.money)}</b></div>
                </div>
            </label>`;
        }
        html += `</div></div>`;

        // 4. LECTURA DE DECISIÓN DEL USUARIO (Pre-Cierre del Modal)
        // Creamos variables para almacenar el estado EN TIEMPO REAL
        let saveBac = stats.bac.hasData; 
        let saveSco = stats.sco.hasData;

        // Inyectamos un pequeño script para que el Modal actualice estas variables al hacer clic
        setTimeout(() => {
            const cBac = document.getElementById('chk-save-bac');
            const cSco = document.getElementById('chk-save-sco');
            if (cBac) cBac.addEventListener('change', (e) => { saveBac = e.target.checked; });
            if (cSco) cSco.addEventListener('change', (e) => { saveSco = e.target.checked; });
        }, 100);

        const choice = await window.SysUI._createModal("Resumen de Cierre y Guardado", html, [
            {text: 'Volver', value: 'cancel', class: 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg text-slate-700 dark:text-slate-300 font-bold transition-colors'},
            {text: 'Confirmar y Guardar', value: 'save', class: 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors'}
        ], "info");

        if (choice !== 'save') {
            this.startAutoSave(); // Reactivar reloj
            return;
        }

        if (!saveBac && !saveSco) {
            this.startAutoSave();
            return window.SysUI.alert("Debe seleccionar al menos un banco para guardar.", "Aviso", "warning");
        }

        // 5. ENSAMBLAR PAYLOAD FINAL
        let finalPayload = {
            transacciones: [],
            total_conciliado: 0
        };

        if (saveBac) {
            finalPayload.transacciones.push(...payloadBAC.transacciones);
            finalPayload.total_conciliado += stats.bac.money;
        }
        if (saveSco) {
            finalPayload.transacciones.push(...payloadScotia.transacciones);
            finalPayload.total_conciliado += stats.sco.money;
        }

        // 6. MOSTRAR PANTALLA DE CARGA INBLOQUEABLE
        const loaderId = 'global-save-loader';
        let loader = document.getElementById(loaderId);
        
        // Si no existe, lo creamos
        if(!loader) {
            loader = document.createElement('div');
            loader.id = loaderId;
            loader.className = 'fixed inset-0 z-[999999] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white transition-opacity duration-300 opacity-0 select-none hidden';
            loader.innerHTML = `
                <div class="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 transform scale-95 transition-transform duration-300" id="loader-card">
                    <div class="relative w-16 h-16 mb-6">
                        <svg id="loader-spinner" class="animate-spin text-blue-500 w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono" id="loader-pct">0%</div>
                    </div>
                    <h3 class="text-lg font-bold mb-2 text-white">Guardando Transacciones...</h3>
                    <p class="text-slate-400 text-xs text-center mb-6 h-8" id="loader-text">Preparando paquete de datos...</p>
                    <div class="w-full bg-slate-900 rounded-full h-2 mb-1 overflow-hidden border border-slate-700 shadow-inner">
                        <div class="h-full rounded-full transition-all duration-300 ease-out w-0 bg-blue-500" id="loader-bar"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(loader);
        }

        // --- RESET FORZADO DE ESTILOS (Para el 2do guardado SPA) ---
        const elBar = document.getElementById('loader-bar');
        const elPct = document.getElementById('loader-pct');
        const elTxt = document.getElementById('loader-text');
        const spinner = document.getElementById('loader-spinner');
        
        elBar.className = "h-full rounded-full transition-all duration-300 ease-out bg-blue-500";
        elBar.style.width = '0%'; // Reset físico del inline style
        elPct.innerText = '0%';
        elTxt.innerText = "Preparando paquete de datos...";
        elTxt.className = "text-slate-400 text-xs text-center mb-6 h-8";
        spinner.className = "animate-spin text-blue-500 w-full h-full";

        // Lanzar animación de entrada
        requestAnimationFrame(() => {
            loader.classList.remove('hidden');
            // Un frame extra asegura que CSS procese el display block antes de animar opacity
            requestAnimationFrame(() => {
                loader.classList.remove('opacity-0');
                document.getElementById('loader-card').classList.remove('scale-95');
            });
        });

        let pct = 0;
        const progressInterval = setInterval(() => {
            if(pct < 95) {
                pct += Math.floor(Math.random() * 10) + 2;
                if(pct > 95) pct = 95; 
                elBar.style.width = pct + '%'; elPct.innerText = pct + '%';
                if(pct > 15) elTxt.innerText = "Transfiriendo paquete de datos seguro...";
                if(pct > 35) elTxt.innerText = "Consolidando registros y evaluando idempotencia...";
                if(pct > 60) elTxt.innerText = "Guardando información en la Base de Datos...";
                if(pct > 80) elTxt.innerText = "Verificando integridad de información...";
            }
        }, 300);

        try {
            // 7. ENVÍO AL SERVIDOR
            const res = await fetch('api/save_conciliacion.php', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalPayload)
            });

            clearInterval(progressInterval);
            
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Error desconocido devuelto por el servidor.");

            // Animación de Éxito
            elBar.style.width = '100%'; elPct.innerText = '100%';
            elBar.classList.replace('bg-blue-500', 'bg-green-500');
            spinner.classList.replace('text-blue-500', 'text-green-500');
            spinner.classList.remove('animate-spin');
            elTxt.innerText = "¡Verificación completa! Guardado exitoso.";
            elTxt.classList.replace('text-slate-400', 'text-green-400');
            
            await new Promise(r => setTimeout(r, 600));

            // 8. PURGA ABSOLUTA Y CREACIÓN DE BORRADOR LIMPIO (SI APLICA)
            const purge = (arr) => { if (Array.isArray(arr)) arr.length = 0; };
            
            if (saveBac && saveSco) {
                // Cierre total: liberar y BORRAR el borrador compartido en BD (los diferidos NO se tocan)
                await this._borradorApi('delete');
                this._dbDraftVersion = null;
            }
            else {
                // GUARDADO PARCIAL MUTANTE: Limpiar físicamente los arrays
                if (saveBac) {
                    purge(this.data.detalle); purge(this.data.pagado);
                    purge(this.data.files.bac_detalle); purge(this.data.files.bac_pagado);
                    purge(this.manualMatches); purge(this.deferredRows.det); purge(this.deferredRows.pag);
                    if (window.BACLogic) { purge(window.BACLogic.manualMatches); purge(window.BACLogic.deferredRows.det); purge(window.BACLogic.deferredRows.pag); }
                    delete this.data.processed.bac_matches;
                }
                if (saveSco) {
                    purge(this.data.scotia_detalle); purge(this.data.scotia_pagado);
                    purge(this.data.files.scotia_detalle); purge(this.data.files.scotia_pagado);
                    purge(this.manualMatchesScotia);
                    if (window.ScotiaLogic) purge(window.ScotiaLogic.manualMatchesScotia);
                    delete this.data.processed.scotia_matches;
                }
                await this.saveDraftToLocal('auto'); // persistir el residuo (diferidos/otro banco) en BD
            }
    
            // 9. LIMPIAR PANTALLA
            loader.classList.add('opacity-0');
            setTimeout(() => loader.classList.add('hidden'), 300);

            await window.SysUI.alert(`Transacciones guardadas: ${data.filas_insertadas}\nID de Cierre: #${data.id_cierre}`, `✅ Cierre Exitoso`, "success");
            
            // 10. RECARGA SPA (SOFT RESET INTELIGENTE SIN F5)
            this.resetState();
            
            // Traer primero los pendientes frescos (incluye lo recién guardado en BD)
            await this.loadPendientes();

            // Si fue guardado parcial, montar el residuo del borrador ENCIMA de lo pendiente
            if (!saveBac || !saveSco) {
                const full = await this._borradorApi('get');
                if (full && full.existe) {
                    this._dbDraftVersion = full.version;
                    this.restoreDraftFromLocal(JSON.parse(full.dataJson));
                }
            }
            this.startAutoSave();
            this.startHeartbeat();
    
        } catch (error) {
            clearInterval(progressInterval);
            loader.classList.add('opacity-0');
            setTimeout(() => loader.classList.add('hidden'), 300);
            
            const msgError = `Se ha producido un error crítico que ha interrumpido el guardado. La Base de Datos ha revertido los cambios por seguridad (ROLLBACK).\n\n` + 
                             `<b>Detalle Técnico:</b>\n<span class="font-mono text-[10px] text-red-500">${error.message}</span>\n\n` +
                             `Por favor, intente nuevamente o contacte al departamento de soporte:\n<a href="mailto:soporte@grupoanc.com" class="text-blue-500 underline font-bold">soporte@grupoanc.com</a>`;
                             
            window.SysUI.alert(msgError, "Error Crítico del Servidor", "error");
            this.startAutoSave(); 
        }
    },

    // ==========================================================
    // GESTOR DE ARCHIVOS Y ELIMINACIÓN SEGURA
    // ==========================================================
    manageFiles: function(type) {
        const files = this.data.files[type];
        if(!files || files.length === 0) return;
        
        let title = type.includes('bac') ? 'BAC Credomatic' : 'Davibank';
        let sub = type.includes('detalle') ? 'Detallado (Ventas)' : 'Pagado (Banco)';

        let html = '<div class="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-2 mt-2">';
        files.forEach(f => {
            html += `
            <div class="flex justify-between items-center bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-2.5 rounded-lg shadow-sm hover:border-red-300 dark:hover:border-red-800 transition-colors">
                <span class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate w-3/4" title="${f}">${f}</span>
                <button onclick="window.ConciliacionLogic.removeFileGlobal('${type}', '${f}')" class="text-red-500 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-2 py-1 rounded transition-colors text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Excluir
                </button>
            </div>`;
        });
        html += '</div>';

        window.SysUI._createModal(`Gestor de Archivos: ${title} - ${sub}`, html, [{text: 'Cerrar Gestor', value: true, class: 'bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors'}], "info");
    },

    removeFileGlobal: async function(type, filename) {
        // 1. Cerrar el gestor de archivos abierto (haciendo clic dinámicamente en su botón de cerrar)
        const closeBtn = document.getElementById('sysui-btn-0');
        if (closeBtn) closeBtn.click();

        // 2. Confirmación Crítica
        if(!(await window.SysUI.confirm(`Se eliminarán permanentemente todas las transacciones pertenecientes a:\n\n📄 "${filename}"\n\n¿Desea continuar y recalcular los saldos?`, "Confirmar Exclusión", "warning"))) {
            // Si cancela, reabrir el gestor
            setTimeout(() => this.manageFiles(type), 350);
            return;
        }

        // 3. Ejecutar eliminación según el módulo (Las funciones internas ya no tendrán alerts)
        if(type === 'bac_detalle') await this.removeFileDetalle(filename);
        else if(type === 'bac_pagado') await this.removeFilePagado(filename);
        else if(type === 'scotia_detalle') await this.removeFileScotiaDetalle(filename);
        else if(type === 'scotia_pagado') await this.removeFileScotiaPagado(filename);

        // 4. Guardar inmediatamente el borrador en la DB del navegador para sincronizar memoria caché
        this.saveDraftToLocal(true);
        
        await window.SysUI.alert(`El archivo ha sido excluido y los totales han sido recalculados exitosamente.`, "Archivo Eliminado", "success");
    },

    // =========================================================================
    // DICCIONARIO MAESTRO: MANTENIMIENTO DE CENTROS DE COSTO
    // =========================================================================
    
    gridDicc: null,
    rawDiccData: [],

    openDiccionario: function() {
        const modal = document.getElementById('modal-diccionario');
        const card = document.getElementById('modal-dicc-card');
        
        modal.classList.remove('hidden');
        // Pequeño retardo para que la animación CSS se ejecute
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            card.classList.remove('scale-95');
        }, 10);
        
        document.getElementById('form-dicc').reset();
        this.loadDiccionario();
    },

    closeDiccionario: function() {
        const modal = document.getElementById('modal-diccionario');
        const card = document.getElementById('modal-dicc-card');
        
        modal.classList.add('opacity-0');
        card.classList.add('scale-95');
        
        setTimeout(() => { modal.classList.add('hidden'); }, 300);
    },

    loadDiccionario: async function() {
        try {
            const res = await fetch('api/mantenimiento_cc.php');
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            
            this.rawDiccData = json.data;
            this.renderDiccGrid();

        } catch (error) {
            window.SysUI.alert("Error al cargar diccionario: " + error.message, "Fallo", "error");
        }
    },

    renderDiccGrid: function() {
        const hideInactive = document.getElementById('dicc-filter-active').checked;
        const displayData = hideInactive 
            ? this.rawDiccData.filter(r => parseInt(r.Activo) === 1) 
            : this.rawDiccData;

        const cols = [
            { 
                title: "Estado", field: "Activo", width: 70, hozAlign: "center",
                formatter: (cell) => {
                    const r = cell.getRow();
                    const act = parseInt(r.Activo) === 1;
                    return `<button onclick="window.ConciliacionFunctions.toggleDiccStatus('${r.Afiliado}', ${act ? 0 : 1})" class="px-2 py-0.5 rounded text-[9px] font-bold ${act ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'} transition-colors cursor-pointer" title="Clic para cambiar estado">${act ? 'ACTIVO' : 'INACTIVO'}</button>`;
                }
            },
            { 
                title: "Afiliado", field: "Afiliado", width: 110, headerFilter: true,
                formatter: (cell) => `<span class="font-mono font-bold text-indigo-700 dark:text-indigo-400 cursor-pointer hover:underline" onclick="window.ConciliacionFunctions.editDiccRow('${cell.getValue()}')">${cell.getValue()}</span>`
            },
            { title: "Banco", field: "Banco", width: 80, cssClass: "text-[10px]" },
            { title: "C.Costo", field: "CentroCosto", width: 90, headerFilter: true, cssClass: "font-mono font-bold" },
            { title: "Sucursal", field: "NombreSucursal", headerFilter: true, cssClass: "text-[10px] truncate" }
        ];

        if (this.gridDicc) {
            this.gridDicc.updateData(displayData);
        } else {
            this.gridDicc = new VanillaGrid("#grid-diccionario", displayData, cols, { searchInputId: "search-dicc" });
        }
    },

    editDiccRow: function(afiliado) {
        const row = this.rawDiccData.find(r => r.Afiliado === afiliado);
        if(!row) return;

        document.getElementById('dicc-afil').value = row.Afiliado;
        document.getElementById('dicc-cc').value = row.CentroCosto;
        document.getElementById('dicc-banco').value = row.Banco;
        document.getElementById('dicc-cod').value = row.CodigoSucursal;
        document.getElementById('dicc-nom').value = row.NombreSucursal;
    },

    saveDiccionario: async function(e) {
        e.preventDefault();
        
        const btn = document.getElementById('dicc-btn-save');
        const oHtml = btn.innerHTML;
        btn.innerHTML = 'Guardando...'; btn.disabled = true;

        const payload = {
            Afiliado: document.getElementById('dicc-afil').value,
            CentroCosto: document.getElementById('dicc-cc').value,
            Banco: document.getElementById('dicc-banco').value,
            CodigoSucursal: document.getElementById('dicc-cod').value,
            NombreSucursal: document.getElementById('dicc-nom').value
        };

        try {
            const res = await fetch('api/mantenimiento_cc.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if(!data.success) throw new Error(data.error);

            // Reseteo visual y recarga
            document.getElementById('form-dicc').reset();
            window.SysUI.alert(data.message, "Guardado Exitoso", "success");
            this.loadDiccionario();

        } catch (error) {
            window.SysUI.alert(error.message, "Error al guardar", "error");
        } finally {
            btn.innerHTML = oHtml; btn.disabled = false;
        }
    },

    toggleDiccStatus: async function(afiliado, nuevoEstado) {
        const accion = nuevoEstado === 1 ? 'Activar' : 'Desactivar';
        if(!confirm(`¿Desea ${accion} el Afiliado ${afiliado}?`)) return;

        try {
            const res = await fetch('api/mantenimiento_cc.php', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Afiliado: afiliado, Activo: nuevoEstado })
            });
            const data = await res.json();
            if(!data.success) throw new Error(data.error);
            
            this.loadDiccionario(); // Recargar grilla
        } catch (error) {
            window.SysUI.alert(error.message, "Error", "error");
        }
    }
};

// 1. Inicializador (Punto de entrada desde el Router)
window.initConciliacion = function() { 
    // Usamos setTimeout para dar un respiro al renderizado del DOM
    setTimeout(() => {
        if(window.ConciliacionLogic) {
            window.ConciliacionLogic.init();
        }
    }, 100); 
};

// 2. Funciones Globales (Para onclicks en HTML)
window.ConciliacionFunctions = {
    openPopup: function(t) { window.ConciliacionLogic.openPopup(t); },
    switchTab: function(t) { window.ConciliacionLogic.switchTab(t); },
    updateThreshold: function(v, bank) { window.ConciliacionLogic.updateThreshold(v, bank); },
    exportToExcel: function() { alert("Exportar pendiente."); },
    saveSnapshot: function() { window.ConciliacionLogic.saveSnapshot(); },
    forceLocalSave: async function() {
        const L = window.ConciliacionLogic;
        if (!L) return;
        if (L._bloqueadoPorOtro) { window.SysUI && SysUI.alert("Otro usuario tiene el control de este cierre.", "No disponible", "warning"); return; }
        if (L._online === false) { window.SysUI && SysUI.alert("Sin conexión. No se puede guardar hasta restaurarla.", "Sin conexión", "warning"); return; }
        const btn = document.getElementById('btn-conservar-borrador');
        L._btnGuardando(btn);
        try {
            const r = await L.saveDraftToLocal('manual');
            if (r && r.ok === true) {
                L._btnGuardado(btn);
            } else {
                L._btnReset(btn);
                window.SysUI && SysUI.alert("No se pudo guardar el borrador." + (r && r.error ? "\n\n" + r.error : ""), "Error al guardar", "error");
            }
        } catch (e) {
            L._btnReset(btn);
            window.SysUI && SysUI.alert("Error al guardar el borrador:\n\n" + e.message, "Error al guardar", "error");
        }
    },

    // --- PUENTES DICCIONARIO ---
    openDiccionario: function() { window.ConciliacionLogic.openDiccionario(); },
    closeDiccionario: function() { window.ConciliacionLogic.closeDiccionario(); },
    loadDiccionario: function() { window.ConciliacionLogic.loadDiccionario(); },
    editDiccRow: function(afiliado) { window.ConciliacionLogic.editDiccRow(afiliado); },
    saveDiccionario: function(e) { window.ConciliacionLogic.saveDiccionario(e); },
    toggleDiccStatus: function(afiliado, nuevoEstado) { window.ConciliacionLogic.toggleDiccStatus(afiliado, nuevoEstado); }
};

// ==========================================================
// MOTOR DE ALMACENAMIENTO LOCAL MASIVO (INDEXED-DB)
// Soporta hasta 1GB de datos (Soluciona el QuotaExceededError de LocalStorage)
// ==========================================================
window.LocalDB = {
    dbName: "ANC_Finanzas_DB",
    storeName: "drafts",
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = event => reject("Error en IndexedDB");
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = event => resolve(event.target.result);
        });
    },
    save: async function(key, data) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            // El motor comprime y guarda el JSON de forma asíncrona sin congelar la pantalla
            store.put(JSON.stringify(data), key);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject("Error al guardar en DB Local");
        });
    },
    get: async function(key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ? JSON.parse(req.result) : null);
            req.onerror = () => reject("Error al leer DB Local");
        });
    },
    delete: async function(key) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            store.delete(key);
            tx.oncomplete = () => resolve(true);
        });
    }
};

