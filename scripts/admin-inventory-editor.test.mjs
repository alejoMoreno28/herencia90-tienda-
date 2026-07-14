import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function loadEditor() {
  const source = await readFile(new URL('../web/js/admin-inventory-editor.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'admin-inventory-editor.js' });
  return context.window.AdminInventoryEditor;
}

function catalog() {
  return [
    { id: 1, categoria: 'Colombia', equipo: 'Camiseta A', descripcion: '', precio: 110000, costo_usd: 10.44, tallas: { S: 1, M: 2, R_M: 1 }, imagenes: [] },
    { id: 2, categoria: 'Retro', equipo: 'Camiseta B', descripcion: '', precio: 120000, costo_usd: 12.5, tallas: { S: 0, M: 1 }, imagenes: [] },
  ];
}

test('stock edits accept only safe non-negative integers', async () => {
  const editor = await loadEditor();
  const products = catalog();

  assert.equal(editor.setStock(products, 0, 'M', '4').ok, true);
  assert.equal(products[0].tallas.M, 4);
  for (const value of ['-1', '2.5', 'texto', '', '10001']) {
    const result = editor.setStock(products, 0, 'M', value);
    assert.equal(result.ok, false, `should reject ${value}`);
    assert.equal(products[0].tallas.M, 4);
  }
});

test('save plan contains only products changed since the trusted baseline', async () => {
  const editor = await loadEditor();
  const original = catalog();
  const current = editor.snapshot(original);
  current[1].precio = 125000;

  const plan = editor.buildSavePlan(current, original);

  assert.equal(plan.ok, true);
  assert.deepEqual(Array.from(plan.changedIds), [2]);
  assert.equal(plan.payload.length, 1);
  assert.equal(plan.payload[0].precio, 125000);
});

test('targeted save never includes other dirty products', async () => {
  const editor = await loadEditor();
  const original = catalog();
  const current = editor.snapshot(original);
  current[0].precio = 115000;
  current[1].precio = 125000;

  const plan = editor.buildSavePlan(current, original, [1]);

  assert.equal(plan.ok, true);
  assert.deepEqual(Array.from(plan.changedIds), [1]);
  assert.equal(plan.payload.length, 1);
});

test('reservation moves one unit atomically and never creates negative stock', async () => {
  const editor = await loadEditor();
  const products = catalog();

  const reserved = editor.moveReservation(products, 0, 'M', 'reserve');
  assert.equal(reserved.ok, true);
  assert.equal(products[0].tallas.M, 1);
  assert.equal(products[0].tallas.R_M, 2);

  editor.moveReservation(products, 0, 'M', 'reserve');
  const blocked = editor.moveReservation(products, 0, 'M', 'reserve');
  assert.equal(blocked.ok, false);
  assert.equal(products[0].tallas.M, 0);
  assert.equal(products[0].tallas.R_M, 3);
});

test('invalid catalog data blocks the complete save plan', async () => {
  const editor = await loadEditor();
  const original = catalog();
  const current = editor.snapshot(original);
  current[1].id = 1;
  current[0].tallas.M = -3;

  const plan = editor.buildSavePlan(current, original);

  assert.equal(plan.ok, false);
  assert.equal(plan.payload.length, 0);
  assert.ok(plan.errors.some((message) => /duplicado/i.test(message)));
  assert.ok(plan.errors.some((message) => /stock/i.test(message)));
});
