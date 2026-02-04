<?php
// Obtenemos variables de entorno para el link (simulando lógica previa)
$tenantId = getenv('O365_TENANT_ID');
$clientId = getenv('O365_CLIENT_ID');
$redirectUri = urlencode(getenv('O365_REDIRECT_URI'));
$scope = urlencode("User.Read openid profile email");
$loginUrl = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/authorize?client_id=$clientId&response_type=code&redirect_uri=$redirectUri&response_mode=query&scope=$scope";
?>
<div class="flex min-h-[80vh] flex-col justify-center px-6 py-12 lg:px-8 animate-fade-in-up">
  <div class="sm:mx-auto sm:w-full sm:max-w-sm">
    <h2 class="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-slate-900 dark:text-white">
        ANC Finanzas
    </h2>
    <p class="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">Validador de cierres de caja</p>
  </div>

  <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
    <a href="<?php echo $loginUrl; ?>" class="flex w-full justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-300 items-center gap-2">
        <svg class="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <path fill="#f25022" d="M1 1h9v9H1z"/>
            <path fill="#00a4ef" d="M1 11h9v9H1z"/>
            <path fill="#7fba00" d="M11 1h9v9H11z"/>
            <path fill="#ffb900" d="M11 11h9v9H11z"/>
        </svg>
      Iniciar Sesión con Microsoft
    </a>
  </div>
</div>