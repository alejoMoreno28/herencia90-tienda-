/**
 * scripts/pedido-con-fotos.mjs
 *
 * Toma un excel de pedido y, para cada referencia, usa LA FOTO PEGADA EN EL
 * EXCEL como verdad para encontrar la camiseta en el proveedor.
 *
 * La descripcion escrita a mano sirve para acotar la busqueda (equipo,
 * temporada, manga), pero quien decide cual de los candidatos es el correcto
 * es la comparacion visual contra la foto del excel. Asi un error de dedo en
 * la descripcion no termina bajando las fotos de otra camiseta.
 *
 * Uso:
 *   node scripts/pedido-con-fotos.mjs "PEDIDO5HERENCIA 90.xlsx"
 *   node scripts/pedido-con-fotos.mjs "PEDIDO5HERENCIA 90.xlsx" --json salida.json
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import XLSX from 'xlsx';
import { extraerFotosDeExcel, agruparFotosUnicas, asociarFotosAFilas } from './lib/excel-photos.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const ROBOT = process.env.ROBOT_URL || 'http://127.0.0.1:3001';

global.window = {};
require(path.join(ROOT, 'web/js/admin-lote-workflow.js'));
require(path.join(ROOT, 'web/js/admin-lote-photo-review.js'));
const { AdminLoteWorkflow, AdminLotePhotoReview } = global.window;

const archivo = process.argv[2];
const salidaJson = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
if (!archivo) { console.error('uso: node scripts/pedido-con-fotos.mjs <archivo.xlsx> [--json salida.json]'); process.exit(1); }

/** Filas de datos del pedido, ya en el formato que espera el admin. */
function leerFilas(ruta) {
  const wb = XLSX.readFile(ruta);
  const filas = XLSX.utils.sheet_to_json(wb.Sheets.ORDER, { header: 1, blankrows: false });
  // Se salta el encabezado y se recortan las columnas del resumen lateral.
  return filas.slice(2)
    .filter((fila) => fila[1] && fila[3])
    .map((fila) => fila.slice(1, 12).map((celda) => (celda == null ? '' : String(celda))));
}

function claveDeFila(cols) {
  return String(cols[2] || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function main() {
  const filas = leerFilas(archivo);
  const claves = filas.map(claveDeFila);
  const productos = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/productos.json'), 'utf8'));
  const items = filas.map((cols) => AdminLoteWorkflow.buildLoteItemFromColumns(cols, productos));

  const fotosPorClave = asociarFotosAFilas(await agruparFotosUnicas(extraerFotosDeExcel(archivo)), claves);
  console.log(`${filas.length} filas | ${new Set(claves).size} referencias | ${fotosPorClave.size} con foto en el excel\n`);

  // Se agrupan las filas por referencia para buscar una sola vez por camiseta.
  const grupos = new Map();
  items.forEach((item, i) => {
    const clave = claves[i];
    if (!grupos.has(clave)) {
      grupos.set(clave, { clave, titulo: item.queryStr, descripcion: item.rawDescription, extras: item.extrasText, tipo: item.type, prodId: item.prodId, filas: [] });
    }
    grupos.get(clave).filas.push({ talla: item.size, cantidad: item.qty });
  });

  const resultados = [];
  for (const grupo of grupos.values()) {
    const foto = fotosPorClave.get(grupo.clave);
    process.stdout.write(`→ ${grupo.titulo}\n`);

    const cuerpo = {
      type: grupo.tipo,
      description: grupo.descripcion,
      extrasText: grupo.extras,
      maxCandidates: 6,
    };
    if (foto) cuerpo.referencePhotoBase64 = foto.buffer.toString('base64');
    else console.log('   (sin foto en el excel: se elige a mano)');

    let data;
    const t0 = process.hrtime.bigint();
    try {
      const res = await fetch(`${ROBOT}/api/match-provider-photo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
      });
      data = await res.json();
    } catch (err) {
      console.log(`   ERROR de conexion: ${err.message}\n`);
      continue;
    }
    const segs = (Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1);

    const ranking = data.ranking || [];
    if (!ranking.length) {
      console.log(`   ${segs}s  SIN RESULTADOS (${data.decision})\n`);
      resultados.push({ ...grupo, decision: data.decision, ganador: null, ranking: [] });
      continue;
    }

    console.log(`   ${segs}s  ${JSON.stringify(data.searchInfo?.queries)} -> decision: ${data.decision}`);
    ranking.slice(0, 4).forEach((r, i) => {
      const puntaje = r.score == null ? '   -  ' : `${(r.score * 100).toFixed(1)}%`;
      console.log(`     ${i === 0 ? '>' : ' '} ${puntaje}  ${r.title}  (${r.photoCount} fotos)`);
    });
    if (data.gap != null) console.log(`     ventaja sobre el 2do: ${(data.gap * 100).toFixed(1)} puntos`);
    console.log();

    resultados.push({
      clave: grupo.clave,
      titulo: grupo.titulo,
      tipo: grupo.tipo,
      prodIdExistente: grupo.prodId || null,
      filas: grupo.filas,
      decision: data.decision,
      queries: data.searchInfo?.queries || [],
      ganador: data.winner || ranking[0] || null,
      ranking: ranking.map((r) => ({ title: r.title, score: r.score, store: r.store, yupooUrl: r.yupooUrl, photoUrls: r.photoUrls })),
    });
  }

  const auto = resultados.filter((r) => r.decision === 'auto').length;
  const confirmar = resultados.filter((r) => r.decision === 'confirm').length;
  const aMano = resultados.length - auto - confirmar;
  console.log(`RESUMEN: ${auto} automaticas | ${confirmar} para confirmar | ${aMano} a mano`);

  if (salidaJson) {
    fs.writeFileSync(salidaJson, JSON.stringify(resultados, null, 1));
    console.log(`\nguardado en ${salidaJson}`);
  }
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
