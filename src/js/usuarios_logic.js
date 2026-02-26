window.UsuariosLogic = {
    allUsers: [],
    filteredUsers: [], // Guarda la lista después de buscar
    roles: [],
    
    // Configuración de Paginación
    currentPage: 1,
    itemsPerPage: 5,
    
    init: function() {
        this.loadData();
    },

    loadData: async function() {
        const tbody = document.getElementById('usuarios-tbody');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-slate-400">Cargando datos...</td></tr>';

        try {
            const res = await fetch('api/usuarios_api.php');
            const data = await res.json();
            
            if(!data.success) throw new Error(data.error);
            
            this.allUsers = data.usuarios;
            this.roles = data.roles;
            
            this.renderRolesSelects();
            this.applyFilters(); // Renderiza usando los filtros actuales (Activo por defecto)
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-red-500 font-bold">${err.message}</td></tr>`;
        }
    },

    applyFilters: function() {
        const text = document.getElementById('filtro-texto').value.toLowerCase();
        const rol = document.getElementById('filtro-rol').value;
        const estado = document.getElementById('filtro-estado').value;

        this.filteredUsers = this.allUsers.filter(u => {
            const matchText = u.Nombre.toLowerCase().includes(text) || (u.Apellidos && u.Apellidos.toLowerCase().includes(text)) || u.Email.toLowerCase().includes(text);
            const matchRol = rol === 'todos' || u.Id_Rol == rol;
            const matchEstado = estado === 'todos' || u.Activo == estado;
            return matchText && matchRol && matchEstado;
        });

        // Al filtrar, siempre regresamos a la página 1
        this.currentPage = 1;
        this.renderTable();
    },

    renderTable: function() {
        const tbody = document.getElementById('usuarios-tbody');
        const totalItems = this.filteredUsers.length;
        
        // Calcular índices
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        
        // Cortar el array (Solo los 5 de esta página)
        const paginatedUsers = this.filteredUsers.slice(startIndex, endIndex);

        // Actualizar UI de Paginación Inferior
        document.getElementById('pag-total').innerText = totalItems;
        document.getElementById('pag-start').innerText = totalItems === 0 ? 0 : startIndex + 1;
        document.getElementById('pag-end').innerText = Math.min(endIndex, totalItems);
        document.getElementById('pag-current').innerText = this.currentPage;

        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        if(btnPrev) btnPrev.disabled = this.currentPage === 1;
        if(btnNext) btnNext.disabled = endIndex >= totalItems;

        // Renderizar Filas
        if(paginatedUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center p-8 text-slate-400 text-sm">No se encontraron usuarios.</td></tr>';
            return;
        }

        tbody.innerHTML = paginatedUsers.map(u => {
            const isActivo = u.Activo == 1;
            const isAdminObj = u.Puede_Administrar == 1;
            
            const statusBadge = isActivo 
                ? '<span class="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Activo</span>'
                : '<span class="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-bold">Baja</span>';
            
            let roleColor = 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-transparent';
            if(u.Nombre_Rol === 'admin') roleColor = 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800';
            if(u.Nombre_Rol === 'conciliador') roleColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';

            const adminBadge = isAdminObj && u.Nombre_Rol !== 'admin' ? '<span class="ml-2 text-blue-500 text-xs" title="Tiene permisos de administración">🛡️</span>' : '';

            return `
                <tr onclick='window.UsuariosLogic.openModal(${JSON.stringify(u).replace(/'/g, "&#39;")})' 
                    class="cursor-pointer group hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-slate-700/50 ${!isActivo ? 'opacity-60 grayscale' : ''}">
                    <td class="p-3">
                        <div class="font-bold text-slate-800 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">${u.Nombre} ${u.Apellidos || ''} ${adminBadge}</div>
                        <div class="text-[10px] text-slate-500 font-mono">${u.Email}</div>
                    </td>
                    <td class="p-3 text-xs text-slate-600 dark:text-slate-300 font-medium">${u.Puesto || '-'}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${roleColor}">${u.Nombre_Rol}</span></td>
                    <td class="p-3 text-right">${statusBadge}</td>
                </tr>
            `;
        }).join('');
    },

    // NUEVA FUNCIÓN: Cambiar de página
    changePage: function(direction) {
        const newPage = this.currentPage + direction;
        const maxPage = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
        
        if (newPage >= 1 && newPage <= maxPage) {
            this.currentPage = newPage;
            this.renderTable();
        }
    },

    renderRolesSelects: function() {
        const options = this.roles.map(r => `<option value="${r.Id_Rol}">${r.Nombre_Rol.toUpperCase()}</option>`).join('');
        // Filtro Superior
        const filterEl = document.getElementById('filtro-rol');
        const currentFilter = filterEl.value;
        filterEl.innerHTML = '<option value="todos">Todos los Roles</option>' + options;
        filterEl.value = currentFilter; // Restaurar selección previa

        // Formulario
        document.getElementById('u-rol').innerHTML = options;
    },

    openModal: function(user = null) {
        const form = document.getElementById('form-usuario');
        form.reset();

        document.getElementById('u-is-edit').value = user ? "true" : "false";
        document.getElementById('u-modal-title').innerHTML = user ? '✏️ Editar Usuario' : '➕ Nuevo Usuario';
        
        const elEmail = document.getElementById('u-email');
        const passHelp = document.getElementById('u-pass-help');

        if (user) {
            elEmail.value = user.Email;
            elEmail.readOnly = true; 
            elEmail.classList.add('opacity-70', 'cursor-not-allowed', 'bg-slate-100', 'dark:bg-slate-800');
            
            document.getElementById('u-nombre').value = user.Nombre;
            document.getElementById('u-apellidos').value = user.Apellidos;
            document.getElementById('u-puesto').value = user.Puesto;
            document.getElementById('u-rol').value = user.Id_Rol;
            
            // Set Switches
            document.getElementById('u-activo').checked = user.Activo == 1;
            
            const toggleAdmin = document.getElementById('u-puede-admin');
            if (user.Nombre_Rol === 'admin') {
                toggleAdmin.checked = true;
                toggleAdmin.disabled = true; // Un admin SIEMPRE puede administrar
            } else {
                toggleAdmin.checked = user.Puede_Administrar == 1;
                toggleAdmin.disabled = false;
            }
            
            passHelp.innerText = "Dejar en blanco si no desea cambiarla.";
        } else {
            elEmail.readOnly = false;
            elEmail.classList.remove('opacity-70', 'cursor-not-allowed', 'bg-slate-100', 'dark:bg-slate-800');
            document.getElementById('u-activo').checked = true; // Por defecto activo
            
            const toggleAdmin = document.getElementById('u-puede-admin');
            toggleAdmin.checked = false;
            toggleAdmin.disabled = false;
            
            passHelp.innerText = "La contraseña es opcional si el usuario utilizará Office 365.";
        }

        document.getElementById('modal-usuario').classList.remove('hidden');
    },

    closeModal: function() {
        document.getElementById('modal-usuario').classList.add('hidden');
    },

    saveUser: async function(e) {
        e.preventDefault();
        const form = e.target;
        const btn = document.getElementById('btn-save-user');
        
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-pulse">Guardando...</span>';

        const formData = new FormData(form);
        
        // Fix HTML: Si el toggle está deshabilitado, el FormData no lo atrapa. Lo forzamos a 'on'.
        const toggleAdmin = document.getElementById('u-puede-admin');
        if (toggleAdmin.disabled && toggleAdmin.checked) {
            formData.set('puedeAdmin', 'on');
        }

        try {
            const res = await fetch('api/usuarios_api.php', { method: 'POST', body: formData });
            const data = await res.json();
            
            if(data.success) {
                this.closeModal();
                this.loadData(); // Recarga limpia desde BD
            } else {
                alert("Error: " + data.error);
            }
        } catch (err) {
            alert("Error de conexión al guardar el usuario.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Guardar Cambios";
        }
    }
};