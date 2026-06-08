<?php
$tenantId = getenv('O365_TENANT_ID');
$clientId = getenv('O365_CLIENT_ID');
$redirectUri = urlencode(getenv('O365_REDIRECT_URI'));
$scope = urlencode("User.Read openid profile email");
$loginUrl = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/authorize?client_id=$clientId&response_type=code&redirect_uri=$redirectUri&response_mode=query&scope=$scope";
?>
<style>
    /* Animación personalizada de rebote (Pop In) para el logo */
    @keyframes logoPopIn {
        0% { transform: scale(0.5) translateY(-30px); opacity: 0; }
        60% { transform: scale(1.05) translateY(0); opacity: 1; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    .animate-logo-pop {
        animation: logoPopIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    /* Animación CSS pura para mostrar el Tooltip después de 5 segundos */
    @keyframes fadeInDelay {
        0%, 80% { opacity: 0; transform: translate(-50%, 10px); }
        100% { opacity: 1; transform: translate(-50%, 0); }
    }
    .animate-delay-hint {
        animation: fadeInDelay 6s forwards; /* 6s totales (5s de espera + 1s de aparición) */
    }
</style>

<div class="flex min-h-[80vh] flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm flex flex-col items-center">
        
        <!-- LOGO DINÁMICO (Premium UI con Animación y Bordes Redondeados) -->
        <div class="relative group mb-8 animate-logo-pop">
            <!-- Efecto Resplandor (Glow blur) detrás del logo -->
            <div class="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[2rem] blur opacity-25 group-hover:opacity-60 transition duration-700"></div>
            
            <!-- Caja Contenedora Estilo "App Icon" -->
            <div class="relative bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-[2rem] p-4 sm:p-5 shadow-2xl transform transition-all duration-500 hover:scale-105 hover:-translate-y-2">
                <!-- Se agregó 'rounded-xl' directamente a la imagen para asegurar que se recorten las esquinas si la imagen no es transparente -->
                <img src="assets/logo_iri_claro.png" alt="Logo IRI" class="h-28 sm:h-36 w-auto object-contain block dark:hidden rounded-xl">
                <img src="assets/logo_iri_oscuro.png" alt="Logo IRI" class="h-28 sm:h-36 w-auto object-contain hidden dark:block rounded-xl">
            </div>
        </div>
        
        <!-- Textos con su propia animación de aparición -->
        <div class="animate-fade-in-up">
            <h2 class="text-center text-3xl font-black leading-9 tracking-tight text-slate-900 dark:text-white">
                ANC Finanzas
            </h2>
            <p class="text-center text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Plataforma de Consolidación Operativa</p>
        </div>
    </div>
    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        
        <!-- Botón Principal Microsoft 365 -->
        <a href="<?php echo $loginUrl; ?>" class="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm focus-visible:outline transition-all items-center gap-3">
            <svg class="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                <path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9H11z"/><path fill="#ffb900" d="M11 11h9v9H11z"/>
            </svg>
            Ingresar con Microsoft 365
        </a>

        <!-- Separador -->
        <div class="mt-6 relative">
            <div class="absolute inset-0 flex items-center" aria-hidden="true">
                <div class="w-full border-t border-slate-300 dark:border-slate-600"></div>
            </div>
            <div class="relative flex justify-center text-sm font-medium leading-6">
                <span class="relative bg-white dark:bg-slate-800 px-6 text-slate-500 cursor-pointer hover:text-blue-600 transition-colors" onclick="document.getElementById('local-login-form').classList.toggle('hidden'); document.getElementById('advanced-hint').style.display='none';">
                    Opciones avanzadas
                    
                    <!-- Animación Guía (Aparece a los 5s vía CSS Nativo) -->
                    <div id="advanced-hint" class="absolute -top-12 left-1/2 transform -translate-x-1/2 opacity-0 animate-delay-hint pointer-events-none flex flex-col items-center z-10">
                        <span class="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap flex items-center gap-1.5 animate-bounce">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                            Clic aquí para ingreso local
                        </span>
                        <div class="w-2 h-2 bg-indigo-600 rotate-45 -mt-2"></div>
                    </div>
                </span>
            </div>
        </div>

        <!-- Formulario Local Oculto (Anti-Confusión) -->
        <form id="local-login-form" class="space-y-4 mt-6 hidden" onsubmit="handleLocalLogin(event)">
            <div id="login-error" class="hidden bg-red-50 text-red-600 p-2 rounded text-xs font-bold text-center border border-red-200"></div>
            <div>
                <label for="email" class="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">Correo ANC</label>
                <div class="mt-1">
                    <input id="email" name="email" type="email" required autocomplete="email" class="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 dark:text-white dark:bg-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 outline-none transition-all">
                </div>
            </div>

            <div>
                <label for="password" class="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">Contraseña</label>
                <div class="mt-1">
                    <input id="password" name="password" type="password" class="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 dark:text-white dark:bg-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 outline-none transition-all">
                </div>
                <!-- Banner de Ayuda para Nuevo Ingreso -->
                <div class="mt-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 p-2.5 rounded-lg flex items-start gap-2">
                    <span class="text-indigo-500 mt-0.5">ℹ️</span>
                    <p class="text-[10px] text-slate-600 dark:text-slate-400 font-medium leading-tight">
                        <strong class="text-indigo-700 dark:text-indigo-400">¿Primer ingreso?</strong> Deje la contraseña en <b class="text-slate-800 dark:text-white">blanco</b>. El sistema le pedirá crear una clave segura en el siguiente paso.
                    </p>
                </div>
            </div>

            <div>
                <button id="btn-submit-local" type="submit" class="flex w-full justify-center rounded-md bg-slate-800 dark:bg-slate-700 px-3 py-2 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-slate-700 dark:hover:bg-slate-600 transition-all">
                    Iniciar sesión local
                </button>
            </div>
        </form>

    </div>
</div>