/**
 * scripts/lib/lote-analisis.mjs
 *
 * Lee un excel de pedido y deja cada referencia lista para revisar: con su
 * foto del excel, sus tallas, si ya existe en el catalogo, y los candidatos
 * que encontro en el proveedor ordenados por parecido.
 *
 * Es el paso previo a cargar. No escribe nada en ningun lado.
 */
'use strict';

import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import XLSX from 'xlsx';
import { extraerFotosDeExcel, asociarFotosAFilas } from './excel-photos.mjs';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', '..');
const ROBOT = process.env.ROBOT_URL || 'http://127.0.0.1:3001';

// Los modulos del admin se escribieron para el navegador y publican su API en
// window. Se simula ese global una sola vez para poder reutilizarlos tal cual,
// en vez de tener una segunda copia de la misma logica que se desincronice.
let ADMIN = null;
function modulosDelAdmin() {
  if (ADMIN) return ADMIN;
  const previo = global.window;
  global.window = {};
  require(path.join(RAIZ, 'web/js/admin-lote-workflow.js'));
  const { AdminLoteWorkflow } = global.window;
  global.window = previo;
  ADMIN = { AdminLoteWorkflow };
  return ADMIN;
}

export function claveDeReferencia(descripcion) {
  return String(descripcion || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// El orden de las columnas esta fijo. Si alguien mueve una en el excel, todo
// se lee corrido: las tallas quedan donde van las cantidades y el pedido entra
// mal SIN dar error. Por eso se comprueba el encabezado antes de leer nada.
const COLUMNAS_ESPERADAS = [
  [1, 'SIZE'], [2, 'TYPE'], [3, 'DESCRIPTION'], [6, 'QTY'], [11, 'DESTINO'],
];

function revisarEncabezado(encabezado) {
  const faltan = COLUMNAS_ESPERADAS.filter(([i, nombre]) => {
    const celda = String(encabezado?.[i] || '').trim().toUpperCase();
    return !celda.includes(nombre);
  });
  if (!faltan.length) return;
  const detalle = faltan.map(([i, nombre]) => {
    const hay = String(encabezado?.[i] || '(vacia)').trim();
    return `en la columna ${String.fromCharCode(65 + i)} se esperaba "${nombre}" y dice "${hay}"`;
  }).join('; ');
  throw new Error(
    `El excel no tiene el formato de siempre: ${detalle}. `
    + 'Si se movieron columnas, el pedido se leeria mal sin avisar, asi que mejor se detiene aqui. '
    + 'Genera el pedido con la plantilla de siempre (scripts/crear-pedido.mjs).',
  );
}

/** Filas de datos del excel, recortadas a las columnas que usa el admin. */
export function leerFilasDelExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const hoja = wb.Sheets.ORDER || wb.Sheets[wb.SheetNames[0]];
  if (!hoja) throw new Error('el archivo no tiene una hoja llamada ORDER');
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false });
  if (filas.length < 3) throw new Error('el archivo no tiene filas de pedido');
  revisarEncabezado(filas[1]);

  const datos = filas.slice(2)
    .filter((fila) => fila[1] && fila[3])
    .map((fila) => fila.slice(1, 12).map((celda) => (celda == null ? '' : String(celda))));
  if (!datos.length) throw new Error('no se encontraron filas de pedido en el archivo');

  // Una cantidad en cero o sin numero significa que la fila no aporta nada, y
  // pasaria callada creando un producto con stock vacio.
  const sinCantidad = datos.filter((c) => !(parseInt(c[5], 10) > 0));
  if (sinCantidad.length) {
    throw new Error(
      `Hay ${sinCantidad.length} fila(s) sin cantidad valida en la columna QTY `
      + `(por ejemplo "${sinCantidad[0][2]}"). Revisa el excel antes de cargar.`,
    );
  }
  return datos;
}

/** Ordena las fotos del album dejando primero las que mas se parecen al excel. */
function ordenarPorParecido(photoUrls, photoScores) {
  const urls = photoUrls || [];
  if (!Array.isArray(photoScores) || !photoScores.length) return urls;
  return photoScores.slice().sort((a, b) => b.score - a.score).map((p) => urls[p.index]).filter(Boolean);
}

/**
 * Agrupa las filas del excel por referencia y les pega su foto.
 * Devuelve las referencias SIN buscar todavia en el proveedor.
 */
export function prepararReferencias(bufferExcel, productosDelCatalogo) {
  const { AdminLoteWorkflow } = modulosDelAdmin();
  const filas = leerFilasDelExcel(bufferExcel);
  const claves = filas.map((cols) => claveDeReferencia(cols[2]));
  const items = filas.map((cols) => AdminLoteWorkflow.buildLoteItemFromColumns(cols, productosDelCatalogo));

  const fotosPorClave = asociarFotosAFilas(agruparFotosUnicasSync(bufferExcel), claves);

  const grupos = new Map();
  items.forEach((item, i) => {
    const clave = claves[i];
    if (!grupos.has(clave)) {
      const foto = fotosPorClave.get(clave);
      grupos.set(clave, {
        clave,
        titulo: item.queryStr,
        descripcion: item.rawDescription,
        extras: item.extrasText,
        tipo: item.type,
        // Lo que el admin le pondria al producto si hay que crearlo.
        categoria: item.generatedCategory,
        descripcionCatalogo: item.generatedDescription,
        precio: item.precioVenta,
        costoUsd: item.costUsd,
        // Si el nombre coincidio claramente con un producto del catalogo, ya
        // viene resuelto. Si solo se parece, quedan los candidatos para que la
        // decida una persona: confundir dos camisetas mezcla el stock de ambas.
        prodIdExistente: item.prodId || null,
        candidatosDuplicados: (item.duplicateCandidates || []).map((c) => ({
          id: c.id, equipo: c.equipo, score: c.score,
        })),
        fotoExcel: foto ? { buffer: foto.buffer, ext: foto.ext } : null,
        filas: [],
        ranking: [],
        decision: 'pendiente',
      });
    }
    grupos.get(clave).filas.push({ talla: item.size, cantidad: item.qty, destino: item.destino });
  });

  return [...grupos.values()];
}

// Misma agrupacion que agruparFotosUnicas, pero sincrona: la misma imagen
// esta anclada una vez por talla, asi que se juntan por contenido.
function agruparFotosUnicasSync(bufferExcel) {
  const porHash = new Map();
  for (const foto of extraerFotosDeExcel(bufferExcel)) {
    const hash = createHash('md5').update(foto.buffer).digest('hex');
    if (!porHash.has(hash)) porHash.set(hash, { hash, buffer: foto.buffer, ext: foto.ext, rows: [] });
    porHash.get(hash).rows.push(foto.row);
  }
  return [...porHash.values()].sort((a, b) => Math.min(...a.rows) - Math.min(...b.rows));
}

/** Busca una referencia en el proveedor usando su foto del excel como verdad. */
export async function buscarReferencia(referencia, { maxCandidatos = 6 } = {}) {
  const cuerpo = {
    type: referencia.tipo,
    description: referencia.descripcion,
    extrasText: referencia.extras,
    maxCandidates: maxCandidatos,
  };
  if (referencia.fotoExcel) cuerpo.referencePhotoBase64 = referencia.fotoExcel.buffer.toString('base64');

  const res = await fetch(`${ROBOT}/api/match-provider-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(`match-provider-photo: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();

  return {
    decision: data.decision || 'sin-resultados',
    // Se guarda POR QUE no hubo resultados: no es lo mismo que no se reconozca
    // el equipo (se arregla agregandolo al diccionario) a que el proveedor
    // simplemente no tenga esa camiseta (toca buscarla a mano).
    motivoSinResultados: data.decision === 'no-team-match'
      ? 'no se reconoció el equipo en la descripción'
      : (data.ranking || []).length ? null : 'el proveedor no tiene esta camiseta',
    queries: data.searchInfo?.queries || [],
    ranking: (data.ranking || []).map((r) => ({
      title: r.title,
      score: r.score,
      store: r.store,
      yupooUrl: r.yupooUrl,
      photoUrls: ordenarPorParecido(r.photoUrls, r.photo_scores),
      photoScores: r.photo_scores || [],
    })),
  };
}

/**
 * Pasa todas las referencias por el proveedor, avisando el avance.
 * Una referencia que falle no tumba el resto: queda marcada con su error.
 */
export async function analizarReferencias(referencias, { alAvanzar = () => {}, maxCandidatos = 6 } = {}) {
  let hechas = 0;
  for (const referencia of referencias) {
    alAvanzar({ hechas, total: referencias.length, actual: referencia.titulo });
    try {
      Object.assign(referencia, await buscarReferencia(referencia, { maxCandidatos }));
    } catch (err) {
      referencia.decision = 'error';
      referencia.error = err.message;
      referencia.ranking = [];
    }
    hechas += 1;
  }
  alAvanzar({ hechas, total: referencias.length, actual: null });
  return referencias;
}
