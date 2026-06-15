import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

import sharp from 'sharp';

import { approvedImagesFor, validateApprovalManifest } from './approval-manifest.mjs';
import { buildPreventaCatalogRow } from './preventa-row.mjs';

const require = createRequire(import.meta.url);

export const DEFAULT_IMPORT_BUCKET = 'preventa-images';
export const DEFAULT_IMPORT_PREFIX = 'preventa-import/import-studio';

export function loadEnvFile(envPath) {
  if (!fssync.existsSync(envPath)) return;
  const source = fssync.readFileSync(envPath, 'utf8');
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export function buildApprovedJob(job, approval) {
  const approvalBySlug = new Map((approval.references || []).map((reference) => [reference.slug, reference]));

  return {
    ...job,
    references: (job.references || []).map((reference) => {
      const manifest = approvalBySlug.get(reference.slug) || { slug: reference.slug, images: [] };
      const validation = validateApprovalManifest(manifest);
      const fieldOverrides = manifest.fields || {};
      return {
        ...reference,
        normalized: {
          ...(reference.normalized || {}),
          ...fieldOverridesToNormalized(fieldOverrides),
        },
        validation,
        approvedImages: approvedImagesFor(reference, manifest),
        importFields: fieldOverrides,
      };
    }),
  };
}

export function buildImportRows(job, options = {}) {
  const rows = [];

  for (const reference of job.references || []) {
    const row = buildPreventaCatalogRow(reference, reference.approvedImages || [], {
      jobId: job.jobId,
      bucket: options.bucket || DEFAULT_IMPORT_BUCKET,
      prefix: options.prefix || `${DEFAULT_IMPORT_PREFIX}/${job.jobId}`,
      publicado: Boolean(options.publicado),
      destacado: Boolean(reference.importFields?.destacado),
      ...reference.importFields,
    });
    rows.push(row);
  }

  return rows;
}

export async function executeSupabaseImport(job, options = {}) {
  const root = options.root || process.cwd();
  loadEnvFile(path.join(root, '.env'));

  const supabaseUrl = options.supabaseUrl || process.env.SUPABASE_URL;
  const supabaseKey = options.supabaseKey || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en .env.');
  }

  const bucket = options.bucket || DEFAULT_IMPORT_BUCKET;
  const prefix = options.prefix || `${DEFAULT_IMPORT_PREFIX}/${dateStamp()}/${job.jobId}`;
  const publish = Boolean(options.publicado);
  const jobDir = options.jobDir || path.join(root, '.codex_tmp', 'import-studio', 'jobs', job.jobId);
  const workDir = path.join(jobDir, 'import-assets');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const importedReferences = [];
  const uploaded = [];

  for (const reference of job.references || []) {
    if (reference.validation && !reference.validation.ok) {
      throw new Error(`${reference.slug}: ${reference.validation.errors.join('; ')}`);
    }

    const preparedImages = await prepareReferenceImages(reference, {
      root,
      workDir,
      bucket,
      prefix,
      supabaseUrl,
      removeBackground: Boolean(options.removeBackground),
      python: options.python || process.env.IMPORT_STUDIO_PYTHON || path.join(root, '.codex_tmp', 'bg-local', 'venv', 'Scripts', 'python.exe'),
      device: options.device || 'cpu',
    });

    for (const image of preparedImages) {
      await uploadImageVariant(supabase, bucket, image.localCardPath, image.cardPath, 'image/webp');
      await uploadImageVariant(supabase, bucket, image.localMasterPath, image.masterPath, 'image/webp');
      uploaded.push(image.cardPath, image.masterPath);
    }

    const row = buildPreventaCatalogRow(reference, preparedImages, {
      jobId: job.jobId,
      bucket,
      prefix,
      publicado: publish,
      destacado: Boolean(reference.importFields?.destacado),
      ...reference.importFields,
    });

    const { data, error } = await supabase
      .from('preventa_catalogo')
      .upsert(row, { onConflict: 'slug' })
      .select('id,slug,publicado')
      .single();

    if (error) throw new Error(`${reference.slug}: ${error.message}`);
    importedReferences.push({ ...data, row });
  }

  const report = {
    mode: 'supabase-import',
    jobId: job.jobId,
    generatedAt: new Date().toISOString(),
    bucket,
    prefix,
    publicado: publish,
    uploaded,
    references: importedReferences.map((item) => ({
      id: item.id,
      slug: item.slug,
      publicado: item.publicado,
      imagenes: item.row.imagenes.length,
      imagenes_detalle: item.row.imagenes_detalle.length,
    })),
  };

  const reportPath = path.join(jobDir, 'import', 'supabase-import-report.json');
  await writeJson(reportPath, report);
  return { report, reportPath };
}

async function prepareReferenceImages(reference, options) {
  const approved = (reference.approvedImages || []).filter((image) => image.role !== 'rejected');
  const referenceDir = path.join(options.workDir, reference.slug);
  const rawDir = path.join(referenceDir, 'raw');
  const noBgDir = path.join(referenceDir, 'no-bg');
  const outDir = path.join(referenceDir, 'webp');
  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(noBgDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  const descriptors = [];
  for (let index = 0; index < approved.length; index += 1) {
    const image = approved[index];
    const id = image.id || `img-${String(index + 1).padStart(2, '0')}`;
    const rawPath = path.join(rawDir, `${safeSegment(id)}${extensionFor(image.sourceUrl || image.url)}`);
    const noBgPath = path.join(noBgDir, `${safeSegment(id)}.png`);
    await downloadImage(image.sourceUrl || image.url, rawPath, image.providerPageUrl || reference.normalized?.providerUrl || '');
    descriptors.push({
      ...image,
      id,
      sortOrder: index + 1,
      rawPath,
      noBgPath,
      needsBackgroundRemoval: options.removeBackground && ['front', 'back'].includes(image.role),
    });
  }

  const bgJobs = descriptors.filter((item) => item.needsBackgroundRemoval);
  if (bgJobs.length) {
    await runBackgroundRemoval(bgJobs, options);
  }

  const prepared = [];
  for (const descriptor of descriptors) {
    const sourcePath = descriptor.needsBackgroundRemoval && fssync.existsSync(descriptor.noBgPath)
      ? descriptor.noBgPath
      : descriptor.rawPath;
    const baseName = `${String(descriptor.sortOrder).padStart(2, '0')}-${safeSegment(descriptor.role)}-${safeSegment(descriptor.id)}`;
    const localCardPath = path.join(outDir, `${baseName}-card.webp`);
    const localMasterPath = path.join(outDir, `${baseName}-1200.webp`);

    if (descriptor.role === 'front' || descriptor.role === 'back') {
      await createSquareVariants(sourcePath, localCardPath, localMasterPath);
    } else {
      await createDetailVariants(sourcePath, localCardPath, localMasterPath);
    }

    const storageBase = `${options.prefix}/${reference.slug}/${baseName}`;
    prepared.push({
      ...descriptor,
      localCardPath,
      localMasterPath,
      cardPath: `${storageBase}-card.webp`,
      masterPath: `${storageBase}-1200.webp`,
      cardUrl: publicUrlFor(options.supabaseUrl, options.bucket, `${storageBase}-card.webp`),
      masterUrl: publicUrlFor(options.supabaseUrl, options.bucket, `${storageBase}-1200.webp`),
    });
  }

  return prepared;
}

async function downloadImage(url, outputPath, referer) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      ...(referer ? { Referer: referer } : {}),
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} descargando ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
}

async function runBackgroundRemoval(jobs, options) {
  if (!fssync.existsSync(options.python)) {
    throw new Error(`No encuentro Python/BiRefNet en ${options.python}. Desactiva quitar fondo o configura IMPORT_STUDIO_PYTHON.`);
  }

  const manifestPath = path.join(path.dirname(jobs[0].noBgPath), 'remove-bg-manifest.json');
  await writeJson(manifestPath, {
    jobs: jobs.map((job) => ({
      slug: job.id,
      input: job.rawPath,
      output: job.noBgPath,
    })),
  });

  await runCommand(options.python, [
    'scripts/preventa-birefnet-remove-bg.py',
    '--manifest',
    manifestPath,
    '--device',
    options.device || 'cpu',
    '--size',
    '1024',
  ], { cwd: options.root });
}

async function createSquareVariants(sourcePath, cardPath, masterPath) {
  const input = await cropToAlphaOrImage(sourcePath);
  await writeContainedWebp(input, 640, 620, cardPath, true);
  await writeContainedWebp(input, 1200, 1168, masterPath, true);
}

async function createDetailVariants(sourcePath, cardPath, masterPath) {
  await sharp(sourcePath, { limitInputPixels: false })
    .rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: false })
    .webp({ quality: 84, effort: 5 })
    .toFile(cardPath);
  await sharp(sourcePath, { limitInputPixels: false })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: false })
    .webp({ quality: 88, effort: 5 })
    .toFile(masterPath);
}

async function cropToAlphaOrImage(sourcePath) {
  const image = sharp(sourcePath, { limitInputPixels: false }).rotate().ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let transparent = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[((y * info.width + x) * 4) + 3];
      if (alpha <= 20) {
        transparent += 1;
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const hasUsefulAlpha = transparent / (info.width * info.height) > 0.03 && maxX >= minX && maxY >= minY;
  if (!hasUsefulAlpha) {
    return sharp(sourcePath, { limitInputPixels: false }).rotate().png().toBuffer();
  }

  return sharp(sourcePath, { limitInputPixels: false })
    .rotate()
    .ensureAlpha()
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
}

async function writeContainedWebp(inputBuffer, size, fitSize, outputPath, transparent) {
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

  const metadata = await sharp(foreground).metadata();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 247, g: 245, b: 239, alpha: 1 },
    },
  })
    .composite([{
      input: foreground,
      left: Math.round((size - metadata.width) / 2),
      top: Math.round((size - metadata.height) / 2),
    }])
    .webp({ quality: size === 1200 ? 88 : 84, effort: 5, alphaQuality: 92 })
    .toFile(outputPath);
}

async function uploadImageVariant(supabase, bucket, localPath, storagePath, contentType) {
  const body = await fs.readFile(localPath);
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    cacheControl: '31536000',
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`${storagePath}: ${error.message}`);
}

function fieldOverridesToNormalized(fields) {
  const preventa = {
    ...(fields.tipo ? { tipo: fields.tipo } : {}),
    ...(fields.categoria ? { categoria: fields.categoria } : {}),
    ...(fields.decada ? { decada: fields.decada } : {}),
    ...(fields.slug ? { slug: fields.slug } : {}),
    ...(fields.equipo ? { equipo: fields.equipo, teamName: fields.equipo } : {}),
    ...(fields.temporada ? { temporada: fields.temporada } : {}),
  };

  return {
    ...(fields.slug ? { slug: fields.slug } : {}),
    ...(fields.equipo ? { teamName: fields.equipo } : {}),
    ...(fields.temporada ? { seasonLabel: fields.temporada } : {}),
    ...(fields.precio_aprox ? { price: Number(fields.precio_aprox) } : {}),
    preventa,
  };
}

function publicUrlFor(supabaseUrl, bucket, storagePath) {
  return `${String(supabaseUrl).replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${storagePath}`;
}

function extensionFor(value) {
  try {
    const ext = path.extname(new URL(value).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return ext;
  } catch {}
  return '.jpg';
}

function safeSegment(value) {
  return String(value || 'image')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function writeJson(filePath, value) {
  return fs.mkdir(path.dirname(filePath), { recursive: true })
    .then(() => fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8'));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} exited with ${code}`));
    });
  });
}
