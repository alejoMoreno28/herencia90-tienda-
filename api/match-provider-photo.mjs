/**
 * api/match-provider-photo.mjs
 *
 * Handler LOCAL (solo para el robot de fotos, no se despliega en Vercel).
 * Busca una referencia en yupoo (varias frases), baja fotos candidatas,
 * y le pide al servicio Python (photo_service.py) que compare visualmente.
 */
'use strict';

import { searchYupooAlbums, downloadAlbumPhotos, storesForType } from '../scripts/lib/yupoo-search.mjs';
import { buildQueriesWithGeminiFallback, COLOR_CHARS } from '../scripts/lib/team-translator.mjs';

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

// El proveedor marca la variante en el titulo: 主场 local, 客场 visitante,
// 二客 segunda visitante. Sin este filtro se mezclaban local y visitante.
const VARIANT_RE = { home: /主场/, away: /客场/, third: /二客/ };

function filterByVariant(candidates, variant) {
  if (!variant || !VARIANT_RE[variant]) return candidates;
  let filtered = candidates.filter((c) => VARIANT_RE[variant].test(c.title));
  // "客场" tambien aparece dentro de "二客"... no, son distintos, pero la
  // segunda visitante no debe colarse cuando se pidio la visitante normal.
  if (variant === 'away') filtered = filtered.filter((c) => !VARIANT_RE.third.test(c.title));
  return filtered.length ? filtered : candidates;
}

// 女装 = version mujer, 童装 = version niño. Si no se pidieron, se excluyen:
// en la tienda de fans aparecen muchisimo y tapaban a la version normal.
const WOMEN_RE = /女装|女款/;
const KIDS_RE = /童装|儿童/;

function filterByGender(candidates, gender) {
  if (gender === 'women') {
    const f = candidates.filter((c) => WOMEN_RE.test(c.title));
    return f.length ? f : candidates;
  }
  if (gender === 'kids') {
    const f = candidates.filter((c) => KIDS_RE.test(c.title));
    return f.length ? f : candidates;
  }
  const f = candidates.filter((c) => !WOMEN_RE.test(c.title) && !KIDS_RE.test(c.title));
  return f.length ? f : candidates;
}

// La busqueda de yupoo es floja: al buscar "法国 1998" tambien devuelve
// 1998摩洛哥主场 y 1998西班牙客场, que coinciden en el año pero son de otro
// equipo. Si el titulo del album no nombra al equipo, no es esa camiseta.
// Se deja como filtro suave (si no queda nada, se devuelve todo) por si algun
// vendedor escribe el equipo distinto a como lo tenemos.
function filterByTeam(candidates, teamTerms) {
  if (!Array.isArray(teamTerms) || !teamTerms.length) return candidates;
  const filtered = candidates.filter((c) => teamTerms.some((term) => c.title.includes(term)));
  return filtered.length ? filtered : candidates;
}

/**
 * Usa el color de la descripcion para descartar versiones del mismo equipo y
 * temporada. La comparacion visual sola se equivocaba aqui: para "brasil 1998
 * AMARILLA" elegia 1998巴西绿色 (la verde) por encima de la amarilla.
 *
 * Primero se intenta quedarse con los albumes que nombran ese color. Si
 * ninguno lo nombra (el color de local no suele escribirse, va implicito en
 * 主场), al menos se botan los que nombran OTRO color.
 */
function filterByColor(candidates, color) {
  if (!color) return candidates;
  const delColor = candidates.filter((c) => c.title.includes(color));
  if (delColor.length) return delColor;
  const sinOtroColor = candidates.filter((c) => !COLOR_CHARS.some((otro) => otro !== color && c.title.includes(otro)));
  return sinOtroColor.length ? sinOtroColor : candidates;
}

// 欧冠 = Champions. El proveedor vende la misma camiseta en version liga y en
// version champions, que traen parches distintos. Si la descripcion menciona
// la champions se prefiere esa; si no la menciona se prefiere la de liga, que
// es la normal.
function filterByCompetition(candidates, competition) {
  const esChampions = (c) => c.title.includes('欧冠');
  const filtrados = competition === 'champions'
    ? candidates.filter(esChampions)
    : candidates.filter((c) => !esChampions(c));
  return filtrados.length ? filtrados : candidates;
}

function albumIdFromHref(href) {
  const m = href.match(/\/albums\/(\d+)/);
  return m ? m[1] : href.replace(/[^a-z0-9]/gi, '_');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // maxPhotosPerAlbum: los albumes del proveedor traen entre 6 y 10 fotos, y
  // muchas veces las de la camiseta completa van AL FINAL, despues de los
  // primeros planos. Con un tope de 6 la camiseta entera no se llegaba a
  // comparar y albumes correctos quedaban de segundos (paso con la Real Madrid
  // 2011-12 blanca, cuya foto de cuerpo entero era la octava).
  const { store, type, referencePhotoBase64, description, extrasText, maxCandidates = 8, maxPhotosPerAlbum = 12 } = req.body || {};
  let { queries, season, sleeve, variant, gender, teamTerms, color, competition } = req.body || {};

  // El proveedor separa el catalogo por seccion: la misma camiseta en version
  // fan, player o retro vive en tiendas distintas. Se elige donde buscar
  // segun el TYPE del excel. `store` sigue aceptandose para forzar una sola.
  const stores = store ? [store] : storesForType(type);
  if (!stores.length) {
    return res.status(400).json({ error: 'falta store o type' });
  }

  // referencePhotoBase64 es OPCIONAL: si viene, se compara visualmente y el
  // sistema puede decidir solo. Si no viene (caso tipico del admin, donde el
  // excel se pega como texto y no trae las fotos), igual se busca y se
  // devuelven los candidatos con miniaturas para que el usuario elija.

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
    teamTerms = teamTerms || autoDerived.teamTerms;
    color = color || autoDerived.color;
    competition = competition || autoDerived.competition;
    season = season || autoDerived.season;
    sleeve = sleeve || autoDerived.sleeve;
    variant = variant || autoDerived.variant;
    gender = gender || autoDerived.gender;
  }

  if (!Array.isArray(queries) || !queries.length) {
    return res.status(400).json({ error: 'faltan queries[] (o description para derivarlas automaticamente)' });
  }

  try {
    // Se busca en todas las tiendas de la seccion; la clave del mapa incluye
    // la tienda porque dos tiendas distintas pueden usar el mismo href.
    const foundByKey = new Map();
    for (const s of stores) {
      for (const q of queries) {
        try {
          const results = await searchYupooAlbums(s, q);
          for (const r of results) {
            const key = `${s}${r.href}`;
            if (!foundByKey.has(key)) foundByKey.set(key, { ...r, store: s });
          }
        } catch (err) {
          console.warn(`[match-provider-photo] fallo buscando "${q}" en ${s}: ${err.message}`);
        }
      }
    }
    let pool = [...foundByKey.values()];
    pool = filterByTeam(pool, teamTerms);
    pool = filterBySeason(pool, season);
    pool = filterByColor(pool, color);
    pool = filterByCompetition(pool, competition);
    pool = filterBySleeve(pool, sleeve);
    pool = filterByVariant(pool, variant);
    pool = filterByGender(pool, gender);
    const candidates = pool.slice(0, maxCandidates);

    if (!candidates.length) {
      return res.status(200).json({ ranking: [], decision: 'no-results', candidates: [], storesSearched: stores });
    }

    const groups = [];
    const candidateMeta = [];
    for (const c of candidates) {
      const label = `album_${albumIdFromHref(c.href)}`;
      const photos = await downloadAlbumPhotos(c.store, c.href, maxPhotosPerAlbum);
      if (!photos.length) continue;
      groups.push({ label, photos_b64: photos.map((p) => p.buffer.toString('base64')) });
      candidateMeta.push({
        label,
        title: c.title,
        href: c.href,
        store: c.store,
        yupooUrl: `${c.store}${c.href}`,
        thumbnailBase64: photos[0].buffer.toString('base64'),
        photoCount: photos.length,
        photoUrls: photos.map((p) => p.url),
      });
    }

    if (!groups.length) {
      return res.status(200).json({ ranking: [], decision: 'no-photos', candidates: candidateMeta });
    }

    const searchInfo = autoDerived
      ? { teamKey: autoDerived.teamKey, teamTerms, color, competition, queries, season, sleeve, variant, gender, source: autoDerived.source, storesSearched: stores }
      : { queries, season, sleeve, variant, gender, source: 'manual', storesSearched: stores };

    // Sin foto de referencia no hay con que comparar: se devuelven los
    // candidatos en el orden en que los dio el proveedor para que el
    // usuario elija viendo las miniaturas.
    if (!referencePhotoBase64) {
      return res.status(200).json({
        ranking: candidateMeta.map((c) => ({ ...c, score: null })),
        decision: 'pick',
        searchInfo,
        winner: null,
        gap: null,
      });
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
      searchInfo,
      winner: compareData.winner ? { ...metaByLabel[compareData.winner], score: compareData.ranking[0].score } : null,
      gap: compareData.gap,
    });
  } catch (err) {
    console.error('[match-provider-photo] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
