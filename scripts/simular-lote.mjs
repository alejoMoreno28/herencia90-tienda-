/**
 * scripts/simular-lote.mjs
 *
 * Simula el flujo completo de "Ingresar nuevo lote" del admin, paso por paso,
 * usando EL MISMO codigo que corre en el navegador. Sirve para validar la
 * cadena entera sin tocar el catalogo real: llega hasta el payload final que
 * se guardaria en Supabase y lo muestra, pero NO guarda nada.
 *
 * Uso:
 *   node scripts/simular-lote.mjs _test_paste.txt
 *   node scripts/simular-lote.mjs _test_paste.txt --con-fotos   (procesa fotos de verdad)
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');

// Los modulos del admin se escribieron para el navegador: exponen su API en
// window. Se simula ese global para poder reutilizarlos tal cual.
global.window = {};
require(path.join(ROOT, 'web/js/admin-lote-workflow.js'));
require(path.join(ROOT, 'web/js/admin-lote-photo-review.js'));
const { AdminLoteWorkflow, AdminLotePhotoReview } = global.window;

const ROBOT = 'http://127.0.0.1:3001';
const archivo = process.argv[2] || '_test_paste.txt';
const conFotos = process.argv.includes('--con-fotos');

const linea = (t = '') => console.log(t);
const titulo = (t) => { linea(); linea('='.repeat(64)); linea(t); linea('='.repeat(64)); };

async function main() {
  const texto = fs.readFileSync(path.join(ROOT, archivo), 'utf8');
  const filas = texto.split('\n').map((l) => l.trimEnd()).filter(Boolean);

  titulo('PASO 1 — Pegar el excel en "Ingresar nuevo lote"');
  linea(`Se pegaron ${filas.length} filas.`);

  // ── Paso 2: el admin parsea cada fila ───────────────────────────────────
  titulo('PASO 2 — El sistema interpreta cada fila');
  const productosExistentes = JSON.parse(fs.readFileSync(path.join(ROOT, 'web/productos.json'), 'utf8'));
  const loteItems = filas.map((l) => AdminLoteWorkflow.buildLoteItemFromColumns(l.split('\t'), productosExistentes));

  loteItems.forEach((it, i) => {
    linea(`  ${i + 1}. ${it.generatedName}`);
    linea(`     talla ${it.size} x${it.qty} | ${it.type} | ${it.destino} | costo $${it.costUsd} | precio sugerido $${it.precioVenta.toLocaleString('es-CO')}`);
    linea(`     estado: ${it.matchStatus === 'new' ? 'REFERENCIA NUEVA' : it.matchStatus === 'matched' ? 'YA EXISTE (id ' + it.prodId + ')' : 'POSIBLE DUPLICADO (' + it.duplicateCandidates.length + ' candidatos)'}`);
  });

  // ── Paso 3: resolver posibles duplicados (decision del usuario) ─────────
  titulo('PASO 3 — Resolver posibles duplicados');
  const sinResolver = AdminLoteWorkflow.findUnresolvedDuplicateItems(loteItems);
  if (!sinResolver.length) {
    linea('  Nada que resolver.');
  } else {
    const vistosDup = new Set();
    for (const it of sinResolver) {
      const k = it.queryStr;
      if (vistosDup.has(k)) continue;
      vistosDup.add(k);
      linea(`\n  "${it.queryStr}" — el sistema encontro parecidos en el catalogo:`);
      it.duplicateCandidates.forEach((c, i) => {
        linea(`     ${i + 1}. ${c.equipo} (id ${c.id}) — parecido ${(c.score * 100).toFixed(0)}%`);
      });
      linea('     DECISION SIMULADA: "es una referencia NUEVA" (ninguno es el mismo)');
    }
    // Simula que el usuario marca todas como nuevas
    sinResolver.forEach((it) => { it.forceNewReference = true; });
  }

  // ── Paso 4: agrupa las referencias que necesitan fotos ──────────────────
  titulo('PASO 4 — Agrupa las referencias nuevas que necesitan fotos');
  const grupos = AdminLotePhotoReview.buildPhotoReferenceGroups(loteItems, []);
  linea(`${grupos.length} referencias nuevas necesitan fotos:`);
  grupos.forEach((g, i) => {
    linea(`  ${i + 1}. ${g.title}`);
    linea(`     tipo: ${g.type || '(sin tipo)'} | tallas: ${g.sizes.join(', ')} | total ${g.totalQty} uds | destino: ${g.destinations.join('+')}`);
  });

  // ── Paso 4: buscar en el proveedor ──────────────────────────────────────
  titulo('PASO 5 — "Buscar automatico" en el proveedor');
  for (const g of grupos) {
    linea(`\n  → ${g.title}  [${g.type}]`);
    const t0 = Date.now();
    let data;
    try {
      const res = await fetch(`${ROBOT}/api/match-provider-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: g.type, description: g.rawDescription, extrasText: g.extrasText, maxCandidates: 5 }),
      });
      data = await res.json();
    } catch (err) {
      linea(`     ERROR: no se pudo conectar al robot (${err.message})`);
      continue;
    }
    const segs = ((Date.now() - t0) / 1000).toFixed(1);
    if (!data.ranking || !data.ranking.length) {
      linea(`     SIN RESULTADOS (${segs}s) — decision: ${data.decision}`);
      g.candidates = [];
      continue;
    }
    linea(`     ${segs}s | traducido a: ${JSON.stringify(data.searchInfo?.queries)} (${data.searchInfo?.source})`);
    linea(`     buscó en: ${(data.searchInfo?.storesSearched || []).map((s) => s.replace('https://', '').replace('.x.yupoo.com', '')).join(', ')}`);
    linea(`     ${data.ranking.length} candidatos:`);
    data.ranking.forEach((r, i) => linea(`       ${i + 1}. ${r.title}  (${r.photoCount} fotos)`));
    g.candidates = data.ranking;
  }

  // ── Paso 5: elegir candidato y procesar fotos ───────────────────────────
  titulo('PASO 6 — Elegir el candidato y procesar las fotos');
  if (!conFotos) {
    linea('  (omitido: correr con --con-fotos para procesar de verdad)');
  }
  for (const g of grupos) {
    if (!g.candidates || !g.candidates.length) continue;
    const elegido = g.candidates[0]; // simula el clic del usuario en el 1ro
    linea(`\n  → ${g.title}`);
    linea(`     elegido: ${elegido.title}`);
    if (!conFotos) continue;

    const t0 = Date.now();
    try {
      const res = await fetch(`${ROBOT}/api/process-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store: elegido.store, photoUrls: elegido.photoUrls, slugHint: 'SIMULACION-' + g.title }),
      });
      const d = await res.json();
      const imgs = AdminLotePhotoReview.normalizeImageList(d.images);
      linea(`     ${((Date.now() - t0) / 1000).toFixed(1)}s → ${imgs.length} fotos listas (sin fondo, formato catalogo)`);
      g.images = imgs;
      g.selectedImages = imgs.map((_, i) => i);
      g.approved = imgs.length > 0;
      (g.itemIndexes || []).forEach((idx) => {
        const it = loteItems[idx];
        if (!it) return;
        it.aiData = it.aiData || {};
        it.aiData.imagenes_extraidas = imgs.slice();
      });
    } catch (err) {
      linea(`     ERROR procesando: ${err.message}`);
    }
  }

  // ── Paso 6: que se guardaria en el catalogo ─────────────────────────────
  titulo('PASO 7 — Lo que se guardaria en el catalogo (NO se guarda)');
  const rowsByKey = {};
  loteItems.forEach((it) => {
    const k = AdminLotePhotoReview.normalizeReferenceKey(it.queryStr) || it.queryStr;
    (rowsByKey[k] = rowsByKey[k] || []).push({ size: it.size, qty: it.qty, destino: it.destino });
  });

  const vistos = new Set();
  let idFalso = 9000;
  for (const it of loteItems) {
    if (it.prodId) continue;
    const k = AdminLotePhotoReview.normalizeReferenceKey(it.queryStr) || it.queryStr;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const p = AdminLotePhotoReview.buildCatalogProductFromLoteItem(it, idFalso++, rowsByKey[k]);
    linea(`\n  ${p.equipo}`);
    linea(`     categoria: ${p.categoria}`);
    linea(`     precio: $${p.precio.toLocaleString('es-CO')} | costo USD: ${p.costo_usd}`);
    linea(`     tallas/stock: ${JSON.stringify(p.tallas)}`);
    linea(`     fotos: ${p.imagenes.length}`);
    linea(`     descripcion: ${(p.descripcion || '').slice(0, 110)}...`);
  }

  titulo('FIN — no se guardo nada en el catalogo');
}

main().catch((e) => { console.error('Error:', e); process.exit(1); });
