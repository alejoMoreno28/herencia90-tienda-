/**
 * scripts/lib/yupoo-search.mjs
 *
 * Busca y descarga fotos de un proveedor yupoo usando su buscador nativo.
 * Probado en vivo contra huiliyuan.x.yupoo.com (seccion Retro de Snake).
 *
 * Nota importante: /albums/{id} SIN ?uid=1 devuelve 404 en esta tienda.
 * El titulo real de un album vive en el atributo `title` de <a class="album__main">,
 * no en el alt de la imagen ni en el texto plano del link.
 */
'use strict';

import { load as cheerioLoad } from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
  return res.text();
}

/**
 * Busca albumes en el buscador nativo de yupoo.
 * @param {string} storeBase ej. 'https://huiliyuan.x.yupoo.com'
 * @param {string} query termino de busqueda (funciona mejor en chino)
 * @returns {Promise<Array<{title: string, href: string}>>}
 */
export async function searchYupooAlbums(storeBase, query) {
  const url = `${storeBase}/search/album?uid=1&sort=q&q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const $ = cheerioLoad(html);
  const results = [];
  $('a.album__main').each((_, el) => {
    const title = $(el).attr('title') || '';
    const href = ($(el).attr('href') || '').split('?')[0];
    if (title && href) results.push({ title, href });
  });
  return results;
}

/**
 * Trae hasta `max` URLs de fotos grandes de un album especifico.
 * @param {string} storeBase
 * @param {string} albumHref path relativo, ej '/albums/150704443'
 * @param {number} max
 */
export async function getAlbumPhotoUrls(storeBase, albumHref, max = 8) {
  const url = `${storeBase}${albumHref}?uid=1`;
  const html = await fetchHtml(url);
  const $ = cheerioLoad(html);
  const photos = [];
  $('img').each((_, el) => {
    for (const attr of ['data-src', 'data-origin-src', 'src']) {
      const v = $(el).attr(attr);
      if (v && /photo\.yupoo\.com/.test(v)) photos.push(v.split('?')[0]);
    }
  });
  const uniq = [...new Set(photos)];
  const big = uniq.filter((p) => /\/big\.jpeg$/.test(p));
  const med = uniq.filter((p) => /medium\.jpe?g$/.test(p));
  return (big.length ? big : med).slice(0, max);
}

/**
 * Descarga una foto de yupoo (necesita Referer o la CDN rechaza la peticion).
 */
export async function downloadYupooPhoto(photoUrl, storeBase) {
  const res = await fetch(photoUrl, { headers: { 'User-Agent': UA, Referer: `${storeBase}/` } });
  if (!res.ok) throw new Error(`HTTP ${res.status} descargando ${photoUrl}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Trae y descarga hasta `max` fotos de un album, devuelve buffers.
 */
export async function downloadAlbumPhotos(storeBase, albumHref, max = 8) {
  const urls = await getAlbumPhotoUrls(storeBase, albumHref, max);
  const buffers = [];
  for (const url of urls) {
    try {
      buffers.push({ url, buffer: await downloadYupooPhoto(url, storeBase) });
    } catch (e) {
      console.warn(`[yupoo-search] fallo descargando ${url}: ${e.message}`);
    }
  }
  return buffers;
}
