/**
 * scripts/limpiar-preventa.mjs
 *
 * Arma la galeria limpia de cada camiseta bajo pedido a partir de las fotos
 * que trajo el proveedor (preventa_catalogo.imagenes): le quita el fondo a cada
 * una y se queda solo con las que muestran la camiseta entera, con la misma
 * regla del cargador (esCamisetaEntera + CLIP). Pone primero el frente.
 *
 * Antes la tarjeta usaba un recorte de junio, pero el detalle y la pagina de
 * cada camiseta mostraban todas las fotos del proveedor, con fondo y con los
 * acercamientos.
 *
 * Igual que limpiar-galerias.mjs, trabaja en dos pasos:
 *
 *   node --env-file=.env scripts/limpiar-preventa.mjs <dir>            prueba: recorta, guarda en <dir> y arma hojas de contacto
 *   node --env-file=.env scripts/limpiar-preventa.mjs <dir> --aplicar  sube lo que quedo en <dir> y actualiza preventa_catalogo
 *
 * Las fotos originales del proveedor no se borran: quedan en `fuente` de cada
 * foto nueva y en el respaldo de backups/. Una camiseta sin ninguna foto entera
 * se deja como esta.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { medirMascara, esCamisetaEntera, pareceCamiseta, coloresEnElPecho } from '../api/process-photo.mjs';
import { alphaStats, buildSquareAssetBuffer, MASTER_SIZE, CARD_SIZE, MASTER_FIT, CARD_FIT } from './preventa-square-assets.mjs';

const PHOTO_SERVICE = process.env.PHOTO_SERVICE_URL || 'http://127.0.0.1:5055';
const BUCKET = 'preventa-images';
// La ruta lleva "preventa-curated" para que las paginas la reconozcan como galeria limpia.
const PREFIJO = 'preventa-curated/limpieza-20261023';
const RECORTE_CLIP_MINIMO = 0.5;
const MAXIMO_FOTOS = 4;
const ANCHO_MINIMO_PREVENTA = 0.4;
const [dir, flag] = process.argv.slice(2);
if (!dir) throw new Error('uso: limpiar-preventa.mjs <dir> [--aplicar]');
const aplicar = flag === '--aplicar';
const soloSlugs = (process.env.SOLO_SLUGS || '').split(',').filter(Boolean);
fs.mkdirSync(dir, { recursive: true });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// El almacenamiento responde 429 si se le piden muchas fotos seguidas.
async function bajar(url) {
  for (let intento = 0; intento < 5; intento++) {
    const res = await fetch(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} al bajar ${url}`);
    await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
  }
  throw new Error(`no se pudo bajar ${url}`);
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

// Huella visual (dHash 8x8): el proveedor sube la misma foto con otro archivo.
async function huellaVisual(buffer) {
  const { data } = await sharp(buffer).flatten({ background: '#ffffff' }).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  return bits;
}
const distancia = (a, b) => [...a].reduce((n, c, i) => n + (c !== b[i] ? 1 : 0), 0);

const urlDe = (img) => (typeof img === 'string' ? img : img?.url || img?.master_url || '');

async function hojaDeContacto(celdas, archivo) {
  const W = 170; const cols = 8; const filas = Math.ceil(celdas.length / cols);
  const comp = []; let svg = '';
  for (const [k, c] of celdas.entries()) {
    const x = (k % cols) * (W + 6); const y = Math.floor(k / cols) * (W + 22);
    svg += `<text x="${x + 2}" y="${y + 14}" font-size="11" font-family="Arial" fill="${c.color}">${c.texto}</text>`;
    comp.push({ input: await sharp(c.buffer).flatten({ background: '#cfd8e3' }).resize(W, W, { fit: 'contain', background: '#cfd8e3' }).png().toBuffer(), left: x, top: y + 18 });
  }
  const ancho = cols * (W + 6); const alto = Math.max(1, filas) * (W + 22) + 4;
  await sharp({ create: { width: ancho, height: alto, channels: 3, background: '#fff' } })
    .composite([{ input: Buffer.from(`<svg width="${ancho}" height="${alto}">${svg}</svg>`), left: 0, top: 0 }, ...comp])
    .png().toFile(archivo);
}

const { data: items, error } = await supabase.from('preventa_catalogo').select('id,slug,equipo,temporada,tipo,imagenes').order('slug');
if (error) throw error;
const planPath = path.join(dir, 'plan.json');

if (!aplicar) {
  const plan = fs.existsSync(planPath) ? JSON.parse(fs.readFileSync(planPath, 'utf8')) : [];
  const hechos = new Set(plan.map((p) => p.slug));
  for (const it of items) {
    if (soloSlugs.length && !soloSlugs.includes(it.slug)) continue;
    if (hechos.has(it.slug)) continue;
    const fotos = (Array.isArray(it.imagenes) ? it.imagenes : []).map(urlDe).filter(Boolean);
    const enteras = []; const celdas = []; const vistas = new Set();
    for (const [i, url] of fotos.entries()) {
      try {
        const original = await bajar(url);
        const huella = original.length + ':' + original.subarray(0, 64).toString('hex');
        if (vistas.has(huella)) continue;
        vistas.add(huella);
        const r = await quitarFondo(original);
        const medidas = r.recortada ? await medirMascara(r.buffer) : { ancho: 0 };
        // Las fotos del proveedor suelen tener la camiseta chica dentro del cuadro,
        // asi que el ancho y la ocupacion del cargador (pensados para frenar escudos
        // sueltos) las descartaban. Aqui los escudos los frena CLIP y los
        // acercamientos la regla de bordes; del tamano solo se pide un minimo.
        const tamanoMinimo = (medidas.ancho || 0) >= ANCHO_MINIMO_PREVENTA;
        if (tamanoMinimo && esCamisetaEntera({ ...r, ...medidas, proporcion: 1, ancho: 1 }) && await pareceCamiseta(r.buffer, RECORTE_CLIP_MINIMO)) {
          const huellaFoto = await huellaVisual(r.buffer);
          if (enteras.some((e) => distancia(e.huella, huellaFoto) <= 6)) {
            celdas.push({ buffer: original, texto: `#${i} repetida`, color: '#85692f' });
            continue;
          }
          enteras.push({ i, fuente: url, buffer: r.buffer, huella: huellaFoto, colores: await coloresEnElPecho(r.buffer) });
        } else {
          celdas.push({ buffer: original, texto: `#${i} se saca`, color: '#a1281e' });
        }
      } catch (err) {
        celdas.push({ buffer: await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).png().toBuffer(), texto: `#${i} error`, color: '#a1281e' });
        console.log(`  ${it.slug} #${i}: ${err.message}`);
      }
    }
    // Primero el frente (mas colores en el pecho), despues la espalda.
    enteras.sort((a, b) => b.colores - a.colores);
    const elegidas = enteras.slice(0, MAXIMO_FOTOS);
    const pasos = [];
    for (const [n, f] of elegidas.entries()) {
      const archivo = path.join(dir, `${it.slug}-${n + 1}.png`);
      fs.writeFileSync(archivo, f.buffer);
      pasos.push({ archivo, fuente: f.fuente, papel: n === 0 ? 'front' : n === 1 ? 'back' : 'extra' });
      celdas.unshift({ buffer: f.buffer, texto: `${n === 0 ? 'frente' : n === 1 ? 'espalda' : 'extra'} (#${f.i})`, color: '#1f6b3a' });
    }
    plan.push({ id: it.id, slug: it.slug, equipo: it.equipo, temporada: it.temporada, tipo: it.tipo, antes: fotos.length, pasos });
    await hojaDeContacto(celdas.length ? celdas : [{ buffer: await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).png().toBuffer(), texto: 'sin fotos', color: '#a1281e' }], path.join(dir, `hoja-${it.slug}.png`));
    console.log(`${it.slug}: ${fotos.length} -> ${pasos.length}`);
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));
  }
  const sinFoto = plan.filter((p) => !p.pasos.length);
  console.log(`\nListo: ${plan.length} camisetas, ${sinFoto.length} sin ninguna foto entera. Plan en ${planPath}`);
} else {
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const respaldo = path.join('backups', `preventa-antes-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`);
  fs.writeFileSync(respaldo, JSON.stringify(items.map((p) => ({ id: p.id, slug: p.slug, imagenes: p.imagenes })), null, 2));
  console.log(`Respaldo en ${respaldo}`);
  for (const item of plan) {
    if (soloSlugs.length && !soloSlugs.includes(item.slug)) continue;
    if (!item.pasos.length) { console.log(`${item.slug}: sin foto entera, se deja como estaba`); continue; }
    const actual = items.find((p) => p.id === item.id);
    if (!actual) { console.log(`${item.slug}: ya no existe, se salta`); continue; }
    const nuevas = [];
    for (const [n, paso] of item.pasos.entries()) {
      const recorte = fs.readFileSync(paso.archivo);
      const stats = await alphaStats(recorte);
      const listo = await sharp(recorte).ensureAlpha().extract(stats.bbox).png().toBuffer();
      const master = await buildSquareAssetBuffer(listo, MASTER_SIZE, MASTER_FIT);
      const card = await buildSquareAssetBuffer(listo, CARD_SIZE, CARD_FIT);
      const base = `${PREFIJO}/${item.slug}/${item.slug}-${n + 1}`;
      for (const [ruta, buf] of [[`${base}-1200.webp`, master], [`${base}-card.webp`, card]]) {
        const { error: e } = await supabase.storage.from(BUCKET).upload(ruta, buf, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
        if (e) throw new Error(`${item.slug}: subiendo ${ruta}: ${e.message}`);
      }
      const masterUrl = supabase.storage.from(BUCKET).getPublicUrl(`${base}-1200.webp`).data.publicUrl;
      const cardUrl = supabase.storage.from(BUCKET).getPublicUrl(`${base}-card.webp`).data.publicUrl;
      nuevas.push({ url: masterUrl, path: `${base}-1200.webp`, master_url: masterUrl, card_url: cardUrl, gallery_role: paso.papel, source_url: paso.fuente });
    }
    const { error: e } = await supabase.from('preventa_catalogo').update({ imagenes: nuevas }).eq('id', item.id);
    if (e) throw new Error(`${item.slug}: ${e.message}`);
    console.log(`${item.slug}: ${item.antes} -> ${nuevas.length} fotos`);
  }
}
