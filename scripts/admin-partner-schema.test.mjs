import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../docs/supabase/migrations/20260728_socios_ganancias.sql', import.meta.url);

async function loadSql() {
  return readFile(migrationUrl, 'utf8');
}

test('creates the partner ledger tables with row level security', async () => {
  const sql = await loadSql();

  for (const table of ['socios', 'cortes_ganancias', 'movimientos_socios']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`create policy "${table}_authenticated_select"`, 'i'));
  }
});

test('defines every authenticated atomic operation', async () => {
  const sql = await loadSql();
  const functions = [
    'crear_corte_ganancias',
    'registrar_retiro_efectivo_socio',
    'registrar_retiro_producto_socio',
    'revertir_movimiento_socio',
    'anular_corte_ganancias',
    'vincular_retiro_producto_historico',
    'actualizar_nombre_socio',
    'actualizar_revision_tributaria_movimiento'
  ];

  for (const functionName of functions) {
    assert.match(sql, new RegExp(`create or replace function public\\.${functionName}`, 'i'));
    assert.match(sql, new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon`, 'i'));
    assert.match(sql, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*?to authenticated`, 'i'));
  }
});

test('enforces immutable audit links and 50/50 seed data', async () => {
  const sql = await loadSql();

  assert.match(sql, /movimientos_socios_reversion_unica/i);
  assert.match(sql, /movimientos_socios_transaccion_origen_unica/i);
  assert.match(sql, /insert into public\.socios[\s\S]*\(1,\s*'Socio 1',\s*50\.00[\s\S]*\(2,\s*'Socio 2',\s*50\.00/i);
  const halfCutAssignments = (sql.match(/p_monto_aprobado\s*\/\s*2/gi) || []).length;
  assert.ok(halfCutAssignments >= 2, 'the approved cut must be split into two equal halves');
});

test('keeps product withdrawals atomic with stock and partner balance validation', async () => {
  const sql = await loadSql();

  assert.match(sql, /from public\.productos[\s\S]*for update/i);
  assert.match(sql, /jsonb_set/i);
  assert.match(sql, /Saldo insuficiente del socio/i);
  assert.match(sql, /Stock insuficiente/i);
  assert.match(sql, /revision_tributaria[\s\S]*'pendiente'/i);
});

test('prevents unauthenticated execution and fixes the function search path', async () => {
  const sql = await loadSql();

  const securityDefinerCount = (sql.match(/security definer/gi) || []).length;
  const fixedSearchPathCount = (sql.match(/set search_path = public, pg_temp/gi) || []).length;
  const authGuards = (sql.match(/auth\.uid\(\) is null/gi) || []).length;

  assert.ok(securityDefinerCount >= 8);
  assert.ok(fixedSearchPathCount >= 8);
  assert.ok(authGuards >= 8);
});
