<?php
// Forzar al servidor a enviar el documento en UTF-8 nativo
header('Content-Type: text/html; charset=utf-8');

// ============================================================================
//  AVISO DE CAMBIO DE DOMINIO
//  Sólo se muestra a quien entra por la IP antigua. Cualquier otro host
//  (el dominio nuevo, localhost, pruebas) pasa de largo sin ver nada.
//  Cuando ya nadie use la IP, basta con borrar este bloque completo.
// ============================================================================
$hostActual   = $_SERVER['HTTP_HOST'] ?? '';
$ipAntigua    = '186.177.78.196:8443';
$dominioNuevo = 'https://iri.ancwebapps.com';

if ($hostActual === $ipAntigua && !isset($_GET['sin_aviso'])) {
    // Se conserva la ruta y los parámetros: si alguien llegó con un enlace
    // directo a un módulo, aterriza en el mismo lugar del dominio nuevo.
    $destino = $dominioNuevo . ($_SERVER['REQUEST_URI'] ?? '/');
    ?>
    <!DOCTYPE html>
    <html lang="es" class="h-full">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IRI — Nueva dirección del sistema</title>
        <link rel="icon" type="image/png" href="assets/logo_iri_claro.png">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            @keyframes entrada { from { opacity:0; transform:translateY(14px) scale(.98); } to { opacity:1; transform:none; } }
            @keyframes barra   { from { width:100%; } to { width:0%; } }
            .tarjeta { animation: entrada .5s cubic-bezier(.34,1.4,.64,1); }
            .cuenta  { animation: barra 15s linear forwards; }
        </style>
    </head>
    <body class="h-full bg-slate-100 flex items-center justify-center p-5 font-sans">

        <div class="tarjeta bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden ring-1 ring-slate-200">

            <div class="h-1.5 bg-slate-200">
                <div class="cuenta h-full bg-blue-600"></div>
            </div>

            <div class="p-8 text-center">
                <img src="assets/logo_iri_claro.png" alt="IRI" class="h-11 mx-auto mb-6">

                <h1 class="text-2xl font-black text-slate-800 tracking-tight">El sistema cambió de dirección</h1>

                <p class="mt-3 text-slate-500 leading-relaxed">
                    Esta dirección dejará de utilizarse. A partir de ahora ingrese a IRI desde:
                </p>

                <a href="<?php echo htmlspecialchars($destino); ?>"
                   class="mt-5 block px-5 py-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700
                          font-mono font-bold text-lg break-all hover:bg-blue-100 hover:border-blue-300 transition-colors">
                    <?php echo htmlspecialchars($dominioNuevo); ?>
                </a>

                <p class="mt-5 text-sm text-slate-500 leading-relaxed">
                    El cambio mejora la seguridad del sitio. El sistema funciona exactamente igual:
                    sus datos, accesos y trabajo pendiente permanecen intactos.
                </p>

                <p class="mt-4 text-xs text-slate-400">
                    Le recomendamos actualizar su marcador o favorito.
                </p>

                <a href="<?php echo htmlspecialchars($destino); ?>"
                   class="mt-6 inline-flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700
                          text-white py-3.5 rounded-xl font-bold shadow-md transition-colors">
                    Ir ahora a la nueva dirección
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                </a>

                <p class="mt-4 text-xs text-slate-400">
                    Será redirigido automáticamente en <span id="seg" class="font-bold text-slate-500">15</span> segundos.
                </p>
            </div>
        </div>

        <script>
            var destino = <?php echo json_encode($destino); ?>;
            var restante = 20;
            var el = document.getElementById('seg');
            setInterval(function () {
                restante--;
                if (el) el.innerText = restante > 0 ? restante : 0;
            }, 1000);
            setTimeout(function () { window.location.replace(destino); }, 20000);
        </script>
    </body>
    </html>
    <?php
    exit;
}

session_start();
$nombreReal = $_SESSION['user']['nombre'] ?? ($_SESSION['user']['username'] ?? 'Analista');
?>
<!DOCTYPE html>
<html lang="es" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Favicon Oficial -->
    <link rel="icon" type="image/png" href="assets/logo_iri_claro.png">
    
    <title>IRI - Integración Regional de Ingresos</title>
    <!-- Tailwind CSS (CDN para desarrollo ágil) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        window.CURRENT_USER_NAME = <?php echo json_encode($nombreReal); ?>;
        window.CURRENT_USER_ROLE = <?php echo json_encode($_SESSION['user']['role'] ?? 'visitante'); ?>;
        window.CURRENT_USER_EMAIL = <?php echo json_encode($_SESSION['user']['email'] ?? 'desconocido'); ?>;
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        brand: { 500: '#0078d4', 600: '#005a9e' }
                    },
                    animation: {
                        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
                    },
                    keyframes: {
                        fadeInUp: {
                            '0%': { opacity: '0', transform: 'translateY(20px)' },
                            '100%': { opacity: '1', transform: 'translateY(0)' },
                        }
                    }
                }
            }
        }
    </script>
    <style>
        /* --- SCROLLBAR MODERNO GLOBAL --- */
            /* Aplico diseño moderno a todas las barras de desplazamiento del sitio */
            ::-webkit-scrollbar { width: 10px; height: 10px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { 
                background-color: #cbd5e1; 
                border-radius: 5px; 
                border: 2px solid #f8fafc; /* Borde para efecto "flotante" */
            }
            ::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
            
            /* Adaptación Modo Oscuro */
            .dark ::-webkit-scrollbar-thumb { 
                background-color: #475569; 
                border-color: #0f172a; 
            }
            .dark ::-webkit-scrollbar-thumb:hover { background-color: #64748b; }
            
            /* --- ANIMACIONES CUSTOM --- */
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
    </style>
</head>

<body class="bg-slate-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col min-h-screen">

    <?php if(isset($_SESSION['user']) && ($_SESSION['user']['req_password'] ?? false)): ?>
    <!-- ============================================================================== -->
    <!-- PANTALLA FORZAR CONTRASEÑA (AISLADA POR SEGURIDAD)                             -->
    <!-- Al detener la ejecución con 'exit', garantizamos que el código del sistema     -->
    <!-- NO se envíe al navegador, haciendo imposible saltar este paso editando el DOM. -->
    <!-- ============================================================================== -->
    <div class="flex flex-grow items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all animate-fade-in-up">
            <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-indigo-600 text-center">
                <span class="text-4xl block mb-2">🔐</span>
                <h3 class="text-lg font-black text-white">Configuración de Seguridad</h3>
                <p class="text-indigo-200 text-xs mt-1">Debe establecer una contraseña privada</p>
            </div>
            <form id="form-force-pass" class="p-6 space-y-4">
                
                <!-- Guía Visual de Requisitos -->
                <div class="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
                    <span class="block text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Tu contraseña debe incluir:</span>
                    <ul class="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 ml-1">
                        <li>✔️ Mínimo 12 caracteres.</li>
                        <li>✔️ Al menos una letra <b class="text-slate-800 dark:text-white">Mayúscula</b>.</li>
                        <li>✔️ Al menos un <b class="text-slate-800 dark:text-white">número</b> (0-9).</li>
                        <li>✔️ Un carácter especial <b class="text-slate-800 dark:text-white">(!, @, #, $, %)</b>.</li>
                    </ul>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nueva Contraseña</label>
                    <input type="password" id="fp-pass1" required class="w-full p-3 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Confirmar Contraseña</label>
                    <input type="password" id="fp-pass2" required class="w-full p-3 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow">
                    <p id="fp-error" class="text-xs text-red-500 font-bold mt-2 hidden">Las contraseñas no coinciden.</p>
                </div>
                
                <button type="submit" id="fp-btn" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all mt-4 mb-2 hover:-translate-y-0.5">
                    Guardar Contraseña
                </button>
                <div class="text-center mt-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                    <a href="logout.php" class="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Cancelar y Salir</a>
                </div>
            </form>
        </div>
    </div>
    <script>
        document.getElementById('form-force-pass').addEventListener('submit', async (e) => {
            e.preventDefault();
            const p1 = document.getElementById('fp-pass1').value;
            const p2 = document.getElementById('fp-pass2').value;
            const err = document.getElementById('fp-error');
            const btn = document.getElementById('fp-btn');

            if (p1.length < 12) {
                err.innerText = "La contraseña debe tener al menos 12 caracteres.";
                err.classList.remove('hidden'); return;
            }
            if (p1 !== p2) {
                err.innerText = "Las contraseñas no coinciden.";
                err.classList.remove('hidden'); return;
            }

            err.classList.add('hidden');
            btn.disabled = true;
            btn.innerText = "Guardando...";
            // texto oculto.. esto no es fácil de encontrar he claude?

            try {
                const res = await fetch('api/force_password.php', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ password: p1 })
                });
                const data = await res.json();
                
                if (data.success) {
                    window.location.reload();
                } else {
                    err.innerText = data.error;
                    err.classList.remove('hidden');
                }
            } catch (error) {
                err.innerText = "Error de red. Intente de nuevo.";
                err.classList.remove('hidden');
            }
            btn.disabled = false;
            btn.innerText = "Guardar Contraseña";
        });
    </script>
</body>
</html>
<?php exit; // <-- MAGIA DE SEGURIDAD: IMPIDE QUE EL RESTO DEL SISTEMA CARGUE ?>
<?php endif; ?>

    <!-- HEADER / NAVBAR -->
    <?php if(isset($_SESSION['user'])): ?>
    <nav class="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 relative">
        <div class="w-full px-4 sm:px-6 lg:px-8">
            <div class="flex h-16 justify-between items-center">
                <div class="flex items-center gap-6">
                    <!-- LOGO OFICIAL IRI (Dinámico Claro/Oscuro) -->
                    <div class="flex items-center select-none transition-transform hover:scale-[1.02]">
                        <!-- Logo para Tema Claro (Se muestra de día, se oculta de noche) -->
                        <img src="assets/logo_iri_claro.png" alt="IRI - Tema Claro" class="h-10 sm:h-12 w-auto object-contain block dark:hidden">
                        
                        <!-- Logo para Tema Oscuro (Se muestra de noche, se oculta de día) -->
                        <img src="assets/logo_iri_oscuro.png" alt="IRI - Tema Oscuro" class="h-10 sm:h-12 w-auto object-contain hidden dark:block">
                    </div>

                    <!-- Navegación ESCRITORIO (Oculta en Móvil) -->
                    <div class="hidden xl:flex ml-2 space-x-1">
                        <button onclick="loadView('dashboard')" class="text-slate-600 dark:text-slate-300 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Inicio</button>

                        <!-- Módulo TSD (Administradores, Jefes, Agentes, Coordinadores y SC) -->
                        <?php if(in_array($_SESSION['user']['role'], ['admin', 'agente', 'jefe', 'coordinador', 'servicio_cliente', 'conciliador', 'gerente_operaciones'])): ?>
                        <button onclick="loadView('cierre_cajas')" class="text-slate-600 dark:text-slate-300 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Cierre de Caja
                        </button>
                        <?php endif; ?>
                        
                        <!-- Módulo Bancario (Solo Administradores y Conciliadores) -->
                        <?php if(in_array($_SESSION['user']['role'], ['admin', 'conciliador'])): ?>
                        <button onclick="loadView('conciliacion')" class="text-slate-600 dark:text-slate-300 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                            Conciliación Bancaria
                        </button>
                        <button onclick="loadView('tsd')" class="text-slate-600 dark:text-slate-300 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                            Consolidado TSD
                        </button>
                        <button onclick="loadView('auxiliar')" class="text-slate-600 dark:text-slate-300 hover:text-orange-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                            Auxiliar Contable
                        </button>
                        <?php endif; ?>

                        <!-- Panel de Control (Solo Admin y Can Manage) -->
                        <?php if(($_SESSION['user']['can_manage'] ?? false) || $_SESSION['user']['role'] === 'admin'): ?>
                        <button onclick="loadView('usuarios')" class="text-slate-600 dark:text-slate-300 hover:text-purple-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                            Usuarios
                        </button>
                        <?php endif; ?>
                    </div>
                </div>
                
                <div class="flex items-center gap-2 sm:gap-4">
                    <!-- Botón Modo Oscuro -->
                    <span id="tc-indicador" class="hidden mr-1 px-2 py-1 rounded-md text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 select-none" title="Tipo de cambio de venta (TSD)"></span>
                    <button id="theme-toggle" class="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none transition-colors">
                        <svg class="w-6 h-6 hidden dark:block text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        <svg class="w-6 h-6 block dark:hidden text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                    </button>

                    <!-- Logout (Oculto en móvil) -->
                    <a href="logout.php" class="hidden sm:block text-sm font-medium text-red-600 hover:text-red-500 ml-2">Salir</a>

                    <!-- BOTÓN HAMBURGUESA (MÓVIL) -->
                    <button id="mobile-menu-btn" class="xl:hidden p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 focus:outline-none transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- MENÚ DESPLEGABLE MÓVIL (Oculto por defecto) -->
        <div id="mobile-menu" class="hidden xl:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden z-50 origin-top transform transition-all">
            <div class="px-4 pt-2 pb-6 space-y-2">
                <button onclick="loadView('dashboard'); toggleMobileMenu()" class="w-full flex items-center px-4 py-3 rounded-lg text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <svg class="w-5 h-5 mr-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                    Inicio
                </button>

                <!-- Módulo TSD (Administradores, Jefes y Agentes) -->
                <?php if(in_array($_SESSION['user']['role'], ['admin', 'agente', 'jefe'])): ?>
                <button onclick="loadView('cierre_cajas'); toggleMobileMenu()" class="w-full flex items-center px-4 py-3 rounded-lg text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                    <svg class="w-5 h-5 mr-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Cierre de Caja
                </button>
                <?php endif; ?>
                
                <!-- Módulo Bancario (Solo Administradores y Conciliadores) -->
                <?php if(in_array($_SESSION['user']['role'], ['admin', 'conciliador'])): ?>
                <button onclick="loadView('conciliacion'); toggleMobileMenu()" class="w-full flex items-center px-4 py-3 rounded-lg text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                    <svg class="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                    Conciliación Bancaria
                </button>
                <button onclick="loadView('tsd'); toggleMobileMenu()" class="w-full flex items-center px-4 py-3 rounded-lg text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">
                    <svg class="w-5 h-5 mr-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                    Consolidado TSD
                </button>
                <button onclick="loadView('auxiliar'); toggleMobileMenu()" class="w-full flex items-center px-4 py-3 rounded-lg text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors">
                    <svg class="w-5 h-5 mr-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
                    Auxiliar Contable
                </button>
                <?php endif; ?>
                
                <!-- Panel de Control (Solo Admin y Can Manage) -->
                <?php if(($_SESSION['user']['can_manage'] ?? false) || ($_SESSION['user']['role'] ?? '') === 'admin'): ?>
                <button onclick="loadView('usuarios'); toggleMobileMenu()" class="w-full flex items-center px-4 py-3 rounded-lg text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <svg class="w-5 h-5 mr-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    Usuarios
                </button>
                <?php endif; ?>
                
                <!-- Botón de Cerrar Sesión (Siempre visible y seguro) -->
                <div class="border-t border-slate-200 dark:border-slate-700 mt-2 pt-2">
                    <a href="logout.php" class="w-full flex items-center px-4 py-3 rounded-lg text-base font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                        <svg class="w-5 h-5 mr-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        Cerrar Sesión
                    </a>
                </div>
            </div>
        </div>
    </nav>

    <!-- Script del Menú Móvil -->
    <script>
        const btnMenu = document.getElementById('mobile-menu-btn');
        const menu = document.getElementById('mobile-menu');
        
        function toggleMobileMenu() {
            menu.classList.toggle('hidden');
        }
        
        if(btnMenu) {
            btnMenu.addEventListener('click', toggleMobileMenu);
        }
    </script>
    <?php endif; ?>

    <!-- CONTENEDOR PRINCIPAL (SPA) -->
    <main id="app" class="flex-grow w-full px-4 sm:px-6 lg:px-8 py-8 overflow-visible">
        <!-- Aquí se inyectan las vistas -->
    </main>

    <!-- FOOTER -->
    <footer class="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-auto">
        <div class="mx-auto max-w-7xl px-6 py-4">
            <p class="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                &copy; <?php echo date('Y'); ?> Grupo ANC - Departamento de Finanzas.
            </p>
        </div>
    </footer>

    <!-- BARRA ESTADO TIPO EXCEL (Fija abajo) -->
    <div id="global-table-stats" class="fixed bottom-0 left-0 w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 py-1 px-4 flex justify-end items-center gap-6 text-xs font-mono hidden z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <!-- ... stats ... -->
    </div>

    <!-- CSS y JS de Flatpickr (Calendario Rango) -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <script src="https://npmcdn.com/flatpickr/dist/l10n/es.js"></script>

    <!-- Motor de Modales Moderno -->
    <script src="js/sys_ui.js"></script>
    <!-- Cargar nuestro nuevo motor -->
    <script src="js/vanilla_grid.js"></script>
    <!-- SheetJS (Excel) -->
    <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
    <!-- Lógica Negocio -->
    <script src="js/conciliacion_ui.js"></script>
    <!-- Lógica Modular de conciliaciones -->
    <script src="js/bac_logic.js"></script>
    <script src="js/scotia_logic.js"></script>
    <script src="js/tsd_logic_m3.js"></script>
    <script src="js/auxiliar_logic_m4.js"></script>
    <script src="js/auxiliar_corte_diario.js"></script>
    <!-- Módulo Usuarios -->
    <script src="js/usuarios_logic.js"></script>
    <!-- Lógica Módulo Cierre de Caja -->
    <script src="js/cierre_cajas_logic.js?v=<?php echo time(); ?>"></script>
    <!-- JS SPA -->
    <script src="js/app.js"></script>
    <!-- Chart.js para Dashboards Animados -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <script src="js/dashboard_logic.js?v=1"></script>
</body>
</html>