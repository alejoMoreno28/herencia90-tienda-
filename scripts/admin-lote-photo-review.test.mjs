import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadPhotoReview() {
  const source = await readFile(new URL('../web/js/admin-lote-photo-review.js', import.meta.url), 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'admin-lote-photo-review.js' });
  return context.window.AdminLotePhotoReview;
}

test('groups repeated stock and preventa rows by the same new reference', async () => {
  const { buildPhotoReferenceGroups } = await loadPhotoReview();
  const groups = buildPhotoReferenceGroups([
    loteItem({ queryStr: '[RETRO] COLOMBIA 90 ANOS AMARILLA', size: 'L', qty: 2, destino: 'PREVENTA' }),
    loteItem({ queryStr: '[retro] colombia 90 años amarilla', size: 'M', qty: 3, destino: 'STOCK' }),
    loteItem({ queryStr: '[RETRO] COLOMBIA 90 AÑOS AMARILLA', size: 'XL', qty: 2, destino: 'STOCK' }),
    loteItem({ queryStr: 'Producto existente', prodId: 10, size: 'M', qty: 1, destino: 'STOCK' }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].totalQty, 7);
  assert.deepEqual(asPlain(groups[0].destinations), ['PREVENTA', 'STOCK']);
  assert.deepEqual(asPlain(groups[0].sizes), ['L x2', 'M x3', 'XL x2']);
  assert.deepEqual(asPlain(groups[0].itemIndexes), [0, 1, 2]);
});

test('requires provider links and approved photos before saving new references', async () => {
  const { buildPhotoReferenceGroups, validatePhotoReferenceGroups } = await loadPhotoReview();
  const items = [
    loteItem({ queryStr: 'Brasil 2004 Ronaldo', size: 'L', qty: 1, destino: 'PREVENTA' }),
    loteItem({ queryStr: 'Roma 25/26 blanca', size: 'M', qty: 1, destino: 'STOCK' }),
  ];
  let groups = buildPhotoReferenceGroups(items);

  assert.deepEqual(asPlain(validatePhotoReferenceGroups(groups)), {
    ok: false,
    missingLinks: 2,
    missingApprovals: 2,
  });

  groups[0].providerUrl = 'https://proveedor.test/brasil-2004';
  groups[0].images = ['https://cdn.test/brasil-1.webp'];
  groups[0].approved = true;
  groups = buildPhotoReferenceGroups(items, groups);

  assert.deepEqual(asPlain(validatePhotoReferenceGroups(groups)), {
    ok: false,
    missingLinks: 1,
    missingApprovals: 1,
  });
});

test('applies approved photos and source url to every row in the grouped reference', async () => {
  const { buildPhotoReferenceGroups, applyApprovedPhotosToItems } = await loadPhotoReview();
  const items = [
    loteItem({ queryStr: 'Colombia 90 anos roja', size: 'S', qty: 2, destino: 'PREVENTA' }),
    loteItem({ queryStr: 'Colombia 90 años roja', size: 'M', qty: 1, destino: 'STOCK' }),
  ];
  const groups = buildPhotoReferenceGroups(items);
  groups[0].providerUrl = 'https://proveedor.test/colombia-roja';
  groups[0].images = ['https://cdn.test/roja-front.webp', 'https://cdn.test/roja-back.webp'];
  groups[0].approved = true;

  applyApprovedPhotosToItems(items, groups);

  assert.deepEqual(items[0].aiData.imagenes_extraidas, groups[0].images);
  assert.deepEqual(items[1].aiData.imagenes_extraidas, groups[0].images);
  assert.equal(items[0].aiData.fuente_imagenes, groups[0].providerUrl);
  assert.equal(items[1].aiData.fuente_imagenes, groups[0].providerUrl);
});

test('keeps extracted photos visible when groups are rebuilt from lote items', async () => {
  const { buildPhotoReferenceGroups, normalizeImageList } = await loadPhotoReview();
  const items = [
    loteItem({
      queryStr: 'Brasil 2004 Ronaldo',
      aiData: {
        imagenes_extraidas: [
          { url: 'https://cdn.test/brasil-front.webp' },
          'https://cdn.test/brasil-back.webp',
        ],
        imagenes_aprobadas: false,
      },
    }),
  ];

  const groups = buildPhotoReferenceGroups(items, []);

  assert.deepEqual(asPlain(groups[0].images), [
    'https://cdn.test/brasil-front.webp',
    'https://cdn.test/brasil-back.webp',
  ]);
  assert.deepEqual(asPlain(groups[0].selectedImages), [0, 1]);
  assert.deepEqual(asPlain(normalizeImageList(items[0].aiData.imagenes_extraidas)), groups[0].images);
});

test('builds a catalog product payload with only inventory table columns', async () => {
  const { buildCatalogProductFromLoteItem } = await loadPhotoReview();
  const product = buildCatalogProductFromLoteItem(loteItem({
    queryStr: '[RETRO] Real madrid 99 NEGRA',
    precioVenta: 120000,
    costUsd: 15,
    aiData: {
      categoria: 'RETRO',
      nombre_oficial: '[RETRO] Real madrid 99 NEGRA',
      descripcion: 'Tercera equipacion 99/00',
      pais_o_club: 'Real Madrid',
      decada: '1990s',
      imagenes_extraidas: [
        { url: 'https://cdn.test/real-front.webp' },
        'https://cdn.test/real-back.webp',
      ],
    },
  }), 777);

  assert.deepEqual(Object.keys(product).sort(), [
    'categoria',
    'costo_usd',
    'descripcion',
    'equipo',
    'id',
    'imagenes',
    'precio',
    'tallas',
  ]);
  assert.equal(product.id, 777);
  assert.deepEqual(product.imagenes, [
    'https://cdn.test/real-front.webp',
    'https://cdn.test/real-back.webp',
  ]);
  assert.equal(product.pais_o_club, undefined);
  assert.equal(product.decada, undefined);
});

function loteItem(overrides = {}) {
  return {
    prodId: null,
    queryStr: 'Referencia nueva',
    size: 'M',
    qty: 1,
    destino: 'STOCK',
    aiData: null,
    ...overrides,
  };
}

function asPlain(value) {
  return JSON.parse(JSON.stringify(value));
}
