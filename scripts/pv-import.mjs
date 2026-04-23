/**
 * scripts/pv-import.mjs
 * Uso: node scripts/pv-import.mjs <yupoo_url> <equipo> <temporada> <tipo> [categoria] [decada]
 * Ejemplo: node scripts/pv-import.mjs "https://huiliyuan.x.yupoo.com/albums/96339970?uid=1" "Selección Colombia" "1990" "retro" "selecciones" "90s"
 * 
 * tipo: fan | player | retro | manga-larga
 * categoria: selecciones | clubes
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch(e) { /* .env not found */ }

const require = createRequire(import.meta.url);
const { importFromYupoo } = require('../api/preventa-yupoo-import.js');
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
if (args.length < 4) {
  console.log('Uso: node scripts/pv-import.mjs <yupoo_url> <equipo> <temporada> <tipo> [categoria] [decada]');
  console.log('  tipo: fan | player | retro | manga-larga');
  console.log('  categoria: selecciones | clubes');
  console.log('Ejemplo:');
  console.log('  node scripts/pv-import.mjs "https://..." "Real Madrid" "2024-25" "fan" "clubes" "2020s"');
  process.exit(1);
}

const [yupoo_url, equipo, temporada, tipo, categoria, decada] = args;

const PRECIOS = {
  'fan': 99000,
  'player': 110000,
  'manga-larga': 110000,
  'retro': 120000,
};

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

async function main() {
  console.log(`\n🔍 Importando álbum Yupoo...`);
  console.log(`   URL: ${yupoo_url}`);
  console.log(`   Equipo: ${equipo}`);
  console.log(`   Temporada: ${temporada}`);
  console.log(`   Tipo: ${tipo}`);

  // 1. Scrape + upload images
  const result = await importFromYupoo({
    yupoo_album_url: yupoo_url,
    slug_hint: slugify(`${equipo} ${temporada}`),
    max_imagenes: 8,
  });

  console.log(`\n✅ ${result.imagenes.length} fotos subidas a Supabase Storage`);
  result.imagenes.forEach((img, i) => console.log(`   📸 ${i+1}. ${img.url}`));

  // 2. Insert into preventa_catalogo
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const slug = slugify(`${equipo} ${temporada}`);
  const row = {
    slug,
    equipo,
    temporada,
    tipo,
    categoria: categoria || (equipo.toLowerCase().includes('selección') ? 'selecciones' : 'clubes'),
    decada: decada || '',
    imagenes: result.imagenes,
    yupoo_origen: yupoo_url,
    precio_aprox: PRECIOS[tipo] || 99000,
    publicado: true,
    destacado: false,
    descripcion: `${equipo} ${temporada} - ${tipo}`,
    tags: [equipo.toLowerCase(), temporada, tipo],
  };

  const { data, error } = await supabase
    .from('preventa_catalogo')
    .insert(row)
    .select('id, equipo, temporada')
    .single();

  if (error) {
    console.error(`\n❌ Error insertando en DB:`, error.message);
    process.exit(1);
  }

  console.log(`\n🎉 Referencia creada exitosamente!`);
  console.log(`   ID: ${data.id}`);
  console.log(`   ${data.equipo} - ${data.temporada}`);
  console.log(`   Precio: $${PRECIOS[tipo]?.toLocaleString() || '99.000'}`);
  console.log(`\n🌐 Refresca preventa.html para verla en la galería.\n`);
}

main().catch(err => {
  console.error(`\n❌ Error:`, err.message);
  process.exit(1);
});
