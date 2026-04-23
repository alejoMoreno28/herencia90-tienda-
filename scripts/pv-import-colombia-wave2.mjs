import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const COLOMBIA_IMPORTS = [
  {
    slug: 'colombia-1998-local',
    equipo: 'Colombia',
    temporada: '1998',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'local',
    decada: '90s',
    url: 'https://goodman.x.yupoo.com/albums/210381641?uid=1&isSubCate=false&referrercate=390240',
    destacado: true,
  },
  {
    slug: 'colombia-2014-visitante-roja',
    equipo: 'Colombia Visitante',
    temporada: '2014',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'visitante',
    decada: '2010s',
    url: 'https://goodman.x.yupoo.com/albums/214449809?uid=1&isSubCate=false&referrercate=390240',
    destacado: false,
  },
  {
    slug: 'colombia-2024-local',
    equipo: 'Colombia',
    temporada: '2024',
    tipo: 'fan',
    categoria: 'selecciones',
    variante: 'local',
    decada: '2020s',
    url: 'https://alisports.x.yupoo.com/albums/166046679?uid=1&isSubCate=false&referrercate=108610',
    destacado: true,
  },
  {
    slug: 'colombia-2024-visitante-negra',
    equipo: 'Colombia Visitante',
    temporada: '2024',
    tipo: 'fan',
    categoria: 'selecciones',
    variante: 'visitante',
    decada: '2020s',
    url: 'https://alisports.x.yupoo.com/albums/166046618?uid=1&isSubCate=false&referrercate=108610',
    destacado: true,
  },
  {
    slug: 'colombia-2024-centenary-blanca',
    equipo: 'Colombia Centenary',
    temporada: '2024 centenary',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'local',
    decada: '2020s',
    url: 'https://soccerjerseyclub.x.yupoo.com/albums/187596656?uid=1&isSubCate=true&referrercate=411176',
    destacado: true,
  },
];

const PRECIOS = { fan: 99000, player: 110000, 'manga-larga': 110000, retro: 120000 };

function tagsFor(item) {
  return [...new Set([
    'colombia',
    'selecciones',
    item.temporada,
    item.tipo,
    item.variante,
    ...(item.slug.includes('centenary') ? ['centenary', 'centenario'] : []),
  ])];
}

async function upsertOne(item, index, total) {
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
    destacado: item.destacado,
    descripcion: `${item.equipo} ${item.temporada} - ${item.tipo}`,
    tags: tagsFor(item),
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

  for (let i = 0; i < COLOMBIA_IMPORTS.length; i += 1) {
    try {
      await upsertOne(COLOMBIA_IMPORTS[i], i, COLOMBIA_IMPORTS.length);
      ok += 1;
    } catch (error) {
      fail += 1;
      console.error(`   Import failed: ${error.message}`);
    }

    if (i < COLOMBIA_IMPORTS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  console.log('\n========================================');
  console.log(`Imported/upserted: ${ok}/${COLOMBIA_IMPORTS.length}`);
  if (fail) console.log(`Failed: ${fail}/${COLOMBIA_IMPORTS.length}`);
}

main().catch((error) => {
  console.error('[pv-import-colombia-wave2] error:', error);
  process.exitCode = 1;
});
