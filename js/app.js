import { db, usaFirebase } from './firebase.js';
import { CustomDialog, formatearMoneda, comprimirImagen, inicializarMenu } from './ui.js';

// ==========================================
// 1. ESTADO GLOBAL
// ==========================================
let productos = JSON.parse(localStorage.getItem('productos')) || [];
let transacciones = JSON.parse(localStorage.getItem('transacciones')) || [];
let formulasGuardadas = JSON.parse(localStorage.getItem('formulasGuardadas')) || [];
let filtroBusqueda = "";
let numColumnas = 3;

// ==========================================
// 2. INICIALIZACIÓN PRINCIPAL (Al cargar la página)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    inicializarMenu();
    
    // Indicador UI Firebase
    const dbStatus = document.getElementById('db-status');
    if (usaFirebase) {
        dbStatus.innerHTML = '🟢 Aún sirve 😎🤙';
        dbStatus.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800';
    } else {
        dbStatus.innerHTML = '🔴 Modo Local';
        dbStatus.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800';
    }

    // Inicializar Columnas
    numColumnas = window.innerWidth >= 1024 ? 3 : (window.innerWidth >= 640 ? 2 : 1);
    window.cambiarColumnas(numColumnas);

    // Cargar Datos (Firebase o LocalStorage)
    if (usaFirebase) {
        db.collection("productos").onSnapshot((snap) => {
            productos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            actualizarSelectorProductos(); 
            renderizarInventario(); 
            renderizarCatalogoAdmin();
        });
        db.collection("transacciones").orderBy("fecha", "desc").onSnapshot((snap) => {
            transacciones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarTransacciones(); 
        });
        db.collection("calculadora_precios").orderBy("fecha", "desc").onSnapshot((snap) => {
            formulasGuardadas = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderizarFormulas();
        });
    } else {
        actualizarSelectorProductos(); 
        renderizarTransacciones(); 
        renderizarFormulas(); 
        renderizarInventario(); 
        renderizarCatalogoAdmin();
    }
});

// ==========================================
// 3. MÓDULO: FÓRMULAS
// ==========================================
function calcularValoresDinamicos() {
    const mat = parseFloat(document.getElementById('calc-materiales').value) || 0;
    const emp = parseFloat(document.getElementById('calc-empaque').value) || 0;
    const hr = parseFloat(document.getElementById('calc-horas').value) || 0;
    const ph = parseFloat(document.getElementById('calc-precio-hora').value) || 0;
    const ho = parseFloat(document.getElementById('calc-horno').value) || 0;
    const ga = parseFloat(document.getElementById('calc-ganancia').value) || 0;
    const cBase = mat + emp + (hr * ph) + ho;
    const pVenta = cBase * (1 + (ga / 100));
    document.getElementById('res-costo-base').textContent = formatearMoneda(cBase);
    document.getElementById('res-precio-venta').textContent = formatearMoneda(pVenta);
    return { cBase, pVenta };
}

document.querySelectorAll('.calc-input').forEach(i => i.addEventListener('input', calcularValoresDinamicos));

document.getElementById('form-calculadora').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = calcularValoresDinamicos();
    const nf = {
        nombre: document.getElementById('calc-nombre').value,
        materiales: parseFloat(document.getElementById('calc-materiales').value) || 0,
        empaque: parseFloat(document.getElementById('calc-empaque').value) || 0,
        horasManoDeObra: parseFloat(document.getElementById('calc-horas').value) || 0,
        precioPorHora: parseFloat(document.getElementById('calc-precio-hora').value) || 0,
        gastoHorno: parseFloat(document.getElementById('calc-horno').value) || 0,
        porcentajeGanancia: parseFloat(document.getElementById('calc-ganancia').value) || 0,
        costoBase: res.cBase, 
        precioVentaFinal: res.pVenta, 
        fecha: new Date().toISOString()
    };
    if (usaFirebase) {
        try { 
            await db.collection("calculadora_precios").add(nf); 
            document.getElementById('form-calculadora').reset(); 
            calcularValoresDinamicos(); 
        } catch (error) { 
            CustomDialog.alert('Error al guardar.', 'Error', 'error'); 
        }
    } else {
        formulasGuardadas.unshift({ id: Date.now().toString(), ...nf }); 
        localStorage.setItem('formulasGuardadas', JSON.stringify(formulasGuardadas));
        document.getElementById('form-calculadora').reset(); 
        calcularValoresDinamicos(); 
        renderizarFormulas();
    }
});

window.borrarFormula = async function(id) {
    const proceder = await CustomDialog.confirm("¿Eliminar permanentemente?", "Eliminar", "danger", "Sí, borrar");
    if (proceder) {
        if (usaFirebase) { 
            try { await db.collection("calculadora_precios").doc(id).delete(); } catch(e){} 
        } else { 
            formulasGuardadas = formulasGuardadas.filter(f => f.id !== id); 
            localStorage.setItem('formulasGuardadas', JSON.stringify(formulasGuardadas)); 
            renderizarFormulas(); 
        }
    }
};

function renderizarFormulas() {
    const c = document.getElementById('lista-formulas'); c.innerHTML = '';
    formulasGuardadas.forEach(f => {
        c.innerHTML += `
            <div class="bg-white p-4 rounded-xl border shadow-sm">
                <div class="flex justify-between items-start mb-3"><p class="font-bold text-sm truncate">${f.nombre}</p><button onclick="borrarFormula('${f.id}')" class="text-slate-300 hover:text-rose-500">✖</button></div>
                <div class="text-xs space-y-1"><div class="flex justify-between"><span class="text-slate-500">Costo:</span><span>${formatearMoneda(f.costoBase)}</span></div>
                <div class="flex justify-between font-bold border-t pt-2"><span class="text-slate-500">Venta:</span><span class="text-brand-600">${formatearMoneda(f.precioVentaFinal)}</span></div></div>
            </div>`;
    });
}

// ==========================================
// 4. MÓDULO: INVENTARIO Y BÚSQUEDA
// ==========================================

// Variable Global Expuesta (Porque se llama en el onclick de HTML)
window.cambiarColumnas = function(n) {
    numColumnas = n;
    document.querySelectorAll('.btn-col').forEach(btn => {
        btn.className = parseInt(btn.dataset.cols) === n ? "btn-col px-3 py-1 rounded border border-brand-500 bg-brand-50 text-brand-700 font-bold" : "btn-col px-3 py-1 rounded border bg-slate-50 text-slate-600";
    });
    const cls = {
        1: "grid grid-cols-1 gap-4 mb-8", 
        2: "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8", 
        3: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8", 
        4: "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8"
    };
    document.getElementById('lista-inventario-productos').className = cls[n]; 
    document.getElementById('lista-inventario-materiales').className = cls[n];
};

document.getElementById('buscador-inventario').addEventListener('input', (e) => {
    filtroBusqueda = e.target.value.toLowerCase(); 
    renderizarInventario();
});

const contProdVenta = document.getElementById('contenedor-prod-venta');
const inputProdVenta = document.getElementById('prod-venta');

document.getElementById('prod-categoria').addEventListener('change', (e) => {
    if (e.target.value === 'material') { 
        contProdVenta.classList.add('hidden'); 
        inputProdVenta.removeAttribute('required'); 
        inputProdVenta.value = '0'; 
    } else { 
        contProdVenta.classList.remove('hidden'); 
        inputProdVenta.setAttribute('required', 'required'); 
        inputProdVenta.value = ''; 
    }
});

document.getElementById('form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // --- LÓGICA MÚLTIPLES IMÁGENES AL CREAR ---
    const fileInput = document.getElementById('prod-imagen');
    let arregloImagenes = []; 
    
    if (fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const imgBase64 = await comprimirImagen(fileInput.files[i]);
            if (imgBase64) arregloImagenes.push(imgBase64); 
        }
    }

    const nuevo = {
        nombre: document.getElementById('prod-nombre').value.trim(),
        categoria: document.getElementById('prod-categoria').value,
        costo: parseFloat(document.getElementById('prod-costo').value),
        venta: parseFloat(document.getElementById('prod-venta').value) || 0,
        stock: parseInt(document.getElementById('prod-stock').value) || 0,
        imagenes: arregloImagenes, 
        publico: false 
    };

    if (usaFirebase) { 
        await db.collection("productos").add(nuevo); 
    } else { 
        productos.push({ id: Date.now().toString(), ...nuevo }); 
        localStorage.setItem('productos', JSON.stringify(productos)); 
        actualizarSelectorProductos(); 
        renderizarInventario(); 
        renderizarCatalogoAdmin(); 
    }
    
    document.getElementById('form-producto').reset();
    contProdVenta.classList.remove('hidden'); 
    inputProdVenta.setAttribute('required', 'required');
});

function renderizarInventario() {
    const cp = document.getElementById('lista-inventario-productos');
    const cm = document.getElementById('lista-inventario-materiales');
    cp.innerHTML = ''; cm.innerHTML = '';
    
    const pf = [...productos].filter(p => p.nombre.toLowerCase().includes(filtroBusqueda)).sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    pf.forEach(p => {
        const cat = p.categoria || 'producto';
        let cl = p.stock <= 0 ? 'text-rose-600 bg-rose-50' : (p.stock < 5 ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'); 
        let ip = cat === 'producto' ? `<p class="text-[11px] text-slate-500 mt-1">Venta: <span class="font-semibold">${formatearMoneda(p.venta)}</span></p><p class="text-[11px] text-slate-400">Costo: ${formatearMoneda(p.costo)}</p>` : `<p class="text-[11px] text-slate-500 mt-1">Costo: <span class="font-semibold">${formatearMoneda(p.costo)}</span></p>`;
        
        // Uso la primera imagen del arreglo si existe, sino el fallback normal
        let imagenPrincipal = (p.imagenes && p.imagenes.length > 0) ? p.imagenes[0] : (p.imagen || null);
        let ih = imagenPrincipal ? `<img src="${imagenPrincipal}" class="w-full h-full object-cover">` : `<span class="text-xl">${cat === 'producto' ? '🛍️' : '🛠️'}</span>`;
        
        const div = document.createElement('div'); div.className = "bg-white p-3 rounded-xl border flex shadow-sm gap-3 items-start";
        div.innerHTML = `<div class="h-14 w-14 rounded-lg bg-slate-100 border flex items-center justify-center mt-1 flex-shrink-0">${ih}</div>
            <div class="flex-1 min-w-0"><p class="text-sm font-bold break-words leading-tight">${p.nombre}</p>${ip}</div>
            <div class="${cl} px-2 py-1.5 rounded-lg text-center min-w-[3rem] self-center"><p class="text-lg font-black leading-none">${p.stock}</p><p class="text-[10px] uppercase font-bold mt-1">Unds</p></div>`;
        cat === 'producto' ? cp.appendChild(div) : cm.appendChild(div);
    });
}

// ----------------------------------------------------
// 5. EDICIÓN Y STOCK
// ----------------------------------------------------
document.getElementById('form-actualizar-stock').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('stock-producto-select').value;
    const cant = parseInt(document.getElementById('stock-cantidad-add').value);
    const p = productos.find(x => x.id === id);
    if (p) {
        const ns = (p.stock || 0) + cant;
        if (usaFirebase) { await db.collection("productos").doc(id).update({ stock: ns }); } 
        else { p.stock = ns; localStorage.setItem('productos', JSON.stringify(productos)); renderizarInventario(); }
        document.getElementById('form-actualizar-stock').reset();
    }
});

// Referencias para Edición de Ítem (Declaradas globalmente para el DOMContentLoaded)
const selectEditarProducto = document.getElementById('editar-producto-select');
const inputEditarNombre = document.getElementById('editar-nombre');
const inputEditarCosto = document.getElementById('editar-costo');
const inputEditarVenta = document.getElementById('editar-venta');
const contEditarVenta = document.getElementById('contenedor-editar-venta');

selectEditarProducto.addEventListener('change', (e) => {
    const p = productos.find(x => x.id === e.target.value);
    if(p) { 
        inputEditarNombre.value = p.nombre; 
        inputEditarCosto.value = p.costo; 
        if (p.categoria === 'material') {
            contEditarVenta.classList.add('hidden');
            inputEditarVenta.removeAttribute('required');
            inputEditarVenta.value = '0';
        } else {
            contEditarVenta.classList.remove('hidden');
            inputEditarVenta.setAttribute('required', 'required');
            inputEditarVenta.value = p.venta || 0;
        }
    } else {
        inputEditarNombre.value = ''; inputEditarCosto.value = ''; inputEditarVenta.value = '';
    }
});

document.getElementById('form-editar-precios').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodId = selectEditarProducto.value;
    const nuevoNombre = inputEditarNombre.value.trim();
    const nuevoCosto = parseFloat(inputEditarCosto.value);
    const nuevaVenta = parseFloat(inputEditarVenta.value) || 0;

    if (!prodId || !nuevoNombre || isNaN(nuevoCosto)) return;

    const datosActualizados = { nombre: nuevoNombre, costo: nuevoCosto, venta: nuevaVenta };

    // --- LÓGICA MÚLTIPLES IMÁGENES AL EDITAR ---
    const fileInput = document.getElementById('editar-imagen');
    if (fileInput.files.length > 0) {
        let arregloImagenes = [];
        for (let i = 0; i < fileInput.files.length; i++) {
            const imgBase64 = await comprimirImagen(fileInput.files[i]);
            if (imgBase64) arregloImagenes.push(imgBase64);
        }
        datosActualizados.imagenes = arregloImagenes; 
    }

    if (usaFirebase) {
        try { 
            await db.collection("productos").doc(prodId).update(datosActualizados); 
        } catch (error) { 
            CustomDialog.alert("Error al actualizar ítem.", "Error", "error"); 
        }
    } else {
        const i = productos.findIndex(p => p.id === prodId);
        if (i > -1) {
            productos[i] = { ...productos[i], ...datosActualizados }; 
            localStorage.setItem('productos', JSON.stringify(productos));
            actualizarSelectorProductos(); 
            renderizarInventario(); 
            renderizarCatalogoAdmin();
        }
    }
    
    document.getElementById('form-editar-precios').reset();
    contEditarVenta.classList.remove('hidden'); 
    inputEditarVenta.setAttribute('required', 'required');
});


// ==========================================
// 6. MÓDULO: CATÁLOGO Y TRANSACCIONES
// ==========================================

// Expuesto globalmente para el botón del catálogo
window.toggleCatalogo = async function(id, st) {
    if (usaFirebase) { await db.collection("productos").doc(id).update({ publico: !st }); } 
    else { const i = productos.findIndex(p => p.id === id); if(i>-1) { productos[i].publico = !st; localStorage.setItem('productos', JSON.stringify(productos)); renderizarCatalogoAdmin(); } }
};

function renderizarCatalogoAdmin() {
    const c = document.getElementById('lista-admin-catalogo'); c.innerHTML = '';
    const ts = productos.filter(p => (p.categoria || 'producto') === 'producto').sort((a,b)=>a.nombre.localeCompare(b.nombre));
    ts.forEach(p => {
        let imagenPrincipal = (p.imagenes && p.imagenes.length > 0) ? p.imagenes[0] : (p.imagen || null);
        const ih = imagenPrincipal ? `<img src="${imagenPrincipal}" class="w-full h-full object-cover">` : `<span class="text-xl">🛍️</span>`;
        const div = document.createElement('div'); div.className = `bg-white p-4 rounded-xl border ${p.publico ? 'border-brand-300 ring-1 ring-brand-100' : ''} flex flex-col justify-between shadow-sm`;
        div.innerHTML = `<div class="flex items-start gap-3 mb-4"><div class="h-16 w-16 rounded-lg bg-slate-100 border flex items-center justify-center flex-shrink-0">${ih}</div>
            <div class="flex-1 min-w-0"><p class="text-sm font-bold break-words leading-tight">${p.nombre}</p><p class="text-xs text-brand-600 font-semibold mt-1">${formatearMoneda(p.venta)}</p></div></div>
            <button onclick="toggleCatalogo('${p.id}', ${p.publico})" class="w-full py-2 rounded-lg text-xs font-bold ${p.publico ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}">${p.publico ? '✅ Visible' : '👁️ Oculto'}</button>`;
        c.appendChild(div);
    });
}

function actualizarSelectorProductos() {
    const s = [document.getElementById('trans-producto'), document.getElementById('stock-producto-select'), document.getElementById('editar-producto-select')];
    s.forEach(x => x.innerHTML = '<option value="">-- Selecciona un ítem --</option>');
    productos.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(pr => {
        s[0].innerHTML += `<option value="${pr.id}">${pr.nombre} (Stock: ${pr.stock || 0})</option>`;
        s[1].innerHTML += `<option value="${pr.id}">${pr.nombre}</option>`; 
        s[2].innerHTML += `<option value="${pr.id}">${pr.nombre}</option>`;
    });
}

// ----------------------------------------------------
// REGISTRO DE TRANSACCIONES
// ----------------------------------------------------
const selectProductos = document.getElementById('trans-producto');
const inputMonto = document.getElementById('trans-monto');
const inputCantidad = document.getElementById('trans-cantidad');
const selectTipo = document.getElementById('trans-tipo');
const avisoStock = document.getElementById('aviso-stock');

function verificarStock() {
    const prodId = selectProductos.value; const cant = parseInt(inputCantidad.value) || 1; const tipo = selectTipo.value;
    avisoStock.classList.add('hidden'); 
    if (!prodId) { inputMonto.value = ''; return; }
    const pr = productos.find(p => p.id === prodId);
    if (pr) {
        inputMonto.value = ((tipo === 'venta' ? parseFloat(pr.venta) : parseFloat(pr.costo)) * cant).toFixed(2);
        if (tipo === 'venta' && (pr.stock || 0) < cant) avisoStock.classList.remove('hidden');
    }
}

selectProductos.addEventListener('change', verificarStock); 
inputCantidad.addEventListener('input', verificarStock); 
selectTipo.addEventListener('change', verificarStock);

document.getElementById('form-transaccion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pr = productos.find(p => p.id === document.getElementById('trans-producto').value);
    const cant = parseInt(document.getElementById('trans-cantidad').value);
    const tipo = document.getElementById('trans-tipo').value;
    
    if (tipo === 'venta' && pr && (pr.stock || 0) < cant) { 
        if (!await CustomDialog.confirm(`Stock insuficiente. ¿Registrar salida?`, "⚠️ Inventario", "warning", "Sí")) return; 
    }
    
    const n = { fecha: new Date().toISOString(), tipo, detalle: pr ? pr.nombre : 'Gasto', cantidad: cant, monto: parseFloat(document.getElementById('trans-monto').value), costoUnidadAsociado: pr ? pr.costo : 0 };
    
    if (usaFirebase) {
        const batch = db.batch(); batch.set(db.collection("transacciones").doc(), n);
        if (pr) batch.update(db.collection("productos").doc(pr.id), { stock: (pr.stock || 0) + (tipo === 'venta' ? -cant : cant) });
        await batch.commit();
    }
    document.getElementById('form-transaccion').reset();
    inputCantidad.value = 1;
    avisoStock.classList.add('hidden');
});

document.getElementById('form-ocasional').addEventListener('submit', async (e) => {
    e.preventDefault();
    const n = { fecha: new Date().toISOString(), tipo: document.getElementById('oca-tipo').value, detalle: document.getElementById('oca-detalle').value, cantidad: 1, monto: parseFloat(document.getElementById('oca-monto').value), costoUnidadAsociado: 0 };
    if(usaFirebase){ await db.collection("transacciones").add(n); }
    document.getElementById('form-ocasional').reset();
});

// Render global finanzas y reportes
function renderizarTransacciones() {
    const tr = transacciones, sF = document.getElementById('filtro-mes').value;
    let inG=0, egG=0, cmG=0, inR=0, egR=0, cmR=0;
    const bd = document.getElementById('tabla-cuerpo'), bdr = document.getElementById('tabla-cuerpo-reportes'); bd.innerHTML=''; bdr.innerHTML='';
    
    tr.forEach(t => {
        const fDate = `${new Date(t.fecha).getFullYear()}-${String(new Date(t.fecha).getMonth() + 1).padStart(2, '0')}`;
        const esIn = (t.tipo === 'venta' || t.tipo === 'ingreso_ocasional'), m = formatearMoneda(t.monto);
        const trH = `<tr class="hover:bg-slate-50"><td class="px-6 py-4 text-slate-500">${new Date(t.fecha).toLocaleDateString()}</td><td class="px-6 py-4 font-medium">${t.detalle}</td><td class="px-6 py-4">${t.tipo}</td><td class="px-6 py-4">${t.cantidad}</td><td class="px-6 py-4 font-bold text-right">${m}</td></tr>`;
        
        if(esIn){ inG+=t.monto; if(t.tipo==='venta') cmG += (t.costoUnidadAsociado||0)*(t.cantidad||1); } else { egG+=t.monto; }
        bd.innerHTML += trH;

        if(sF === 'todos' || sF === fDate) {
            if(esIn){ inR+=t.monto; if(t.tipo==='venta') cmR += (t.costoUnidadAsociado||0)*(t.cantidad||1); } else { egR+=t.monto; }
            bdr.innerHTML += trH;
        }
    });

    document.getElementById('metric-ingresos').textContent = formatearMoneda(inG); 
    document.getElementById('metric-egresos').textContent = formatearMoneda(egG+cmG); 
    document.getElementById('metric-utilidad').textContent = formatearMoneda(inG-cmG-egG);
    document.getElementById('rep-metric-ingresos').textContent = formatearMoneda(inR); 
    document.getElementById('rep-metric-egresos').textContent = formatearMoneda(egR+cmR); 
    document.getElementById('rep-metric-utilidad').textContent = formatearMoneda(inR-cmR-egR);
}
document.getElementById('filtro-mes').addEventListener('change', renderizarTransacciones);