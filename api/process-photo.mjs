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
// tambien lo cumple un escudo recortado. Una camiseta completa ademas OCUPA la
// foto: en los albumes medidos llena entre el 53% y el 65%, mientras que el
// escudo suelto de la Barcelona se quedaba en 24%.
const OCUPACION_MINIMA = 0.35;

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
 * espalda, el resto de la prenda completa, y al final los acercamientos. Las
 * que se rompieron al quitarles el fondo se descartan.
 *
 * Antes se publicaban las primeras del album tal cual, y como el proveedor
 * empieza por los detalles de la tela y la etiqueta, la ficha podia terminar
 * sin una sola foto de la camiseta entera.
 */
async function ordenarParaLaFicha(fotos) {
  const completas = [];
  const planos = [];
  for (const foto of fotos) {
    if (!foto.recortada) continue;
    const cabeEntera = foto.bordeOpaco != null && foto.bordeOpaco <= BORDE_LIBRE_MAX;
    const ocupaLoSuyo = foto.proporcion != null && foto.proporcion >= OCUPACION_MINIMA;
    if (cabeEntera && ocupaLoSuyo) completas.push(foto);
    else planos.push(foto);
  }

  // Entre las que muestran la prenda completa, primero el frente y despues la
  // espalda, que es el orden con que se quiere ver la ficha.
  for (const foto of completas) foto.colores = await coloresEnElPecho(foto.buffer);
  completas.sort((a, b) => b.colores - a.colores);

  return [...completas, ...planos];
}

/**
 * Dado un PNG con fondo ya removido, produce los buffers master (1200) y
 * card (640) en WebP, recortando primero al contenido real (igual que
 * preventa-square-assets.mjs) para no dejar margen transparente de sobra.
 */
async function buildCatalogAssets(noBgBuffer) {
  const stats = await alphaStats(noBgBuffer);
  if (stats.transparentRatio < MIN_TRANSPARENT_RATIO) {
    throw new Error(`la foto no parece tener el fondo removido (transparente: ${(stats.transparentRatio * 100).toFixed(1)}%)`);
  }

  const cropped = await sharp(noBgBuffer).rotate().ensureAlpha().extract(stats.bbox).png().toBuffer();

  const masterBuffer = await buildSquareAssetBuffer(cropped, MASTER_SIZE, MASTER_FIT);
  const cardBuffer = await buildSquareAssetBuffer(cropped, CARD_SIZE, CARD_FIT);
  return { masterBuffer, cardBuffer };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // maxFotos: cuantas BUENAS se quieren. Se recorren mas de las que se piden
  // porque algunas se descartan al no poder quitarles el fondo, y sin esto el
  // producto quedaba con dos o tres fotos.
  const { store, photoUrls, slugHint, maxFotos = 6 } = req.body || {};
  if (!store || !Array.isArray(photoUrls) || !photoUrls.length) {
    return res.status(400).json({ error: 'faltan store o photoUrls[]' });
  }

  try {
    const supabase = getSupabase();
    const slug = slugify(slugHint) || `producto-${Date.now()}`;
    const timestamp = Date.now();
    const results = [];

    // Se recortan todas antes de decidir cuales publicar: hasta no quitarles el
    // fondo no se sabe cuales muestran la prenda completa.
    const recortadas = [];
    for (const [i, url] of photoUrls.entries()) {
      try {
        const sinFondo = await removeBackground(await downloadYupooPhoto(url, store));
        recortadas.push({ ...sinFondo, url });
      } catch (err) {
        console.warn(`[process-photo] no se pudo bajar o recortar la foto ${i}:`, err.message);
      }
    }

    const elegidas = await ordenarParaLaFicha(recortadas);
    console.log(`[process-photo] ${recortadas.length} recortadas, ${elegidas.length} sirven, se publican ${Math.min(elegidas.length, maxFotos)}`);

    for (const [i, foto] of elegidas.entries()) {
      if (results.length >= maxFotos) break;
      try {
        const { masterBuffer, cardBuffer } = await buildCatalogAssets(foto.buffer);

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
        results.push({ sourceUrl: foto.url, finalUrl: urlData.publicUrl, path: masterPath, cardPath, proporcion: foto.proporcion });
        console.log(`[process-photo] ${masterPath} lista (opaco ${foto.proporcion})`);
      } catch (err) {
        console.warn(`[process-photo] error publicando la foto ${i}:`, err.message);
      }
    }

    if (!results.length) {
      return res.status(500).json({ error: 'ninguna foto se pudo procesar/subir' });
    }

    return res.status(200).json({ images: results.map((r) => r.finalUrl), details: results });
  } catch (err) {
    console.error('[process-photo] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
