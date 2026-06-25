import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const fullCatalogPath = path.join(root, 'web', 'preventa-catalogo.json');
const listCatalogPath = path.join(root, 'web', 'preventa-catalogo-list.json');
const cachePath = path.join(root, '.codex_tmp', 'preventa-gallery-analysis-cache.json');
const reportPath = path.join(root, '.codex_tmp', 'preventa-gallery-curation-report.json');

const config = {
  concurrency: 12,
  requestTimeoutMs: 15000,
  minDetailWidth: 360,
  minDetailHeight: 250,
  duplicateHashThreshold: 12,
  fullShirt: {
    minBboxHeightRatio: 0.72,
    minBboxAreaRatio: 0.55,
    minCoverage: 0.24,
    maxCoverage: 0.58,
    maxBboxRatio: 1.45
  }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value, options = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const spacing = options.compact ? 0 : 2;
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, spacing)}\n`, 'utf8');
}

function compactListImage(image) {
  if (!image || typeof image === 'string') return image;
  const cardUrl = image.card_url || image.url || image.src || image.href || '';
  const masterUrl = image.master_url || image.url || image.card_url || image.src || image.href || '';
  return {
    card_url: cardUrl,
    master_url: masterUrl,
    source_url: image.source_url || image.sourceUrl || '',
    gallery_role: image.gallery_role || ''
  };
}

function compactListItem(item) {
  return {
    id: item.id,
    slug: item.slug,
    equipo: item.equipo,
    temporada: item.temporada,
    tipo: item.tipo,
    categoria: item.categoria,
    pais_o_club: item.pais_o_club,
    decada: item.decada,
    descripcion: item.descripcion,
    precio_aprox: item.precio_aprox,
    destacado: item.destacado,
    orden: item.orden,
    tags: item.tags || [],
    photo_count: item.photo_count_gallery || item.photo_count || 0,
    photo_count_gallery: item.photo_count_gallery || item.photo_count || 0,
    gallery_status: item.gallery_status || null,
    imagenes: (item.imagenes || []).map(compactListImage)
  };
}

function loadCache() {
  if (!fs.existsSync(cachePath)) return {};
  return readJson(cachePath);
}

function saveCache(cache) {
  writeJson(cachePath, cache);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getImageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || image.master_url || image.card_url || image.publicUrl || image.src || image.href || '';
}

function getGalleryImageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.master_url || image.url || image.card_url || image.publicUrl || image.src || image.href || '';
}

function getCuratedSourceUrl(image) {
  if (!image || typeof image === 'string') return '';
  return image.source_url || image.sourceUrl || '';
}

function findOriginalByUrl(item, url) {
  if (!url) return null;
  return (item.imagenes_originales || []).find((image) => getImageUrl(image) === url) || { url };
}

function appendUniqueImage(images, image) {
  const url = getImageUrl(image);
  if (!url) return;
  if (images.some((candidate) => getImageUrl(candidate) === url)) return;
  images.push(image);
}

async function fetchImageBuffer(url) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(config.requestTimeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      await sleep(400 * attempt);
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message || lastError}`);
}

async function computeDHash(buffer) {
  const { data } = await sharp(buffer)
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = '';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      hash += data[(y * 9) + x] > data[(y * 9) + x + 1] ? '1' : '0';
    }
  }

  return hash;
}

function hammingDistance(left, right) {
  if (!left || !right || left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }

  return distance;
}

async function computeAlphaFeatures(buffer) {
  const image = sharp(buffer, { limitInputPixels: false }).ensureAlpha();
  const metadata = await image.metadata();
  const { data } = await image.raw().toBuffer({ resolveWithObject: true });

  let minX = metadata.width;
  let minY = metadata.height;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;

  for (let y = 0; y < metadata.height; y += 1) {
    for (let x = 0; x < metadata.width; x += 1) {
      const alpha = data[((y * metadata.width) + x) * 4 + 3];
      if (alpha <= 25) continue;
      opaque += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const bboxW = maxX >= 0 ? maxX - minX + 1 : 0;
  const bboxH = maxY >= 0 ? maxY - minY + 1 : 0;
  const totalPixels = metadata.width * metadata.height;

  return {
    bboxWidth: bboxW,
    bboxHeight: bboxH,
    bboxHeightRatio: bboxH / metadata.height,
    bboxAreaRatio: (bboxW * bboxH) / totalPixels,
    bboxRatio: bboxW / (bboxH || 1),
    coverage: opaque / totalPixels
  };
}

async function readAnalysis(url, cache) {
  if (cache[url]?.hash && cache[url]?.alpha) return cache[url];

  const buffer = await fetchImageBuffer(url);
  const metadata = await sharp(buffer, { limitInputPixels: false }).metadata();
  const result = {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || '',
    bytes: buffer.length,
    hash: await computeDHash(buffer),
    alpha: await computeAlphaFeatures(buffer)
  };

  cache[url] = result;
  return result;
}

async function mapLimit(items, limit, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  });

  await Promise.all(workers);
}

function isFullShirtCutout(analysis) {
  const alpha = analysis.alpha || {};
  return alpha.bboxHeightRatio >= config.fullShirt.minBboxHeightRatio
    && alpha.bboxAreaRatio >= config.fullShirt.minBboxAreaRatio
    && alpha.coverage >= config.fullShirt.minCoverage
    && alpha.coverage <= config.fullShirt.maxCoverage
    && alpha.bboxRatio <= config.fullShirt.maxBboxRatio;
}

function isUsefulDetail(analysis, referenceHashes) {
  if (!analysis.width || !analysis.height) return false;
  if (analysis.width < config.minDetailWidth || analysis.height < config.minDetailHeight) return false;
  return !referenceHashes.some((hash) => hammingDistance(analysis.hash, hash) <= config.duplicateHashThreshold);
}

function withAnalysisMetadata(image, analysis, extra = {}) {
  const base = image && typeof image === 'object' ? image : { url: image };
  return {
    ...base,
    width: analysis.width,
    height: analysis.height,
    ...extra
  };
}

function compactDecision(decision) {
  const alpha = decision.analysis?.alpha || {};
  return {
    index: decision.index,
    action: decision.action,
    url: decision.url,
    source_url: decision.source_url || '',
    is_full_shirt: decision.is_full_shirt,
    bbox_height_ratio: Number((alpha.bboxHeightRatio || 0).toFixed(3)),
    bbox_ratio: Number((alpha.bboxRatio || 0).toFixed(3)),
    coverage: Number((alpha.coverage || 0).toFixed(3))
  };
}

const fullCatalog = readJson(fullCatalogPath);
const listCatalog = readJson(listCatalogPath);
const cache = loadCache();

const primaryJobs = [];
for (const item of fullCatalog) {
  (item.imagenes || []).forEach((image, index) => {
    const url = getGalleryImageUrl(image);
    if (url) primaryJobs.push({ slug: item.slug, image, index, url });
  });
}

let failed = 0;
const failures = [];
let completedPrimary = 0;

await mapLimit(primaryJobs, config.concurrency, async (job) => {
  try {
    await readAnalysis(job.url, cache);
  } catch (error) {
    failed += 1;
    if (failures.length < 30) failures.push({ slug: job.slug, url: job.url, error: error.message });
  }

  completedPrimary += 1;
  if (completedPrimary % 50 === 0 || completedPrimary === primaryJobs.length) {
    saveCache(cache);
    console.log(`Analyzed ${completedPrimary}/${primaryJobs.length} curated primary images`);
  }
});

const reportItems = [];
const detailJobs = [];

for (const item of fullCatalog) {
  const primaryImages = Array.isArray(item.imagenes) ? item.imagenes : [];
  const keptPrimary = [];
  const movedPrimaryDetails = [];
  const keptPrimarySourceUrls = new Set();
  const decisions = [];
  const reviewFlags = [];

  primaryImages.forEach((image, index) => {
    const url = getGalleryImageUrl(image);
    const analysis = cache[url];
    const isFull = !!analysis && isFullShirtCutout(analysis);
    const sourceUrl = getCuratedSourceUrl(image);

    if (index === 0) {
      if (!isFull) reviewFlags.push('front_needs_visual_review');
      keptPrimary.push({
        ...image,
        gallery_role: 'front',
        gallery_confidence: isFull ? 'auto_full_shirt' : 'front_kept_for_review'
      });
      if (sourceUrl) keptPrimarySourceUrls.add(sourceUrl);
      decisions.push({ index: index + 1, action: 'front', url, source_url: sourceUrl, is_full_shirt: isFull, analysis });
      return;
    }

    if (index === 1 && isFull) {
      keptPrimary.push({
        ...image,
        gallery_role: 'back',
        gallery_confidence: 'auto_full_shirt'
      });
      if (sourceUrl) keptPrimarySourceUrls.add(sourceUrl);
      decisions.push({ index: index + 1, action: 'back', url, source_url: sourceUrl, is_full_shirt: true, analysis });
      return;
    }

    const original = findOriginalByUrl(item, sourceUrl);
    if (original) {
      movedPrimaryDetails.push({
        ...original,
        gallery_role: 'detail',
        moved_from_primary: true
      });
    }
    decisions.push({ index: index + 1, action: 'moved_to_detail', url, source_url: sourceUrl, is_full_shirt: isFull, analysis });
  });

  if (!keptPrimary.length) reviewFlags.push('no_curated_front');
  if (keptPrimary.length < 2) reviewFlags.push('no_confirmed_back');

  const candidateDetails = [];
  movedPrimaryDetails.forEach((image) => appendUniqueImage(candidateDetails, image));
  (item.imagenes_originales || []).forEach((image) => {
    const url = getImageUrl(image);
    if (!url || keptPrimarySourceUrls.has(url)) return;
    appendUniqueImage(candidateDetails, image);
  });

  const referenceUrls = keptPrimary
    .map((image) => getCuratedSourceUrl(image) || getGalleryImageUrl(image))
    .filter(Boolean);

  item.__galleryWork = {
    keptPrimary,
    candidateDetails,
    referenceUrls,
    decisions,
    reviewFlags
  };

  referenceUrls.forEach((url) => {
    detailJobs.push({ type: 'reference', slug: item.slug, url });
  });
  candidateDetails.forEach((image, originalIndex) => {
    const url = getImageUrl(image);
    if (url) detailJobs.push({ type: 'detail', slug: item.slug, image, originalIndex, url });
  });
}

let completedDetails = 0;
await mapLimit(detailJobs, config.concurrency, async (job) => {
  try {
    await readAnalysis(job.url, cache);
  } catch (error) {
    failed += 1;
    if (failures.length < 30) failures.push({ slug: job.slug, url: job.url, error: error.message });
  }

  completedDetails += 1;
  if (completedDetails % 100 === 0 || completedDetails === detailJobs.length) {
    saveCache(cache);
    console.log(`Analyzed ${completedDetails}/${detailJobs.length} gallery candidate images`);
  }
});

for (const item of fullCatalog) {
  const work = item.__galleryWork;
  const referenceHashes = work.referenceUrls.map((url) => cache[url]?.hash).filter(Boolean);
  const detailImages = [];
  let skippedDetailDuplicates = 0;
  let skippedDetailQuality = 0;

  work.candidateDetails.forEach((image) => {
    const url = getImageUrl(image);
    const analysis = cache[url];

    if (!analysis || !isUsefulDetail(analysis, referenceHashes)) {
      if (analysis) skippedDetailDuplicates += 1;
      else skippedDetailQuality += 1;
      return;
    }

    appendUniqueImage(detailImages, withAnalysisMetadata(image, analysis));
  });

  item.imagenes = work.keptPrimary;
  item.imagenes_detalle = detailImages;
  item.photo_count_gallery = item.imagenes.length + item.imagenes_detalle.length;
  item.photo_count = item.photo_count_gallery;
  item.gallery_curation = {
    strategy: 'front-back-detail-alpha-dhash-v1',
    has_confirmed_back: item.imagenes.some((image) => image.gallery_role === 'back'),
    needs_review: work.reviewFlags,
    primary_decisions: work.decisions.map(compactDecision),
    skipped_detail_duplicates: skippedDetailDuplicates,
    skipped_detail_quality: skippedDetailQuality
  };

  reportItems.push({
    slug: item.slug,
    title: [item.equipo, item.temporada, item.tipo].filter(Boolean).join(' '),
    primary_count: item.imagenes.length,
    detail_count: item.imagenes_detalle.length,
    total_count: item.photo_count_gallery,
    has_confirmed_back: item.gallery_curation.has_confirmed_back,
    needs_review: item.gallery_curation.needs_review,
    primary_decisions: item.gallery_curation.primary_decisions
  });

  delete item.__galleryWork;
}

const fullBySlug = new Map(fullCatalog.map((item) => [item.slug, item]));
for (const item of listCatalog) {
  const fullItem = fullBySlug.get(item.slug);
  if (!fullItem) continue;

  item.imagenes = fullItem.imagenes;
  item.imagenes_detalle = fullItem.imagenes_detalle;
  item.photo_count_gallery = fullItem.photo_count_gallery;
  item.photo_count = fullItem.photo_count_gallery;
  item.gallery_status = {
    has_confirmed_back: fullItem.gallery_curation.has_confirmed_back,
    needs_review: fullItem.gallery_curation.needs_review
  };
}

const summary = {
  products: fullCatalog.length,
  primary_images_checked: primaryJobs.length,
  candidate_images_checked: detailJobs.length,
  total_gallery_images: fullCatalog.reduce((sum, item) => sum + item.photo_count_gallery, 0),
  references_with_confirmed_back: reportItems.filter((item) => item.has_confirmed_back).length,
  references_without_confirmed_back: reportItems.filter((item) => !item.has_confirmed_back).length,
  references_needing_review: reportItems.filter((item) => item.needs_review.length).length,
  failed,
  failures,
  config
};

writeJson(fullCatalogPath, fullCatalog);
writeJson(listCatalogPath, listCatalog.map(compactListItem), { compact: true });
writeJson(reportPath, { summary, items: reportItems });
saveCache(cache);

console.log(JSON.stringify(summary, null, 2));
console.log(`Wrote report: ${path.relative(root, reportPath)}`);
