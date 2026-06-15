import * as cheerio from 'cheerio';

export function isYupooUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.includes('yupoo.com') || hostname.includes('yupoos.com');
  } catch {
    return false;
  }
}

export function extractYupooAlbumFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const albumTitle = extractAlbumTitle($);
  const albumId = extractAlbumId(pageUrl);
  const providerUsername = extractProviderUsername($, pageUrl);
  const coverKey = extractCoverKey($, pageUrl);
  const imageRecords = [];

  $('.showalbum__children.image__main img, .image__imagewrap img').each((_, element) => {
    const previewUrl = normalizeYupooUrl(
      $(element).attr('data-src') ||
      $(element).attr('src') ||
      $(element).attr('data-original') ||
      '',
      pageUrl,
    );
    const sourceUrl = normalizeYupooUrl(
      $(element).attr('data-origin-src') ||
      $(element).attr('data-src') ||
      $(element).attr('src') ||
      '',
      pageUrl,
    );

    addImageRecord(imageRecords, { previewUrl, sourceUrl });
  });

  if (!imageRecords.length) {
    $('meta[property="og:image"], meta[name="twitter:image"], img').each((_, element) => {
      const value = $(element).attr('content') || $(element).attr('data-src') || $(element).attr('src') || '';
      const url = normalizeYupooUrl(value, pageUrl);
      addImageRecord(imageRecords, { previewUrl: url, sourceUrl: url });
    });
  }

  const productImages = orderProductImages(uniqueProductImages(imageRecords), coverKey);
  return {
    title: albumTitle,
    albumId,
    providerUsername,
    imageUrls: productImages.map((image) => image.sourceUrl || image.previewUrl),
    candidates: productImages.map((image, index) => ({
      id: `img-${String(index + 1).padStart(2, '0')}`,
      url: image.previewUrl || image.sourceUrl,
      sourceUrl: image.sourceUrl || image.previewUrl,
      previewUrl: image.previewUrl || image.sourceUrl,
      providerPageUrl: pageUrl,
      provider: 'yupoo',
    })),
  };
}

function extractAlbumTitle($) {
  const direct =
    $('.showalbumheader__gallerytitle').first().attr('data-name') ||
    $('.showalbumheader__gallerytitle').first().text() ||
    $('#infoCarry').first().attr('data-name') ||
    $('h1.visually-hidden').first().text() ||
    $('meta[property="og:title"]').attr('content') ||
    $('title').text();

  return cleanYupooTitle(direct);
}

function cleanYupooTitle(value) {
  return String(value || '')
    .replace(/\s*\|\s*相册.*$/i, '')
    .replace(/\s*\|\s*huiliyuan.*$/i, '')
    .replace(/\s*\|\s*Supplier Product Catalog.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAlbumId(pageUrl) {
  const match = String(pageUrl || '').match(/\/albums\/(\d+)/i);
  return match ? match[1] : '';
}

function extractProviderUsername($, pageUrl) {
  const carry = $('#infoCarry').first().attr('data-username');
  if (carry) return carry;

  try {
    return new URL(pageUrl).hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

function extractCoverKey($, pageUrl) {
  const coverCandidates = [];

  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, element) => {
    coverCandidates.push($(element).attr('content'));
  });
  $('.autocover').each((_, element) => {
    coverCandidates.push($(element).attr('data-src') || $(element).attr('src'));
  });
  $('[data-cover]').each((_, element) => {
    coverCandidates.push(...String($(element).attr('data-cover') || '').split('||'));
  });

  for (const candidate of coverCandidates) {
    const key = productImageKey(normalizeYupooUrl(candidate, pageUrl));
    if (key) return key;
  }

  return '';
}

function addImageRecord(records, image) {
  const previewUrl = normalizeImageCandidate(image.previewUrl);
  const sourceUrl = normalizeImageCandidate(image.sourceUrl);
  if (!previewUrl && !sourceUrl) return;
  records.push({ previewUrl, sourceUrl });
}

function uniqueProductImages(records) {
  const byKey = new Map();

  for (const record of records) {
    const key = productImageKey(record.sourceUrl || record.previewUrl);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      continue;
    }

    byKey.set(key, {
      previewUrl: choosePreview(existing.previewUrl, record.previewUrl),
      sourceUrl: chooseSource(existing.sourceUrl, record.sourceUrl),
    });
  }

  return Array.from(byKey.values()).filter((image) => image.previewUrl || image.sourceUrl);
}

function orderProductImages(images, coverKey) {
  if (!coverKey) return images;
  const coverIndex = images.findIndex((image) => productImageKey(image.sourceUrl || image.previewUrl) === coverKey);
  if (coverIndex === -1) return images;

  const cover = images[coverIndex];
  const before = images.slice(0, coverIndex).reverse();
  const after = images.slice(coverIndex + 1);
  return [cover, ...after, ...before];
}

function choosePreview(left, right) {
  return imageSizePriority(right) > imageSizePriority(left) ? right : left;
}

function chooseSource(left, right) {
  return imageSourcePriority(right) > imageSourcePriority(left) ? right : left;
}

function imageSizePriority(value) {
  const url = String(value || '');
  if (/\/big\.(jpe?g|png|webp)$/i.test(url)) return 4;
  if (/\/medium\.(jpe?g|png|webp)$/i.test(url)) return 3;
  if (/\/small\.(jpe?g|png|webp)$/i.test(url)) return 2;
  if (/photo\.yupoo\.com/i.test(url)) return 1;
  return 0;
}

function imageSourcePriority(value) {
  const url = String(value || '');
  if (/photo\.yupoo\.com\/[^/]+\/[^/]+\/(?!small|medium|big)[^/]+\.(jpe?g|png|webp)$/i.test(url)) return 5;
  return imageSizePriority(url);
}

function productImageKey(value) {
  try {
    const url = new URL(value);
    if (!/photo\.yupoo\.com$/i.test(url.hostname)) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    if (/logo|icon|avatar|placeholder|blank|default/i.test(url.pathname)) return '';
    return `${parts[0]}/${parts[1]}`;
  } catch {
    return '';
  }
}

function normalizeYupooUrl(value, pageUrl) {
  const normalized = normalizeImageCandidate(value);
  if (!normalized) return '';

  try {
    return new URL(normalized, pageUrl).toString();
  } catch {
    return '';
  }
}

function normalizeImageCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';
  if (/logo|icon|avatar|placeholder|blank|default|loading/i.test(raw)) return '';
  if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(raw)) return '';
  if (raw.startsWith('//')) return `https:${raw}`;
  return raw;
}
