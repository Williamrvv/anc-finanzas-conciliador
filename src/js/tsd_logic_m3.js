window.TSDLogic = {
    init: function() {
        console.log("🚀 Módulo TSD Inicializado");
        if(this.grid) { this.grid.destroy(); this.grid = null; }
        
        // Inicializar Calendario Rango Moderno
        if (window.flatpickr) {
            flatpickr("#tsd-date-picker", {
                mode: "range",
                dateFormat: "Y-m-d",
                locale: "es", // Español (' a ')
                defaultDate: [new Date(), new Date()]
            });
        }
    },

    fetchAndMatch: async function() {
        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas válido.");

        // Flatpickr separa el rango con ' a ' en español. Si solo eligió un día, start y end son el mismo.
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

            this.runMatchingAlgorithm(json.tsd, json.bancos);

        } catch (error) {
            console.error(error);
            window.SysUI.alert("Error al obtener datos: " + error.message, "Fallo de Conexión", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    runMatchingAlgorithm: function(tsdData, bancosData) {
        console.log(`🧠 Ejecutando Algoritmo Simplificado (Solo Auth): ${tsdData.length} TSD vs ${bancosData.length} Bancos`);

        const gridData = [];
        let bancosDisponibles = [...bancosData];

        // Función Helper para normalizar Autorizaciones (limpia espacios, guiones y mayúsculas)
        const cleanStr = (str) => String(str || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        tsdData.forEach(tsdRow => {
            let matchType = 'Pendiente';
            let matchedBanco = null;
            let bgColorClass = '';

            const authTSD = cleanStr(tsdRow.Autorizacion);
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;

            // FASE ÚNICA: Cruce estricto por Autorización
            let matchIdx = -1;
            if (authTSD !== '') {
                matchIdx = bancosDisponibles.findIndex(b => cleanStr(b.Numero_Autorizacion) === authTSD);
            }
            
            if (matchIdx !== -1) {
                matchedBanco = bancosDisponibles.splice(matchIdx, 1)[0];
                matchType = 'Auth Exacta';
                // Colores para cruce por Autorización (Aplica para positivos y negativos)
                bgColorClass = 'bg-[#fce4d6] dark:bg-[#7c6f69] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800';
            } 

            // Ensamblar objeto final para el Grid
            gridData.push({
                _rowClass: bgColorClass,
                Contrato: tsdRow.Contrato,
                Cliente: tsdRow.Cliente,
                Fecha: tsdRow.Fecha,
                Autorizacion: tsdRow.Autorizacion,
                MontoTSD: montoTSD,
                EstadoMatch: matchType,
                Banco_Auth: matchedBanco ? matchedBanco.Numero_Autorizacion : '-',
                Banco_Monto: matchedBanco ? parseFloat(matchedBanco.Monto_Venta_Original) : 0,
                Banco_Nombre: matchedBanco ? matchedBanco.Banco : '-',
                Diferencia: matchedBanco ? (montoTSD - parseFloat(matchedBanco.Monto_Venta_Original)) : montoTSD
            });
        });

        // Añadir los sobrantes del Banco al final de la lista
        bancosDisponibles.forEach(b => {
            const m = parseFloat(b.Monto_Venta_Original);
            gridData.push({
                _rowClass: 'text-slate-500 italic', // Sin fondo, solo texto atenuado
                Contrato: 'Huerfano (Solo Banco)',
                Cliente: b.Nombre_Comercio,
                Fecha: b.Fecha_Pago_Excel,
                Autorizacion: '-',
                MontoTSD: 0,
                EstadoMatch: 'Sobrante Banco',
                Banco_Auth: b.Numero_Autorizacion,
                Banco_Monto: m,
                Banco_Nombre: b.Banco,
                Diferencia: 0 - m
            });
        });

        this.renderGrid(gridData);
    },

    renderGrid: function(data) {
        const columns = [
            { title: "Contrato", field: "Contrato", width: 100, headerFilter: true, cssClass: "font-mono font-bold" },
            { title: "Fecha TSD", field: "Fecha", width: 90, formatter: (cell) => window.ConciliacionLogic ? window.ConciliacionLogic.formatDateCR(cell.getValue()) : cell.getValue() },
            { title: "Cliente", field: "Cliente", headerFilter: true, width: 200, cssClass: "truncate text-[10px]" },
            { title: "Auth TSD", field: "Autorizacion", headerFilter: true, width: 90, cssClass: "font-mono" },
            { title: "Monto TSD", field: "MontoTSD", formatter: "money", hozAlign: "right", bottomCalc: "sum" },
            { 
                title: "Tipo Cruce", field: "EstadoMatch", headerFilter: true, width: 140, hozAlign: "center",
                formatter: (cell) => {
                    const val = cell.getValue();
                    if(val === 'Auth Exacta') return '✔️ Auth Exacta';
                    if(val === 'Match Tarjeta') return '💳 Por Tarjeta';
                    if(val === 'Sugerencia (Monto)') return '⚠️ Monto Igual';
                    if(val === 'Pendiente') return '❌ Pendiente';
                    return val;
                }
            },
            { title: "Banco", field: "Banco_Nombre", width: 80, hozAlign: "center", headerFilter: true },
            { title: "Auth Banco", field: "Banco_Auth", headerFilter: true, width: 90, cssClass: "font-mono" },
            { title: "Monto Banco", field: "Banco_Monto", formatter: "money", hozAlign: "right", bottomCalc: "sum" },
            { title: "Dif (₡)", field: "Diferencia", formatter: "money", hozAlign: "right", cssClass: "font-bold" }
        ];

        if (this.grid) {
            this.grid.updateData(data);
        } else {
            // El grid usará la altura del contenedor padre automáticamente (h-full en HTML)
            this.grid = new VanillaGrid("#table-result-tsd", data, columns, {
                searchInputId: "search-tsd",
                threshold: 0
            });
        }
    }
};