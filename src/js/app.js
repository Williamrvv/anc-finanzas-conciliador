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
window.loadView = async function(viewName, pushHistory = true) {
    const app = document.getElementById('app');
    if(!app) return;

    // --- 1. INTERCEPCIÓN DE ESTADO (Borradores Locales) ---
    // Si estamos saliendo de conciliación o recargándola y hay datos en memoria
    if (window.ConciliacionLogic && typeof window.ConciliacionLogic.hasUnsavedData === 'function') {
        if (window.ConciliacionLogic.hasUnsavedData()) {
            const choice = await window.SysUI._createModal(
                "Progreso sin guardar",
                "Tiene archivos cargados o cambios en curso en el módulo de consolidación.\n\n¿Qué desea hacer antes de salir o recargar?",
                [
                    { text: 'Cancelar', value: 'cancel', class: 'bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-100 transition-colors' },
                    { text: 'Descartar y Limpiar', value: 'clear', class: 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors' },
                    { text: 'Guardar Proceso Local', value: 'save', class: 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors' }
                ],
                "warning"
            );

            if (!choice || choice === 'cancel') return; // Abortar navegación
            
            if (choice === 'save') {
                window.ConciliacionLogic.saveDraftToLocal();
            }
            if (choice === 'clear') {
                window.ConciliacionLogic.resetState();
                localStorage.removeItem('conciliacion_draft');
            }
        } else {
            // Si no hay archivos, de todas formas purgamos la memoria para matar las "Tablas Fantasmas"
            window.ConciliacionLogic.resetState();
        }
    }

    // --- 2. CARGA DE VISTA NORMAL ---
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