import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadGuard() {
  const source = await readFile(new URL('../web/js/admin-inventory-guard.js', import.meta.url), 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'admin-inventory-guard.js' });
  return context.window.AdminInventoryGuard;
}

test('paid sales require at least one complete stock item', async () => {
  const { buildStockMovement } = await loadGuard();

  const result = buildStockMovement({
    category: 'Venta de Producto',
    amountCOP: 99000,
    items: [],
    products: sampleProducts()
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /selecciona/i);
});

test('paid sales cannot be saved with zero amount', async () => {
  const { buildStockMovement } = await loadGuard();

  const result = buildStockMovement({
    category: 'Venta de Producto',
    amountCOP: 0,
    items: [{ prodId: 1, talla: 'M', cantidad: 1 }],
    products: sampleProducts()
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /monto/i);
});

test('inventory-only exits allow zero amount and keep a clear prefix', async () => {
  const { buildStockMovement } = await loadGuard();

  const result = buildStockMovement({
    category: 'Regalo / Promoción',
    amountCOP: 0,
    note: 'Amigo de la marca',
    items: [{ prodId: 1, talla: 'M', cantidad: 1 }],
    products: sampleProducts()
  });

  assert.equal(result.ok, true);
  assert.equal(result.totalUnits, 1);
  assert.equal(result.description, '[REGALO] Camiseta A talla M x1 | Nota: Amigo de la marca');
});

test('stock movement rejects quantities above available stock', async () => {
  const { buildStockMovement } = await loadGuard();

  const result = buildStockMovement({
    category: 'Venta de Producto',
    amountCOP: 198000,
    items: [{ prodId: 1, talla: 'M', cantidad: 3 }],
    products: sampleProducts()
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /solo hay 2/i);
});

test('valid sales return total cost and an auditable description', async () => {
  const { buildStockMovement } = await loadGuard();

  const result = buildStockMovement({
    category: 'Venta de Producto',
    amountCOP: 198000,
    note: 'Cliente Juan',
    items: [
      { prodId: 1, talla: 'M', cantidad: 1 },
      { prodId: 2, talla: 'L', cantidad: 1 }
    ],
    products: sampleProducts()
  });

  assert.equal(result.ok, true);
  assert.equal(result.totalUnits, 2);
  assert.equal(result.totalCostUsd, 23.88);
  assert.equal(result.description, '[VENTA] Camiseta A talla M x1; Camiseta B talla L x1 | Nota: Cliente Juan');
});

function sampleProducts() {
  return [
    { id: 1, equipo: 'Camiseta A', costo_usd: 10.44, tallas: { M: 2, L: 0 } },
    { id: 2, equipo: 'Camiseta B', costo_usd: 13.44, tallas: { M: 0, L: 1 } }
  ];
}
