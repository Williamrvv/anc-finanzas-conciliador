window.TSDLogic = {
    lastTSD: [],
    lastBancos: [],
    blacklist: [], 
    manualMatches: [],
    ws: { tsd: [], bancos: [], originalTsd: [], originalBancos: [], rowUid: null, isAutoMatch: false }, // Workspace State
    gridMatched: null,
    gridPending: null,
    currentMatchedData: [], // Almacenará los éxitos para el guardado
    currentPendingData: [], // Almacenará los pendientes para el guardado

    // Borrador compartido M3. Se identifica únicamente por rango,
    // nunca por usuario.
    _rangoBorradorM3: null,

    // Autoguardado de respaldo cada 5 minutos.
    _autoSaveBorradorM3Timer: null,
    _ultimoSnapshotBorradorM3: null,
    _guardandoBorradorM3: false,

    // --------------------------------------------------------
    // MOTOR DE EXPORTACIÓN SOFTLAND ERP (ESTRATEGIA CONFIG-DRIVEN)
    // --------------------------------------------------------
    exportSoftland: async function(tipo) {
        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas para promediar el Tipo de Cambio.", "Fechas Requeridas", "warning");

        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) { [start, end] = dateVal.split(' a '); }

        // 1. Validar Tipo
        if (tipo === 'tarjetas') {
            return this.generateCargadorMaestroTarjetas();
        }

        // 2. Pedir Asiento al Usuario (Asíncrono)
        const asientoId = await window.SysUI.prompt("Ingrese el ID del Asiento Contable (Ej: CB12345):", "Cargador Softland", "CB");
        if (!asientoId) return; // El usuario canceló

        // Bloquear UI temporalmente
        document.body.classList.add('cursor-wait');

        try {
            // 3. Extraer Data del Multiplexor PHP
            const res = await fetch(`api/get_cargador_softland_m3.php?type=${tipo}&start=${start}&end=${end}`);
            const json = await res.json();
            
            if (!json.success) throw new Error(json.error);
            if (!json.data || json.data.length === 0) return window.SysUI.alert("No se encontraron registros pendientes en la base de datos para este cargador.", "Sin datos", "warning");

            // Traza del servidor: de dónde salió el promedio ponderado
            if (json.diag_tc) {
                console.group('%c[CARGADOR SOFTLAND] Origen del tipo de cambio (servidor)', 'color:#06b6d4;font-weight:bold');
                console.log('TC crudo (promedio ponderado):', json.diag_tc.tc_crudo);
                console.log('TC aplicado (2 decimales)    :', json.diag_tc.tc_aplicado);
                console.log('Transacciones ponderadas     :', json.diag_tc.total_transacciones);
                console.table(json.diag_tc.fechas || []);
                console.groupEnd();
            }

            // 4. Invocar Motor Creador de Excel
            this.generateSoftlandExcel(tipo, asientoId, start, json.tc_promedio, json.data);
            
            window.SysUI.alert("El archivo Excel ha sido generado y descargado con éxito.", "Cargador Creado", "success");
        } catch (error) {
            window.SysUI.alert("Error al generar cargador: " + error.message, "Fallo", "error");
        } finally {
            document.body.classList.remove('cursor-wait');
        }
    },

    generateCargadorMaestroTarjetas: async function() {
        if (!this.lastTSD.length || !this.lastBancos.length) {
            return window.SysUI.alert("No hay datos cargados en memoria. Ejecute el cruce primero.", "Sin datos", "warning");
        }

        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas.");
        const startDate = dateVal.includes(' a ') ? dateVal.split(' a ')[0] : dateVal;

        const asientoId = await window.SysUI.prompt("Ingrese el ID del Asiento Contable (Ej: IN12345678):", "Cargador Maestro Tarjetas", "IN");
        if (!asientoId) return;

        document.body.classList.add('cursor-wait');

        try {
                        // 1. CÁLCULO DEL TIPO DE CAMBIO (Promedio de TSD)
            // El promedio se redondea a 2 decimales ANTES de utilizarlo
            // para convertir los montos de colones a dólares.
            const validTCs = this.lastTSD.filter(t => t.TC > 0).map(t => parseFloat(t.TC));
            const avgTCRaw = validTCs.length > 0 ? validTCs.reduce((a, b) => a + b, 0) / validTCs.length : 1;
            const avgTC = Math.round((avgTCRaw + Number.EPSILON) * 100) / 100;

            // 2. ACUMULADORES GLOBALES
            let tBacNeto = 0, tBacAci = 0, tDaviNeto = 0, tTsdCRC = 0;
            let retRenta176 = 0, retVentas531 = 0;
            const comisionesPorCC = {};

            // Recorremos los bancos en RAM.
            this.lastBancos.forEach(b => {
                const isBac = b.Banco === 'BAC';
                const cc = b.CentroCosto || '00-00-00'; 
                
                const montoNeto = parseFloat(b.Monto_Neto) || 0;
                const comision = parseFloat(b.Comision) || 0;
                const retVentas = parseFloat(b.Retencion_Ventas) || 0;
                const retRenta = parseFloat(b.Retencion_Renta) || 0;
                const aci = parseFloat(b.ACI) || 0;

                if (!comisionesPorCC[cc]) comisionesPorCC[cc] = 0;

                if (isBac) {
                    tBacNeto += montoNeto;
                    
                    // EL BUG SOLUCIONADO: El "Monto Neto" de los archivos BAC no trae el ACI deducido, por lo que hay que restarlo del flujo de caja.
                    // Pero la Calculadora de Ajustes Manuales entrega el "Monto Neto" ya deducido.
                    // Si le volvemos a restar el ACI a un Ajuste Manual, lo duplicamos.
                    const isAjuste = (b.TipoAjuste && b.TipoAjuste !== '');
                    if (!isAjuste) {
                        tBacAci += aci; 
                    }
                    
                    retRenta176 += retRenta;
                    retVentas531 += retVentas;
                    
                    // CRÍTICA CONTABLE BAC: Se acumula la Comisión Regular + Ajuste Internacional (ACI) a la cuenta de Gastos del Centro de Costo (Aplica para Ventas y Ajustes)
                    comisionesPorCC[cc] += (comision + aci);
                } else {
                    tDaviNeto += montoNeto;
                    retRenta176 += retRenta; 
                    retVentas531 += retVentas; 
                    
                    // CRÍTICA CONTABLE DAVIBANK: El banco ya entrega la comisión sumada, no usamos ACI
                    comisionesPorCC[cc] += comision; 
                }
            });

            this.lastTSD.forEach(t => tTsdCRC += parseFloat(t.MontoCRC) || 0);

            // 3. CONSTRUCTOR DE FILAS SOFTLAND
            // Número JS puro a 2 decimales (celda tipo Número real en Excel)
            const num2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
            const dParts = startDate.split('-'); 
            // Fecha NATIVA de Excel desde el filtro (medianoche local, sin corrimiento de zona)
            const fechaAsiento = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
            const fuenteVal = `T${dParts[2]}${dParts[1]}${dParts[0]}`;

            const ws1Data = [
                ["Asiento", "Paquete", "Tipo Asiento", "Fecha", "Contabilidad"],
                [asientoId, "IN", "IN", fechaAsiento, "A"]
            ];

            const ws2Data = [
                ["Asiento", "Consecutivo", "Nit", "Centro de Costos", "Cuenta Contable", "Fuente", "Referencia", "Debito Colon", "Credito Colon", "Debito Dolar", "Credito Dolar", "TC"]
            ];

            let consecutivo = 1;
            let sumDebitoGlobal = 0, sumCreditoGlobal = 0;
            let tcInyectado = false; 

            const addRow = (cc, cuenta, ref, debito, credito) => {
                // Siempre usamos valor absoluto para no escribir signos negativos en el Excel
                const dCRC = Math.abs(Math.round((parseFloat(debito) || 0) * 100) / 100);
                const cCRC = Math.abs(Math.round((parseFloat(credito) || 0) * 100) / 100);
                
                const dUSD = dCRC > 0 ? dCRC / avgTC : 0;
                const cUSD = cCRC > 0 ? cCRC / avgTC : 0;

                // La matemática global sigue respetando los signos originales para cuadrar la balanza final
                sumDebitoGlobal += (Math.round((parseFloat(debito) || 0) * 100) / 100);
                sumCreditoGlobal += (Math.round((parseFloat(credito) || 0) * 100) / 100);

                ws2Data.push([
                    asientoId, consecutivo++, "", `${cc}`, cuenta, fuenteVal, ref,
                    dCRC > 0 ? num2(dCRC) : null, 
                    cCRC > 0 ? num2(cCRC) : null,
                    dUSD > 0 ? num2(dUSD) : null, 
                    cUSD > 0 ? num2(cUSD) : null,
                    !tcInyectado ? num2(avgTC) : null
                ]);
                tcInyectado = true;
            };

            // Fila 1: BAC Neto - ACI
            addRow('00-00-00', '101-004-003-000-000-000', 'Dinero ingresado en BAC', tBacNeto - tBacAci, 0);

            // Fila 2: Davibank Neto
            addRow('00-00-00', '101-004-003-000-000-000', 'Dinero ingresado en el Davibank', tDaviNeto, 0);

            // Fila 3: Total Tarjetas TSD
            addRow('00-00-00', '101-004-003-000-000-000', 'TARJETAS', 0, tTsdCRC);

            // Filas 4+: Comisiones Agrupadas por Centro de Costo nativo (Ya incluyen el ACI de BAC)
            Object.keys(comisionesPorCC).forEach(cc => {
                if (Math.abs(comisionesPorCC[cc]) > 0.01) {
                    addRow(cc, '520-005-002-000-000-000', 'DESCUENTO DE TARJETA', comisionesPorCC[cc], 0);
                }
            });

            // Fila Retención Renta (1.76%)
            if (Math.abs(retRenta176) > 0.01) addRow('00-00-00', '101-004-003-000-000-000', 'RETENCION DE TARJETAS 1.76%', retRenta176, 0);

            // Fila Retención Ventas (5.31%)
            if (Math.abs(retVentas531) > 0.01) addRow('00-00-00', '101-004-003-000-000-000', 'RETENCION DE TARJETAS 5.31%', retVentas531, 0);

            // Filas TSD Detallado (Positivo = Débito | Negativo = Crédito)
            this.lastTSD.forEach(t => {
                const tarj = t.Tarjeta_Ultimos4 ? `TarjetaXXXXXXXX${t.Tarjeta_Ultimos4}` : 'TarjetaXXXXXXXX';
                const ref = `${t.Contrato||''} ${t.Sucursal||''} Aut ${t.Autorizacion||''} ${tarj}`.substring(0, 100);
                const montoCRC = parseFloat(t.MontoCRC) || 0;
                
                if (montoCRC >= 0) addRow('00-00-00', '101-004-003-000-000-000', ref, montoCRC, 0);
                else addRow('00-00-00', '101-004-003-000-000-000', ref, 0, montoCRC);
            });

            // Filas Bancos Detallado (Positivo = Crédito | Negativo = Débito)
            this.lastBancos.forEach(b => {
                const isBac = b.Banco === 'BAC';
                const ref = `${b.Afiliado_MerID||''} ${b.Nombre_Sucursal_Comercio||''} AUT ${b.Numero_Autorizacion||''} TARJETA ${b.Tarjeta_Ultimos4||''}`.substring(0, 100);
                const montoVenta = parseFloat(b.Monto_Venta_Original) || 0;
                
                if (montoVenta >= 0) addRow('00-00-00', '101-004-003-000-000-000', ref, 0, montoVenta);
                else addRow('00-00-00', '101-004-003-000-000-000', ref, montoVenta, 0);
            });

            // FILA FINAL: Diferencial Cambiario
            // Lógica Estricta de Cuadratura: Recalculamos la suma exacta que se imprimirá en Excel
            let sumDebitoExcel = 0;
            let sumCreditoExcel = 0;
            
            // ws2Data[0] es la cabecera, empezamos desde 1
            for(let i = 1; i < ws2Data.length; i++) {
                // Columna 7 es Debito Colon, Columna 8 es Credito Colon (Índices basados en 0)
                // Las celdas ya son Números nativos: suma directa, sin traducir comas
                sumDebitoExcel += Number(ws2Data[i][7]) || 0;
                sumCreditoExcel += Number(ws2Data[i][8]) || 0;
            }

            const diff = Math.abs(sumDebitoExcel - sumCreditoExcel);
            
            if (diff > 0.01) {
                // Según la regla contable requerida, el Diferencial siempre va en la columna Débito Colón y sin signo negativo.
                // Cuenta: 560-005-001-001-000-000 (Gasto por Diferencial)
                addRow('00-00-00', '560-005-001-001-000-000', 'Diferencial cambiario', diff, 0);
            }

            // 4. ENSAMBLAJE FINAL SHEETJS
            const wb = XLSX.utils.book_new();
            const ws1 = XLSX.utils.aoa_to_sheet(ws1Data, { cellDates: true });
            const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);

            // Hoja 1: formato incorporado 14 = categoría "Fecha corta"
            if (ws1['D2']) { ws1['D2'].t = 'd'; ws1['D2'].z = 'm/d/yy'; }

            // Hoja 2: Debito Colon (H), Credito Colon (I), Debito Dolar (J), Credito Dolar (K), TC (L) como Número
            const rngT = XLSX.utils.decode_range(ws2['!ref']);
            for (let R = 2; R <= rngT.e.r + 1; R++) {
                ['H', 'I', 'J', 'K', 'L'].forEach(col => {
                    const cell = ws2[col + R];
                    if (cell && cell.t === 'n') cell.z = '#,##0.00';
                });
            }
            
            ws2['!cols'] = ws2Data[0].map(h => ({wch: Math.max(15, h.length + 5)}));

            XLSX.utils.book_append_sheet(wb, ws1, "Asiento");
            XLSX.utils.book_append_sheet(wb, ws2, "Desglose");

            XLSX.writeFile(wb, `Cargador_Tarjetas_${asientoId}.xlsx`);
            window.SysUI.alert("El archivo Excel del asiento de tarjetas se generó correctamente con cuadratura automática.", "Cargador Creado", "success");

        } catch (e) {
            window.SysUI.alert("Error al generar el cargador: " + e.message, "Fallo de Sistema", "error");
        } finally {
            document.body.classList.remove('cursor-wait');
        }
    },

    // Modal de fecha contable de conciliación. Sugiere el día en curso y limita
    // el máximo a hoy: una conciliación con fecha futura no tiene sentido contable.
    pedirFechaConciliacion: async function() {
        const hoy = new Date().toISOString().slice(0, 10);

        const html = `
        <div class="space-y-3 text-left whitespace-normal" id="fc-form">
            <p class="text-sm text-slate-600 dark:text-slate-300">
                Indique la <b>fecha contable</b> con la que se registrará esta conciliación.
            </p>
            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fecha de conciliación *</label>
                <input type="date" id="fc-fecha" value="${hoy}" max="${hoy}"
                    class="w-full p-2.5 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 italic">
                Se sugiere el día en curso. Puede fecharse hacia atrás si el movimiento
                corresponde a días anteriores, pero no hacia adelante.
            </p>
            <div id="fc-error" class="hidden text-[11px] text-red-600 font-bold"></div>
            <button id="fc-ok" class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors">
                Confirmar y guardar
            </button>
        </div>`;

        return new Promise((resolve) => {
            window.SysUI._createModal('Fecha de la conciliación', html, [
                { text: 'Cancelar', value: false, class: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-lg font-bold transition-colors' }
            ], 'info', 'max-w-md').then(() => resolve(null));   // cerró sin confirmar

            const btn = document.getElementById('fc-ok');
            if (btn) btn.addEventListener('click', function () {
                const val = (document.getElementById('fc-fecha') || {}).value || '';
                const err = document.getElementById('fc-error');
                if (!val) { err.innerText = 'Debe indicar una fecha.'; err.classList.remove('hidden'); return; }
                if (val > hoy) { err.innerText = 'No se permite una fecha futura.'; err.classList.remove('hidden'); return; }

                const form = document.getElementById('fc-form');
                const overlay = form ? form.closest('.fixed') : null;
                if (overlay) overlay.remove();
                resolve(val);
            });

            setTimeout(function () { const f = document.getElementById('fc-fecha'); if (f) f.focus(); }, 80);
        });
    },

    generateSoftlandExcel: function(tipo, asientoId, startDate, tcPromedio, data) {
        // El TC se fija a DOS decimales ANTES de cualquier división, para que el
        // valor que se imprime en la columna TC sea exactamente el que se usó.
        const tcCrudo = Number(tcPromedio);
        tcPromedio = Math.round((tcCrudo + Number.EPSILON) * 100) / 100;
        if (!tcPromedio || tcPromedio <= 0) tcPromedio = 1;

        console.group('%c[CARGADOR SOFTLAND] Tipo de cambio', 'color:#f59e0b;font-weight:bold');
        console.log('TC recibido del servidor :', tcCrudo, '(decimales:', String(tcCrudo).split('.')[1] ? String(tcCrudo).split('.')[1].length : 0, ')');
        console.log('TC aplicado al cálculo   :', tcPromedio);
        console.log('¿Venía con más de 2 dec? :', tcCrudo !== tcPromedio ? 'SÍ — se redondeó' : 'no');
        console.groupEnd();
        // DICCIONARIOS DE CONFIGURACIÓN CONTABLE
        const configs = {
            'davi_5': {
                cuentaCabecera: "101-004-003-000-000-000",
                cuentaDetalle: "175-001-005-001-005-000",
                referenciaCabecera: "RETENCION 5.31%",
                columnaDebito: "debito_5perc"
            },
           'davi_2': {
                cuentaCabecera: "101-004-003-000-000-000",
                cuentaDetalle: "175-001-005-001-005-000", 
                referenciaCabecera: "RETENCION 2%",
                columnaDebito: "Total_Retencion_ISR"
            },
            'bac_536': {
                // NOTA: Puse las mismas cuentas contables que en Davibank. Cambialas aquí si para BAC son diferentes.
                cuentaCabecera: "101-004-003-000-000-000",
                cuentaDetalle: "175-001-005-001-005-000", 
                referenciaCabecera: "RETENCION 5.31%",
                columnaDebito: "Total_Retencion_Ventas"
            },
            'bac_176': {
                cuentaCabecera: "101-004-003-000-000-000",
                cuentaDetalle: "175-001-005-001-005-000", 
                referenciaCabecera: "RETENCION 1.76%",
                columnaDebito: "Total_Retencion_Renta"
            }
        };

        const cfg = configs[tipo];
        
        // Parseo Inteligente para "Fuente" (Hoja 2) -> Sigue usando la fecha del filtro original
        const dPart = startDate.split('-');
        const fechaFuente = dPart.length === 3 ? `${dPart[2]}${dPart[1]}${dPart[0]}` : startDate;

        // Generar Fecha Actual Pura (Hoja 1) -> Obligatorio para Softland (Formato DD/M/YYYY)
        // Fecha NATIVA de Excel (medianoche local para evitar corrimiento por zona horaria)
        const hoy = new Date();
        const fechaAsiento = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

        // Helper: número JS puro redondeado a 2 decimales (celda tipo Número real en Excel)
        const num2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

        // ==========================================
        // CONSTRUCCIÓN HOJA 1: ASIENTO
        // ==========================================
        const ws1Data = [
            ["Asiento", "Paquete", "Tipo Asiento", "Fecha", "Contabilidad"],
            [asientoId, "CB", "CB", fechaAsiento, "A"]
        ];

        // ==========================================
        // CONSTRUCCIÓN HOJA 2: DESGLOSE
        // ==========================================
        const ws2Data = [];
        // Cabeceras exactas
        ws2Data.push(["Asiento", "Consecutivo", "Nit", "Centro de Costo", "Cuenta Contable", "Fuente", "Referencia", "Debito Colon", "Debito Dolar", "Credito Colon", "Credito Dolar", "TC"]);

        let sumDebitoColon = 0;
        let sumDebitoDolar = 0;

        // Iteración Previa: se suman los valores YA REDONDEADOS, exactamente los
        // mismos que se escriben en cada fila de detalle. Antes se acumulaba el
        // valor crudo y el total no coincidía con la suma de los detalles.
        let _diagCrudo = 0;
        data.forEach(row => {
            const debitoCol = parseFloat(row[cfg.columnaDebito]) || 0;
            const debitoDol = debitoCol / tcPromedio; // División para obtener Dólares
            sumDebitoColon += num2(debitoCol);
            sumDebitoDolar += num2(debitoDol);
            _diagCrudo += debitoDol;
        });
        sumDebitoDolar = num2(sumDebitoDolar);
        sumDebitoColon = num2(sumDebitoColon);

        console.group('%c[CARGADOR SOFTLAND] Cuadre de dólares', 'color:#f59e0b;font-weight:bold');
        console.log('Filas procesadas          :', data.length);
        console.log('Suma de detalles (correcta):', sumDebitoDolar);
        console.log('Suma sin redondear (vieja) :', num2(_diagCrudo));
        console.log('Diferencia que se corrige  :', num2(sumDebitoDolar - _diagCrudo));
        console.groupEnd();

        // Fila 1 (La Cabecera Totalizadora - Única que lleva el TC)
        ws2Data.push([
            asientoId, 
            1, 
            "", // Nit
            "00-00-00", // Texto nativo limpio (SheetJS lo escribe como celda de texto, sin apóstrofe)
            cfg.cuentaCabecera,
            fechaFuente, 
            cfg.referenciaCabecera, 
            null, // Debito Colon (celda genuinamente vacía)
            null, // Debito Dolar
            num2(sumDebitoColon), // Credito Colon (Número nativo)
            num2(sumDebitoDolar), // Credito Dolar (Número nativo)
            num2(tcPromedio)      // TC (Número nativo)
        ]);

        // Filas Dinámicas (Los Detalles / Débitos)
        let cons = 2;
        data.forEach(row => {
            const debitoCol = parseFloat(row[cfg.columnaDebito]) || 0;
            const debitoDol = debitoCol / tcPromedio; 
            
            ws2Data.push([
                asientoId,
                cons,
                "", // Nit
                "00-00-00",
                cfg.cuentaDetalle,
                row.Fuente || "", 
                row.Referencia || "", 
                num2(debitoCol), // Debito Colon (Número nativo)
                num2(debitoDol), // Debito Dolar (Número nativo)
                null, // Credito Colon
                null, // Credito Dolar
                null  // TC (Vacío real en filas de detalle)
            ]);
            cons++;
        });

        // ==========================================
        // ENSAMBLAJE FINAL SHEETJS
        // ==========================================
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(ws1Data, { cellDates: true });
        const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);

        // Hoja 1: formato incorporado 14 de Excel = categoría "Fecha corta" (se adapta a la config regional)
        if (ws1['D2']) { ws1['D2'].t = 'd'; ws1['D2'].z = 'm/d/yy'; }

        // Hoja 2: Debito Colon (H), Debito Dolar (I), Credito Colon (J), Credito Dolar (K), TC (L) como Número
        const rng2 = XLSX.utils.decode_range(ws2['!ref']);
        for (let R = 2; R <= rng2.e.r + 1; R++) {
            ['H', 'I', 'J', 'K', 'L'].forEach(col => {
                const cell = ws2[col + R];
                if (cell && cell.t === 'n') cell.z = '#,##0.00';
            });
        }

        XLSX.utils.book_append_sheet(wb, ws1, "Asiento");
        XLSX.utils.book_append_sheet(wb, ws2, "Desglose");

        XLSX.writeFile(wb, `Cargador_${tipo}_${asientoId}.xlsx`);
    },

    _borradorApiM3: async function(action, payload = {}) {
        const rango = this._rangoBorradorM3 || {};

        const res = await fetch('api/borrador_tsd_m3.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify(Object.assign({
                action: action,
                inicio: rango.start || '',
                fin: rango.end || ''
            }, payload))
        });

        const raw = await res.text();

        let data;

        try {
            data = JSON.parse(raw);
        } catch (error) {
            const preview = raw
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 160);

            throw new Error(
                `El endpoint de borradores devolvió una respuesta no JSON ` +
                `(HTTP ${res.status}).` +
                (preview ? ` Respuesta: ${preview}` : '')
            );
        }

        if (!res.ok || !data.success) {
            throw new Error(
                data.error ||
                `Error HTTP ${res.status} al procesar el borrador TSD.`
            );
        }

        return data;
    },

    _crearSnapshotBorradorM3: function() {
        return {
            manualMatches: (this.manualMatches || []).map(match => ({
                tsdIds: (match.tsdArr || [])
                    .map(t => String(t.ID_Transaccion || ''))
                    .filter(Boolean),

                bancoIds: (match.bancoArr || [])
                    .map(b => String(b.IdTransaccion || ''))
                    .filter(Boolean),

                justificacion: match.justificacion || ''
            })),

            blacklist: Array.from(
                new Set(
                    (this.blacklist || [])
                        .map(item => String(item || ''))
                        .filter(Boolean)
                )
            )
        };
    },

    _aplicarSnapshotBorradorM3: function(snapshot) {
        snapshot = snapshot || {};

        const mapaTSD = new Map(
            (this.lastTSD || []).map(t => [
                String(t.ID_Transaccion),
                t
            ])
        );

        const mapaBancos = new Map(
            (this.lastBancos || []).map(b => [
                String(b.IdTransaccion),
                b
            ])
        );

        this.blacklist = Array.isArray(snapshot.blacklist)
            ? Array.from(new Set(snapshot.blacklist.map(String)))
            : [];

        this.manualMatches = Array.isArray(snapshot.manualMatches)
            ? snapshot.manualMatches.map(match => ({
                tsdArr: (match.tsdIds || [])
                    .map(id => mapaTSD.get(String(id)))
                    .filter(Boolean),

                bancoArr: (match.bancoIds || [])
                    .map(id => mapaBancos.get(String(id)))
                    .filter(Boolean),

                justificacion: match.justificacion || ''
            })).filter(match =>
                match.tsdArr.length > 0 ||
                match.bancoArr.length > 0
            )
            : [];
    },

    guardarBorradorM3: async function(opciones = {}) {
        const forzar = opciones.forzar === true;

        if (!this._rangoBorradorM3) {
            return { guardado: false, motivo: 'sin_rango' };
        }

        if (this._guardandoBorradorM3) {
            return { guardado: false, motivo: 'ocupado' };
        }

        const snapshot = this._crearSnapshotBorradorM3();

        const tieneCambios =
            snapshot.manualMatches.length > 0 ||
            snapshot.blacklist.length > 0;

        const dataJson = JSON.stringify(snapshot);

        // Si no existe ningún cambio y tampoco teníamos un borrador
        // previo, no hacemos una petición inútil cada 5 minutos.
        if (
            !tieneCambios &&
            this._ultimoSnapshotBorradorM3 === null
        ) {
            return {
                guardado: false,
                motivo: 'sin_cambios'
            };
        }

        // Si el usuario deshizo todos los cambios, borramos el
        // borrador existente para que el rango vuelva a estado limpio.
        if (!tieneCambios) {
            this._guardandoBorradorM3 = true;

            try {
                await this.eliminarBorradorM3();
                this._ultimoSnapshotBorradorM3 = null;

                return {
                    guardado: true,
                    eliminado: true
                };
            } finally {
                this._guardandoBorradorM3 = false;
            }
        }

        // El autoguardado no vuelve a escribir exactamente el mismo
        // snapshot. El botón manual sí puede forzar una actualización.
        if (
            !forzar &&
            dataJson === this._ultimoSnapshotBorradorM3
        ) {
            return {
                guardado: false,
                motivo: 'sin_cambios'
            };
        }

        this._guardandoBorradorM3 = true;

        try {
            await this._borradorApiM3('save', {
                dataJson: dataJson
            });

            this._ultimoSnapshotBorradorM3 = dataJson;

            return {
                guardado: true
            };

        } finally {
            this._guardandoBorradorM3 = false;
        }
    },

    eliminarBorradorM3: async function() {
        if (!this._rangoBorradorM3) return;

        await this._borradorApiM3('delete');
    },

    startAutoSaveBorradorM3: function() {
        this.stopAutoSaveBorradorM3();

        // 5 minutos exactos.
        this._autoSaveBorradorM3Timer = setInterval(async () => {
            if (!this._rangoBorradorM3) return;

            try {
                const resultado = await this.guardarBorradorM3();

                if (resultado && resultado.guardado) {
                    console.log(
                        '💾 Borrador M3 autoguardado:',
                        new Date().toLocaleTimeString()
                    );
                }

            } catch (error) {
                // Un fallo de autoguardado NO interrumpe al usuario.
                // El siguiente ciclo volverá a intentarlo.
                console.error(
                    'Error en autoguardado M3:',
                    error
                );
            }

        }, 5 * 60 * 1000);
    },

    stopAutoSaveBorradorM3: function() {
        if (this._autoSaveBorradorM3Timer) {
            clearInterval(this._autoSaveBorradorM3Timer);
            this._autoSaveBorradorM3Timer = null;
        }
    },

    guardarBorradorManualM3: async function() {
        if (!this._rangoBorradorM3) {
            return window.SysUI.alert(
                "Primero debe seleccionar y consultar un rango de fechas.",
                "Sin rango",
                "warning"
            );
        }

        const snapshot = this._crearSnapshotBorradorM3();

        if (
            snapshot.manualMatches.length === 0 &&
            snapshot.blacklist.length === 0
        ) {
            return window.SysUI.alert(
                "No existen cambios manuales que guardar en este rango.",
                "Sin cambios",
                "info"
            );
        }

        const btn = document.getElementById('btn-save-draft-tsd');
        const originalHtml = btn ? btn.innerHTML : '';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                GUARDANDO...
            `;
        }

        try {
            await this.guardarBorradorM3({
                forzar: true
            });

            await window.SysUI.alert(
                "El borrador del Consolidado TSD fue guardado correctamente.",
                "Borrador guardado",
                "success"
            );

        } catch (error) {
            await window.SysUI.alert(
                "No fue posible guardar el borrador:\n\n" + error.message,
                "Error de borrador",
                "error"
            );

        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    },

    init: function() {
        console.log("🚀 Módulo TSD Inicializado");

        if(this.gridMatched) {
            if (typeof this.gridMatched.destroy === 'function') this.gridMatched.destroy();
            this.gridMatched = null;
        }

        if(this.gridPending) {
            if (typeof this.gridPending.destroy === 'function') this.gridPending.destroy();
            this.gridPending = null;
        }

        // Al entrar al módulo NO heredamos ningún trabajo anterior en RAM.
        // Todo empieza únicamente después de que el usuario seleccione un rango.
        this.lastTSD = [];
        this.lastBancos = [];
        this.manualMatches = [];
        this.blacklist = [];
        this.currentMatchedData = [];
        this.currentPendingData = [];

        this.stopAutoSaveBorradorM3();

        this._rangoBorradorM3 = null;
        this._ultimoSnapshotBorradorM3 = null;

        if (window.flatpickr) {
            this.datePicker = flatpickr("#tsd-date-picker", {
                mode: "range",
                dateFormat: "Y-m-d",
                locale: "es",

                // Sin defaultDate: M3 espera explícitamente a que
                // el usuario indique el rango que desea trabajar.
                onClose: (selectedDates, dateStr, instance) => {
                    if (selectedDates.length > 0 && dateStr) {
                        window.TSDLogic.fetchAndMatch(dateStr);
                    }
                }
            });
        }
    },

    updateThreshold: function() {
        if (this.gridMatched && typeof this.gridMatched.render === 'function') this.gridMatched.render();
        if (this.gridPending && typeof this.gridPending.render === 'function') this.gridPending.render();
    },

    updateFinancialDashboard: function(tsd, bancos) {
        let tUsd = 0, tCrc = 0;
        let bBruto = 0, bNeto = 0, bCom = 0, bRetV = 0, bRetR = 0, bAci = 0;
        let dBruto = 0, dNeto = 0, dCom = 0, dRetV = 0, dRetR = 0;

        tsd.forEach(t => {
            tUsd += parseFloat(t.MontoUSD) || 0;
            tCrc += parseFloat(t.MontoCRC) || 0;
        });

        bancos.forEach(b => {
            const isBac = b.Banco === 'BAC';
            const bruto = parseFloat(b.Monto_Venta_Original) || 0;
            const neto = parseFloat(b.Monto_Neto) || 0;
            const com = parseFloat(b.Comision) || 0;
            const retv = parseFloat(b.Retencion_Ventas) || 0;
            const retr = parseFloat(b.Retencion_Renta) || 0;
            const aci = parseFloat(b.ACI) || 0;

            if (isBac) {
                bBruto += bruto; bNeto += neto; bCom += com; bRetV += retv; bRetR += retr; bAci += aci;
            } else {
                dBruto += bruto; dNeto += neto; dCom += com; dRetV += retv; dRetR += retr;
            }
        });

        const fmt = (v, curr='CRC') => new Intl.NumberFormat('es-CR', {style:'currency', currency: curr}).format(v).replace(/\./g, ' ');

        const s = (id, val, curr) => { const el = document.getElementById(id); if(el) el.innerText = fmt(val, curr); };

        s('dash-tsd-usd', tUsd, 'USD'); s('dash-tsd-crc', tCrc, 'CRC');
        s('dash-bac-bruto', bBruto, 'CRC'); s('dash-bac-neto', bNeto, 'CRC'); s('dash-bac-com', bCom, 'CRC');
        s('dash-bac-retv', bRetV, 'CRC'); s('dash-bac-retr', bRetR, 'CRC'); s('dash-bac-aci', bAci, 'CRC');
        
        s('dash-davi-bruto', dBruto, 'CRC'); s('dash-davi-neto', dNeto, 'CRC'); s('dash-davi-com', dCom, 'CRC');
        s('dash-davi-retv', dRetV, 'CRC'); s('dash-davi-retr', dRetR, 'CRC');
        
        s('dash-tot-bruto', bBruto + dBruto, 'CRC'); s('dash-tot-neto', bNeto + dNeto, 'CRC');
    },

    openRawViewer: function() {
        const dateVal = document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas para consultar TSD.");

        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) {
            [start, end] = dateVal.split(' a ');
        }
        
        const width = 1200;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(`visor_crudos.php?start=${start}&end=${end}`, 'VisorCrudosIRI', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
    },

    fetchAndMatch: async function(dateValParam = null) {
        const dateVal = dateValParam || document.getElementById('tsd-date-picker').value;
        if (!dateVal) return window.SysUI.alert("Seleccione un rango de fechas válido.");

        // Nunca permitir que el reloj de un rango anterior guarde datos
        // mientras estamos cambiando a otro rango.
        this.stopAutoSaveBorradorM3();
        this._ultimoSnapshotBorradorM3 = null;

        let start = dateVal, end = dateVal;
        if (dateVal.includes(' a ')) {
            [start, end] = dateVal.split(' a ');
        }

        const inputEl = document.getElementById('tsd-date-picker');
        const loaderEl = document.getElementById('tsd-date-loader');
        
        // Bloquear input y activar animación minimalista (Barra inferior deslizante)
        inputEl.disabled = true;
        inputEl.classList.add('cursor-wait', 'opacity-80');
        if (loaderEl) {
            loaderEl.classList.remove('opacity-0');
            loaderEl.classList.add('animate-slide-infinite');
        }

        const containerMatched = document.getElementById('table-matched-tsd');
        const containerPending = document.getElementById('table-pending-tsd');
        
        if (containerMatched && containerPending) {
            if(this.gridMatched) { if(typeof this.gridMatched.destroy === 'function') this.gridMatched.destroy(); this.gridMatched = null; }
            if(this.gridPending) { if(typeof this.gridPending.destroy === 'function') this.gridPending.destroy(); this.gridPending = null; }
            
            containerMatched.innerHTML = `
                <div class="absolute inset-0 flex flex-col items-center justify-center text-blue-500 w-full bg-slate-50/50 dark:bg-slate-900/50 z-10">
                    <svg class="animate-spin h-10 w-10 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span class="font-bold">Extrayendo datos...</span>
                </div>
            `;
            containerPending.innerHTML = '';
        }

        try {
            const res = await fetch(`api/get_cruce_m3.php?start=${start}&end=${end}`);
            const json = await res.json();

            if (!json.success) throw new Error(json.error);

            // El borrador pertenece EXACTAMENTE al rango consultado.
            this._rangoBorradorM3 = {
                start: start,
                end: end
            };

            // Un cambio de rango NUNCA puede heredar modificaciones
            // que estaban solamente en la RAM del rango anterior.
            this.manualMatches = [];
            this.blacklist = [];

            // Siempre obtenemos primero la fuente fresca.
            this.lastTSD = json.tsd.map(t => {
                t._id = 't_' + t.ID_Transaccion;
                return t;
            });

            this.lastBancos = json.bancos.map(b => {
                b._id = 'b_' + b.IdTransaccion;
                return b;
            });

            this.updateFinancialDashboard(
                this.lastTSD,
                this.lastBancos
            );

            // Después de tener los datos actuales, buscamos si alguien
            // dejó cambios manuales guardados para ESTE MISMO rango.
            let borradorEncontrado = null;

            try {
                const borrador = await this._borradorApiM3('get');

                if (borrador.existe) {
                    const snapshot = JSON.parse(borrador.dataJson || '{}');

                    this._aplicarSnapshotBorradorM3(snapshot);

                    // Evita que el autoguardado vuelva a escribir exactamente
                    // el mismo borrador cinco minutos después sin necesidad.
                    this._ultimoSnapshotBorradorM3 =
                        JSON.stringify(this._crearSnapshotBorradorM3());

                    borradorEncontrado = borrador;
                }
            } catch (errorBorrador) {
                console.error(
                    'No se pudo consultar el borrador M3:',
                    errorBorrador
                );

                await window.SysUI.alert(
                    `Los datos del rango fueron consultados correctamente, pero no fue posible revisar si existe un borrador compartido.\n\n${errorBorrador.message}`,
                    "Borrador no disponible",
                    "warning"
                );
            }

            // El algoritmo siempre trabaja sobre la data fresca.
            // manualMatches + blacklist reconstruyen encima los cambios humanos.
            this.runMatchingAlgorithm(
                this.lastTSD,
                this.lastBancos
            );

            // Desde este momento existe un rango válido en memoria.
            // El respaldo automático se ejecutará cada 5 minutos.
            this.startAutoSaveBorradorM3();

            if (borradorEncontrado) {
                const usuario =
                    borradorEncontrado.usuarioUltimo ||
                    borradorEncontrado.usuarioInicio ||
                    'otro usuario';

                const fechaCambio =
                    borradorEncontrado.fechaActualizacion
                        ? `\nÚltima modificación: ${borradorEncontrado.fechaActualizacion}`
                        : '';

                const rangoTexto =
                    start === end
                        ? start
                        : `${start} a ${end}`;

                await window.SysUI.alert(
                    `Se encontró una conciliación temporal guardada para el rango ${rangoTexto}.\n\nSe mostrarán automáticamente los cambios realizados por ${usuario}.${fechaCambio}`,
                    "Conciliación recuperada",
                    "info"
                );
            }

        } catch (error) {
            console.error(error);
            window.SysUI.alert("Error al obtener datos: " + error.message, "Fallo de Conexión", "error");
            if (containerMatched) {
                containerMatched.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-red-400 gap-2 opacity-50">
                        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <span class="text-sm font-medium">Error de consulta. Inténtelo nuevamente.</span>
                    </div>
                `;
            }
        } finally {
            // Desbloquear input y quitar animación minimalista
            inputEl.disabled = false;
            inputEl.classList.remove('cursor-wait', 'opacity-80');
            if (loaderEl) {
                loaderEl.classList.add('opacity-0');
                loaderEl.classList.remove('animate-slide-infinite');
            }
        }
    },

    openCardModal: function() {
        const modal = document.getElementById('modal-cards-tsd');
        
        // Mover el modal al root del body para escapar del stacking context (blur oscuro completo)
        if (modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }

        document.getElementById('single-contrato').value = '';
        document.getElementById('single-tarjeta').value = '';
        document.getElementById('paste-zone-cards').value = '';
        
        modal.classList.remove('hidden');
    },

    processCardPaste: async function() {
        const sContrato = document.getElementById('single-contrato').value.trim();
        const sTarjeta = document.getElementById('single-tarjeta').value.trim().replace(/[^a-zA-Z0-9]/g, '');
        const text = document.getElementById('paste-zone-cards').value;
        
        const tarjetas = [];

        // 1. Procesar Individual
        if (sContrato !== '' && sTarjeta !== '') {
            tarjetas.push({ contrato: sContrato, tarjeta: sTarjeta.slice(-4) });
        }

        // 2. Procesar Masivo
        if (text.trim() !== '') {
            const rows = text.split('\n');
            rows.forEach(r => {
                const cols = r.split('\t'); 
                if (cols.length >= 2) {
                    const contrato = String(cols[0]).trim();
                    const tarjetaCruda = String(cols[1]).trim().replace(/[^a-zA-Z0-9]/g, '');
                    if (contrato !== '' && tarjetaCruda !== '') {
                        tarjetas.push({ contrato: contrato, tarjeta: tarjetaCruda.slice(-4) });
                    }
                }
            });
        }

        if (tarjetas.length === 0) return window.SysUI.alert("Ingrese al menos un contrato y tarjeta para continuar.", "Campos Vacíos", "warning");

        // 3. Cerrar el Modal de inmediato para que el usuario no se sienta bloqueado
        document.getElementById('modal-cards-tsd').classList.add('hidden');

        // --- ACTUALIZACIÓN INMEDIATA EN RAM Y UI ---
        tarjetas.forEach(t => {
            const row = this.lastTSD.find(r => String(r.Contrato).trim() === String(t.contrato));
            if (row) {
                row.Tarjeta_Ultimos4 = t.tarjeta;
            }
        });

        // Recalcular la tabla entera al vuelo 
        this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);
        
        // --- GUARDADO EN BD (Segundo Plano No Bloqueante) ---
        const btnHeader = document.getElementById('btn-ingestar-tarjetas');
        const originalText = btnHeader.innerHTML;
        
        if (btnHeader) {
            btnHeader.innerHTML = '<svg class="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span class="text-blue-500 font-black animate-pulse">Sincronizando Historial BD...</span>';
            btnHeader.disabled = true;
            btnHeader.classList.add('cursor-not-allowed', 'ring-2', 'ring-blue-400');
        }

        try {
            const res = await fetch('api/save_tarjetas_m3.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tarjetas: tarjetas })
            });
            const data = await res.json();
            
            if(!data.success) throw new Error(data.error);

            // Toast Sutil (No bloquea la pantalla con botón "Aceptar")
            if (btnHeader) {
                btnHeader.innerHTML = '<svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> <span class="text-green-600 font-bold">¡Guardado con éxito!</span>';
                setTimeout(() => {
                    btnHeader.innerHTML = originalText;
                    btnHeader.classList.remove('ring-2', 'ring-blue-400');
                }, 3000);
            }
            
        } catch (error) {
            window.SysUI.alert("Las tarjetas se aplicaron en pantalla, pero hubo un error guardándolas en BD: " + error.message, "Fallo al Guardar BD", "error");
            if (btnHeader) btnHeader.innerHTML = originalText;
        } finally {
            if (btnHeader) btnHeader.disabled = false;
        }
    },

    runMatchingAlgorithm: function(tsdData, bancosData) {
        console.log(`🧠 Ejecutando Algoritmo Multi-Match (9 Fases): ${tsdData.length} TSD vs ${bancosData.length} Bancos`);

        const gridData = [];
        let bancosDisponibles = [...bancosData]; 
        let pendientesTSD = [...tsdData]; 

        const procesadosTSDIds = [];
        const procesadosBancosIds = [];

        // LIMPIEZA INTELIGENTE: cleanAuth destruye los ceros a la izquierda (ej: "00123" se convierte en "123")
        const cleanStr = (str) => String(str || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const cleanAuth = (str) => { const a = cleanStr(str).replace(/^0+/, ''); return a === '' ? null : a; };
        const getCard = (str) => { const c = cleanStr(str).slice(-4); return c.length === 4 ? c : null; };
        
        // CORRECCIÓN: Blacklist opera 100% por Llave Primaria (Id_Transaccion de TSD y Banco)
        const isBlacklisted = (idTsd, idTrans) => this.blacklist.includes(String(idTsd).trim() + '|' + String(idTrans).trim());
        const isSameMonto = (m1, m2) => Math.abs(parseFloat(m1) - parseFloat(m2)) < 2; 

        // MOTOR DE DIBUJO DE FILAS
        const processMatch = (tsdRow, bancoRow, matchType, justificacion = '') => {
            const tsdArr = Array.isArray(tsdRow) ? tsdRow : [tsdRow];
            const bancoArr = Array.isArray(bancoRow) ? bancoRow : [bancoRow];
            
            tsdArr.forEach(t => procesadosTSDIds.push(t._id));
            bancoArr.forEach(b => procesadosBancosIds.push(b._id));

            const isMulti = tsdArr.length > 1 || bancoArr.length > 1;

            let finalMatchType = matchType;
            if (!isMulti) {
                if (matchType.includes('Auth Grupal')) finalMatchType = matchType.includes('Monto') ? 'Auth + Monto' : 'Auth Solo';
                if (matchType.includes('Tarjeta Grupal')) finalMatchType = matchType.includes('Monto') ? 'Tarjeta + Monto' : 'Tarjeta Solo';
            }

            if (finalMatchType === 'Manual' && justificacion) {
                finalMatchType = `Manual|${justificacion}`;
            }

            // Colocar los datos en orden de mayor a menor magnitud
            const montoTSD = tsdArr.map(c => parseFloat(c.MontoCRC) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
            const montoBanco = bancoArr.map(c => parseFloat(c.Monto_Venta_Original) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
            const isNegative = montoTSD < 0;

            let bgColorClass = 'bg-[#fce4d6] dark:bg-[#7c6f69] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800'; 
            if (finalMatchType.includes('Tarjeta')) bgColorClass = 'bg-[#ddebf7] dark:bg-[#1e3a8a] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800'; 
            if (finalMatchType.includes('Sugerencia')) bgColorClass = 'bg-[#fef08a] dark:bg-[#854d0e] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800'; 
            if (finalMatchType.includes('Ajuste Interno')) bgColorClass = 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-100 border-b border-cyan-200 dark:border-cyan-800'; 
            if (finalMatchType.includes('Ajuste Menor')) bgColorClass = 'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-900 dark:text-fuchsia-100 border-b border-fuchsia-300 dark:border-fuchsia-700 font-bold shadow-sm'; 
            if (finalMatchType.startsWith('Manual')) bgColorClass = 'bg-[#ffe699] dark:bg-[#b2a06b] text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-800 font-bold';
            if (isNegative && !finalMatchType.includes('Ajuste Interno') && !finalMatchType.includes('Ajuste Menor')) bgColorClass = 'bg-[#d9d9d9] dark:bg-[#262626] text-slate-900 dark:text-slate-300 border-b border-slate-400 dark:border-slate-900 font-bold';

            // Blindaje: Extracción segura en caso de que sea un Ajuste Manual de 1 solo lado
            const t0 = tsdArr.length > 0 ? tsdArr[0] : {};
            const b0 = bancoArr.length > 0 ? bancoArr[0] : {};

            const contratoRep = isMulti ? tsdArr.map(t=>t.Contrato).join(', ') : (t0.Contrato || 'Solo Banco');
            const clienteRep = isMulti ? tsdArr.map(t=>t.Cliente).join(', ') : (t0.Cliente || '-'); 
            const authTSDRep = isMulti ? tsdArr.map(t=>t.Autorizacion).join(', ') : (t0.Autorizacion || '-');
            
            const tarjetaRep = isMulti 
                ? tsdArr.map(t => cleanStr(t.Tarjeta_Ultimos4).length >= 4 ? `****${cleanStr(t.Tarjeta_Ultimos4).slice(-4)}` : 'S/D').join(', ')
                : (cleanStr(t0.Tarjeta_Ultimos4).length >= 4 ? `****${cleanStr(t0.Tarjeta_Ultimos4).slice(-4)}` : 'S/D');
            
            const bancoRep = isMulti ? bancoArr.map(b=>b.Banco).join(', ') : (b0.Banco || 'Solo TSD');
            const authBancoRep = isMulti ? bancoArr.map(b=>b.Numero_Autorizacion).join(', ') : (b0.Numero_Autorizacion || '-');

            // Diferencia Contable Real: Tomar el mayor, restarle el menor y conservar el signo del mayor
            const absT = Math.abs(montoTSD);
            const absB = Math.abs(montoBanco);
            const gap = Math.abs(absT - absB);
            
            let diffReal = 0;
            if (absT >= absB) {
                diffReal = montoTSD < 0 ? -gap : gap;
            } else {
                diffReal = montoBanco < 0 ? -gap : gap;
            }

            gridData.push({
                _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                _tsdRaw: isMulti ? tsdArr : tsdArr[0], 
                _bancoRaw: isMulti ? bancoArr : bancoArr[0],
                _isMulti: isMulti,
                _rowClass: bgColorClass,
                Contrato: contratoRep,
                Cliente: clienteRep,
                TarjetaTSD: tarjetaRep,
                Autorizacion: authTSDRep,
                MontoTSD: { 
                    valor: montoTSD, 
                    recibo: isMulti ? '' : (t0.Recibo_Detalle || ''),
                    valueOf: function() { return this.valor; },
                    toString: function() { return this.valor.toString(); }
                }, 
                EstadoMatch: finalMatchType, 
                Banco_Nombre: bancoRep,
                Banco_Auth: authBancoRep,
                Banco_Monto: montoBanco, 
                Diferencia: diffReal
            });
        };

        // --- FASE 0: MANUALES DEL USUARIO ---
        // Actualizamos los objetos con las llaves primarias para que el snapshot soporte recargas de BD (Ingesta de tarjetas)
        this.manualMatches.forEach(mMatch => {
            const arrT = pendientesTSD.filter(t => mMatch.tsdArr.some(x => x.ID_Transaccion === t.ID_Transaccion));
            const arrB = bancosDisponibles.filter(b => mMatch.bancoArr.some(x => x.IdTransaccion === b.IdTransaccion));
            
            if (arrT.length > 0 || arrB.length > 0) processMatch(arrT, arrB, 'Manual', mMatch.justificacion);
            
            pendientesTSD = pendientesTSD.filter(t => !mMatch.tsdArr.some(x => x.ID_Transaccion === t.ID_Transaccion));
            bancosDisponibles = bancosDisponibles.filter(b => !mMatch.bancoArr.some(x => x.IdTransaccion === b.IdTransaccion));
        });

        const blindajeTSD = [...tsdData]; 
        const blindajeBancos = [...bancosData];

        // --- HELPERS DE BUSQUEDA PARA FASES 1 A 8 ---
        const run1to1Phase = (keyGetterT, keyGetterB, matchLabel, requireSameMonto, maxTolerance = null) => {
            let nextTSD = [];
            pendientesTSD.forEach(tsdRow => {
                const kT = keyGetterT(tsdRow);
                const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
                let matchIdx = -1;
                if (kT) {
                    matchIdx = bancosDisponibles.findIndex(b => {
                        const kB = keyGetterB(b);
                        const montoBanco = parseFloat(b.Monto_Venta_Original) || 0;
                        let valid = kB === kT && !isBlacklisted(tsdRow.ID_Transaccion, b.IdTransaccion);
                        
                        if (requireSameMonto) {
                            valid = valid && isSameMonto(montoBanco, montoTSD);
                        } else if (maxTolerance !== null) {
                            // Aplicar Tolerancia de Seguridad (Evalúa magnitudes)
                            const gap = Math.abs(Math.abs(montoTSD) - Math.abs(montoBanco));
                            valid = valid && (gap < maxTolerance);
                        }
                        return valid;
                    });
                }
                if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], matchLabel);
                else nextTSD.push(tsdRow);
            });
            pendientesTSD = nextTSD;
        };

        const runGroupPhase = (keyGetterT, keyGetterB, matchLabelExact, matchLabelSolo, strictMonto, maxTolerance = null) => {
            const groupT = {}, groupB = {};
            pendientesTSD.forEach(r => { const k = keyGetterT(r); if(k) { groupT[k] = groupT[k]||[]; groupT[k].push(r); } });
            bancosDisponibles.forEach(r => { const k = keyGetterB(r); if(k) { groupB[k] = groupB[k]||[]; groupB[k].push(r); } });

            for (const k in groupT) {
                if (groupB[k]) {
                    const arrT = groupT[k], arrB = groupB[k];
                    // Evaluamos usando ID_Transaccion en la matriz grupal
                    if (!arrT.some(t => arrB.some(b => isBlacklisted(t.ID_Transaccion, b.IdTransaccion)))) {
                        
                        // Uso de magnitudes absolutas para proteger contra signos cruzados
                        const sumT = arrT.map(c => parseFloat(c.MontoCRC) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
                        const sumB = arrB.map(c => parseFloat(c.Monto_Venta_Original) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
                        
                        if (isSameMonto(sumT, sumB)) {
                            processMatch(arrT, arrB, matchLabelExact);
                            pendientesTSD = pendientesTSD.filter(t => !arrT.includes(t));
                            bancosDisponibles = bancosDisponibles.filter(b => !arrB.includes(b));
                        } else if (!strictMonto) {
                            let valid = true;
                            if (maxTolerance !== null) {
                                // Aplicar Tolerancia de Seguridad para evitar cruces absurdos
                                const gap = Math.abs(Math.abs(sumT) - Math.abs(sumB));
                                if (gap >= maxTolerance) valid = false;
                            }
                            
                            if (valid) {
                                processMatch(arrT, arrB, matchLabelSolo);
                                pendientesTSD = pendientesTSD.filter(t => !arrT.includes(t));
                                bancosDisponibles = bancosDisponibles.filter(b => !arrB.includes(b));
                            }
                        }
                    }
                }
            }
        };

        const getAuthT = r => cleanAuth(r.Autorizacion);
        const getAuthB = r => cleanAuth(r.Numero_Autorizacion);
        const getCardT = r => getCard(r.Tarjeta_Ultimos4);
        const getCardB = r => getCard(r.Tarjeta_Ultimos4);

        // EJECUCIÓN DE LAS 8 FASES (Cascada Implacable)
        run1to1Phase(getAuthT, getAuthB, 'Auth + Monto', true);          // Fase 1
        runGroupPhase(getAuthT, getAuthB, 'Auth Grupal + Monto', '', true); // Fase 2
        run1to1Phase(getAuthT, getAuthB, 'Auth Solo', false);            // Fase 3 (Autorización es fuerte, no ocupa límite)
        runGroupPhase(getAuthT, getAuthB, '', 'Auth Grupal Solo', false);   // Fase 4 
        
        run1to1Phase(getCardT, getCardB, 'Tarjeta + Monto', true);       // Fase 5
        runGroupPhase(getCardT, getCardB, 'Tarjeta Grupal + Monto', '', true); // Fase 6
        
        // --- LIMITE DE TOLERANCIA ESTRICTA (10,000 COLONES) PARA CRUCES SOLO POR TARJETA ---
        run1to1Phase(getCardT, getCardB, 'Tarjeta Solo', false, 10000);         // Fase 7
        runGroupPhase(getCardT, getCardB, '', 'Tarjeta Grupal Solo', false, 10000);   // Fase 8

        // --- FASE 8.5: AJUSTES INTERNOS (CANCELACIÓN DENTRO DE LA MISMA FUENTE) ---
        const runInternalOffsetPhase = () => {
            // 1. TSD vs TSD (Por Contrato)
            let nextTSD = [];
            let usedTSD = new Set();
            for (let i = 0; i < pendientesTSD.length; i++) {
                if (usedTSD.has(i)) continue;
                let t1 = pendientesTSD[i];
                let k1 = String(t1.Contrato || '').trim().toUpperCase();
                if (!k1 || k1 === 'S/D') { nextTSD.push(t1); continue; }

                let m1 = parseFloat(t1.MontoCRC) || 0;
                let matchIdx = -1;

                for (let j = i + 1; j < pendientesTSD.length; j++) {
                    if (usedTSD.has(j)) continue;
                    let t2 = pendientesTSD[j];
                    let k2 = String(t2.Contrato || '').trim().toUpperCase();
                    
                    if (k1 === k2) {
                        let m2 = parseFloat(t2.MontoCRC) || 0;
                        let key = String(t1.ID_Transaccion).trim() + '|' + String(t2.ID_Transaccion).trim();
                        let reverseKey = String(t2.ID_Transaccion).trim() + '|' + String(t1.ID_Transaccion).trim();

                        // Signos opuestos y brecha menor a 10,000 + Blindaje Blacklist
                        if ((m1 * m2 < 0) && Math.abs(m1 + m2) < 10000 && !this.blacklist.includes(key) && !this.blacklist.includes(reverseKey)) {
                            matchIdx = j; break;
                        }
                    }
                }

                if (matchIdx !== -1) {
                    usedTSD.add(matchIdx);
                    processMatch([t1, pendientesTSD[matchIdx]], [], 'Ajuste Interno TSD');
                } else {
                    nextTSD.push(t1);
                }
            }
            pendientesTSD = nextTSD;

            // 2. Banco vs Banco (Por Autorización)
            let nextBancos = [];
            let usedBancos = new Set();
            for (let i = 0; i < bancosDisponibles.length; i++) {
                if (usedBancos.has(i)) continue;
                let b1 = bancosDisponibles[i];
                let k1 = getAuthB(b1);
                if (!k1) { nextBancos.push(b1); continue; }

                let m1 = parseFloat(b1.Monto_Venta_Original) || 0;
                let matchIdx = -1;

                for (let j = i + 1; j < bancosDisponibles.length; j++) {
                    if (usedBancos.has(j)) continue;
                    let b2 = bancosDisponibles[j];
                    let k2 = getAuthB(b2);

                    if (k1 === k2) {
                        let m2 = parseFloat(b2.Monto_Venta_Original) || 0;
                        let key = String(b1.IdTransaccion).trim() + '|' + String(b2.IdTransaccion).trim();
                        let reverseKey = String(b2.IdTransaccion).trim() + '|' + String(b1.IdTransaccion).trim();

                        // Signos opuestos y brecha menor a 10,000 + Blindaje Blacklist
                        if ((m1 * m2 < 0) && Math.abs(m1 + m2) < 10000 && !this.blacklist.includes(key) && !this.blacklist.includes(reverseKey)) {
                            matchIdx = j; break;
                        }
                    }
                }

                if (matchIdx !== -1) {
                    usedBancos.add(matchIdx);
                    processMatch([], [b1, bancosDisponibles[matchIdx]], 'Ajuste Interno Banco');
                } else {
                    nextBancos.push(b1);
                }
            }
            bancosDisponibles = nextBancos;
        };
        runInternalOffsetPhase();

        // --- FASE 9: SUGERENCIA (MONTO SOLO) ---
        let nextTSD = [];
        pendientesTSD.forEach(tsdRow => {
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            let matchIdx = -1;
            if (Math.abs(montoTSD) > 0) { 
                matchIdx = bancosDisponibles.findIndex(b => isSameMonto(b.Monto_Venta_Original, montoTSD) && !isBlacklisted(tsdRow.ID_Transaccion, b.IdTransaccion));
            }
            if (matchIdx !== -1) processMatch(tsdRow, bancosDisponibles.splice(matchIdx, 1)[0], 'Sugerencia (Monto)');
            else nextTSD.push(tsdRow);
        });
        pendientesTSD = nextTSD;

        // --- FASE 10: AJUSTE MENOR (MONTOS < 10000 SOLITARIOS) ---
        let finalTSD = [];
        pendientesTSD.forEach(tsdRow => {
            const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
            const keyMenor = String(tsdRow.ID_Transaccion).trim() + '|MENOR';
            if (Math.abs(montoTSD) > 0 && Math.abs(montoTSD) < 10000 && !this.blacklist.includes(keyMenor)) { 
                processMatch(tsdRow, [], 'Ajuste Menor');
            } else {
                finalTSD.push(tsdRow);
            }
        });
        pendientesTSD = finalTSD;

        let finalBancos = [];
        bancosDisponibles.forEach(bRow => {
            const montoBanco = parseFloat(bRow.Monto_Venta_Original) || 0;
            const keyMenor = String(bRow.IdTransaccion).trim() + '|MENOR';
            if (Math.abs(montoBanco) > 0 && Math.abs(montoBanco) < 10000 && !this.blacklist.includes(keyMenor)) { 
                processMatch([], bRow, 'Ajuste Menor');
            } else {
                finalBancos.push(bRow);
            }
        });
        bancosDisponibles = finalBancos;

        // --- FASE FINAL: RESCATE DE HUÉRFANOS ---
        blindajeTSD.forEach(tsdRow => {
            if (!procesadosTSDIds.includes(tsdRow._id)) {
                const montoTSD = parseFloat(tsdRow.MontoCRC) || 0;
                const tSegura = getCard(tsdRow.Tarjeta_Ultimos4);
                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                    _tsdRaw: tsdRow, _bancoRaw: null, _rowClass: '', _isMulti: false,
                    Contrato: tsdRow.Contrato, Cliente: tsdRow.Cliente, // Cliente vuelve a ser texto puro
                    TarjetaTSD: tSegura ? `****${tSegura}` : 'S/D',
                    Autorizacion: tsdRow.Autorizacion, 
                    MontoTSD: { 
                        valor: montoTSD, 
                        recibo: tsdRow.Recibo_Detalle || '',
                        valueOf: function() { return this.valor; },
                        toString: function() { return this.valor.toString(); }
                    },
                    EstadoMatch: 'Pendiente', Banco_Nombre: '-', Banco_Auth: '-', Banco_Monto: 0, Diferencia: montoTSD
                });
            }
        });

        blindajeBancos.forEach(b => {
            if (!procesadosBancosIds.includes(b._id)) {
                const m = parseFloat(b.Monto_Venta_Original);
                gridData.push({
                    _uid: 'row_' + Math.random().toString(36).substr(2, 9),
                    _tsdRaw: null, _bancoRaw: b, _isMulti: false,
                    _rowClass: 'text-slate-500 italic border-b border-slate-100 dark:border-slate-800',
                    Contrato: 'Solo Banco', Cliente: b.Nombre_Sucursal_Comercio,
                    TarjetaTSD: b.Tarjeta_Ultimos4 ? `****${b.Tarjeta_Ultimos4}` : 'S/D',
                    Autorizacion: '-', MontoTSD: 0, // A los bancos no les inyectamos recibo
                    EstadoMatch: 'Sobrante', Banco_Nombre: b.Banco, Banco_Auth: b.Numero_Autorizacion, Banco_Monto: m, Diferencia: 0 - m
                });
            }
        });

        // --- ORDENAMIENTO ESTÉTICO ---
        gridData.sort((a, b) => {
            const getWeight = (row) => {
                if (String(row.EstadoMatch).startsWith('Manual')) return 0; // Manuales SIEMPRE arriba
                const isNegative = row.MontoTSD < 0 || row.Banco_Monto < 0;
                if (isNegative && row.EstadoMatch !== 'Pendiente' && row.EstadoMatch !== 'Sobrante') return 6; 
                if (row.EstadoMatch.includes('Auth')) return 1;
                if (row.EstadoMatch.includes('Tarjeta')) return 3;
                if (row.EstadoMatch.includes('Sugerencia')) return 5;
                return 7;
            };
            const weightA = getWeight(a), weightB = getWeight(b);
            if (weightA !== weightB) return weightA - weightB;
            return String(a.Contrato).localeCompare(String(b.Contrato));
        });

        // --- ACTUALIZAR CONTADORES DE SIMBOLOGÍA Y MICRO-CHART ---
        let cAuth = 0, cTarjeta = 0, cSug = 0, cMan = 0, cNoC = 0, cInt = 0, cMen = 0;
        
        gridData.forEach(r => {
            const status = String(r.EstadoMatch);
            if (status.startsWith('Manual')) { cMan++; }
            else if (status === 'Pendiente' || status === 'Sobrante') { cNoC++; }
            else if (status.includes('Ajuste Interno')) { cInt++; }
            else if (status.includes('Ajuste Menor')) { cMen++; }
            else if (status.includes('Auth')) { cAuth++; }
            else if (status.includes('Tarjeta')) { cTarjeta++; }
            else if (status.includes('Sugerencia')) { cSug++; }
        });

        const total = gridData.length || 1; // Prevenir división por cero

        document.getElementById('count-auth').innerText = cAuth;
        document.getElementById('count-tarjeta').innerText = cTarjeta;
        document.getElementById('count-sugerencia').innerText = cSug;
        document.getElementById('count-manual').innerText = cMan;
        document.getElementById('count-noc').innerText = cNoC;
        const elCountInt = document.getElementById('count-int');
        if (elCountInt) elCountInt.innerText = cInt;
        const elCountMen = document.getElementById('count-men');
        if (elCountMen) elCountMen.innerText = cMen;

        // Calcular Porcentajes
        const pAuth = ((cAuth / total) * 100).toFixed(1);
        const pTarj = ((cTarjeta / total) * 100).toFixed(1);
        const pMan = ((cMan / total) * 100).toFixed(1);
        const pSug = ((cSug / total) * 100).toFixed(1);
        const pNoC = ((cNoC / total) * 100).toFixed(1);
        const pInt = ((cInt / total) * 100).toFixed(1);
        const pMen = ((cMen / total) * 100).toFixed(1);

        // Actualizar Anchos del Gráfico
        document.getElementById('bar-auth').style.width = `${pAuth}%`;
        document.getElementById('bar-tarj').style.width = `${pTarj}%`;
        document.getElementById('bar-man').style.width = `${pMan}%`;
        document.getElementById('bar-sug').style.width = `${pSug}%`;
        document.getElementById('bar-noc').style.width = `${pNoC}%`;
        const elBarInt = document.getElementById('bar-int');
        if (elBarInt) elBarInt.style.width = `${pInt}%`;
        const elBarMen = document.getElementById('bar-men');
        if (elBarMen) elBarMen.style.width = `${pMen}%`;

        // Actualizar Tooltips
        document.getElementById('tt-auth').innerText = `Auth: ${pAuth}%`;
        document.getElementById('tt-tarj').innerText = `Tarjeta: ${pTarj}%`;
        document.getElementById('tt-man').innerText = `Manual: ${pMan}%`;
        document.getElementById('tt-sug').innerText = `Sugerencia: ${pSug}%`;
        document.getElementById('tt-noc').innerText = `No Concil: ${pNoC}%`;
        const elTtInt = document.getElementById('tt-int');
        if (elTtInt) elTtInt.innerText = `Interno: ${pInt}%`;
        const elTtMen = document.getElementById('tt-men');
        if (elTtMen) elTtMen.innerText = `Menor: ${pMen}%`;

        // Ocultar Tooltips de valores en 0% para no amontonar
        document.getElementById('tt-auth').style.display = cAuth > 0 ? 'block' : 'none';
        document.getElementById('tt-tarj').style.display = cTarjeta > 0 ? 'block' : 'none';
        document.getElementById('tt-man').style.display = cMan > 0 ? 'block' : 'none';
        document.getElementById('tt-sug').style.display = cSug > 0 ? 'block' : 'none';
        document.getElementById('tt-noc').style.display = cNoC > 0 ? 'block' : 'none';
        if (elTtInt) elTtInt.style.display = cInt > 0 ? 'block' : 'none';
        if (elTtMen) elTtMen.style.display = cMen > 0 ? 'block' : 'none';

        this.currentGridData = gridData;
        this.renderGrid(gridData);
    },


    renderGrid: function(data) {
        // Regla de Negocio: Las "Sugerencias" se consideran Excepciones hasta que un humano las valide manualmente
        const matchedData = data.filter(r => 
            r.EstadoMatch !== 'Pendiente' && 
            r.EstadoMatch !== 'Sobrante' && 
            r.EstadoMatch !== 'Sugerencia (Monto)'
        );
        
        const pendingData = data.filter(r => 
            r.EstadoMatch === 'Pendiente' || 
            r.EstadoMatch === 'Sobrante' || 
            r.EstadoMatch === 'Sugerencia (Monto)'
        );

        // Guardamos las matrices en la RAM global para el empaquetador del botón "Guardar"
        this.currentMatchedData = matchedData;
        this.currentPendingData = pendingData;
        
        const fmtMoney = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v || 0).replace(/\./g, ' ');

        const renderMulti = (row, isTsdSide, field) => {
            const raw = isTsdSide ? row._tsdRaw : row._bancoRaw;
            if (!raw || (Array.isArray(raw) && raw.length === 0)) return '<span class="text-slate-300 dark:text-slate-600">-</span>';
            const arr = Array.isArray(raw) ? raw : [raw];
            return '<div class="flex flex-col h-full w-full">' + arr.map(t => {
                let val = '';
                if (field === 'Contrato') val = t.Contrato || 'S/D';
                else if (field === 'Cliente') val = `<div class="truncate" title="${t.Cliente || 'S/D'}">${t.Cliente || 'S/D'}</div>`;
                else if (field === 'TarjetaTSD') val = t.Tarjeta_Ultimos4 ? `****${t.Tarjeta_Ultimos4.slice(-4)}` : 'S/D';
                else if (field === 'Autorizacion') val = t.Autorizacion || '-';
                else if (field === 'MontoTSD') val = `<div class="flex flex-col items-end w-full"><span class="font-bold text-slate-800 dark:text-slate-200">${fmtMoney(parseFloat(t.MontoCRC) || 0)}</span>${t.Recibo_Detalle ? `<div class="text-[9px] text-orange-600 truncate mt-0.5 w-full text-right" title="${t.Recibo_Detalle}">${t.Recibo_Detalle}</div>` : ''}</div>`;
                else if (field === 'Banco_Nombre') val = t.Banco || '-';
                else if (field === 'Banco_Auth') val = t.Numero_Autorizacion || '-';
                else if (field === 'Banco_Monto') val = `<div class="w-full text-right">${fmtMoney(parseFloat(t.Monto_Venta_Original) || 0)}</div>`;
                
                return `<div class="flex-1 flex flex-col justify-center border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 py-1.5 min-h-[36px]">${val}</div>`;
            }).join('') + '</div>';
        };

        const columns = [
            { 
                title: "Contrato (TSD)", field: "Contrato", width: 140, headerFilter: true, 
                cssClass: "font-mono font-bold",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, true, 'Contrato');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Cliente", field: "Cliente", headerFilter: true, width: 160, cssClass: "text-[10px]",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, true, 'Cliente');
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    return `<div class="truncate" title="${val}">${val}</div>`;
                }
            },
            { 
                title: "Tarjeta", field: "TarjetaTSD", width: 80, cssClass: "font-mono text-slate-500", hozAlign: "center",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, true, 'TarjetaTSD');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Auth (TSD)", field: "Autorizacion", headerFilter: true, width: 90, cssClass: "font-mono", hozAlign: "center",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, true, 'Autorizacion');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Monto TSD / Detalle", field: "MontoTSD", headerFilter: true, width: 150, hozAlign: "right", bottomCalc: "sum", 
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-800 dark:text-white">${fmtMoney(val)}</span>`,
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, true, 'MontoTSD');
                    
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    const valor = typeof val === 'object' && val !== null && 'valor' in val ? val.valor : val;
                    const recibo = typeof val === 'object' && val !== null && 'recibo' in val ? val.recibo : '';
                    
                    const recHtml = recibo ? `<div class="text-[9px] text-orange-600 dark:text-orange-400 italic truncate font-medium mt-0.5" title="${recibo}">${recibo}</div>` : '';
                    return `<div class="flex flex-col justify-center items-end h-full"><span class="font-bold text-slate-800 dark:text-slate-200">${fmtMoney(valor)}</span>${recHtml}</div>`;
                },
                headerFilterFunc: (term, val) => {
                    const strVal = typeof val === 'object' && val !== null ? `${val.valor} ${val.recibo}` : String(val);
                    return String(strVal).toLowerCase().includes(String(term).toLowerCase());
                }
            },
            
            { 
                title: "STATUS CRUCE", field: "EstadoMatch", headerFilter: true, width: 160, hozAlign: "center",
                cssClass: "border-l-2 border-r-2 border-slate-300 dark:border-slate-600 bg-white/30 dark:bg-black/20 font-bold shadow-inner cursor-pointer",
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    if(String(val).startsWith('Manual')) {
                        const parts = val.split('|');
                        const justHtml = parts[1] ? `<div class="text-[9px] text-amber-700 dark:text-amber-400 font-normal mt-0.5 truncate max-w-[130px] mx-auto italic" title="${parts[1]}">"${parts[1]}"</div>` : '';
                        return `<div class="flex flex-col items-center"><span class="text-amber-900 dark:text-amber-100 uppercase tracking-widest text-[10px]">🛠️ Manual</span>${justHtml}</div>`;
                    }
                    if(val === 'Auth + Monto') return '✔️ Auth+Monto';
                    if(val === 'Auth Grupal + Monto' || val === 'Auth Grupal Solo') return '<span class="text-blue-600 dark:text-blue-400">🔗 Auth Grupal</span>';
                    if(val === 'Auth Solo') return '✔️ Auth Solo';
                    if(val === 'Tarjeta + Monto') return '💳 Tarjeta+Monto';
                    if(val === 'Tarjeta Grupal + Monto' || val === 'Tarjeta Grupal Solo') return '<span class="text-blue-600 dark:text-blue-400">🔗 Tarjeta Grupal</span>';
                    if(val === 'Tarjeta Solo') return '💳 Tarjeta Solo';
                    if(val.includes('Ajuste Menor')) return `<span class="text-purple-600 dark:text-purple-400">✂️ ${val.replace('Sugerencia: ','')}</span>`;
                    if(val === 'Ajuste Interno TSD' || val === 'Ajuste Interno Banco') return `<span class="text-cyan-600 dark:text-cyan-400">🔄 ${val.replace('Ajuste Interno ', 'Ajuste ')}</span>`;
                    if(val === 'Sugerencia (Monto)') return '<span class="text-amber-600 dark:text-amber-400">⚠️ Sugerencia</span>';
                    if(val === 'Pendiente' || val === 'Sobrante') return '<span class="text-red-500">❌ ' + val + '</span>';
                    return val;
                }
            },
            
            { 
                title: "Banco", field: "Banco_Nombre", width: 100, hozAlign: "center", headerFilter: true, cssClass: "text-blue-700 dark:text-blue-400 font-bold",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, false, 'Banco_Nombre');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Auth (Banco)", field: "Banco_Auth", headerFilter: true, width: 100, cssClass: "font-mono", hozAlign: "center",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, false, 'Banco_Auth');
                    return typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                }
            },
            { 
                title: "Monto", field: "Banco_Monto", hozAlign: "right", bottomCalc: "sum", 
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-800 dark:text-white">${fmtMoney(val)}</span>`, cssClass: "font-bold",
                formatter: (cell) => {
                    const row = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    if (row._isMulti) return renderMulti(row, false, 'Banco_Monto');
                    return fmtMoney(typeof cell === 'object' && cell.getValue ? cell.getValue() : cell);
                }
            },
            { 
                title: "Diferencia", field: "Diferencia", hozAlign: "right", bottomCalc: "sum", 
                bottomCalcFormatter: (val) => `<span class="font-black text-[13px] text-slate-800 dark:text-white">${fmtMoney(val)}</span>`,
                formatter: (cell) => {
                    const val = typeof cell === 'object' && cell.getValue ? cell.getValue() : cell;
                    
                    // Extraer la fila actual para saber si es un éxito o una excepción
                    const rowData = typeof cell === 'object' && cell.getData ? cell.getData() : cell;
                    const isException = rowData.EstadoMatch === 'Pendiente' || rowData.EstadoMatch === 'Sobrante' || rowData.EstadoMatch === 'Sugerencia (Monto)';

                    // Si es una excepción (tabla inferior), devolverlo neutro sin analizar el umbral
                    if (isException) {
                        return `<span class="font-bold bg-white/40 dark:bg-black/30 px-2 py-0.5 rounded text-sm">${fmtMoney(val)}</span>`;
                    }

                    // Lógica original de la alerta de diferencia (solo para Match Exitosos)
                    const thresholdInput = document.getElementById('tsd-threshold');
                    const threshold = thresholdInput ? Math.abs(parseFloat(thresholdInput.value)) || 0 : 10000;
                    
                    if (Math.abs(val) >= threshold) {
                        return `<span class="text-red-700 dark:text-red-300 font-black bg-red-100 dark:bg-red-900/50 px-2 py-0.5 rounded shadow-sm border border-red-200 dark:border-red-800 text-sm">${fmtMoney(val)}</span>`;
                    }
                    return `<span class="font-bold bg-white/40 dark:bg-black/30 px-2 py-0.5 rounded text-sm">${fmtMoney(val)}</span>`;
                }
            }
        ];

        if (this.gridMatched) this.gridMatched.updateData(matchedData);
        else this.gridMatched = new VanillaGrid("#table-matched-tsd", matchedData, columns, { searchInputId: "search-tsd", threshold: 0, onRowDblClick: (row) => window.TSDLogic.openTransactionModal(row) });

        if (this.gridPending) this.gridPending.updateData(pendingData);
        else this.gridPending = new VanillaGrid("#table-pending-tsd", pendingData, columns, { searchInputId: "search-tsd", threshold: 0, onRowDblClick: (row) => window.TSDLogic.openTransactionModal(row) });
    },

    openTransactionModal: function(row) {
        if (!row) return;

        // 1. Preparar el Estado en el Workspace (Padre)
        const tRaw = row._tsdRaw ? (Array.isArray(row._tsdRaw) ? [...row._tsdRaw] : [row._tsdRaw]) : [];
        const bRaw = row._bancoRaw ? (Array.isArray(row._bancoRaw) ? [...row._bancoRaw] : [row._bancoRaw]) : [];
        
        // Recuperar justificación desde el string particionado (ej: "Manual|Mi Justificación")
        let justTexto = '';
        if (String(row.EstadoMatch).startsWith('Manual|')) {
            justTexto = row.EstadoMatch.split('|')[1] || '';
        }
        
        this.ws = {
            tsd: [...tRaw], bancos: [...bRaw],
            originalTsd: [...tRaw], originalBancos: [...bRaw],
            rowUid: row._uid,
            justificacion: justTexto,
            isAutoMatch: row.EstadoMatch !== 'Pendiente' && row.EstadoMatch !== 'Sobrante' && !String(row.EstadoMatch).startsWith('Manual')
        };

        // 2. Preparar los CSS de Tailwind (Usamos el script de CDN para el popup hijo)
        const isDark = document.documentElement.classList.contains('dark');
        
        // 3. Crear la Ventana Hija (PopUp Nativo del SO)
        const width = 1100;
        const height = 750;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        // Si ya hay una abierta, la cerramos
        if (this.wsWindow && !this.wsWindow.closed) this.wsWindow.close();
        
        this.wsWindow = window.open('', 'TSDEstacionManual', `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`);
        
        // 4. Inyectar el Documento (HTML + Lógica Hija)
        const html = `
        <!DOCTYPE html>
        <html lang="es" class="${isDark ? 'dark' : ''}">
        <head>
            <meta charset="UTF-8">
            <title>Estación de Trabajo Manual - TSD</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <script>tailwind.config = { darkMode: 'class' };</script>
            <style>
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
                .dark ::-webkit-scrollbar-thumb { background-color: #475569; }
            </style>
        </head>
        <body class="bg-slate-100 dark:bg-slate-900 h-screen w-screen flex flex-col font-sans overflow-hidden">
            
            <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex justify-between items-center shrink-0 shadow-sm">
                <h2 class="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <span class="p-1.5 bg-amber-100 text-amber-700 rounded-lg">🛠️</span> Estación Manual
                </h2>
                <div class="flex items-center gap-6">
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Diferencia Neta</span>
                        <span id="ws-diff" class="text-2xl font-mono font-black">0.00</span>
                    </div>
                    <button onclick="saveAndClose()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-all text-sm flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                        Guardar Cambios
                    </button>
                </div>
            </header>

            <main class="flex-1 flex gap-4 p-4 overflow-hidden h-full">
                <!-- PANEL IZQUIERDO: TSD -->
                <div class="flex-1 flex flex-col gap-2 overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 flex justify-between items-center shrink-0">
                        <h3 class="font-black text-purple-700 dark:text-purple-400 text-xs tracking-wider">VINCULADOS A TSD</h3>
                        <span class="text-[10px] font-bold text-slate-400" id="ws-count-tsd">0</span>
                    </div>
                    <div class="h-[40%] overflow-auto p-2 space-y-1.5" id="ws-sel-tsd"></div>
                    <div class="bg-purple-50 dark:bg-purple-900/20 border-y border-purple-200 dark:border-purple-800 p-1.5 shrink-0 relative">
                        <input type="text" id="ws-search-tsd" oninput="renderUI()" placeholder="Buscar sobrantes en TSD (Contrato, Auth, Tarjeta, Monto)..." class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-800 dark:text-slate-200">
                        <span class="absolute left-3 top-2.5 text-purple-400 text-sm">🔍</span>
                    </div>
                    <div class="flex-1 overflow-auto p-2 bg-slate-50/50 dark:bg-slate-900/30" id="ws-sug-tsd"></div>
                </div>
                
                <!-- PANEL DERECHO: BANCOS -->
                <div class="flex-1 flex flex-col gap-2 overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700">
                    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 flex justify-between items-center shrink-0">
                        <h3 class="font-black text-blue-700 dark:text-blue-400 text-xs tracking-wider">VINCULADOS A BANCOS</h3>
                        <span class="text-[10px] font-bold text-slate-400" id="ws-count-bancos">0</span>
                    </div>
                    <div class="h-[40%] overflow-auto p-2 space-y-1.5" id="ws-sel-bancos"></div>
                    <div class="bg-blue-50 dark:bg-blue-900/20 border-y border-blue-200 dark:border-blue-800 p-1.5 shrink-0 relative">
                        <input type="text" id="ws-search-banco" oninput="renderUI()" placeholder="Buscar sobrantes en Banco (Auth, Tarjeta, Monto)..." class="w-full pl-8 pr-2 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800 dark:text-slate-200">
                        <span class="absolute left-3 top-2.5 text-blue-400 text-sm">🔍</span>
                    </div>
                    <div class="flex-1 overflow-auto p-2 bg-slate-50/50 dark:bg-slate-900/30" id="ws-sug-bancos"></div>
                </div>
            </main>

            <!-- FOOTER: Justificación Opcional -->
            <footer id="ws-footer" class="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 shrink-0 hidden">
                <div class="flex flex-col max-w-4xl mx-auto">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Justificación del Ajuste (Opcional)</span>
                    <input type="text" id="ws-just" placeholder="Escriba aquí el motivo del cruce manual o diferencia..." class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 dark:text-slate-200 transition-shadow">
                </div>
            </footer>

            <!-- MODAL NATIVO DEL POPUP PARA AJUSTE MENOR -->
            <div id="ws-mini-modal" class="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 opacity-0 transition-opacity duration-300">
                <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col" id="ws-mini-card">
                    <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <h3 class="text-lg font-bold text-amber-600 dark:text-amber-400">⚠️ Ajuste Menor Detectado</h3>
                    </div>
                    <div class="px-6 py-5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        Ha dejado una única transacción menor a ₡10,000.
                        
                        ¿Desea guardarla como 'Ajuste Menor' (se marcará como conciliada sola) o prefiere cancelar y dejarla pendiente?
                    </div>
                    <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                        <button onclick="closeMiniModal()" class="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-colors">Cancelar</button>
                        <button onclick="confirmMiniModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors">Confirmar Ajuste</button>
                    </div>
                </div>
            </div>

            <script>
                const parentLogic = window.opener.TSDLogic;
                
                function openMiniModal() {
                    const overlay = document.getElementById('ws-mini-modal');
                    const card = document.getElementById('ws-mini-card');
                    overlay.classList.remove('hidden');
                    requestAnimationFrame(() => {
                        overlay.classList.remove('opacity-0');
                        card.classList.remove('scale-95');
                    });
                }
                
                function closeMiniModal() {
                    const overlay = document.getElementById('ws-mini-modal');
                    const card = document.getElementById('ws-mini-card');
                    overlay.classList.add('opacity-0');
                    card.classList.add('scale-95');
                    setTimeout(() => overlay.classList.add('hidden'), 300);
                }

                async function confirmMiniModal() {
                    closeMiniModal();
                    const justInput = document.getElementById('ws-just');
                    let justificacion = justInput ? justInput.value.trim() : '';
                    justificacion = justificacion ? justificacion : 'Aprobación Manual (Ajuste Menor)';
                    
                    const proceed = await parentLogic.wsSave(justificacion, true);
                    if (proceed !== false) window.close();
                }
                const fmt = (v) => new Intl.NumberFormat('es-CR', {style:'currency', currency:'CRC'}).format(v).replace(/\\./g, ' ');
                const clean = (s) => String(s||'').toLowerCase().trim();

                const allPendientesT = parentLogic.currentGridData.filter(r => r.EstadoMatch === 'Pendiente').flatMap(r => Array.isArray(r._tsdRaw) ? r._tsdRaw : [r._tsdRaw]);
                const allPendientesB = parentLogic.currentGridData.filter(r => r.EstadoMatch === 'Sobrante').flatMap(r => Array.isArray(r._bancoRaw) ? r._bancoRaw : [r._bancoRaw]);

                // --- GENERADOR DE TARJETAS TSD (Con Acordeón y Recibo) ---
                function buildTsdCard(t, isSelected) {
                    const actionBtn = isSelected 
                        ? \`<button onclick="parentLogic.wsRemove('tsd', '\${t._id}'); renderUI();" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-0.5 rounded font-black text-lg transition-colors" title="Quitar">&times;</button>\`
                        : \`<button onclick="event.stopPropagation(); parentLogic.wsAdd('tsd', '\${t._id}'); renderUI();" class="bg-purple-100 text-purple-700 rounded px-2 font-bold shadow-sm text-sm hover:bg-purple-200 transition-colors" title="Añadir">+</button>\`;
                        
                    const wrapperClass = isSelected 
                        ? "flex flex-col p-2 bg-white dark:bg-slate-700 border-l-4 border-purple-500 border-y border-r border-slate-200 dark:border-slate-600 rounded-lg shadow-sm" 
                        : "flex flex-col p-2 border-b border-slate-200 dark:border-slate-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer";

                    return \`
                    <div class="\${wrapperClass}">
                        <div class="flex justify-between items-start" \${!isSelected ? \`onclick="parentLogic.wsAdd('tsd', '\${t._id}'); renderUI();"\` : ''}>
                            <div class="flex flex-col w-full pr-2">
                                <span class="font-bold text-[11px] font-mono text-slate-800 dark:text-white">\${t.Contrato}</span>
                                <span class="text-[10px] text-slate-600 dark:text-slate-300 truncate" title="\${t.Cliente}">\${t.Cliente}</span>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <span class="font-mono font-bold text-sm \${t.MontoCRC < 0 ? 'text-red-500':'text-slate-800 dark:text-white'}">\${fmt(t.MontoCRC)}</span>
                                \${actionBtn}
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1.5" \${!isSelected ? \`onclick="parentLogic.wsAdd('tsd', '\${t._id}'); renderUI();"\` : ''}>
                            <span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-mono">Auth: <b class="text-slate-800 dark:text-white">\${t.Autorizacion||'-'}</b></span>
                            <span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-mono">Tarj: ****\${t.Tarjeta_Ultimos4||'S/D'}</span>
                        </div>
                        
                        <!-- ACORDEÓN TSD -->
                        <details class="mt-1.5 group">
                            <summary class="text-[9px] text-purple-600 dark:text-purple-400 cursor-pointer hover:underline list-none font-medium flex items-center gap-1 select-none [&::-webkit-details-marker]:hidden">
                                <svg class="w-3 h-3 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg> 
                                Más información TSD
                            </summary>
                            <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                                <div class="col-span-2 text-slate-600 dark:text-slate-300"><b>Recibo/Detalle:</b> \${t.Recibo_Detalle || '<i>Sin descripción</i>'}</div>
                                <div><b>Fecha Pago:</b> \${t.Fecha || '-'}</div>
                                <div><b>Tipo Tarjeta:</b> \${t.Tipo_Tarjeta || '-'}</div>
                                <div><b>Tipo Cobro:</b> \${t.Tipo || '-'}</div>
                                <div><b>ICD:</b> \${t.ICD || '-'}</div>
                                <div><b>Sucursal:</b> \${t.Sucursal || '-'} (\${t.SucursalCod || '-'})</div>
                                <div class="col-span-2 truncate" title="\${t.RecibidoPor}"><b>Agente:</b> \${t.RecibidoPor || '-'}</div>
                                <div class="col-span-2 border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
                                    <b class="text-green-600 dark:text-green-400">Monto Origen USD:</b> $\${t.MontoUSD || 0} <span class="text-slate-400 ml-2">(T.C. Aplicado: ₡\${t.TC || 1})</span>
                                </div>
                            </div>
                        </details>
                    </div>\`;
                }

                // --- GENERADOR DE TARJETAS BANCOS (Con Acordeón) ---
                function buildBancoCard(b, isSelected) {
                    const actionBtn = isSelected 
                        ? \`<button onclick="parentLogic.wsRemove('bancos', '\${b._id}'); renderUI();" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-2 py-0.5 rounded font-black text-lg transition-colors" title="Quitar">&times;</button>\`
                        : \`<button onclick="event.stopPropagation(); parentLogic.wsAdd('bancos', '\${b._id}'); renderUI();" class="bg-blue-100 text-blue-700 rounded px-2 font-bold shadow-sm text-sm hover:bg-blue-200 transition-colors" title="Añadir">+</button>\`;
                        
                    const wrapperClass = isSelected 
                        ? "flex flex-col p-2 bg-white dark:bg-slate-700 border-l-4 border-blue-500 border-y border-r border-slate-200 dark:border-slate-600 rounded-lg shadow-sm" 
                        : "flex flex-col p-2 border-b border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer";

                    return \`
                    <div class="\${wrapperClass}">
                        <div class="flex justify-between items-start" \${!isSelected ? \`onclick="parentLogic.wsAdd('bancos', '\${b._id}'); renderUI();"\` : ''}>
                            <div class="flex flex-col w-full pr-2">
                                <span class="font-bold text-[11px] text-blue-600 dark:text-blue-400 font-mono">\${b.Banco}</span>
                                <span class="text-[10px] text-slate-600 dark:text-slate-300 truncate" title="\${b.Nombre_Sucursal_Comercio}">\${b.Nombre_Sucursal_Comercio || '-'}</span>
                            </div>
                            <div class="flex items-center gap-2 shrink-0">
                                <span class="font-mono font-bold text-sm \${b.Monto_Venta_Original < 0 ? 'text-red-500':'text-slate-800 dark:text-white'}">\${fmt(b.Monto_Venta_Original)}</span>
                                \${actionBtn}
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1.5" \${!isSelected ? \`onclick="parentLogic.wsAdd('bancos', '\${b._id}'); renderUI();"\` : ''}>
                            <span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-mono">Auth: <b class="text-slate-800 dark:text-white">\${b.Numero_Autorizacion||'-'}</b></span>
                            <span class="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-mono">Tarj: ****\${b.Tarjeta_Ultimos4||'S/D'}</span>
                        </div>
                        
                        <!-- ACORDEÓN BANCOS -->
                        <details class="mt-1.5 group">
                            <summary class="text-[9px] text-blue-600 dark:text-blue-400 cursor-pointer hover:underline list-none font-medium flex items-center gap-1 select-none [&::-webkit-details-marker]:hidden">
                                <svg class="w-3 h-3 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg> 
                                Más información Banco
                            </summary>
                            <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[9px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                                <div><b>Fecha Pago (Excel):</b> \${b.Fecha_Pago_Excel || '-'}</div>
                                <div><b>Fecha Trans.:</b> \${b.FechaTransaccion || '-'}</div>
                                <div class="col-span-2"><b>Afiliado/MerID:</b> \${b.Afiliado_MerID || '-'}</div>
                                <div class="col-span-2"><b>Terminal:</b> \${b.Codigo_Sucursal_Terminal || '-'}</div>
                            </div>
                        </details>
                    </div>\`;
                }

                function renderUI() {
                    const ws = parentLogic.ws;
                    
                    // Colocar los datos en orden de mayor a menor magnitud
                    const sumT = ws.tsd.map(c => parseFloat(c.MontoCRC) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
                    const sumB = ws.bancos.map(c => parseFloat(c.Monto_Venta_Original) || 0).sort((a,b) => Math.abs(b) - Math.abs(a)).reduce((acc, val) => acc + val, 0);
                    
                    // Diferencia Contable Real: Tomar el mayor, restarle el menor y conservar el signo del mayor
                    const absT = Math.abs(sumT);
                    const absB = Math.abs(sumB);
                    const gap = Math.abs(absT - absB); // Brecha absoluta para buscar sugerencias
                    
                    let diff = 0;
                    if (absT >= absB) {
                        diff = sumT < 0 ? -gap : gap;
                    } else {
                        diff = sumB < 0 ? -gap : gap;
                    }
                    
                    const diffEl = document.getElementById('ws-diff');
                    diffEl.innerText = fmt(diff);
                    diffEl.className = \`text-2xl font-mono font-black \${Math.abs(diff) < 2 ? 'text-green-500' : 'text-red-500'}\`;
                    document.getElementById('ws-count-tsd').innerText = \`\${ws.tsd.length} Registros\`;
                    document.getElementById('ws-count-bancos').innerText = \`\${ws.bancos.length} Registros\`;

                    // 1. DIBUJAR SELECCIONADOS (Usando los constructores con Acordeón)
                    document.getElementById('ws-sel-tsd').innerHTML = ws.tsd.map(t => buildTsdCard(t, true)).join('') || '<div class="text-center text-slate-400 text-xs mt-10 italic">Vacío</div>';
                    document.getElementById('ws-sel-bancos').innerHTML = ws.bancos.map(b => buildBancoCard(b, true)).join('') || '<div class="text-center text-slate-400 text-xs mt-10 italic">Vacío</div>';

                    // 2. DIBUJAR SUGERENCIAS
                    let availableT = allPendientesT.filter(t => !ws.tsd.some(w => w._id === t._id));
                    let availableB = allPendientesB.filter(b => !ws.bancos.some(w => w._id === b._id));

                    const termT = clean(document.getElementById('ws-search-tsd')?.value || '');
                    if (termT) availableT = availableT.filter(t => clean(t.Contrato).includes(termT) || clean(t.Autorizacion).includes(termT) || clean(t.MontoCRC).includes(termT) || clean(t.Tarjeta_Ultimos4).includes(termT));
                    else {
                        const bAuths = ws.bancos.map(b=>b.Numero_Autorizacion).filter(a=>a);
                        const bCards = ws.bancos.map(b=>b.Tarjeta_Ultimos4).filter(c=>c);
                        availableT = availableT.sort((a, b) => {
                            const wA = (bAuths.includes(a.Autorizacion) ? 10 : 0) + (bCards.includes(a.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(a.MontoCRC) - gap) < 2 ? 20 : 0);
                            const wB = (bAuths.includes(b.Autorizacion) ? 10 : 0) + (bCards.includes(b.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(b.MontoCRC) - gap) < 2 ? 20 : 0);
                            return wB - wA; 
                        });
                    }

                    document.getElementById('ws-sug-tsd').innerHTML = availableT.slice(0, 50).map(t => buildTsdCard(t, false)).join('') || '<div class="text-center text-slate-400 text-xs mt-4">Sin sugerencias</div>';

                    const termB = clean(document.getElementById('ws-search-banco')?.value || '');
                    if (termB) availableB = availableB.filter(b => clean(b.Numero_Autorizacion).includes(termB) || clean(b.Tarjeta_Ultimos4).includes(termB) || clean(b.Monto_Venta_Original).includes(termB));
                    else {
                        const tAuths = ws.tsd.map(t=>t.Autorizacion).filter(a=>a);
                        const tCards = ws.tsd.map(t=>t.Tarjeta_Ultimos4).filter(c=>c);
                        availableB = availableB.sort((a, b) => {
                            const wA = (tAuths.includes(a.Numero_Autorizacion) ? 10 : 0) + (tCards.includes(a.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(a.Monto_Venta_Original) - gap) < 2 ? 20 : 0);
                            const wB = (tAuths.includes(b.Numero_Autorizacion) ? 10 : 0) + (tCards.includes(b.Tarjeta_Ultimos4) ? 5 : 0) + (Math.abs(parseFloat(b.Monto_Venta_Original) - gap) < 2 ? 20 : 0);
                            return wB - wA;
                        });
                    }

                    document.getElementById('ws-sug-bancos').innerHTML = availableB.slice(0, 50).map(b => buildBancoCard(b, false)).join('') || '<div class="text-center text-slate-400 text-xs mt-4">Sin sugerencias</div>';

                    // 3. LOGICA DEL FOOTER DE JUSTIFICACIÓN
                    const footer = document.getElementById('ws-footer');
                    if (ws.tsd.length > 0 && ws.bancos.length > 0) {
                        footer.classList.remove('hidden');
                    } else {
                        footer.classList.add('hidden');
                    }
                }

                async function saveAndClose() {
                    const justInput = document.getElementById('ws-just');
                    let justificacion = justInput ? justInput.value.trim() : '';
                    
                    let isAjusteMenor = false;
                    if (parentLogic.ws.tsd.length === 1 && parentLogic.ws.bancos.length === 0 && Math.abs(parseFloat(parentLogic.ws.tsd[0].MontoCRC) || 0) < 10000) {
                        isAjusteMenor = true;
                    } else if (parentLogic.ws.bancos.length === 1 && parentLogic.ws.tsd.length === 0 && Math.abs(parseFloat(parentLogic.ws.bancos[0].Monto_Venta_Original) || 0) < 10000) {
                        isAjusteMenor = true;
                    }

                    if (isAjusteMenor) {
                        openMiniModal();
                        return; // Se interrumpe el flujo; el usuario decidirá en el mini modal
                    }

                    const proceed = await parentLogic.wsSave(justificacion, false);
                    if (proceed !== false) window.close();
                }

                document.addEventListener('DOMContentLoaded', () => {
                    const justInput = document.getElementById('ws-just');
                    if (justInput) {
                        justInput.value = parentLogic.ws.justificacion || '';
                    }
                    renderUI();
                });
            </script>
        </body>
        </html>`;
        
        this.wsWindow.document.write(html);
        this.wsWindow.document.close();
    },

    // Funciones puente llamadas desde la ventana hija
    wsAdd: function(side, id) {
        if (side === 'tsd') {
            const found = this.lastTSD.find(t => t && t._id === id);
            // Cortafuegos: ignora si no existe o si ya está en la estación (previene duplicados por doble clic/bubbling)
            if (found && !this.ws.tsd.some(x => x._id === id)) this.ws.tsd.push(found);
        } else {
            const found = this.lastBancos.find(b => b && b._id === id);
            if (found && !this.ws.bancos.some(x => x._id === id)) this.ws.bancos.push(found);
        }
    },

    wsRemove: function(side, id) {
        if (side === 'tsd') {
            this.ws.tsd = this.ws.tsd.filter(t => t._id !== id);
        } else {
            this.ws.bancos = this.ws.bancos.filter(b => b._id !== id);
        }
    },

    wsSave: async function(justificacion = '', isAjusteMenor = false) {
        const removedTsd = this.ws.originalTsd.filter(t => !this.ws.tsd.some(x => x.ID_Transaccion === t.ID_Transaccion));
        const removedBancos = this.ws.originalBancos.filter(b => !this.ws.bancos.some(x => x.IdTransaccion === b.IdTransaccion));

        // Regla 1: Blindaje contra Auto-Unión Exacta (Blacklist de Cruces Rotos)
        // Registrar rechazo de Ajustes Menores para que la Fase 10 no los vuelva a atrapar
        removedTsd.forEach(t => this.blacklist.push(String(t.ID_Transaccion).trim() + '|MENOR'));
        removedBancos.forEach(b => this.blacklist.push(String(b.IdTransaccion).trim() + '|MENOR'));
        // A. TSD vs Banco
        this.ws.originalTsd.forEach(t => {
            this.ws.originalBancos.forEach(b => {
                const key = String(t.ID_Transaccion).trim() + '|' + String(b.IdTransaccion).trim();
                if (!this.blacklist.includes(key)) this.blacklist.push(key);
            });
        });
        // B. TSD vs TSD (Evitar re-agrupar Ajustes Internos)
        for (let i = 0; i < this.ws.originalTsd.length; i++) {
            for (let j = i + 1; j < this.ws.originalTsd.length; j++) {
                const key = String(this.ws.originalTsd[i].ID_Transaccion).trim() + '|' + String(this.ws.originalTsd[j].ID_Transaccion).trim();
                const reverseKey = String(this.ws.originalTsd[j].ID_Transaccion).trim() + '|' + String(this.ws.originalTsd[i].ID_Transaccion).trim();
                if (!this.blacklist.includes(key)) this.blacklist.push(key);
                if (!this.blacklist.includes(reverseKey)) this.blacklist.push(reverseKey);
            }
        }
        // C. Banco vs Banco (Evitar re-agrupar Ajustes Internos)
        for (let i = 0; i < this.ws.originalBancos.length; i++) {
            for (let j = i + 1; j < this.ws.originalBancos.length; j++) {
                const key = String(this.ws.originalBancos[i].IdTransaccion).trim() + '|' + String(this.ws.originalBancos[j].IdTransaccion).trim();
                const reverseKey = String(this.ws.originalBancos[j].IdTransaccion).trim() + '|' + String(this.ws.originalBancos[i].IdTransaccion).trim();
                if (!this.blacklist.includes(key)) this.blacklist.push(key);
                if (!this.blacklist.includes(reverseKey)) this.blacklist.push(reverseKey);
            }
        }
        
        // Regla 2: Destrucción por Colisión (Limpiar manualMatches viejos)
        const originTsdIds = this.ws.originalTsd.map(t => t.ID_Transaccion);
        const originBancoIds = this.ws.originalBancos.map(b => b.IdTransaccion);
        
        this.manualMatches = this.manualMatches.filter(m => {
            const hasTsdCollision = m.tsdArr.some(t => originTsdIds.includes(t.ID_Transaccion));
            const hasBancoCollision = m.bancoArr.some(b => originBancoIds.includes(b.IdTransaccion));
            return !hasTsdCollision && !hasBancoCollision;
        });

        // REGLA DE ORO ACTUALIZADA: Válido si vincula TSD vs Banco, O si vincula múltiples TSD (Ajuste Interno), O múltiples Bancos
        const validTsdBanco = this.ws.tsd.length > 0 && this.ws.bancos.length > 0;
        const validTsdInterno = this.ws.tsd.length > 1 && this.ws.bancos.length === 0;
        const validBancoInterno = this.ws.bancos.length > 1 && this.ws.tsd.length === 0;
        
        if (isAjusteMenor && !justificacion) {
            justificacion = 'Aprobación Manual (Ajuste Menor)';
        }

        const isValidMatch = validTsdBanco || validTsdInterno || validBancoInterno || isAjusteMenor;

        if (isValidMatch) {
            this.manualMatches.push({ tsdArr: [...this.ws.tsd], bancoArr: [...this.ws.bancos], justificacion: justificacion });
        }

        // Re-ejecutar el algoritmo permitiendo que los liberados busquen nuevas parejas
        this.runMatchingAlgorithm(this.lastTSD, this.lastBancos);

        // Cada modificación confirmada en la Estación Manual queda
        // inmediatamente disponible para cualquier otro usuario.
        try {
            await this.guardarBorradorM3();
        } catch (errorBorrador) {
            console.error(
                'No se pudo guardar el borrador M3:',
                errorBorrador
            );

            await window.SysUI.alert(
                `Los cambios sí se aplicaron en pantalla, pero NO pudieron guardarse como borrador compartido.\n\n${errorBorrador.message}`,
                "Borrador no guardado",
                "warning"
            );
        }

        // --- RASTREO DE NUEVOS MATCHES ---
        const newMatches = [];
        this.currentMatchedData.forEach(row => {
            // Ignorar los matches manuales, solo queremos ver si el sistema automático pescó algo
            if (String(row.EstadoMatch).startsWith('Manual')) return;

            const rowTsdIds = (Array.isArray(row._tsdRaw) ? row._tsdRaw : [row._tsdRaw]).filter(Boolean).map(t => t.ID_Transaccion);
            const rowBancoIds = (Array.isArray(row._bancoRaw) ? row._bancoRaw : [row._bancoRaw]).filter(Boolean).map(b => b.IdTransaccion);

            const hasRemovedTsd = removedTsd.some(rt => rowTsdIds.includes(rt.ID_Transaccion));
            const hasRemovedBanco = removedBancos.some(rb => rowBancoIds.includes(rb.IdTransaccion));

            if (hasRemovedTsd || hasRemovedBanco) {
                newMatches.push(row);
            }
        });

        if (newMatches.length > 0) {
            let msg = "El algoritmo encontró <b>nuevas coincidencias</b> para los datos que acabas de liberar:\n\n";
            newMatches.forEach(nm => {
                const monto = nm.MontoTSD.valor !== undefined ? nm.MontoTSD.valor : nm.MontoTSD;
                msg += `📌 <b>Contrato:</b> ${nm.Contrato} | <b>Banco:</b> ${nm.Banco_Nombre} | <b>Monto:</b> ₡${monto}\n`;
            });
            msg += "\nRevise la tabla superior (Resultados Conciliados) para validarlos.";
            setTimeout(() => window.SysUI.alert(msg, "¡Nuevo Match Automático!", "info"), 500);
        } else if (!isValidMatch) {
            if(window.SysUI) window.SysUI.alert("Datos desvinculados correctamente. Han regresado a la bandeja de pendientes y no se emparejarán automáticamente entre ellos.", "Separados", "warning");
        }
    },

    // --------------------------------------------------------
    // MOTOR DE EMPAQUETADO Y GUARDADO (FASE DE PERSISTENCIA)
    // --------------------------------------------------------
    saveTSDCierre: async function() {
        // CLONACIÓN ABSOLUTA: Congelamos el estado visual exacto para que el algoritmo no toque nada
        const dataMatched = this.currentMatchedData ? JSON.parse(JSON.stringify(this.currentMatchedData)) : [];
        const dataPending = this.currentPendingData ? JSON.parse(JSON.stringify(this.currentPendingData)) : [];

        if (dataMatched.length === 0 && dataPending.length === 0) {
            return window.SysUI.alert("No hay datos para procesar. Ejecute un cruce primero.", "Sin datos", "warning");
        }

        // Validar si hay algo que guardar
        const pendientesTSDCount = dataPending.filter(r => r.EstadoMatch === 'Pendiente' || r.EstadoMatch === 'Sugerencia (Monto)').length;
        const sobrantesBancoCount = dataPending.filter(r => r.EstadoMatch === 'Sobrante').length;

        if (dataMatched.length === 0 && pendientesTSDCount === 0) {
            return window.SysUI.alert("No hay registros TSD nuevos (ni conciliados ni pendientes) para guardar.", "Tabla vacía", "warning");
        }

        const confirmado = await window.SysUI.confirm(
            `¿Desea registrar este Cierre en la Base de Datos?\n\n` + 
            `<b>Resumen de Operación:</b>\n` +
            `✔️ ${dataMatched.length} agrupaciones marcadas como CONCILIADAS.\n` +
            `❌ ${pendientesTSDCount} contratos de TSD marcados como PENDIENTES.\n` +
            `🏦 ${sobrantesBancoCount} transacciones bancarias como SOBRANTES.\n\n` +
            `<i>Nota: Los pendientes de TSD y los sobrantes de Banco quedarán resguardados de forma segura en el Auxiliar Contable para su resolución en un próximo análisis. Se sugiere monitorear el módulo de excepciones periódicamente.</i>\n\n` +
            `Los folios bancarios de esta sesión quedarán sellados de forma permanente.`,
            "Confirmar Cierre Consolidado TSD",
            "info"
        );

        if (!confirmado) return;

        // Fecha CONTABLE de la conciliación: se pregunta al final, cuando el
        // usuario ya confirmó todo lo demás. Sugiere hoy y no admite futuro.
        const fechaConciliacion = await this.pedirFechaConciliacion();
        if (!fechaConciliacion) return;   // canceló

        // --- 1. BLOQUE A: Extraer Folios a Sellar ---
        // Buscamos todos los IdCierre (Folios) únicos de los bancos que están en la memoria RAM
        const foliosSet = new Set();
        this.lastBancos.forEach(b => { if (b.Folio_Cierre) foliosSet.add(b.Folio_Cierre); });
        const foliosArray = Array.from(foliosSet);

        // --- 2. BLOQUE B: Empaquetar Exitosos (Matches) ---
        const payloadMatched = [];
        dataMatched.forEach(row => {
            const arrT = (Array.isArray(row._tsdRaw) ? row._tsdRaw : [row._tsdRaw]).filter(Boolean);
            const arrB = (Array.isArray(row._bancoRaw) ? row._bancoRaw : [row._bancoRaw]).filter(Boolean);
            
            // Extraer justificación si es Manual
            let justif = null;
            const strStatus = String(row.EstadoMatch);
            if (strStatus.startsWith('Manual|')) { justif = strStatus.split('|')[1]; }

            payloadMatched.push({
                IdMatchTSD: 'm_tsd_' + Math.random().toString(36).substr(2, 10), // Matrimonio Único
                TipoCruce: strStatus.split('|')[0], // Limpiamos la justificación del texto principal
                Justificacion: justif,
                TSD: arrT,
                Bancos: arrB.map(b => b.IdTransaccion) // Solo mandamos el ID del banco para hacerle el UPDATE
            });
        });

        // --- 3. BLOQUE C: Empaquetar Excepciones (TSD Huérfanos) ---
        const payloadPending = [];
        dataPending.forEach(row => {
            // Solo nos interesan los huérfanos de TSD. Ignoramos los "Sobrantes" del banco porque esos ya viven en SQL.
            if (row.EstadoMatch === 'Pendiente' || row.EstadoMatch === 'Sugerencia (Monto)') {
                const arrT = Array.isArray(row._tsdRaw) ? row._tsdRaw : [row._tsdRaw];
                arrT.forEach(t => payloadPending.push(t));
            }
        });

        // --- 4. ENVIAR A PHP CON MODAL DE CARGA ESTÁNDAR ---
        const btn = document.getElementById('btn-save-tsd');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Procesando...';
        btn.disabled = true;
        document.body.classList.add('cursor-wait');

        // 4.1 CREACIÓN DINÁMICA DEL MODAL DE CARGA (Con colores de TSD: Púrpura)
        const loaderId = 'global-save-loader';
        let loader = document.getElementById(loaderId);
        if(!loader) {
            loader = document.createElement('div');
            loader.id = loaderId;
            loader.className = 'fixed inset-0 z-[999999] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white transition-opacity duration-300 opacity-0 select-none hidden';
            loader.innerHTML = `
                <div class="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 transform scale-95 transition-transform duration-300" id="loader-card">
                    <div class="relative w-16 h-16 mb-6">
                        <svg id="loader-spinner" class="animate-spin text-purple-500 w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <div class="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono" id="loader-pct">0%</div>
                    </div>
                    <h3 class="text-lg font-bold mb-2 text-white">Guardando Información...</h3>
                    <p class="text-slate-400 text-xs text-center mb-6 h-8" id="loader-text">Preparando paquete de datos...</p>
                    <div class="w-full bg-slate-900 rounded-full h-2 mb-1 overflow-hidden border border-slate-700 shadow-inner">
                        <div class="h-full rounded-full transition-all duration-300 ease-out w-0 bg-purple-500" id="loader-bar"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(loader);
        }

        // 4.2 RESET FORZADO DE ESTILOS Y TEXTOS
        const elBar = document.getElementById('loader-bar');
        const elPct = document.getElementById('loader-pct');
        const elTxt = document.getElementById('loader-text');
        const spinner = document.getElementById('loader-spinner');
        
        elBar.className = "h-full rounded-full transition-all duration-300 ease-out bg-purple-500";
        elBar.style.width = '0%';
        elPct.innerText = '0%';
        elTxt.innerText = "Preparando paquete de datos...";
        elTxt.className = "text-slate-400 text-xs text-center mb-6 h-8";
        spinner.className = "animate-spin text-purple-500 w-full h-full";

        // 4.3 ANIMACIÓN DE ENTRADA SUAVE
        requestAnimationFrame(() => {
            loader.classList.remove('hidden');
            requestAnimationFrame(() => {
                loader.classList.remove('opacity-0');
                document.getElementById('loader-card').classList.remove('scale-95');
            });
        });

        // 4.4 SIMULADOR DE PROGRESO (Avanza hasta el 95%)
        let pct = 0;
        const progressInterval = setInterval(() => {
            if(pct < 95) {
                pct += Math.floor(Math.random() * 10) + 2;
                if(pct > 95) pct = 95; 
                elBar.style.width = pct + '%'; 
                elPct.innerText = pct + '%';
                
                if(pct > 15) elTxt.innerText = "Transfiriendo paquete de datos...";
                if(pct > 35) elTxt.innerText = "Procesando información...";
                if(pct > 60) elTxt.innerText = "Guardando información en la Base de Datos...";
                if(pct > 80) elTxt.innerText = "Verificando integridad de información...";
            }
        }, 300);

        try {
            // 4.5 PETICIÓN REAL AL SERVIDOR
            const res = await fetch('api/save_tsd_m3.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folios: foliosArray,
                    matches: payloadMatched,
                    pendientes: payloadPending,
                    fechaConciliacion: fechaConciliacion,
                    rangoInicio: this._rangoBorradorM3?.start || '',
                    rangoFin: this._rangoBorradorM3?.end || ''
                })
            });
            let data = await res.json();

            // PUERTA DE CC FALTANTES: el servidor pide permiso antes de guardar con CC vacío
            if (data.requiereConfirmacionCC) {
                clearInterval(progressInterval);
                loader.classList.add('opacity-0');
                setTimeout(() => loader.classList.add('hidden'), 300);

                const lista = (data.faltantes || []).map(f => `• [${f.codigo}] ${f.nombre}`).join('\n');
                const seguir = await window.SysUI.confirm(
                    `Las siguientes sucursales NO tienen Centro de Costo asociado:\n\n${lista}\n\n` +
                    `Para solucionarlo debe registrar el Centro de Costo de esas sucursales en TSD (el catálogo de CC proviene de TSD).\n\n` +
                    `¿Desea GUARDAR DE TODAS FORMAS dejando esos Centros de Costo vacíos?`,
                    "Centros de Costo Faltantes"
                );
                if (!seguir) {
                    await window.SysUI.alert("Guardado cancelado. No se realizó ningún cambio en la base de datos.", "Operación Cancelada", "info");
                    return;
                }
                const res2 = await fetch('api/save_tsd_m3.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        folios: foliosArray,
                        matches: payloadMatched,
                        pendientes: payloadPending,
                        fechaConciliacion: fechaConciliacion,
                        confirmarSinCC: true,
                        rangoInicio: this._rangoBorradorM3?.start || '',
                        rangoFin: this._rangoBorradorM3?.end || ''
                    })
                });
                data = await res2.json();
            }

            if (!data.success) throw new Error(data.error);

            // El backend elimina el borrador después del COMMIT.
            // Este segundo intento sólo actúa como respaldo.
            if (!data.borradorEliminado) {
                try {
                    await this.eliminarBorradorM3();
                } catch (errorBorrador) {
                    console.error(
                        'El cierre quedó guardado, pero no se pudo purgar el borrador M3:',
                        errorBorrador
                    );

                    await window.SysUI.alert(
                        "El consolidado TSD quedó guardado correctamente, pero no fue posible eliminar automáticamente su borrador temporal.",
                        "Advertencia de limpieza",
                        "warning"
                    );
                }
            }

            // 4.6 ÉXITO: COMPLETAR AL 100% Y PINTAR DE VERDE
            clearInterval(progressInterval);
            elBar.style.width = '100%'; 
            elPct.innerText = '100%';
            elBar.classList.replace('bg-purple-500', 'bg-green-500');
            spinner.classList.replace('text-purple-500', 'text-green-500');
            spinner.classList.remove('animate-spin');
            elTxt.innerText = "¡Verificación completa! Guardado exitoso.";
            elTxt.classList.replace('text-slate-400', 'text-green-400');
            
            await new Promise(r => setTimeout(r, 800));

            // 4.7 OCULTAR Y CERRAR
            loader.classList.add('opacity-0');
            setTimeout(() => loader.classList.add('hidden'), 300);

            // Limpieza y alerta final
            const folioMsg = data.folio ? `\n\n📁 Folio del cierre: ${data.folio}` : '';
            await window.SysUI.alert(`Consolidado TSD archivado con éxito. Este folio es su referencia para auditoría y búsquedas futuras.${folioMsg}`, "Bóveda Actualizada", "success");
            
            this.lastTSD = [];
            this.lastBancos = [];
            this.manualMatches = [];
            this.blacklist = [];
            this.currentMatchedData = [];
            this.currentPendingData = [];

            this.stopAutoSaveBorradorM3();

            this._rangoBorradorM3 = null;
            this._ultimoSnapshotBorradorM3 = null;
            if(this.gridMatched) { if (typeof this.gridMatched.destroy === 'function') this.gridMatched.destroy(); this.gridMatched = null; }
            if(this.gridPending) { if (typeof this.gridPending.destroy === 'function') this.gridPending.destroy(); this.gridPending = null; }
            
            const matchedContainer = document.getElementById('table-matched-tsd');
            const pendingContainer = document.getElementById('table-pending-tsd');
            if (matchedContainer) matchedContainer.innerHTML = '<div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 opacity-50 z-0"><span class="text-sm font-medium">Cierre completado. Ejecute un nuevo cruce.</span></div>';
            if (pendingContainer) pendingContainer.innerHTML = '';
            
            this.updateFinancialDashboard([], []);

        } catch (error) {
            // 4.8 ERROR: DETENER Y OCULTAR
            clearInterval(progressInterval);
            loader.classList.add('opacity-0');
            setTimeout(() => loader.classList.add('hidden'), 300);
            
            window.SysUI.alert("Hubo un error al guardar en la Base de Datos:\n\n" + error.message, "Fallo Crítico", "error");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            document.body.classList.remove('cursor-wait');
        }
    }
};