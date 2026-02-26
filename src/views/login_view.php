<?php
$tenantId = getenv('O365_TENANT_ID');
$clientId = getenv('O365_CLIENT_ID');
$redirectUri = urlencode(getenv('O365_REDIRECT_URI'));
$scope = urlencode("User.Read openid profile email");
$loginUrl = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/authorize?client_id=$clientId&response_type=code&redirect_uri=$redirectUri&response_mode=query&scope=$scope";
?>
<div class="flex min-h-[80vh] flex-col justify-center px-6 py-12 lg:px-8 animate-fade-in-up">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 class="mt-10 text-center text-3xl font-bold leading-9 tracking-tight text-slate-900 dark:text-white">
            ANC Finanzas
        </h2>
        <p class="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">Plataforma de Consolidación</p>
    </div>

    <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
        
        <!-- Botón Principal Microsoft 365 -->
        <a href="<?php echo $loginUrl; ?>" class="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-500 focus-visible:outline transition-all items-center gap-3">
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
                <span class="bg-white dark:bg-slate-800 px-6 text-slate-500 cursor-pointer hover:text-blue-600 transition-colors" onclick="document.getElementById('local-login-form').classList.toggle('hidden')">
                    Opciones avanzadas
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
                    <input id="password" name="password" type="password" required class="block w-full rounded-md border-0 py-1.5 px-3 text-slate-900 dark:text-white dark:bg-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 outline-none transition-all">
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