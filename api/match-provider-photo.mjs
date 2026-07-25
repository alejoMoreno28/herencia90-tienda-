/**
 * api/match-provider-photo.mjs
 *
 * Handler LOCAL (solo para el robot de fotos, no se despliega en Vercel).
 * Busca una referencia en yupoo (varias frases), baja fotos candidatas,
 * y le pide al servicio Python (photo_service.py) que compare visualmente.
 */
'use strict';

import { searchYupooAlbums, downloadAlbumPhotos } from '../scripts/lib/yupoo-search.mjs';
import { buildQueriesWithGeminiFallback } from '../scripts/lib/team-translator.mjs';

const PHOTO_SERVICE = process.env.PHOTO_SERVICE_URL || 'http://127.0.0.1:5055';
const LONG_SLEEVE_RE = /长袖|manga\s*larga|long\s*sleeve/i;

function filterBySeason(candidates, season) {
  if (!season) return candidates;
  const re = new RegExp(season, 'i');
  const filtered = candidates.filter((c) => re.test(c.title));
  return filtered.length ? filtered : candidates;
}

function filterBySleeve(candidates, sleeve) {
  if (!sleeve) return candidates;
  const wantLong = sleeve === 'long';
  const filtered = candidates.filter((c) => LONG_SLEEVE_RE.test(c.title) === wantLong);
  return filtered.length ? filtered : candidates;
}

function albumIdFromHref(href) {
  const m = href.match(/\/albums\/(\d+)/);
  return m ? m[1] : href.replace(/[^a-z0-9]/gi, '_');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { store, referencePhotoBase64, description, extrasText, maxCandidates = 8, maxPhotosPerAlbum = 6 } = req.body || {};
  let { queries, season, sleeve } = req.body || {};

  if (!store || !referencePhotoBase64) {
    return res.status(400).json({ error: 'faltan store o referencePhotoBase64' });
  }

  let autoDerived = null;
  if ((!queries || !queries.length) && description) {
    // Modo automatico: se recibe la descripcion cruda del excel, y aqui se
    // traduce al chino (diccionario propio + Gemini como respaldo) en vez
    // de que alguien tenga que escribir los terminos de busqueda a mano.
    autoDerived = await buildQueriesWithGeminiFallback(description, { extrasText, geminiApiKey: process.env.GEMINI_API_KEY });
    if (!autoDerived.queries.length) {
      return res.status(200).json({ ranking: [], decision: 'no-team-match', error: autoDerived.error || 'no se reconocio el equipo', candidates: [] });
    }
    queries = autoDerived.queries;
    season = season || autoDerived.season;
    sleeve = sleeve || autoDerived.sleeve;
  }

  if (!Array.isArray(queries) || !queries.length) {
    return res.status(400).json({ error: 'faltan queries[] (o description para derivarlas automaticamente)' });
  }

  try {
    const foundByHref = new Map();
    for (const q of queries) {
      const results = await searchYupooAlbums(store, q);
      for (const r of results) if (!foundByHref.has(r.href)) foundByHref.set(r.href, r);
    }
    let pool = [...foundByHref.values()];
    pool = filterBySeason(pool, season);
    pool = filterBySleeve(pool, sleeve);
    const candidates = pool.slice(0, maxCandidates);

    if (!candidates.length) {
      return res.status(200).json({ ranking: [], decision: 'no-results', candidates: [] });
    }

    const groups = [];
    const candidateMeta = [];
    for (const c of candidates) {
      const label = `album_${albumIdFromHref(c.href)}`;
      const photos = await downloadAlbumPhotos(store, c.href, maxPhotosPerAlbum);
      if (!photos.length) continue;
      groups.push({ label, photos_b64: photos.map((p) => p.buffer.toString('base64')) });
      candidateMeta.push({
        label,
        title: c.title,
        href: c.href,
        yupooUrl: `${store}${c.href}`,
        thumbnailBase64: photos[0].buffer.toString('base64'),
        photoCount: photos.length,
        photoUrls: photos.map((p) => p.url),
      });
    }

    if (!groups.length) {
      return res.status(200).json({ ranking: [], decision: 'no-photos', candidates: candidateMeta });
    }

    const compareRes = await fetch(`${PHOTO_SERVICE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_b64: referencePhotoBase64, groups }),
    });
    if (!compareRes.ok) {
      const errText = await compareRes.text();
      return res.status(502).json({ error: `servicio de fotos IA fallo: ${errText}` });
    }
    const compareData = await compareRes.json();

    const metaByLabel = Object.fromEntries(candidateMeta.map((c) => [c.label, c]));
    const ranking = (compareData.ranking || []).map((r) => ({ ...r, ...metaByLabel[r.label] }));

    return res.status(200).json({
      ranking,
      decision: compareData.decision,
      searchInfo: autoDerived ? { teamKey: autoDerived.teamKey, queries, season, sleeve, source: autoDerived.source } : { queries, season, sleeve, source: 'manual' },
      winner: compareData.winner ? { ...metaByLabel[compareData.winner], score: compareData.ranking[0].score } : null,
      gap: compareData.gap,
    });
  } catch (err) {
    console.error('[match-provider-photo] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
