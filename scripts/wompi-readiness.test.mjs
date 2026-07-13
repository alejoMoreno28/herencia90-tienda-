import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('payment migration keeps orders private and events idempotent', async () => {
  const sql = await read('docs/payments-wompi-migration.sql');
  assert.match(sql, /create table if not exists public\.wompi_orders/i);
  assert.match(sql, /create table if not exists public\.wompi_events/i);
  assert.match(sql, /unique\s*\(event_key\)/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /h90_record_wompi_event/i);
  assert.match(sql, /on conflict \(event_key\) do nothing/i);
  assert.match(sql, /grant execute on function public\.h90_record_wompi_event[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /grant[\s\S]{0,120}to\s+(anon|authenticated)/i);
});

test('rollback removes only the isolated payment objects', async () => {
  const rollback = await read('docs/payments-wompi-rollback.sql');
  assert.match(rollback, /drop function if exists public\.h90_record_wompi_event/i);
  assert.match(rollback, /drop table if exists public\.wompi_events/i);
  assert.match(rollback, /drop table if exists public\.wompi_orders/i);
  assert.doesNotMatch(rollback, /drop table[^;]*(productos|pedidos|transacciones)/i);
});

test('activation runbook defaults to disabled and requires sandbox gates', async () => {
  const runbook = await read('docs/PAGOS_WOMPI_RUNBOOK.md');
  assert.match(runbook, /WOMPI_ENABLED=false/);
  assert.match(runbook, /Sandbox/i);
  assert.match(runbook, /webhook/i);
  assert.match(runbook, /Needs confirmation/i);
  assert.match(runbook, /no activar producci[oó]n/i);
  assert.match(runbook, /2,65% \+ \$700 \+ IVA/i);
});
