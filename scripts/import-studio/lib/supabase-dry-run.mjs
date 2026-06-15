import fs from 'node:fs/promises';
import path from 'node:path';

import { buildPreventaCatalogRow } from './preventa-row.mjs';

const DEFAULT_BUCKET = 'preventa-images';
const DEFAULT_PREFIX = 'preventa-import/import-studio';

export function buildSupabaseDryRun(job, options = {}) {
  const bucket = options.bucket || DEFAULT_BUCKET;
  const prefix = options.prefix || `${DEFAULT_PREFIX}/${job.jobId}`;
  const uploads = [];
  const upserts = [];

  for (const reference of job.references || []) {
    const images = reference.approvedImages || [];
    const galleryImages = images.filter((image) => image.role === 'front' || image.role === 'back');
    const detailImages = images.filter((image) => image.role !== 'front' && image.role !== 'back');

    for (const image of images) {
      uploads.push({
        slug: reference.slug,
        imageId: image.id,
        role: image.role,
        bucket,
        storagePath: `${prefix}/${reference.slug}/${String(image.sortOrder || uploads.length + 1).padStart(2, '0')}-${safeSegment(image.role)}-${safeSegment(image.id)}${extensionFor(image)}`,
        sourceUrl: image.sourceUrl || image.url || '',
        localPath: image.localPath || '',
      });
    }

    upserts.push({
      ...buildPreventaCatalogRow(reference, images, {
        jobId: job.jobId,
        bucket,
        prefix,
        publicado: false,
      }),
      import_studio_job_id: job.jobId,
      preview_imagenes: galleryImages.map((image) => image.sourceUrl || image.url || ''),
      preview_imagenes_detalle: detailImages.map((image) => image.sourceUrl || image.url || ''),
    });
  }

  return {
    mode: 'dry-run',
    generatedAt: new Date().toISOString(),
    jobId: job.jobId,
    bucket,
    uploads,
    upserts,
    warnings: buildWarnings(job, uploads, upserts),
  };
}

export async function writeSupabaseDryRun(filePath, dryRun) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(dryRun, null, 2)}\n`, 'utf8');
}

function buildWarnings(job, uploads, upserts) {
  const warnings = [];
  if (!uploads.length) warnings.push('Dry-run has no approved uploads.');
  for (const upsert of upserts) {
    if (!upsert.imagenes.length) warnings.push(`${upsert.slug}: no primary front/back images in upsert.`);
    if (!upsert.yupoo_origen) warnings.push(`${upsert.slug}: no supplier URL recorded.`);
  }
  for (const reference of job.references || []) {
    if (reference.validation && !reference.validation.ok) {
      warnings.push(`${reference.slug}: approval manifest is not publish-ready.`);
    }
  }
  return warnings;
}

function safeSegment(value) {
  return String(value || 'image')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
}

function extensionFor(image) {
  const source = image.localPath || image.sourceUrl || image.url || '';
  const ext = path.extname(urlSafePath(source)).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.webp';
}

function urlSafePath(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return String(value || '');
  }
}
