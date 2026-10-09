/**
 * scripts/medir-recortes.mjs
 *
 * Mide, foto por foto, lo que deja el borrador de fondos en uno o varios
 * albumes del proveedor, y arma una hoja de contacto con las medidas. Sirve
 * para calibrar la regla que decide si una foto es la camiseta entera (se
 * publica sin fondo) o un acercamiento (el recorte se descarta).
 *
 *   node scripts/medir-recortes.mjs <salida-dir> <url-album> [<url-album> ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { todasLasFotosDelAlbum, downloadYupooPhoto } from './lib/yupoo-search.mjs';
import { medirMascara } from '../api/process-photo.mjs';

const PHOTO_SERVICE = process.env.PHOTO_SERVICE_URL || 'http://127.0.0.1:5055';
const [salida, ...albumes] = process.argv.slice(2);
fs.mkdirSync(salida, { recursive: true });

for (const url of albumes) {
  const { origin: store, pathname: href } = new URL(url);
  const fotos = await todasLasFotosDelAlbum(store, href, []);
  const id = href.split('/').pop();
  const celdas = [];
  for (const [i, f] of fotos.entries()) {
    const original = await downloadYupooPhoto(f, store);
    const r = await (await fetch(`${PHOTO_SERVICE}/remove-bg`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_b64: original.toString('base64') }),
    })).json();
    const recorte = Buffer.from(r.image_b64, 'base64');
    const m = r.recortada === false ? null : await medirMascara(recorte);
    const linea = `${id} #${i} servicio:${r.recortada === false ? 'NO' : 'si'} prop:${r.proporcion} borde:${r.borde_opaco}`
      + (m ? ` ancho:${m.ancho.toFixed(2)} alto:${m.alto.toFixed(2)} solidez:${m.solidez.toFixed(2)} hombros/ruedo:${m.hombrosSobreRuedo.toFixed(2)}` : '');
    console.log(linea);
    celdas.push({ recorte, linea: `#${i} p${r.proporcion} b${r.borde_opaco}` + (m ? ` a${m.ancho.toFixed(2)} h${m.alto.toFixed(2)} s${m.solidez.toFixed(2)} t${m.hombrosSobreRuedo.toFixed(2)}` : ' NO') });
  }
  const W = 220; const cols = 5; const filas = Math.ceil(celdas.length / cols);
  const comp = []; let svg = '';
  for (const [k, c] of celdas.entries()) {
    const x = (k % cols) * (W + 6); const y = Math.floor(k / cols) * (W + 22);
    svg += `<text x="${x + 2}" y="${y + 14}" font-size="11">${c.linea}</text>`;
    comp.push({ input: await sharp(c.recorte).flatten({ background: '#9ad' }).resize(W, W, { fit: 'contain', background: '#9ad' }).png().toBuffer(), left: x, top: y + 18 });
  }
  const ancho = cols * (W + 6); const alto = filas * (W + 22) + 4;
  await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#fff' } })
    .composite([{ input: Buffer.from(`<svg width="${ancho}" height="${alto}">${svg}</svg>`), left: 0, top: 0 }, ...comp])
    .png().toFile(path.join(salida, `${id}.png`));
}
