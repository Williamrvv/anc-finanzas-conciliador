window.SysUI = {
    _createModal: function(title, html, buttons, type="info") {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 select-none';
            
            let icon = '';
            let titleColor = 'text-slate-800 dark:text-white';
            if(type === 'warning') { icon = '⚠️ '; titleColor = 'text-amber-600 dark:text-amber-400'; }
            if(type === 'error') { icon = '⛔ '; titleColor = 'text-red-600 dark:text-red-400'; }
            if(type === 'success') { icon = '✅ '; titleColor = 'text-green-600 dark:text-green-400'; }

            const box = document.createElement('div');
            box.className = 'bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md overflow-hidden transform scale-95 transition-transform duration-300';
            
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
    }
};