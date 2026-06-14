import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const DEFAULT_SAMPLE_SLUGS = [
  'barcelona-2008-2009-local',
  'ac-milan-2006-2007-local',
  'brasil-2002-local',
];

const MASTER_SIZE = 1200;
const CARD_SIZE = 640;
const MASTER_FIT = 1168;
const CARD_FIT = 620;

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

function asArray(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function flagEnabled(args, name) {
  const value = args[name];
  if (value === true) return true;
  if (value === undefined) return false;
  return ['1', 'true', 'yes', 'si'].includes(String(value).toLowerCase());
}

function resolveFromRoot(value) {
  return path.resolve(root, value);
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll('\\', '/');
}

async function readCatalog(catalogPath) {
  const full = resolveFromRoot(catalogPath);
  return JSON.parse(await fs.readFile(full, 'utf8'));
}

function hasImages(item) {
  return Array.isArray(item.imagenes) && item.imagenes.length;
}

function selectItems(catalog, slugs, limit, includeAll) {
  if (includeAll) {
    return catalog.filter(hasImages).slice(0, limit || catalog.length);
  }

  const wanted = slugs.length ? slugs : DEFAULT_SAMPLE_SLUGS;
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));
  const selected = wanted.map((slug) => bySlug.get(slug)).filter(Boolean);

  if (selected.length) return selected.slice(0, limit || selected.length);

  return catalog
    .filter(hasImages)
    .slice(0, limit || 3);
}

function firstImageUrl(item, index) {
  const image = Array.isArray(item.imagenes) ? item.imagenes[index] : null;
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || image.src || '';
}

function selectedImageRefs(item, allImages, imageIndex) {
  if (!Array.isArray(item.imagenes)) return [];
  if (!allImages) {
    const url = firstImageUrl(item, imageIndex);
    return url ? [{ url, index: imageIndex }] : [];
  }

  return item.imagenes
    .map((image, index) => ({
      url: typeof image === 'string' ? image : image?.url || image?.src || '',
      index,
    }))
    .filter((image) => image.url);
}

function extensionFromResponse(url, contentType) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  if (['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) return ext;
  if (contentType.includes('image/webp')) return '.webp';
  if (contentType.includes('image/png')) return '.png';
  return '.jpg';
}

async function downloadImage(url, outputStem) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed ${response.status} for ${url}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const ext = extensionFromResponse(url, contentType);
  const outputPath = `${outputStem}${ext}`;
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

function existingDownloadedImage(outputStem) {
  for (const ext of ['.webp', '.png', '.jpg', '.jpeg']) {
    const candidate = `${outputStem}${ext}`;
    if (fssync.existsSync(candidate)) return candidate;
  }
  return '';
}

async function alphaStats(filePath) {
  const { data, info } = await sharp(filePath)
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
    width: info.width,
    height: info.height,
    bbox: {
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    transparentRatio: transparent / total,
    foregroundRatio: foreground / total,
  };
}

async function writeSquareAsset(inputBuffer, size, fitSize, outputPath) {
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

  await sharp({
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
    .toFile(outputPath);
}

async function createSquareAssets(noBgPath, slug, curatedDir) {
  const stats = await alphaStats(noBgPath);
  const cropped = await sharp(noBgPath)
    .rotate()
    .ensureAlpha()
    .extract(stats.bbox)
    .png()
    .toBuffer();

  const masterPath = path.join(curatedDir, `${slug}-1200.webp`);
  const cardPath = path.join(curatedDir, `${slug}-card.webp`);
  await writeSquareAsset(cropped, MASTER_SIZE, MASTER_FIT, masterPath);
  await writeSquareAsset(cropped, CARD_SIZE, CARD_FIT, cardPath);

  return {
    masterPath,
    cardPath,
    stats,
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited ${code}\n${stderr}`));
    });
  });
}

async function makeReviewCell(imagePath, label, width, height) {
  const image = await sharp(imagePath)
    .resize({
      width,
      height: height - 34,
      fit: 'contain',
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    })
    .flatten({ background: '#f8fafc' })
    .png()
    .toBuffer();

  const labelSvg = Buffer.from(`
    <svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#111214"/>
      <text x="12" y="22" font-family="Arial" font-size="14" font-weight="700" fill="#ffffff">${label}</text>
    </svg>
  `);

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#f8fafc',
    },
  })
    .composite([
      { input: image, left: 0, top: 0 },
      { input: labelSvg, left: 0, top: height - 34 },
    ])
    .png()
    .toBuffer();
}

async function createContactSheet(results, outputPath) {
  const cellW = 280;
  const cellH = 320;
  const gap = 16;
  const rowH = cellH;
  const width = (cellW * 3) + (gap * 4);
  const height = (rowH * results.length) + (gap * (results.length + 1));
  const composites = [];

  for (let row = 0; row < results.length; row += 1) {
    const item = results[row];
    const y = gap + (row * (rowH + gap));
    const original = await makeReviewCell(item.originalPath, `${item.slug} original`, cellW, cellH);
    const cutout = await makeReviewCell(item.noBgPath, 'sin fondo', cellW, cellH);
    const card = await makeReviewCell(item.cardPath, 'card 640', cellW, cellH);
    composites.push(
      { input: original, left: gap, top: y },
      { input: cutout, left: (cellW + gap) + gap, top: y },
      { input: card, left: (cellW * 2) + (gap * 3), top: y },
    );
  }

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#eef2f7',
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function createContactSheets(results, reviewDir, rowsPerSheet) {
  await fs.mkdir(reviewDir, { recursive: true });
  const sheets = [];
  const sheetCount = Math.ceil(results.length / rowsPerSheet);

  for (let index = 0; index < sheetCount; index += 1) {
    const start = index * rowsPerSheet;
    const chunk = results.slice(start, start + rowsPerSheet);
    const fileName = sheetCount === 1
      ? 'contact-sheet.png'
      : `contact-sheet-${String(index + 1).padStart(3, '0')}.png`;
    const outputPath = path.join(reviewDir, fileName);
    await createContactSheet(chunk, outputPath);
    sheets.push(outputPath);
  }

  return sheets;
}

function qualityDecision(stats) {
  const warnings = [];
  if (stats.transparentRatio < 0.08) warnings.push('poca transparencia; posible fondo no removido');
  if (stats.foregroundRatio < 0.08) warnings.push('objeto muy pequeno; posible mascara incompleta');
  if (stats.foregroundRatio > 0.78) warnings.push('objeto ocupa demasiado; posible fondo incluido');
  if (stats.bbox.width < 120 || stats.bbox.height < 120) warnings.push('bbox pequeno; revisar recorte');
  return warnings;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagEnabled(args, 'help')) {
    console.log([
      'Usage: node scripts/preventa-curate-local.mjs [options]',
      '',
      'Options:',
      '  --all                  Process every preorder reference with images.',
      '  --all-images           Process every image for each selected reference.',
      '  --slugs a,b,c          Process a specific comma-separated slug list.',
      '  --limit 24             Limit selected references.',
      '  --image-index 0        Image index when --all-images is not used.',
      '  --rows-per-sheet 18    Review rows per contact sheet.',
      '  --out-dir PATH         Output folder, defaults to .codex_tmp.',
      '  --python PATH          Local Python env with torch/transformers.',
      '  --device cpu|cuda|auto Background removal device.',
      '  --force                Regenerate existing local cutouts.',
    ].join('\n'));
    return;
  }

  const outDir = resolveFromRoot(args['out-dir'] || '.codex_tmp/preventa-curation-local');
  const catalogPath = args.catalog || 'web/preventa-catalogo-list.json';
  const python = args.python || '.codex_tmp/bg-local/venv/Scripts/python.exe';
  const model = args.model || 'ZhengPeng7/BiRefNet';
  const limit = args.limit ? Number(args.limit) : undefined;
  const imageIndex = Number(args['image-index'] || 0);
  const slugs = asArray(args.slugs);
  const includeAll = flagEnabled(args, 'all');
  const allImages = flagEnabled(args, 'all-images');
  const force = flagEnabled(args, 'force');
  const rowsPerSheet = Math.max(1, Number(args['rows-per-sheet'] || 18));
  const trustRemoteCode = args['trust-remote-code'] !== 'false';

  const originalsDir = path.join(outDir, 'originals');
  const noBgDir = path.join(outDir, 'no-bg');
  const curatedDir = path.join(outDir, 'curated');
  const reviewDir = path.join(outDir, 'review');
  await fs.mkdir(originalsDir, { recursive: true });
  await fs.mkdir(noBgDir, { recursive: true });
  await fs.mkdir(curatedDir, { recursive: true });
  await fs.mkdir(reviewDir, { recursive: true });

  const catalog = await readCatalog(catalogPath);
  const selected = selectItems(catalog, slugs, limit, includeAll);
  if (!selected.length) throw new Error('No preorder items selected');

  const jobs = [];
  const selectedMeta = [];
  for (const item of selected) {
    const slug = slugify(item.slug || item.equipo);
    const imageRefs = selectedImageRefs(item, allImages, imageIndex);
    if (!imageRefs.length) throw new Error(`No image found for ${item.slug}`);

    for (const imageRef of imageRefs) {
      const assetSlug = `${slug}-${imageRef.index + 1}`;
      const originalStem = path.join(originalsDir, assetSlug);
      const existingOriginal = force ? '' : existingDownloadedImage(originalStem);
      const originalPath = existingOriginal || await downloadImage(imageRef.url, originalStem);
      const noBgPath = path.join(noBgDir, `${assetSlug}.png`);
      if (force || !fssync.existsSync(noBgPath)) {
        jobs.push({
          slug: assetSlug,
          input: originalPath,
          output: noBgPath,
        });
      }
      selectedMeta.push({
        item,
        slug,
        assetSlug,
        imageNumber: imageRef.index + 1,
        url: imageRef.url,
        originalPath,
        noBgPath,
      });
    }
  }

  const manifestPath = path.join(outDir, 'remove-bg-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ model, jobs }, null, 2), 'utf8');

  const pythonPath = path.resolve(root, python);
  if (!fssync.existsSync(pythonPath)) {
    throw new Error(`Python env not found: ${pythonPath}`);
  }

  if (jobs.length) {
    const pythonArgs = [
      'scripts/preventa-birefnet-remove-bg.py',
      '--manifest',
      manifestPath,
      '--model',
      model,
      '--device',
      args.device || 'auto',
      '--size',
      String(args.size || 1024),
    ];
    if (trustRemoteCode) pythonArgs.push('--trust-remote-code');
    await runCommand(pythonPath, pythonArgs, {
      env: {
        ...process.env,
        HF_HOME: path.join(outDir, 'hf-cache'),
        TRANSFORMERS_CACHE: path.join(outDir, 'hf-cache'),
      },
    });
  } else {
    console.log('No background-removal jobs needed; using existing local cutouts.');
  }

  const results = [];
  for (const meta of selectedMeta) {
    const asset = await createSquareAssets(meta.noBgPath, meta.assetSlug, curatedDir);
    const warnings = qualityDecision(asset.stats);
    results.push({
      slug: meta.slug,
      assetSlug: meta.assetSlug,
      imageNumber: meta.imageNumber,
      title: meta.item.equipo,
      temporada: meta.item.temporada,
      tipo: meta.item.tipo,
      sourceUrl: meta.url,
      originalPath: meta.originalPath,
      noBgPath: meta.noBgPath,
      masterPath: asset.masterPath,
      cardPath: asset.cardPath,
      transparentRatio: Number(asset.stats.transparentRatio.toFixed(4)),
      foregroundRatio: Number(asset.stats.foregroundRatio.toFixed(4)),
      bbox: asset.stats.bbox,
      warnings,
      decision: warnings.length ? 'NEEDS_REVIEW' : 'PASS_VISUAL_REVIEW_REQUIRED',
    });
  }

  const contactSheetPaths = await createContactSheets(results, reviewDir, rowsPerSheet);
  const warningResults = results.filter((item) => item.warnings.length);
  const warningContactSheetPaths = warningResults.length
    ? await createContactSheets(warningResults, path.join(reviewDir, 'warnings'), rowsPerSheet)
    : [];

  const report = {
    createdAt: new Date().toISOString(),
    catalog: catalogPath,
    model,
    imageIndex: allImages ? 'all' : imageIndex,
    allImages,
    includeAll,
    force,
    rowsPerSheet,
    outDir: rel(outDir),
    contactSheet: rel(contactSheetPaths[0]),
    contactSheets: contactSheetPaths.map(rel),
    warningContactSheets: warningContactSheetPaths.map(rel),
    results: results.map((item) => ({
      ...item,
      originalPath: rel(item.originalPath),
      noBgPath: rel(item.noBgPath),
      masterPath: rel(item.masterPath),
      cardPath: rel(item.cardPath),
    })),
  };

  const reportPath = path.join(outDir, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  const md = [
    '# Preventa Local Curation Dry Run',
    '',
    `Model: ${model}`,
    `Contact sheets: ${contactSheetPaths.map(rel).join(', ')}`,
    `Warning contact sheets: ${warningContactSheetPaths.length ? warningContactSheetPaths.map(rel).join(', ') : 'none'}`,
    '',
    'No Supabase upload was performed.',
    '',
    ...report.results.map((item) => [
      `## ${item.assetSlug}`,
      `Decision: ${item.decision}`,
      `Original: ${item.originalPath}`,
      `No bg: ${item.noBgPath}`,
      `Card: ${item.cardPath}`,
      `Transparent ratio: ${item.transparentRatio}`,
      `Foreground ratio: ${item.foregroundRatio}`,
      `Warnings: ${item.warnings.length ? item.warnings.join('; ') : 'none'}`,
      '',
    ].join('\n')),
  ].join('\n');
  await fs.writeFile(path.join(outDir, 'report.md'), md, 'utf8');

  console.log(JSON.stringify({
    report: rel(reportPath),
    contactSheets: contactSheetPaths.map(rel),
    warningContactSheets: warningContactSheetPaths.map(rel),
    processed: results.length,
    warnings: warningResults.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
