import { load as cheerioLoad } from 'cheerio';

export function buildYupooPageUrl(rootUrl, page) {
  const url = new URL(rootUrl);
  url.pathname = '/albums/';
  url.searchParams.set('page', String(page));
  return url.toString();
}

export function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseYupooAlbumList(html, pageUrl) {
  const $ = cheerioLoad(html);
  const albums = [];
  const seen = new Set();

  $('a[href*="/albums/"]').each((_, element) => {
    const href = $(element).attr('href');
    const imageAlt = $(element).find('img').attr('alt') || '';
    const clone = $(element).clone();
    clone.find('img').remove();
    const textOnly = clone.text();
    const title = [imageAlt, textOnly]
      .join(' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!href || !title) return;

    const url = new URL(href, pageUrl).toString();
    if (!/\/albums\/\d+/i.test(url) || seen.has(url)) return;

    seen.add(url);
    albums.push({ title, url });
  });

  return albums;
}
