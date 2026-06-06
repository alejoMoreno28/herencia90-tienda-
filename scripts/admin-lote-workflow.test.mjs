import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadWorkflow() {
  const source = await readFile(new URL('../web/js/admin-lote-workflow.js', import.meta.url), 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'admin-lote-workflow.js' });
  return context.window.AdminLoteWorkflow;
}

test('parses fixed Excel columns and creates a sellable new-reference draft', async () => {
  const workflow = await loadWorkflow();
  const item = workflow.buildLoteItemFromColumns([
    'XL',
    'PLAYER',
    'COLOMBIA LÑAYER DORSAL JAMES Y PARCHE',
    'Dorsal / Personalization, PATCHS WORLD',
    '$4,00',
    '1',
    '$14,00',
    '$18,00',
    '$262,00',
    'PREVENTA',
  ], []);

  assert.equal(item.size, 'XL');
  assert.equal(item.qty, 1);
  assert.equal(item.destino, 'PREVENTA');
  assert.equal(item.costUsd, 18);
  assert.equal(item.extraUsd, 4);
  assert.equal(item.precioVenta, 140000);
  assert.match(item.queryStr, /Camiseta Colombia/i);
  assert.doesNotMatch(item.queryStr, /lñayer|lnayer/i);
  assert.match(item.generatedDescription, /Colombia/i);
  assert.match(item.extrasLabel, /dorsal/i);
  assert.match(item.extrasLabel, /parche/i);
});

test('normalizes Manchester United 98-99 names enough to detect existing catalog references', async () => {
  const workflow = await loadWorkflow();
  const products = [
    {
      id: 7,
      equipo: 'Camiseta Manchester United 1998/99 Roja',
      descripcion: 'Retro local roja',
      precio: 130000,
      tallas: { M: 1 },
    },
  ];
  const item = workflow.buildLoteItemFromColumns([
    'L',
    'RETRO',
    'MAN UD 98/99 ROJA',
    '',
    '',
    '1',
    '$15,00',
    '$15,00',
    '$15,00',
    'STOCK',
  ], products);

  assert.equal(item.prodId, 7);
  assert.equal(item.queryStr, products[0].equipo);
  assert.equal(item.duplicateCandidates.length, 1);
});

test('marks likely duplicates as unresolved when no safe automatic match is chosen', async () => {
  const workflow = await loadWorkflow();
  const items = [
    {
      prodId: null,
      forceNewReference: false,
      duplicateCandidates: [{ id: 10, equipo: 'Camiseta Bayern Munich Local 2026/27 Roja', score: 0.72 }],
    },
    {
      prodId: null,
      forceNewReference: true,
      duplicateCandidates: [{ id: 11, equipo: 'Otra referencia', score: 0.7 }],
    },
  ];

  const unresolved = workflow.findUnresolvedDuplicateItems(items);

  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].duplicateCandidates[0].id, 10);
});

test('detects manga larga as a visible extra without forcing a schema change', async () => {
  const workflow = await loadWorkflow();
  const item = workflow.buildLoteItemFromColumns([
    'M',
    'RETRO',
    'MAN UD 97/98 ROJA MANGA LARGA',
    'MANGA LARGA',
    '$3,00',
    '1',
    '$15,00',
    '$18,00',
    '$18,00',
    'STOCK',
  ], []);

  assert.equal(item.sleeve, 'Manga larga');
  assert.equal(item.precioVenta, 140000);
  assert.match(item.extrasLabel, /manga larga/i);
  assert.match(item.generatedDescription, /manga larga/i);
});

test('builds catalog payload from generated lot metadata', async () => {
  const workflow = await loadWorkflow();
  const product = workflow.buildCatalogProductPayload({
    queryStr: 'Camiseta Bayern Munich Local 2026/27 Roja',
    generatedDescription: 'Camiseta Bayern Munich local 2026/27 roja, version fan.',
    generatedCategory: 'Equipos Europeos',
    precioVenta: 99000,
    costUsd: 11,
    aiData: { imagenes_extraidas: ['https://cdn.test/bayern.webp'] },
  }, 55);

  assert.deepEqual(asPlain(product), {
    id: 55,
    categoria: 'Equipos Europeos',
    equipo: 'Camiseta Bayern Munich Local 2026/27 Roja',
    descripcion: 'Camiseta Bayern Munich local 2026/27 roja, version fan.',
    precio: 99000,
    costo_usd: 11,
    tallas: { S: 0, M: 0, L: 0, XL: 0 },
    imagenes: ['https://cdn.test/bayern.webp'],
  });
});

test('adds visible extras to CRM pedido product names without changing catalog base names', async () => {
  const workflow = await loadWorkflow();
  const name = workflow.buildPedidoProductName('Camiseta Brasil Mundial 2026', {
    extrasLabel: 'Dorsal / personalizacion + 1 parche',
    sleeve: 'Manga larga',
  });

  assert.equal(name, 'Camiseta Brasil Mundial 2026 (Dorsal / personalizacion + 1 parche + Manga larga)');
});

function asPlain(value) {
  return JSON.parse(JSON.stringify(value));
}
