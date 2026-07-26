/**
 * scripts/revisar-pedido.mjs
 *
 * Arma una pagina para revisar a ojo lo que encontro el robot: al lado
 * izquierdo la foto del excel (la verdad) y al derecho los candidatos del
 * proveedor con su puntaje. Asi se confirma en segundos si el elegido es el
 * correcto, sin tener que abrir yupoo album por album.
 *
 * Uso:
 *   node scripts/revisar-pedido.mjs "PEDIDO5HERENCIA 90.xlsx" _p5_match.json revision.html
 *   node scripts/revisar-pedido.mjs ... --solo-dudosas
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { extraerFotosDeExcel, agruparFotosUnicas, asociarFotosAFilas } from './lib/excel-photos.mjs';
import { downloadYupooPhoto } from './lib/yupoo-search.mjs';
import XLSX from 'xlsx';

const [rutaExcel, rutaJson, rutaSalida = 'revision-pedido.html'] = process.argv.slice(2);
const soloDudosas = process.argv.includes('--solo-dudosas');
if (!rutaExcel || !rutaJson) {
  console.error('uso: node scripts/revisar-pedido.mjs <excel> <match.json> [salida.html] [--solo-dudosas]');
  process.exit(1);
}

function clavesDeFilas(ruta) {
  const wb = XLSX.readFile(ruta);
  return XLSX.utils.sheet_to_json(wb.Sheets.ORDER, { header: 1, blankrows: false })
    .slice(2)
    .filter((f) => f[1] && f[3])
    .map((f) => String(f[3] || '').trim().toLowerCase().replace(/\s+/g, ' '));
}

const escapar = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function main() {
  const resultados = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
  const fotosExcel = asociarFotosAFilas(await agruparFotosUnicas(extraerFotosDeExcel(rutaExcel)), clavesDeFilas(rutaExcel));

  const aRevisar = soloDudosas ? resultados.filter((r) => r.decision !== 'auto') : resultados;
  const bloques = [];

  for (const item of aRevisar) {
    const fotoExcel = fotosExcel.get(item.clave);
    const referencia = fotoExcel
      ? `<img src="data:image/${fotoExcel.ext};base64,${fotoExcel.buffer.toString('base64')}" alt="foto del excel">`
      : '<div class="sinfoto">sin foto en el excel</div>';

    const candidatos = [];
    for (const [i, cand] of item.ranking.slice(0, 4).entries()) {
      let miniatura = '<div class="sinfoto">sin miniatura</div>';
      const url = (cand.photoUrls || [])[0];
      if (url) {
        try {
          const buf = await downloadYupooPhoto(url, cand.store);
          miniatura = `<img src="data:image/jpeg;base64,${buf.toString('base64')}" alt="candidato">`;
        } catch { /* se deja el marcador de sin miniatura */ }
      }
      const puntaje = cand.score == null ? '-' : `${(cand.score * 100).toFixed(1)}%`;
      candidatos.push(`
        <figure class="cand ${i === 0 ? 'elegido' : ''}">
          ${miniatura}
          <figcaption>
            <b>${puntaje}</b> ${i === 0 ? '<span class="tag">elegido</span>' : ''}<br>
            <span class="titulo">${escapar(cand.title)}</span><br>
            <a href="${escapar(cand.yupooUrl)}" target="_blank" rel="noopener">ver en el proveedor</a>
          </figcaption>
        </figure>`);
    }

    const tallas = item.filas.map((f) => `${f.talla} x${f.cantidad}`).join(', ');
    const estado = item.decision === 'auto'
      ? '<span class="badge ok">automatica</span>'
      : '<span class="badge duda">revisar</span>';

    bloques.push(`
      <section>
        <h2>${escapar(item.titulo)} ${estado}</h2>
        <p class="meta">${escapar(item.tipo)} &middot; ${escapar(tallas)} &middot; busco: ${escapar((item.queries || []).join(' / '))}
          ${item.prodIdExistente ? `&middot; ya existe en catalogo (id ${item.prodIdExistente})` : ''}</p>
        <div class="fila">
          <figure class="ref">${referencia}<figcaption>foto del excel</figcaption></figure>
          <div class="cands">${candidatos.join('')}</div>
        </div>
      </section>`);
  }

  const html = `<!doctype html>
<meta charset="utf-8">
<title>Revision del pedido</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; background: #fafafa; color: #111; }
  h1 { font-size: 20px; }
  section { background: #fff; border: 1px solid #e3e3e3; border-radius: 10px; padding: 16px; margin-bottom: 18px; }
  h2 { font-size: 16px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 13px; margin: 0 0 12px; }
  .fila { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
  .ref img { width: 190px; border-radius: 8px; border: 3px solid #111; display: block; }
  .cands { display: flex; gap: 12px; flex-wrap: wrap; }
  .cand img { width: 130px; border-radius: 8px; display: block; }
  .cand { margin: 0; padding: 6px; border-radius: 10px; border: 2px solid transparent; }
  .cand.elegido { border-color: #1a7f37; background: #f2fbf4; }
  figcaption { font-size: 12px; margin-top: 6px; max-width: 140px; line-height: 1.35; }
  .ref figcaption { font-weight: 600; max-width: 190px; }
  .titulo { color: #333; }
  .tag { background: #1a7f37; color: #fff; border-radius: 4px; padding: 1px 5px; font-size: 11px; }
  .badge { font-size: 12px; border-radius: 5px; padding: 2px 7px; vertical-align: middle; }
  .badge.ok { background: #e6f4ea; color: #1a7f37; }
  .badge.duda { background: #fff3cd; color: #8a6100; }
  .sinfoto { width: 130px; height: 130px; background: #eee; border-radius: 8px; display: grid; place-items: center; font-size: 11px; color: #888; }
</style>
<h1>Revision del pedido &mdash; ${aRevisar.length} referencia(s)</h1>
<p class="meta">A la izquierda la foto del excel. A la derecha lo que encontro el robot, con el elegido en verde.</p>
${bloques.join('')}`;

  fs.writeFileSync(rutaSalida, html, 'utf8');
  console.log(`${aRevisar.length} referencias -> ${path.resolve(rutaSalida)}`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
