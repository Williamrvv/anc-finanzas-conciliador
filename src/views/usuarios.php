<?php
// Detectar si el usuario es Admin global (Dios) o un delegado
$esAdminUniversal = ($_SESSION['user']['role'] ?? '') === 'admin';
?>
<div class="flex flex-col h-full animate-fade-in-up">
    <!-- Header -->
    <header class="flex justify-between items-end mb-6">
        <div>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <span class="bg-blue-100 text-blue-600 p-2 rounded-lg">👥</span> 
                Administración de Usuarios
            </h1>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Haga clic en un usuario para editar sus accesos y permisos.</p>
        </div>
        <?php if($esAdminUniversal): ?>
        <button onclick="window.UsuariosLogic.openModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all flex items-center gap-2">
            <span>+</span> Nuevo Usuario
        </button>
        <?php endif; ?>
    </header>

    <!-- Barra de Filtros Inteligente -->
    <div class="bg-white dark:bg-slate-800 p-4 rounded-t-xl border border-slate-200 dark:border-slate-700 border-b-0 flex gap-4 items-center">
        <div class="relative flex-grow max-w-sm">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
            <input type="text" id="filtro-texto" oninput="window.UsuariosLogic.applyFilters()" placeholder="Buscar por nombre o correo..." class="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors">
        </div>
        <select id="filtro-rol" onchange="window.UsuariosLogic.applyFilters()" class="py-2 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
            <option value="todos">Todos los Roles</option>
            <!-- JS inyecta opciones -->
        </select>
        <select id="filtro-estado" onchange="window.UsuariosLogic.applyFilters()" class="py-2 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer">
            <option value="todos">Todos los Estados</option>
            <option value="1" selected>Sólo Activos</option>
            <option value="0">Dados de Baja</option>
        </select>
    </div>

     <!-- Tabla Minimalista -->
    <div class="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-b-xl overflow-hidden">
        <div class="overflow-x-auto custom-scrollbar min-h-[500px]">
            <table class="w-full text-left border-collapse select-none">
                <thead class="sticky top-0 bg-slate-50 dark:bg-slate-900/90 z-10 backdrop-blur-sm shadow-sm">
                    <tr class="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase tracking-wider">
                        <th class="p-4 font-bold w-1/3">Usuario</th>
                        <th class="p-4 font-bold">Puesto</th>
                        <th class="p-4 font-bold">Rol Principal</th>
                        <th class="p-4 font-bold text-right">Estado</th>
                    </tr>
                </thead>
                <tbody id="usuarios-tbody" class="divide-y divide-slate-100 dark:divide-slate-700/50">
                    <!-- JS inyecta datos aquí -->
                </tbody>
            </table>
        </div>
        
        <!-- Paginación Footer -->
        <div class="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between sm:px-6">
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                        Mostrando <span id="pag-start" class="font-medium text-slate-900 dark:text-white">0</span> a <span id="pag-end" class="font-medium text-slate-900 dark:text-white">0</span> de <span id="pag-total" class="font-medium text-slate-900 dark:text-white">0</span> resultados
                    </p>
                </div>
                <div>
                    <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button id="btn-prev-page" onclick="window.UsuariosLogic.changePage(-1)" class="relative inline-flex items-center rounded-l-md px-2 py-1.5 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <span class="sr-only">Anterior</span>
                            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" /></svg>
                        </button>
                        <!-- Selector de página rápido -->
                        <span class="relative inline-flex items-center px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-300 dark:ring-slate-600">
                            Pág. <span id="pag-current" class="ml-1 text-blue-600 dark:text-blue-400">1</span>
                        </span>
                        <button id="btn-next-page" onclick="window.UsuariosLogic.changePage(1)" class="relative inline-flex items-center rounded-r-md px-2 py-1.5 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <span class="sr-only">Siguiente</span>
                            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" /></svg>
                        </button>
                    </nav>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- Modal Formulario -->
<div id="modal-usuario" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all flex flex-col max-h-[90vh] animate-fade-in-up">
        
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
            <h3 id="u-modal-title" class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">Nuevo Usuario</h3>
            <button type="button" onclick="window.UsuariosLogic.closeModal()" class="text-slate-400 hover:text-red-500 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>

        <form id="form-usuario" onsubmit="window.UsuariosLogic.saveUser(event)" class="flex flex-col overflow-hidden">
            <input type="hidden" name="isEdit" id="u-is-edit" value="false">
            <!-- Swithes de Control Superior (Ocultos para no administradores) -->
                <div class="<?php echo $esAdminUniversal ? 'flex' : 'hidden'; ?> gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-700">
                    <!-- Switch Activo -->
                    <label class="flex items-center cursor-pointer relative gap-3 flex-1 justify-between">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Cuenta Activa</span>
                        <div class="relative">
                            <input type="checkbox" name="activo" id="u-activo" class="sr-only peer" checked>
                            <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </div>
                    </label>
                    <div class="w-px bg-slate-200 dark:bg-slate-700"></div>
                    <!-- Switch Admin -->
                    <label class="flex items-center cursor-pointer relative gap-3 flex-1 justify-between group" title="Otorga acceso al módulo de usuarios sin ser Rol Admin">
                        <span class="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Admin. Usuarios</span>
                        <div class="relative">
                            <input type="checkbox" name="puedeAdmin" id="u-puede-admin" class="sr-only peer">
                            <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </div>
                    </label>
                </div>

                <div>
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo ANC</label>
                    <input type="email" name="email" id="u-email" required class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg outline-none transition-shadow <?php echo $esAdminUniversal ? 'bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 pointer-events-none cursor-not-allowed'; ?>" <?php echo $esAdminUniversal ? '' : 'readonly tabindex="-1"'; ?>>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre</label>
                        <input type="text" name="nombre" id="u-nombre" required class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg outline-none transition-shadow <?php echo $esAdminUniversal ? 'bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 pointer-events-none cursor-not-allowed'; ?>" <?php echo $esAdminUniversal ? '' : 'readonly tabindex="-1"'; ?>>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Apellidos</label>
                        <input type="text" name="apellidos" id="u-apellidos" class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg outline-none transition-shadow <?php echo $esAdminUniversal ? 'bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 pointer-events-none cursor-not-allowed'; ?>" <?php echo $esAdminUniversal ? '' : 'readonly tabindex="-1"'; ?>>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Puesto</label>
                        <!-- El Puesto SIEMPRE es editable por los delegados -->
                        <input type="text" name="puesto" id="u-puesto" class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-shadow">
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rol de Acceso Base</label>
                        <select name="idRol" id="u-rol" required onchange="window.UsuariosLogic.toggleSucursales()" class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg outline-none transition-shadow <?php echo $esAdminUniversal ? 'bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 pointer-events-none cursor-not-allowed'; ?>" <?php echo $esAdminUniversal ? '' : 'tabindex="-1"'; ?>>
                            <!-- JS inyecta roles -->
                        </select>
                    </div>
                </div>
            <div class="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                
                

                <!-- CONTENEDOR MULTI-SELECT SUCURSALES (Solo visible para Jefes) -->
                <div id="u-sucursales-container" class="hidden bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 flex flex-col overflow-visible">
                    <label class="block text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase mb-2">Sucursales Asignadas a la Jefatura <span class="text-red-500">*</span></label>
                    
                    <!-- Píldoras Seleccionadas -->
                    <div id="u-selected-branches" class="flex flex-wrap gap-2 mb-3 empty:hidden"></div>

                    <!-- Buscador Desplegable -->
                    <div class="relative">
                        <div class="relative">
                            <input type="text" id="u-search-branch" oninput="window.UsuariosLogic.filterBranches()" onfocus="window.UsuariosLogic.filterBranches()" placeholder="Buscar por ID o Nombre de sucursal..." class="w-full p-2.5 pl-9 text-sm border border-amber-300 dark:border-amber-700/50 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 transition-shadow placeholder-amber-300/80" autocomplete="off">
                            <span class="absolute left-3 top-2.5 text-amber-500">🔍</span>
                        </div>
                        
                        <!-- Lista Expansible (Empuja el contenido hacia abajo y ajusta el modal) -->
                        <ul id="u-branch-list" class="w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-inner max-h-60 overflow-y-auto hidden custom-scrollbar transition-all"></ul>
                    </div>
                </div>

                <div class="<?php echo $esAdminUniversal ? 'bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30' : 'hidden'; ?>">
                    <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                        <div class="flex-grow w-full">
                            <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cambiar / Asignar Contraseña Manual</label>
                            <input type="password" name="password" id="u-password" placeholder="••••••••" class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-shadow">
                            <p id="u-pass-help" class="text-[9px] text-slate-400 mt-1"></p>
                        </div>
                        <div class="w-full sm:w-auto shrink-0 flex items-center justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-blue-200 dark:border-blue-800 pt-3 sm:pt-0 sm:pl-4 mt-1 sm:mt-0">
                            <label class="flex items-center cursor-pointer gap-2 group" title="Al guardar, borrará la clave actual y obligará al usuario a crear una nueva en su próximo ingreso.">
                                <div class="relative">
                                    <input type="checkbox" name="resetPassword" id="u-reset-pass" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                                </div>
                                <span class="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Forzar Reseteo</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 shrink-0">
                <button type="button" onclick="window.UsuariosLogic.closeModal()" class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" id="btn-save-user" class="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-all">Guardar Cambios</button>
            </div>
        </form>
    </div>
</div>