/**
 * scripts/generar-fotos-card.mjs
 *
 * Genera la version liviana (640x640) de las fotos del catalogo a las que les
 * falta, y de paso recomprime las locales que quedaron pesadas.
 *
 * En la grilla de la tienda la foto se ve a 640, pero se estaba sirviendo la de
 * 1200: el doble de peso para nada. La version liviana ya se genera al subir,
 * pero solo la tienen las fotos mas nuevas.
 *
 * No toca la base de datos ni cambia ninguna ruta: solo crea archivos al lado
 * de los que ya existen, con el sufijo -card. Si algo falla, la tienda sigue
 * cayendo a la foto grande como hasta ahora.
 *
 * Uso:
 *   node --env-file=.env scripts/generar-fotos-card.mjs           (mira que falta)
 *   node --env-file=.env scripts/generar-fotos-card.mjs --hazlo   (lo genera)
 */
'use strict';

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { traerProductos } from './lib/lote-carga.mjs';
import { buildSquareAssetBuffer, CARD_SIZE, CARD_FIT } from './preventa-square-assets.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(RAIZ, 'web');

const hazlo = process.argv.includes('--hazlo');

const esCard = (u) => /-card\.webp$/i.test(u);
const cardDe = (u) => u.replace(/\.webp$/i, '-card.webp');

async function existeEnSupabase(url) {
  const r = await fetch(url, { method: 'HEAD' });
  return r.ok;
}

async function main() {
  const productos = await traerProductos();
  const urls = [...new Set(productos.flatMap((p) => p.imagenes || []).filter((u) => u && !esCard(u)))];
  const remotas = urls.filter((u) => /^https?:/i.test(u));
  const locales = urls.filter((u) => !/^https?:/i.test(u));

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  let hechas = 0;
  let yaEstaban = 0;
  let fallaron = 0;
  let ahorro = 0;

  // ── Las que viven en Supabase ────────────────────────────────────────────
  for (const url of remotas) {
    const card = cardDe(url);
    try {
      if (await existeEnSupabase(card)) { yaEstaban += 1; continue; }
      if (!hazlo) { hechas += 1; continue; }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const master = Buffer.from(await res.arrayBuffer());
      const chica = await buildSquareAssetBuffer(master, CARD_SIZE, CARD_FIT);

      // No todas viven en el mismo bucket: las de preventa estan en
      // preventa-images. El bucket y la ruta se sacan de la propia URL.
      const partes = card.match(/\/object\/public\/([^/]+)\/(.+)$/);
      if (!partes) throw new Error('la URL no tiene la forma de una foto de Supabase');
      const [, bucket, ruta] = [partes[0], partes[1], decodeURIComponent(partes[2])];
      const { error } = await supabase.storage.from(bucket).upload(ruta, chica, {
        contentType: 'image/webp', upsert: true, cacheControl: '31536000',
      });
      if (error) throw new Error(error.message);

      ahorro += master.length - chica.length;
      hechas += 1;
    } catch (err) {
      fallaron += 1;
      console.warn(`  no se pudo con ${url.split('/').pop()}: ${err.message}`);
    }
  }

  // ── Las que son archivos dentro de web/ ──────────────────────────────────
  for (const rel of locales) {
    const origen = path.join(WEB, rel.replace(/^\/+/, ''));
    const destino = path.join(WEB, cardDe(rel).replace(/^\/+/, ''));
    try {
      await fs.access(destino);
      yaEstaban += 1;
      continue;
    } catch { /* no existe, hay que crearla */ }

    try {
      if (!hazlo) { hechas += 1; continue; }
      const master = await fs.readFile(origen);
      const chica = await buildSquareAssetBuffer(master, CARD_SIZE, CARD_FIT);
      await fs.writeFile(destino, chica);
      ahorro += master.length - chica.length;
      hechas += 1;
    } catch (err) {
      fallaron += 1;
      console.warn(`  no se pudo con ${rel}: ${err.message}`);
    }
  }

  console.log(`\nfotos del catalogo: ${urls.length} (${remotas.length} en Supabase, ${locales.length} en web/)`);
  console.log(`ya tenian su version liviana: ${yaEstaban}`);
  console.log(hazlo ? `generadas ahora: ${hechas}` : `les falta: ${hechas}  (corre otra vez con --hazlo)`);
  if (fallaron) console.log(`fallaron: ${fallaron}`);
  if (hazlo && ahorro) console.log(`la grilla pesa ${(ahorro / 1048576).toFixed(1)} MB menos`);
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
