import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export async function fetchProviderHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      Referer: new URL(url).origin,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  return response.text();
}

export function extractImageCandidatesFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const urls = [];

  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, element) => {
    urls.push($(element).attr('content'));
  });

  $('img').each((_, element) => {
    const attrs = ['src', 'data-src', 'data-original', 'data-lazy', 'data-actualsrc'];
    for (const attr of attrs) {
      urls.push($(element).attr(attr));
    }

    const srcset = $(element).attr('srcset') || $(element).attr('data-srcset');
    if (srcset) {
      for (const part of srcset.split(',')) {
        urls.push(part.trim().split(/\s+/)[0]);
      }
    }
  });

  return uniqueImageUrls(urls, pageUrl).map((url, index) => ({
    id: `img-${String(index + 1).padStart(2, '0')}`,
    url,
    sourceUrl: url,
    providerPageUrl: pageUrl,
  }));
}

export async function extractProviderCandidates(providerUrl) {
  const html = await fetchProviderHtml(providerUrl);
  return extractImageCandidatesFromHtml(html, providerUrl);
}

export function candidatesFromSourceImages(sourceImages) {
  return sourceImages.map((url, index) => ({
    id: `img-${String(index + 1).padStart(2, '0')}`,
    url,
    sourceUrl: url,
    providerPageUrl: '',
  }));
}

function uniqueImageUrls(values, pageUrl) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const normalized = normalizeImageUrl(value, pageUrl);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeImageUrl(value, pageUrl) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return '';

  try {
    return new URL(raw, pageUrl).toString();
  } catch {
    return '';
  }
}
