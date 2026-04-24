import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_REJECT_PATTERNS = [
  /tabla/i,
  /medidas/i,
  /size/i,
  /sizing/i,
  /guide/i,
  /guia/i,
  /shipping/i,
  /envio/i,
  /banner/i,
  /logo/i,
  /placeholder/i,
];

function usage() {
  console.log('Usage: node extract-provider-candidates.mjs --config path/to/config.json');
}

function parseArgs(argv) {
  const configIndex = argv.indexOf('--config');
  if (configIndex === -1 || !argv[configIndex + 1]) return null;
  return argv[configIndex + 1];
}

async function readJson(filePath) {
  const fs = await import('node:fs/promises');
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function absolutize(rawUrl, pageUrl) {
  if (!rawUrl) return null;
  const decoded = rawUrl.replace(/&amp;/g, '&').trim();
  if (decoded.startsWith('//')) return `https:${decoded}`;
  try {
    return new URL(decoded, pageUrl).href;
  } catch {
    return null;
  }
}

function isImageUrl(url) {
  return /\.(webp|jpg|jpeg|png|avif)(\?|$)/i.test(url);
}

function shouldRejectByUrl(url, patterns) {
  return patterns.some((pattern) => pattern.test(url));
}

function extractImageUrls(html, pageUrl) {
  const urls = [];
  const patterns = [
    /<img[^>]+(?:src|data-src|data-origin-src)=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /https?:\/\/[^"' <>)]+?\.(?:webp|jpg|jpeg|png|avif)(?:\?[^"' <>)]+)?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html))) {
      const url = absolutize(match[1] || match[0], pageUrl);
      if (url && isImageUrl(url)) urls.push(url);
    }
  }

  return [...new Set(urls)];
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
}

async function downloadImage(url, outputPath, referer) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
      Referer: referer,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} downloading ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
  return buffer.length;
}

function extensionFor(url) {
  const match = url.match(/\.(webp|jpg|jpeg|png|avif)(?:\?|$)/i);
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'img';
}

function buildReportTemplate(reference, accepted, rejected) {
  const expected = reference.expected || {};
  return [
    `Reference: ${reference.slug}`,
    `Expected: ${expected.team || ''}, ${expected.season || ''}, ${expected.variant || ''}, ${(expected.colors || []).join('/')}`,
    `Decision: NEEDS USER REVIEW`,
    '',
    'Accepted images:',
    ...accepted.map((item) => `- ${item.file}: TODO visual reason`),
    '',
    'Rejected images:',
    ...rejected.map((item) => `- ${item.url}: ${item.reason}`),
    '',
    'Risks:',
    '- TODO',
    '',
    'Next action:',
    '- Await user approval before upload.',
    '',
  ].join('\n');
}

async function processReference(reference, config) {
  const outDir = path.resolve(config.outDir || '.tmp-provider-photo-audit', reference.slug);
  await mkdir(outDir, { recursive: true });

  const rejectPatterns = [
    ...DEFAULT_REJECT_PATTERNS,
    ...(config.rejectPatterns || []).map((value) => new RegExp(value, 'i')),
    ...(reference.rejectPatterns || []).map((value) => new RegExp(value, 'i')),
  ];

  const accepted = [];
  const rejected = [];
  const seen = new Set();

  for (const pageUrl of reference.sourcePages || []) {
    const html = await fetchHtml(pageUrl);
    const imageUrls = extractImageUrls(html, pageUrl);

    for (const imageUrl of imageUrls) {
      if (seen.has(imageUrl)) continue;
      seen.add(imageUrl);

      if (shouldRejectByUrl(imageUrl, rejectPatterns)) {
        rejected.push({ url: imageUrl, reason: 'URL/name matches reject pattern' });
        continue;
      }

      const fileName = `${String(accepted.length + 1).padStart(2, '0')}.${extensionFor(imageUrl)}`;
      const outputPath = path.join(outDir, fileName);
      try {
        const bytes = await downloadImage(imageUrl, outputPath, pageUrl);
        accepted.push({ file: fileName, url: imageUrl, bytes, sourcePage: pageUrl });
      } catch (error) {
        rejected.push({ url: imageUrl, reason: error.message });
      }
    }
  }

  const manifest = {
    slug: reference.slug,
    expected: reference.expected || {},
    accepted,
    rejected,
  };
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(path.join(outDir, 'match-report-template.md'), buildReportTemplate(reference, accepted, rejected), 'utf8');
  return manifest;
}

async function main() {
  const configPath = parseArgs(process.argv.slice(2));
  if (!configPath) {
    usage();
    process.exitCode = 1;
    return;
  }

  const config = await readJson(configPath);
  if (!Array.isArray(config.references) || !config.references.length) {
    throw new Error('Config must include references[]');
  }

  const outputRoot = path.resolve(config.outDir || '.tmp-provider-photo-audit');
  await mkdir(outputRoot, { recursive: true });

  const results = [];
  for (const reference of config.references) {
    if (!reference.slug) throw new Error('Each reference needs slug');
    console.log(`Processing ${reference.slug}`);
    results.push(await processReference(reference, config));
  }

  await writeFile(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`Saved candidate audit to ${outputRoot}`);
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  main().catch((error) => {
    console.error(`[provider-photo-matcher] ${error.message}`);
    process.exitCode = 1;
  });
}
