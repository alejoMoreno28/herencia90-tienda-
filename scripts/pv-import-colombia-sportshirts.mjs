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
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const BUCKET = 'preventa-images';
const REFERER = 'https://www.sportshirts.co/productos/colombia-edicion-classic-retro/';

const SPORTSHIRTS_IMPORTS = [
  {
    slug: 'colombia-edicion-classic-retro',
    equipo: 'Colombia Classic Retro',
    temporada: 'Classic Retro',
    tipo: 'retro',
    categoria: 'selecciones',
    decada: '2020s',
    precio_aprox: 120000,
    destacado: true,
    source: 'https://www.sportshirts.co/productos/colombia-edicion-classic-retro/',
    tags: ['colombia', 'selecciones', 'retro', 'classic', 'algodon', 'crema'],
    images: [
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/3828126d-f963b6a39533fdf9d517248997281616-1024-1024.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/507ea60e-3e82d481bd96e6a26d17248997279966-1024-1024.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/272c12ac-91c2233eed538c215b17248997273203-1024-1024.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/8791c69c-e7727f23ab4451db6717248997273460-1024-1024.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/501cd809-060a3944d52055e9cc17248997276236-1024-1024.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/b2640c13-7c659c30cf7d04551417248997277197-1024-1024.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/zz-e1d534d1f6823976f417248997459452-1024-1024.webp',
    ],
  },
  {
    slug: 'colombia-1990-local',
    equipo: 'Colombia',
    temporada: '1990',
    tipo: 'retro',
    categoria: 'selecciones',
    decada: '90s',
    precio_aprox: 120000,
    destacado: true,
    source: 'https://www.sportshirts.co/productos/colombia-1990-local/',
    tags: ['colombia', 'selecciones', '1990', 'retro', 'local', 'valderrama'],
    images: [
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/colombia-90-retro-local-04dd051dbab6cb82fe17633566301445-640-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/0d74552c-347aa1ec72d11ee0ae17749895689362-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/98943069-c4f921187844dc99ae17753674838675-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/sg-11134201-8259z-meycj6glhhja38-a8a5dbc7ffc859145717614915447852-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/03ee4f6a-2d1a41fc7267a7d9e917749905265593-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/ae302c37-99547fedd824638e9417763708198300-480-0.webp',
    ],
  },
  {
    slug: 'colombia-1990-visitante',
    equipo: 'Colombia Visitante',
    temporada: '1990',
    tipo: 'retro',
    categoria: 'selecciones',
    decada: '90s',
    precio_aprox: 120000,
    destacado: true,
    source: 'https://www.sportshirts.co/productos/colombia-1990-visitante/',
    tags: ['colombia', 'selecciones', '1990', 'retro', 'visitante', 'roja'],
    images: [
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/anyconv-com__0fb5ae96-6993c14263e48ded4e17633566982743-640-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/sg-11134201-7rdwk-m1fuogxtylag5e-188e32823d59fe52ae17291446393697-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/cn-11134207-7r98o-lonekugklhu99f-35fc591d4c1fb2a87e17244092110811-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/86bbfff2-021c0893d7d9adcb8e17638458718411-480-0.webp',
    ],
  },
  {
    slug: 'colombia-2024-local',
    equipo: 'Colombia',
    temporada: '2024',
    tipo: 'fan',
    categoria: 'selecciones',
    decada: '2020s',
    precio_aprox: 99000,
    destacado: true,
    source: 'https://www.sportshirts.co/productos/colombia-2024-2025-local-8dwai/',
    tags: ['colombia', 'selecciones', '2024', 'local', 'amarilla', 'fan'],
    images: [
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/sin-titulo-f89f87b0d1d371c12117243055385920-640-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/5-1ab954620bfbe31ccf17243058697744-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/c6101019-e679545500dfa1858417632350150682-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/07-2a6591057562cba50617243069905598-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/03-349ce33980ec08f59917243065609188-480-0.webp',
    ],
  },
  {
    slug: 'colombia-2024-visitante-azul',
    equipo: 'Colombia Visitante Azul',
    temporada: '2024',
    tipo: 'fan',
    categoria: 'selecciones',
    decada: '2020s',
    precio_aprox: 99000,
    destacado: true,
    source: 'https://www.sportshirts.co/productos/colombia-2024-2025-visitante-jevse/',
    tags: ['colombia', 'selecciones', '2024', 'visitante', 'azul', 'fan'],
    images: [
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/3-37312535145f8e86eb17243057173228-640-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/3f51284aad552a923915b2e61f59b953-97d7f4324474b4619b17245635194892-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/c6101019-e679545500dfa1858417632350150682-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/5-1ab954620bfbe31ccf17243058697744-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/03-349ce33980ec08f59917243065609188-480-0.webp',
    ],
  },
  {
    slug: 'colombia-2024-local-player',
    equipo: 'Colombia Player Local',
    temporada: '2024',
    tipo: 'player',
    categoria: 'selecciones',
    decada: '2020s',
    precio_aprox: 110000,
    destacado: false,
    source: 'https://www.sportshirts.co/productos/colombia-2024-2025-local-player-version-gtryz/',
    tags: ['colombia', 'selecciones', '2024', 'local', 'player', 'amarilla'],
    images: [
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/70b19180f9c686fc3ea6d3dcc4870acb-bfa22bddff6c11c2fa17245578184239-640-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/3f51284aad552a923915b2e61f59b953-97d7f4324474b4619b17245635194892-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/sg-11134201-7rdwk-m1fuogxtylag5e-188e32823d59fe52ae17291446393697-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/sin-titulo-f89f87b0d1d371c12117243055385920-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/3-37312535145f8e86eb17243057173228-480-0.webp',
    ],
  },
  {
    slug: 'colombia-2024-visitante-player',
    equipo: 'Colombia Player Visitante',
    temporada: '2024',
    tipo: 'player',
    categoria: 'selecciones',
    decada: '2020s',
    precio_aprox: 110000,
    destacado: false,
    source: 'https://www.sportshirts.co/productos/colombia-2024-2025-visitante-player-version-l5ws8/',
    tags: ['colombia', 'selecciones', '2024', 'visitante', 'player', 'azul'],
    images: [
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/3f51284aad552a923915b2e61f59b953-97d7f4324474b4619b17245635194892-640-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/07-2a6591057562cba50617243069905598-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/c6101019-e679545500dfa1858417632350150682-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/3-37312535145f8e86eb17243057173228-480-0.webp',
      'https://acdn-us.mitiendanube.com/stores/005/114/469/products/7-4e2a0082a5cda1ab5a17243061472618-480-0.webp',
    ],
  },
];

async function uploadImage(url, slug, index, source) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/webp,image/*,*/*;q=0.8',
      Referer: source || REFERER,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} downloading ${url}`);

  const raw = Buffer.from(await response.arrayBuffer());
  const buffer = await sharp(raw)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();

  const storagePath = `${slug}/${index + 1}.webp`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true });
  if (error) throw new Error(`Supabase Storage: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { path: storagePath, url: data.publicUrl };
}

async function upsertItem(item, index, total) {
  console.log(`\n[${index + 1}/${total}] ${item.slug}`);
  const imagenes = [];
  for (let i = 0; i < item.images.length; i += 1) {
    const uploaded = await uploadImage(item.images[i], item.slug, i, item.source);
    imagenes.push(uploaded);
    console.log(`   Image ${i + 1}/${item.images.length}: ${uploaded.path}`);
  }

  const row = {
    slug: item.slug,
    equipo: item.equipo,
    temporada: item.temporada,
    tipo: item.tipo,
    categoria: item.categoria,
    decada: item.decada,
    imagenes,
    yupoo_origen: item.source,
    precio_aprox: item.precio_aprox,
    publicado: true,
    destacado: item.destacado,
    descripcion: `${item.equipo} ${item.temporada} - ${item.tipo}`,
    tags: item.tags,
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
  for (let i = 0; i < SPORTSHIRTS_IMPORTS.length; i += 1) {
    try {
      await upsertItem(SPORTSHIRTS_IMPORTS[i], i, SPORTSHIRTS_IMPORTS.length);
      ok += 1;
    } catch (error) {
      fail += 1;
      console.error(`   Import failed: ${error.message}`);
    }
    if (i < SPORTSHIRTS_IMPORTS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  console.log('\n========================================');
  console.log(`Imported/upserted: ${ok}/${SPORTSHIRTS_IMPORTS.length}`);
  if (fail) console.log(`Failed: ${fail}/${SPORTSHIRTS_IMPORTS.length}`);
}

main().catch((error) => {
  console.error('[pv-import-colombia-sportshirts] error:', error);
  process.exitCode = 1;
});
