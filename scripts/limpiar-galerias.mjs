/**
 * scripts/limpiar-galerias.mjs
 *
 * Deja todas las galerias del catalogo sin fondo. Revisa cada foto de cada
 * producto: si ya es transparente se queda igual; si trae fondo se le quita
 * con el robot y, si el recorte muestra la camiseta entera (misma regla que el
 * cargador), reemplaza a la original. Los acercamientos con fondo se sacan de
 * la galeria, porque en la tienda nunca se publica una foto con fondo.
 *
 * Trabaja en dos pasos para poder mirar antes de cambiar nada:
 *
 *   node --env-file=.env scripts/limpiar-galerias.mjs <dir>            prueba: recorta, guarda en <dir> y arma hojas de contacto
 *   node --env-file=.env scripts/limpiar-galerias.mjs <dir> --aplicar  sube lo que quedo en <dir> y actualiza los productos
 *
 * Un producto en el que no sale ninguna foto limpia se deja como esta.
 * Antes de aplicar se guarda una copia de todas las galerias en backups/.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { medirMascara, esCamisetaEntera, pareceCamiseta } from '../api/process-photo.mjs';
import { alphaStats, buildSquareAssetBuffer, MASTER_SIZE, CARD_SIZE, MASTER_FIT, CARD_FIT } from './preventa-square-assets.mjs';

const PHOTO_SERVICE = process.env.PHOTO_SERVICE_URL || 'http://127.0.0.1:5055';
const BUCKET = 'product-images';
const RECORTE_CLIP_MINIMO = 0.5;
const SITE = 'https://www.herencia90.shop';
const [dir, flag] = process.argv.slice(2);
if (!dir) throw new Error('uso: limpiar-galerias.mjs <dir> [--aplicar]');
const aplicar = flag === '--aplicar';
const soloIds = (process.env.SOLO_IDS || '').split(',').filter(Boolean).map(Number);
fs.mkdirSync(dir, { recursive: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function urlDe(imagen) {
  const raw = String(imagen || '').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${SITE}/${raw.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '')}`;
}

async function bajar(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} al bajar ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Que tanto de cada lado de la foto (una franja de 1%) cubre la prenda.
// Una camiseta entera puede tocar arriba por el gancho o abajo por el ruedo,
// pero un acercamiento se sale del cuadro por dos lados o mas.
async function ladosCubiertos(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const franja = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  const opaco = (x, y) => data[(y * w + x) * 4 + 3] > 128;
  const lado = (enLinea) => {
    let total = 0; let opacos = 0;
    enLinea((x, y) => { total++; if (opaco(x, y)) opacos++; });
    return opacos / total;
  };
  const filas = (y0, y1) => (fn) => { for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) fn(x, y); };
  const cols = (x0, x1) => (fn) => { for (let x = x0; x < x1; x++) for (let y = 0; y < h; y++) fn(x, y); };
  return [lado(filas(0, franja)), lado(filas(h - franja, h)), lado(cols(0, franja)), lado(cols(w - franja, w))];
}

// 'limpia': transparente y la camiseta cabe entera. 'cortada': transparente
// pero es un acercamiento que se sale del cuadro (se ve como un recorte feo).
// 'fondo': trae fondo y hay que quitarselo.
async function estadoDe(buffer) {
  const stats = await alphaStats(buffer);
  if (stats.transparentRatio < 0.05) return 'fondo';
  // Un proceso viejo guardaba la foto con su fondo original encuadrada dentro
  // de un margen transparente: parece recortada, pero adentro es un rectangulo
  // lleno. Se trata como foto con fondo.
  const { solidez } = await medirMascara(buffer);
  if (solidez >= 0.97) return 'fondo';
  const lados = await ladosCubiertos(buffer);
  // [arriba, abajo, izquierda, derecha]: la camiseta entera no se sale por los costados.
  const porLosCostados = lados[2] > 0.15 || lados[3] > 0.15;
  return porLosCostados && lados.filter((v) => v > 0.15).length >= 2 ? 'cortada' : 'limpia';
}

async function quitarFondo(buffer) {
  const r = await (await fetch(`${PHOTO_SERVICE}/remove-bg`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_b64: buffer.toString('base64') }),
  })).json();
  return {
    buffer: Buffer.from(r.image_b64, 'base64'),
    recortada: r.recortada !== false,
    proporcion: typeof r.proporcion === 'number' ? r.proporcion : null,
    bordeOpaco: typeof r.borde_opaco === 'number' ? r.borde_opaco : null,
  };
}

async function hojaDeContacto(celdas, archivo) {
  const W = 200; const cols = 6; const filas = Math.ceil(celdas.length / cols);
  const comp = []; let svg = '';
  for (const [k, c] of celdas.entries()) {
    const x = (k % cols) * (W + 6); const y = Math.floor(k / cols) * (W + 22);
    svg += `<text x="${x + 2}" y="${y + 14}" font-size="11" fill="${c.color}">${c.texto}</text>`;
    comp.push({ input: await sharp(c.buffer).flatten({ background: '#cfd8e3' }).resize(W, W, { fit: 'contain', background: '#cfd8e3' }).png().toBuffer(), left: x, top: y + 18 });
  }
  const ancho = cols * (W + 6); const alto = Math.max(1, filas) * (W + 22) + 4;
  await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#fff' } })
    .composite([{ input: Buffer.from(`<svg width="${ancho}" height="${alto}">${svg}</svg>`), left: 0, top: 0 }, ...comp])
    .png().toFile(archivo);
}

const { data: productos, error } = await supabase.from('productos').select('id,equipo,imagenes').order('id');
if (error) throw error;
const planPath = path.join(dir, 'plan.json');

if (!aplicar) {
  const plan = [];
  for (const p of productos) {
    if (soloIds.length && !soloIds.includes(p.id)) continue;
    const imagenes = Array.isArray(p.imagenes) ? p.imagenes : [];
    if (!imagenes.length) continue;
    const pasos = [];
    const celdas = [];
    for (const [i, imagen] of imagenes.entries()) {
      try {
        const original = await bajar(urlDe(imagen));
        const estado = await estadoDe(original);
        if (estado === 'limpia' && !(await pareceCamiseta(original))) {
          pasos.push({ imagen, accion: 'sacar' });
          celdas.push({ buffer: original, texto: `#${i} se saca (detalle)`, color: '#a1281e' });
          continue;
        }
        if (estado === 'limpia') {
          pasos.push({ imagen, accion: 'queda' });
          celdas.push({ buffer: original, texto: `#${i} queda`, color: '#1f6b3a' });
          continue;
        }
        if (estado === 'cortada') {
          pasos.push({ imagen, accion: 'sacar' });
          celdas.push({ buffer: original, texto: `#${i} se saca (cortada)`, color: '#a1281e' });
          continue;
        }
        const r = await quitarFondo(original);
        const { ancho } = r.recortada ? await medirMascara(r.buffer) : { ancho: 0 };
        // Un recorte nuevo pide mas seguridad: un acercamiento de manga o cuello
        // sin fondo se parece a una camiseta y en la galeria se ve como un pedazo.
        if (esCamisetaEntera({ ...r, ancho }) && await pareceCamiseta(r.buffer, RECORTE_CLIP_MINIMO)) {
          const archivo = path.join(dir, `${p.id}-${i}.png`);
          fs.writeFileSync(archivo, r.buffer);
          pasos.push({ imagen, accion: 'recortar', archivo });
          celdas.push({ buffer: r.buffer, texto: `#${i} recortada`, color: '#85692f' });
        } else {
          pasos.push({ imagen, accion: 'sacar' });
          celdas.push({ buffer: original, texto: `#${i} se saca`, color: '#a1281e' });
        }
      } catch (err) {
        pasos.push({ imagen, accion: 'queda', error: err.message });
        celdas.push({ buffer: await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer(), texto: `#${i} error`, color: '#a1281e' });
      }
    }
    const cambia = pasos.some((s) => s.accion !== 'queda');
    const quedan = pasos.filter((s) => s.accion !== 'sacar').length;
    plan.push({ id: p.id, equipo: p.equipo, cambia, quedan, pasos });
    if (cambia) await hojaDeContacto(celdas, path.join(dir, `hoja-${p.id}.png`));
    console.log(`${p.id} ${p.equipo}: ${pasos.map((s) => s.accion[0]).join('')}${cambia ? '' : ' (sin cambios)'}`);
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  }
  const cambian = plan.filter((x) => x.cambia);
  console.log(`\nListo: ${cambian.length} productos cambian, ${plan.length - cambian.length} ya estaban limpios. Plan en ${planPath}`);
} else {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const respaldo = path.join('backups', `galerias-antes-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(respaldo, JSON.stringify(productos.map((p) => ({ id: p.id, equipo: p.equipo, imagenes: p.imagenes })), null, 2));
  console.log(`Respaldo de galerias en ${respaldo}`);
  const ts = Date.now();
  for (const item of plan.filter((x) => x.cambia)) {
    const actual = productos.find((p) => p.id === item.id);
    if (JSON.stringify(actual.imagenes) !== JSON.stringify(item.pasos.map((s) => s.imagen))) {
      console.log(`${item.id}: la galeria cambio desde la prueba, se salta`);
      continue;
    }
    const nuevas = [];
    for (const [i, paso] of item.pasos.entries()) {
      if (paso.accion === 'queda') { nuevas.push(paso.imagen); continue; }
      if (paso.accion === 'sacar') continue;
      const recorte = fs.readFileSync(paso.archivo);
      const stats = await alphaStats(recorte);
      const listo = await sharp(recorte).ensureAlpha().extract(stats.bbox).png().toBuffer();
      const master = await buildSquareAssetBuffer(listo, MASTER_SIZE, MASTER_FIT);
      const card = await buildSquareAssetBuffer(listo, CARD_SIZE, CARD_FIT);
      const base = `limpieza/${item.id}/${ts}-${i + 1}`;
      for (const [ruta, buf] of [[`${base}.webp`, master], [`${base}-card.webp`, card]]) {
        const { error: e } = await supabase.storage.from(BUCKET).upload(ruta, buf, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
        if (e) throw new Error(`${item.id}: subiendo ${ruta}: ${e.message}`);
      }
      nuevas.push(supabase.storage.from(BUCKET).getPublicUrl(`${base}.webp`).data.publicUrl);
    }
    if (!nuevas.length) { console.log(`${item.id}: no quedo ninguna foto limpia, se deja como estaba`); continue; }
    // La portada limpia va primero: si la primera era un acercamiento que se saco, sube la siguiente.
    const { error: e } = await supabase.from('productos').update({ imagenes: nuevas }).eq('id', item.id);
    if (e) throw new Error(`${item.id}: ${e.message}`);
    console.log(`${item.id} ${item.equipo}: ${item.pasos.length} -> ${nuevas.length} fotos`);
  }
}
