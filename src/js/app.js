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

    const segundos = 30; // Tiempo de gracia antes de redirigir solo
    let restante = segundos;

    const msg = `Por seguridad, su sesión se ha cerrado tras un período de inactividad.\n\nPresione "Continuar" para volver a ingresar. Será redirigido automáticamente en <b id="sess-count">${restante}</b> segundos.`;

    // Usamos el motor de modales existente (SysUI). Un solo botón de acción.
    if (window.SysUI) {
        SysUI._createModal(
            "Sesión Expirada",
            msg,
            [{ text: 'Continuar', value: true, class: 'bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors w-full' }],
            "warning"
        ).then(() => {
            window.location.href = 'logout.php';
        });

        // Cuenta regresiva visible; al llegar a 0 redirige aunque no haya clic
        const intervalo = setInterval(() => {
            restante--;
            const el = document.getElementById('sess-count');
            if (el) el.innerText = restante;
            if (restante <= 0) {
                clearInterval(intervalo);
                window.location.href = 'logout.php';
            }
        }, 1000);
    } else {
        // Fallback extremo si SysUI no cargó
        window.location.href = 'logout.php';
    }
}

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