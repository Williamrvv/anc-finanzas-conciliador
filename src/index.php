<?php
session_start();
// Si no hay sesión, usaremos JS para cargar la vista de login, 
// pero pasamos una bandera a JS o simplemente dejamos que router.php lo maneje.
?>
<!DOCTYPE html>
<html lang="es" class="h-full">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cierre de cajas ANC</title>
    <!-- Tailwind CSS (CDN para desarrollo ágil) -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <script>
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
</head>
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
</style>
<body class="bg-slate-50 dark:bg-slate-900 transition-colors duration-300 flex flex-col min-h-screen">

    <!-- HEADER / NAVBAR -->
    <?php if(isset($_SESSION['user'])): ?>
    <nav class="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div class="w-full px-4 sm:px-6 lg:px-8">
            <div class="flex h-16 justify-between items-center">
                <div class="flex items-center gap-4">
                    <span class="text-xl font-bold text-slate-800 dark:text-white">ANC<span class="text-blue-600">Finanzas</span></span>
                    <!-- Navegación simple SPA -->
                    <div class="hidden md:flex ml-10 space-x-4">
                        <button onclick="loadView('dashboard')" class="text-slate-600 dark:text-slate-300 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">Inicio</button>
                        <!-- Módulos -->
                        <button onclick="loadView('conciliacion')" class="text-slate-600 dark:text-slate-300 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                            Conciliación
                        </button>
                    </div>
                </div>
                
                <div class="flex items-center gap-4">
                    <!-- Botón Modo Oscuro -->
                    <button id="theme-toggle" class="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none transition-colors">
                        <!-- Icono Sol (para modo oscuro) -->
                        <svg class="w-6 h-6 hidden dark:block text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        <!-- Icono Luna (para modo claro) -->
                        <svg class="w-6 h-6 block dark:hidden text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                    </button>

                    <!-- Logout -->
                    <a href="logout.php" class="text-sm font-medium text-red-600 hover:text-red-500">Salir</a>
                </div>
            </div>
        </div>
    </nav>
    <?php endif; ?>

    <!-- CONTENEDOR PRINCIPAL (SPA) -->
    <main id="app" class="flex-grow w-full px-4 sm:px-6 lg:px-8 py-8 overflow-visible">
        <!-- Aquí se inyectan las vistas -->
    </main>

    <!-- FOOTER -->
    <footer class="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-auto">
        <div class="mx-auto max-w-7xl px-6 py-4">
            <p class="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                &copy; <?php echo date('Y'); ?> ANC Renting S.A. - Departamento de Finanzas.
            </p>
        </div>
    </footer>

    <!-- BARRA ESTADO TIPO EXCEL (Fija abajo) -->
    <div id="global-table-stats" class="fixed bottom-0 left-0 w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 py-1 px-4 flex justify-end items-center gap-6 text-xs font-mono hidden z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div class="text-slate-500 dark:text-blue">SELECCIÓN ACTUAL:</div>
        <div class="flex gap-2">
            <span class="text-slate-500 dark:text-blue">RECUENTO:</span>
            <span id="gst-count" class="font-bold text-slate-800 dark:text-white">0</span>
        </div>
        <div class="flex gap-2">
            <span class="text-slate-500">SUMA:</span>
            <span id="gst-sum" class="font-bold text-slate-800 dark:text-white">0</span>
        </div>
    </div>

    <!-- Cargar nuestro nuevo motor -->
    <script src="js/vanilla_grid.js"></script>
    <!-- SheetJS (Excel) -->
    <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>
    <!-- Lógica Negocio -->
    <script src="js/conciliacion_ui.js"></script>
    <!-- JS SPA -->
    <script src="js/app.js"></script>
</body>
</html>