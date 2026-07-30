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

/**
 * Tiendas del proveedor Snake, por seccion. El proveedor separa el catalogo:
 * la misma camiseta en version fan, player o retro vive en tiendas distintas,
 * asi que hay que buscar en la que corresponde al TYPE del excel.
 * Todas verificadas devolviendo resultados con el buscador nativo.
 */
export const PROVIDER_STORES = {
  FAN: [
    'https://bomandi.x.yupoo.com',
    'https://1040-td.x.yupoo.com',
  ],
  PLAYER: [
    'https://baike5555.x.yupoo.com',
    'https://3409834285.x.yupoo.com',
  ],
  RETRO: [
    'https://huiliyuan.x.yupoo.com',
    'https://yangdekun.x.yupoo.com',
  ],
};

/**
 * Devuelve las tiendas donde buscar segun el TYPE del excel.
 * Tipos no reconocidos buscan en todas (mejor de mas que de menos).
 */
export function storesForType(type) {
  const t = String(type || '').trim().toUpperCase();
  if (t.includes('RETRO')) return PROVIDER_STORES.RETRO;
  if (t.includes('PLAYER')) return PROVIDER_STORES.PLAYER;
  if (t.includes('FAN')) return PROVIDER_STORES.FAN;
  return [...PROVIDER_STORES.RETRO, ...PROVIDER_STORES.FAN, ...PROVIDER_STORES.PLAYER];
}

/**
 * Una camiseta de hace varias temporadas vive en la seccion retro del
 * proveedor, aunque el pedido la marque como FAN o PLAYER: las tiendas de
 * temporada solo manejan lo actual y lo del año pasado.
 *
 * Sin esto, al buscar la Liverpool 1995/96 en la tienda de fans salian
 * candidatas de 25-26 y 26-27, porque ahi no existe nada mas viejo.
 *
 * @param anioActual se pasa desde afuera para poder probarlo con una fecha fija
 */
export function esDeTemporadaVieja(descripcion, anioActual = new Date().getFullYear()) {
  const años = String(descripcion || '').match(/\b(?:19|20)\d{2}\b/g);
  if (años && años.length) {
    // El mas reciente que mencione manda: "mundial francia 98" en una del 2004
    // no la vuelve del 98.
    const masReciente = Math.max(...años.map((a) => parseInt(a, 10)));
    return masReciente < anioActual - 1;
  }
  // Temporada corta al estilo del excel: "26 27", "25 26".
  const corta = String(descripcion || '').match(/\b(\d{2})\s*[\s/-]\s*(\d{2})\b/);
  if (corta) {
    const cierre = parseInt(corta[2], 10);
    const completo = (cierre >= 70 ? 1900 : 2000) + cierre;
    return completo < anioActual - 1;
  }
  return false;
}

/**
 * Igual que storesForType, pero mirando tambien de que año es la camiseta.
 * Lo viejo se busca en retro sin importar como venga marcado.
 */
export function storesForTypeAndSeason(type, descripcion, anioActual) {
  if (esDeTemporadaVieja(descripcion, anioActual)) return PROVIDER_STORES.RETRO;
  return storesForType(type);
}

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
