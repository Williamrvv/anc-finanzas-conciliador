(function () {
    'use strict';

    if (!window.AuxiliarLogic || !window.TSDLogic) {
        console.error(
            'No fue posible inicializar el motor de cortes diarios del Auxiliar.'
        );
        return;
    }

    const fechaHoyLocal = () => {
        const ahora = new Date();

        return `${ahora.getFullYear()}-${String(
            ahora.getMonth() + 1
        ).padStart(2, '0')}-${String(
            ahora.getDate()
        ).padStart(2, '0')}`;
    };

    const pedirFechas = function (config) {
        const hoy = fechaHoyLocal();

        const sugerida =
            config.sugerida &&
            config.sugerida <= hoy
                ? config.sugerida
                : hoy;

        const html = `
        <div
            class="space-y-4 text-left whitespace-normal"
            id="${config.prefijo}-form"
        >
            <p class="text-sm text-slate-600 dark:text-slate-300">
                Indique la fecha contable y la fecha del corte diario del Auxiliar.
            </p>

            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Fecha de conciliación *
                </label>

                <input
                    type="date"
                    id="${config.prefijo}-fecha-conciliacion"
                    value="${sugerida}"
                    max="${hoy}"
                    class="w-full p-2.5 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
            </div>

            <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Fecha de registro del auxiliar *
                </label>

                <input
                    type="date"
                    id="${config.prefijo}-fecha-registro"
                    value="${sugerida}"
                    max="${hoy}"
                    class="w-full p-2.5 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
                >

                <p class="text-[10px] text-slate-400 mt-1">
                    Para esa fecha sólo quedará el último auxiliar completo guardado.
                </p>
            </div>

            <p class="text-[11px] text-slate-500 dark:text-slate-400 italic">
                ${config.ayuda}
            </p>

            <div
                id="${config.prefijo}-error"
                class="hidden text-[11px] text-red-600 font-bold"
            ></div>

            <button
                id="${config.prefijo}-ok"
                class="w-full ${config.claseBoton} text-white py-2.5 rounded-lg text-sm font-bold shadow-md transition-colors"
            >
                Confirmar y guardar
            </button>
        </div>`;

        return new Promise((resolve) => {
            window.SysUI._createModal(
                config.titulo,
                html,
                [
                    {
                        text: 'Cancelar',
                        value: false,
                        class: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-5 py-2 rounded-lg font-bold transition-colors'
                    }
                ],
                'info',
                'max-w-md'
            ).then(() => resolve(null));

            const fechaConciliacionEl =
                document.getElementById(
                    `${config.prefijo}-fecha-conciliacion`
                );

            const fechaRegistroEl =
                document.getElementById(
                    `${config.prefijo}-fecha-registro`
                );

            let fechaRegistroModificada = false;

            if (fechaRegistroEl) {
                fechaRegistroEl.addEventListener(
                    'change',
                    () => {
                        fechaRegistroModificada = true;
                    }
                );
            }

            if (fechaConciliacionEl) {
                fechaConciliacionEl.addEventListener(
                    'change',
                    () => {
                        if (
                            !fechaRegistroModificada &&
                            fechaRegistroEl
                        ) {
                            fechaRegistroEl.value =
                                fechaConciliacionEl.value;
                        }
                    }
                );
            }

            const btn = document.getElementById(
                `${config.prefijo}-ok`
            );

            if (btn) {
                btn.addEventListener('click', () => {
                    const fechaConciliacion =
                        fechaConciliacionEl?.value || '';

                    const fechaRegistro =
                        fechaRegistroEl?.value || '';

                    const err =
                        document.getElementById(
                            `${config.prefijo}-error`
                        );

                    if (
                        !fechaConciliacion ||
                        !fechaRegistro
                    ) {
                        err.innerText =
                            'Debe indicar ambas fechas.';

                        err.classList.remove('hidden');
                        return;
                    }

                    if (
                        fechaConciliacion > hoy ||
                        fechaRegistro > hoy
                    ) {
                        err.innerText =
                            'No se permiten fechas futuras.';

                        err.classList.remove('hidden');
                        return;
                    }

                    const form =
                        document.getElementById(
                            `${config.prefijo}-form`
                        );

                    const overlay =
                        form
                            ? form.closest('.fixed')
                            : null;

                    if (overlay) overlay.remove();

                    resolve({
                        fechaConciliacion,
                        fechaRegistro
                    });
                });
            }
        });
    };


    window.AuxiliarLogic.pedirFechasCorteM4 =
        function () {
            return pedirFechas({
                prefijo: 'fc-m4-corte',
                titulo: 'Fechas del Auxiliar',
                sugerida: fechaHoyLocal(),

                ayuda:
                    'Ambas fechas pueden colocarse hacia atrás mientras se cargan períodos históricos, pero no se permiten fechas futuras.',

                claseBoton:
                    'bg-orange-600 hover:bg-orange-700'
            });
        };


    window.TSDLogic.pedirFechasCierreM3 =
        function () {
            return pedirFechas({
                prefijo: 'fc-m3-corte',
                titulo: 'Fechas del Consolidado TSD',

                sugerida:
                    this._rangoBorradorM3?.end ||
                    fechaHoyLocal(),

                ayuda:
                    'Se sugiere el último día del rango consultado. Puede modificar ambas fechas, pero no se permiten fechas futuras.',

                claseBoton:
                    'bg-purple-600 hover:bg-purple-700'
            });
        };


    window.AuxiliarLogic._crearCorteDiarioM4 =
        function () {
            const toArray = (valor) => {
                if (!valor) return [];

                return Array.isArray(valor)
                    ? valor.filter(Boolean)
                    : [valor];
            };

            const toNumber = (valor) => {
                const numero = Number(valor);

                return Number.isFinite(numero)
                    ? Number(numero.toFixed(2))
                    : 0;
            };

            const resolverEtiqueta = (row) => {
                let etiqueta = null;

                if (
                    row._colorEtiq !== null &&
                    row._colorEtiq !== undefined &&
                    row._colorEtiq !== ''
                ) {
                    etiqueta =
                        (this.customTags || []).find(
                            item =>
                                String(item.IdEtiqueta) ===
                                String(row._colorEtiq)
                        ) || null;
                }

                if (
                    !etiqueta &&
                    (
                        Number(row._categoriaId) === 1 ||
                        Number(row._categoriaId) === 2
                    )
                ) {
                    const nombreSistema =
                        Number(row._categoriaId) === 1
                            ? 'Contracargos'
                            : 'Devoluciones';

                    etiqueta =
                        (this.customTags || []).find(
                            item =>
                                Number(item.EsSistema) === 1 &&
                                item.Nombre === nombreSistema
                        ) || null;
                }

                return etiqueta;
            };

            const serializarFila = (
                row,
                seccion,
                ordenVisual
            ) => {
                const tsdArr =
                    toArray(row._tsdRaw);

                const bancoArr =
                    toArray(row._bancoRaw);

                const etiqueta =
                    resolverEtiqueta(row);

                const transacciones = [];
                const idsAgregados = new Set();

                tsdArr.forEach((item, indice) => {
                    const id =
                        item.ID_Transaccion ??
                        item.IdTransaccion;

                    if (
                        id === null ||
                        id === undefined ||
                        String(id).trim() === ''
                    ) {
                        return;
                    }

                    const idTexto =
                        String(id).trim();

                    if (idsAgregados.has(idTexto)) {
                        return;
                    }

                    idsAgregados.add(idTexto);

                    transacciones.push({
                        idTransaccion: idTexto,
                        lado: 'TSD',
                        banco: 'TSD',
                        ordenEnGrupo: indice + 1
                    });
                });

                bancoArr.forEach((item, indice) => {
                    const id =
                        item.IdTransaccion ??
                        item.ID_Transaccion;

                    if (
                        id === null ||
                        id === undefined ||
                        String(id).trim() === ''
                    ) {
                        return;
                    }

                    const idTexto =
                        String(id).trim();

                    if (idsAgregados.has(idTexto)) {
                        return;
                    }

                    idsAgregados.add(idTexto);

                    transacciones.push({
                        idTransaccion: idTexto,
                        lado: 'BANCO',

                        banco: String(
                            item.Banco ||
                            row.Banco_Nombre ||
                            'BANCO'
                        ).trim(),

                        ordenEnGrupo: indice + 1
                    });
                });

                const idEtiquetaOrigen =
                    row._colorEtiq !== null &&
                    row._colorEtiq !== undefined &&
                    row._colorEtiq !== ''
                        ? row._colorEtiq
                        : (
                            etiqueta
                                ? etiqueta.IdEtiqueta
                                : null
                        );

                const idEtiqueta =
                    idEtiquetaOrigen !== null &&
                    idEtiquetaOrigen !== undefined &&
                    idEtiquetaOrigen !== '' &&
                    Number.isFinite(
                        Number(idEtiquetaOrigen)
                    )
                        ? Number(idEtiquetaOrigen)
                        : null;

                const categoriaId =
                    row._categoriaId !== null &&
                    row._categoriaId !== undefined &&
                    row._categoriaId !== '' &&
                    Number.isFinite(
                        Number(row._categoriaId)
                    )
                        ? Number(row._categoriaId)
                        : null;

                return {
                    seccion,
                    ordenVisual,

                    contrato:
                        row.Contrato || '',

                    cliente:
                        row.Cliente || '',

                    authTSD:
                        row.Autorizacion || '',

                    tsdDebito:
                        toNumber(row.TSD_Debito),

                    tsdCredito:
                        toNumber(row.TSD_Credito),

                    estadoAux:
                        row.EstadoMatch || '',

                    banco:
                        row.Banco_Nombre || '',

                    authBanco:
                        row.Banco_Auth || '',

                    bancoDebito:
                        toNumber(row.Banco_Debito),

                    bancoCredito:
                        toNumber(row.Banco_Credito),

                    diferencia:
                        toNumber(row.Diferencia),

                    nota:
                        row._notaEtiq ||
                        row.NotaUsuario ||
                        '',

                    categoriaId,
                    idEtiqueta,

                    nombreEtiqueta:
                        etiqueta
                            ? etiqueta.Nombre
                            : '',

                    colorCSS:
                        etiqueta
                            ? etiqueta.ColorCSS
                            : '',

                    esMultiple:
                        !!row._isMulti,

                    claseVisual:
                        row._rowClass || '',

                    transacciones
                };
            };

            const filas = [];

            (this.currentLimboData || []).forEach(
                (row, indice) => {
                    filas.push(
                        serializarFila(
                            row,
                            'BANDEJA',
                            indice + 1
                        )
                    );
                }
            );

            (this.currentSugData || []).forEach(
                (row, indice) => {
                    filas.push(
                        serializarFila(
                            row,
                            'APROBADA_MANUAL',
                            indice + 1
                        )
                    );
                }
            );

            return { filas };
        };


    window.AuxiliarLogic._enviarCorteDiarioM4 =
        async function (
            fechaRegistro,
            origenCaptura,
            corteAuxiliar
        ) {
            const res = await fetch(
                'api/save_corte_auxiliar_m4.php',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    cache: 'no-store',

                    body: JSON.stringify({
                        fechaRegistro,
                        origenCaptura,
                        corteAuxiliar
                    })
                }
            );

            const raw = await res.text();
            let data;

            try {
                data = JSON.parse(raw);
            } catch (error) {
                const preview = raw
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 180);

                throw new Error(
                    `El endpoint del corte diario devolvió una respuesta no JSON (HTTP ${res.status}).` +
                    (
                        preview
                            ? ` Respuesta: ${preview}`
                            : ''
                    )
                );
            }

            if (!res.ok || !data.success) {
                throw new Error(
                    data.error ||
                    `Error HTTP ${res.status} al guardar el corte diario del Auxiliar.`
                );
            }

            return data;
        };


    window.AuxiliarLogic.guardarCorteDiarioActualM4 =
        async function (
            fechaRegistro,
            origenCaptura = 'M4'
        ) {
            return this._enviarCorteDiarioM4(
                fechaRegistro,
                origenCaptura,
                this._crearCorteDiarioM4()
            );
        };


    window.AuxiliarLogic.generarYGuardarCorteDiarioM4 =
        async function (
            fechaRegistro,
            origenCaptura = 'M3'
        ) {
            const [
                resPendientes,
                resEtiquetas
            ] = await Promise.all([
                fetch(
                    'api/get_pendientes_m4.php',
                    { cache: 'no-store' }
                ),

                fetch(
                    'api/mantenimiento_etiquetas_m4.php',
                    { cache: 'no-store' }
                )
            ]);

            const pendientes =
                await resPendientes.json();

            const etiquetas =
                await resEtiquetas.json();

            if (!pendientes.success) {
                throw new Error(
                    pendientes.error ||
                    'No fue posible reconstruir los pendientes del Auxiliar.'
                );
            }

            if (!etiquetas.success) {
                throw new Error(
                    etiquetas.error ||
                    'No fue posible cargar las etiquetas del Auxiliar.'
                );
            }

            /*
             * Motor aislado:
             * usa exactamente el algoritmo actual,
             * pero no modifica ni dibuja la pantalla.
             */
            const motor =
                Object.create(this);

            motor.lastTSD =
                (pendientes.tsd || []).map(
                    item => ({
                        ...item,
                        _id:
                            't_' +
                            item.ID_Transaccion
                    })
                );

            motor.lastBancos =
                (pendientes.bancos || []).map(
                    item => ({
                        ...item,
                        _id:
                            'b_' +
                            item.IdTransaccion
                    })
                );

            motor.blacklist = [];
            motor.manualMatches = [];
            motor.currentSugData = [];
            motor.currentLimboData = [];

            motor.customTags =
                Array.isArray(etiquetas.data)
                    ? etiquetas.data
                    : [];

            motor._ajustesRecientes = [];
            motor._avisarSiCruza = null;

            // Sustituye únicamente el dibujo.
            motor.renderGrid = function () {};

            const borrador =
                await this._borradorApiM4('get');

            if (borrador.existe) {
                let snapshot;

                try {
                    snapshot = JSON.parse(
                        borrador.dataJson || '{}'
                    );
                } catch (error) {
                    throw new Error(
                        'El borrador compartido del Auxiliar contiene JSON inválido.'
                    );
                }

                this._aplicarSnapshotBorradorM4.call(
                    motor,
                    snapshot
                );
            }

            this.runMatchingAlgorithm.call(
                motor,
                motor.lastTSD,
                motor.lastBancos
            );

            return this._enviarCorteDiarioM4(
                fechaRegistro,
                origenCaptura,
                this._crearCorteDiarioM4.call(
                    motor
                )
            );
        };
})();