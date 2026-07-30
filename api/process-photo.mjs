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

async function removeBackground(rawBuffer) {
  const bgRes = await fetch(`${PHOTO_SERVICE}/remove-bg`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_b64: rawBuffer.toString('base64') }),
  });
  if (!bgRes.ok) throw new Error(`servicio de fotos IA fallo: ${await bgRes.text()}`);
  const { image_b64, recortada, motivo } = await bgRes.json();

  // El servicio devuelve la foto original, sin tocar, cuando el recorte se iba
  // a comer la prenda. Pasa con los primeros planos del escudo o la etiqueta:
  // la tela llena el encuadre, no hay fondo que quitar, y el modelo termina
  // recortando la camiseta y dejando el logo flotando. Esas fotos no sirven
  // para el catalogo, asi que se descartan aqui.
  if (recortada === false) {
    throw new Error(motivo || 'el recorte de fondo no funciono en esta foto');
  }
  return Buffer.from(image_b64, 'base64');
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

    for (let i = 0; i < photoUrls.length; i++) {
      try {
        const rawBuffer = await downloadYupooPhoto(photoUrls[i], store);
        const noBgBuffer = await removeBackground(rawBuffer);
        const { masterBuffer, cardBuffer } = await buildCatalogAssets(noBgBuffer);

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
        results.push({ sourceUrl: photoUrls[i], finalUrl: urlData.publicUrl, path: masterPath, cardPath });
        console.log(`[process-photo] ${i + 1}/${photoUrls.length} lista: ${masterPath} (+ card)`);
      } catch (err) {
        console.warn(`[process-photo] error en foto ${i}:`, err.message);
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
