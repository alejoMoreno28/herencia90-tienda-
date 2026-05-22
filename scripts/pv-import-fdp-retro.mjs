import { createRequire } from 'module';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
} catch {}

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = 'preventa-images';
const MANIFEST_PATH = path.join(rootDir, '.codex_tmp', 'provider-photo-audit-fdp-retro-gallery', 'manifest-import-max4.json');

const TEAM_OVERRIDES = {
  'river-plate-2018-local-campeon-copa-libertadores-madrid': 'River Plate',
  'boca-juniors-1997-1998-retro-azul': 'Boca Juniors',
  'argentina-local-2006': 'Argentina',
  'napoli-1988-visitante-blanca-version-fan': 'Napoli Visitante',
  'manchester-united-2007-2008-local-cristiano-ronaldo-para-nino': 'Manchester United Niño',
  'argentina-2006-visitante': 'Argentina Visitante',
  'fiorentina-1998-local-morada-retro': 'Fiorentina',
  'boca-juniors-1997-1998-retro-blanca': 'Boca Juniors Visitante',
  'boca-juniors-2006-2007-local-azul-retro': 'Boca Juniors',
  'arsenal-2003-2004-local-roja': 'Arsenal',
  'real-madrid-2012-2013-visitante-verde-retro': 'Real Madrid Visitante',
  'argentina-1978': 'Argentina',
  'milan-2006-local-manga-larga-negra-y-roja': 'AC Milan Manga Larga',
  'juventus-2014-local-retro': 'Juventus',
  'milan-2006-manga-larga-visitante-blanca': 'AC Milan Visitante Manga Larga',
  'seleccion-colombia-1994-amarilla': 'Colombia',
  'milan-2006-visitante-negra': 'AC Milan Visitante',
  'alemania-2014-local-campeon-del-mundo': 'Alemania',
  'fiorentina-1998-visitante-blanca-retro': 'Fiorentina Visitante',
  'river-plate-arquero-verde-original': 'River Plate Arquero',
};

const DESTACADOS = new Set([
  'river-plate-2018-local-campeon-copa-libertadores-madrid',
  'argentina-local-2006',
  'argentina-2006-visitante',
  'real-madrid-2012-2013-visitante-verde-retro',
  'alemania-2014-local-campeon-del-mundo',
]);

const SELECCIONES = new Set(['Argentina', 'Argentina Visitante', 'Colombia', 'Alemania']);
const PRECIOS = { retro: 120000, fan: 99000, 'manga-larga': 120000 };

function seasonToDecada(temporada) {
  const firstYear = Number(String(temporada || '').match(/\d{4}/)?.[0] || '');
  if (!firstYear) return null;
  if (firstYear >= 1980 && firstYear < 1990) return '80s';
  if (firstYear >= 1990 && firstYear < 2000) return '90s';
  if (firstYear >= 2000 && firstYear < 2010) return '2000s';
  if (firstYear >= 2010 && firstYear < 2020) return '2010s';
  if (firstYear >= 2020 && firstYear < 2030) return '2020s';
  return null;
}

function normalizedTitle(reference) {
  return String(reference.pageTitle || reference.title || reference.slug)
    .replace(/^Camiseta\s+/i, '')
    .replace(/^Uniforme\s+/i, '')
    .replace(/^Retro\s+/i, '')
    .trim();
}

function tipoFor(reference) {
  const text = `${reference.slug} ${reference.expected?.variant || ''}`.toLowerCase();
  if (text.includes('manga-larga')) return 'manga-larga';
  if (text.includes('version-fan')) return 'fan';
  return 'retro';
}

function tagsFor(reference, equipo, temporada, tipo) {
  const title = normalizedTitle(reference).toLowerCase();
  return [...new Set([
    equipo.toLowerCase(),
    temporada,
    tipo,
    reference.expected?.variant,
    ...(reference.expected?.colors || []),
    ...title.split(/[^a-z0-9áéíóúñ]+/i).filter((word) => word.length > 3),
  ].filter(Boolean))];
}

async function uploadLocalImage(reference, image, index) {
  const sourcePath = path.join(rootDir, '.codex_tmp', 'provider-photo-audit-fdp-retro-gallery', reference.slug, image.file);
  const raw = await readFile(sourcePath);
  const buffer = await sharp(raw)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();

  const storagePath = `${reference.slug}/${index + 1}.webp`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true });
  if (error) throw new Error(`Supabase Storage: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { path: storagePath, url: data.publicUrl };
}

async function upsertReference(reference, index, total) {
  const equipo = TEAM_OVERRIDES[reference.slug] || reference.expected?.team || normalizedTitle(reference);
  const temporada = reference.expected?.season || 'Original';
  const tipo = tipoFor(reference);
  const categoria = SELECCIONES.has(equipo) ? 'selecciones' : 'clubes';
  const decada = seasonToDecada(temporada);

  console.log(`\n[${index + 1}/${total}] ${reference.slug}`);
  const imagenes = [];
  for (let i = 0; i < reference.accepted.length; i += 1) {
    const uploaded = await uploadLocalImage(reference, reference.accepted[i], i);
    imagenes.push(uploaded);
    console.log(`   Image ${i + 1}/${reference.accepted.length}: ${uploaded.path}`);
  }

  const row = {
    slug: reference.slug,
    equipo,
    temporada,
    tipo,
    categoria,
    decada,
    imagenes,
    yupoo_origen: reference.sourcePage,
    precio_aprox: PRECIOS[tipo] || 120000,
    publicado: true,
    destacado: DESTACADOS.has(reference.slug),
    descripcion: `${equipo} ${temporada} - ${tipo}`,
    tags: tagsFor(reference, equipo, temporada, tipo),
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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }

  const references = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < references.length; i += 1) {
    try {
      await upsertReference(references[i], i, references.length);
      ok += 1;
    } catch (error) {
      fail += 1;
      console.error(`   Import failed: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log(`Imported/upserted: ${ok}/${references.length}`);
  if (fail) console.log(`Failed: ${fail}/${references.length}`);
  if (fail) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[pv-import-fdp-retro] error:', error.message);
  process.exitCode = 1;
});
