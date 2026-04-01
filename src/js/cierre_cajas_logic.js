window.CierreCajasLogic = {
    currentICD: null,
    headerData: null,
    transacciones: [],
    pendientesData: [],
    currentUser: window.CURRENT_USER_NAME || 'Analista',

    init: function() {
        console.log("Módulo Cierre de Caja Iniciado");
        
        // Damos 50ms para garantizar que el DOM de la SPA ya está dibujado en pantalla
        // setTimeout(() => {
            const input = document.getElementById('cc-icd-input');
            
            if (input) {
                input.onkeydown = (e) => {
                    if(e.key === 'Enter') {
                        e.preventDefault();
                        this.searchICD();
                    }
                };
            }

            const homeView = document.getElementById('cc-home-view');
            const workspace = document.getElementById('cc-workspace');
            const actionBar = document.getElementById('cc-action-bar');

            if (homeView) homeView.classList.remove('hidden');
            if (workspace) workspace.classList.add('hidden');
            if (actionBar) actionBar.classList.add('translate-y-full');
            
            // Llama a la base de datos para traer los pendientes
            window.CierreCajasLogic.loadBandejaPendientes()
            
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

                // Input Reactivo para reportar
                let motivoHtml = `<textarea id="motivo-home-${c.IdCaso}" class="cc-motivo-input-home w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-400 transition-colors resize-none h-16" placeholder="Escriba aquí para justificar y reportar a la Jefatura..." oninput="this.classList.toggle('border-indigo-500', this.value.trim()!==''); this.classList.toggle('bg-indigo-50', this.value.trim()!=='')">${c.MotivoAgente || ''}</textarea>`;

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
                        <span class="text-[9px] font-bold text-indigo-500 bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-300 px-1.5 py-0.5 rounded" title="Reportado por">👤 ${c.CreadoPor.split(' ')[0]}</span>
                    </div>
                    <div class="text-sm font-black text-slate-800 dark:text-white leading-tight uppercase mb-1">${c.NombreCliente}</div>
                    <div class="flex justify-between items-center text-[10px] text-slate-500 font-bold mb-3 border-b border-amber-100 dark:border-amber-800/30 pb-2">
                        <span>ICD: <span class="font-mono text-slate-700 dark:text-slate-300">${c.ICD_Relacionado}</span></span>
                        <span class="text-amber-700 dark:text-amber-500">₡${parseFloat(c.MontoCRC).toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                    <input type="text" id="motivo-suc-${c.IdCaso}" class="cc-motivo-input-suc w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-800 dark:text-white rounded-lg outline-none placeholder:text-amber-300 dark:placeholder:text-amber-700 focus:ring-2 focus:ring-amber-400 transition-colors" placeholder="Escriba aquí para ayudar a reportar..." value="${c.MotivoAgente || ''}">
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
        const jefesInvolucrados = new Set(); // Evita jefes duplicados en la alerta

        inputsMotivo.forEach(input => {
            const motivo = input.value.trim();
            if (motivo !== '') {
                const parts = input.id.split('-');
                const idCaso = parts[parts.length - 1];
                casosData.push({ id_caso: idCaso, motivo: motivo });

                // Extraemos el jefe desde la memoria que guardamos
                const casoBd = this.pendientesData.find(c => c.IdCaso == idCaso);
                if (casoBd) {
                    const nombreJefes = casoBd.NombreJefe || 'Jefatura no asignada';
                    const emailJefes = casoBd.EmailJefe || 'Sin correo registrado';
                    jefesInvolucrados.add(`👤 ${nombreJefes} \n   ✉️ ${emailJefes}`);
                }
            }
        });

        if (casosData.length === 0) {
            return SysUI.alert("Debe escribir una justificación en al menos un caso para poder reportarlo.", "Ningún caso justificado", "warning");
        }

        // Armamos el mensaje final mostrando la lista de correos
        let listaJefesHtml = Array.from(jefesInvolucrados).join('\n\n');
        const msg = `Se enviará el reporte de ${casosData.length} caso(s) a los siguientes responsables:\n\n${listaJefesHtml}\n\n¿Desea proceder con el envío?`;

        const confirm = await SysUI.confirm(msg, "Confirmar Reporte a Jefatura", "info");
        if (!confirm) return;

        try {
            const res = await fetch('api/enviar_casos_jefatura.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ casos: casosData })
            });
            const data = await res.json();

            if (data.success) {
                await SysUI.alert("Los casos han sido reportados exitosamente a las Jefaturas correspondientes.", "Reportado", "success");
                
                // Recargar la bandeja correcta
                if (origen === 'home') {
                    this.loadBandejaPendientes();
                } else {
                    this.loadBandejaPendientes(this.headerData.LOC_CODE);
                }
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            SysUI.alert("Ocurrió un error al enviar: " + e.message, "Error Crítico", "error");
        }
    },

    // =====================================================================
    // LÓGICA DEL ESCÁNER Y CIERRE TSD
    // =====================================================================
    searchICD: async function() {
        const input = document.getElementById('cc-icd-input');
        const icdValue = input.value.trim().toUpperCase();
        if(!icdValue) return SysUI.alert("Por favor digite un número de ICD.", "Campo Vacío", "warning");

        this.resetView(); // Limpiamos primero TODO
        document.getElementById('cc-home-view').classList.add('hidden');
        document.getElementById('cc-loading').classList.remove('hidden');

        try {
            const res = await fetch(`api/get_icd_info.php?icd=${encodeURIComponent(icdValue)}`);
            const json = await res.json();
            document.getElementById('cc-loading').classList.add('hidden');

            if (json.success) {
                this.currentICD = icdValue;
                this.headerData = json.header;
                this.transacciones = json.details.map(t => ({ ...t, _selected: false, _matchTime: 0 }));
                if(json.current_user) this.currentUser = json.current_user; 
                
                this.fillMetadata();
                this.renderTransacciones();
                
                // Cargar la bandeja colaborativa enviando la sucursal del ICD
                this.loadBandejaPendientes(this.headerData.LOC_CODE);
                
                document.getElementById('cc-workspace').classList.remove('hidden');
                document.getElementById('cc-action-bar').classList.remove('translate-y-full');
                
                setTimeout(() => {
                    const inputAuth = document.getElementById('cc-scan-auth');
                    if (inputAuth) inputAuth.focus({ preventScroll: true });
                }, 100);
            } else {
                SysUI.alert(json.error, "No encontrado", "error");
                document.getElementById('cc-home-view').classList.remove('hidden');
                this.loadBandejaPendientes(); // Restaurar mi bandeja
            }
        } catch (e) {
            console.error(e);
            SysUI.alert("Error de red al consultar el ICD.", "Error", "error");
            document.getElementById('cc-loading').classList.add('hidden');
            document.getElementById('cc-home-view').classList.remove('hidden');
            this.loadBandejaPendientes();
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

        const sorted = [...this.transacciones].map((t, i) => ({...t, originalIndex: i}))
            .sort((a, b) => {
                if (a._selected && !b._selected) return -1;
                if (!a._selected && b._selected) return 1;
                if (a._selected && b._selected) return b._matchTime - a._matchTime;
                return 0;
            });

        sorted.forEach((t, renderIndex) => {
            const div = document.createElement('div');
            const isSel = t._selected;
            const animClass = (isSel && renderIndex === 0) ? 'animate-fade-in-up' : '';

            div.className = `p-3 sm:p-4 rounded-xl border-2 transition-all shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-4 select-none ${animClass} 
                ${isSel ? 'border-green-500 bg-green-50 dark:bg-green-900/20 opacity-100' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`;
            
            const displayAuth = isSel ? (t.Numero_Autorizacion || 'SIN_AUT') : '••••••';
            const displayMontoUSD = isSel ? `$${parseFloat(t.Monto_Pago || 0).toFixed(2)}` : '$••.•';
            const displayMontoCRC = isSel ? `₡${parseFloat(t.Conversion || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits:2})}` : '₡••••.•';
            
            div.innerHTML = `
                <div class="shrink-0 self-start sm:self-center">
                    <div class="w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isSel ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}">
                        ${isSel ? '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}
                    </div>
                </div>
                <div class="flex-grow flex flex-col sm:flex-row justify-between w-full gap-2">
                    <div>
                        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contrato: ${t.Numero_Contrato}</div>
                        <div class="text-sm font-black ${isSel ? 'text-green-800 dark:text-green-300' : 'text-slate-800 dark:text-white'} leading-tight uppercase">${t.Nombre} ${t.Apellido}</div>
                        <div class="text-[11px] font-bold ${isSel ? 'text-green-600' : 'text-indigo-600 dark:text-indigo-400'} mt-1 font-mono">
                            AUT: <span class="${isSel ? '' : 'tracking-widest opacity-60'}">${displayAuth}</span> <span class="text-slate-400 font-sans font-normal mx-1">•</span> ${t.Tipo_Tarjeta}
                        </div>
                    </div>
                    <div class="text-left sm:text-right">
                        <div class="text-lg font-black font-mono ${isSel ? 'text-green-700 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}">${displayMontoUSD}</div>
                        <div class="text-[10px] text-slate-500 font-bold ${isSel ? '' : 'tracking-widest opacity-60'}">${displayMontoCRC}</div>
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
        this.currentICD = null;
        this.headerData = null;
        this.transacciones = [];
        
        const workspace = document.getElementById('cc-workspace');
        const actionBar = document.getElementById('cc-action-bar');
        const sucBandeja = document.getElementById('cc-sucursal-bandeja');
        
        if(workspace) workspace.classList.add('hidden');
        if(actionBar) actionBar.classList.add('translate-y-full');
        if(sucBandeja) sucBandeja.classList.add('hidden');
        
        document.getElementById('cc-transactions-list').innerHTML = '';
        
        // Limpieza de inputs
        const scannerAuth = document.getElementById('cc-scan-auth');
        const scannerMonto = document.getElementById('cc-scan-monto');
        if(scannerAuth) scannerAuth.value = '';
        if(scannerMonto) scannerMonto.value = '';
        
        const icdInput = document.getElementById('cc-icd-input');
        if(icdInput) icdInput.value = '';
        
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
        
        this.loadBandejaPendientes();
    },

    saveCierre: async function() {
        const selectedCount = this.transacciones.filter(t => t._selected).length;
        const unselected = this.transacciones.filter(t => !t._selected);
        
        let confirmMsg = "";
        if (unselected.length > 0) {
            confirmMsg = `Resumen del Cierre (ICD ${this.currentICD}):\n\n` +
                         `✅ Conciliados: ${selectedCount}\n` +
                         `⚠️ Pendientes (Sin Match): ${unselected.length}\n\n` +
                         `Los casos pendientes quedarán guardados en su "Bandeja de Pendientes" para que pueda justificarlos y enviarlos a la jefatura posteriormente.\n\n¿Desea registrar el cierre?`;
            
            const confirm = await SysUI.confirm(confirmMsg, "Confirmar Cierre Parcial", "warning");
            if (!confirm) return;
            this.executeSaveAndSend(true); // true = crea casos borrador
        } else {
            confirmMsg = `Resumen del Cierre (ICD ${this.currentICD}):\n\n` +
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
            icd: this.currentICD,
            sucursal: `${this.headerData.LOC_CODE} - ${this.headerData.Nombre_Sucursal}`,
            usuario_tsd: this.headerData.Nombre_Usuario,
            fecha_tsd: this.headerData.CreateDate,
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
                match_exitoso: t._selected ? 1 : 0
            }))
        };

        if (crearCasos) {
            payload.casos_borrador = unselected.map(t => ({
                contrato: t.Numero_Contrato,
                cliente: `${t.Nombre} ${t.Apellido}`.trim(),
                monto_crc: parseFloat(t.Conversion || 0),
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
                let msgExito = `El cierre de caja para el ICD ${this.currentICD} se guardó correctamente.\nFolio: #${data.id_cierre}`;
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

    
};

// =========================================================================
// HERRAMIENTA DE AUDITORÍA: REVELAR DATOS OCULTOS DEL ICD ACTUAL (F12)
// Ejecutar en consola: window.revelarSecretosICD()
// =========================================================================
window.rev = function() {
    console.log("🕵️‍♂️ Buscando datos enmascarados en la RAM...");
    
    // Verificamos si el módulo está abierto y tiene transacciones cargadas
    if (!window.CierreCajasLogic || !window.CierreCajasLogic.transacciones || window.CierreCajasLogic.transacciones.length === 0) {
        console.warn("⚠️ No hay un ICD activo con transacciones cargadas en memoria.");
        return;
    }

    const t = window.CierreCajasLogic.transacciones;
    console.log(`✅ Mostrando ${t.length} transacciones originales del ICD: ${window.CierreCajasLogic.currentICD}`);

    // Mapeamos solo los campos que están ocultos por el "Doble Ciego" para que el analista pueda verlos en una tabla limpia
    const datosOcultos = t.map((fila, index) => ({
        "# Fila": index + 1,
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