/**
 * api/preventa-yupoo-import.js
 * Vercel serverless function — POST /api/preventa-yupoo-import
 *
 * Toma la URL de un álbum Yupoo, descarga las fotos server-side,
 * las sube al bucket 'preventa-images' de Supabase y devuelve:
 *   { titulo, imagenes: [{path, url}], yupoo_origen }
 *
 * Parsers soportados (Yupoo tiene 3 templates):
 *   A) window.__PRELOADED_STATE__ JSON embed (template moderno 2022+)
 *   B) img[data-origin-src] lazy-load (template 2019-2022)
 *   C) img[data-src] / JSON embed en <script> (legacy)
 *
 * Auth: Authorization: Bearer <ADMIN_TOKEN>
 * Input body: { yupoo_album_url, slug_hint?, max_imagenes? }
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { load: cheerioLoad } = require('cheerio');
const sharp = require('sharp');

const BUCKET = 'preventa-images';
const MAX_DEFAULT = 8;

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

function normalizeUrl(raw, base) {
  if (!raw) return null;
  raw = raw.trim();
  if (raw.startsWith('//')) return 'https:' + raw;
  if (raw.startsWith('http')) return raw;
  try { return new URL(raw, base).href; } catch { return null; }
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

// ────────────────────────────────────────────────
// Fetch HTML con cabeceras de navegador
// ────────────────────────────────────────────────

async function fetchHtml(url) {
  const origin = new URL(url).origin;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      'Referer': origin,
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al obtener ${url}`);
  return res.text();
}

// ────────────────────────────────────────────────
// Parser A: window.__PRELOADED_STATE__ (moderno)
// ────────────────────────────────────────────────

function findDeep(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) return [obj, ...obj.flatMap(v => findDeep(v, depth + 1))];
  return [obj, ...Object.values(obj).flatMap(v => findDeep(v, depth + 1))];
}

function extractPhotoUrls(obj) {
  // Buscar array donde cada elemento tenga una propiedad con URL de imagen
  const IMAGE_KEY_CANDIDATES = ['url', 'src', 'photo_url', 'image_url', 'file', 'path', 'thumb'];
  for (const node of findDeep(obj)) {
    if (!Array.isArray(node) || !node.length) continue;
    if (typeof node[0] !== 'object' || !node[0]) continue;
    const imgKey = IMAGE_KEY_CANDIDATES.find(k =>
      node[0][k] && String(node[0][k]).match(/\.(jpg|jpeg|png|webp|avif)/i)
    );
    if (imgKey) return node.map(p => p[imgKey]).filter(Boolean);
  }
  return [];
}

function extractTitulo(obj) {
  const TITLE_KEYS = ['albumName', 'album_name', 'name', 'title', 'albumTitle', 'album_title'];
  for (const node of findDeep(obj)) {
    if (typeof node !== 'object' || !node) continue;
    for (const k of TITLE_KEYS) {
      if (node[k] && typeof node[k] === 'string' && node[k].length < 200) return node[k];
    }
  }
  return '';
}

function parsePreloadedState(html, baseUrl) {
  // window.__PRELOADED_STATE__ = {...};
  const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/);
  if (!match) return null;
  try {
    const state = JSON.parse(match[1]);
    const photoUrls = extractPhotoUrls(state);
    if (!photoUrls.length) return null;
    return {
      titulo: extractTitulo(state),
      imageUrls: photoUrls.map(u => normalizeUrl(u, baseUrl)).filter(Boolean),
    };
  } catch { return null; }
}

// ────────────────────────────────────────────────
// Parser B: img tags con data-origin-src / data-src
// ────────────────────────────────────────────────

function parseImgTags(html, baseUrl) {
  const $ = cheerioLoad(html);

  const titulo =
    $('h1.album__title').first().text().trim() ||
    $('.showalbumcover__title').first().text().trim() ||
    $('h1').first().text().trim() ||
    $('title').text().replace(/\s*[-|].*$/, '').trim() ||
    '';

  const imageUrls = [];
  $('img').each((_, el) => {
    const raw =
      $(el).attr('data-origin-src') ||
      $(el).attr('data-src') ||
      $(el).attr('src') || '';
    const url = normalizeUrl(raw, baseUrl);
    if (!url) return;
    // Filtrar iconos, avatares y placeholders
    if (/avatar|logo|placeholder|blank|default|\.gif|icon/i.test(url)) return;
    // Solo CDN de Yupoo
    if (!/yupoo|yupoos|yupic|photo\.|img\d*\.|p\d+\.|cdn\./i.test(url)) return;
    if (!imageUrls.includes(url)) imageUrls.push(url);
  });

  return { titulo, imageUrls };
}

// ────────────────────────────────────────────────
// Parser C: JSON en <script> tag
// ────────────────────────────────────────────────

function parseJsonScript(html, baseUrl) {
  const $ = cheerioLoad(html);
  let result = null;
  $('script[type="application/json"], script[id*="state"], script[id*="data"], script[id*="album"]').each((_, el) => {
    if (result) return;
    try {
      const data = JSON.parse($(el).text());
      const photoUrls = extractPhotoUrls(data);
      if (!photoUrls.length) return;
      result = {
        titulo: extractTitulo(data) || '',
        imageUrls: photoUrls.map(u => normalizeUrl(u, baseUrl)).filter(Boolean),
      };
    } catch { /* skip */ }
  });
  return result;
}

// ────────────────────────────────────────────────
// Descargar + comprimir + subir a Supabase Storage
// ────────────────────────────────────────────────

async function downloadAndUpload(supabase, imgUrl, storagePath, referer) {
  const res = await fetch(imgUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': referer,
      'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} descargando imagen`);
  const rawBuffer = Buffer.from(await res.arrayBuffer());

  let buffer = rawBuffer;
  let contentType = 'image/webp';
  try {
    buffer = await sharp(rawBuffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (e) {
    console.warn('[yupoo-import] sharp fallo, subiendo original:', e.message);
    const ext = imgUrl.split('.').pop().split('?')[0].toLowerCase();
    contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Supabase Storage: ${error.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return urlData.publicUrl;
}

// ────────────────────────────────────────────────
// Lógica principal (exportada para test local)
// ────────────────────────────────────────────────

async function importFromYupoo({ yupoo_album_url, slug_hint, max_imagenes = MAX_DEFAULT }) {
  let parsedUrl;
  try { parsedUrl = new URL(yupoo_album_url); } catch {
    throw new Error('URL inválida');
  }
  const hostname = parsedUrl.hostname;
  if (!hostname.includes('yupoo') && !hostname.includes('yupoos')) {
    throw new Error('Solo se aceptan URLs de yupoo.com o yupoos.com');
  }

  const html = await fetchHtml(yupoo_album_url);

  const parsed =
    parsePreloadedState(html, yupoo_album_url) ||
    parseJsonScript(html, yupoo_album_url) ||
    parseImgTags(html, yupoo_album_url);

  if (!parsed || !parsed.imageUrls.length) {
    throw new Error(
      'No se encontraron imágenes. Verifica que la URL sea de un álbum específico ' +
      '(ej: .../albums/12345678) y no de la página principal de la tienda.'
    );
  }

  const { titulo, imageUrls } = parsed;
  const slug = slug_hint || slugify(titulo) || `album-${Date.now()}`;
  const referer = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
  const supabase = getSupabase();

  const toDownload = imageUrls.slice(0, max_imagenes);
  const imagenes = [];

  for (let i = 0; i < toDownload.length; i++) {
    const storagePath = `${slug}/${i + 1}.webp`;
    try {
      const url = await downloadAndUpload(supabase, toDownload[i], storagePath, referer);
      imagenes.push({ path: storagePath, url });
      console.log(`[yupoo-import] Subida ${i + 1}/${toDownload.length}: ${storagePath}`);
    } catch (err) {
      console.warn(`[yupoo-import] Falló imagen ${i + 1}:`, err.message);
    }
  }

  if (!imagenes.length) {
    throw new Error(
      'Se encontraron URLs de imágenes pero ninguna se pudo descargar. ' +
      'El álbum puede requerir autenticación o la CDN bloquea acceso externo.'
    );
  }

  return { titulo, imagenes, yupoo_origen: yupoo_album_url };
}

// ────────────────────────────────────────────────
// Vercel handler
// ────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const adminToken = process.env.ADMIN_TOKEN || 'herencia2026';
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (token !== adminToken) return res.status(401).json({ error: 'No autorizado' });

  const { yupoo_album_url, slug_hint, max_imagenes } = req.body || {};
  if (!yupoo_album_url) return res.status(400).json({ error: 'yupoo_album_url requerido' });

  try {
    const result = await importFromYupoo({ yupoo_album_url, slug_hint, max_imagenes });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[yupoo-import] error:', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.importFromYupoo = importFromYupoo;
