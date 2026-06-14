import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const DEFAULT_REPORT = '.codex_tmp/preventa-curation-all-main/report.json';
const DEFAULT_CATALOG = 'web/preventa-catalogo-list.json';
const DEFAULT_OUT_DIR = '.codex_tmp/preventa-curation-import';
const DEFAULT_BUCKET = 'preventa-images';
const DEFAULT_PREFIX_BASE = 'preventa-curated';

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

function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function dateStamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadEnvFile(envPath) {
  if (!fssync.existsSync(envPath)) return;
  const env = fssync.readFileSync(envPath, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function publicUrlFor(supabaseUrl, bucket, storagePath) {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${storagePath}`;
}

function resultStoragePaths(prefix, result) {
  const folder = `${prefix}/${result.slug}`;
  return {
    card: `${folder}/${result.assetSlug}-card.webp`,
    master: `${folder}/${result.assetSlug}-1200.webp`,
  };
}

function resultLocalPaths(result) {
  return {
    card: resolveFromRoot(result.cardPath),
    master: resolveFromRoot(result.masterPath),
  };
}

function isWarning(result) {
  return Array.isArray(result.warnings) && result.warnings.length > 0;
}

function selectedResults(report, includeWarnings) {
  return report.results.filter((result) => includeWarnings || !isWarning(result));
}

function buildAssetRecords(report, options) {
  const results = selectedResults(report, options.includeWarnings);
  return results.map((result) => {
    const storagePaths = resultStoragePaths(options.prefix, result);
    const localPaths = resultLocalPaths(result);
    return {
      slug: result.slug,
      assetSlug: result.assetSlug,
      imageNumber: result.imageNumber,
      title: result.title,
      sourceUrl: result.sourceUrl,
      decision: result.decision,
      warnings: result.warnings || [],
      local: {
        card: rel(localPaths.card),
        master: rel(localPaths.master),
      },
      storage: storagePaths,
      public: {
        card: publicUrlFor(options.supabaseUrl, options.bucket, storagePaths.card),
        master: publicUrlFor(options.supabaseUrl, options.bucket, storagePaths.master),
      },
    };
  });
}

function curatedImageObject(asset, publicSize) {
  const publicUrl = asset.public[publicSize];
  const publicPath = asset.storage[publicSize];
  return {
    url: publicUrl,
    path: publicPath,
    card_url: asset.public.card,
    card_path: asset.storage.card,
    master_url: asset.public.master,
    master_path: asset.storage.master,
    source_url: asset.sourceUrl,
    source_image_number: asset.imageNumber,
    decision: asset.decision,
    warnings: asset.warnings,
  };
}

function patchCatalog(catalog, assets, options) {
  const bySlug = new Map();
  for (const asset of assets) {
    if (!bySlug.has(asset.slug)) bySlug.set(asset.slug, []);
    bySlug.get(asset.slug).push(asset);
  }

  let changedItems = 0;
  let curatedImageCount = 0;

  const patched = catalog.map((item) => {
    const itemAssets = (bySlug.get(item.slug) || [])
      .slice()
      .sort((a, b) => a.imageNumber - b.imageNumber);
    if (!itemAssets.length) return item;

    changedItems += 1;
    curatedImageCount += itemAssets.length;

    const curatedImages = itemAssets.map((asset) => curatedImageObject(asset, options.publicSize));
    const curation = {
      model: options.model,
      source_report: options.reportPath,
      storage_bucket: options.bucket,
      storage_prefix: options.prefix,
      public_size: options.publicSize,
      publish_mode: options.publishMode,
      warning_assets_included: options.includeWarnings,
    };

    if (options.publishMode === 'replace-imagenes') {
      return {
        ...item,
        imagenes_originales: item.imagenes || [],
        photo_count_original: item.photo_count,
        photo_count: curatedImages.length,
        imagenes: curatedImages,
        curation,
      };
    }

    return {
      ...item,
      imagenes_curadas: curatedImages,
      curation: {
        ...curation,
        note: 'Original imagenes are preserved; current frontend may still append raw gallery images.',
      },
    };
  });

  return {
    patched,
    summary: {
      items: catalog.length,
      changedItems,
      curatedImages: curatedImageCount,
    },
  };
}

async function uploadOne(supabase, bucket, localPath, storagePath, allowOverwrite) {
  const body = await fs.readFile(localPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    cacheControl: '31536000',
    contentType: 'image/webp',
    upsert: allowOverwrite,
  });
  if (error) throw new Error(`${storagePath}: ${error.message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadWithRetry(supabase, bucket, localPath, storagePath, options) {
  let lastError;
  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      await uploadOne(supabase, bucket, localPath, storagePath, options.allowOverwrite);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= options.retries) break;
      const retryDelayMs = Math.min(8000, 750 * attempt);
      console.warn(`Retrying ${storagePath} after upload error (${attempt}/${options.retries}): ${error.message}`);
      await sleep(retryDelayMs);
    }
  }
  throw lastError;
}

async function uploadAssets(assets, options) {
  if (!options.supabaseKey) {
    throw new Error('Missing SUPABASE_SERVICE_KEY. Refusing to upload without service credentials.');
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(options.supabaseUrl, options.supabaseKey);
  const sizes = options.uploadSize === 'both' ? ['card', 'master'] : [options.uploadSize];
  const uploaded = [];

  for (const asset of assets) {
    const localPaths = resultLocalPaths({
      cardPath: asset.local.card,
      masterPath: asset.local.master,
    });

    for (const size of sizes) {
      const localPath = localPaths[size];
      if (!fssync.existsSync(localPath)) {
        throw new Error(`Missing local ${size} asset: ${localPath}`);
      }
      await uploadWithRetry(supabase, options.bucket, localPath, asset.storage[size], options);
      uploaded.push(asset.storage[size]);
    }
  }

  return uploaded;
}

function printHelp() {
  console.log([
    'Usage: node scripts/preventa-curation-import.mjs [options]',
    '',
    'Options:',
    `  --report PATH           Curation report, defaults to ${DEFAULT_REPORT}`,
    `  --catalog PATH          Catalog to patch, defaults to ${DEFAULT_CATALOG}`,
    `  --out-dir PATH          Output folder, defaults to ${DEFAULT_OUT_DIR}`,
    '  --prefix PATH           Storage prefix, defaults to preventa-curated/birefnet-YYYYMMDD',
    `  --bucket NAME           Supabase Storage bucket, defaults to ${DEFAULT_BUCKET}`,
    '  --supabase-url URL      Supabase project URL, defaults to SUPABASE_URL/.env',
    '  --public-size card      URL size placed in imagenes_curadas: card or master',
    '  --publish-mode replace-imagenes',
    '                           Use curated-field or replace-imagenes for catalog preview/apply',
    '  --upload-size both      Upload card, master, or both',
    '  --include-warnings      Include NEEDS_REVIEW assets after visual review',
    '  --upload                Upload curated assets to Supabase Storage',
    '  --allow-overwrite       Allow replacing files in the same Storage prefix',
    '  --retries              Retry each Supabase upload this many times (default: 5)',
    '  --apply-catalog         Write patched catalog in place after creating a backup',
    '',
    'Default behavior is a dry-run: it writes manifest and preview JSON only.',
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagEnabled(args, 'help')) {
    printHelp();
    return;
  }

  loadEnvFile(resolveFromRoot('.env'));

  const reportPath = args.report || DEFAULT_REPORT;
  const catalogPath = args.catalog || DEFAULT_CATALOG;
  const outDir = resolveFromRoot(args['out-dir'] || DEFAULT_OUT_DIR);
  const report = await readJson(resolveFromRoot(reportPath));
  const catalog = await readJson(resolveFromRoot(catalogPath));
  const supabaseUrl = args['supabase-url'] || process.env.SUPABASE_URL || 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
  const options = {
    reportPath,
    model: report.model,
    bucket: args.bucket || DEFAULT_BUCKET,
    prefix: args.prefix || `${DEFAULT_PREFIX_BASE}/birefnet-${dateStamp(report.createdAt)}`,
    supabaseUrl,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
    includeWarnings: flagEnabled(args, 'include-warnings'),
    upload: flagEnabled(args, 'upload'),
    allowOverwrite: flagEnabled(args, 'allow-overwrite'),
    applyCatalog: flagEnabled(args, 'apply-catalog'),
    publicSize: ['card', 'master'].includes(args['public-size']) ? args['public-size'] : 'card',
    publishMode: ['curated-field', 'replace-imagenes'].includes(args['publish-mode']) ? args['publish-mode'] : 'curated-field',
    uploadSize: ['card', 'master', 'both'].includes(args['upload-size']) ? args['upload-size'] : 'both',
    retries: Math.max(1, Number(args.retries || 5)),
  };

  const assets = buildAssetRecords(report, options);
  const warningCount = report.results.filter(isWarning).length;
  const excludedWarnings = options.includeWarnings ? 0 : warningCount;
  const catalogPatch = patchCatalog(catalog, assets, options);
  const previewDir = path.join(outDir, 'preview');
  const backupDir = path.join(outDir, 'backup');
  const manifestPath = path.join(outDir, 'import-manifest.json');
  const previewCatalogPath = path.join(previewDir, `${path.basename(catalogPath, '.json')}.curated.json`);

  const manifest = {
    createdAt: new Date().toISOString(),
    dryRun: !options.upload,
    report: reportPath,
    catalog: catalogPath,
    bucket: options.bucket,
    prefix: options.prefix,
    publicSize: options.publicSize,
    publishMode: options.publishMode,
    uploadSize: options.uploadSize,
    retries: options.retries,
    includeWarnings: options.includeWarnings,
    totalReportAssets: report.results.length,
    selectedAssets: assets.length,
    warningAssets: warningCount,
    excludedWarnings,
    catalogPatch: catalogPatch.summary,
    assets,
  };

  await writeJson(manifestPath, manifest);
  await writeJson(previewCatalogPath, catalogPatch.patched);

  let backupPath = '';
  if (options.applyCatalog) {
    backupPath = path.join(backupDir, `${path.basename(catalogPath, '.json')}.${timestampForFile()}.backup.json`);
    await fs.mkdir(backupDir, { recursive: true });
    await fs.copyFile(resolveFromRoot(catalogPath), backupPath);
    await writeJson(resolveFromRoot(catalogPath), catalogPatch.patched);
  }

  let uploaded = [];
  if (options.upload) {
    uploaded = await uploadAssets(assets, options);
  }

  if (!options.upload) {
    console.log('No Supabase upload was performed.');
  }

  console.log(JSON.stringify({
    manifest: rel(manifestPath),
    previewCatalog: rel(previewCatalogPath),
    backup: backupPath ? rel(backupPath) : '',
    selectedAssets: assets.length,
    warningAssets: warningCount,
    excludedWarnings,
    catalogPatch: catalogPatch.summary,
    uploaded: uploaded.length,
    storagePrefix: options.prefix,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[preventa-curation-import] ${error.message}`);
  process.exitCode = 1;
});
