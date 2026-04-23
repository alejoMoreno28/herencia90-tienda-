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
    slug: 'colombia-1990-local',
    equipo: 'Colombia',
    temporada: '1990',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'local',
    decada: '90s',
    url: 'https://huiliyuan.x.yupoo.com/albums/92390560?uid=1',
    destacado: true,
  },
  {
    slug: 'colombia-1990-visitante',
    equipo: 'Colombia Visitante',
    temporada: '1990',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'visitante',
    decada: '90s',
    url: 'https://huiliyuan.x.yupoo.com/albums/96339970?uid=1',
    destacado: true,
  },
  {
    slug: 'colombia-1998-visitante',
    equipo: 'Colombia Visitante',
    temporada: '1998',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'visitante',
    decada: '90s',
    url: 'https://huiliyuan.x.yupoo.com/albums/224939485?uid=1',
    destacado: true,
  },
  {
    slug: 'colombia-2001-local',
    equipo: 'Colombia',
    temporada: '2001',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'local',
    decada: '2000s',
    url: 'https://huiliyuan.x.yupoo.com/albums/184238898?uid=1',
    destacado: true,
  },
  {
    slug: 'colombia-2014-local',
    equipo: 'Colombia',
    temporada: '2014',
    tipo: 'retro',
    categoria: 'selecciones',
    variante: 'local',
    decada: '2010s',
    url: 'https://huiliyuan.x.yupoo.com/albums/176910835?uid=1',
    destacado: false,
  },
];

function tagsFor(item) {
  return [...new Set([
    'colombia',
    'selecciones',
    item.temporada,
    item.tipo,
    item.variante,
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
    precio_aprox: 120000,
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
  console.error('[pv-import-colombia-all] error:', error);
  process.exitCode = 1;
});
