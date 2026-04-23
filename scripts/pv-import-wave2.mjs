import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PREVENTA_WAVE2 } from './data/preventa-wave2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');

try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch {}

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { importFromYupoo } = require('../api/preventa-yupoo-import.js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PRECIOS = { fan: 99000, player: 110000, 'manga-larga': 110000, retro: 120000 };

async function importOne(item, index, total) {
  console.log(`\n[${index + 1}/${total}] ${item.slug}`);
  console.log(`   Album: ${item.url}`);
  const result = await importFromYupoo({
    yupoo_album_url: item.url,
    slug_hint: item.slug,
    max_imagenes: 8,
  });

  const row = {
    slug: item.slug,
    equipo: item.equipo,
    temporada: item.temporada,
    tipo: item.tipo,
    categoria: item.categoria,
    decada: item.decada,
    imagenes: result.imagenes,
    yupoo_origen: item.url,
    precio_aprox: PRECIOS[item.tipo] || 99000,
    publicado: true,
    destacado: false,
    descripcion: `${item.equipo} ${item.temporada} - ${item.tipo}`,
    tags: [item.equipo.toLowerCase(), item.temporada, item.tipo],
  };

  const { data, error } = await supabase
    .from('preventa_catalogo')
    .upsert(row, { onConflict: 'slug' })
    .select('id, slug')
    .single();

  if (error) throw new Error(error.message);
  console.log(`   Upsert OK: ${data.slug} (${data.id})`);
}

async function main() {
  let ok = 0;
  let fail = 0;
  for (let i = 0; i < PREVENTA_WAVE2.length; i += 1) {
    try {
      await importOne(PREVENTA_WAVE2[i], i, PREVENTA_WAVE2.length);
      ok += 1;
    } catch (error) {
      fail += 1;
      console.error(`   Import failed: ${error.message}`);
    }
    if (i < PREVENTA_WAVE2.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  console.log('\n========================================');
  console.log(`Imported/upserted: ${ok}/${PREVENTA_WAVE2.length}`);
  if (fail) console.log(`Failed: ${fail}/${PREVENTA_WAVE2.length}`);
}

main().catch((error) => {
  console.error('[pv-import-wave2] error:', error);
  process.exitCode = 1;
});
