/* Pantalla del cargador de pedidos. Habla con el robot que corre en este PC. */
'use strict';

const $ = (id) => document.getElementById(id);

let idLote = null;
let lote = null;
// clave -> { prodId, albumIndex }. Solo lo que la persona cambio a mano.
const decisiones = {};

// ── Estado del robot ─────────────────────────────────────────────────────
async function comprobarRobot() {
  const pill = $('estadoRobot');
  try {
    const r = await fetch('/health');
    const d = await r.json();
    if (d.photoService) {
      pill.textContent = 'robot listo';
      pill.className = 'pill ok';
    } else {
      pill.textContent = 'el motor de fotos no arrancó';
      pill.className = 'pill mal';
    }
  } catch {
    pill.textContent = 'robot apagado';
    pill.className = 'pill mal';
  }
}

// ── Paso 1: subir ────────────────────────────────────────────────────────
const zona = $('zonaSoltar');
zona.addEventListener('click', () => $('archivo').click());
$('btnElegir').addEventListener('click', (e) => { e.stopPropagation(); $('archivo').click(); });
$('archivo').addEventListener('change', (e) => { if (e.target.files[0]) subir(e.target.files[0]); });

['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => {
  e.preventDefault(); zona.classList.add('encima');
}));
['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => {
  e.preventDefault(); zona.classList.remove('encima');
}));
zona.addEventListener('drop', (e) => {
  const archivo = e.dataTransfer.files[0];
  if (archivo) subir(archivo);
});

async function subir(archivo) {
  if (!archivo.name.toLowerCase().endsWith('.xlsx')) {
    alert('Tiene que ser un archivo .xlsx');
    return;
  }
  const base64 = await new Promise((resolver) => {
    const lector = new FileReader();
    lector.onload = () => resolver(lector.result.split(',')[1]);
    lector.readAsDataURL(archivo);
  });

  mostrarPaso('pasoTrabajando');
  $('tituloTrabajando').textContent = 'Leyendo el archivo…';

  const r = await fetch('/api/lote/analizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombreArchivo: archivo.name, xlsxBase64: base64 }),
  });
  const d = await r.json();
  if (!r.ok) { mostrarError(d.error); return; }
  idLote = d.id;
  seguirLote();
}

function mostrarPaso(cual) {
  ['pasoSubir', 'pasoTrabajando', 'pasoRevisar', 'pasoResultado']
    .forEach((p) => $(p).classList.toggle('oculto', p !== cual));
  // La caja de corregir solo estorba mientras se carga un pedido.
  $('pasoSubir2').classList.toggle('oculto', cual !== 'pasoSubir');
}

function mostrarError(mensaje) {
  mostrarPaso('pasoResultado');
  $('tituloResultado').textContent = 'Algo falló';
  $('detalleResultado').innerHTML = `<div class="error">${escapar(mensaje)}</div>`;
}

// ── Seguimiento ──────────────────────────────────────────────────────────
async function seguirLote() {
  const r = await fetch(`/api/lote/${idLote}`);
  if (!r.ok) { mostrarError('se perdió el lote; vuelve a subir el archivo'); return; }
  lote = await r.json();

  if (lote.estado === 'error') { mostrarError(lote.error); return; }

  if (['leyendo', 'comparando', 'buscando'].includes(lote.estado)) {
    $('tituloTrabajando').textContent = {
      leyendo: 'Leyendo el archivo y sacando las fotos…',
      comparando: 'Revisando si ya las tienes en el catálogo…',
      buscando: 'Buscando las camisetas en el proveedor…',
    }[lote.estado];
    pintarProgreso();
    return setTimeout(seguirLote, 1200);
  }

  if (lote.estado === 'cargando') {
    mostrarPaso('pasoTrabajando');
    $('tituloTrabajando').textContent = 'Guardando en el catálogo…';
    pintarProgreso();
    return setTimeout(seguirLote, 1000);
  }

  if (lote.estado === 'cargado') return pintarResultado();
  if (lote.estado === 'listo') return pintarRevision();
  return setTimeout(seguirLote, 1200);
}

function pintarProgreso() {
  mostrarPaso('pasoTrabajando');
  const { hechas = 0, total = 0, actual } = lote.progreso || {};
  $('barraRelleno').style.width = total ? `${(hechas / total) * 100}%` : '0%';
  $('textoProgreso').textContent = total
    ? `${hechas} de ${total}${actual ? ` — ${actual}` : ''}`
    : 'preparando…';
}

// ── Paso 3: revisar ──────────────────────────────────────────────────────
function decisionDe(ref) {
  const guardada = decisiones[ref.clave] || {};
  return {
    prodId: 'prodId' in guardada ? guardada.prodId : ref.prodIdExistente,
    albumIndex: guardada.albumIndex != null ? guardada.albumIndex : 0,
  };
}

/** Necesita ojo humano: sin candidatos, empate visual, o duplicado sin resolver. */
function hayQueRevisar(ref) {
  if (ref.yaAplicada) return false;
  if (ref.error || !ref.candidatos.length) return true;
  if (ref.decision !== 'auto') return true;
  const d = decisionDe(ref);
  return !d.prodId && ref.candidatosDuplicados.length > 0;
}

function pintarRevision() {
  mostrarPaso('pasoRevisar');

  const pendientes = lote.referencias.filter((r) => !r.yaAplicada);
  const total = pendientes.length;
  const revisar = pendientes.filter(hayQueRevisar).length;
  const unidades = pendientes.reduce((s, r) => s + r.unidades, 0);
  const enPreventa = pendientes.reduce((s, r) => s + r.unidadesPreventa, 0);
  const nuevas = pendientes.filter((r) => !decisionDe(r).prodId).length;

  $('contadores').innerHTML = `
    <div class="cuenta"><strong>${total}</strong><span>referencias</span></div>
    <div class="cuenta"><strong>${unidades}</strong><span>unidades</span></div>
    ${enPreventa ? `<div class="cuenta"><strong>${enPreventa}</strong><span>ya encargadas</span></div>` : ''}
    <div class="cuenta"><strong>${nuevas}</strong><span>productos nuevos</span></div>
    <div class="cuenta"><strong style="color:${revisar ? '#8a6100' : '#1a7f37'}">${revisar}</strong><span>por revisar</span></div>`;

  const soloDudosas = $('soloDudosas').checked;
  const aMostrar = soloDudosas ? lote.referencias.filter(hayQueRevisar) : lote.referencias;

  const avisoPrevio = lote.yaEscrito
    ? `<div class="aviso"><b>Este pedido ya se cargó antes.</b>
       De sus referencias, ${lote.yaEscrito.total} ya están guardadas
       (${lote.yaEscrito.creadas} creadas y ${lote.yaEscrito.sumadas} con stock sumado).
       Si vuelves a cargar, esas se saltan: tu inventario no se duplica.</div>`
    : '';

  $('listaReferencias').innerHTML = avisoPrevio + (aMostrar.map(pintarReferencia).join('')
    || '<div class="tarjeta centro tenue">Nada por revisar.</div>');

  // El nombre sale del archivo y la TRM de la ultima que se uso, para no
  // tener que escribirlas desde cero cada vez.
  if (!$('loteNombre').value) {
    $('loteNombre').value = (lote.nombreArchivo || '').replace(/\.xlsx$/i, '').trim();
  }
  if (!$('loteTrm').value) $('loteTrm').value = localStorage.getItem('h90-trm') || '';

  const btn = $('btnCargar');
  btn.disabled = total === 0;
  btn.textContent = total === 0 ? 'Ya está todo cargado' : 'Cargar al catálogo';

  conectarEventos();
}

function pintarReferencia(ref) {
  const d = decisionDe(ref);
  const revisar = hayQueRevisar(ref);
  const clase = ref.yaAplicada ? 'ya' : ref.error || !ref.candidatos.length ? 'malo' : revisar ? 'revisar' : '';

  const etiqueta = ref.yaAplicada
    ? '<span class="etiqueta ya">ya cargada</span>'
    : ref.error || !ref.candidatos.length
      ? '<span class="etiqueta mal">no se encontró</span>'
      : revisar
        ? '<span class="etiqueta duda">revisar</span>'
        : '<span class="etiqueta ok">lista</span>';

  const tallas = ref.filas.map((f) => `${f.talla} x${f.cantidad}`).join(', ');
  const destino = ref.unidadesPreventa
    ? (ref.unidadesStock
      ? `<span class="etiqueta pre">${ref.unidadesStock} stock + ${ref.unidadesPreventa} preventa</span>`
      : `<span class="etiqueta pre">${ref.unidadesPreventa} de preventa</span>`)
    : '';

  const fotoExcel = ref.tieneFotoExcel
    ? `<img src="/api/lote/${lote.id}/foto-excel/${ref.indice}" alt="foto del excel">`
    : '<div class="sin-foto">esta fila no tiene foto en el excel</div>';

  const candidatos = ref.candidatos.length
    ? ref.candidatos.map((c) => {
      const fotos = Array.from({ length: c.fotos }, (_, i) =>
        `<img src="/api/lote/${lote.id}/foto/${ref.indice}/${c.indice}/${i}" alt="" loading="lazy">`).join('');
      const puntaje = c.score == null ? '' : `<b>${(c.score * 100).toFixed(0)}%</b> · `;
      return `<button type="button" class="cand ${c.indice === d.albumIndex ? 'elegido' : ''}"
                data-clave="${escapar(ref.clave)}" data-album="${c.indice}">
                <div class="tira">${fotos}</div>
                <figcaption>${puntaje}${escapar(c.titulo)}</figcaption>
              </button>`;
    }).join('')
    : `<div class="error"><b>No se encontró en el proveedor.</b>
       ${ref.motivoSinResultados ? `Motivo: ${escapar(ref.motivoSinResultados)}.` : ''}
       ${ref.error ? `(${escapar(ref.error)})` : ''}
       Se puede cargar igual y ponerle las fotos después desde el admin.</div>`;

  // La decision de "¿ya la tienes?" se hace mirando fotos, no leyendo nombres.
  // Un nombre parecido no prueba nada; dos fotos iguales si.
  const opciones = [];
  const vistos = new Set();
  if (ref.prodIdExistente && !ref.candidatosDuplicados.some((c) => c.id === ref.prodIdExistente)) {
    opciones.push({ id: ref.prodIdExistente, equipo: `producto id ${ref.prodIdExistente}`, foto: null });
  }
  ref.candidatosDuplicados.forEach((c) => {
    if (vistos.has(c.id)) return;
    vistos.add(c.id);
    opciones.push(c);
  });

  const duplicado = opciones.length ? `
    <div class="duplicado">
      <p><b>¿Esta camiseta ya la tienes?</b> Si es la misma se le suma el stock; si no, se crea aparte.${
        ref.enlazadaPorFoto ? ` <span class="segura">La foto dice que sí, ${(ref.enlazadaPorFoto * 100).toFixed(0)}% igual.</span>` : ''
      }</p>
      <div class="opciones">
        <button type="button" class="opcion ${!d.prodId ? 'elegida' : ''}"
                data-clave="${escapar(ref.clave)}" data-prod="">
          <div class="sinfoto">es NUEVA</div>
          <figcaption><b>Crear aparte</b></figcaption>
        </button>
        ${opciones.map((o) => `
          <button type="button" class="opcion ${d.prodId === o.id ? 'elegida' : ''}"
                  data-clave="${escapar(ref.clave)}" data-prod="${o.id}">
            ${o.foto ? `<img src="${escapar(o.foto)}" alt="" loading="lazy">` : '<div class="sinfoto">sin foto</div>'}
            <figcaption>
              ${o.origen === 'foto' ? `<b>${(o.score * 100).toFixed(0)}% igual</b><br>` : '<span class="pornombre">nombre parecido</span><br>'}
              ${escapar(o.equipo)}
            </figcaption>
          </button>`).join('')}
      </div>
    </div>` : '';

  // Las de preventa ya estan vendidas: hace falta saber a quien. Si se deja
  // vacio queda "Pendiente por Asignar", igual que en el admin.
  const cliente = ref.unidadesPreventa ? `
    <div class="cliente">
      <p><b>${ref.unidadesPreventa} unidad(es) ya encargadas.</b> ¿Para quién son?</p>
      <input type="text" class="inpCliente" data-clave="${escapar(ref.clave)}"
             value="${escapar(decisiones[ref.clave]?.cliente || '')}"
             placeholder="Nombre del cliente (si lo dejas vacío queda pendiente por asignar)">
    </div>` : '';

  return `
    <article class="ref ${clase}">
      <div class="ref-cabeza"><h3>${escapar(ref.titulo)}</h3>${etiqueta}${destino}</div>
      <p class="ref-meta">${escapar(ref.tipo)} · ${escapar(tallas)} · ${ref.unidades} unidades
        ${ref.queries.length ? ` · buscó: ${escapar(ref.queries.join(' / '))}` : ''}</p>
      <div class="comparacion">
        <figure class="excel">${fotoExcel}<p>tu foto del excel</p></figure>
        <div class="candidatos">${candidatos}</div>
      </div>
      ${duplicado}
      ${cliente}
    </article>`;
}

function conectarEventos() {
  document.querySelectorAll('.cand').forEach((boton) => {
    boton.addEventListener('click', () => {
      const clave = boton.dataset.clave;
      decisiones[clave] = { ...(decisiones[clave] || {}), albumIndex: Number(boton.dataset.album) };
      pintarRevision();
    });
  });
  document.querySelectorAll('.inpCliente').forEach((inp) => {
    // Sin redibujar: redibujar en cada tecla haria perder el foco.
    inp.addEventListener('input', () => {
      const clave = inp.dataset.clave;
      decisiones[clave] = { ...(decisiones[clave] || {}), cliente: inp.value };
    });
  });
  document.querySelectorAll('.opcion').forEach((boton) => {
    boton.addEventListener('click', () => {
      const clave = boton.dataset.clave;
      decisiones[clave] = { ...(decisiones[clave] || {}), prodId: boton.dataset.prod ? Number(boton.dataset.prod) : null };
      pintarRevision();
    });
  });
}

$('soloDudosas').addEventListener('change', () => pintarRevision());

// ── Paso 4: confirmar ────────────────────────────────────────────────────
function datosDelLote() {
  const loteNombre = $('loteNombre').value.trim();
  const trm = parseFloat($('loteTrm').value) || 0;
  $('loteNombre').parentElement.classList.toggle('falta', !loteNombre);
  $('loteTrm').parentElement.classList.toggle('falta', !(trm > 0));
  if (!loteNombre || !(trm > 0)) {
    alert('Faltan el nombre del lote y la TRM de compra. Sin eso no se puede registrar el gasto ni los pedidos.');
    return null;
  }
  localStorage.setItem('h90-trm', String(trm));
  return { loteNombre, trm };
}

$('btnCargar').addEventListener('click', async () => {
  if (!datosDelLote()) return;
  const r = await fetch(`/api/lote/${idLote}/resumen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisiones }),
  });
  const resumen = await r.json();

  const gastoCop = Math.round(resumen.costoUsd * datosDelLote().trm);

  $('resumenCarga').innerHTML = `
    <div class="linea"><span>Productos nuevos que se crean</span><b>${resumen.nuevos}</b></div>
    <div class="linea"><span>Productos a los que se les suma stock</span><b>${resumen.existentes}</b></div>
    <div class="linea"><span>Unidades que entran al inventario</span><b>${resumen.unidadesStock}</b></div>
    ${resumen.unidadesPreventa ? `
      <div class="linea"><span>Unidades ya encargadas (van a pedidos)</span><b>${resumen.unidadesPreventa}</b></div>` : ''}
    ${resumen.yaAplicadas ? `
      <div class="linea"><span>Se saltan (ya cargadas antes)</span><b>${resumen.yaAplicadas}</b></div>` : ''}
    <div class="linea"><span>Gasto de la compra que se registra</span>
      <b>$${gastoCop.toLocaleString('es-CO')} <small style="font-weight:400">(US$${resumen.costoUsd})</small></b></div>
    ${resumen.preventaSinCliente ? `<div class="aviso" style="margin-top:12px">
      ${resumen.preventaSinCliente} unidad(es) de preventa quedan como
      <b>"Pendiente por Asignar"</b> porque no les pusiste cliente. Puedes asignarlo
      después desde el admin.</div>` : ''}`;
  $('btnConfirmar').disabled = false;
  $('modalConfirmar').classList.remove('oculto');
});

$('btnCancelar').addEventListener('click', () => $('modalConfirmar').classList.add('oculto'));

$('btnConfirmar').addEventListener('click', async () => {
  $('modalConfirmar').classList.add('oculto');
  $('btnConfirmar').disabled = true;
  const basics = datosDelLote();
  if (!basics) return;
  const res = await fetch(`/api/lote/${idLote}/cargar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisiones, ...basics }),
  });
  if (!res.ok) { mostrarError((await res.json()).error); return; }
  seguirLote();
});

// ── Paso 5: resultado ────────────────────────────────────────────────────
function pintarResultado() {
  mostrarPaso('pasoResultado');
  const r = lote.resultado || {};
  const escritas = (r.creados || []).length + (r.sumados || []).length;
  const unidades = lote.referencias
    .filter((x) => !x.yaAplicada)
    .reduce((s, x) => s + x.unidades, 0);

  // Si no se escribio nada, el titulo no puede decir que se cargo: lo normal
  // es que sea un pedido que ya estaba guardado.
  $('tituloResultado').textContent = escritas
    ? 'Listo, quedó cargado'
    : 'No hacía falta cargar nada';
  const sinFotos = (r.creados || []).filter((c) => c.avisoFotos);

  $('detalleResultado').innerHTML = `
    <div class="nota">Lo único que se registra en finanzas es el gasto de la compra.
      No se toca ninguna venta, cobro ni saldo tuyo.</div>
    ${escritas ? `
      <div class="linea"><span>Productos creados</span><b>${(r.creados || []).length}</b></div>
      <div class="linea"><span>Productos con stock sumado</span><b>${(r.sumados || []).length}</b></div>
      <div class="linea"><span>Unidades cargadas</span><b>${unidades}</b></div>
      ${(r.preventa || []).length ? `<div class="linea"><span>Camisetas ya encargadas registradas</span>
        <b>${r.preventa.reduce((s, p) => s + p.unidades, 0)}</b></div>` : ''}
      ${r.gasto ? `<div class="linea"><span>Gasto de la compra registrado</span>
        <b>${r.gasto.montoAgregado.toLocaleString('es-CO')}</b></div>` : ''}` : ''}
    ${(r.saltados || []).length ? `<div class="aviso" style="margin-top:14px">
      <b>${r.saltados.length} referencia(s) ya estaban guardadas de una carga anterior</b>, así que
      se saltaron. Tu inventario no se duplicó.
      <details style="margin-top:8px"><summary style="cursor:pointer">ver cuáles</summary>
        <p style="margin:8px 0 0">${r.saltados.map((s) => escapar(s.titulo)).join(', ')}.</p>
      </details></div>` : ''}
    ${(r.creados || []).filter((c) => c.fichaFuente === 'reglas').length ? `<div class="aviso" style="margin-top:14px">
      A ${r.creados.filter((c) => c.fichaFuente === 'reglas').length} producto(s) no se les pudo escribir
      la descripción automática y quedaron con el texto básico. Vale la pena repasarlos en el admin:
      ${r.creados.filter((c) => c.fichaFuente === 'reglas').map((c) => escapar(c.titulo)).join(', ')}.</div>` : ''}
    ${sinFotos.length ? `<div class="aviso" style="margin-top:14px">
      Estas quedaron sin fotos y hay que ponérselas desde el admin:
      ${sinFotos.map((c) => escapar(c.titulo)).join(', ')}.</div>` : ''}
    ${escritas ? `<p class="tenue" style="margin-top:18px">
      Ya se ven en la tienda. Para que entren en Google hay que publicar las páginas
      (regenerar y subir), como dice la guía.</p>` : ''}`;
}

function escapar(t) {
  return String(t == null ? '' : t).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

comprobarRobot();
setInterval(comprobarRobot, 15000);


// ── Corregir las fotos de un producto que ya esta en la tienda ─────────────
//
// Pasa: una camiseta queda con las fotos de otra parecida y uno se da cuenta
// despues, viendola en la pagina. Aqui se arregla sin tocar nada mas del
// producto: el titulo, la descripcion y el stock quedan igual.

let productoElegido = null;

const buscarProducto = debounce(async () => {
  const q = $('buscarProducto').value.trim();
  if (q.length < 2) { $('resultadosProducto').innerHTML = ''; return; }
  const r = await fetch(`/api/producto/buscar?q=${encodeURIComponent(q)}`);
  const productos = await r.json();
  $('resultadosProducto').innerHTML = productos.length
    ? productos.map((p) => `
      <button type="button" class="resultado-prod" data-id="${p.id}">
        ${p.fotos[0] ? `<img src="${escapar(p.fotos[0])}" alt="">` : '<img alt="">'}
        <span><b>${escapar(p.equipo)}</b><br><small>${escapar(p.categoria)} · ${p.fotos.length} fotos</small></span>
      </button>`).join('')
    : '<p class="tenue">Ninguna camiseta con ese nombre.</p>';
  document.querySelectorAll('.resultado-prod').forEach((b) => {
    b.addEventListener('click', () => elegirProducto(Number(b.dataset.id), productos));
  });
}, 350);

$('buscarProducto').addEventListener('input', buscarProducto);

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function elegirProducto(id, productos) {
  productoElegido = productos.find((p) => p.id === id);
  $('resultadosProducto').innerHTML = '';
  pintarCorreccion('');
  buscarEnProveedor(id, productoElegido.equipo);
}

// El titulo del catalogo no siempre es el mejor termino para buscar en el
// proveedor: puede traer palabras que confunden ("verde y blanca" hizo que
// saliera el album equivocado). Por eso el texto se puede editar y volver a
// buscar sin salir de aqui.
function pintarCorreccion(cuerpo, busqueda) {
  const texto = busqueda != null ? busqueda : productoElegido.equipo;
  const actuales = productoElegido.fotos.slice(0, 5)
    .map((f) => '<img src="' + escapar(f) + '" alt="">').join('');

  $('corregirDetalle').innerHTML = `
    <h3 class="titulo-prod">${escapar(productoElegido.equipo)}</h3>
    <p class="tenue">Fotos que tiene ahora:</p>
    <div class="actuales">${actuales}</div>
    <div class="buscar-otra">
      <label><span>Buscar en el proveedor con este texto</span>
        <input type="text" id="textoBusqueda" value="${escapar(texto)}"></label>
      <button type="button" id="btnBuscarOtra" class="btn">Buscar</button>
    </div>
    <div id="resultadoBusqueda">${cuerpo}</div>`;

  $('btnBuscarOtra').addEventListener('click', () => {
    buscarEnProveedor(productoElegido.id, $('textoBusqueda').value.trim());
  });
  $('textoBusqueda').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btnBuscarOtra').click();
  });
}

async function buscarEnProveedor(id, busqueda) {
  $('resultadoBusqueda').innerHTML = '<p class="tenue">Buscando en el proveedor… tarda unos segundos.</p>';
  const r = await fetch(`/api/producto/${id}/buscar-fotos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ busqueda }),
  });
  const d = await r.json();
  if (!r.ok) {
    $('resultadoBusqueda').innerHTML = '<div class="error">' + escapar(d.error) + '</div>';
    return;
  }

  const tarjetas = d.candidatos.map((c) => {
    const fotos = Array.from({ length: c.fotos }, (_, i) =>
      `<img src="/api/producto/${id}/foto/${c.indice}/${i}" alt="" loading="lazy">`).join('');
    return `<button type="button" class="cand" data-cand="${c.indice}">
      <div class="tira">${fotos}</div>
      <figcaption>${escapar(c.titulo)}<br>
        <a href="${escapar(c.yupooUrl)}" target="_blank" rel="noopener">ver en el proveedor</a></figcaption>
    </button>`;
  }).join('');

  const sinNada = '<div class="error">No se encontró nada con ese texto. '
    + 'Prueba con menos palabras, por ejemplo solo el equipo y el año.</div>';

  $('resultadoBusqueda').innerHTML = `
    <p class="tenue">Buscó <b>${escapar((d.queries || []).join(' / '))}</b> en la sección
      <b>${escapar(d.tipo)}</b> (${escapar((d.tiendas || []).join(', '))}).
      Elige el álbum correcto y se reemplazan las fotos.</p>
    <div class="candidatos">${tarjetas || sinNada}</div>`;

  document.querySelectorAll('#resultadoBusqueda .cand').forEach((b) => {
    b.addEventListener('click', () => reemplazarFotos(id, Number(b.dataset.cand), b));
  });
}

async function reemplazarFotos(id, candidato, boton) {
  boton.classList.add('elegido');
  $('resultadoBusqueda').insertAdjacentHTML('beforeend',
    '<p class="tenue">Quitando fondos y subiendo… esto tarda un poco.</p>');

  const r = await fetch(`/api/producto/${id}/reemplazar-fotos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidato }),
  });
  const d = await r.json();
  $('resultadoBusqueda').innerHTML = r.ok
    ? `<div class="nota"><b>Listo.</b> ${escapar(productoElegido.equipo)} quedó con ${d.fotos} fotos nuevas,
        del álbum ${escapar(d.album)}. Ya se ven en la tienda; para que entren en Google hay que publicar.</div>`
    : `<div class="error">${escapar(d.error)}</div>`;
}
