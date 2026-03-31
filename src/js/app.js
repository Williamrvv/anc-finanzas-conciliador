document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Router simple: Leer la URL actual
    const path = window.location.pathname.substring(1); 
    const view = path === '' ? 'dashboard' : path;

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
            app.innerHTML = html;
            
            if (pushHistory) {
                history.pushState({view: viewName}, '', viewName === 'dashboard' ? '/' : viewName);
            }

            // Inicialización de módulos
            if (viewName === 'conciliacion' && window.ConciliacionLogic) {
                requestAnimationFrame(() => window.ConciliacionLogic.init());
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