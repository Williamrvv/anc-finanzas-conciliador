window.SysUI = {
    _createModal: function(title, html, buttons, type="info", widthClass="max-w-md") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 select-none';
            
            let icon = '';
            let titleColor = 'text-slate-800 dark:text-white';
            if(type === 'warning') { icon = '⚠️ '; titleColor = 'text-amber-600 dark:text-amber-400'; }
            if(type === 'error') { icon = '⛔ '; titleColor = 'text-red-600 dark:text-red-400'; }
            if(type === 'success') { icon = '✅ '; titleColor = 'text-green-600 dark:text-green-400'; }

            const box = document.createElement('div');
            box.className = `bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full ${widthClass} overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col max-h-[95vh]`;
            
            let btnsHtml = buttons.map((b, i) => `<button id="sysui-btn-${i}" class="${b.class}">${b.text}</button>`).join('');
            
            box.innerHTML = `
                <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <h3 class="text-lg font-bold ${titleColor}">${icon}${title}</h3>
                </div>
                <div class="px-6 py-5 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                    ${html}
                </div>
                <div class="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                    ${btnsHtml}
                </div>
            `;
            
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            
            // Animación de entrada
            requestAnimationFrame(() => {
                overlay.classList.remove('opacity-0');
                box.classList.remove('scale-95');
            });
            
            // Autofocus si es Prompt
            const input = box.querySelector('input');
            if(input) setTimeout(() => input.focus(), 100);

            const close = (val) => {
                overlay.classList.add('opacity-0');
                box.classList.add('scale-95');
                setTimeout(() => { overlay.remove(); resolve(val); }, 300);
            };

            buttons.forEach((b, i) => {
                box.querySelector(`#sysui-btn-${i}`).onclick = () => {
                    if(b.isPrompt) {
                        const val = input ? input.value.trim() : '';
                        if(!val && !b.allowEmpty) {
                            input.classList.add('ring-2', 'ring-red-500');
                            return input.focus();
                        }
                        close(val);
                    } else if (b.requireCheckId) {
                        // Validación de Checkbox Obligatorio
                        const chk = box.querySelector(`#${b.requireCheckId}`);
                        if (chk && !chk.checked) {
                            const err = box.querySelector(`#${b.requireCheckId}-error`);
                            if(err) err.classList.remove('hidden');
                            
                            // Efecto de error visual en el contenedor
                            const container = chk.closest('label');
                            if (container) {
                                container.classList.add('border-red-400', 'bg-red-50', 'dark:bg-red-900/30');
                                setTimeout(() => container.classList.remove('border-red-400', 'bg-red-50', 'dark:bg-red-900/30'), 1500);
                            }
                            return; // Detiene el cierre del modal
                        }
                        close(b.value);
                    } else {
                        close(b.value);
                    }
                };
            });
        });
    },
    alert: function(msg, title="Aviso", type="info") {
        return this._createModal(title, msg, [{text: 'Aceptar', value: true, class: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors'}], type);
    },
    confirm: function(msg, title="Confirmar Acción", type="warning") {
        const acceptColor = type === 'warning' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
        return this._createModal(title, msg, [
            {text: 'Cancelar', value: false, class: 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Aceptar', value: true, class: `${acceptColor} text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors`}
        ], type);
    },
    prompt: function(msg, title="Ingresar dato", defaultVal="") {
        const html = `<div class="mb-3 text-sm font-medium">${msg}</div><input type="text" class="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono" value="${defaultVal}" autocomplete="off">`;
        return this._createModal(title, html, [
            {text: 'Cancelar', value: null, class: 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Guardar', isPrompt: true, allowEmpty: false, class: 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-sm transition-colors'}
        ], "info");
    },
    
    // Nuevo Modal Exclusivo con Checkbox Obligatorio
    confirmCierre: function(msg, title="Confirmar Cierre") {
        const html = `<div><span class="block mb-5 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">${msg}</span><div class="border-t border-slate-200 dark:border-slate-700 pt-5"><label class="flex items-start gap-3 p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer transition-colors group select-none relative overflow-hidden"><div class="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div><div class="relative flex items-center justify-center shrink-0 mt-0.5 ml-2"><input type="checkbox" id="chk-datafono" class="peer appearance-none w-5 h-5 border-2 border-slate-300 dark:border-slate-500 rounded-md checked:bg-indigo-600 checked:border-indigo-600 transition-all cursor-pointer"><svg class="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg></div><div class="flex flex-col"><span class="text-sm font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Cierre de Datáfono Confirmado</span><span class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Declaro que ya ejecuté el proceso de cierre físico en la terminal POS.</span></div></label><div id="chk-datafono-error" class="hidden mt-3 text-xs font-bold text-red-500 animate-shake flex items-center gap-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>Debe marcar la casilla obligatoria para continuar.</div></div></div>`;

        return this._createModal(title, html, [
            {text: 'Cancelar', value: false, class: 'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-colors'},
            {text: 'Guardar Cierre', value: true, requireCheckId: 'chk-datafono', class: 'bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors'}
        ], "info");
    },

    // ==========================================
    // PANTALLA DE CARGA (LANDING OVERLAY)
    // ==========================================
    showLoading: function(msg = "Procesando...") {
        if(document.getElementById('sysui-loading')) return;
        const overlay = document.createElement('div');
        overlay.id = 'sysui-loading';
        overlay.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[999999] flex flex-col items-center justify-center p-4 opacity-0 transition-opacity duration-300 select-none';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full transform scale-95 transition-transform duration-300 border border-slate-200 dark:border-slate-700" id="sysui-loading-box">
                <div class="relative w-20 h-20 mb-6">
                    <div class="absolute inset-0 border-4 border-slate-100 dark:border-slate-700 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">✉️</div>
                </div>
                <h3 class="text-xl font-black text-slate-800 dark:text-white mb-2 text-center">${msg}</h3>
                <p class="text-sm text-slate-500 text-center font-medium">Por favor espere, no cierre esta ventana.</p>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            document.getElementById('sysui-loading-box').classList.remove('scale-95');
        });
    },

    hideLoading: function() {
        const overlay = document.getElementById('sysui-loading');
        if(overlay) {
            overlay.classList.add('opacity-0');
            document.getElementById('sysui-loading-box').classList.add('scale-95');
            setTimeout(() => overlay.remove(), 300);
        }
    }
};