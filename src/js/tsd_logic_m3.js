window.TSDLogic = {
    lastTSD: [],
    lastBancos: [],
    blacklist: [], // Almacena combinaciones "Contrato|IdTransaccion" que el usuario desconcilió

    init: function() {
        console.log("🚀 Módulo TSD Inicializado");
        
        // Destruir grid previo si el usuario navega entre vistas
        if(this.grid) { 
            if (typeof this.grid.destroy === 'function') this.grid.destroy(); 
            this.grid = null; 
        }
        
        this.blacklist = []; // Reiniciar blacklist al entrar
        
        if (window.flatpickr) {
            flatpickr("#tsd-date-picker", {
                mode: "range",
                dateFormat: "Y-m-d",
                locale: "es", 
                defaultDate: [new Date(), new Date()]
            });
        }
    },

    // Reacción del input de tolerancia (Repinta solo las celdas en tiempo real)
    updateThreshold: function() {
        if (this.grid) {
            // El render() interno de VanillaGrid repinta los formatters sin destruir la sesión de la tabla
            if (typeof this.grid.render === 'function') {
                this.grid.render();
            } else if (this.currentGridData) {
                this.grid.updateData(this.currentGridData);
            }
        }
    },

    fetchAndMatch: async function() {
        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas válido.");

        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) {
            [start, end] = dateVal.split(' a ');
        }

        // --- ESTADO DE CARGA VISUAL (UX) ---
        const btn = document.getElementById('btn-run-match');
        const gridContainer = document.getElementById('table-result-tsd');
        const originalText = btn.innerHTML;
        
        // Bloquear Botón
        btn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Consultando BD...';
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-not-allowed');

        // Dibujar Spinner Gigante en la Tabla
        if (gridContainer) {
            // Destruimos la instancia anterior de forma segura
            if(this.grid) { 
                if(typeof this.grid.destroy === 'function') this.grid.destroy(); 
                this.grid = null; 
            }
            
            gridContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-purple-500 w-full bg-slate-50/50 dark:bg-slate-900/50">
                    <svg class="animate-spin h-16 w-16 mb-4" xmlns="http://www.O3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <h3 class="text-lg font-bold text-slate-700 dark:text-slate-200">Extrayendo datos de Bases de Datos...</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Este proceso puede tardar unos segundos dependiendo del volumen de transacciones.</p>
                </div>
            `;
        }
        // --- FIN ESTADO DE CARGA ---

        try {
            const res = await fetch(`api/get_cruce_m3.php?start=${start}&end=${end}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            // Guardar en RAM por si el usuario desconcilia algo y necesitamos re-ejecutar
            this.lastTSD = json.tsd;
            this.lastBancos = json.bancos;

            this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);

        } catch (error) {
            console.error(error);
            window.SysUI.alert("Error al obtener datos: " + error.message, "Fallo de Conexión", "error");
            // Si hay error, restauramos el mensaje vacío original en el contenedor
            if (gridContainer) {
                gridContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-red-400 gap-2 opacity-50">
                        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="text-sm font-medium">Error de consulta. Inténtelo nuevamente.</span>
                    </div>
                `;
            }
        } finally {
            // Restaurar botón siempre
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    },

    openCardModal: function() {
        document.getElementById('paste-zone-cards').value = '';
        document.getElementById('status-cards-paste').classList.add('hidden');
        document.getElementById('modal-cards-tsd').classList.remove('hidden');
    },

    processCardPaste: async function() {
        const text = document.getElementById('paste-zone-cards').value;
        if (!text.trim()) return window.SysUI.alert("El área de texto está vacía.");

        const rows = text.split('\n');
        const tarjetas = [];

        rows.forEach(r => {
            const cols = r.split('\t'); 
            if (cols.length >= 2) {
                const contrato = String(cols[0]).trim();
                const tarjetaCruda = String(cols[1]).trim().replace(/[^a-zA-Z0-9]/g, '');
                
                if (contrato !== '' && tarjetaCruda !== '') {
                    const tarjeta4 = tarjetaCruda.slice(-4);
                    tarjetas.push({ contrato: contrato, tarjeta: tarjeta4 });
                }
            }
        });

        if (tarjetas.length === 0) return window.SysUI.alert("No se detectó un formato válido (Contrato \t Tarjeta).");

        const btn = document.querySelector('#modal-cards-tsd button[onclick="window.TSDLogic.processCardPaste()"]');
        const statusEl = document.getElementById('status-cards-paste');
        const originalText = btn ? btn.innerHTML : 'Guardar en Base de Datos';
        
        if (btn) {
            btn.innerHTML = '<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Guardando...';
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
        }
        
        statusEl.innerHTML = `<span class="animate-pulse">Procesando ${tarjetas.length} registros. Por favor, espere...</span>`;
        statusEl.classList.remove('hidden');

        try {
            const res = await fetch('api/save_tarjetas_m3.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tarjetas: tarjetas })
            });
            const data = await res.json();
            
            if(data.success) {
                document.getElementById('modal-cards-tsd').classList.add('hidden');
                await window.SysUI.alert(`Se guardaron ${data.filas} tarjetas en el Historial con éxito.\n\nPor favor, presione "Ejecutar Cruce" nuevamente para aplicar los cambios a la tabla.`, "Ingesta Exitosa", "success");
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            window.SysUI.alert("Error: " + error.message, "Fallo al Guardar", "error");
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
            statusEl.classList.add('hidden');
        }
    },

    // 4. Algoritmo de Cruce (Cero Tolerancia + Blacklist)
    runMatchingAlgorithm: function(tsdData, bancosData) {
        console.log(`🧠 Ejecutando Algoritmo Estricto: ${tsdData.length} TSD vs ${bancosData.length} Bancos`);

        const gridData = [];
        let bancosDisponibles = [...bancosData];
        const huerfanosTSD = [];

        const cleanStr = (str) => String(str || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        // Blindaje contra espacios ocultos en la memoria RAM
        const isBlacklisted = (knum, idTrans) => {
            const key = String(knum).trim() + '|' + String(idTrans).trim();
            return this.blacklist.includes(key);
        };

        // --- PASADA 1: CRUCE ESTRICTO POR AUTORIZACIÓN ---
        tsdData.forEach(tsdRow => {
            const authTSD = cleanStr(tsdRow.Autorizacion);
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            const tarjetaTSD = cleanStr(tsdRow.Tarjeta_Ultimos4);
            const tarjetaTSDSegura = tarjetaTSD.length >= 4 ? tarjetaTSD.slice(-4) : tarjetaTSD;

            let matchIdx = -1;
            
            if (authTSD !== '' && authTSD !== '0' && authTSD !== '000000') {
                matchIdx = bancosDisponibles.findIndex(b => 
                    cleanStr(b.Numero_Autorizacion) === authTSD && 
                    !isBlacklisted(tsdRow.Contrato, b.IdTransaccion) // Validación de Mutabilidad
                );
            }

            if (matchIdx !== -1) {
                const matchedBanco = bancosDisponibles.splice(matchIdx, 1)[0];
                const isNegative = montoTSD < 0;
                
                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                    _tsdRaw: tsdRow,
                    _bancoRaw: matchedBanco,
                    _rowClass: isNegative 
                        ? 'bg-[#d9d9d9] dark:bg-[#262626] text-slate-900 dark:text-slate-300 border-b border-slate-400 dark:border-slate-900 font-bold' 
                        : 'bg-[#fce4d6] dark:bg-[#7c6f69] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800',
                    Contrato: tsdRow.Contrato,
                    Cliente: tsdRow.Cliente,
                    TarjetaTSD: tarjetaTSDSegura !== '' ? `****${tarjetaTSDSegura}` : 'S/D',
                    Autorizacion: tsdRow.Autorizacion,
                    MontoTSD: montoTSD,
                    EstadoMatch: 'Auth Exacta',
                    Banco_Nombre: matchedBanco.Banco,
                    Banco_Auth: matchedBanco.Numero_Autorizacion,
                    Banco_Monto: parseFloat(matchedBanco.Monto_Venta_Original),
                    Diferencia: montoTSD - parseFloat(matchedBanco.Monto_Venta_Original)
                });
            } else {
                // Va a la Pasada 2
                huerfanosTSD.push({ tsdRow, montoTSD, tarjetaTSDSegura });
            }
        });

        // --- PASADA 2: CRUCE ESTRICTO POR TARJETA ---
        huerfanosTSD.forEach(item => {
            const { tsdRow, montoTSD, tarjetaTSDSegura } = item;
            let matchedBanco = null;
            let matchType = 'Pendiente';
            let bgColorClass = '';
            const isNegative = montoTSD < 0;

            if (tarjetaTSDSegura !== '' && tarjetaTSDSegura.length === 4) {
                const matchIdx = bancosDisponibles.findIndex(b => {
                    const bankCard = cleanStr(b.Tarjeta_Ultimos4).slice(-4);
                    return bankCard === tarjetaTSDSegura && !isBlacklisted(tsdRow.Contrato, b.IdTransaccion);
                });

                if (matchIdx !== -1) {
                    matchedBanco = bancosDisponibles.splice(matchIdx, 1)[0];
                    matchType = 'Match Tarjeta';
                    // Si el monto es negativo Y cruzó, va gris. Si es positivo y cruzó, va azul.
                    bgColorClass = isNegative 
                        ? 'bg-[#d9d9d9] dark:bg-[#262626] text-slate-900 dark:text-slate-300 border-b border-slate-400 dark:border-slate-900 font-bold'
                        : 'bg-[#ddebf7] dark:bg-[#1e3a8a] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800';
                }
            }

            gridData.push({
                _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                _tsdRaw: tsdRow,
                _bancoRaw: matchedBanco,
                _rowClass: bgColorClass,
                Contrato: tsdRow.Contrato,
                Cliente: tsdRow.Cliente,
                TarjetaTSD: tarjetaTSDSegura !== '' ? `****${tarjetaTSDSegura}` : 'S/D',
                Autorizacion: tsdRow.Autorizacion,
                MontoTSD: montoTSD,
                EstadoMatch: matchType,
                Banco_Nombre: matchedBanco ? matchedBanco.Banco : '-',
                Banco_Auth: matchedBanco ? matchedBanco.Numero_Autorizacion : '-',
                Banco_Monto: matchedBanco ? parseFloat(matchedBanco.Monto_Venta_Original) : 0,
                Diferencia: matchedBanco ? (montoTSD - parseFloat(matchedBanco.Monto_Venta_Original)) : montoTSD
            });
        });

        // --- SOBRANTES DE BANCO ---
        bancosDisponibles.forEach(b => {
            const m = parseFloat(b.Monto_Venta_Original);
            gridData.push({
                _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                _tsdRaw: null,
                _bancoRaw: b,
                // Le quitamos la validación m < 0, ahora todos los sobrantes son texto atenuado sin fondo
                _rowClass: 'text-slate-500 italic border-b border-slate-100 dark:border-slate-800',
                Contrato: 'Solo Banco',
                Cliente: b.Nombre_Comercio,
                TarjetaTSD: b.Tarjeta_Ultimos4 ? `****${b.Tarjeta_Ultimos4}` : 'S/D',
                Autorizacion: '-',
                MontoTSD: 0,
                EstadoMatch: 'Sobrante',
                Banco_Nombre: b.Banco,
                Banco_Auth: b.Numero_Autorizacion,
                Banco_Monto: m,
                Diferencia: 0 - m
            });
        });

        // --- ORDENAMIENTO ESTÉTICO (AGRUPACIÓN) ---
        gridData.sort((a, b) => {
            const getWeight = (row) => {
                const isMatch = row.EstadoMatch === 'Auth Exacta' || row.EstadoMatch === 'Match Tarjeta';
                const isNegative = row.MontoTSD < 0 || row.Banco_Monto < 0;

                // Regla 1: Conciliados por Autorización (Positivos)
                if (isMatch && !isNegative && row.EstadoMatch === 'Auth Exacta') return 1;
                // Regla 2: Conciliados por Tarjeta (Positivos)
                if (isMatch && !isNegative && row.EstadoMatch === 'Match Tarjeta') return 2;
                // Regla 3: Conciliados pero con montos Negativos
                if (isMatch && isNegative) return 3;
                // Regla 4: Resto (Sobrantes y Pendientes)
                return 4;
            };

            const weightA = getWeight(a);
            const weightB = getWeight(b);
            
            // Si tienen pesos distintos, se ordenan por su grupo
            if (weightA !== weightB) return weightA - weightB;
            
            // Si pertenecen al mismo grupo, se ordenan alfabéticamente por Contrato para mantener orden
            return String(a.Contrato).localeCompare(String(b.Contrato));
        });

        this.currentGridData = gridData;
        this.renderGrid(gridData);
    },

    renderGrid: function(data) {
        const columns = [
            { title: "Contrato (TSD)", field: "Contrato", width: 100, headerFilter: true, cssClass: "font-mono font-bold" },
            { title: "Cliente", field: "Cliente", headerFilter: true, width: 160, cssClass: "truncate text-[10px]" },
            { title: "Tarjeta", field: "TarjetaTSD", width: 70, cssClass: "font-mono text-slate-500" },
            { title: "Auth (TSD)", field: "Autorizacion", headerFilter: true, width: 90, cssClass: "font-mono" },
            { title: "Monto", field: "MontoTSD", formatter: "money", hozAlign: "right", bottomCalc: "sum" },
            
            { 
                title: "STATUS CRUCE", field: "EstadoMatch", headerFilter: true, width: 130, hozAlign: "center",
                cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-white/30 dark:bg-black/20 font-bold shadow-inner cursor-pointer",
                formatter: (cell) => {
                    const val = cell.getValue();
                    if(val === 'Auth Exacta') return '✔️ Auth Exacta';
                    if(val === 'Match Tarjeta') return '💳 Por Tarjeta';
                    if(val === 'Pendiente' || val === 'Desconciliado') return '<span class="text-red-500">❌ Pendiente</span>';
                    return val;
                }
            },
            
            { title: "Banco", field: "Banco_Nombre", width: 80, hozAlign: "center", headerFilter: true, cssClass: "text-blue-700 dark:text-blue-400 font-bold" },
            { title: "Auth (Banco)", field: "Banco_Auth", headerFilter: true, width: 90, cssClass: "font-mono" },
            { title: "Monto", field: "Banco_Monto", formatter: "money", hozAlign: "right", bottomCalc: "sum" },
            { 
                title: "Diferencia", field: "Diferencia", hozAlign: "right", 
                formatter: (cell) => {
                    const val = cell.getValue();
                    const thresholdInput = document.getElementById('tsd-threshold');
                    const threshold = thresholdInput ? Math.abs(parseFloat(thresholdInput.value)) || 0 : 10000;
                    
                    let formatted = new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(val);
                    if (formatted.includes('.') && formatted.includes(',')) formatted = formatted.replace(/\./g, ' ');
                    
                    if (Math.abs(val) >= threshold) {
                        return `<span class="text-red-700 dark:text-red-300 font-black bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded shadow-sm border border-red-200 dark:border-red-800">${formatted}</span>`;
                    }
                    return `<span class="font-bold bg-white/40 dark:bg-black/30 px-2 py-0.5 rounded">${formatted}</span>`;
                }
            }
        ];

        if (this.grid) {
            this.grid.updateData(data);
        } else {
            this.grid = new VanillaGrid("#table-result-tsd", data, columns, {
                searchInputId: "search-tsd",
                threshold: 0,
                onRowDblClick: (row) => window.TSDLogic.openTransactionModal(row)
            });
        }
    },

    // 6. Visor 360° y Mutabilidad (Desconciliar)
    openTransactionModal: function(row) {
        if (!row) return;

        let existingModal = document.getElementById('tsd-detail-modal');
        if (existingModal) existingModal.remove();

        const isMatch = row._tsdRaw && row._bancoRaw;
        const fmtMoney = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v || 0);

        // Bloque de Botón Desconciliar
        const btnDesconciliar = isMatch 
            ? `<button onclick="window.TSDLogic.unmatchRow('${row._uid}')" class="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/60 px-4 py-2 rounded font-bold shadow-sm transition-colors border border-red-200 dark:border-red-800 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path></svg>
                Desvincular Transacciones
               </button>` 
            : '';

        // Diccionario de Traducción Ejecutiva
        const keyDictionary = {
            'Contrato': 'N° de Contrato',
            'Cliente': 'Nombre del Cliente',
            'MontoUSD': 'Monto Original (USD)',
            'TC': 'Tipo de Cambio (Aplicado)',
            'MontoCRC': 'Monto Calculado (CRC)',
            'Tipo': 'Tipo de Tarjeta',
            'Autorizacion': 'N° de Autorización',
            'Tarjeta_Ultimos4': 'Tarjeta (Terminación)',
            'Fecha': 'Fecha de Transacción',
            'RecibidoPor': 'Usuario / Agente Responsable',
            'ICD': 'Centro de Costos (ICD)',
            'SucursalCod': 'Cód. de Sucursal',
            'Sucursal': 'Nombre de la Sucursal',
            'Banco': 'Entidad Bancaria',
            'Origen': 'Origen de Registro',
            'FechaTransaccion': 'Fecha en el Banco',
            'Afiliado_MerID': 'Afiliado / MerID',
            'Codigo_Sucursal_Terminal': 'N° de Terminal Datáfono',
            'Nombre_Sucursal_Comercio': 'Nombre Comercial',
            'Numero_Autorizacion': 'N° de Autorización (Banco)',
            'Monto_Venta_Original': 'Monto Registrado (CRC)'
        };

        // Renderizador Dinámico de Propiedades (Mejorado)
        const renderProps = (obj) => {
            if(!obj) return '<div class="text-slate-400 italic p-4 text-center">Datos no encontrados en esta fuente.</div>';
            let html = '<div class="space-y-2">';
            for(let key in obj) {
                if (key === 'IdTransaccion') continue; 
                
                let val = obj[key];
                if (val === null || val === '') val = '-';
                
                const displayKey = keyDictionary[key] || key; // Traducir llave
                
                let isMoney = ['MontoUSD', 'MontoCRC', 'TC', 'Monto_Venta_Original'].includes(key);
                let valHtml = isMoney ? `<span class="text-green-600 dark:text-green-400 font-bold font-mono">${fmtMoney(val)}</span>` : `<span class="font-mono text-slate-800 dark:text-slate-200 break-words">${val}</span>`;
                
                html += `
                    <div class="flex flex-col border-b border-slate-100 dark:border-slate-700/50 pb-1">
                        <span class="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">${displayKey}</span>
                        ${valHtml}
                    </div>
                `;
            }
            return html + '</div>';
        };

        const htmlModal = `
            <div id="tsd-detail-modal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                <div class="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    
                    <div class="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 flex justify-between items-center shrink-0">
                        <h2 class="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <span class="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg">📄</span>
                            Detalle de Transacción y Cruce
                        </h2>
                        <button onclick="document.getElementById('tsd-detail-modal').remove()" class="text-slate-400 hover:text-red-500 font-bold p-2">✖</button>
                    </div>

                    <div class="flex-grow overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/30">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <!-- PANEL IZQUIERDO: TSD -->
                            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                <div class="bg-purple-50 dark:bg-purple-900/20 border-b border-slate-200 dark:border-slate-700 p-3 flex items-center gap-2">
                                    <span class="text-purple-600 dark:text-purple-400 font-bold">📄</span>
                                    <h3 class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Datos TSD (Sistema Core)</h3>
                                </div>
                                <div class="p-4 text-xs">
                                    ${renderProps(row._tsdRaw)}
                                </div>
                            </div>

                            <!-- PANEL DERECHO: BANCO -->
                            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                <div class="bg-blue-50 dark:bg-blue-900/20 border-b border-slate-200 dark:border-slate-700 p-3 flex items-center gap-2">
                                    <span class="text-blue-600 dark:text-blue-400 font-bold">🏦</span>
                                    <h3 class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Datos Procesador Banco</h3>
                                </div>
                                <div class="p-4 text-xs">
                                    ${renderProps(row._bancoRaw)}
                                </div>
                            </div>

                        </div>
                    </div>

                    <div class="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-between items-center shrink-0">
                        <div class="flex items-center gap-3">
                            <span class="text-[10px] text-slate-400 uppercase font-bold">Diferencia Detectada:</span>
                            <span class="text-xl font-mono font-black ${Math.abs(row.Diferencia) >= 10000 ? 'text-red-500' : 'text-slate-800 dark:text-white'}">
                                ${fmtMoney(row.Diferencia)}
                            </span>
                        </div>
                        <div class="flex items-center gap-3">
                            ${btnDesconciliar}
                            <button onclick="document.getElementById('tsd-detail-modal').remove()" class="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 px-5 py-2 rounded font-bold shadow-sm transition-colors">Cerrar</button>
                        </div>
                    </div>

                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', htmlModal);
    },

    // 7. Lógica de Desvincular (Moderna y Asíncrona)
    unmatchRow: async function(uid) {
        const row = this.currentGridData.find(r => r._uid === uid);
        if (!row || !row._tsdRaw || !row._bancoRaw) return;

        // Modal de Cristal Moderno
        const confirmado = await window.SysUI.confirm(
            "¿Está seguro que desea desvincular estas transacciones?\n\nAl hacerlo, el sistema las separará en la tabla y no volverá a unirlas automáticamente en futuros cruces.",
            "Desvincular Transacciones",
            "warning"
        );

        if (!confirmado) return;

        // Añadir a la Lista Negra aplicando .trim() exacto para evitar fugas de memoria
        const key = String(row._tsdRaw.Contrato).trim() + '|' + String(row._bancoRaw.IdTransaccion).trim();
        this.blacklist.push(key);
        
        // Cerrar modal 360°
        const modal = document.getElementById('tsd-detail-modal');
        if (modal) modal.remove();

        // Re-ejecutar el algoritmo en RAM (Instantáneo)
        this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
        
        // Alerta Moderna de Éxito
        window.SysUI.alert("Las transacciones han sido separadas y marcadas como pendientes.", "Desvinculación Exitosa", "success");
    }
}; 
// 09253I