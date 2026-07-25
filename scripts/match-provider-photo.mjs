/**
 * scripts/match-provider-photo.mjs
 *
 * Orquestador: busca una referencia en yupoo, baja fotos de los candidatos
 * encontrados, y usa CLIP (visual_match.py) para decidir cual es la correcta.
 *
 * Uso (--query se puede repetir varias veces; el buscador de yupoo es
 * inconsistente segun la frase exacta, asi que varias variantes juntan
 * mas resultados que una sola):
 *   node scripts/match-provider-photo.mjs \
 *     --store https://huiliyuan.x.yupoo.com \
 *     --query "巴西 2004" --query "巴西2004主场" \
 *     --ref "ruta/a/foto_referencia.png" \
 *     --season "2004" --sleeve short \
 *     --max-candidates 8
 *
 * PYTHON debe apuntar al python real (no el stub de Microsoft Store), ej:
 *   PYTHON="C:/Users/PC/AppData/Local/Python/bin/python.exe" node scripts/match-provider-photo.mjs ...
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { searchYupooAlbums, downloadAlbumPhotos } from './lib/yupoo-search.mjs';

const PYTHON = process.env.PYTHON || 'python';

function parseArgs(argv) {
  const out = { maxCandidates: 5, maxPhotosPerAlbum: 6 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--store') out.store = argv[++i];
    else if (a === '--query') out.queries = (out.queries || []).concat(argv[++i]);
    else if (a === '--ref') out.ref = argv[++i];
    else if (a === '--max-candidates') out.maxCandidates = parseInt(argv[++i], 10);
    else if (a === '--max-photos') out.maxPhotosPerAlbum = parseInt(argv[++i], 10);
    else if (a === '--workdir') out.workdir = argv[++i];
    else if (a === '--season') out.season = argv[++i];
    else if (a === '--sleeve') out.sleeve = argv[++i]; // 'short' | 'long'
  }
  return out;
}

function albumIdFromHref(href) {
  const m = href.match(/\/albums\/(\d+)/);
  return m ? m[1] : href.replace(/[^a-z0-9]/gi, '_');
}

// El excel del proveedor casi siempre diferencia manga corta/larga en el titulo
// del album ("长袖" = manga larga). CLIP confunde disenos identicos que solo
// difieren en el largo de manga (visto en pruebas reales: Milan y Liverpool),
// asi que esto se filtra por texto ANTES de comparar visualmente, no despues.
const LONG_SLEEVE_RE = /长袖|manga\s*larga|long\s*sleeve/i;

function filterBySleeve(candidates, sleeve) {
  if (!sleeve) return candidates;
  const wantLong = sleeve === 'long';
  const filtered = candidates.filter((c) => LONG_SLEEVE_RE.test(c.title) === wantLong);
  return filtered.length ? filtered : candidates;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.store || !args.queries || !args.queries.length || !args.ref) {
    console.error('Uso: node match-provider-photo.mjs --store <url> --query "<termino1>" [--query "<termino2>" ...] --ref <foto.png>');
    console.error('(el buscador de yupoo es inconsistente segun la frase exacta; pasar varias frases junta resultados)');
    process.exit(1);
  }
  if (!fs.existsSync(args.ref)) {
    console.error('No existe la foto de referencia:', args.ref);
    process.exit(1);
  }

  const workdir = args.workdir || fs.mkdtempSync(path.join(process.cwd(), '_match_'));
  const candidatesDir = path.join(workdir, 'candidatos');
  fs.mkdirSync(candidatesDir, { recursive: true });

  console.log(`Buscando ${args.queries.length} variante(s) de termino en ${args.store} ...`);
  const foundByHref = new Map();
  for (const q of args.queries) {
    const results = await searchYupooAlbums(args.store, q);
    console.log(`  "${q}" -> ${results.length} resultados`);
    for (const r of results) {
      if (!foundByHref.has(r.href)) foundByHref.set(r.href, r);
    }
  }
  const found = [...foundByHref.values()];
  let pool = found;
  if (args.season) {
    const seasonRe = new RegExp(args.season, 'i');
    const filtered = found.filter((c) => seasonRe.test(c.title));
    if (filtered.length) pool = filtered;
    else console.log(`  (aviso: ningun resultado coincide con la temporada "${args.season}", usando todos los resultados)`);
  }
  pool = filterBySleeve(pool, args.sleeve);
  const candidates = pool.slice(0, args.maxCandidates);
  console.log(`${found.length} resultados unicos combinados${args.season ? `, ${pool.length} tras filtrar temporada` : ''}, revisando los primeros ${candidates.length}:`);
  candidates.forEach((c) => console.log(`  - ${c.title} (${c.href})`));

  const labelToTitle = {};
  for (const c of candidates) {
    const id = albumIdFromHref(c.href);
    const label = `album_${id}`;
    labelToTitle[label] = c.title;
    const groupDir = path.join(candidatesDir, label);
    fs.mkdirSync(groupDir, { recursive: true });

    const photos = await downloadAlbumPhotos(args.store, c.href, args.maxPhotosPerAlbum);
    photos.forEach((p, i) => {
      const ext = p.url.split('.').pop().split('?')[0];
      fs.writeFileSync(path.join(groupDir, `${i}.${ext}`), p.buffer);
    });
    console.log(`  descargadas ${photos.length} fotos de ${label}`);
  }

  console.log('\nComparando visualmente con CLIP...');
  const output = execFileSync(PYTHON, [path.join(process.cwd(), 'scripts', 'python', 'visual_match.py'), args.ref, candidatesDir], {
    encoding: 'utf8',
  });

  const result = JSON.parse(output.trim().split('\n').pop());
  if (result.error) {
    console.error('Error:', result.error);
    process.exit(1);
  }

  console.log('\n=== RESULTADO ===');
  result.ranking.forEach((r, i) => {
    const title = labelToTitle[r.label] || r.label;
    console.log(`  ${i + 1}. ${r.score.toFixed(4)}  ${title}  (${r.label})`);
  });
  console.log(`\nDecision: ${result.decision.toUpperCase()} (gap=${result.gap})`);
  if (result.decision === 'auto') {
    console.log(`Ganador: ${labelToTitle[result.winner]} (${result.winner})`);
  } else {
    console.log('Empate/gap chico -> mostrar top 2 al usuario para confirmar con un clic.');
  }

  console.log(`\n(archivos de trabajo en: ${workdir})`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
