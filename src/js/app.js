document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Router simple: Leer la URL actual
    const path = window.location.pathname.substring(1); 
    let view = path === '' ? 'dashboard' : path;

    // Redirección especial: SC va directo a su bandeja
    if (view === 'dashboard' && window.CURRENT_USER_ROLE === 'servicio_cliente') {
        view = 'cierre_cajas';
    }

    // Carga inicial
    if(window.loadView) {
        window.loadView(view, false);
    }

    // Navegación Historial
    window.onpopstate = function(event) {
        if (event.state && event.state.view) {
            window.loadView(event.state.view, false);
        }
    };

    // --- MANEJADOR GLOBAL DE FORMULARIO DE LOGIN ---
    document.body.addEventListener('submit', async (e) => {
        if (e.target.id === 'local-login-form') {
            e.preventDefault(); // Evita que la página se refresque
            
            const btn = document.getElementById('btn-submit-local');
            const errBox = document.getElementById('login-error');
            
            btn.innerHTML = 'Validando...';
            btn.disabled = true;
            errBox.classList.add('hidden');

            const formData = new FormData(e.target);
            
            try {
                const response = await fetch('api/login_local.php', { method: 'POST', body: formData });
                
                // Prevenir fallo si PHP devuelve error 500 en lugar de JSON
                if (!response.ok) throw new Error("Error interno del servidor");
                
                const data = await response.json();
                
                if(data.success) {
                    window.location.reload(); // Éxito: Recarga para que PHP monte la sesión y entre
                } else {
                    errBox.innerText = data.error || "Usuario y/o contraseña incorrectos.";
                    errBox.classList.remove('hidden');
                }
            } catch (err) {
                console.error(err);
                errBox.innerText = "Error de conexión con el servidor.";
                errBox.classList.remove('hidden');
            } finally {
                btn.innerHTML = 'Iniciar sesión local';
                btn.disabled = false;
                document.getElementById('password').value = ''; 
            }
        }
    });

});

// --- SPA Router Logic ---
window.loadView = function(viewName, pushHistory = true) {
    const app = document.getElementById('app');
    if(!app) return;

    // Loader
    app.innerHTML = '<div class="flex justify-center p-10 animate-fade-in"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>';

    fetch(`router.php?view=${viewName}`)
        .then(response => {
            if (!response.ok) throw new Error("Vista no encontrada");
            return response.text();
        })
        .then(html => {
            // GUARDIÁN ANTI-ZOMBIE: Si el router devolvió el login, la sesión expiró.
            // PERO solo avisamos si ESTA pestaña tenía una sesión activa. Si ya estamos
            // en la pantalla de login (sin usuario), inyectamos el login normal y NO
            // mostramos el modal (evita el bucle infinito de expiración).
            if (html.indexOf('<!--SESSION_EXPIRED-->') !== -1) {
                const teniaSesion = window.CURRENT_USER_ROLE && window.CURRENT_USER_ROLE !== 'visitante';
                if (teniaSesion) {
                    handleSessionExpired();
                    return;
                }
                // No había sesión: es la pantalla de login legítima, se muestra normal.
            }

            app.innerHTML = html;
            
            if (pushHistory) {
                history.pushState({view: viewName}, '', viewName === 'dashboard' ? '/' : viewName);
            }

            // Inicialización de módulos
            if (viewName === 'dashboard' && window.DashboardLogic) {
                requestAnimationFrame(() => window.DashboardLogic.init());
            } else if (viewName === 'conciliacion' && window.ConciliacionLogic) {
                requestAnimationFrame(() => window.ConciliacionLogic.init());
            } else if (viewName === 'tsd' && window.TSDLogic) {
                requestAnimationFrame(() => window.TSDLogic.init());
            } else if (viewName === 'auxiliar' && window.AuxiliarLogic) {
                requestAnimationFrame(() => window.AuxiliarLogic.init());
            } else if (viewName === 'usuarios' && window.UsuariosLogic) {
                requestAnimationFrame(() => window.UsuariosLogic.init());
            } else if (viewName === 'cierre_cajas' && window.CierreCajasLogic) {
                // Aquí es donde la magia ocurre: Llama al init() en cuanto carga el HTML
                requestAnimationFrame(() => window.CierreCajasLogic.init());
            }
        })
        .catch(err => {
            app.innerHTML = '<div class="text-center p-10"><h2 class="text-2xl font-bold text-slate-700 dark:text-white">404</h2><p class="text-slate-500">Página no encontrada</p><button onclick="loadView(\'dashboard\')" class="mt-4 text-blue-600 hover:underline">Volver al inicio</button></div>';
            console.error(err);
        });
};

// --- Manejo de Expiración de Sesión (Reactivo) ---
let _sessionExpiredFired = false; // Evita modales duplicados si varios fetch fallan a la vez

function handleSessionExpired() {
    if (_sessionExpiredFired) return;
    _sessionExpiredFired = true;

    const msg = `Su sesión ya no está activa.\n\nPara seguir trabajando debe volver a ingresar.`;

    // Usamos el motor de modales existente (SysUI). Un solo botón de acción.
    // Sin redirección automática: nada se mueve hasta que el usuario lo decida.
    if (window.SysUI) {
        SysUI._createModal(
            "Sesión cerrada",
            msg,
            [{ text: 'Iniciar sesión', value: true, class: 'bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors w-full' }],
            "warning"
        ).then(() => {
            window.location.href = 'logout.php';
        });
    } else {
        // Fallback extremo si SysUI no cargó
        window.location.href = 'logout.php';
    }
}

// --- Sesión: expira por inactividad REAL, con un aviso que sí la extiende ---
(function () {
    const AVISO_MIN  = 25; // minutos sin actividad antes de mostrar el aviso
    const LIMITE_MIN = 30; // minutos sin actividad para cerrar la sesión
    const PING_MIN   = 5;  // con actividad, cada cuánto se renueva la sesión en el servidor
    // Regla: session.gc_maxlifetime (.htaccess) debe ser al menos el doble de LIMITE_MIN.

    const email = window.CURRENT_USER_EMAIL;
    if (!email || email === 'desconocido' || !window.SysUI) return; // sin sesión no hay nada que vigilar

    const AVISO = AVISO_MIN * 60000, LIMITE = LIMITE_MIN * 60000, PING = PING_MIN * 60000;
    const CLAVE = 'iri_sesion_actividad'; // compartida entre pestañas y ventanas emergentes
    const EVENTOS = ['mousedown', 'keydown', 'wheel', 'touchstart', 'mousemove'];

    let ultimaLocal = 0, ultimoGuardado = 0;
    let ultimoPing = Date.now(); // cargar la página ya renovó la sesión
    let ultimoIntento = 0, pingEnCurso = false, avisando = false;
    const emergentes = new Set();

    function marcar(forzar) {
        const ahora = Date.now();
        ultimaLocal = ahora;
        if (!forzar && ahora - ultimoGuardado < 5000) return; // no escribir en cada movimiento del mouse
        ultimoGuardado = ahora;
        try { localStorage.setItem(CLAVE, String(ahora)); } catch (_) {}
    }

    function ultimaActividad() {
        let compartida = 0;
        try { compartida = parseInt(localStorage.getItem(CLAVE), 10) || 0; } catch (_) {}
        return Math.max(ultimaLocal, compartida);
    }

    function alActuar(e) {
        // Con el aviso abierto, en esta ventana solo cuenta el botón. En una ventana
        // emergente el aviso no se ve, así que ahí cualquier actividad sí cuenta.
        if (avisando && e.view === window) return;
        marcar(false);
    }

    function mostrarAviso() {
        avisando = true;
        SysUI._createModal(
            '¿Sigue ahí?',
            `Lleva ${AVISO_MIN} minutos sin actividad.\n\nPor seguridad, la sesión se cerrará en <b id="sesion-cuenta" class="font-mono">--:--</b>.`,
            [{ text: 'Seguir conectado', value: true, class: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors' }],
            'warning'
        );
        const cuenta = document.getElementById('sesion-cuenta');
        const boton = cuenta && cuenta.closest('.fixed').querySelector('button');
        if (boton) boton.addEventListener('click', () => marcar(true)); // el clic es la actividad que extiende
    }

    function ocultarAviso() {
        avisando = false;
        const cuenta = document.getElementById('sesion-cuenta');
        const capa = cuenta && cuenta.closest('.fixed');
        if (capa) capa.remove();
    }

    function renovar() {
        pingEnCurso = true;
        fetch('api/sesion.php', { cache: 'no-store' })
            .then(r => {
                if (r.status === 401) { ocultarAviso(); handleSessionExpired(); } // el servidor ya no la tiene
                else if (r.ok) ultimoPing = Date.now();
            })
            .catch(() => {}) // sin red: se reintenta en la siguiente vuelta permitida
            .finally(() => { pingEnCurso = false; ultimoIntento = Date.now(); });
    }

    function cerrarPorInactividad() {
        ocultarAviso();
        fetch('api/sesion.php?accion=cerrar', { method: 'POST', cache: 'no-store' }).catch(() => {});
        handleSessionExpired();
    }

    function vigilar() {
        if (_sessionExpiredFired) return;

        // Las ventanas emergentes reescriben su documento y pierden los escuchas:
        // se re-enganchan en cada vuelta (addEventListener ignora los repetidos).
        emergentes.forEach(w => {
            if (w.closed) { emergentes.delete(w); return; }
            try { EVENTOS.forEach(ev => w.document.addEventListener(ev, alActuar, true)); } catch (_) {}
        });

        const ahora = Date.now();
        const actividad = ultimaActividad();
        const inactivo = ahora - actividad;

        if (inactivo >= LIMITE) { cerrarPorInactividad(); return; }

        if (inactivo >= AVISO) {
            if (!avisando) mostrarAviso();
            const cuenta = document.getElementById('sesion-cuenta');
            if (cuenta) {
                const s = Math.ceil((LIMITE - inactivo) / 1000);
                cuenta.innerText = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            }
            return;
        }

        if (avisando) ocultarAviso(); // hubo actividad: el botón, otra pestaña o una ventana emergente

        if (!pingEnCurso && actividad > ultimoPing && ahora - ultimoPing >= PING && ahora - ultimoIntento >= 15000) renovar();
    }

    // La actividad en las ventanas emergentes (estaciones manuales, visores) también cuenta
    const abrirNativo = window.open;
    window.open = function () {
        const w = abrirNativo.apply(window, arguments);
        if (w) emergentes.add(w);
        return w;
    };

    marcar(true); // cargar la página cuenta como actividad y descarta marcas viejas
    EVENTOS.forEach(ev => document.addEventListener(ev, alActuar, true));
    setInterval(vigilar, 1000);
})();

// --- Theme Logic ---
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const html = document.documentElement;

    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }

    if (!themeToggleBtn) return;

    themeToggleBtn.addEventListener('click', () => {
        html.classList.toggle('dark');
        localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
    });
}