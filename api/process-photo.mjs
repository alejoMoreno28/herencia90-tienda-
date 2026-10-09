/**
 * api/process-photo.mjs
 *
 * Handler LOCAL (robot de fotos). Dado un album ya CONFIRMADO por el usuario
 * (o auto-decidido con gap claro), descarga sus fotos, les quita el fondo
 * (photo_service.py / BiRefNet) y las encuadra a 1200x1200 + variante
 * -card.webp de 640x640 -- EXACTAMENTE con la misma logica ya probada en
 * scripts/preventa-square-assets.mjs, para que salgan identicas en formato,
 * peso y calidad a las que ya usa el catalogo (WebP con alpha, no PNG).
 *
 * Las sube a Supabase Storage bucket 'product-images' (el mismo del catalogo).
 */
'use strict';

import { createClient } from '@supabase/supabase-js';
import { downloadYupooPhoto } from '../scripts/lib/yupoo-search.mjs';
import { alphaStats, buildSquareAssetBuffer, MASTER_SIZE, CARD_SIZE, MASTER_FIT, CARD_FIT } from '../scripts/preventa-square-assets.mjs';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

const PHOTO_SERVICE = process.env.PHOTO_SERVICE_URL || 'http://127.0.0.1:5055';
const BUCKET = 'product-images';
const MIN_TRANSPARENT_RATIO = 0.05; // salvavidas: si sale casi sin fondo transparente, algo fallo en remove-bg

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

const COMBINING_MARKS_RE = /[̀-ͯ]/g;

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(COMBINING_MARKS_RE, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

// Lo que de verdad separa una foto de la prenda completa de un acercamiento es
// si el BORDE de la imagen quedo vacio despues de quitar el fondo: cuando se ve
// la camiseta entera hay fondo alrededor, y cuando es un acercamiento la tela se
// sale por los lados.
//
// La proporcion total no sirve para esto: el recorte del cuello de la Barcelona
// 08/09 daba 0.54, lo mismo que una camiseta entera. Mirando el borde, en ese
// album las completas dieron 0.000, 0.001 y 0.003, y los acercamientos entre
// 0.285 y 0.731.
const BORDE_LIBRE_MAX = 0.05;

// Pero el borde libre solo dice que el objeto cabe entero en la foto, y eso
// tambien lo cumple un escudo recortado. Lo que separa una camiseta entera de
// un escudo suelto es el ANCHO de la silueta: por las mangas, la camiseta
// abarca casi todo el ancho de la foto.
//
// Antes se usaba la ocupacion (minimo 35%), medida solo con camisetas colgadas.
// Las de los albumes Fan vienen ACOSTADAS sobre una tela, con mucho margen, y
// ocupan 32-36%: se tomaban por acercamientos y se publicaban con el fondo
// gris (PEDIDO 6 de octubre: Real Madrid verde, Bayern, Boca, Ghana, Barcelona).
//
// Medido en 10 albumes (scripts/medir-recortes.mjs):
//   camiseta acostada   ancho 0.84-0.89   ocupacion 0.32-0.36
//   camiseta colgada    ancho 0.78-0.96   ocupacion 0.50-0.60
//   escudo suelto       ancho 0.58-0.65   ocupacion 0.21-0.28
// Las dos condiciones van juntas para tener margen en las dos medidas.
const ANCHO_MINIMO = 0.72;
const OCUPACION_MINIMA = 0.28;

/**
 * Medidas de la silueta que dejo el borrador de fondos, relativas a la foto:
 *   ancho / alto       cuanto del cuadro abarca la silueta en cada sentido
 *   solidez            que tanto de su caja llena (una camiseta, ~0.6-0.8)
 *   hombrosSobreRuedo  ancho a la altura de las mangas dividido por el ancho
 *                      en el ruedo: la camiseta es una T, asi que da > 1.
 */
export async function medirMascara(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let minX = w; let minY = h; let maxX = -1; let maxY = -1; let fg = 0;
  const opaco = (x, y) => data[(y * w + x) * 4 + 3] > 128;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!opaco(x, y)) continue;
      fg++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { ancho: 0, alto: 0, solidez: 0, hombrosSobreRuedo: 0 };
  const bw = maxX - minX + 1; const bh = maxY - minY + 1;
  const anchoFila = (y) => {
    let a = -1; let b = -1;
    for (let x = minX; x <= maxX; x++) if (opaco(x, y)) { if (a < 0) a = x; b = x; }
    return a < 0 ? 0 : b - a + 1;
  };
  const hombros = Math.max(...[0.2, 0.25, 0.3].map((f) => anchoFila(Math.round(minY + bh * f))));
  const ruedo = Math.max(1, anchoFila(Math.round(minY + bh * 0.9)));
  return { ancho: bw / w, alto: bh / h, solidez: fg / (bw * bh), hombrosSobreRuedo: hombros / ruedo };
}

async function removeBackground(rawBuffer) {
  const bgRes = await fetch(`${PHOTO_SERVICE}/remove-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_b64: rawBuffer.toString('base64') }),
  });
  if (!bgRes.ok) throw new Error(`servicio de fotos IA fallo: ${await bgRes.text()}`);
  const { image_b64, recortada, proporcion, borde_opaco: bordeOpaco, motivo } = await bgRes.json();

  // El servicio devuelve la foto original, sin tocar, cuando el recorte se iba
  // a comer la prenda: los primeros planos del escudo o la etiqueta, donde la
  // tela llena el encuadre y no hay fondo que quitar. Aqui no se lanza error,
  // se devuelve el dato y quien llama decide.
  return {
    buffer: Buffer.from(image_b64, 'base64'),
    recortada: recortada !== false,
    proporcion: typeof proporcion === 'number' ? proporcion : null,
    bordeOpaco: typeof bordeOpaco === 'number' ? bordeOpaco : null,
    motivo,
  };
}

/**
 * Cuenta cuantos colores distintos hay en el pecho de la camiseta.
 *
 * Es lo que separa el frente de la espalda: adelante van el escudo, el
 * patrocinador y la marca, y atras la tela es lisa. En la Barcelona 08/09 el
 * frente dio 80 colores distintos y la espalda 11.
 *
 * Hace falta porque la comparacion visual no distingue una cara de la otra: aun
 * usando la foto del excel, que es de frente, CLIP ponia primero la espalda.
 */
async function coloresEnElPecho(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    const { data } = await sharp(buffer)
      .extract({
        left: Math.round(meta.width * 0.25),
        top: Math.round(meta.height * 0.2),
        width: Math.round(meta.width * 0.5),
        height: Math.round(meta.height * 0.35),
      })
      .removeAlpha()
      .resize(64, 64)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tonos = new Set();
    for (let p = 0; p < data.length; p += 3) {
      tonos.add(`${data[p] >> 5}-${data[p + 1] >> 5}-${data[p + 2] >> 5}`);
    }
    return tonos.size;
  } catch {
    return 0;
  }
}

/**
 * Deja las fotos en el orden con que se quieren ver en la ficha: frente,
 * espalda, el resto de la prenda completa, y al final los acercamientos.
 *
 * Y decide, foto por foto, si se publica el recorte o la foto tal como vino
 * del proveedor. Quitar el fondo solo tiene sentido cuando hay fondo que
 * quitar: en la camiseta colgada, que se ve entera sobre una pared. En un
 * acercamiento al escudo o al cuello la tela llena el encuadre, no hay fondo,
 * y el modelo termina recortando la prenda misma: quedan el escudo o el swoosh
 * flotando en el vacio. Esas se dejan con su fondo original, sin tocar.
 *
 * Antes se publicaban las primeras del album tal cual, y como el proveedor
 * empieza por los detalles de la tela y la etiqueta, la ficha podia terminar
 * sin una sola foto de la camiseta entera.
 */
/** Es la camiseta entera, recortada limpia: la unica que se publica. */
export function esCamisetaEntera({ recortada, bordeOpaco, proporcion, ancho }) {
  return !!recortada
    && bordeOpaco != null && bordeOpaco <= BORDE_LIBRE_MAX
    && proporcion != null && proporcion >= OCUPACION_MINIMA
    && ancho != null && ancho >= ANCHO_MINIMO;
}

async function ordenarParaLaFicha(fotos, { aMano = false } = {}) {
  // Nunca se publica una foto con fondo: en la tienda todas van recortadas y
  // grandes, y una con la pared o la tela del proveedor se ve mas chica y fuera
  // de lugar. Los acercamientos, las de maniqui que tocan el borde y los
  // recortes que se comieron la prenda se descartan.
  //
  // Tampoco dos veces la misma foto: hay albumes que la repiten.
  const vistas = new Set();
  const completas = [];
  for (const foto of fotos) {
    const huella = createHash('md5').update(foto.original).digest('hex');
    if (vistas.has(huella)) continue;
    vistas.add(huella);
    if (!foto.recortada) continue;
    const { ancho } = await medirMascara(foto.buffer);
    // Las que eligio la persona ya son camisetas enteras: no hay escudo suelto
    // que filtrar, y como pueden venir cuadradas y con margen, el ancho no dice
    // nada. Solo se pide que el recorte haya salido limpio, sin tocar el borde.
    const sirve = aMano
      ? foto.bordeOpaco != null && foto.bordeOpaco <= BORDE_LIBRE_MAX
      : esCamisetaEntera({ ...foto, ancho });
    if (sirve) completas.push({ ...foto, ancho, publicar: foto.buffer, sinFondo: true });
  }

  // Primero el frente y despues la espalda, que es el orden con que se quiere
  // ver la ficha.
  for (const foto of completas) foto.colores = await coloresEnElPecho(foto.publicar);
  completas.sort((a, b) => b.colores - a.colores);

  return completas;
}

/**
 * Produce los buffers master (1200) y card (640) en WebP.
 *
 * Cuando la foto viene con el fondo ya removido se recorta primero al
 * contenido real (igual que preventa-square-assets.mjs) para no dejar margen
 * transparente de sobra. Cuando va con su fondo original no hay nada que
 * recortar: se encuadra y ya, porque buscar el "contenido" en una foto opaca
 * daria la foto entera de todos modos.
 */
async function buildCatalogAssets(buffer, { sinFondo = true } = {}) {
  let listo = buffer;

  if (sinFondo) {
    const stats = await alphaStats(buffer);
    if (stats.transparentRatio < MIN_TRANSPARENT_RATIO) {
      throw new Error(`la foto no parece tener el fondo removido (transparente: ${(stats.transparentRatio * 100).toFixed(1)}%)`);
    }
    listo = await sharp(buffer).rotate().ensureAlpha().extract(stats.bbox).png().toBuffer();
  } else {
    listo = await sharp(buffer).rotate().ensureAlpha().png().toBuffer();
  }

  const masterBuffer = await buildSquareAssetBuffer(listo, MASTER_SIZE, MASTER_FIT);
  const cardBuffer = await buildSquareAssetBuffer(listo, CARD_SIZE, CARD_FIT);
  return { masterBuffer, cardBuffer };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // maxFotos: cuantas BUENAS se quieren. Se recorren mas de las que se piden
  // porque algunas se descartan al no poder quitarles el fondo, y sin esto el
  // producto quedaba con dos o tres fotos.
  // photosBase64 es la otra entrada posible: fotos que la persona ya tenia
  // descargadas y arrastro a la pantalla de corregir. No hay nada que bajar
  // de ningun lado, asi que se saltan directo al recorte.
  const { store, photoUrls, photosBase64, slugHint, maxFotos = 6 } = req.body || {};
  const usaBase64 = Array.isArray(photosBase64) && photosBase64.length > 0;
  if (!usaBase64 && (!Array.isArray(photoUrls) || !photoUrls.length)) {
    return res.status(400).json({ error: 'faltan photoUrls[] o photosBase64[]' });
  }
  if (!usaBase64 && !store) {
    return res.status(400).json({ error: 'falta store' });
  }
  const fuentes = usaBase64
    ? photosBase64.map((b64, i) => ({ url: `foto-manual-${i + 1}`, base64: b64 }))
    : photoUrls.map((url) => ({ url }));

  try {
    const supabase = getSupabase();
    const slug = slugify(slugHint) || `producto-${Date.now()}`;
    const timestamp = Date.now();
    const results = [];

    // Se le pasa el borrador de fondos a todas antes de decidir cuales
    // publicar: hasta no medir el recorte no se sabe cuales muestran la prenda
    // completa. Se guarda tambien la foto original, porque en los acercamientos
    // el recorte se descarta y se publica la de siempre.
    const recortadas = [];
    for (const [i, fuente] of fuentes.entries()) {
      try {
        const original = fuente.base64
          ? Buffer.from(fuente.base64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
          : await downloadYupooPhoto(fuente.url, store);
        const sinFondo = await removeBackground(original);
        recortadas.push({ ...sinFondo, original, url: fuente.url });
      } catch (err) {
        console.warn(`[process-photo] no se pudo leer o recortar la foto ${i}:`, err.message);
      }
    }

    const elegidas = await ordenarParaLaFicha(recortadas, { aMano: usaBase64 });
    console.log(`[process-photo] ${recortadas.length} fotos, ${elegidas.length} de la camiseta entera sin fondo, se publican ${Math.min(elegidas.length, maxFotos)}`);

    for (const [i, foto] of elegidas.entries()) {
      if (results.length >= maxFotos) break;
      try {
        const { masterBuffer, cardBuffer } = await buildCatalogAssets(foto.publicar, { sinFondo: foto.sinFondo });

        const masterPath = `${slug}/${timestamp}-${i + 1}.webp`;
        const cardPath = `${slug}/${timestamp}-${i + 1}-card.webp`;

        const { error: masterErr } = await supabase.storage
          .from(BUCKET)
          .upload(masterPath, masterBuffer, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
        if (masterErr) throw new Error(`subiendo master: ${masterErr.message}`);

        const { error: cardErr } = await supabase.storage
          .from(BUCKET)
          .upload(cardPath, cardBuffer, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' });
        if (cardErr) throw new Error(`subiendo card: ${cardErr.message}`);

        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(masterPath);
        results.push({ sourceUrl: foto.url, finalUrl: urlData.publicUrl, path: masterPath, cardPath, proporcion: foto.proporcion, sinFondo: foto.sinFondo });
        console.log(`[process-photo] ${masterPath} lista (${foto.sinFondo ? 'sin fondo' : 'fondo original'}, borde ${foto.bordeOpaco})`);
      } catch (err) {
        console.warn(`[process-photo] error publicando la foto ${i}:`, err.message);
      }
    }

    if (!results.length) {
      return res.status(500).json({ error: elegidas.length
        ? 'ninguna foto se pudo subir'
        : 'ninguna foto del album muestra la camiseta entera para recortarla sin fondo; sube las fotos a mano' });
    }

    return res.status(200).json({ images: results.map((r) => r.finalUrl), details: results });
  } catch (err) {
    console.error('[process-photo] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
