/* =====================================================================
 * BITÁCORA IRI — Login y Módulo 1 (Cierre de Caja)
 * ---------------------------------------------------------------------
 * Observa sin modificar el código existente:
 *   · envuelve fetch, loadView, SysUI y los métodos de CierreCajasLogic
 *   · escucha el DOM en fase de captura (clics, cambios, Enter, envíos)
 *   · registra errores, visibilidad de la pestaña y conexión
 * Envía por lotes cada 8 s y al salir de la página (sendBeacon).
 * Nunca registra contraseñas ni tokens. Si algo aquí falla, el sistema
 * sigue funcionando igual. Para apagarla: quitar su <script> de index.php.
 * ===================================================================== */
(function () {
    'use strict';
    if (window.Bitacora || typeof window.fetch !== 'function') return;

    const ENDPOINT = 'api/bitacora.php';
    const VISTAS = { login_view: 'LOGIN', cierre_cajas: 'CIERRE_CAJA' };
    const SENSIBLE = /pass|clave|contra|token|secret|authorization|cookie/i;
    // Funciones auxiliares que sólo harían ruido
    const OMITIR = /^(escapeHtml|get[A-Z]|build|render|fill|format|fmt|filter|_)/;
    // Funciones clave: se registran siempre, aunque las llame otra función
    const SIEMPRE = /^(init|loadFacturacion|executeSaveAndSend|aplicarAutoMatchBorrador|guardarBorrador|limpiarBorrador|iniciarAutoGuardado|detenerAutoGuardado|switchTab|loadBandeja|executeTimelineAction|showGlobalBranchesModal)/;

    const nativeFetch = window.fetch.bind(window);
    const pestana = ((window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 40);

    let seq = 0, cola = [], vista = null, profundidad = 0, inicioRegistrado = false;
    const instrumentados = new WeakSet();

    // ---------- utilidades ----------
    const moduloActual = () => {
        if (vista && VISTAS[vista]) return VISTAS[vista];
        if (!window.CURRENT_USER_EMAIL) return 'LOGIN'; // sin sesión = pantalla de login
        return null;
    };

    const ahora = () => {
        const d = new Date(), p = (n, l = 2) => String(n).padStart(l, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
    };

    const corto = (v, n = 120) => {
        if (v === null || v === undefined) return null;
        const s = String(v).replace(/\s+/g, ' ').trim();
        return s.length > n ? s.slice(0, n) + '…' : s;
    };

    const textoPlano = (h) => {
        if (h === null || h === undefined) return '';
        try {
            // DOMParser no ejecuta scripts ni carga imágenes
            return corto(new DOMParser().parseFromString(String(h), 'text/html').body.textContent, 900);
        } catch (_) { return corto(h, 900); }
    };

    const descElemento = (el) => {
        if (!el || !el.tagName) return null;
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.name) s += '[name=' + el.name + ']';
        if (el.type && el.tagName !== 'BUTTON') s += '[type=' + el.type + ']';
        return s;
    };

    const resumir = (v, prof = 0) => {
        if (v === null || v === undefined || typeof v === 'number' || typeof v === 'boolean') return v;
        if (typeof v === 'string') return corto(v, 150);
        if (typeof v === 'function') return 'ƒ ' + (v.name || 'anónima');
        if (typeof Event !== 'undefined' && v instanceof Event) return 'Event:' + v.type;
        if (typeof Element !== 'undefined' && v instanceof Element) return descElemento(v);
        if (Array.isArray(v)) return { _items: v.length };
        if (typeof v === 'object') {
            if (prof >= 2) return { _campos: Object.keys(v).length };
            const o = {};
            Object.keys(v).slice(0, 25).forEach(k => {
                o[k] = SENSIBLE.test(k) ? (v[k] ? '***' : '(vacío)') : resumir(v[k], prof + 1);
            });
            return o;
        }
        return String(v);
    };

    const resumenCuerpo = (body) => {
        if (!body) return null;
        try {
            if (typeof body === 'string') {
                try { return resumir(JSON.parse(body)); } catch (_) { return { _texto: body.length }; }
            }
            if (body instanceof FormData) {
                const o = {};
                body.forEach((v, k) => {
                    o[k] = SENSIBLE.test(k) ? (v ? '***' : '(vacío)') : (typeof v === 'string' ? corto(v, 150) : 'archivo');
                });
                return o;
            }
        } catch (_) {}
        return { _tipo: typeof body };
    };

    const limpiarUrl = (u) => {
        try {
            const x = new URL(u, location.href);
            Array.from(x.searchParams.keys()).forEach(k => { if (SENSIBLE.test(k)) x.searchParams.set(k, '***'); });
            return x.pathname + x.search;
        } catch (_) { return u; }
    };

    const infoEquipo = () => ({
        navegador: navigator.userAgent,
        idioma: navigator.language,
        plataforma: navigator.platform,
        pantalla: screen.width + 'x' + screen.height,
        ventana: innerWidth + 'x' + innerHeight,
        zonaHoraria: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone,
        memoriaGB: navigator.deviceMemory || null,
        nucleos: navigator.hardwareConcurrency || null,
        red: navigator.connection ? navigator.connection.effectiveType : null,
        tema: document.documentElement.classList.contains('dark') ? 'oscuro' : 'claro',
        usuario: window.CURRENT_USER_EMAIL || null,
        rol: window.CURRENT_USER_ROLE || null
    });

    // ---------- cola y envío ----------
    const empujar = (modulo, evento, datos) => {
        if (cola.length >= 500) cola.shift();
        cola.push({
            seq: ++seq, ts: ahora(), modulo, evento,
            resultado: datos.resultado || 'INFO',
            funcion: datos.funcion ? corto(datos.funcion, 150) : null,
            elemento: datos.elemento ? corto(datos.elemento, 300) : null,
            url: datos.url ? corto(datos.url, 400) : null,
            metodo: datos.metodo || null,
            status: datos.status ?? null,
            ms: datos.ms ?? null,
            mensaje: datos.mensaje ? corto(datos.mensaje, 1000) : null,
            detalle: Object.assign({ vista }, datos.detalle || {})
        });
    };

    function registrar(evento, datos = {}) {
        try {
            const modulo = datos.modulo || moduloActual();
            if (!modulo) return;
            if (!inicioRegistrado) {
                inicioRegistrado = true;
                empujar(modulo, 'SESION_PESTANA', { mensaje: 'Inicio de pestaña', detalle: infoEquipo() });
            }
            empujar(modulo, evento, datos);
            if (cola.length >= 25) enviar();
        } catch (_) {}
    }

    function enviar(alSalir = false) {
        if (!cola.length) return;
        const lote = cola.splice(0, 300);
        const cuerpo = JSON.stringify({ pestana, eventos: lote });
        const devolver = () => { cola = lote.concat(cola).slice(-500); };
        try {
            if (alSalir && navigator.sendBeacon &&
                navigator.sendBeacon(ENDPOINT, new Blob([cuerpo], { type: 'application/json' }))) return;
            nativeFetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: cuerpo,
                credentials: 'same-origin',
                keepalive: cuerpo.length < 60000
            }).then(r => { if (!r.ok) devolver(); }).catch(devolver);
        } catch (_) { devolver(); }
    }
    setInterval(enviar, 8000);

    // ---------- fetch: cada consulta al servidor ----------
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : ((input && input.url) || '');
        if (url.indexOf('bitacora.php') !== -1 || url.indexOf('router.php') !== -1) return nativeFetch(input, init);

        const modulo = /login_local\.php/.test(url) ? 'LOGIN' : moduloActual();
        if (!modulo) return nativeFetch(input, init);

        const metodo = ((init && init.method) || 'GET').toUpperCase();
        const detalle = { peticion: resumenCuerpo(init && init.body) };
        const t0 = performance.now();
        const base = { modulo, url: limpiarUrl(url), metodo };

        return nativeFetch(input, init).then(resp => {
            const ms = Math.round(performance.now() - t0);
            resp.clone().text().then(txt => {
                const cab = txt.slice(0, 4000);
                let resultado = resp.ok ? 'OK' : 'ERROR', mensaje = null;
                const mS = cab.match(/"success"\s*:\s*(true|false)/);
                if (mS) resultado = mS[1] === 'true' ? 'OK' : 'ERROR';
                const mE = cab.match(/"error"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (mE) { try { mensaje = JSON.parse('"' + mE[1] + '"'); } catch (_) { mensaje = mE[1]; } }
                if (txt.length <= 300000) { try { detalle.respuesta = resumir(JSON.parse(txt)); } catch (_) {} }
                detalle.bytes = txt.length;
                registrar('API', Object.assign({}, base, { status: resp.status, ms, resultado, mensaje, detalle }));
            }).catch(() => registrar('API', Object.assign({}, base, {
                status: resp.status, ms, resultado: resp.ok ? 'OK' : 'ERROR', detalle
            })));
            return resp;
        }, err => {
            registrar('API', Object.assign({}, base, {
                ms: Math.round(performance.now() - t0), resultado: 'ERROR_RED',
                mensaje: err && err.message, detalle
            }));
            throw err;
        });
    };

    // ---------- navegación SPA ----------
    const envolverLoadView = () => {
        const original = window.loadView;
        if (typeof original !== 'function' || original.__bitacora) return;
        const envuelta = function (viewName) {
            const anterior = vista;
            vista = viewName;
            const mod = VISTAS[viewName] || VISTAS[anterior];
            if (mod) registrar('NAVEGACION', { modulo: mod, mensaje: (anterior || '(inicio)') + ' → ' + viewName });
            return original.apply(this, arguments);
        };
        envuelta.__bitacora = true;
        window.loadView = envuelta;
    };

    // ---------- mensajes que el sistema muestra al usuario ----------
    const envolverSysUI = () => {
        const S = window.SysUI;
        if (!S) return;
        ['alert', 'confirm', 'prompt', 'confirmCierre'].forEach(nombre => {
            const fn = S[nombre];
            if (typeof fn !== 'function' || fn.__bitacora) return;
            const env = function (mensaje, titulo, tipo) {
                const t0 = performance.now();
                const p = fn.apply(this, arguments);
                if (moduloActual()) {
                    const texto = (titulo ? '[' + textoPlano(titulo) + '] ' : '') + textoPlano(mensaje);
                    Promise.resolve(p).then(resp => registrar('MODAL', {
                        funcion: 'SysUI.' + nombre,
                        resultado: tipo === 'error' ? 'ERROR' : (tipo === 'warning' ? 'ADVERTENCIA' : 'INFO'),
                        mensaje: texto,
                        ms: Math.round(performance.now() - t0), // lo que tardó el usuario en responder
                        detalle: { respuesta_usuario: nombre === 'prompt' ? corto(resp, 60) : resp }
                    }), () => {});
                }
                return p;
            };
            env.__bitacora = true;
            S[nombre] = env;
        });
    };

    // ---------- funciones del módulo ----------
    const instrumentar = (obj, nombreObj) => {
        if (!obj || instrumentados.has(obj)) return;
        instrumentados.add(obj);
        Object.keys(obj).forEach(k => {
            const fn = obj[k];
            if (typeof fn !== 'function' || OMITIR.test(k)) return;
            const nombre = nombreObj + '.' + k;

            obj[k] = function () {
                const registrarla = profundidad === 0 || SIEMPRE.test(k);
                const t0 = performance.now();
                const args = registrarla ? Array.prototype.slice.call(arguments, 0, 4).map(a => resumir(a, 1)) : null;
                const dur = () => Math.round(performance.now() - t0);

                profundidad++;
                let r;
                try {
                    r = fn.apply(this, arguments);
                } catch (e) {
                    profundidad--;
                    registrar('FUNCION', {
                        funcion: nombre, resultado: 'EXCEPCION', ms: dur(), mensaje: e && e.message,
                        detalle: { args, pila: corto(e && e.stack, 800) }
                    });
                    throw e;
                }
                profundidad--;

                if (r && typeof r.then === 'function') {
                    r.then(v => {
                        if (registrarla) registrar('FUNCION', {
                            funcion: nombre, resultado: 'OK', ms: dur(),
                            detalle: { args, asincrona: true, retorno: resumir(v, 1) }
                        });
                    }, e => registrar('FUNCION', {
                        funcion: nombre, resultado: 'EXCEPCION', ms: dur(), mensaje: e && e.message,
                        detalle: { args, asincrona: true, pila: corto(e && e.stack, 800) }
                    }));
                } else if (registrarla) {
                    registrar('FUNCION', { funcion: nombre, resultado: 'OK', ms: dur(), detalle: { args, retorno: resumir(r, 1) } });
                }
                return r;
            };
        });
    };

    // ---------- DOM (fase de captura: se ve todo, no se altera nada) ----------
    document.addEventListener('click', e => {
        if (!moduloActual()) return;
        const el = e.target && e.target.closest &&
            e.target.closest('button, a, [onclick], input[type=checkbox], input[type=radio], [role=button], summary, label, th, tr');
        if (!el) return;
        registrar('CLICK', {
            elemento: descElemento(el),
            funcion: el.getAttribute('onclick') || (el.tagName === 'A' ? el.getAttribute('href') : null),
            mensaje: corto(el.innerText || el.value || el.title || el.getAttribute('aria-label'), 100),
            detalle: {
                x: e.clientX, y: e.clientY,
                deshabilitado: !!el.disabled,
                marcado: (el.type === 'checkbox' || el.type === 'radio') ? el.checked : undefined
            }
        });
    }, true);

    document.addEventListener('change', e => {
        if (!moduloActual()) return;
        const el = e.target;
        if (!el || !el.tagName) return;
        const sensible = el.type === 'password' || SENSIBLE.test(el.name || '') || SENSIBLE.test(el.id || '');
        const valor = (el.type === 'checkbox' || el.type === 'radio') ? el.checked
            : (el.tagName === 'SELECT' ? ((el.options[el.selectedIndex] || {}).text) : el.value);
        registrar('CAMBIO', { elemento: descElemento(el), mensaje: sensible ? (el.value ? '***' : '(vacío)') : corto(valor, 150) });
    }, true);

    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || !moduloActual()) return;
        const el = e.target;
        if (!el || el.tagName !== 'INPUT' || el.type === 'password' || SENSIBLE.test(el.id || '')) return;
        registrar('TECLA_ENTER', { elemento: descElemento(el), mensaje: corto(el.value, 80) });
    }, true);

    document.addEventListener('submit', e => {
        if (!moduloActual()) return;
        let campos = null;
        try { campos = resumenCuerpo(new FormData(e.target)); } catch (_) {}
        registrar('ENVIO_FORM', { elemento: descElemento(e.target), detalle: { campos } });
    }, true);

    // ---------- errores ----------
    window.addEventListener('error', e => {
        if (!moduloActual()) return;
        if (e.target && e.target !== window && e.target.tagName) {
            registrar('ERROR_RECURSO', { resultado: 'ERROR', elemento: descElemento(e.target), url: e.target.src || e.target.href });
            return;
        }
        registrar('ERROR_JS', {
            resultado: 'ERROR', mensaje: e.message,
            funcion: (e.filename || '').split('/').pop() + ':' + e.lineno + ':' + e.colno,
            detalle: { pila: corto(e.error && e.error.stack, 1200) }
        });
    }, true);

    window.addEventListener('unhandledrejection', e => {
        if (!moduloActual()) return;
        const r = e.reason;
        registrar('ERROR_PROMESA', {
            resultado: 'ERROR', mensaje: r && r.message ? r.message : corto(r, 300),
            detalle: { pila: corto(r && r.stack, 1200) }
        });
    });

    // ---------- ciclo de vida de la pestaña ----------
    document.addEventListener('visibilitychange', () => {
        const oculta = document.visibilityState === 'hidden';
        registrar('PESTANA', { mensaje: oculta ? 'Pestaña oculta o minimizada' : 'Pestaña visible' });
        if (oculta) enviar(true);
    });
    window.addEventListener('pagehide', () => {
        registrar('PESTANA', { mensaje: 'Salida, recarga o cierre de la página' });
        enviar(true);
    });
    window.addEventListener('online', () => registrar('CONEXION', { resultado: 'OK', mensaje: 'Conexión restablecida' }));
    window.addEventListener('offline', () => registrar('CONEXION', { resultado: 'ERROR', mensaje: 'Sin conexión a internet' }));

    // ---------- arranque ----------
    try { envolverLoadView(); } catch (_) {}
    try { envolverSysUI(); } catch (_) {}
    try { instrumentar(window.CierreCajasLogic, 'CierreCajasLogic'); } catch (_) {}

    window.Bitacora = { registrar, enviar };
})();