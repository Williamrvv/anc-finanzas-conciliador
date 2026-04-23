window.TSDLogic = {
    // 1. Inicialización de UI y Calendario
    init: function() {
        console.log("🚀 Módulo TSD Inicializado");
        
        // Destruir grid previo si el usuario navega entre vistas
        if(this.grid) { 
            this.grid.destroy(); 
            this.grid = null; 
        }
        
        // Inicializar Calendario Rango Moderno (Flatpickr)
        if (window.flatpickr) {
            flatpickr("#tsd-date-picker", {
                mode: "range",
                dateFormat: "Y-m-d",
                locale: "es", 
                defaultDate: [new Date(), new Date()]
            });
        }
    },

    // 2. Ejecución Principal: Buscar en DB y lanzar algoritmo
    fetchAndMatch: async function() {
        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas válido.");

        // Extraer rango (Si es un solo día, inicio y fin son el mismo)
        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) {
            [start, end] = dateVal.split(' a ');
        }

        const btn = document.getElementById('btn-run-match');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Consultando BD...';
        btn.disabled = true;

        try {
            const res = await fetch(`api/get_cruce_m3.php?start=${start}&end=${end}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            // Llamada segura a la función de cruce
            this.runMatchingAlgorithm(json.tsd, json.bancos);

        } catch (error) {
            console.error(error);
            window.SysUI.alert("Error al obtener datos: " + error.message, "Fallo de Conexión", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    // 3. Lógica del Modal (Ingesta de Historial de Tarjetas)
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
            const cols = r.split('\t'); // Excel usa tabulaciones al copiar
            if (cols.length >= 2) {
                const contrato = String(cols[0]).trim();
                // Eliminar todo lo que no sea alfanumérico
                const tarjetaCruda = String(cols[1]).trim().replace(/[^a-zA-Z0-9]/g, '');
                
                if (contrato !== '' && tarjetaCruda !== '') {
                    // Extraer siempre los últimos 4 dígitos reales (Ej: XXXXXXX0377 -> 0377)
                    const tarjeta4 = tarjetaCruda.slice(-4);
                    tarjetas.push({ contrato: contrato, tarjeta: tarjeta4 });
                }
            }
        });

        if (tarjetas.length === 0) return window.SysUI.alert("No se detectó un formato válido (Contrato \t Tarjeta).");

        // --- INICIO DE ESTADO DE CARGA (UX) ---
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
        // --- FIN DE ESTADO DE CARGA ---

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
            // Restaurar la interfaz si algo falla o termina
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
            statusEl.classList.add('hidden');
        }
    },

    // 4. Algoritmo de Cruce Cascada Estricto (Doble Pasada sin tolerancia)
    runMatchingAlgorithm: function(tsdData, bancosData) {
        console.log(`🧠 Ejecutando Algoritmo 2-Pass: ${tsdData.length} TSD vs ${bancosData.length} Bancos`);

        const gridData = [];
        let bancosDisponibles = [...bancosData]; // Copia mutable para ir consumiendo bancos
        const cleanStr = (str) => String(str || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        const huerfanosTSD = [];

        // ==============================================================
        // PASADA 1: CRUCE GLOBAL POR AUTORIZACIÓN EXACTA
        // ==============================================================
        tsdData.forEach(tsdRow => {
            const authTSD = cleanStr(tsdRow.Autorizacion);
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            const tarjetaTSD = cleanStr(tsdRow.Tarjeta_Ultimos4);
            const tarjetaTSDSegura = tarjetaTSD.length >= 4 ? tarjetaTSD.slice(-4) : tarjetaTSD;

            let matchIdx = -1;
            // Evitar cruces accidentales con autorizaciones genéricas de sistema
            if (authTSD !== '' && authTSD !== '0' && authTSD !== '000000') {
                matchIdx = bancosDisponibles.findIndex(b => cleanStr(b.Numero_Autorizacion) === authTSD);
            }

            if (matchIdx !== -1) {
                // Match Exitoso F1
                const matchedBanco = bancosDisponibles.splice(matchIdx, 1)[0];
                const isNegative = montoTSD < 0;
                
                gridData.push({
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
                // No cruzó por Auth, se va a la lista de espera para la Pasada 2
                huerfanosTSD.push({ tsdRow, montoTSD, tarjetaTSDSegura });
            }
        });

        // ==============================================================
        // PASADA 2: CRUCE GLOBAL POR TARJETA (Solo los que sobraron)
        // ==============================================================
        huerfanosTSD.forEach(item => {
            const { tsdRow, montoTSD, tarjetaTSDSegura } = item;
            let matchedBanco = null;
            let matchType = 'Pendiente';
            let bgColorClass = '';
            const isNegative = montoTSD < 0;

            if (tarjetaTSDSegura !== '' && tarjetaTSDSegura.length === 4) {
                // Buscamos coincidencia ESTRICTA de tarjeta, sin importar monto
                const matchIdx = bancosDisponibles.findIndex(b => {
                    const bankCard = cleanStr(b.Tarjeta_Ultimos4).slice(-4);
                    return bankCard === tarjetaTSDSegura;
                });

                if (matchIdx !== -1) {
                    matchedBanco = bancosDisponibles.splice(matchIdx, 1)[0];
                    matchType = 'Match Tarjeta';
                    bgColorClass = 'bg-[#ddebf7] dark:bg-[#1e3a8a] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800';
                }
            }

            if (isNegative) {
                bgColorClass = 'bg-[#d9d9d9] dark:bg-[#262626] text-slate-900 dark:text-slate-300 border-b border-slate-400 dark:border-slate-900 font-bold';
            }

            gridData.push({
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

        // ==============================================================
        // PASADA 3: INYECTAR SOBRANTES DEL BANCO
        // ==============================================================
        bancosDisponibles.forEach(b => {
            const m = parseFloat(b.Monto_Venta_Original);
            gridData.push({
                _rowClass: m < 0 ? 'bg-[#d9d9d9] dark:bg-[#262626] border-b border-slate-400 dark:border-slate-900' : 'text-slate-500 italic border-b border-slate-100 dark:border-slate-800',
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

        this.renderGrid(gridData);
    },

    // 5. Renderizado Visual VanillaGrid
    renderGrid: function(data) {
        // Rediseño Visual para separar claramente Lado TSD vs Lado Banco
        const columns = [
            { title: "Contrato (TSD)", field: "Contrato", width: 100, headerFilter: true, cssClass: "font-mono font-bold" },
            { title: "Cliente", field: "Cliente", headerFilter: true, width: 160, cssClass: "truncate text-[10px]" },
            { title: "Tarjeta", field: "TarjetaTSD", width: 70, cssClass: "font-mono text-slate-500" },
            { title: "Auth (TSD)", field: "Autorizacion", headerFilter: true, width: 90, cssClass: "font-mono" },
            { title: "Monto", field: "MontoTSD", formatter: "money", hozAlign: "right", bottomCalc: "sum" },
            
            // --- COLUMNA CENTRAL PIVOTE ---
            { 
                title: "STATUS CRUCE", field: "EstadoMatch", headerFilter: true, width: 130, hozAlign: "center",
                cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-white/30 dark:bg-black/20 font-bold shadow-inner",
                formatter: (cell) => {
                    const val = cell.getValue();
                    if(val === 'Auth Exacta') return '✔️ Auth Exacta';
                    if(val === 'Match Tarjeta') return '💳 Por Tarjeta';
                    if(val === 'Pendiente') return '<span class="text-red-500">❌ Pendiente</span>';
                    return val;
                }
            },
            
            // --- LADO BANCO ---
            { title: "Banco", field: "Banco_Nombre", width: 80, hozAlign: "center", headerFilter: true, cssClass: "text-blue-700 dark:text-blue-400 font-bold" },
            { title: "Auth (Banco)", field: "Banco_Auth", headerFilter: true, width: 90, cssClass: "font-mono" },
            { title: "Monto", field: "Banco_Monto", formatter: "money", hozAlign: "right", bottomCalc: "sum" },
            { title: "Diferencia", field: "Diferencia", formatter: "money", hozAlign: "right", cssClass: "font-bold bg-white/40 dark:bg-black/30" }
        ];

        if (this.grid) {
            this.grid.updateData(data);
        } else {
            this.grid = new VanillaGrid("#table-result-tsd", data, columns, {
                searchInputId: "search-tsd",
                threshold: 0
            });
        }
    }
};