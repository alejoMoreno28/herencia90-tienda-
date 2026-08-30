import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadCore() {
  const source = await readFile(new URL('../web/js/admin-inventory-audit-core.js', import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: 'admin-inventory-audit-core.js' });
  return context.window.AdminInventoryAuditCore;
}

test('stockSizes excludes reserved keys and keeps configured zero sizes', async () => {
  const core = await loadCore();
  assert.deepEqual(
    Array.from(core.stockSizes({ S: 1, M: 2, R_M: 1, XL: 0 })),
    ['S', 'M', 'XL']
  );
});

test('compareCounts reports missing physical units', async () => {
  const core = await loadCore();
  const result = core.compareCounts({ S: 1, M: 2 }, { S: 1, M: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    status: 'difference',
    missing: 1,
    extra: 0,
    difference: -1
  });
});

test('compareCounts reports a full match', async () => {
  const core = await loadCore();
  assert.equal(core.compareCounts({ S: 1 }, { S: 1 }).status, 'match');
});

test('progress calculates reviewed percentage', async () => {
  const core = await loadCore();
  assert.equal(core.progress([{ reviewed: true }, { reviewed: false }]).percent, 50);
});

test('auditRowsFromProducts freezes expected stock and excludes reservations', async () => {
  const core = await loadCore();
  const rows = core.auditRowsFromProducts([{
    id: 7,
    equipo: 'Colombia 2026',
    descripcion: 'Local',
    imagenes: ['https://example.com/colombia.webp'],
    tallas: { S: 1, M: 2, R_M: 1 }
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(rows[0].expectedCounts)), { S: 1, M: 2 });
  assert.equal(rows[0].image, 'https://example.com/colombia.webp');
});

test('toCsv escapes content and includes difference details', async () => {
  const core = await loadCore();
  const csv = core.toCsv([{
    productId: 7,
    product: 'Colombia, Local',
    size: 'M',
    expected: 2,
    physical: 1,
    issue: 'No aparece',
    note: 'Revisar "bodega"'
  }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Colombia, Local"/);
  assert.match(csv, /"Revisar ""bodega"""/);
  assert.match(csv, /No aparece/);
});

test('migration creates owner-protected audit tables without mutating products', async () => {
  const sql = await readFile(new URL('../docs/supabase/migrations/20260830_inventario_fisico_auditoria.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.inventario_auditorias/i);
  assert.match(sql, /create table if not exists public\.inventario_auditoria_items/i);
  assert.match(sql, /owner_id uuid not null default auth\.uid\(\)/i);
  assert.match(sql, /alter table public\.inventario_auditorias enable row level security/i);
  assert.match(sql, /owner_id = auth\.uid\(\)/i);
  assert.match(sql, /revoke all on table public\.inventario_auditorias from anon/i);
  assert.doesNotMatch(sql, /update\s+public\.productos|delete\s+from\s+public\.productos/i);
});
