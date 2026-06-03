window.CierreCajasLogic = {
    currentFacturacion: false, // Flag para saber si hay un lote de facturas abierto
    headerData: null,
    transacciones: [],
    pendientesData: [],
    justificacionesCatalogo: [], // <-- Almacena las opciones de la BD
    currentUser: window.CURRENT_USER_NAME || 'Error usuario no detectado',

    buildJustificacionesOptions: function() {
        return `<option value="" disabled selected>-- Seleccione una acción --</option>` + 
            this.justificacionesCatalogo.map(j => 
            `<option value="${j.IdJustificacion}" data-accion="${j.TipoAccion}" data-req="${j.RequiereComentario}" data-text="${j.TextoVisor}">${j.TextoVisor}</option>`
        ).join('');
    },

    // Motor UX: Cambia el placeholder y quita errores según lo que diga la BD
    toggleMotivoReq: function(selectEl, inputId) {
        selectEl.classList.remove('ring-2', 'ring-red-500'); // Quitar error del select
        
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        
        const selectedOpt = selectEl.options[selectEl.selectedIndex];
        if (!selectedOpt.value) return; // Es el placeholder default

        const reqComentario = selectedOpt.getAttribute('data-req') === '1';
        
        if (reqComentario) {
            inputEl.placeholder = "Justifique detalladamente el motivo (Obligatorio)...";
        } else {
            inputEl.placeholder = "Comentario adicional (Opcional)...";
            // Como es opcional, si estaba marcado en rojo, se lo quitamos de inmediato
            inputEl.classList.remove('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
        }
    },
    
    // Función getter dinámica para el borrador (asegura que la llave sea única y limpia)
    getDraftKey: function() {
        // Limpia el nombre del usuario para usarlo como llave segura
        const userClean = String(this.currentUser).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return 'iri_cierre_draft_' + userClean;
    },
    
    autoSaveInterval: null, // Control del temporizador de auto-guardado
    vgHistory: null, // Motor VanillaGrid para el historial
    activeTimelineId: null,

    // Función global para copiar contratos al portapapeles
    copiarContrato: function(contrato, element) {
        navigator.clipboard.writeText(contrato).then(() => {
            const originalHtml = element.innerHTML;
            element.innerHTML = `<span class="text-green-500 dark:text-green-400 flex items-center gap-1">✅ Copiado</span>`;
            setTimeout(() => { element.innerHTML = originalHtml; }, 1500);
        }).catch(err => console.error('Error al copiar:', err));
    },

    init: function() {
        console.log("Módulo Cierre de Caja Iniciado");

        const homeView = document.getElementById('cc-home-view');
            const workspace = document.getElementById('cc-workspace');
            const actionBar = document.getElementById('cc-action-bar');

            // Ocultamos las vistas iniciales
            this.switchTab('workspace'); // Inicia en el workspace por defecto
            
            // Llama a la base de datos para traer los pendientes
            this.loadBandejaPendientes();
            
        // }, 50);
    },

    // =====================================================================
    // MOTOR DE BANDEJAS (HOME GIGANTE vs SUCURSAL COLABORATIVA)
    // =====================================================================
    loadBandejaPendientes: async function(sucursalCode = null) {
        try {
            const url = sucursalCode 
                ? `api/get_casos_pendientes.php?sucursal=${encodeURIComponent(sucursalCode)}` 
                : `api/get_casos_pendientes.php`;
                
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.success) {
                this.pendientesData = json.data;
                if (json.catalogo_justificaciones) {
                    this.justificacionesCatalogo = json.catalogo_justificaciones;
                }
                
                // Pintar mis sucursales en el Home (Panel Central) si venimos de la carga inicial
                if (!sucursalCode && json.mis_sucursales) {
                    const contSucs = document.getElementById('home-sucursales-list');
                    if (contSucs) {
                        if (json.mis_sucursales.length > 0) {
                            contSucs.innerHTML = json.mis_sucursales.map(s => 
                                `<span class="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm whitespace-nowrap">🏢 ${s.CodigoSucursal} - ${s.NombreSucursal}</span>`
                            ).join('');
                        } else {
                            contSucs.innerHTML = `<span class="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-1.5 rounded-full border border-red-200 dark:border-red-800">⚠️ No tiene sucursales asignadas en su perfil de usuario.</span>`;
                        }
                    }
                }

                if (sucursalCode) {
                    this.renderSucursalBandeja(json.data);
                } else {
                    this.renderHomeBandeja(json.data);
                }
            } else {
                console.error("Error API:", json.error);
            }
        } catch (e) {
            console.error("Error Fetch Bandeja:", e);
        }
    },

    renderHomeBandeja: function(data) {
        const container = document.getElementById('cc-mi-bandeja');
        const list = document.getElementById('cc-mi-list');
        const emptyState = document.getElementById('cc-empty-state');
        const btnReport = document.getElementById('cc-btn-report-home');
        
        // 1. Limpiar lista anterior
        list.innerHTML = '';
        
        // 2. Filtrar ESTRICTAMENTE solo los 'NO_REPORTADO'
        const noReportados = data ? data.filter(c => c.Estado === 'NO_REPORTADO') : [];
        
        if (noReportados.length > 0) {
            console.log(`✅ Dibujando ${noReportados.length} casos pendientes en tarjetas...`);
            
            // Actualizar contadores
            const countBadge = document.getElementById('cc-mi-count');
            if (countBadge) countBadge.innerText = noReportados.length;
            
            // Ocultar Emoji Gigante
            if (emptyState) {
                emptyState.style.setProperty('display', 'none', 'important');
                emptyState.classList.add('hidden');
            }
            
            // Mostrar Botón de Reporte
            if (btnReport) {
                btnReport.classList.remove('hidden');
                btnReport.style.display = 'flex';
            }

            // 3. Dibujar Tarjetas (Cards)
            list.innerHTML = noReportados.map(c => {
                let statusColor = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700";
                let atrasoHtml = c.DiasAtraso > 2 
                    ? `<span class="text-[9px] font-bold text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded shadow-sm border border-red-200 dark:border-red-800">${c.DiasAtraso}d ATRASO</span>` 
                    : '';

                // Select de Acción e Input Reactivo
                let motivoHtml = `
                    <select id="accion-home-${c.IdCaso}" class="cc-accion-select-home w-full text-xs px-2 py-1.5 mb-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-colors" onchange="window.CierreCajasLogic.toggleMotivoReq(this, 'motivo-home-${c.IdCaso}')">
                        ${window.CierreCajasLogic.buildJustificacionesOptions()}
                    </select>
                    <textarea id="motivo-home-${c.IdCaso}" class="cc-motivo-input-home w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400 transition-colors resize-none h-16" placeholder="Justifique detalladamente el motivo..." oninput="this.classList.remove('border-red-500', 'bg-red-50', 'dark:bg-red-900/20'); this.classList.toggle('border-indigo-500', this.value.trim()!==''); this.classList.toggle('bg-indigo-50', this.value.trim()!=='')">${c.MotivoAgente || ''}</textarea>
                `;

                return `
                <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600 transition-all flex flex-col justify-between group h-full relative overflow-hidden">
                    <!-- Borde superior de color -->
                    <div class="absolute top-0 left-0 w-full h-1 bg-amber-400"></div>
                    
                    <div>
                        <!-- Header de la Tarjeta -->
                        <div class="flex justify-between items-start mb-3 mt-1">
                            <span class="text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-widest ${statusColor}">${c.Estado.replace(/_/g, ' ')}</span>
                            ${atrasoHtml}
                        </div>
                        
                        <!-- Datos Principales -->
                        <div class="mb-3">
                            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contrato: <span class="text-slate-700 dark:text-slate-300">${c.NumeroContrato}</span></div>
                            <h3 class="text-sm font-black text-indigo-900 dark:text-white leading-tight uppercase line-clamp-2" title="${c.NombreCliente}">${c.NombreCliente}</h3>
                            <div class="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 inline-block px-1.5 py-0.5 rounded mt-1.5 uppercase border border-slate-200 dark:border-slate-700">🏢 ${c.Sucursal_Relacionada}</div>
                        </div>

                        <!-- Metadatos (Monto e ICD) -->
                        <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 mb-4">
                            <div>
                                <span class="block text-[9px] text-slate-400 uppercase font-bold">ICD Origen</span>
                                <span class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">${c.ICD_Relacionado}</span>
                            </div>
                            <div class="text-right border-l border-slate-200 dark:border-slate-700 pl-3">
                                <span class="block text-[9px] text-slate-400 uppercase font-bold">Monto Afectado</span>
                                <span class="text-sm font-black text-slate-700 dark:text-slate-300">₡${parseFloat(c.MontoCRC).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Zona Interactiva (Input de Motivo) -->
                    <div class="mt-auto">
                        ${motivoHtml}
                    </div>
                </div>`;
            }).join('');
            
            // 6. Forzar Visualización
            if (container) {
                container.style.setProperty('display', 'block', 'important');
                container.classList.remove('hidden');
            }

        } else {
            console.log("ℹ️ No hay casos NO_REPORTADOS.");
            if (container) {
                container.style.display = 'none';
                container.classList.add('hidden');
            }
            if (emptyState) {
                emptyState.style.setProperty('display', 'flex', 'important');
                emptyState.classList.remove('hidden');
            }
        }
    },

    renderSucursalBandeja: function(data) {
        const container = document.getElementById('cc-sucursal-bandeja');
        const list = document.getElementById('cc-suc-list');
        const btnReport = document.getElementById('cc-btn-report-suc');
        
        list.innerHTML = '';
        
        // Filtramos solo los NO_REPORTADOS para la vista colaborativa
        const noReportados = data.filter(c => c.Estado === 'NO_REPORTADO');

        if (noReportados.length > 0) {
            document.getElementById('cc-suc-count').innerText = noReportados.length;
            if (btnReport) btnReport.style.display = 'flex';

            list.innerHTML = noReportados.map(c => `
                <div class="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Contrato: ${c.NumeroContrato}</span>
                        <span class="text-[9px] font-bold text-indigo-500 bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300 px-1.5 py-0.5 rounded truncate max-w-[45%]" title="Reportado por">👤 ${c.CreadoPor}</span>
                    </div>
                    <div class="text-sm font-black text-slate-800 dark:text-white leading-tight uppercase mb-1">${c.NombreCliente}</div>
                    <div class="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-3 border-b border-amber-100 dark:border-amber-800/30 pb-2">
                        <span>ICD: <span class="font-mono text-slate-700 dark:text-slate-300">${c.ICD_Relacionado}</span></span>
                        <span class="text-amber-700 dark:text-amber-500">₡${parseFloat(c.MontoCRC).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                    <select id="accion-suc-${c.IdCaso}" class="cc-accion-select-suc w-full text-xs px-2 py-1.5 mb-2 bg-slate-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-bold transition-colors" onchange="window.CierreCajasLogic.toggleMotivoReq(this, 'motivo-suc-${c.IdCaso}')">
                        ${window.CierreCajasLogic.buildJustificacionesOptions()}
                    </select>
                    <input type="text" id="motivo-suc-${c.IdCaso}" class="cc-motivo-input-suc w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-800 dark:text-white rounded-lg outline-none placeholder:text-amber-300 dark:placeholder:text-amber-700 focus:ring-2 focus:ring-amber-400 transition-colors" placeholder="Justifique el motivo..." value="${c.MotivoAgente || ''}" oninput="this.classList.remove('border-red-500', 'bg-red-50', 'dark:bg-red-900/20')">
                </div>
            `).join('');
            
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    },

    enviarSeleccionadosAJefatura: async function(origen = 'home') {
        const inputClass = origen === 'home' ? '.cc-motivo-input-home' : '.cc-motivo-input-suc';
        const inputsMotivo = document.querySelectorAll(inputClass);
        
        const casosData = [];
        const jefesInvolucrados = new Set(); 
        let hasErrors = false;

        inputsMotivo.forEach(input => {
            const motivo = input.value.trim();
            const parts = input.id.split('-');
            const idCaso = parts[parts.length - 1];
            
            const selectId = origen === 'home' ? `accion-home-${idCaso}` : `accion-suc-${idCaso}`;
            const selectElement = document.getElementById(selectId);
            
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            const idJustificacion = selectedOption.value; // Será "" si es el placeholder
            const accionValue = selectedOption.getAttribute('data-accion');
            const reqComentario = selectedOption.getAttribute('data-req') === '1';
            const textoVisor = selectedOption.getAttribute('data-text');
            
            // Intención de procesar: Seleccionó una acción o escribió un motivo
            if (idJustificacion !== '' || motivo !== '') {
                
                if (idJustificacion === '') {
                    // Escribió motivo pero no seleccionó acción
                    selectElement.classList.add('ring-2', 'ring-red-500');
                    hasErrors = true;
                } 
                else if (reqComentario && motivo === '') {
                    // Seleccionó acción que requiere motivo, pero está vacío
                    input.classList.add('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
                    hasErrors = true;
                } 
                else {
                    casosData.push({ 
                        id_caso: idCaso, 
                        motivo: motivo, 
                        accion: accionValue,
                        id_justificacion: idJustificacion,
                        texto_visor: textoVisor
                    });

                    const casoBd = this.pendientesData.find(c => c.IdCaso == idCaso);
                    if (casoBd) {
                        const nombreJefes = casoBd.NombreJefe || 'Jefatura no asignada';
                        const emailJefes = casoBd.EmailJefe || 'Sin correo registrado';
                        jefesInvolucrados.add(`👤 ${nombreJefes} \n   ✉️ ${emailJefes}`);
                    }
                }
            }
        });

        if (hasErrors) {
            return SysUI.alert("Falta información. Revise que haya seleccionado una acción y proporcionado una justificación para las opciones que lo requieran (resaltado en rojo).", "Información Requerida", "warning");
        }

        if (casosData.length === 0) {
            return SysUI.alert("Debe seleccionar una acción de cierre o justificar al menos un caso para poder procesarlo.", "Ningún caso seleccionado", "warning");
        }

        let listaJefesHtml = Array.from(jefesInvolucrados).join('\n');
        const msg = `Se procesarán ${casosData.length} caso(s). Las notificaciones de cierre informativo y escalamientos se enviarán a:\n\n` + 
                    `📋 Jefatura de sucursal:\n${listaJefesHtml}\n\n` + 
                    `¿Desea proceder con el procesamiento?`;

        const confirm = await SysUI.confirm(msg, "Confirmar Procesamiento", "info");
        if (!confirm) return;

        try {
            const res = await fetch('api/enviar_casos_jefatura.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ casos: casosData })
            });
            const data = await res.json();

            if (data.success) {
                // Actualización Optimista: Eliminamos visualmente los casos procesados de inmediato
                casosData.forEach(casoProcesado => {
                    this.pendientesData = this.pendientesData.filter(c => c.IdCaso != casoProcesado.id_caso);
                });

                await SysUI.alert("Los casos han sido procesados y las alertas enviadas exitosamente.", "Proceso Exitoso", "success");
                
                // Forzamos el redibujado con la memoria ya filtrada (mucho más rápido que ir a la BD)
                if (origen === 'home') {
                    this.renderHomeBandeja(this.pendientesData);
                } else {
                    this.renderSucursalBandeja(this.pendientesData);
                }
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            SysUI.alert("Ocurrió un error: " + e.message, "Error Crítico", "error");
        }
    },

    // =====================================================================
    // MOTOR DE BORRADORES (DRAFTS) Y AUTO-GUARDADO
    // =====================================================================
    guardarBorrador: function(isAuto = false) {
        if (!this.transacciones || this.transacciones.length === 0) return;
        
        const escaneados = this.transacciones.filter(t => t._selected).map(t => t.Numero_Contrato);
        
        if (escaneados.length === 0) {
            if (!isAuto) SysUI.alert("No hay transacciones escaneadas para guardar en el borrador.", "Borrador Vacío", "info");
            return;
        }

        const borrador = {
            fecha: new Date().toLocaleString(),
            contratos_listos: escaneados
        };

        localStorage.setItem(this.getDraftKey(), JSON.stringify(borrador));
        
        if (isAuto) {
            // Mostrar la burbuja discreta inferior
            const toast = document.getElementById('toast-autosave');
            if (toast) {
                toast.classList.remove('translate-y-10', 'opacity-0');
                // Ocultar después de 3 segundos
                setTimeout(() => {
                    toast.classList.add('translate-y-10', 'opacity-0');
                }, 3000);
            }
        } else {
            SysUI.alert(`Se ha guardado el progreso de ${escaneados.length} vouchers.\n\nPuede cerrar esta ventana con seguridad. La próxima vez que cargue facturación, el sistema aplicará un auto-match.`, "Borrador Guardado", "success");
        }
    },

    iniciarAutoGuardado: function() {
        this.detenerAutoGuardado(); // Prevenir duplicados
        // Se ejecuta cada 60,000 ms (1 minuto)
        this.autoSaveInterval = setInterval(() => {
            this.guardarBorrador(true);
        }, 60000); 
    },

    detenerAutoGuardado: function() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    },

    limpiarBorrador: function() {
        localStorage.removeItem(this.getDraftKey());
    },

    aplicarAutoMatchBorrador: async function() {
        const draftStr = localStorage.getItem(this.getDraftKey());
        if (!draftStr) return false;

        try {
            const borrador = JSON.parse(draftStr);
            const cantidadGuardada = borrador.contratos_listos.length;
            
            const msg = `Se ha detectado un Borrador guardado el:\n${borrador.fecha}\n\nCon un progreso de ${cantidadGuardada} facturas escaneadas.\n\n¿Desea restaurar su progreso y aplicar un Auto-Match a estas transacciones?`;
            const restaurar = await SysUI.confirm(msg, "Progreso Detectado", "info");
            
            if (restaurar) {
                let recuperados = 0;
                this.transacciones.forEach(t => {
                    if (borrador.contratos_listos.includes(t.Numero_Contrato)) {
                        t._selected = true;
                        t._matchTime = Date.now();
                        recuperados++;
                    }
                });
                
                SysUI.alert(`Se recuperaron con éxito ${recuperados} de los ${cantidadGuardada} vouchers guardados.`, "Auto-Match Finalizado", "success");
            } else {
                // Si dice que no, destruimos el borrador viejo para no seguir molestando
                this.limpiarBorrador();
            }
        } catch (e) {
            console.error("Error al leer borrador:", e);
            this.limpiarBorrador();
        }
    },


    // =====================================================================
    // LÓGICA DEL ESCÁNER Y CIERRE TSD
    // =====================================================================
    loadFacturacion: async function(manualDates = null) {
        this.resetView();

        // UI Loading
        document.getElementById('cc-search-section').classList.add('hidden');
        document.getElementById('cc-home-view').classList.add('hidden');
        document.getElementById('cc-loading').classList.remove('hidden');
        document.getElementById('cc-loading').classList.add('flex');

        try {
            const payload = manualDates ? { manual_dates: manualDates } : {};
            const res = await fetch(`api/get_facturacion_cc.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            document.getElementById('cc-loading').classList.add('hidden');
            document.getElementById('cc-loading').classList.remove('flex');

            if (!data.success) {
                if (data.requires_init) {
                    const fechas = await this.showInitializationModal(data.pending);
                    if (fechas) {
                        return this.loadFacturacion(fechas); // Reintentar recursivamente
                    } else {
                        // Usuario canceló
                        document.getElementById('cc-search-section').classList.remove('hidden');
                        document.getElementById('cc-home-view').classList.remove('hidden');
                        return;
                    }
                }
                document.getElementById('cc-search-section').classList.remove('hidden');
                document.getElementById('cc-home-view').classList.remove('hidden');
                return SysUI.alert(data.error, "Atención", "warning");
            }

            if (data.transacciones.length === 0) {
                document.getElementById('cc-search-section').classList.remove('hidden');
                document.getElementById('cc-home-view').classList.remove('hidden');
                return SysUI.alert("No hay nuevas facturas generadas en TSD desde su último corte de caja para las sucursales asignadas.", "Todo al día 🎉", "success");
            }

            this.currentFacturacion = true;
            
            // Mantenemos compatibilidad con el código viejo inyectando datos compuestos
            const sucursalesConcat = data.metadatos.map(m => m.sucursal).join(', ');
            
            this.headerData = {
                sucursalesRaw: sucursalesConcat,
                icdsRaw: data.icds_info,
                LOC_CODE: sucursalesConcat, // Alias para no romper tu executeSaveAndSend
                Nombre_Sucursal: 'Múltiples',
                Nombre_Usuario: 'Auto/Múltiples',
                CreateDate: new Date().toISOString()
            };
            
            // Pintar Metadatos
            const listHtml = data.metadatos.map(m => `<div>🏢 ${m.sucursal} - ${m.nombre} <span class="text-slate-400 font-normal ml-2">Desde: ${m.desde}</span></div>`).join('');
            document.getElementById('meta-sucursales-list').innerHTML = listHtml;
            document.getElementById('meta-icd-list').innerText = data.icds_info || "Ninguno";

            // Warning si hay ICDs abiertos
            if (data.icds_abiertos && data.icds_abiertos.length > 0) {
                const msg = `⚠️ Hay ICDs sin cerrar en TSD:\n\n${data.icds_abiertos.join(', ')}\n\nPuede continuar conciliando el dinero, pero el sistema NO LE PERMITIRÁ GUARDAR EL CIERRE hasta que vaya a TSD y cierre estos ICDs oficialmente.`;
                await SysUI.alert(msg, "Alerta de Cierre TSD", "warning");
            }

            // Adaptamos _selected o matched dependiendo de cómo lo use tu renderTransacciones
            this.transacciones = data.transacciones.map(t => ({...t, matched: false, _selected: false}));
            
            // 🚨 DISPARADOR DE BORRADORES 🚨
            await this.aplicarAutoMatchBorrador();

            this.renderTransacciones();
            
            document.getElementById('cc-workspace').classList.remove('hidden');
            setTimeout(() => document.getElementById('cc-scan-auth').focus(), 100);

            // Iniciar Auto-Guardado cada minuto
            this.iniciarAutoGuardado();

        } catch (err) {
            console.error("Fallo interno en JS:", err); // <--- ESTO NOS DIRÁ LA LÍNEA EXACTA SI FALLA
            document.getElementById('cc-loading').classList.add('hidden');
            document.getElementById('cc-loading').classList.remove('flex');
            document.getElementById('cc-search-section').classList.remove('hidden');
            document.getElementById('cc-home-view').classList.remove('hidden');
            SysUI.alert("Error interno al procesar los datos de facturación.", "Error de UI", "error");
        }
    },

    fillMetadata: function() {
        const h = this.headerData;
        const fechaCr = h.CreateDate ? h.CreateDate.split('.')[0] : 'N/A';
        document.getElementById('meta-icd').innerText = h.DBRNum;
        document.getElementById('meta-sucursal').innerText = `${h.LOC_CODE} - ${h.Nombre_Sucursal}`;
        document.getElementById('meta-usuario').innerText = h.Nombre_Usuario;
        document.getElementById('meta-fecha').innerText = fechaCr;
        
        const elMarca = document.getElementById('meta-marca');
        if (h.Nombre_Marca) {
            elMarca.innerText = h.Nombre_Marca; 
            elMarca.className = "inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold border shadow-sm ";
            if (h.Nombre_Marca.includes('Alamo')) elMarca.className += "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700";
            else if (h.Nombre_Marca.includes('Enterprise')) elMarca.className += "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700";
            else if (h.Nombre_Marca.includes('National')) elMarca.className += "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700";
            else elMarca.className += "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600";
        } else {
            elMarca.innerText = 'NO DEFINIDA';
            elMarca.className = "inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700";
        }
    },

    handleScanner: function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputAuth = document.getElementById('cc-scan-auth');
            const inputMonto = document.getElementById('cc-scan-monto');
            const authVal = inputAuth.value.trim().toUpperCase();
            const montoVal = parseFloat(inputMonto.value.replace(/,/g, '')); 
            
            if (authVal === '') { inputAuth.focus(); return; }
            if (isNaN(montoVal)) { inputMonto.focus(); return; }

            let matchIndex = -1;
            for (let i = 0; i < this.transacciones.length; i++) {
                let t = this.transacciones[i];
                if (t._selected) continue; 
                let authBD = t.Numero_Autorizacion ? String(t.Numero_Autorizacion).trim().toUpperCase() : '';
                
                // 1ra Condición: Autorización Exacta
                if (authBD === authVal) {
                    
                    // 2da Condición: Monto con Tolerancia (Margen 3%)
                    let montoBD = parseFloat(t.Conversion || 0);
                    
                    // Usamos Math.abs para asegurar que la tolerancia siempre sea un valor positivo
                    let toleranciaAbsoluta = Math.abs(montoBD) * 0.03; 
                    
                    // Ordenamos los límites para que funcione igual con positivos y negativos
                    let limiteMinimo = Math.min(montoBD - toleranciaAbsoluta, montoBD + toleranciaAbsoluta);
                    let limiteMaximo = Math.max(montoBD - toleranciaAbsoluta, montoBD + toleranciaAbsoluta);

                    // Imprime en consola para auditoría visual si el monto está cerca
                    if (montoVal >= limiteMinimo && montoVal <= limiteMaximo) {
                        matchIndex = i;
                        break; 
                    } else {
                        console.warn(`Monto ingresado (${montoVal}) fuera del rango permitido (${limiteMinimo.toFixed(2)} a ${limiteMaximo.toFixed(2)}) para la autorización ${authVal}`);
                    }
                }
            }

            if (matchIndex !== -1) {
                this.transacciones[matchIndex]._selected = true;
                this.transacciones[matchIndex]._matchTime = Date.now(); 
                inputAuth.value = ''; inputMonto.value = '';
                inputAuth.classList.add('bg-green-100', 'border-green-500', 'text-green-800');
                inputMonto.classList.add('bg-green-100', 'border-green-500', 'text-green-800');
                setTimeout(() => {
                    inputAuth.classList.remove('bg-green-100', 'border-green-500', 'text-green-800');
                    inputMonto.classList.remove('bg-green-100', 'border-green-500', 'text-green-800');
                }, 300);
                this.renderTransacciones(); 
                setTimeout(() => inputAuth.focus({ preventScroll: true }), 50);
            } else {
                inputAuth.classList.add('bg-red-100', 'border-red-500', 'text-red-800', 'animate-shake');
                inputMonto.classList.add('bg-red-100', 'border-red-500', 'text-red-800', 'animate-shake');
                setTimeout(() => {
                    inputAuth.classList.remove('bg-red-100', 'border-red-500', 'text-red-800', 'animate-shake');
                    inputMonto.classList.remove('bg-red-100', 'border-red-500', 'text-red-800', 'animate-shake');
                }, 500);
                inputMonto.select(); 
            }
        }
    },

    renderTransacciones: function() {
        const list = document.getElementById('cc-transactions-list');
        list.innerHTML = '';
        if (this.transacciones.length === 0) return;

        // 1. Agrupar la data por Sucursal primero, pero empujar los _selected al inicio global
        const sorted = [...this.transacciones].map((t, i) => ({...t, originalIndex: i}))
            .sort((a, b) => {
                // Prioridad 1: Los seleccionados van arriba de todo
                if (a._selected && !b._selected) return -1;
                if (!a._selected && b._selected) return 1;
                if (a._selected && b._selected) return b._matchTime - a._matchTime;
                
                // Prioridad 2: Si no están seleccionados, agrupar por Sucursal alfabéticamente
                if (a.Sucursal < b.Sucursal) return -1;
                if (a.Sucursal > b.Sucursal) return 1;
                
                // Prioridad 3: Ordenar por hora (más recientes abajo)
                return new Date(a.Pay_Date) - new Date(b.Pay_Date);
            });

        let currentSucursal = "";

        sorted.forEach((t, renderIndex) => {
            // Inyectar Separador de Grupo (Solo si no está seleccionado, porque los seleccionados van en una pila global)
            if (!t._selected && currentSucursal !== t.Sucursal) {
                currentSucursal = t.Sucursal;
                const headerDiv = document.createElement('div');
                headerDiv.className = "col-span-full mt-6 mb-2 flex items-center";
                headerDiv.innerHTML = `
                    <div class="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-r-lg border-l-4 border-indigo-500 shadow-sm">
                        🏢 Bloque Sucursal: ${currentSucursal}
                    </div>
                    <div class="h-px bg-slate-200 dark:bg-slate-700 flex-grow ml-4"></div>
                `;
                list.appendChild(headerDiv);
            }

            const div = document.createElement('div');
            const isSel = t._selected;
            const animClass = (isSel && renderIndex === 0) ? 'animate-fade-in-up' : '';

            div.className = `p-3 sm:p-4 rounded-xl border-2 transition-all shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-4 select-none ${animClass} 
                ${isSel ? 'border-green-500 bg-green-50 dark:bg-green-900/20 opacity-100' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`;
            
            // Lógica de Doble Ciego Híbrido: Si el monto es negativo, se muestra la verdad.
            const montoCRC = parseFloat(t.Conversion || 0);
            const montoUSD = parseFloat(t.Monto_Pago || 0);
            const esNegativo = montoCRC < 0;
            const esVisible = isSel || esNegativo; // Si es negativo O está seleccionado, lo mostramos

            const displayAuth = isSel ? (t.Numero_Autorizacion || 'SIN_AUT') : '••••••';
            const displayMontoUSD = esVisible ? `$${montoUSD.toFixed(2)}` : '$••.•';
            const displayMontoCRC = esVisible ? `₡${montoCRC.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2})}` : '₡••••.•';
            
            // Extraer la Hora del string "YYYY-MM-DD HH:MM:SS.MMM"
            const horaPago = t.Pay_Date ? t.Pay_Date.split(' ')[1].substring(0, 5) : '--:--';

            div.innerHTML = `
                <div class="shrink-0 self-start sm:self-center">
                    <div class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isSel ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}">
                        ${isSel ? '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
                    </div>
                </div>
                <div class="flex-grow flex flex-col sm:flex-row justify-between w-full gap-2">
                    <div>
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                CTO: 
                                <span onclick="window.CierreCajasLogic.copiarContrato('${t.Numero_Contrato}', this)" class="text-slate-600 dark:text-slate-300 cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-1 group" title="Clic para copiar">
                                    ${t.Numero_Contrato}
                                    <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                </span>
                            </span>
                            <span class="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">🏢 ${t.Sucursal}</span>
                            <span class="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">🕒 ${horaPago}</span>
                        </div>
                        <div class="text-sm font-black ${isSel ? 'text-green-800 dark:text-green-300' : 'text-slate-800 dark:text-white'} leading-tight uppercase">${t.Nombre} ${t.Apellido}</div>
                        <div class="text-[11px] font-bold ${isSel ? 'text-green-600' : 'text-indigo-600 dark:text-indigo-400'} mt-1 font-mono">
                            AUT: <span class="${isSel ? '' : 'tracking-widest opacity-60'}">${displayAuth}</span> <span class="text-slate-400 font-sans font-normal mx-1">•</span> ${t.Tipo_Tarjeta}
                        </div>
                    </div>
                    <div class="text-left sm:text-right mt-2 sm:mt-0">
                        <div class="text-lg font-black font-mono ${isSel ? 'text-green-700 dark:text-green-400' : (esNegativo ? 'text-red-500' : 'text-slate-700 dark:text-slate-300')}">${displayMontoUSD}</div>
                        <div class="text-[10px] font-bold ${isSel ? 'text-slate-500' : (esNegativo ? 'text-red-400' : 'text-slate-500 tracking-widest opacity-60')}">${displayMontoCRC}</div>
                    </div>
                </div>`;
            
            list.appendChild(div);
        });
        this.updateTotals();
    },

    updateTotals: function() {
        const selected = this.transacciones.filter(t => t._selected);
        const totalCRC = selected.reduce((sum, t) => sum + parseFloat(t.Conversion || 0), 0);
        
        document.getElementById('cc-total-count').innerText = this.transacciones.length;
        document.getElementById('cc-sel-count').innerText = selected.length;
        document.getElementById('cc-sel-total').innerText = '₡' + totalCRC.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2});
        
        const btn = document.getElementById('btn-save-cierre');
        if (selected.length > 0) {
            btn.disabled = false;
            btn.classList.toggle('animate-pulse', selected.length === this.transacciones.length);
        } else {
            btn.disabled = true;
            btn.classList.remove('animate-pulse');
        }
    },

    resetView: function() {
        this.detenerAutoGuardado(); // Mata el reloj de auto-guardado
        this.currentFacturacion = false; // Apaga la bandera de cierre activo
        this.headerData = null;
        this.transacciones = [];
        
        const workspace = document.getElementById('cc-workspace');
        const sucBandeja = document.getElementById('cc-sucursal-bandeja');
        
        if(workspace) workspace.classList.add('hidden');
        if(sucBandeja) sucBandeja.classList.add('hidden');
        
        document.getElementById('cc-transactions-list').innerHTML = '';
        
        // Limpieza de inputs
        const scannerAuth = document.getElementById('cc-scan-auth');
        const scannerMonto = document.getElementById('cc-scan-monto');
        if(scannerAuth) scannerAuth.value = '';
        if(scannerMonto) scannerMonto.value = '';
        
        document.getElementById('cc-total-count').innerText = '0';
        document.getElementById('cc-sel-count').innerText = '0';
        document.getElementById('cc-sel-total').innerText = '₡0.00';
        
        const btnSave = document.getElementById('btn-save-cierre');
        if (btnSave) {
            btnSave.disabled = true;
            btnSave.classList.remove('animate-pulse');
        }

        // --- DEVOLVER AL USUARIO A LA VISTA HOME (Bandeja) ---
        const homeView = document.getElementById('cc-home-view');
        if(homeView) homeView.classList.remove('hidden');
        
    },

    saveCierre: async function() {
        const selectedCount = this.transacciones.filter(t => t._selected).length;
        const unselected = this.transacciones.filter(t => !t._selected);
        const nombresSucs = this.headerData.sucursalesRaw;
        
        let confirmMsg = "";
        if (unselected.length > 0) {
            confirmMsg = `Resumen del Cierre [${nombresSucs}]:\n\n` +
                         `✅ Conciliados: ${selectedCount}\n` +
                         `⚠️ Pendientes (Sin Match): ${unselected.length}\n\n` +
                         `Los casos pendientes quedarán guardados en su "Bandeja de Pendientes" para que pueda justificarlos y enviarlos a la jefatura posteriormente.\n\n¿Desea registrar el cierre?`;
            
            const confirm = await SysUI.confirm(confirmMsg, "Confirmar Cierre Parcial", "warning");
            if (!confirm) return;
            this.executeSaveAndSend(true); // true = crea casos borrador
        } else {
            confirmMsg = `Resumen del Cierre [${nombresSucs}]:\n\n` +
                         `✅ Conciliados y Listos: ${selectedCount}\n\n` +
                         `Todas las transacciones cuadraron perfectamente. ¿Desea registrar el cierre definitivo?`;
            
            const confirm = await SysUI.confirm(confirmMsg, "Confirmar Cierre Total", "info");
            if (!confirm) return;
            this.executeSaveAndSend(false);
        }
    },

    executeSaveAndSend: async function(crearCasos) {
        const selected = this.transacciones.filter(t => t._selected);
        const unselected = this.transacciones.filter(t => !t._selected);
        
        const totalCRC = selected.reduce((sum, t) => sum + parseFloat(t.Conversion || 0), 0);
        const totalUSD = selected.reduce((sum, t) => sum + parseFloat(t.Monto_Pago || 0), 0);

        const payload = {
            // Variables de la nueva arquitectura (Ya no hay 1 solo ICD ni 1 sola sucursal)
            icds_involucrados: this.headerData.icdsRaw || '',
            sucursales: this.headerData.sucursalesRaw || '',
            
            // Estos campos ya no aplican al modelo de corte por hora, los mandamos null para no romper el backend
            usuario_tsd: 'Múltiples AR',
            fecha_tsd: null, 
            
            total_crc: totalCRC,
            total_usd: totalUSD,
            total_escaneadas: selected.length,
            total_transacciones: this.transacciones.length,
            transacciones: this.transacciones.map(t => ({
                contrato: t.Numero_Contrato,
                nombre: `${t.Nombre} ${t.Apellido}`.trim(),
                tarjeta: t.Tipo_Tarjeta,
                autorizacion: t.Numero_Autorizacion,
                monto_usd: parseFloat(t.Monto_Pago || 0),
                tc: parseFloat(t.Tipo_Cambio_Dia || 0),
                monto_crc: parseFloat(t.Conversion || 0),
                match_exitoso: t._selected ? 1 : 0,
                fecha_pago: t.Pay_Date
            }))
        };

        if (crearCasos) {
            payload.casos_borrador = unselected.map(t => ({
                contrato: t.Numero_Contrato,
                cliente: `${t.Nombre} ${t.Apellido}`.trim(),
                monto_crc: parseFloat(t.Conversion || 0),
                icd: t.ICD || "PENDIENTE TSD", // Enviamos el ICD original o "PENDIENTE TSD" si viene vacío
                sucursal: t.Sucursal, // Enviamos la sucursal exacta donde falló
                motivo: "" 
            }));
        }

        const btn = document.getElementById('btn-save-cierre');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "Guardando en BD...";

        try {
            const res = await fetch('api/save_cierre_caja.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                // 🚨 LIMPIEZA DE BORRADOR 🚨 (El cierre oficial mata el borrador temporal)
                this.limpiarBorrador();

                const nombreSucs = this.headerData.sucursalesRaw;
                let msgExito = `El cierre de caja para las sucursales [${nombreSucs}] se guardó correctamente.\nFolio de Auditoría: #${data.id_cierre}`;
                if (crearCasos) {
                    msgExito += `\n\n⚠️ Se crearon ${payload.casos_borrador.length} casos en "Borrador". Se han enviado a su Bandeja de Pendientes.`;
                }

                await SysUI.alert(msgExito, "Cierre Finalizado", "success");
                
                this.resetView();
                document.getElementById('cc-home-view').classList.remove('hidden');
                
                // Recargar bandeja local al terminar un cierre para que aparezcan los nuevos errores
                this.loadBandejaPendientes();
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            console.error(e);
            SysUI.alert("Ocurrió un error: " + e.message, "Error Crítico", "error");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    // =====================================================================
    // MÓDULO DE HISTORIAL Y TRAZABILIDAD (BPM / SERVER-SIDE)
    // =====================================================================
    historyUserRole: '',
    dataActivos: [], // Los activos siempre viven en memoria porque son pocos
    
    // Parámetros Remotos para Resueltos
    resueltosCurrentPage: 1,
    resueltosSearchTerm: '',

    switchTab: function(tab) {
        const tabs = ['workspace', 'history', 'audit'];
        const views = {
            'workspace': ['cc-home-view', 'cc-workspace', 'cc-search-section'],
            'history': ['cc-history-view'],
            'audit': ['cc-audit-view']
        };

        const activeClass = "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20".split(' ');
        const inactiveClass = "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300".split(' ');

        // 1. Limpiar y Ocultar TODO de forma segura
        tabs.forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (btn) {
                btn.classList.remove(...activeClass, ...inactiveClass);
                btn.classList.add(...inactiveClass);
            }
            
            views[t].forEach(vId => {
                const el = document.getElementById(vId);
                // Asegurarse de que el elemento exista antes de tocar sus clases
                if(el) {
                    el.classList.add('hidden');
                    el.classList.remove('flex'); // Limpiar flex si lo tuviera
                }
            });
        });

        // 2. Activar la Pestaña Seleccionada
        const activeBtn = document.getElementById(`tab-${tab}`);
        if (activeBtn) {
            activeBtn.classList.remove(...inactiveClass);
            activeBtn.classList.add(...activeClass);
        }

        // 3. Mostrar Vistas Correspondientes Seguras
        if (tab === 'workspace') {
            const searchSec = document.getElementById('cc-search-section');
            if(searchSec) searchSec.classList.remove('hidden');
            
            if (this.currentFacturacion) {
                const ws = document.getElementById('cc-workspace');
                if(ws) ws.classList.remove('hidden');
            } else {
                const hv = document.getElementById('cc-home-view');
                if(hv) hv.classList.remove('hidden');
            }
        } 
        else if (tab === 'history') {
            const histView = document.getElementById('cc-history-view');
            if(histView) {
                histView.classList.remove('hidden');
                histView.classList.add('flex');
            }
            this.loadHistoryData();
        }
        else if (tab === 'audit') {
            const auditView = document.getElementById('cc-audit-view');
            if(auditView) {
                auditView.classList.remove('hidden');
                auditView.classList.add('flex');
                
                // Configurar fechas por defecto (Últimos 7 días) si están vacías
                const inputDesde = document.getElementById('forense-desde');
                const inputHasta = document.getElementById('forense-hasta');
                if (!inputDesde.value) {
                    const hoy = new Date();
                    const hace7 = new Date(hoy);
                    hace7.setDate(hoy.getDate() - 7);
                    
                    inputHasta.value = hoy.toISOString().split('T')[0];
                    inputDesde.value = hace7.toISOString().split('T')[0];
                    
                    // Cargar datos automáticamente la primera vez
                    this.loadForense();
                }
            } else {
                // Si el div fue borrado accidentalmente del HTML, mostramos una alerta para que el DEV sepa qué falta.
                console.error("Falta el contenedor <div id='cc-audit-view'> en cierre_cajas.php");
                SysUI.alert("Error de Interfaz: El módulo de Auditoría no está disponible en este momento.", "Falta Vista", "error");
            }
        }
    },

    loadHistoryData: async function(isSilent = false) {
        const containerUrgentes = document.getElementById('cc-urgentes-cards');
        const containerResueltos = document.getElementById('cc-resueltos-cards');
        
        if (!isSilent) {
            containerUrgentes.innerHTML = '<div class="col-span-full flex justify-center py-6"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>';
            containerResueltos.innerHTML = '<div class="col-span-full flex justify-center py-6"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>';
        }

        try {
            // Pasamos los parámetros al backend
            const term = encodeURIComponent(this.resueltosSearchTerm);
            const url = `api/get_casos_historial_cc.php?page=${this.resueltosCurrentPage}&search=${term}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            if (!data.success) throw new Error(data.error);

            this.historyUserRole = data.userRole; 
            this.dataActivos = data.activos;
            
            // Actualizar contadores
            document.getElementById('count-urgentes').innerText = this.dataActivos.length;
            document.getElementById('count-resueltos').innerText = data.paginacion.total; // El real de la BD

            // Disparar renderizado en memoria de Activos
            this.filterActivos();
            
            // Disparar renderizado directo de los Resueltos traídos por el Backend
            this.renderResueltosServer(data.resueltos, data.paginacion);

            if (!isSilent) {
                this.switchSubTab('activos');
            }

        } catch (e) {
            if (!isSilent) containerUrgentes.innerHTML = `<div class="col-span-full text-center text-red-500 font-bold py-10">${e.message}</div>`;
        }
    },

    switchSubTab: function(tab) {
        const btnActivos = document.getElementById('subtab-activos');
        const btnResueltos = document.getElementById('subtab-resueltos');
        const secActivos = document.getElementById('cc-section-activos');
        const secResueltos = document.getElementById('cc-section-resueltos');

        const activeClass = "border-amber-500 text-amber-600 dark:text-amber-500".split(' ');
        const inactiveClass = "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300".split(' ');

        btnActivos.classList.remove(...activeClass, ...inactiveClass);
        btnResueltos.classList.remove(...activeClass, ...inactiveClass);

        if (tab === 'activos') {
            btnActivos.classList.add(...activeClass);
            btnResueltos.classList.add(...inactiveClass);
            secActivos.classList.remove('hidden');
            secActivos.classList.add('flex');
            secResueltos.classList.add('hidden');
            secResueltos.classList.remove('flex');
        } else {
            btnResueltos.classList.add(...activeClass);
            btnActivos.classList.add(...inactiveClass);
            secResueltos.classList.remove('hidden');
            secResueltos.classList.add('flex');
            secActivos.classList.add('hidden');
            secActivos.classList.remove('flex');
        }
    },

    filterActivos: function() {
        const term = document.getElementById('search-activos').value.toLowerCase();
        const contUrgentes = document.getElementById('cc-urgentes-cards');

        // Búsqueda en memoria (RAM) porque los activos son pocos
        const filtered = this.dataActivos.filter(c => {
            return c.NumeroContrato.toLowerCase().includes(term) || 
                   c.NombreCliente.toLowerCase().includes(term) || 
                   c.Sucursal_Relacionada.toLowerCase().includes(term);
        });

        if (filtered.length === 0) {
            contUrgentes.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400 text-sm">No se encontraron casos activos.</div>';
        } else {
            contUrgentes.innerHTML = filtered.map(c => this.generateCardHTML(c)).join('');
        }
    },

    // Nueva función: Se llama al apretar Enter en el buscador de resueltos
    searchResueltosServer: function() {
        this.resueltosSearchTerm = document.getElementById('search-resueltos').value.trim();
        this.resueltosCurrentPage = 1; // Volver a pag 1 por si cambió la búsqueda
        
        document.getElementById('cc-resueltos-cards').innerHTML = '<div class="col-span-full flex justify-center py-6"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>';
        
        this.loadHistoryData(true); // true = Carga silenciosa (No limpia las otras pestañas)
    },

    renderResueltosServer: function(casosArray, paginacion) {
        const contResueltos = document.getElementById('cc-resueltos-cards');
        
        if (casosArray.length === 0) {
            contResueltos.innerHTML = '<div class="col-span-full text-center py-10 text-slate-400 text-sm">No se encontraron resultados en el histórico de la base de datos.</div>';
            document.getElementById('cc-pagination-controls').classList.add('hidden');
            return;
        }

        contResueltos.innerHTML = casosArray.map(c => this.generateCardHTML(c)).join('');

        // Controles Paginación
        const maxPages = paginacion.total_paginas;
        
        document.getElementById('cc-pagination-controls').classList.remove('hidden');
        document.getElementById('pag-current').innerText = this.resueltosCurrentPage;
        document.getElementById('pag-total').innerText = maxPages;

        document.getElementById('btn-hist-prev').disabled = (this.resueltosCurrentPage <= 1);
        document.getElementById('btn-hist-next').disabled = (this.resueltosCurrentPage >= maxPages);
    },

    changeHistoryPage: function(direction) {
        this.resueltosCurrentPage += direction;
        
        document.getElementById('cc-resueltos-cards').innerHTML = '<div class="col-span-full flex justify-center py-6"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div></div>';
        
        this.loadHistoryData(true);
    },

    // Extrajimos el HTML de la tarjeta para reutilizarlo en ambos lados
    generateCardHTML: function(c) {
        let colorBorder = 'border-slate-300 dark:border-slate-600';
        let colorBadge = 'bg-slate-100 text-slate-600';
        
        if(c.Estado === 'NO_REPORTADO') { colorBorder = 'border-red-300'; colorBadge = 'bg-red-100 text-red-700'; }
        if(c.Estado === 'PENDIENTE_VISTO_BUENO') { colorBorder = 'border-purple-300 border-l-4'; colorBadge = 'bg-purple-100 text-purple-700'; }
        if(c.Estado === 'PENDIENTE_RESOLUCION') { colorBorder = 'border-amber-300'; colorBadge = 'bg-amber-100 text-amber-700'; }
        if(c.Estado === 'RESUELTO') { colorBorder = 'border-green-400 border-l-4'; colorBadge = 'bg-green-100 text-green-700'; }

        const monto = parseFloat(c.MontoCRC).toLocaleString('en-US', {minimumFractionDigits: 2});

        return `
        <div onclick="window.CierreCajasLogic.showTimeline(${c.IdCaso})" class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all border ${colorBorder} flex flex-col h-full group animate-fade-in-up">
            <div class="flex justify-between items-start mb-3">
                <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${colorBadge}">${c.Estado === 'PENDIENTE_VISTO_BUENO' ? 'ESCALADO A JEFATURA' : c.Estado.replace(/_/g, ' ')}</span>
                <span class="text-[10px] text-slate-400 font-bold">${c.DiasAtraso > 0 ? c.DiasAtraso + 'd' : 'Hoy'}</span>
            </div>
            <h4 class="text-sm font-black text-slate-800 dark:text-white leading-tight mb-1 truncate" title="${c.NombreCliente}">${c.NombreCliente}</h4>
            <div class="text-[11px] font-mono text-slate-500 mb-3 border-b border-slate-100 dark:border-slate-700 pb-2 flex items-center gap-1">
                CTO: 
                <span onclick="event.stopPropagation(); window.CierreCajasLogic.copiarContrato('${c.NumeroContrato}', this)" class="text-slate-600 dark:text-slate-300 cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-1 group" title="Clic para copiar">
                    ${c.NumeroContrato}
                    <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </span>
            </div>
            
            <div class="mt-auto flex justify-between items-end">
                <div class="text-[10px] text-slate-500 uppercase font-bold max-w-[50%] truncate pr-2" title="${c.Sucursal_Relacionada}">
                    🏢 ${c.Sucursal_Relacionada.split(' ')[0]}
                </div>
                <div class="text-base font-black text-slate-800 dark:text-white font-mono">₡${monto}</div>
            </div>
        </div>`;
    },

    showTimeline: async function(idCaso) {
        this.activeTimelineId = idCaso;
        const modal = document.getElementById('modal-timeline');
        const eventContainer = document.getElementById('tl-events');
        const actionZone = document.getElementById('tl-action-zone');
        
        eventContainer.innerHTML = '<div class="text-slate-400 text-sm animate-pulse">Cargando bitácora...</div>';
        actionZone.classList.add('hidden');
        actionZone.innerHTML = '';
        modal.classList.remove('hidden');

        try {
            const res = await fetch(`api/get_timeline_cc.php?idCaso=${idCaso}`);
            const data = await res.json();
            
            if(!data.success) throw new Error(data.error);
            
            const c = data.caso;
            document.getElementById('tl-id').innerText = c.IdCaso;
            document.getElementById('tl-contrato').innerText = c.NumeroContrato;
            document.getElementById('tl-cliente').innerText = c.NombreCliente || 'Desconocido';
            document.getElementById('tl-monto').innerText = `₡${parseFloat(c.MontoCRC).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            document.getElementById('tl-usd').innerText = `$${parseFloat(c.MontoUSD).toLocaleString('en-US', {minimumFractionDigits: 2})}`;

            if (data.catalogo_justificaciones) {
                this.justificacionesCatalogo = data.catalogo_justificaciones;
            }

            // 1. DIBUJAR HISTORIAL
            eventContainer.innerHTML = data.historial.map(h => {
                const dateObj = new Date(h.FechaAccion);
                const fecha = dateObj.toLocaleDateString('es-CR') + ' ' + dateObj.toLocaleTimeString('es-CR', {hour: '2-digit', minute:'2-digit'});
                
                let dotColor = 'bg-slate-300';
                if(h.Accion.includes('CREADO')) dotColor = 'bg-slate-800 dark:bg-slate-100';
                if(h.Accion.includes('REPORTADO') || h.Accion.includes('ENVIADO')) dotColor = 'bg-amber-500';
                if(h.Accion.includes('RESUELTO')) dotColor = 'bg-green-500 ring-4 ring-green-100 dark:ring-green-900';

                return `
                <div class="relative">
                    <span class="absolute -left-[21px] sm:-left-[25px] top-1.5 w-2.5 h-2.5 rounded-full ${dotColor}"></span>
                    <div class="flex justify-between items-baseline mb-0.5">
                        <h4 class="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase">${h.Accion.replace(/_/g, ' ')}</h4>
                        <time class="text-[9px] font-bold text-slate-400">${fecha}</time>
                    </div>
                    <div class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-100 dark:border-slate-700">
                        <span class="font-bold text-indigo-500 block mb-0.5 text-[10px]">👤 ${h.EmailActor || 'Sistema'}</span>
                        ${h.ComentarioAdicional || 'Sin detalle.'}
                    </div>
                </div>`;
            }).join('');

            // 2. CONSTRUIR ZONA DE ACCIÓN BASADA EN ROLES Y ESTADO
            const role = this.historyUserRole; // 'agente', 'jefe', 'servicio_cliente', 'admin'
            let actionHtml = '';

            if (c.Estado === 'NO_REPORTADO' && (role === 'agente' || role === 'jefe' || role === 'admin')) {
                actionHtml = `
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Acción sobre la Inconsistencia</label>
                    <select id="tl-select-accion" class="w-full text-sm px-3 py-2 mb-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold transition-colors" onchange="window.CierreCajasLogic.toggleMotivoReq(this, 'tl-input-action')">
                        ${window.CierreCajasLogic.buildJustificacionesOptions()}
                    </select>
                    <textarea id="tl-input-action" rows="2" class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 resize-none mb-3" placeholder="Justifique el motivo..."></textarea>
                    <div class="flex justify-end">
                        <button onclick="window.CierreCajasLogic.executeTimelineAction('REPORTAR_DINAMICO')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow transition-colors flex items-center gap-2">
                            Procesar Caso
                        </button>
                    </div>
                `;
            }
            else if (c.Estado === 'PENDIENTE_VISTO_BUENO' && (role === 'jefe' || role === 'admin')) {
                actionHtml = `
                    <div class="flex flex-col gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Nota de Jefatura (Opcional)</label>
                            <textarea id="tl-input-action" rows="2" class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Escriba alguna nota para Servicio al Cliente..."></textarea>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <button onclick="window.CierreCajasLogic.executeTimelineAction('REVERTIR')" class="text-xs text-slate-400 hover:text-red-500 font-bold underline transition-colors">Rechazar (Volver a Agente)</button>
                            <button onclick="window.CierreCajasLogic.executeTimelineAction('ESCALAR_SC')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow transition-colors">
                                Escalar a SC
                            </button>
                        </div>
                    </div>
                `;
            }
            else if (c.Estado === 'PENDIENTE_RESOLUCION' && (role === 'servicio_cliente' || role === 'admin')) {
                actionHtml = `
                    <div class="flex flex-col gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Comentarios de Resolución en TSD</label>
                            <textarea id="tl-input-action" rows="2" class="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Escriba la acción correctiva realizada..."></textarea>
                        </div>
                        <div class="flex justify-between items-center mt-2">
                            <div></div>
                            <button onclick="window.CierreCajasLogic.executeTimelineAction('RESOLVER')" class="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow transition-colors">
                                Marcar como Resuelto
                            </button>
                        </div>
                    </div>
                `;
            }

            if (actionHtml !== '') {
                actionZone.innerHTML = actionHtml;
                actionZone.classList.remove('hidden');
            }

        } catch (e) {
            eventContainer.innerHTML = `<div class="text-red-500 text-sm font-bold">${e.message}</div>`;
        }
    },

    executeTimelineAction: async function(actionType) {
        const inputEl = document.getElementById('tl-input-action');
        const comentario = inputEl ? inputEl.value.trim() : '';
        
        let accionFinal = actionType;
        let isReporteDinamico = false;
        let idJustificacion = null;
        let textoVisor = '';
        let confirmMsg = "¿Está seguro de continuar con esta acción?";

        // Si viene del Modal en estado NO_REPORTADO, leemos el Select
        if (actionType === 'REPORTAR_DINAMICO') {
            isReporteDinamico = true;
            const selectEl = document.getElementById('tl-select-accion');
            const selectedOpt = selectEl.options[selectEl.selectedIndex];
            
            if (!selectedOpt.value) {
                selectEl.classList.add('ring-2', 'ring-red-500');
                return SysUI.alert("Debe seleccionar una acción de la lista.", "Acción Requerida", "warning");
            }
            
            accionFinal = selectedOpt.getAttribute('data-accion');
            idJustificacion = selectedOpt.value;
            textoVisor = selectedOpt.getAttribute('data-text');
            const reqComentario = selectedOpt.getAttribute('data-req') === '1';

            if (reqComentario && !comentario) {
                document.getElementById('tl-input-action').focus();
                return SysUI.alert("Esta acción requiere un comentario/justificación obligatoria.", "Campo requerido", "warning");
            }

            confirmMsg = accionFinal === 'CERRAR' 
                ? `¿Confirmar el cierre directo del caso por el motivo: ${textoVisor}?` 
                : "¿Enviar este caso a Jefatura para su visto bueno?";
                
        } else {
            // Validaciones para RESOLVER / REVERTIR / ESCALAR_SC
            if (accionFinal === 'RESOLVER' && !comentario) {
                return SysUI.alert("Debe escribir un comentario sobre la corrección realizada.", "Campo requerido", "warning");
            }
            if (accionFinal === 'RESOLVER') confirmMsg = "¿Confirmar que el caso ha sido corregido en TSD y marcar como resuelto?";
            if (accionFinal === 'REVERTIR') confirmMsg = "⚠️ ¿Está seguro de REVERTIR este caso? Perderá el avance y volverá a estado No Reportado.";
            if (accionFinal === 'ESCALAR_SC') confirmMsg = "¿Escalar este caso y enviarlo a Servicio al Cliente para su resolución?";
        }
        const confirm = await SysUI.confirm(confirmMsg, "Confirmar Acción", "info");
        if (!confirm) return;

        try {
            let url = 'api/procesar_accion_modal_cc.php';
            let payload = {
                idCaso: this.activeTimelineId,
                accion: accionFinal,
                comentario: comentario
            };

            // MAGIA DE ARQUITECTURA: Si el caso no ha sido reportado, lo pasamos por la API de correos masivos
            // empacado como un array de 1 elemento. Así garantizamos que el Jefe reciba el correo.
            if (isReporteDinamico) {
                url = 'api/enviar_casos_jefatura.php';
                payload = {
                    casos: [{
                        id_caso: this.activeTimelineId,
                        motivo: comentario,
                        accion: accionFinal,
                        id_justificacion: idJustificacion,
                        texto_visor: textoVisor
                    }]
                };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();

            if (data.success) {
                document.getElementById('modal-timeline').classList.add('hidden');
                SysUI.alert("Acción procesada correctamente.", "Éxito", "success");
                this.loadHistoryData(true); // Recarga las tarjetas
                this.loadBandejaPendientes(); // Recarga insignias
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            SysUI.alert("Error: " + e.message, "Error Crítico", "error");
        }
    },

    // =====================================================================
    // MÓDULO HISTORIAL FACTURACIÓN FORENSE (SERVER-SIDE PAGINATION)
    // =====================================================================
    vgAudit: null,
    forensePage: 1,

    // Esta función se llama desde los botones de Buscar y desde Enter (resetea la paginación a 1)
    resetAndLoadForense: function() {
        this.forensePage = 1;
        this.loadForense();
    },

    checkForenseFilters: function() {
        const fDesde = document.getElementById('forense-desde').value;
        const fHasta = document.getElementById('forense-hasta').value;
        const fBuscar = document.getElementById('forense-buscar').value.trim();
        const btnClear = document.getElementById('btn-clear-filters');
        
        if (!btnClear) return;

        // Calcular fechas por defecto del sistema (Últimos 7 días)
        const hoy = new Date();
        const hace7 = new Date(hoy);
        hace7.setDate(hoy.getDate() - 7);
        const defHasta = hoy.toISOString().split('T')[0];
        const defDesde = hace7.toISOString().split('T')[0];

        // Revisar si algún checkbox de sucursal está desmarcado
        const checkboxes = document.querySelectorAll('.cb-sucursal');
        const algunDesmarcado = checkboxes.length > 0 && Array.from(checkboxes).some(cb => !cb.checked);

        // Si hay cualquier cambio respecto al estado por defecto, mostramos el botón
        if (fBuscar !== '' || algunDesmarcado || fDesde !== defDesde || fHasta !== defHasta) {
            btnClear.classList.remove('hidden');
        } else {
            btnClear.classList.add('hidden');
        }
    },

    clearForenseFilters: function() {
        const hoy = new Date();
        const hace7 = new Date(hoy);
        hace7.setDate(hoy.getDate() - 7);
        
        document.getElementById('forense-hasta').value = hoy.toISOString().split('T')[0];
        document.getElementById('forense-desde').value = hace7.toISOString().split('T')[0];
        document.getElementById('forense-buscar').value = '';

        // Marcar todas las sucursales
        const checkboxes = document.querySelectorAll('.cb-sucursal');
        checkboxes.forEach(cb => cb.checked = true);
        
        // Actualizar el checkbox maestro "Seleccionar Todas" si existe
        const cbTodas = document.querySelector('input[onchange*="cbs.forEach"]');
        if (cbTodas) cbTodas.checked = true;

        this.updateMultiSelectUI();
        this.checkForenseFilters();
        this.resetAndLoadForense();
    },

    // Maneja la apertura, cierre y búsqueda del Dropdown Múltiple
    toggleForenseDropdown: function(e) {
        if(e) e.stopPropagation();
        const dd = document.getElementById('forense-sucursal-dropdown');
        
        if (dd.classList.contains('hidden')) {
            dd.classList.remove('hidden'); // Lo abre
            
            // Crea un "escuchador" temporal para detectar clics fuera del menú
            const closeDropdown = (evt) => {
                const btn = document.getElementById('forense-sucursal-btn-text').parentElement;
                if (!dd.contains(evt.target) && !btn.contains(evt.target)) {
                    dd.classList.add('hidden'); // Lo oculta
                    document.removeEventListener('click', closeDropdown); // Se destruye a sí mismo
                    window.CierreCajasLogic.resetAndLoadForense(); // Dispara la búsqueda oficial
                }
            };
            setTimeout(() => document.addEventListener('click', closeDropdown), 10);
        } else {
            dd.classList.add('hidden');
            window.CierreCajasLogic.resetAndLoadForense(); // Dispara la búsqueda si se cierra con el botón
        }
    },

    // Función para manejar el texto del botón del Multi-Select
    updateMultiSelectUI: function() {
        const checkboxes = document.querySelectorAll('.cb-sucursal');
        const seleccionados = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        const btnText = document.getElementById('forense-sucursal-btn-text');
        
        if (seleccionados.length === 0 || seleccionados.length === checkboxes.length) {
            btnText.innerText = "Todas las sucursales";
            return "TODAS";
        } else if (seleccionados.length === 1) {
            btnText.innerText = seleccionados[0];
            return seleccionados[0];
        } else {
            btnText.innerText = `${seleccionados.length} seleccionadas`;
            return seleccionados.join(',');
        }
    },

    loadForense: async function() {
        const fDesde = document.getElementById('forense-desde').value;
        const fHasta = document.getElementById('forense-hasta').value;
        const fBuscar = document.getElementById('forense-buscar').value.trim();
        
        // Determinar qué sucursales consultar
        let fSucursal = "TODAS";
        if (document.querySelectorAll('.cb-sucursal').length > 0) {
            fSucursal = this.updateMultiSelectUI();
        }

        if(!fDesde || !fHasta) return SysUI.alert("Debe seleccionar un rango de fechas válido.", "Filtros", "warning");

        this.checkForenseFilters(); // Mantiene sincronizado el estado del botón Limpiar

        // Cerrar menú si estaba abierto
        const dropdown = document.getElementById('forense-sucursal-dropdown');
        if (dropdown && !dropdown.classList.contains('hidden')) dropdown.classList.add('hidden');

        document.getElementById('cc-loading').classList.remove('hidden');
        document.getElementById('cc-loading').classList.add('flex');

        try {
            const url = `api/get_forense_cc.php?desde=${fDesde}&hasta=${fHasta}&search=${encodeURIComponent(fBuscar)}&sucursal=${encodeURIComponent(fSucursal)}&page=${this.forensePage}`;
            const res = await fetch(url);
            const json = await res.json();
            
            document.getElementById('cc-loading').classList.add('hidden');
            document.getElementById('cc-loading').classList.remove('flex');

            if (!json.success) return SysUI.alert(json.error, "Error en Auditoría", "error");

            // 1. Formateadores para VanillaGrid
            const statusFormatter = (cell) => {
                const val = cell.getValue() || 'LIMPIO (MATCH)';
                let color = 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:border-slate-700';
                
                if(val === 'LIMPIO (MATCH)') color = 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:border-emerald-800';
                if(val === 'NO_REPORTADO') color = 'bg-red-100 text-red-700 border border-red-200 dark:border-red-800';
                if(val.includes('PENDIENTE')) color = 'bg-amber-100 text-amber-700 border border-amber-200 dark:border-amber-800';
                if(val === 'RESUELTO') color = 'bg-green-100 text-green-700 border border-green-200 dark:border-green-800';
                
                return `<span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${color}">${val.replace(/_/g, ' ')}</span>`;
            };

            // 1. Llenar el Multi-Select de Sucursales (Solo la primera vez)
            const ddContainer = document.getElementById('forense-sucursal-dropdown');
            if (ddContainer.innerHTML.includes('Cargando...') && json.mis_sucursales) {
                ddContainer.innerHTML = `
                    <label class="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer rounded-lg border-b border-slate-100 dark:border-slate-700">
                        <input type="checkbox" onchange="const cbs = document.querySelectorAll('.cb-sucursal'); cbs.forEach(cb => cb.checked = this.checked); window.CierreCajasLogic.updateMultiSelectUI();" checked class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500">
                        <span class="text-sm font-bold text-slate-800 dark:text-white">Seleccionar Todas</span>
                    </label>
                ` + json.mis_sucursales.map(s => `
                    <label class="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer rounded-lg">
                        <input type="checkbox" value="${s.ID}" class="cb-sucursal w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" checked onchange="window.CierreCajasLogic.updateMultiSelectUI();">
                        <span class="text-sm text-slate-700 dark:text-slate-300">${s.ID} - ${s.NAME}</span>
                    </label>
                `).join('');
            }

            // 2. Llenar el Dashboard
            const totalTx = json.kpis.total_tx || 0;
            const totalErrores = json.kpis.total_tickets || 0;
            const totalLimpias = totalTx - totalErrores;
            const tasa = totalTx > 0 ? ((totalLimpias / totalTx) * 100).toFixed(1) : 100;
            const montoCRC = json.kpis.total_crc || 0;
            const montoError = json.kpis.monto_tickets_crc || 0;
            const impactoPorcentaje = montoCRC > 0 ? ((montoError / montoCRC) * 100).toFixed(1) : 0;

            document.getElementById('kpi-crc').innerText = `₡${parseFloat(montoCRC).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            document.getElementById('kpi-usd').innerText = `$${parseFloat(json.kpis.total_usd).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            
            // Animación de la barra de progreso
            document.getElementById('kpi-tasa').innerText = `${tasa}%`;
            document.getElementById('bar-exito').style.width = `${tasa}%`;
            document.getElementById('bar-error').style.width = `${100 - tasa}%`;
            document.getElementById('kpi-tx-limpias').innerText = totalLimpias;
            document.getElementById('kpi-tickets').innerText = totalErrores;

            document.getElementById('kpi-monto-tickets').innerText = `₡${parseFloat(montoError).toLocaleString('en-US', {minimumFractionDigits: 2})}`;
            document.getElementById('kpi-porcentaje-monto').innerText = `${impactoPorcentaje}%`;

            // 3. Definir Columnas (Optimizadas para Análisis Forense)
            const cols = [
                { title: "Folio", field: "FolioData", hozAlign: "center", formatter: (c) => {
                    const val = c.getValue() || '';
                    const partes = val.split('|');
                    return `<div class="flex flex-col items-center justify-center"><span class="font-mono text-slate-700 dark:text-slate-300 font-black" title="Folio de Cierre">#${partes[0]}</span><span class="text-[9px] text-slate-500 font-bold whitespace-nowrap mt-0.5 bg-slate-100 dark:bg-slate-700/50 px-1 rounded" title="Rango de facturación que abarca este cierre">${partes[1] || ''}</span></div>`;
                }},
                { title: "Hora Cierre", field: "HoraCierre", hozAlign: "center", formatter: (c) => `<span class="text-xs font-bold text-slate-500">⏱️ ${c.getValue()}</span>` },
                { title: "SUC", field: "SucursalReal", formatter: (c) => `<span class="font-bold text-indigo-700 dark:text-indigo-400">${(c.getValue() || '').split(',')[0]}</span>` },
                { title: "Contrato", field: "Numero_Contrato" },
                { title: "Cliente", field: "NombreCliente" },
                { title: "Monto CRC", field: "MontoCRC", formatter: "money", hozAlign: "right" },
                { title: "Agente", field: "Agente" },
                { title: "Estado", field: "EstadoTicket", formatter: statusFormatter },
                { title: "Ticket", field: "IdCaso", hozAlign: "center", formatter: (c) => c.getValue() ? `<span class="text-indigo-500 font-bold underline cursor-pointer hover:text-indigo-700">#${c.getValue()}</span>` : '-' },
                { title: "Motivo / Trámite", field: "MotivoTramiteSQL", formatter: (c) => {
                    const textoSQL = c.getValue() || '';
                    const partes = textoSQL.split('|'); // FORMATO: ESTADO | Visor | Motivo Agente
                    
                    if(partes[0] === 'LIMPIO') {
                        const comentarioCierre = partes[1] || 'Match Limpio';
                        return `<span class="text-[10px] text-slate-400 italic">${comentarioCierre}</span>`;
                    } else {
                        const visor = partes[1] ? `<b class="text-slate-800 dark:text-white">${partes[1]}</b><br>` : '';
                        const agenteMsg = partes[2] ? `"${partes[2]}"` : '';
                        return `<div class="text-[10px] leading-tight min-w-[150px] max-w-[200px] whitespace-normal text-slate-600 dark:text-slate-400">${visor}${agenteMsg}</div>`;
                    }
                }}
            ];

            // 4. Renderizar Grid (Solo 50 filas por página)
            if (this.vgAudit) {
                this.vgAudit.updateData(json.transacciones);
            } else {
                this.vgAudit = new VanillaGrid('#forense-grid', json.transacciones, cols, {
                    onRowDblClick: (row) => {
                        if (row.IdCaso) this.showTimeline(row.IdCaso);
                        else SysUI.alert("Esta transacción se concilió con éxito (Match Exacto) y no posee Ticket de error asociado.", "Transacción Limpia", "info");
                    }
                });
            }

            // 5. Control de Paginación
            document.getElementById('forense-pagination').classList.remove('hidden');
            document.getElementById('pag-forense-current').innerText = json.paginacion.pagina_actual;
            document.getElementById('pag-forense-total').innerText = json.paginacion.total_paginas;
            document.getElementById('pag-forense-registros').innerText = `${json.paginacion.total_registros} registros totales`;

            document.getElementById('btn-forense-prev').disabled = (json.paginacion.pagina_actual <= 1);
            document.getElementById('btn-forense-next').disabled = (json.paginacion.pagina_actual >= json.paginacion.total_paginas);

        } catch (e) {
            console.error("Error Forense:", e);
            document.getElementById('cc-loading').classList.add('hidden');
            document.getElementById('cc-loading').classList.remove('flex');
            SysUI.alert("Error al renderizar los datos: " + e.message, "Error en Auditoría", "error");
        }
    },

    changeForensePage: function(direction) {
        this.forensePage += direction;
        // Animación visual de carga en la tabla
        document.getElementById('forense-grid').innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>';
        this.loadForense();
    }
};

// =========================================================================
// HERRAMIENTA DE AUDITORÍA: REVELAR DATOS OCULTOS DEL LOTE ACTUAL (F12)
// Ejecutar en consola: window.rev() o window.rev('1234') o window.rev(50000)
// =========================================================================
window.rev = function(busqueda = '') {
    console.log("🕵️‍♂️ Consultando bóveda de RAM...");
    
    if (!window.CierreCajasLogic || !window.CierreCajasLogic.transacciones || window.CierreCajasLogic.transacciones.length === 0) {
        console.warn("⚠️ No hay transacciones cargadas en el módulo de trabajo.");
        return;
    }

    let t = window.CierreCajasLogic.transacciones;
    
    // Aplicamos filtro ninja si mandan un parámetro
    if (busqueda !== '') {
        const termino = String(busqueda).toLowerCase().trim();
        t = t.filter(fila => {
            const auth = (fila.Numero_Autorizacion || 'SIN_AUT').toLowerCase();
            const cto = (fila.Numero_Contrato || '').toLowerCase();
            const crc = Math.abs(parseFloat(fila.Conversion || 0)).toString();
            const usd = Math.abs(parseFloat(fila.Monto_Pago || 0)).toString();
            
            // Busca coincidencias parciales en Auth, Contrato o Montos (ignorando el signo de los montos)
            return auth.includes(termino) || cto.includes(termino) || crc.includes(termino) || usd.includes(termino);
        });

        console.log(`🎯 Filtrando por: "${busqueda}"... Se encontraron ${t.length} coincidencias.`);
    } else {
        console.log(`✅ Mostrando todas las ${t.length} transacciones originales del lote actual.`);
    }

    if (t.length === 0) return;

    // Mapeamos para la tabla visual
    const datosOcultos = t.map((fila, index) => ({
        "Sucursal": fila.Sucursal,
        "Contrato": fila.Numero_Contrato,
        "Cliente": `${fila.Nombre} ${fila.Apellido}`.trim(),
        "Estado": fila._selected ? "✅ MATCH" : "❌ OCULTO",
        "AUTORIZACIÓN REAL": fila.Numero_Autorizacion || 'SIN_AUT',
        "MONTO EXACTO (CRC)": `₡${parseFloat(fila.Conversion || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2})}`,
        "Monto Origen (USD)": `$${parseFloat(fila.Monto_Pago || 0).toFixed(2)}`
    }));

    // Imprimimos la tabla formateada nativamente en la consola
    console.table(datosOcultos);
};

// -----------------------------------------------------------
// EXPERIENCIA DE USUARIO (UX): PUNTO DE CORTE EN FRÍO
// -----------------------------------------------------------
window.CierreCajasLogic.showInitializationModal = function(pendingBranches) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 select-none';
        
        // Calculamos la fecha/hora actual en formato local para limitar el selector
        const nowLocal = new Date();
        nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset());
        const maxDateTime = nowLocal.toISOString().slice(0, 16);

        let inputsHtml = pendingBranches.map(b => `
            <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-3 transition-colors">
                <h4 class="text-sm font-black text-indigo-700 dark:text-indigo-400 mb-3 flex items-center gap-2">
                    <span class="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-md text-[10px] uppercase border border-indigo-200 dark:border-indigo-800">Sucursal</span>
                    ${b.codigo} - ${b.nombre}
                </h4>
                <div class="w-full relative">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha y Hora del último cierre</label>
                    <input type="datetime-local" data-code="${b.codigo}" class="init-datetime w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white transition-shadow [color-scheme:light] dark:[color-scheme:dark]" max="${maxDateTime}">
                </div>
            </div>
        `).join('');

        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col max-h-[90vh]">
                <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-indigo-600 shrink-0">
                    <h3 class="text-lg font-black text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Punto de Corte Inicial
                    </h3>
                </div>
                <div class="px-6 py-5 overflow-y-auto custom-scrollbar flex-grow bg-white dark:bg-slate-800">
                    <div class="mb-5 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                        <p class="text-sm text-blue-800 dark:text-blue-300 leading-relaxed font-medium">Se ha detectado que algunas sucursales <b>no tienen historial</b> de cortes en este sistema.</p>
                        <p class="text-sm text-blue-800 dark:text-blue-300 mt-2 leading-relaxed font-medium">Para evitar transacciones duplicadas, indique la <b>fecha y hora exacta</b> del último cierre físico realizado. El sistema buscará a partir de ese momento.</p>
                    </div>
                    ${inputsHtml}
                    <div id="init-error" class="hidden mt-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg border border-red-200 dark:border-red-800 animate-shake">
                        ⚠️ Debe completar la fecha y la hora para todas las sucursales listadas antes de continuar.
                    </div>
                </div>
                <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
                    <button id="init-btn-cancel" class="w-full sm:w-auto bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-5 py-2.5 rounded-xl font-bold transition-colors">Cancelar</button>
                    <button id="init-btn-save" class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-500/30 transition-all flex items-center justify-center gap-2">
                        Extraer Facturación
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Animación suave de entrada
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            overlay.children[0].classList.remove('scale-95');
        });

        const close = () => {
            overlay.classList.add('opacity-0');
            overlay.children[0].classList.add('scale-95');
            setTimeout(() => overlay.remove(), 300);
        };

        document.getElementById('init-btn-cancel').onclick = () => {
            close();
            resolve(null);
        };

        document.getElementById('init-btn-save').onclick = () => {
            const datetimes = document.querySelectorAll('.init-datetime');
            let manualDates = {};
            let hasErrors = false;

            datetimes.forEach(dt => {
                dt.classList.remove('ring-2', 'ring-red-500');

                if (!dt.value) {
                    dt.classList.add('ring-2', 'ring-red-500');
                    hasErrors = true;
                } else {
                    // El valor viene como "2026-05-31T15:30", lo convertimos a formato SQL "2026-05-31 15:30:00"
                    manualDates[dt.getAttribute('data-code')] = dt.value.replace('T', ' ') + ':00';
                }
            });

            if (hasErrors) {
                document.getElementById('init-error').innerText = '⚠️ Debe completar la fecha y hora para todas las sucursales listadas antes de continuar.';
                document.getElementById('init-error').classList.remove('hidden');
            } else {
                close();
                resolve(manualDates); // Retorna las fechas al método loadFacturacion
            }
        };
    });
};