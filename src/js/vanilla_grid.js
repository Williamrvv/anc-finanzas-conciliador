class VanillaGrid {
    constructor(containerId, data, columns, options = {}) {
        this.container = document.querySelector(containerId);
        // El menú del navegador nunca debe aparecer sobre la tabla: cabecera, fila de
        // filtros, cuerpo, totales y zona vacía. El menú propio del grid sigue igual.
        if (this.container) {
            this.container.addEventListener('contextmenu', e => e.preventDefault());
        }
        this.originalData = data;
        this.displayData = [...data];
        this.columns = columns;
        this.options = options;
        
        // Estado
        this.sortState = { field: null, dir: 0 }; // 0: None, 1: Asc, -1: Desc
        this.filters = {};
        this.groupByField = null;

        // Selección
        this.selection = new Set();
        this.anchorCell = null;
        this.focusedRow = -1;
        this.focusedCol = -1;
        
        // Render inicial
        this.render();
        this.initGlobalEvents();
    }

    // --- RENDERIZADO VISUAL ---
    render() {
        if (!this.container) return;
        
        // 1. Guardar Estado (Scroll y Foco)
        const scrollEl = this.container.querySelector('.overflow-auto'); // El div interno
        const savedScrollX = scrollEl ? scrollEl.scrollLeft : 0;
        const savedScrollY = scrollEl ? scrollEl.scrollTop : 0;
        
        const activeEl = document.activeElement;
        const savedCursor = (activeEl && activeEl.tagName === 'INPUT') ? 
            { 
                field: activeEl.dataset.filter, 
                val: activeEl.value,
                // Guardar posición exacta del cursor
                start: activeEl.selectionStart,
                end: activeEl.selectionEnd
            } : null;

        this.container.innerHTML = '';
        // CHANGE: Agregamos 'select-none' aquí para bloquear selección de texto globalmente en la tabla
        this.container.className = "flex flex-col h-full min-h-0 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden text-sm select-none";
        this.container.tabIndex = 0; 

        const scrollArea = document.createElement('div');
        scrollArea.className = "overflow-auto flex-grow relative min-h-0";
        
        const table = document.createElement('table');
        table.className = "min-w-full border-collapse text-slate-700 dark:text-slate-300";

        // --- THEAD ---
        const thead = document.createElement('thead');
        // El 'top-0' asegura el Sticky Header dentro del contenedor con overflow-auto
        thead.className = "bg-slate-100 dark:bg-slate-700 sticky top-0 z-[25] shadow-sm";

        // Fila 1: Títulos (Con Drag & Drop y Sort arreglado)
        const trTitles = document.createElement('tr');
        this.columns.forEach((col, idx) => {
            const th = document.createElement('th');
            const align = col.hozAlign === 'right' ? 'flex-row-reverse' : 'flex-row';
            const isSorted = this.sortState.field === col.field;
            
            // Icono de ordenamiento (flecha)
            const sortIcon = this.getSortIcon(isSorted ? this.sortState.dir : 0);
            
            // Estilos activos
            const activeClass = isSorted ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-slate-600" : "text-slate-600 dark:text-slate-400";

            let stickyClass = "";
            if (col.formatter === 'checkbox') {
                stickyClass = "sticky left-0 z-30 bg-slate-100 dark:bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"; 
            }

            // Atributos Drag & Drop en el TH
            th.draggable = true; 
            th.dataset.colIdx = idx; 

            th.className = `p-0 border-r border-b border-slate-300 dark:border-slate-600 select-none ${activeClass} ${stickyClass} transition-colors duration-200`;
            
            // Estructura interna
            th.innerHTML = `
                <div class="flex items-center justify-between px-2 py-2 h-full w-full">
                    <!-- ZONA CLICK (ORDENAR) + DRAG -->
                    <!-- Flex-grow para ocupar espacio, cursor-pointer para indicar click -->
                    <div class="flex items-center gap-2 flex-grow cursor-pointer hover:text-blue-600 transition-colors select-none" 
                         data-action="sort" 
                         data-field="${col.field}"
                         title="Clic para ordenar">
                        
                        <!-- Texto Centrado si es numérico, Izquierda si es texto -->
                        <span class="font-bold truncate ${col.hozAlign === 'right' ? 'text-right w-full pr-1' : 'text-left'}">${col.title}</span>
                        
                        <!-- Icono Sort -->
                        <span class="text-slate-400 text-xs w-3 shrink-0">${sortIcon}</span>
                    </div>

                    <!-- BOTÓN AGRUPAR (Click separado) -->
                    <button class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-1 shrink-0" 
                            title="${this.groupByField === col.field ? 'Desagrupar' : 'Agrupar'}" 
                            data-action="group" 
                            data-field="${col.field}"
                            onmousedown="event.stopPropagation()"> <!-- Evita iniciar Drag -->
                        <svg class="w-3.5 h-3.5 ${this.groupByField === col.field ? 'text-blue-600' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h7"></path></svg>
                    </button>
                </div>
            `;
            trTitles.appendChild(th);
        });

        // Fila 2: Filtros + Botón Limpiar
        const trFilters = document.createElement('tr');
        this.columns.forEach((col, idx) => {
            const th = document.createElement('th');

            // UX STICKY: El filtro también debe quedarse quieto
            let stickyClass = "top-[37px]"; // Se pega debajo de la Fila 1 (Altura del header)
            if (col.formatter === 'checkbox') {
                stickyClass = "sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
            }
            
            th.className = `p-1 border-r border-b border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 ${stickyClass}`;
            const val = this.filters[col.field] || '';
            
            // CHANGE: Si es la primera columna, incluimos botones utilitarios (Limpiar y Fullscreen)
            let actionBtns = '';
            let inputClass = "w-full";
            
            if(idx === 0) {
                const hasFilters = Object.values(this.filters).some(x => x);
                const filterBtnColor = hasFilters ? "text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30" : "text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700";
                
                actionBtns = `
                    <div class="flex items-center mr-1 shrink-0 gap-0.5">
                        <button id="btn-fullscreen-grid" class="p-1 rounded transition-colors text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700" title="Ver en pantalla completa">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                        </button>
                        <button id="btn-export-excel" class="p-1 rounded transition-colors text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-slate-700" title="Exportar vista actual a Excel">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        </button>
                        <button id="btn-clear-filters" class="p-1 rounded transition-colors ${filterBtnColor}" title="Limpiar todos los filtros">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
                inputClass = "w-[calc(100%-4rem)]"; // Ajustar ancho para los tres botones
            }

            th.innerHTML = `
                <div class="flex items-center justify-center px-1">
                    ${actionBtns}
                    <input type="text" data-filter="${col.field}" value="${val}" 
                        class="${inputClass} text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-normal text-slate-600 dark:text-slate-300 placeholder-slate-400" 
                        placeholder="Buscar..." autocomplete="off">
                </div>
            `;
            trFilters.appendChild(th);
        });

        thead.appendChild(trTitles);
        thead.appendChild(trFilters);
        table.appendChild(thead);

        // --- TBODY ---
        const tbody = document.createElement('tbody');
        tbody.className = "bg-white dark:bg-slate-800";
        
        const dataToRender = this.groupByField ? this.getGroupedData() : this.displayData;

        if (this.groupByField) {
            Object.keys(dataToRender).forEach(groupKey => {
                const trGroup = document.createElement('tr');
                trGroup.className = "bg-slate-100 dark:bg-slate-700 font-bold sticky top-[75px] z-10 shadow-sm";
                trGroup.innerHTML = `<td colspan="${this.columns.length}" class="px-4 py-1.5 text-xs text-slate-600 dark:text-slate-200 border-y border-slate-300 dark:border-slate-600 flex items-center gap-2">
                    <span class="text-blue-600">▼</span> ${groupKey} <span class="bg-slate-200 dark:bg-slate-600 px-1.5 rounded-full text-[10px] ml-1">${dataToRender[groupKey].length}</span>
                </td>`;
                tbody.appendChild(trGroup);
                dataToRender[groupKey].forEach((row, idx) => tbody.appendChild(this.createRow(row, idx)));
            });
        } else {
            dataToRender.forEach((row, idx) => tbody.appendChild(this.createRow(row, idx)));
        }

        // 3. TFOOT (Totales Automáticos)
        // Verificamos si alguna columna requiere cálculos
        if (this.columns.some(col => col.bottomCalc)) {
            const tfoot = document.createElement('tfoot');
            tfoot.className = "bg-slate-100 dark:bg-slate-700 font-bold sticky bottom-0 z-20 shadow-[0_-2px_5px_rgba(0,0,0,0.1)] border-t-2 border-slate-300 dark:border-slate-600 text-xs";
            
            const trFoot = document.createElement('tr');
            this.columns.forEach(col => {
                const td = document.createElement('td');
                // Misma alineación que el cuerpo
                let cls = "px-3 py-2 whitespace-nowrap border-r border-slate-200 dark:border-slate-600 ";
                
                if (col.formatter === 'checkbox') {
                     cls += "sticky left-0 z-20 bg-slate-100 dark:bg-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ";
                }
                if (col.hozAlign === 'right') cls += "text-right font-mono ";
                
                // Cálculo
                let content = '';
                if (col.bottomCalc === 'sum') {
                    // Sumar columna actual (this.displayData respeta filtros)
                    const sum = this.displayData.reduce((acc, row) => {
                        let val = row[col.field];
                        // Soporte para objetos matemáticos personalizados (Ej: Columna MontoTSD + Recibo)
                        if (typeof val === 'object' && val !== null && 'valor' in val) {
                            val = val.valor;
                        }
                        // Limpieza agresiva de números
                        if(typeof val === 'string') val = parseFloat(val.replace(/[^0-9.-]/g,'')) || 0;
                        return acc + (parseFloat(val) || 0);
                    }, 0);
                    
                    // Formato Inteligente: Priorizar el bottomCalcFormatter
                    if (typeof col.bottomCalcFormatter === 'function') {
                        content = col.bottomCalcFormatter(sum);
                    } else if (col.bottomCalcFormatter === 'money' || col.formatter === 'money') {
                        content = this.formatMoney(sum);
                    } else {
                        // Fallback de seguridad (evita los chorros de decimales feos .69669999)
                        content = Number(sum).toFixed(2);
                    }
                } else if (col.bottomCalc === 'count') {
                    content = this.displayData.length;
                } else if (col.title === 'Afiliado' || col.field === 'id') {
                    content = "TOTALES:"; // Etiqueta estética
                    cls += "text-right";
                }

                td.className = cls;
                // CORRECCIÓN: Usar innerHTML para permitir etiquetas de color en negativos
                td.innerHTML = content; 
                trFoot.appendChild(td);
            });
            tfoot.appendChild(trFoot);
            table.appendChild(tfoot);
        }

        table.appendChild(tbody);
        scrollArea.appendChild(table);
        this.container.appendChild(scrollArea);

        // Restaurar Foco y Cursor (Mejorado)
        if(savedCursor) {
            setTimeout(() => {
                const input = this.container.querySelector(`input[data-filter="${savedCursor.field}"]`);
                if(input) { 
                    input.focus(); 
                    // Restaurar posición exacta
                    if (typeof savedCursor.start === 'number') {
                        input.setSelectionRange(savedCursor.start, savedCursor.end);
                    } else {
                        input.setSelectionRange(input.value.length, input.value.length);
                    }
                }
            }, 0);
        }

        this.container.appendChild(scrollArea);

        // --- FOOTER INTEGRADO (Informativo + Autosuma) ---
        const footer = document.createElement('div');
        footer.className = "bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex justify-between items-center text-[10px] text-slate-500 select-none z-20 shrink-0 overflow-hidden";
        
        footer.innerHTML = `
            <!-- Lado Izquierdo: Fijo -->
            <div class="flex items-center gap-4">
                <span class="font-mono font-bold whitespace-nowrap">Filas: <span class="text-slate-700 dark:text-slate-300">${this.displayData.length}</span></span>
                
                <!-- Autosuma (Oculto por defecto con animación de slide-in) -->
                <div class="vg-autosum-container flex items-center gap-4 opacity-0 -translate-x-4 transition-all duration-300 pointer-events-none invisible">
                    <div class="h-3 w-px bg-slate-300 dark:bg-slate-600"></div>
                    <div class="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        <span class="font-bold uppercase tracking-wider">Selección</span>
                    </div>
                    <span class="font-mono font-bold">RECUENTO: <span class="vg-stat-count text-slate-800 dark:text-white">0</span></span>
                    <span class="font-mono font-bold">SUMA: <span class="vg-stat-sum text-blue-600 dark:text-blue-400 text-xs">0</span></span>
                </div>
            </div>

            <!-- Lado Derecho: Hint -->
            <div class="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                <span><kbd class="font-sans font-bold border border-slate-300 dark:border-slate-600 rounded px-1.5 bg-white dark:bg-slate-800 shadow-sm text-[9px]">Shift</kbd> + Scroll</span>
            </div>
        `;
        
        this.container.appendChild(footer);
        this.autosumContainer = footer.querySelector('.vg-autosum-container'); 

        // --- NATIVE ELEGANT RESIZE HANDLE ---
        // Se inyecta solo si no fue explícitamente desactivado
        if (this.options.resize !== false) {
            const resizer = document.createElement('div');
            resizer.className = "w-full h-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-ns-resize transition-colors opacity-50 hover:opacity-100 shrink-0";
            this.container.appendChild(resizer);

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startHeight = this.container.getBoundingClientRect().height;
                
                this.container.style.flex = "none";
                this.container.style.maxHeight = "none";

                const onMouseMove = (ev) => {
                    const newHeight = startHeight + (ev.clientY - startY);
                    if (newHeight >= 200) { 
                        this.container.style.height = newHeight + 'px';
                    }
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = ''; 
                    document.body.classList.remove('select-none');
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                
                document.body.style.cursor = 'ns-resize'; 
                document.body.classList.add('select-none');
            });
        }
        // ------------------------------------

        this.attachEvents(table);
        // 2. Restaurar Scroll
        const newScrollEl = this.container.querySelector('.overflow-auto');
        if(newScrollEl) {
            newScrollEl.scrollLeft = savedScrollX;
            newScrollEl.scrollTop = savedScrollY;
        }
        
    }

    createRow(row, idx) {
        const tr = document.createElement('tr');
        
        // Retiramos el color de fondo en hover y dejamos solo el marco delgado vía shadows en los TDs
        let rowBaseClass = "transition-colors border-b border-slate-100 dark:border-slate-700 group select-none";
        if (row._rowClass) rowBaseClass += " " + row._rowClass;
        tr.className = rowBaseClass;
        
        this.columns.forEach((col, colIdx) => {
            const td = document.createElement('td');
            td.dataset.r = idx; 
            td.dataset.c = colIdx;
            td.dataset.val = row[col.field] || '';

            // Quitar overflow-hidden text-ellipsis para que el texto completo siempre se vea
            let cls = "px-3 py-1.5 whitespace-nowrap border-r border-slate-100 dark:border-slate-700 cursor-default text-xs transition-shadow duration-75 ";
            
            // UX: Marco perimetral delgado de color #859aff en Hover (Usando inset shadows para evitar saltos de layout)
            if (this.columns.length === 1) {
                cls += "group-hover:shadow-[inset_0_0_0_1.5px_#859aff] "; // Si solo hay 1 columna, marco completo
            } else if (colIdx === 0) {
                cls += "group-hover:shadow-[inset_1.5px_1.5px_0_#859aff,inset_0_-1.5px_0_#859aff] "; // Primera celda (Izquierda, Arriba, Abajo)
            } else if (colIdx === this.columns.length - 1) {
                cls += "group-hover:shadow-[inset_0_1.5px_0_#859aff,inset_-1.5px_-1.5px_0_#859aff] "; // Última celda (Derecha, Arriba, Abajo)
            } else {
                cls += "group-hover:shadow-[inset_0_1.5px_0_#859aff,inset_0_-1.5px_0_#859aff] "; // Celdas del medio (Solo Arriba y Abajo)
            }

            if(col.hozAlign === 'right') cls += "text-right font-mono "; else cls += "text-left ";

            // UX STICKY: Fijar celda a la izquierda
            if (col.formatter === 'checkbox') {
                cls += "sticky left-0 z-10 bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ";
            }

            // (Lógica de colores eliminada a petición del cliente)

            td.className = cls;
            let content = row[col.field];
            
            // NUEVO: Soporte para Checkbox
            if (col.formatter === 'checkbox') {
                const checked = row[col.field] ? 'checked' : '';
                // Input interactivo. El evento se maneja globalmente o inline.
                // Usamos data-attributes para identificar la fila/columna al cambiar
                content = `<div class="flex justify-center"><input type="checkbox" class="w-4 h-4 cursor-pointer accent-blue-600 vg-checkbox" ${checked} data-r="${idx}" data-c="${colIdx}"></div>`;
            }
            
            // Soporte para funciones formatter personalizadas
            if (typeof col.formatter === 'function') {
                // Simulamos un objeto cell simple
                const cellShim = {
                    getValue: () => row[col.field],
                    getRow: () => row, 
                    getElement: () => td
                };
                content = col.formatter(cellShim);
            } 
            else if (col.formatter === 'money') {
                content = this.formatMoney(content);
            }

            td.innerHTML = content !== undefined ? content : '';
            tr.appendChild(td);
        });
        return tr;
    }

    // --- EVENTOS Y LÓGICA ---
    attachEvents(table) {
        const thead = table.querySelector('thead');
        
        // 1. Sort & Group
        thead.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]'); 
            if(btn) {
                const action = btn.dataset.action;
                const field = btn.dataset.field;
                if(action === 'sort') this.handleSort(field);
                if(action === 'group') { 
                    e.stopPropagation(); 
                    this.groupByField = this.groupByField === field ? null : field; 
                    this.render(); 
                }
            }
            
            // Listener para el botón Limpiar
            const clearBtn = e.target.closest('#btn-clear-filters');
            if(clearBtn) {
                this.clearAllFilters();
            }

            // Listener para el botón Fullscreen
            const fsBtn = e.target.closest('#btn-fullscreen-grid');
            if(fsBtn) {
                this.toggleFullscreen();
            }

            // Listener para Exportar a Excel
            const exportBtn = e.target.closest('#btn-export-excel');
            if(exportBtn) {
                this.exportToExcel();
            }
        });

        // 2. Inputs Filtro
        table.querySelectorAll('input[data-filter]').forEach(input => {
            input.addEventListener('input', (e) => {
                this.filters[e.target.dataset.filter] = e.target.value.toLowerCase();
                this.applyFilters();
            });
        });

        // 3. Selección Mouse
        const tbody = table.querySelector('tbody');
        tbody.addEventListener('mousedown', (e) => {
            const td = e.target.closest('td');
            if(!td) return;
            if(e.button === 2) { this.handleContextMenu(e, td); return; }

            const r = parseInt(td.dataset.r);
            const c = parseInt(td.dataset.c);

            if(e.shiftKey && this.anchorCell) {
                this.selectRange(this.anchorCell, {r,c});
            } else {
                if(!e.ctrlKey) this.clearSelection();
                this.anchorCell = {r,c};
                this.addSelection(td);
            }
            this.setFocus(r,c);
            
            const onMove = (ev) => {
                const target = ev.target.closest('td');
                if(target) this.selectRange(this.anchorCell, {r: parseInt(target.dataset.r), c: parseInt(target.dataset.c)});
            };
            const onUp = () => {
                tbody.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };
            tbody.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
        
        tbody.addEventListener('contextmenu', e => e.preventDefault());
        // 4. Checkbox Change (Delegación)
        table.addEventListener('change', (e) => {
            if(e.target.classList.contains('vg-checkbox')) {
                const r = parseInt(e.target.dataset.r);
                const c = parseInt(e.target.dataset.c);
                const field = this.columns[c].field;
                const val = e.target.checked;
                
                // Actualizar datos locales
                this.displayData[r][field] = val;
                
                // Callback externo si existe (para notificar al padre)
                if(this.options.onCheckboxChange) {
                    this.options.onCheckboxChange(this.displayData[r], field, val);
                }
            }
        });

        // 5. Drag & Drop de Columnas
        let draggedColIdx = null;

        const headers = table.querySelectorAll('thead tr:first-child th');
        headers.forEach(th => {
            // Iniciar arrastre
            th.addEventListener('dragstart', (e) => {
                draggedColIdx = parseInt(e.target.dataset.colIdx);
                e.dataTransfer.effectAllowed = 'move';
                e.target.classList.add('opacity-50', 'bg-blue-100'); // Feedback visual
            });

            // Terminar arrastre (limpieza)
            th.addEventListener('dragend', (e) => {
                e.target.classList.remove('opacity-50', 'bg-blue-100');
                headers.forEach(h => h.classList.remove('border-l-4', 'border-blue-500')); // Quitar indicadores
            });

            // Arrastrar sobre otro header
            th.addEventListener('dragover', (e) => {
                e.preventDefault(); // Necesario para permitir drop
                const targetIdx = parseInt(e.currentTarget.dataset.colIdx);
                if (draggedColIdx === targetIdx) return;

                // Indicador visual de inserción (Borde izquierdo azul)
                headers.forEach(h => h.classList.remove('border-l-4', 'border-blue-500'));
                e.currentTarget.classList.add('border-l-4', 'border-blue-500');
            });

            // Soltar (Drop)
            th.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIdx = parseInt(e.currentTarget.dataset.colIdx);

                if (draggedColIdx !== null && draggedColIdx !== targetIdx) {
                    // Reordenar array de columnas
                    const colToMove = this.columns[draggedColIdx];
                    this.columns.splice(draggedColIdx, 1); // Sacar
                    this.columns.splice(targetIdx, 0, colToMove); // Insertar

                    // Redibujar tabla completa
                    this.render();
                }
            });
        });

        // 6. Doble Clic en Fila (Ver Detalles)
        tbody.addEventListener('dblclick', (e) => {
            const tr = e.target.closest('tr');
            if(!tr) return;
            
            // Obtener datos de la fila
            const rowIndex = parseInt(tr.querySelector('td').dataset.r);
            const rowData = this.displayData[rowIndex];
            
            // Ejecutar callback si existe
            if(this.options.onRowDblClick) {
                this.options.onRowDblClick(rowData);
            }
        });
    }

    initGlobalEvents() {
        // 1. Navegación Teclado Tabla
        this.container.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') {
                if (e.key === 'Enter') e.preventDefault();
                return; 
            }
            if((e.ctrlKey||e.metaKey) && e.key === 'c') { e.preventDefault(); this.copySelection(); return; }
            if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); this.handleArrowKey(e); }
        });

        // 2. Click Fuera (Cerrar menús)
        document.addEventListener('click', (e) => {
            if(!e.target.closest('#vg-context-menu')) document.getElementById('vg-context-menu')?.remove();
        });

        // 3. ESTÁNDAR: Conexión Automática del Buscador
        // Si me pasaron el ID del input, yo mismo me encargo de escucharlo.
        if (this.options.searchInputId) {
            const input = document.getElementById(this.options.searchInputId);
            if (input) {
                // Clonamos para limpiar listeners viejos si se recarga el grid
                const cleanInput = input.cloneNode(true);
                input.parentNode.replaceChild(cleanInput, input);
                
                // Conectar eventos
                cleanInput.addEventListener('input', (e) => {
                    // Solo ejecutar si este contenedor está visible
                    if(this.container.offsetParent !== null) {
                        this.highlight(e.target.value);
                    }
                });
                
                // UX: Auto-focus si estamos en un popup (opcional, pero útil)
                if(this.options.autoFocusSearch) cleanInput.focus();
            }
        }
    }

    // --- LÓGICA DE DATOS ---
    handleSort(field) {
        // Ciclo: None -> Asc -> Desc -> None
        if(this.sortState.field !== field) this.sortState = { field, dir: 1 };
        else this.sortState.dir = this.sortState.dir === 1 ? -1 : (this.sortState.dir === -1 ? 0 : 1);
        
        if(this.sortState.dir === 0) this.sortState.field = null;
        this.applyFilters(); // Re-aplica filtros y orden
    }

    applyFilters() {
        // 1. Filtrar
        let data = this.originalData.filter(row => {
            return Object.keys(this.filters).every(key => {
                const term = this.filters[key];
                if (!term) return true; // Filtro vacío

                let rawVal = row[key];
                
                // EXTRA UX FIX: Si rawVal es un objeto estructurado (Ej: {nombre: "X", recibo: "Y"}), extraemos todo su texto
                let strVal = '';
                if (typeof rawVal === 'object' && rawVal !== null) {
                    strVal = Object.values(rawVal).join(' ');
                } else {
                    strVal = String(rawVal || '');
                }
                
                // Estrategia Doble: Buscar en el valor Crudo Y en el Formateado
                // Esto permite encontrar "2000" (raw) y "2.000" (formatted)
                let matchTargets = [strVal.toLowerCase()];

                // Si la columna tiene formato moneda, agregamos la versión visual a la búsqueda
                const colDef = this.columns.find(c => c.field === key);
                if (colDef && colDef.formatter === 'money') {
                    // Generamos lo que el usuario ve: "₡ 2.000,00"
                    const formatted = this.formatMoney(rawVal).toLowerCase();
                    matchTargets.push(formatted);
                    
                    // Extra UX: Versión limpia sin símbolo (para buscar "2.000" sin poner ₡)
                    matchTargets.push(formatted.replace(/[₡\s]/g, ''));
                }

                // Si ALGUNO de los formatos contiene el término, es match
                return matchTargets.some(t => t.includes(term));
            });
        });

        // 2. Ordenar
        if(this.sortState.field && this.sortState.dir !== 0) {
            const { field, dir } = this.sortState;
            
            data.sort((a, b) => {
                const valA = a[field];
                const valB = b[field];

                // Función auxiliar de limpieza numérica
                const parse = (v) => {
                    if (typeof v === 'number') return v;
                    if (!v) return -Infinity; // Vacíos al final/principio
                    // Eliminar todo lo que NO sea dígito, punto o signo negativo
                    const clean = String(v).replace(/[^0-9.-]/g, '');
                    const num = parseFloat(clean);
                    return isNaN(num) ? v : num; // Si falla, devolver original para sort alfabético
                };

                const numA = parse(valA);
                const numB = parse(valB);
                
                // Si ambos son números (o convertibles), usar resta matemática
                if(typeof numA === 'number' && typeof numB === 'number') {
                    return (numA - numB) * dir;
                }
                
                // Fallback a texto
                return String(valA).localeCompare(String(valB)) * dir;
            });
        }
        
        this.displayData = data;
        this.render();
    }

    // --- BÚSQUEDA GLOBAL (HIGHLIGHT) ---
    highlight(term) {
        // 1. Limpiar resaltados previos
        // Buscamos cualquier nodo de texto envuelto en <mark> y lo restauramos
        this.container.querySelectorAll('mark').forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize(); // Unir nodos de texto adyacentes
        });
        
        // Limpiar clases de foco visual previo
        this.container.querySelectorAll('.bg-yellow-200').forEach(el => {
            el.classList.remove('bg-yellow-200', 'text-slate-900', 'ring-2', 'ring-yellow-400');
        });

        if (!term || term.length < 2) return; // Mínimo 2 caracteres para evitar ruido

        const termLower = term.toLowerCase();
        let firstMatch = null;
        let matchCount = 0;

        // 2. Buscar en todas las celdas visibles
        const cells = this.container.querySelectorAll('tbody td');
        
        cells.forEach(cell => {
            // Ignoramos celdas sin texto visible
            if(!cell.textContent) return;

            const text = cell.textContent;
            const index = text.toLowerCase().indexOf(termLower);

            if (index >= 0) {
                matchCount++;
                
                // Efecto visual fuerte (Fondo Amarillo + Borde)
                cell.classList.add('bg-yellow-200', 'text-slate-900', 'ring-2', 'ring-yellow-400');
                
                // Opcional: Resaltar texto específico (Highlighter pen effect)
                // Esto es más avanzado, por ahora el fondo de celda es más limpio y rápido.

                if (!firstMatch) firstMatch = cell;
            }
        });

        // 3. Navegar al primer resultado
        if (firstMatch) {
            firstMatch.scrollIntoView({block: 'center', inline: 'center'});
            // Pequeña animación para llamar la atención
            firstMatch.classList.add('animate-pulse');
            setTimeout(() => firstMatch.classList.remove('animate-pulse'), 1000);
        }
        
        return matchCount; // Retornamos cantidad por si la UI externa quiere mostrar "5 encontrados"
    }

    // --- UTILS ---
    getSortIcon(dir) {
        if(dir === 1) return '<svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>';
        if(dir === -1) return '<svg class="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
        return '<svg class="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>';
    }

    getCell(r, c) { return this.container.querySelector(`td[data-r="${r}"][data-c="${c}"]`); }

    addSelection(cell) {
        cell.classList.add('bg-blue-100', 'dark:bg-blue-900', 'ring-1', 'ring-inset', 'ring-blue-500'); // Borde inset para no mover layout
        this.selection.add(cell);
        this.calculateAutosum();
    }

    clearSelection() {
        this.selection.forEach(c => c.className = c.className.replace(/bg-blue-100 dark:bg-blue-900 ring-1 ring-inset ring-blue-500/g, ''));
        this.selection.clear();
        this.container.querySelectorAll('.outline-2').forEach(e => e.classList.remove('outline-2', 'outline-blue-600', 'outline'));
        this.calculateAutosum();
    }

    setFocus(r, c) {
        this.focusedRow = r; this.focusedCol = c;
        const cell = this.getCell(r, c);
        if(cell) {
            // 1. Scroll nativo del navegador
            cell.scrollIntoView({block:'nearest', inline:'nearest'});
            
            // 2. UX FIX (Sticky Header & Footer Override): Evitar que la celda quede oculta bajo paneles fijos
            const scrollArea = this.container.querySelector('.overflow-auto');
            const thead = this.container.querySelector('thead');
            const tfoot = this.container.querySelector('tfoot'); // Buscar el footer de sumas
            
            if (scrollArea && thead) {
                const cellRect = cell.getBoundingClientRect();
                const scrollRect = scrollArea.getBoundingClientRect();
                const theadHeight = thead.offsetHeight;
                const tfootHeight = tfoot ? tfoot.offsetHeight : 0; // Altura del footer si existe
                
                // Limites de la zona "segura" visible
                const safeTop = scrollRect.top + theadHeight;
                const safeBottom = scrollRect.bottom - tfootHeight;
                
                // Corrección al subir (Quedó detrás del thead)
                if (cellRect.top < safeTop) {
                    scrollArea.scrollTop -= (safeTop - cellRect.top + 4);
                } 
                // Corrección al bajar (Quedó detrás del tfoot)
                else if (cellRect.bottom > safeBottom) {
                    scrollArea.scrollTop += (cellRect.bottom - safeBottom + 4);
                }
            }

            // 3. Resaltado Visual (Focus)
            this.container.querySelectorAll('.outline-2').forEach(e => e.classList.remove('outline-2', 'outline-blue-600', 'outline'));
            cell.classList.add('outline', 'outline-2', 'outline-blue-600', '-outline-offset-2');
        }
    }

    selectRange(start, end) {
        this.clearSelection();
        const minR = Math.min(start.r, end.r), maxR = Math.max(start.r, end.r);
        const minC = Math.min(start.c, end.c), maxC = Math.max(start.c, end.c);
        for(let r=minR; r<=maxR; r++) for(let c=minC; c<=maxC; c++) {
            const cell = this.getCell(r, c); if(cell) this.addSelection(cell);
        }
    }

    calculateAutosum() {
        let sum = 0, count = 0;
        
        this.selection.forEach(cell => {
            let val = cell.dataset.val; // Valor crudo (Raw)
            
            // Si está vacío, saltar
            if(!val) return;

            let num = 0;

            // CASO 1: Ya es un número puro
            if (typeof val === 'number') {
                num = val;
            } 
            // CASO 2: Es texto, necesitamos interpretar formato
            else if (typeof val === 'string') {
                // Limpiar basura (letras, símbolos moneda)
                let clean = val.replace(/[^0-9.,-]/g, '');

                // LÓGICA DE DETECCIÓN DE FORMATO:
                
                // A. Si tiene Coma (Formato CR/EU: 1.000,50 o 1000,50)
                if (clean.includes(',')) {
                    // Quitamos los puntos (miles) y cambiamos coma por punto (decimal)
                    clean = clean.replace(/\./g, '').replace(',', '.');
                } 
                // B. Si NO tiene Coma, pero tiene Punto
                else if (clean.includes('.')) {
                    // Contamos los puntos
                    const dots = (clean.match(/\./g) || []).length;
                    
                    if (dots > 1) {
                        // "1.200.500" -> Son miles. Quitarlos.
                        clean = clean.replace(/\./g, '');
                    } else {
                        // "1500.50" -> Es decimal estándar JS. Dejarlo quieto.
                        // (Aquí estaba el error antes, a veces se borraba este punto)
                    }
                }
                
                num = parseFloat(clean);
            }

            if (!isNaN(num)) { 
                sum += num; 
                if (num !== 0) count++; 
            }
        });
        
        // Actualizar UI INTEGRADA con Animación
        if(this.autosumContainer) {
            if(this.selection.size < 2) {
                // Ocultar suavemente
                this.autosumContainer.classList.add('opacity-0', '-translate-x-4', 'invisible', 'pointer-events-none');
            } else {
                // Mostrar y actualizar datos
                this.autosumContainer.querySelector('.vg-stat-count').innerText = this.selection.size;
                this.autosumContainer.querySelector('.vg-stat-sum').innerHTML = this.formatMoney(sum);
                this.autosumContainer.classList.remove('opacity-0', '-translate-x-4', 'invisible', 'pointer-events-none');
            }
        }
    }

    copySelection() {
        if(!this.selection.size) return;
        const rows={}; 
        this.selection.forEach(c => {
            const r=c.dataset.r; if(!rows[r]) rows[r]=[];
            rows[r].push({c:parseInt(c.dataset.c), v:c.innerText});
        });
        const txt = Object.keys(rows).sort((a,b)=>a-b).map(k => rows[k].sort((a,b)=>a.c-b.c).map(o=>o.v).join('\t')).join('\n');
        navigator.clipboard.writeText(txt);
        // Visual flash
        const t = this.container.querySelector('table');
        t.classList.add('opacity-50'); setTimeout(()=>t.classList.remove('opacity-50'), 100);
    }

    handleContextMenu(e, cell) {
        e.preventDefault();
        document.getElementById('vg-context-menu')?.remove();
        const val = cell.innerText;
        const field = this.columns[cell.dataset.c].field;
        
        const menu = document.createElement('div');
        menu.id = "vg-context-menu";
        menu.className = "fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-xl rounded py-1 z-50 text-xs min-w-[160px]";
        menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
        menu.innerHTML = `
            <div class="px-3 py-1.5 text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700 truncate max-w-[200px]">${val}</div>
            <button class="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700" id="ctx-filter">🔍 Filtrar por esto</button>
            <button class="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700" id="ctx-copy">📋 Copiar valor</button>
        `;
        menu.addEventListener('contextmenu', ev => ev.preventDefault());
        document.body.appendChild(menu);
        
        document.getElementById('ctx-filter').onclick = () => {
            this.filters[field] = val.toLowerCase();
            this.applyFilters();
            menu.remove();
        };
        document.getElementById('ctx-copy').onclick = () => { navigator.clipboard.writeText(val); menu.remove(); };

        // Espacio para invitados: la pantalla dueña de la tabla puede agregar sus
        // propias opciones a ESTE MISMO menú. Si no lo pide, todo queda como siempre.
        if (this.options.onRowContextMenu) {
            const r = parseInt(cell.dataset.r);
            if (!isNaN(r) && this.displayData[r]) this.options.onRowContextMenu(this.displayData[r], e, menu);
        }

        // Conciencia de viewport: si el menú (ya con opciones invitadas) se sale de la pantalla, se recoloca
        const rect = menu.getBoundingClientRect();
        const margen = 8;
        let x = e.clientX, y = e.clientY;
        if (x + rect.width > window.innerWidth - margen) x = Math.max(margen, window.innerWidth - rect.width - margen);
        if (y + rect.height > window.innerHeight - margen) y = Math.max(margen, window.innerHeight - rect.height - margen);
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }

    handleArrowKey(e) {
        if(this.focusedRow===-1) { this.setFocus(0,0); return; }
        let nr=this.focusedRow, nc=this.focusedCol;
        const maxR=this.displayData.length-1, maxC=this.columns.length-1;
        const jump=e.ctrlKey;
        if(e.key==='ArrowUp') nr=jump?0:Math.max(0, nr-1);
        if(e.key==='ArrowDown') nr=jump?maxR:Math.min(maxR, nr+1);
        if(e.key==='ArrowLeft') nc=jump?0:Math.max(0, nc-1);
        if(e.key==='ArrowRight') nc=jump?maxC:Math.min(maxC, nc+1);
        
        if(e.shiftKey) this.selectRange(this.anchorCell||{r:this.focusedRow,c:this.focusedCol}, {r:nr,c:nc});
        else { this.clearSelection(); this.anchorCell={r:nr,c:nc}; const c=this.getCell(nr,nc); if(c) this.addSelection(c); }
        this.setFocus(nr,nc);
    }

    clearAllFilters() {
        this.filters = {};
        this.applyFilters(); // Esto re-renderiza y limpia los inputs visualmente
    }

    getGroupedData() {
        return this.displayData.reduce((a,i)=>{ const k=i[this.groupByField]||'Otros'; if(!a[k])a[k]=[]; a[k].push(i); return a; }, {});
    }

    formatMoney(val) {
        const num = parseFloat(val);
        if(isNaN(num)) return val;

        let formatted = new Intl.NumberFormat('es-CR', {
            style: 'currency', 
            currency: 'CRC', 
            minimumFractionDigits: 2, // <--- OBLIGATORIO: Siempre 2 decimales
            maximumFractionDigits: 2  // <--- OBLIGATORIO: No más de 2
        }).format(Math.abs(num));

        // HACK UX: Reemplazar punto de miles por espacio (Estándar visual solicitado)
        // Ejemplo: ₡1.533,41 -> ₡1 533,41
        if (formatted.includes('.') && formatted.includes(',')) {
             formatted = formatted.replace(/\./g, ' '); 
        }

        // Devolvemos el número negativo con formato neutral
        if (num < 0) {
            return `-${formatted}`;
        }
        return formatted;
    }

    // Método público para actualizar opciones y repintar
    updateOption(key, value) {
        console.log(`5. Motor actualizando [${key}] a: ${value} y repintando.`);
        this.options[key] = value;
        this.render(); // <--- OBLIGATORIO: Borra y vuelve a dibujar la tabla
    }

    // Método para actualizar datos sin perder estado (filtros, sort, scroll)
    updateData(newData) {
        // 1. Actualizar fuente de datos
        this.originalData = newData;
        
        // 2. Re-aplicar filtros y ordenamiento actuales
        this.applyFilters(); 
    }

    // UX: Pantalla Completa Nativa
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            // Entrar a pantalla completa con un pequeño fondo oscuro para no encandilar
            this.container.classList.add('bg-white', 'dark:bg-slate-900');
            if (this.container.requestFullscreen) {
                this.container.requestFullscreen();
            } else if (this.container.webkitRequestFullscreen) { /* Safari */
                this.container.webkitRequestFullscreen();
            } else if (this.container.msRequestFullscreen) { /* IE11 */
                this.container.msRequestFullscreen();
            }
        } else {
            // Salir de pantalla completa
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { /* Safari */
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { /* IE11 */
                document.msExitFullscreen();
            }
        }
    }

    // Exportación Inteligente a Excel
    exportToExcel() {
        if (typeof XLSX === 'undefined') {
            if(window.SysUI) window.SysUI.alert("La librería de Excel no está disponible.", "Error", "error");
            else alert("Librería de Excel no encontrada.");
            return;
        }

        // 1. Obtener cabeceras válidas base
        const exportCols = this.columns.filter(c => c.field && c.formatter !== 'checkbox');
        let headers = [];
        
        // 2. Mapeo inteligente de columnas (Por si hay columnas dobles como "Monto/Detalle")
        const colMapping = [];
        exportCols.forEach(c => {
            headers.push(c.title);
            colMapping.push({ field: c.field, type: 'primary' });
            
            // Si la columna es nuestro Objeto Matemático del TSD, inyectamos una cabecera extra al vuelo
            if (this.displayData.length > 0 && typeof this.displayData[0][c.field] === 'object' && this.displayData[0][c.field] !== null && 'valor' in this.displayData[0][c.field] && 'recibo' in this.displayData[0][c.field]) {
                headers.push("Detalle / Recibo");
                colMapping.push({ field: c.field, type: 'secondary' }); // Fila extra para el recibo
            }
        });

        // 3. Formatear datos de la tabla VISIBLE respetando el nuevo mapeo
        const rows = this.displayData.map(row => {
            return colMapping.map(mapDef => {
                let val = row[mapDef.field];

                // Caso 1: Es nuestro Objeto Matemático (MontoTSD)
                if (typeof val === 'object' && val !== null && 'valor' in val && 'recibo' in val) {
                    if (mapDef.type === 'primary') return val.valor; // Columna base = El Número
                    if (mapDef.type === 'secondary') return val.recibo; // Columna extra = El Texto
                }

                // Caso 2: Es un Objeto Simple de UX (Ej: Cliente)
                if (typeof val === 'object' && val !== null && val.nombre) {
                    return val.recibo ? `${val.nombre} - ${val.recibo}` : val.nombre;
                }

                // Caso 3: Arrays u otros objetos no mapeados (Previene el error de funciones toString)
                if (typeof val === 'object' && val !== null) {
                    return JSON.stringify(val);
                }

                // Caso 4: Números o Textos limpios
                if (typeof val === 'number') return val;
                return val !== undefined && val !== null ? String(val) : '';
            });
        });

        // 4. Crear Libro y Hoja
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        
        // Ajustar ancho básico de columnas para que no se vea aplastado
        const wscols = headers.map(h => ({wch: Math.max(15, h.length + 5)}));
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Datos Extraídos");

        // 4. Disparar Descarga
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '');
        XLSX.writeFile(wb, `Reporte_Tabla_${dateStr}_${timeStr}.xlsx`);
    }

}