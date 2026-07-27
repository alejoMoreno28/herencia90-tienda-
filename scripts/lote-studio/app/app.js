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

  if (lote.estado === 'leyendo' || lote.estado === 'buscando') {
    $('tituloTrabajando').textContent = lote.estado === 'leyendo'
      ? 'Leyendo el archivo y sacando las fotos…'
      : 'Buscando las camisetas en el proveedor…';
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
  const nuevas = pendientes.filter((r) => !decisionDe(r).prodId).length;

  $('contadores').innerHTML = `
    <div class="cuenta"><strong>${total}</strong><span>referencias</span></div>
    <div class="cuenta"><strong>${unidades}</strong><span>unidades</span></div>
    <div class="cuenta"><strong>${nuevas}</strong><span>productos nuevos</span></div>
    <div class="cuenta"><strong>${total - nuevas}</strong><span>suman stock</span></div>
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
    : `<div class="error">No se encontró en el proveedor.${ref.error ? ` (${escapar(ref.error)})` : ''}
       Se puede cargar igual y ponerle las fotos después desde el admin.</div>`;

  // El desplegable de duplicado solo aparece cuando de verdad hay dudas: o el
  // sistema encontro parecidos, o ya la habia emparejado sola.
  const opciones = [];
  const vistos = new Set();
  if (ref.prodIdExistente) {
    opciones.push({ id: ref.prodIdExistente, texto: `producto que ya existe (id ${ref.prodIdExistente})` });
    vistos.add(ref.prodIdExistente);
  }
  ref.candidatosDuplicados.forEach((c) => {
    if (vistos.has(c.id)) return;
    vistos.add(c.id);
    opciones.push({ id: c.id, texto: `${c.equipo} (id ${c.id})` });
  });

  const duplicado = opciones.length ? `
    <div class="duplicado">
      <p><b>¿Esta camiseta ya la tienes en el catálogo?</b>
         Si es la misma se le suma el stock; si no, se crea aparte.</p>
      <select data-clave="${escapar(ref.clave)}" class="selDuplicado">
        <option value="">Es una referencia NUEVA</option>
        ${opciones.map((o) => `<option value="${o.id}" ${d.prodId === o.id ? 'selected' : ''}>
           Es la misma: ${escapar(o.texto)}</option>`).join('')}
      </select>
    </div>` : '';

  return `
    <article class="ref ${clase}">
      <div class="ref-cabeza"><h3>${escapar(ref.titulo)}</h3>${etiqueta}</div>
      <p class="ref-meta">${escapar(ref.tipo)} · ${escapar(tallas)} · ${ref.unidades} unidades
        ${ref.queries.length ? ` · buscó: ${escapar(ref.queries.join(' / '))}` : ''}</p>
      <div class="comparacion">
        <figure class="excel">${fotoExcel}<p>tu foto del excel</p></figure>
        <div class="candidatos">${candidatos}</div>
      </div>
      ${duplicado}
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
  document.querySelectorAll('.selDuplicado').forEach((sel) => {
    sel.addEventListener('change', () => {
      const clave = sel.dataset.clave;
      decisiones[clave] = { ...(decisiones[clave] || {}), prodId: sel.value ? Number(sel.value) : null };
      pintarRevision();
    });
  });
}

$('soloDudosas').addEventListener('change', () => pintarRevision());

// ── Paso 4: confirmar ────────────────────────────────────────────────────
$('btnCargar').addEventListener('click', async () => {
  const r = await fetch(`/api/lote/${idLote}/resumen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisiones }),
  });
  const resumen = await r.json();

  if (resumen.preventa?.length) {
    $('resumenCarga').innerHTML = `<div class="error">
      Este pedido tiene filas de <b>PREVENTA</b> (${resumen.preventa.map(escapar).join(', ')}).
      Esas generan pedidos y movimientos de plata, así que van por el admin, no por aquí.</div>`;
    $('btnConfirmar').disabled = true;
  } else {
    $('resumenCarga').innerHTML = `
      <div class="linea"><span>Productos nuevos que se crean</span><b>${resumen.nuevos}</b></div>
      <div class="linea"><span>Productos a los que se les suma stock</span><b>${resumen.existentes}</b></div>
      <div class="linea"><span>Unidades en total</span><b>${resumen.unidades}</b></div>
      ${resumen.yaAplicadas ? `<div class="linea"><span>Se saltan (ya cargadas antes)</span><b>${resumen.yaAplicadas}</b></div>` : ''}`;
    $('btnConfirmar').disabled = false;
  }
  $('modalConfirmar').classList.remove('oculto');
});

$('btnCancelar').addEventListener('click', () => $('modalConfirmar').classList.add('oculto'));

$('btnConfirmar').addEventListener('click', async () => {
  $('modalConfirmar').classList.add('oculto');
  $('btnConfirmar').disabled = true;
  await fetch(`/api/lote/${idLote}/cargar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisiones }),
  });
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
    <div class="nota">No se tocó tu contabilidad: transacciones, pedidos, ventas y saldos quedaron igual.</div>
    ${escritas ? `
      <div class="linea"><span>Productos creados</span><b>${(r.creados || []).length}</b></div>
      <div class="linea"><span>Productos con stock sumado</span><b>${(r.sumados || []).length}</b></div>
      <div class="linea"><span>Unidades cargadas</span><b>${unidades}</b></div>` : ''}
    ${(r.saltados || []).length ? `<div class="aviso" style="margin-top:14px">
      <b>${r.saltados.length} referencia(s) ya estaban guardadas de una carga anterior</b>, así que
      se saltaron. Tu inventario no se duplicó.
      <details style="margin-top:8px"><summary style="cursor:pointer">ver cuáles</summary>
        <p style="margin:8px 0 0">${r.saltados.map((s) => escapar(s.titulo)).join(', ')}.</p>
      </details></div>` : ''}
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
