import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APPROVED_REFERENCES } from './data/preventa-approved-references.mjs';
import { buildYupooPageUrl, normalizeSearchText, parseYupooAlbumList } from './lib/yupoo-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT_URL = 'https://huiliyuan.x.yupoo.com/';
const DEFAULT_MAX_PAGES = 40;

async function fetchHtml(url) {
  const origin = new URL(url).origin;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      Referer: origin,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const buffer = await response.arrayBuffer();
  const decoder = /gbk|gb2312|gb18030/i.test(contentType) ? new TextDecoder('gb18030') : new TextDecoder('utf-8');
  return decoder.decode(buffer);
}

function uniqueTokens(values) {
  return [...new Set(
    values
      .map((value) => normalizeSearchText(value))
      .flatMap((value) => value.split(' '))
      .filter((token) => token.length >= 2)
  )];
}

function scoreSingleAlbum(album, reference) {
  const normalizedTitle = normalizeSearchText(album.title);
  const teamTokens = uniqueTokens(reference.teamAliases || []);
  const seasonTokens = uniqueTokens(reference.seasonTokens || []);
  const variantTokens = uniqueTokens(reference.variantAliases || []);
  const extraTokens = uniqueTokens(reference.extraAliases || []);
  let score = 0;
  let teamHit = false;
  let seasonHit = false;

  for (const token of teamTokens) {
    if (normalizedTitle.includes(token)) {
      teamHit = true;
      score += token.length >= 4 ? 4 : 2;
    }
  }

  for (const token of seasonTokens) {
    if (normalizedTitle.includes(token)) {
      seasonHit = true;
      score += token.length >= 4 ? 3 : 1;
    }
  }

  for (const token of variantTokens) {
    if (normalizedTitle.includes(token)) {
      score += 2;
    }
  }

  for (const token of extraTokens) {
    if (normalizedTitle.includes(token)) {
      score += token.length >= 4 ? 2 : 1;
    }
  }

  if (reference.player && normalizedTitle.includes(normalizeSearchText(reference.player))) score += 2;
  if (normalizedTitle.includes('主场') && reference.variante === 'local') score += 2;
  if (normalizedTitle.includes('客场') && reference.variante === 'visitante') score += 2;
  if (normalizedTitle.includes('长袖') && reference.variante === 'manga_larga') score += 2;
  if (normalizedTitle.includes('守门员') && reference.variante === 'portero') score += 2;

  if (!teamHit) return 0;
  if (!seasonHit && !reference.player) return 0;

  return score;
}

export function scoreApprovedMatches(albums, approvedReferences = APPROVED_REFERENCES) {
  return approvedReferences.map((reference) => {
    const matches = albums
      .map((album) => ({
        title: album.title,
        url: album.url,
        score: scoreSingleAlbum(album, reference),
      }))
      .filter((album) => album.score > 0)
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, 3);

    return {
      slug: reference.slug,
      equipo: reference.equipo,
      temporada: reference.temporada,
      variante: reference.variante,
      matches,
    };
  });
}

async function discoverProviderCatalog(rootUrl, maxPages = DEFAULT_MAX_PAGES) {
  const albums = [];
  const seen = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    const url = buildYupooPageUrl(rootUrl, page);
    const html = await fetchHtml(url);
    const pageAlbums = parseYupooAlbumList(html, url);

    if (!pageAlbums.length) break;

    let addedThisPage = 0;
    for (const album of pageAlbums) {
      if (seen.has(album.url)) continue;
      seen.add(album.url);
      albums.push(album);
      addedThisPage += 1;
    }

    if (addedThisPage === 0) break;
  }

  return albums;
}

async function writeMatchFile(rootUrl, payload) {
  const docsDir = path.resolve(__dirname, '..', 'docs');
  await mkdir(docsDir, { recursive: true });
  const hostname = new URL(rootUrl).hostname.split('.')[0];
  const outputPath = path.join(docsDir, `provider-catalog-matches-${hostname}.json`);
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return outputPath;
}

async function main() {
  const rootUrl = process.argv[2] || DEFAULT_ROOT_URL;
  const maxPages = Number(process.argv[3] || DEFAULT_MAX_PAGES);
  const albums = await discoverProviderCatalog(rootUrl, maxPages);
  const matches = scoreApprovedMatches(albums);
  const payload = {
    generatedAt: new Date().toISOString(),
    rootUrl,
    scannedAlbums: albums.length,
    matchedReferences: matches.filter((item) => item.matches.length).length,
    albums,
    matches,
  };

  const outputPath = await writeMatchFile(rootUrl, payload);
  console.log(`Scanned ${albums.length} albums from ${rootUrl}`);
  console.log(`Matched ${payload.matchedReferences} of ${APPROVED_REFERENCES.length} approved references`);
  console.log(`Saved review file to ${outputPath}`);
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  main().catch((error) => {
    console.error('[pv-discover-provider-catalog] error:', error.message);
    process.exitCode = 1;
  });
}
