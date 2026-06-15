import fs from 'node:fs/promises';
import path from 'node:path';

export const VALID_IMAGE_ROLES = new Set([
  'front',
  'back',
  'detail',
  'logo',
  'patch',
  'collar',
  'fabric',
  'tag',
  'rejected',
]);

export async function readApprovalManifest(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function writeApprovalManifest(filePath, manifest) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function validateApprovalManifest(manifest) {
  const errors = [];
  const images = Array.isArray(manifest.images) ? manifest.images : [];
  const frontCount = images.filter((image) => image.role === 'front').length;
  const backCount = images.filter((image) => image.role === 'back').length;

  if (!manifest.slug) errors.push('slug is required');
  if (frontCount !== 1) errors.push('exactly one front image is required');
  if (backCount > 1) errors.push('at most one back image is allowed');

  images.forEach((image, index) => {
    if (!image.id) errors.push(`image at index ${index} is missing id`);
    if (!VALID_IMAGE_ROLES.has(image.role)) errors.push(`invalid role for image ${image.id || index}`);
  });

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildApprovalSummary(manifest) {
  const roles = {};
  const images = Array.isArray(manifest.images) ? manifest.images : [];

  for (const image of images) {
    roles[image.role] = (roles[image.role] || 0) + 1;
  }

  return {
    slug: manifest.slug,
    totalImages: images.length,
    roles,
    publishReady: validateApprovalManifest(manifest).ok,
  };
}

export function approvedImagesFor(reference, manifest) {
  const byId = new Map((reference.candidates || []).map((candidate) => [candidate.id, candidate]));
  return (manifest.images || [])
    .filter((image) => image.role !== 'rejected')
    .map((image, index) => {
      const candidate = byId.get(image.id) || {};
      return {
        ...candidate,
        ...image,
        sortOrder: index + 1,
        sourceUrl: image.sourceUrl || candidate.sourceUrl || candidate.url || '',
        localPath: image.localPath || candidate.localPath || '',
      };
    });
}
