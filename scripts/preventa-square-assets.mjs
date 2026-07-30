import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export const MASTER_SIZE = 1200;
export const CARD_SIZE = 640;
export const MASTER_FIT = 1168;
export const CARD_FIT = 620;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'preventa';
}

export async function alphaStats(input) {
  const { data, info } = await sharp(input)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;
  let transparent = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[((y * info.width + x) * 4) + 3];
      if (alpha <= 12) {
        transparent += 1;
        continue;
      }
      foreground += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error(`No foreground alpha found in ${filePath}`);
  }

  const total = info.width * info.height;
  return {
    bbox: {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    transparentRatio: transparent / total,
    foregroundRatio: foreground / total,
    width: info.width,
    height: info.height,
  };
}

export async function buildSquareAssetBuffer(inputBuffer, size, fitSize) {
  const foreground = await sharp(inputBuffer)
    .resize({
      width: fitSize,
      height: fitSize,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const meta = await sharp(foreground).metadata();
  const left = Math.round((size - meta.width) / 2);
  const top = Math.round((size - meta.height) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: foreground, left, top }])
    .webp({
      quality: size === MASTER_SIZE ? 88 : 84,
      effort: 5,
      alphaQuality: 92,
    })
    .toBuffer();
}

async function processImage({ input, slug, outDir, minTransparentRatio, force }) {
  const inputPath = path.resolve(root, input);
  const outputDir = path.resolve(root, outDir);
  const cleanSlug = slugify(slug || path.basename(inputPath, path.extname(inputPath)));
  const stats = await alphaStats(inputPath);

  if (!force && stats.transparentRatio < minTransparentRatio) {
    throw new Error(
      `${input} does not look background-removed yet. Transparent pixels: ${(stats.transparentRatio * 100).toFixed(1)}%. Use --force only for manual review assets.`
    );
  }

  await fs.mkdir(outputDir, { recursive: true });

  const cropped = await sharp(inputPath)
    .rotate()
    .ensureAlpha()
    .extract(stats.bbox)
    .png()
    .toBuffer();

  const masterPath = path.join(outputDir, `${cleanSlug}-1200.webp`);
  const cardPath = path.join(outputDir, `${cleanSlug}-card.webp`);

  const masterBuffer = await buildSquareAssetBuffer(cropped, MASTER_SIZE, MASTER_FIT);
  const cardBuffer = await buildSquareAssetBuffer(cropped, CARD_SIZE, CARD_FIT);
  await fs.writeFile(masterPath, masterBuffer);
  await fs.writeFile(cardPath, cardBuffer);

  return {
    slug: cleanSlug,
    source: path.relative(root, inputPath).replaceAll('\\', '/'),
    master: path.relative(root, masterPath).replaceAll('\\', '/'),
    card: path.relative(root, cardPath).replaceAll('\\', '/'),
    sourceSize: `${stats.width}x${stats.height}`,
    foregroundRatio: Number(stats.foregroundRatio.toFixed(4)),
    transparentRatio: Number(stats.transparentRatio.toFixed(4)),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input;
  if (!input) {
    throw new Error('Usage: node scripts/preventa-square-assets.mjs --input path/to/no-bg.png --slug barcelona-2008 --out-dir web/img/preventa-curada');
  }

  const result = await processImage({
    input,
    slug: args.slug,
    outDir: args['out-dir'] || 'web/img/preventa-curada',
    minTransparentRatio: Number(args['min-transparent-ratio'] || 0.08),
    force: Boolean(args.force),
  });

  console.log(JSON.stringify(result, null, 2));
}

// Este archivo tambien se importa como libreria (process-photo y el cargador
// usan buildSquareAssetBuffer). Sin esta guarda, importarlo corria el programa
// de linea de comandos: imprimia el modo de uso y dejaba el codigo de salida en
// 1 aunque todo hubiera ido bien.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
