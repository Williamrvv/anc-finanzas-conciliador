class VanillaGrid {
    constructor(containerId, data, columns, options = {}) {
        this.container = document.querySelector(containerId);
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
            { field: activeEl.dataset.filter, val: activeEl.value } : null;

        this.container.innerHTML = '';
        // CHANGE: Agregamos 'select-none' aquí para bloquear selección de texto globalmente en la tabla
        this.container.className = "flex flex-col h-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg shadow-sm overflow-hidden text-sm select-none";
        this.container.tabIndex = 0; 

        const scrollArea = document.createElement('div');
        scrollArea.className = "overflow-auto flex-grow relative";
        
        const table = document.createElement('table');
        table.className = "min-w-full border-collapse text-slate-700 dark:text-slate-300";

        // --- THEAD ---
        const thead = document.createElement('thead');
        thead.className = "bg-slate-100 dark:bg-slate-700 sticky top-0 z-20 shadow-sm";

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
            let stickyClass = "";
            if (col.formatter === 'checkbox') {
                stickyClass = "sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]";
            }
            
            th.className = `p-1 border-r border-b border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 ${stickyClass}`;
            const val = this.filters[col.field] || '';
            
            // CHANGE: Si es la primera columna, incluimos el botón de "Limpiar Todo"
            let cleanerBtn = '';
            let inputClass = "w-full";
            
            if(idx === 0) {
                // Verificamos si hay filtros activos para mostrar el botón coloreado
                const hasFilters = Object.values(this.filters).some(x => x);
                const btnColor = hasFilters ? "text-red-500 hover:bg-red-100" : "text-slate-400 hover:text-slate-600";
                
                cleanerBtn = `
                    <button id="btn-clear-filters" class="mr-1 p-1 rounded transition-colors ${btnColor}" title="Limpiar todos los filtros">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                `;
                inputClass = "w-[calc(100%-2rem)]"; // Ajustar ancho del input
            }

            th.innerHTML = `
                <div class="flex items-center justify-center px-1">
                    ${cleanerBtn}
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
                        // Limpieza agresiva de números
                        if(typeof val === 'string') val = parseFloat(val.replace(/[^0-9.-]/g,'')) || 0;
                        return acc + (parseFloat(val) || 0);
                    }, 0);
                    
                    // Formato
                    content = col.formatter === 'money' ? this.formatMoney(sum) : sum;
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

        if(savedCursor) {
            const input = this.container.querySelector(`input[data-filter="${savedCursor.field}"]`);
            if(input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
        }

        this.container.appendChild(scrollArea);

        // --- FOOTER INFORMATIVO (Shift + Scroll) ---
        const footer = document.createElement('div');
        footer.className = "bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-3 py-1.5 flex justify-between items-center text-[10px] text-slate-400 select-none z-20";
        
        // Icono de flechas horizontales + Texto
        footer.innerHTML = `
            <span class="font-mono">Total: ${this.displayData.length} filas</span>
            <div class="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                <span><kbd class="font-sans font-bold border border-slate-300 dark:border-slate-600 rounded px-1 bg-white dark:bg-slate-800">Shift</kbd> + Mouse scroll</span>
            </div>
        `;
        
        this.container.appendChild(footer);

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
        // CHANGE: Agregado 'select-none' a la fila
        tr.className = "hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-slate-700 group select-none";
        
        this.columns.forEach((col, colIdx) => {
            const td = document.createElement('td');
            td.dataset.r = idx; 
            td.dataset.c = colIdx;
            td.dataset.val = row[col.field] || '';

            let cls = "px-3 py-1.5 whitespace-nowrap border-r border-slate-100 dark:border-slate-700 cursor-default text-xs ";
            if(col.hozAlign === 'right') cls += "text-right font-mono "; else cls += "text-left ";

            // UX STICKY: Fijar celda a la izquierda
            if (col.formatter === 'checkbox') {
                // z-10 para estar sobre el scroll normal, pero bajo el header (z-20/30)
                // IMPORTANTE: bg-white/dark:bg-slate-800 es necesario para que el texto no se vea "a través" de la celda al hacer scroll
                cls += "sticky left-0 z-10 bg-white dark:bg-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ";
            }

            if(col.field === 'diff') {
                const val = parseFloat(row[col.field]);
                
                // LEER OPCIÓN: Si no existe, default 2000. Si existe (incluso 0), usarla.
                const optThresh = this.options.threshold;
                const threshold = (optThresh !== undefined && optThresh !== null) ? optThresh : 2000;
                
                // LÓGICA DE COLOR (Usando valor absoluto)
                // Si la diferencia (positiva o negativa) es mayor al umbral -> ROJO
                if(Math.abs(val) > threshold) {
                    cls += "text-red-600 font-bold bg-red-50 dark:bg-red-900/10 ";
                } 
                // Si es exactamente 0 -> VERDE
                else if(val === 0) {
                    cls += "text-green-600 font-bold ";
                }
                // Si está dentro del umbral (ej: diferencia de 5 colones) -> NEUTRO
            }

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
                    getRow: () => row, // Permitir acceso a toda la fila
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
            
            // CHANGE: Listener para el botón Limpiar
            const clearBtn = e.target.closest('#btn-clear-filters');
            if(clearBtn) {
                this.clearAllFilters();
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
                
                // Estrategia Doble: Buscar en el valor Crudo Y en el Formateado
                // Esto permite encontrar "2000" (raw) y "2.000" (formatted)
                let matchTargets = [String(rawVal || '').toLowerCase()];

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
            cell.scrollIntoView({block:'nearest', inline:'nearest'});
            this.container.querySelectorAll('.outline-2').forEach(e => e.classList.remove('outline-2', 'outline-blue-600', 'outline'));
            cell.classList.add('outline', 'outline-2', 'outline-blue-600', '-outline-offset-2'); // Outline nativo para mejor performance
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
        
        // Actualizar UI
        const bar = document.getElementById('global-table-stats');
        if(bar) {
            if(this.selection.size < 2) {
                bar.classList.add('hidden');
            } else {
                document.getElementById('gst-count').innerText = this.selection.size;
                // Formato final siempre es CR (coma para decimales)
                document.getElementById('gst-sum').innerText = this.formatMoney(sum);
                bar.classList.remove('hidden');
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
            <button class="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700" id="ctx-filter">🔍 Filtrar por esto</button>
            <button class="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-700" id="ctx-copy">📋 Copiar valor</button>
        `;
        document.body.appendChild(menu);
        
        document.getElementById('ctx-filter').onclick = () => {
            this.filters[field] = val.toLowerCase();
            this.applyFilters();
            menu.remove();
        };
        document.getElementById('ctx-copy').onclick = () => { navigator.clipboard.writeText(val); menu.remove(); };
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

        if (num < 0) {
            return `<span class="text-red-600 font-bold">-${formatted}</span>`;
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

}