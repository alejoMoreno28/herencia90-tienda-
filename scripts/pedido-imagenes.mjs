/**
 * pedido-imagenes.mjs
 * Busca imágenes de referencia en DuckDuckGo para cada camiseta del pedido
 * y las inserta como miniaturas en la columna A del Excel.
 *
 * Uso:
 *   node scripts/pedido-imagenes.mjs
 *   node scripts/pedido-imagenes.mjs "PEDIDO 2 HERENCIA 90 .xlsx"
 *
 * Requisitos: npm install exceljs sharp
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const EXCEL_FILE = process.argv[2] || 'PEDIDO HERENCIA 90 LIMPIO.xlsx';
const SHEET_NAME = process.argv[3] || 'ORDER';
const CACHE_DIR = path.join(ROOT, '.pedido-imagenes-cache');
const IMG_W = 90;
const IMG_H = 90;
const ROW_HEIGHT = 68;  // puntos Excel (~1pt ≈ 1.33px)
const COL_A_WIDTH = 14; // caracteres

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function safeName(str) {
  return str.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 60);
}

// ─── búsqueda de imágenes con DuckDuckGo ──────────────────────────────────────

async function getDDGImageUrls(query) {
  // Paso 1: obtener token vqd
  const searchRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=images`,
    { headers: { 'User-Agent': UA } }
  );
  const html = await searchRes.text();

  const vqdMatch = html.match(/vqd=["']?([\d-]+)["']?/) || html.match(/vqd=([^&"'\s<]+)/);
  if (!vqdMatch) return [];
  return fetchDDGImages(query, vqdMatch[1]);
}

async function fetchDDGImages(query, vqd) {
  await sleep(400);
  const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': 'https://duckduckgo.com/' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.results || [];
  // Devolver las primeras 5 URLs para poder reintentar si alguna falla
  return results.slice(0, 5).map(r => r.image || r.thumbnail).filter(Boolean);
}

// ─── descarga y resize ────────────────────────────────────────────────────────

async function downloadImage(url, cacheKey) {
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.jpg`);

  if (existsSync(cachePath)) {
    return readFile(cachePath);
  }

  const referer = new URL(url).origin + '/';
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Referer': referer },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const raw = Buffer.from(await res.arrayBuffer());
  const resized = await sharp(raw)
    .resize(IMG_W, IMG_H, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 88 })
    .toBuffer();

  await writeFile(cachePath, resized);
  return resized;
}

// ─── construcción de query de búsqueda ────────────────────────────────────────

function buildQuery(version, comment) {
  // Eliminar aclaraciones en paréntesis que confunden la búsqueda
  const cleanComment = comment.replace(/\(.*?\)/g, '').trim();

  const tipo = version === 'RETRO'      ? 'retro' :
               version === 'FAN WOMAN'  ? 'women' :
               version === 'PLAYER'     ? 'player issue' :
               version === 'GOALKEEPER' ? 'goalkeeper' :
               '';

  // "flat lay" y "white background" ayudan a encontrar fotos de producto sin modelo
  return `${cleanComment} ${tipo} football shirt jersey flat lay white background`.trim();
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });

  const filePath = path.join(ROOT, EXCEL_FILE);
  if (!existsSync(filePath)) {
    console.error(`Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  console.log(`\nLeyendo: ${EXCEL_FILE}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) {
    console.error(`Hoja "${SHEET_NAME}" no encontrada.`);
    process.exit(1);
  }

  ws.getColumn(1).width = COL_A_WIDTH;

  const cache = new Map(); // cacheKey → Buffer

  let processed = 0;
  let skipped = 0;

  // En el nuevo template ORDER los headers están en filas 1-2, datos desde fila 3
  // En el template antiguo "Pedido 2" los headers están en fila 1, datos desde fila 2
  const dataStartRow = SHEET_NAME === 'ORDER' ? 3 : 2;

  for (let r = dataStartRow; r <= ws.rowCount + 5; r++) {
    const row = ws.getRow(r);
    const version = String(row.getCell(3).value || '').trim();
    const comment = String(row.getCell(4).value || '').trim();

    if (!version || !comment) continue; // fila vacía

    const query = buildQuery(version, comment);
    const cacheKey = safeName(query);

    let imgBuffer;

    if (cache.has(cacheKey)) {
      imgBuffer = cache.get(cacheKey);
      console.log(`Fila ${r}: ♻  reutilizando imagen → "${comment}"`);
    } else {
      console.log(`Fila ${r}: 🔍 buscando "${query}" ...`);
      try {
        const imgUrls = await getDDGImageUrls(query);
        if (!imgUrls.length) {
          console.warn(`       Sin resultados. Fila saltada.`);
          skipped++;
          continue;
        }
        let downloaded = false;
        for (const url of imgUrls) {
          try {
            console.log(`       ↓  ${url.slice(0, 80)}`);
            imgBuffer = await downloadImage(url, cacheKey);
            downloaded = true;
            break;
          } catch (e) {
            console.warn(`       ✗  ${e.message} — reintentando...`);
            await sleep(500);
          }
        }
        if (!downloaded) {
          console.warn(`       Todas las URLs fallaron. Fila saltada.`);
          skipped++;
          continue;
        }
        cache.set(cacheKey, imgBuffer);
        processed++;
        await sleep(1200);
      } catch (err) {
        console.warn(`       Error: ${err.message}`);
        skipped++;
        continue;
      }
    }

    // Insertar imagen en la celda A (columna 0, fila r-1 en base-0)
    const imgId = wb.addImage({ buffer: imgBuffer, extension: 'jpeg' });
    ws.addImage(imgId, {
      tl: { col: 0, row: r - 1 },
      br: { col: 1, row: r },
      editAs: 'oneCell',
    });

    row.height = ROW_HEIGHT;
  }

  const outName = EXCEL_FILE.replace('.xlsx', ' CON FOTOS.xlsx');
  const outPath = path.join(ROOT, outName);
  await wb.xlsx.writeFile(outPath);

  console.log(`\n✓ Guardado: ${outName}`);
  console.log(`  Imágenes insertadas: ${processed + (cache.size - processed)}`);
  if (skipped > 0) console.log(`  Filas sin imagen:    ${skipped}`);
}

run().catch(err => {
  console.error('\nError fatal:', err.message);
  process.exit(1);
});
