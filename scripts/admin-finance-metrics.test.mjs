import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadAdminFinance() {
  const source = await readFile(new URL('../web/js/admin-finance-metrics.js', import.meta.url), 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'admin-finance-metrics.js' });
  return context.window.AdminFinance;
}

test('inventory purchases affect cash but not realized profit', async () => {
  const { computeFinanceMetrics } = await loadAdminFinance();
  const metrics = computeFinanceMetrics([
    sale({ monto: 100000, costoUsd: 10, trm: 4000 }),
    expense({ categoria: 'Compra Inventario', monto: 500000 }),
    expense({ categoria: 'Envios Nacionales', monto: 12000 }),
    expense({ categoria: 'Material Empaques', monto: 3000 }),
    income({ categoria: 'Inversion Inicial de Socios', monto: 1000000 })
  ], { globalTrm: 4000 });

  assert.equal(metrics.salesRevenue, 100000);
  assert.equal(metrics.salesCount, 1);
  assert.equal(metrics.cogs, 40000);
  assert.equal(metrics.grossProfit, 60000);
  assert.equal(metrics.profitExpenses, 15000);
  assert.equal(metrics.inventoryPurchases, 500000);
  assert.equal(metrics.netProfitRealized, 45000);
  assert.equal(metrics.cashAvailable, 585000);
});

test('period filters apply to the full finance summary', async () => {
  const { computeFinanceMetrics } = await loadAdminFinance();
  const metrics = computeFinanceMetrics([
    sale({ fecha: '2026-04-20', monto: 90000, costoUsd: 10, trm: 4000 }),
    sale({ fecha: '2026-05-02', monto: 120000, costoUsd: 15, trm: 4000 }),
    expense({ fecha: '2026-05-03', categoria: 'Publicidad Pauta', monto: 20000 })
  ], { globalTrm: 4000, period: '2026-05' });

  assert.equal(metrics.salesRevenue, 120000);
  assert.equal(metrics.cogs, 60000);
  assert.equal(metrics.profitExpenses, 20000);
  assert.equal(metrics.netProfitRealized, 40000);
  assert.equal(metrics.cashAvailable, 100000);
  assert.deepEqual(Array.from(metrics.monthly.labels), ['2026-05']);
});

test('sales without associated product cost are counted as incomplete margin data', async () => {
  const { computeFinanceMetrics } = await loadAdminFinance();
  const metrics = computeFinanceMetrics([
    sale({ monto: 100000, costoUsd: 0 }),
    sale({ monto: 90000, costoUsd: 10, trm: 4000 })
  ], { globalTrm: 4000 });

  assert.equal(metrics.uncostedSalesCount, 1);
  assert.equal(metrics.salesRevenue, 190000);
  assert.equal(metrics.cogs, 40000);
});

test('monthly series separates sales, cash movement, and realized profit', async () => {
  const { computeFinanceMetrics } = await loadAdminFinance();
  const metrics = computeFinanceMetrics([
    sale({ fecha: '2026-04-20', monto: 90000, costoUsd: 10, trm: 4000 }),
    expense({ fecha: '2026-04-21', categoria: 'Compra Inventario', monto: 300000 }),
    sale({ fecha: '2026-05-02', monto: 120000, costoUsd: 15, trm: 4000 }),
    expense({ fecha: '2026-05-03', categoria: 'Publicidad Pauta', monto: 20000 })
  ], { globalTrm: 4000 });

  assert.deepEqual(Array.from(metrics.monthly.labels), ['2026-04', '2026-05']);
  assert.deepEqual(Array.from(metrics.monthly.salesRevenue), [90000, 120000]);
  assert.deepEqual(Array.from(metrics.monthly.cashOut), [300000, 20000]);
  assert.deepEqual(Array.from(metrics.monthly.netProfitRealized), [50000, 40000]);
});

function sale(overrides = {}) {
  return {
    tipo: 'ingreso',
    categoria: 'Venta de Producto',
    fecha: overrides.fecha || '2026-05-01',
    monto: overrides.monto ?? 100000,
    costo_usd_asociado: overrides.costoUsd ?? 10,
    trm: overrides.trm ?? 4000,
    descripcion: 'Venta prueba'
  };
}

function expense(overrides = {}) {
  return {
    tipo: 'gasto',
    categoria: overrides.categoria || 'Varios',
    fecha: overrides.fecha || '2026-05-01',
    monto: overrides.monto ?? 10000,
    descripcion: 'Gasto prueba'
  };
}

function income(overrides = {}) {
  return {
    tipo: 'ingreso',
    categoria: overrides.categoria || 'Reembolso',
    fecha: overrides.fecha || '2026-05-01',
    monto: overrides.monto ?? 10000,
    descripcion: 'Ingreso prueba'
  };
}
