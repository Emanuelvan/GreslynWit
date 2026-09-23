export const CustomDialog = {
    show: function(options) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-modal');
            const btnCancel = document.getElementById('modal-cancel');
            const btnConfirm = document.getElementById('modal-confirm');

            modal.classList.remove('hidden');
            btnCancel.classList.add('hidden');
            
            document.getElementById('modal-title').textContent = options.title || 'Mensaje';
            document.getElementById('modal-message').innerHTML = options.message || '';
            btnConfirm.textContent = options.confirmText || 'Aceptar';
            btnConfirm.className = `inline-flex w-full justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm sm:w-auto transition-colors ${options.confirmBg || 'bg-brand-600 hover:bg-brand-700'}`;

            if (options.type === 'confirm') {
                btnCancel.classList.remove('hidden');
                btnCancel.textContent = options.cancelText || 'No, cancelar';
            }

            const cleanup = () => { modal.classList.add('hidden'); btnConfirm.onclick = null; btnCancel.onclick = null; };
            btnConfirm.onclick = () => { cleanup(); resolve(true); };
            btnCancel.onclick = () => { cleanup(); resolve(false); };
        });
    },
    alert: function(message, title = 'Información', type = 'info') {
        let bg = 'bg-brand-600 hover:bg-brand-700'; if(type === 'error') bg = 'bg-rose-600 hover:bg-rose-700';
        return this.show({ type: 'alert', message, title, confirmBg: bg });
    },
    confirm: function(message, title = 'Confirmar', type = 'warning', confirmText = 'Sí, aceptar') {
        let bg = 'bg-brand-600 hover:bg-brand-700'; if(type === 'danger') bg = 'bg-rose-600 hover:bg-rose-700';
        return this.show({ type: 'confirm', message, title, confirmText, confirmBg: bg });
    }
};

export function formatearMoneda(valor) {
    let numero = Number(valor); if (isNaN(numero)) return "$0";
    let partes = numero.toFixed(2).split(".");
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (partes[1] === "00") ? "$" + partes[0] : "$" + partes[0] + "," + partes[1];
}

function comprimirImagen(file) {
    return new Promise((resolve) => {
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image(); img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // ¡CAMBIO CLAVE! Aumentamos el tamaño máximo a 1080px para máxima nitidez
                const MAX_WIDTH = 1080, MAX_HEIGHT = 1080;
                let width = img.width, height = img.height;

                if (width > height) { 
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } 
                } else { 
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } 
                }
                
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                // Aumentamos la calidad JPG al 90% (0.9)
                resolve(canvas.toDataURL('image/jpeg', 0.9)); 
            };
        };
    });
}

export function inicializarMenu() {
    window.cambiarVista = function(idVista) {
        document.querySelectorAll('.vista-seccion').forEach(v => v.classList.add('hidden'));
        document.getElementById(idVista).classList.remove('hidden');
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.replace('text-brand-600', 'text-slate-500') || btn.classList.remove('border-b-2', 'border-brand-600'));
        const btn = document.querySelector(`button[onclick="cambiarVista('${idVista}')"].nav-btn`);
        if (btn) { btn.classList.replace('text-slate-500', 'text-brand-600'); btn.classList.add('border-b-2', 'border-brand-600'); }
        document.getElementById('menu-mobile').classList.add('hidden');
    };
    document.getElementById('btn-menu-mobile').addEventListener('click', () => {
        document.getElementById('menu-mobile').classList.toggle('hidden');
    });
}