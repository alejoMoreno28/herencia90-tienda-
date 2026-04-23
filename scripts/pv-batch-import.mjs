/**
 * scripts/pv-batch-import.mjs
 * Importa las 20 camisetas top de una vez
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch(e) {}

const require = createRequire(import.meta.url);
const { importFromYupoo } = require('../api/preventa-yupoo-import.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PRECIOS = { 'fan': 99000, 'player': 110000, 'manga-larga': 110000, 'retro': 120000 };

function slugify(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);
}

const JERSEYS = [
  { url: 'https://huiliyuan.x.yupoo.com/albums/138398077?uid=1', equipo: 'Real Madrid', temporada: '1998-00', tipo: 'retro', categoria: 'clubes', decada: '90s', destacado: true },
  { url: 'https://huiliyuan.x.yupoo.com/albums/169972928?uid=1', equipo: 'Real Madrid', temporada: '2003-04', tipo: 'retro', categoria: 'clubes', decada: '2000s' },
  { url: 'https://huiliyuan.x.yupoo.com/albums/153535268?uid=1', equipo: 'Real Madrid Visitante', temporada: '2010-11', tipo: 'retro', categoria: 'clubes', decada: '2010s' },
  { url: 'https://huiliyuan.x.yupoo.com/albums/136940292?uid=1', equipo: 'Real Madrid Visitante 2', temporada: '2016-17', tipo: 'retro', categoria: 'clubes', decada: '2010s' },
  { url: 'https://huiliyuan.x.yupoo.com/albums/139719518?uid=1', equipo: 'AC Milan', temporada: '2006-07', tipo: 'retro', categoria: 'clubes', decada: '2000s', destacado: true },
  { url: 'https://huiliyuan.x.yupoo.com/albums/112820576?uid=1', equipo: 'Barcelona', temporada: '2005-06', tipo: 'retro', categoria: 'clubes', decada: '2000s' },
  { url: 'https://huiliyuan.x.yupoo.com/albums/129827604?uid=1', equipo: 'Barcelona', temporada: '2012-13', tipo: 'retro', categoria: 'clubes', decada: '2010s' },
  { url: 'https://huiliyuan.x.yupoo.com/albums/190183234?uid=1', equipo: 'Chelsea', temporada: '2006-07', tipo: 'retro', categoria: 'clubes', decada: '2000s' },
  { url: 'https://huiliyuan.x.yupoo.com/albums/191470286?uid=1', equipo: 'Porto', temporada: '2010-11', tipo: 'retro', categoria: 'clubes', decada: '2010s' },
  { url: 'https://huiliyuan.x.yupoo.com/albums/159835553?uid=1', equipo: 'Santos', temporada: '2013', tipo: 'retro', categoria: 'clubes', decada: '2010s', destacado: true },
  { url: 'https://huiliyuan.x.yupoo.com/albums/189751160?uid=1', equipo: 'River Plate', temporada: '1996-97', tipo: 'retro', categoria: 'clubes', decada: '90s' }
];


async function importOne(j, index) {
  const slug = slugify(`${j.equipo} ${j.temporada}`);
  console.log(`\n[${index+1}/20] 📦 ${j.equipo} ${j.temporada}...`);

  try {
    const result = await importFromYupoo({
      yupoo_album_url: j.url,
      slug_hint: slug,
      max_imagenes: 8,
    });
    console.log(`   ✅ ${result.imagenes.length} fotos subidas`);

    const row = {
      slug,
      equipo: j.equipo,
      temporada: j.temporada,
      tipo: j.tipo,
      categoria: j.categoria,
      decada: j.decada || '',
      imagenes: result.imagenes,
      yupoo_origen: j.url,
      precio_aprox: PRECIOS[j.tipo] || 99000,
      publicado: true,
      destacado: j.destacado || false,
      descripcion: `${j.equipo} ${j.temporada} - ${j.tipo}`,
      tags: [j.equipo.toLowerCase(), j.temporada, j.tipo],
    };

    const { data, error } = await supabase.from('preventa_catalogo').insert(row).select('id').single();
    if (error) throw new Error(error.message);
    console.log(`   🎉 ID: ${data.id}`);
    return true;
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`🚀 Importando 20 camisetas top...\n`);
  let ok = 0, fail = 0;

  for (let i = 0; i < JERSEYS.length; i++) {
    const success = await importOne(JERSEYS[i], i);
    if (success) ok++; else fail++;
    // Small delay to avoid rate limits
    if (i < JERSEYS.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`✅ Importadas: ${ok}/20`);
  if (fail) console.log(`❌ Fallidas: ${fail}/20`);
  console.log(`🌐 Refresca preventa.html para ver el catálogo completo.`);
}

main();
