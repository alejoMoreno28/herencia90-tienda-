/**
 * scripts/cargar-lote.mjs
 *
 * Carga un pedido al catalogo haciendo EXACTAMENTE lo mismo que hace el admin
 * al guardar un lote, y NADA MAS:
 *
 *   1. crea un producto por cada referencia nueva, con el stock en cero
 *   2. le SUMA a las tallas del producto las unidades de cada fila del excel
 *
 * No escribe en transacciones ni en pedidos. Las ventas, saldos, historial y
 * cualquier otro numero de la contabilidad quedan intactos: este script solo
 * inserta filas en `productos` y actualiza la columna `tallas`.
 *
 * Las filas con destino PREVENTA se rechazan a proposito: esas si generan
 * pedidos y movimientos de plata, y eso se hace desde el admin.
 *
 * Uso:
 *   node --env-file=.env scripts/cargar-lote.mjs _p5_match.json --dry-run
 *   node --env-file=.env scripts/cargar-lote.mjs _p5_match.json --confirmar
 */
'use strict';

import fs from 'node:fs';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const ROBOT = process.env.ROBOT_URL || 'http://127.0.0.1:3001';

const rutaJson = process.argv[2];
const confirmar = process.argv.includes('--confirmar');
if (!rutaJson) {
  console.error('uso: node --env-file=.env scripts/cargar-lote.mjs <match.json> [--confirmar]');
  process.exit(1);
}

async function api(ruta, opciones = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opciones.headers || {}),
    },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${ruta}: ${res.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

// Cuantas fotos se publican por producto. Del album se bajan hasta 12 para
// poder compararlas, pero muchas son primeros planos de etiquetas y costuras.
// Como vienen ordenadas de la que mas se parece a la foto del excel (o sea la
// camiseta completa) a la que menos, con las primeras basta.
const FOTOS_POR_PRODUCTO = 6;

/** Procesa las fotos del album elegido: quita fondo y las deja en formato catalogo. */
async function procesarFotos(item) {
  const ganador = item.ranking[0];
  if (!ganador || !ganador.photoUrls || !ganador.photoUrls.length) return [];
  const res = await fetch(`${ROBOT}/api/process-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store: ganador.store,
      photoUrls: ganador.photoUrls.slice(0, FOTOS_POR_PRODUCTO),
      slugHint: item.titulo,
    }),
  });
  if (!res.ok) throw new Error(`process-photo: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.images || []).map((img) => (typeof img === 'string' ? img : img.url || img.publicUrl || '')).filter(Boolean);
}

function sumarTallas(tallasActuales, filas) {
  const tallas = { S: 0, M: 0, L: 0, XL: 0, ...(tallasActuales || {}) };
  for (const fila of filas) {
    const talla = String(fila.talla || '').trim().toUpperCase();
    if (!talla) continue;
    tallas[talla] = (parseInt(tallas[talla], 10) || 0) + (parseInt(fila.cantidad, 10) || 0);
  }
  return tallas;
}

/**
 * Decisiones manuales sobre referencias que el sistema marco como posibles
 * duplicados. El sistema no las resuelve solo a proposito: confundir dos
 * camisetas parecidas mezclaria el stock de ambas.
 *
 *   --existente "real madrid 26 27=60"   la referencia va al producto 60
 *   --nueva     "real madrid 26 27 rosa" se crea como referencia nueva
 *
 * Y sobre el album del proveedor, cuando la comparacion visual no acerto:
 *
 *   --album "camiseta real madrid 2011-2012 blanca retro=2"  usa el 2do candidato
 */
function leerDecisiones(argv) {
  const existentes = new Map();
  const nuevas = new Set();
  const albumes = new Map();
  argv.forEach((arg, i) => {
    if (arg === '--existente') {
      const [clave, id] = String(argv[i + 1] || '').split('=');
      if (clave && id) existentes.set(clave.trim().toLowerCase(), parseInt(id, 10));
    }
    if (arg === '--nueva') nuevas.add(String(argv[i + 1] || '').trim().toLowerCase());
    if (arg === '--album') {
      const [clave, pos] = String(argv[i + 1] || '').split('=');
      if (clave && pos) albumes.set(clave.trim().toLowerCase(), parseInt(pos, 10));
    }
  });
  return { existentes, nuevas, albumes };
}

async function main() {
  const items = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));

  const decisiones = leerDecisiones(process.argv);
  for (const [clave, id] of decisiones.existentes) {
    const item = items.find((i) => i.clave === clave);
    if (!item) throw new Error(`--existente "${clave}": no hay ninguna referencia con esa clave`);
    item.prodIdExistente = id;
  }
  for (const clave of decisiones.nuevas) {
    const item = items.find((i) => i.clave === clave);
    if (!item) throw new Error(`--nueva "${clave}": no hay ninguna referencia con esa clave`);
    item.prodIdExistente = null;
  }
  for (const [clave, pos] of decisiones.albumes) {
    const item = items.find((i) => i.clave === clave);
    if (!item) throw new Error(`--album "${clave}": no hay ninguna referencia con esa clave`);
    const elegido = item.ranking[pos - 1];
    if (!elegido) throw new Error(`--album "${clave}": no hay candidato numero ${pos}`);
    // Se pone de primero: de ahi es de donde salen las fotos.
    item.ranking = [elegido, ...item.ranking.filter((c) => c !== elegido)];
  }

  const conPreventa = items.filter((i) => i.filas.some((f) => String(f.destino || '').toUpperCase() === 'PREVENTA'));
  if (conPreventa.length) {
    console.error('Hay filas de PREVENTA. Esas generan pedidos y movimientos de plata:');
    conPreventa.forEach((i) => console.error(`  - ${i.titulo}`));
    console.error('Cargalas desde el admin, no por aqui.');
    process.exit(1);
  }

  const nuevos = items.filter((i) => !i.prodIdExistente);
  const existentes = items.filter((i) => i.prodIdExistente);
  const unidades = items.reduce((t, i) => t + i.filas.reduce((s, f) => s + (parseInt(f.cantidad, 10) || 0), 0), 0);

  console.log(`${items.length} referencias | ${nuevos.length} productos nuevos | ${existentes.length} ya existen | ${unidades} unidades\n`);

  if (!confirmar) {
    console.log('SIMULACION (nada se escribe). Esto es lo que se haria:\n');
    for (const item of nuevos) {
      const tallas = sumarTallas(null, item.filas);
      console.log(`  CREAR    ${item.titulo}`);
      console.log(`           stock ${JSON.stringify(tallas)} | fotos de: ${item.ranking[0]?.title || '(sin album)'}`);
    }
    for (const item of existentes) {
      const actual = await api(`productos?id=eq.${item.prodIdExistente}&select=equipo,tallas`);
      const antes = actual[0]?.tallas || {};
      console.log(`  SUMAR    ${actual[0]?.equipo} (id ${item.prodIdExistente})`);
      console.log(`           ${JSON.stringify(antes)}  ->  ${JSON.stringify(sumarTallas(antes, item.filas))}`);
    }
    console.log('\nNo se toca transacciones ni pedidos.');
    console.log('Para hacerlo de verdad: agregar --confirmar');
    return;
  }

  // ── Escritura real ──────────────────────────────────────────────────────
  // Sumar el stock NO es repetible: correrlo dos veces duplica las unidades.
  // Si una corrida anterior ya alcanzo a sumarlos y fallo despues, se retoma
  // con --solo-nuevos para crear los productos que faltan sin volver a sumar.
  if (process.argv.includes('--solo-nuevos')) {
    console.log('(--solo-nuevos: no se vuelve a sumar el stock de los que ya existen)\n');
    existentes.length = 0;
  }

  for (const item of existentes) {
    const actual = await api(`productos?id=eq.${item.prodIdExistente}&select=tallas`);
    const tallas = sumarTallas(actual[0]?.tallas, item.filas);
    await api(`productos?id=eq.${item.prodIdExistente}`, { method: 'PATCH', body: JSON.stringify({ tallas }) });
    console.log(`SUMADO   id ${item.prodIdExistente} -> ${JSON.stringify(tallas)}`);
  }

  // La tabla productos no genera el id sola: el admin lo asigna tomando el
  // mayor que exista y sumando uno. Aqui se hace igual.
  const ultimo = await api('productos?select=id&order=id.desc&limit=1');
  let siguienteId = (ultimo[0]?.id || 0) + 1;

  for (const item of nuevos) {
    let imagenes = [];
    try {
      imagenes = await procesarFotos(item);
    } catch (err) {
      console.log(`AVISO    ${item.titulo}: no se pudieron procesar las fotos (${err.message}). Se crea sin fotos.`);
    }
    // Nace en cero y de una vez se le suman las unidades del lote, igual que
    // hace el admin en sus dos pasos.
    const producto = {
      id: siguienteId++,
      categoria: item.categoria || 'Nueva Coleccion',
      equipo: item.titulo,
      descripcion: item.descripcionCatalogo || '',
      precio: item.precio || 99000,
      costo_usd: item.costoUsd || 0,
      tallas: sumarTallas(null, item.filas),
      imagenes,
    };
    const creado = await api('productos', { method: 'POST', body: JSON.stringify(producto) });
    console.log(`CREADO   id ${creado[0].id}  ${producto.equipo}  ${JSON.stringify(producto.tallas)}  ${imagenes.length} fotos`);
  }

  console.log('\nListo. No se escribio nada en transacciones ni en pedidos.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
