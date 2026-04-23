import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APPROVED_REFERENCES } from './data/preventa-approved-references.mjs';

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

const DESTACADOS = new Set([
  'real-madrid-2006-2007-local',
  'real-madrid-2011-2012-local',
  'barcelona-2008-2009-local',
  'ac-milan-2006-2007-local',
  'inter-1997-1998-local-ronaldo',
  'argentina-1994-visitante',
  'brasil-2002-local',
  'italia-2006-local',
  'santos-2011-local-neymar',
  'chelsea-2007-2008-local',
  'arsenal-2005-2006-local-burdeos',
  'portugal-2004-local',
  'francia-1998-local',
  'alemania-1990-local',
  'holanda-1988-local',
]);

function seasonToDecada(temporada) {
  const firstYear = Number(String(temporada).match(/\d{2,4}/)?.[0] || '');
  if (!firstYear) return '';
  if (firstYear >= 1980 && firstYear < 1990) return '80s';
  if (firstYear >= 1990 && firstYear < 2000) return '90s';
  if (firstYear >= 2000 && firstYear < 2010) return '2000s';
  if (firstYear >= 2010 && firstYear < 2020) return '2010s';
  if (firstYear >= 2020 && firstYear < 2030) return '2020s';
  return '';
}

function displayEquipo(reference) {
  const labels = {
    visitante: 'Visitante',
    tercera: 'Tercera',
    portero: 'Portero',
    manga_larga: 'Manga Larga',
  };

  const suffix = labels[reference.variante];
  if (!suffix || reference.variante === 'local') return reference.equipo;
  return `${reference.equipo} ${suffix}`;
}

function tagsFor(reference) {
  return [...new Set([
    reference.equipo.toLowerCase(),
    reference.temporada,
    reference.tipo,
    reference.variante,
    ...(reference.player ? [reference.player.toLowerCase()] : []),
  ])];
}

function loadMatches(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function buildImportList(matchData) {
  return APPROVED_REFERENCES.map((reference) => {
    const matchRow = matchData.matches.find((item) => item.slug === reference.slug);
    return {
      reference,
      match: matchRow?.matches?.[0] || null,
    };
  });
}

async function upsertOne(reference, match, index, total) {
  const equipo = displayEquipo(reference);
  console.log(`\n[${index + 1}/${total}] ${reference.slug}`);
  console.log(`   Album: ${match.url}`);

  const result = await importFromYupoo({
    yupoo_album_url: match.url,
    slug_hint: reference.slug,
    max_imagenes: 8,
  });

  const row = {
    slug: reference.slug,
    equipo,
    temporada: reference.temporada,
    tipo: reference.tipo,
    categoria: reference.categoria,
    decada: seasonToDecada(reference.temporada),
    imagenes: result.imagenes,
    yupoo_origen: match.url,
    precio_aprox: PRECIOS[reference.tipo] || 99000,
    publicado: true,
    destacado: DESTACADOS.has(reference.slug),
    descripcion: `${equipo} ${reference.temporada} - ${reference.tipo}`,
    tags: tagsFor(reference),
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
  const matchesPath = process.argv[2] || path.join(__dirname, '..', 'docs', 'provider-catalog-matches-huiliyuan.json');
  const matchData = loadMatches(matchesPath);
  const imports = buildImportList(matchData);
  const ready = imports.filter((item) => item.match);
  const missing = imports.filter((item) => !item.match);

  console.log(`Ready to import: ${ready.length}`);
  console.log(`Missing exact provider match: ${missing.length}`);
  if (missing.length) {
    console.log(`Missing slugs: ${missing.map((item) => item.reference.slug).join(', ')}`);
  }

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < ready.length; i += 1) {
    try {
      await upsertOne(ready[i].reference, ready[i].match, i, ready.length);
      ok += 1;
    } catch (error) {
      fail += 1;
      console.error(`   Import failed: ${error.message}`);
    }
    if (i < ready.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  console.log('\n========================================');
  console.log(`Imported/upserted: ${ok}/${ready.length}`);
  if (fail) console.log(`Failed: ${fail}/${ready.length}`);
  if (missing.length) console.log(`Still missing from provider: ${missing.length}`);
}

main().catch((error) => {
  console.error('[pv-import-approved-from-matches] error:', error);
  process.exitCode = 1;
});
