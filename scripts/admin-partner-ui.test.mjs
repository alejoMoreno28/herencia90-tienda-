import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adminUrl = new URL('../web/admin.html', import.meta.url);
const ledgerUrl = new URL('../web/js/admin-partner-ledger.js', import.meta.url);

test('mounts the partner ledger in the finance dashboard', async () => {
  const admin = await readFile(adminUrl, 'utf8');

  assert.match(admin, /id="partner-ledger-root"/i);
  assert.match(admin, /js\/admin-partner-finance\.js/i);
  assert.match(admin, /js\/admin-partner-ledger\.js/i);
  assert.match(admin, /css\/admin-partner-ledger\.css/i);
  assert.match(admin, /AdminPartnerLedger\.init/i);
  assert.match(admin, /partnerMovements:\s*window\.AdminPartnerLedger\.getMovements\(\)/i);
});

test('offers the complete auditable partner workflow', async () => {
  const source = await readFile(ledgerUrl, 'utf8');

  for (const label of [
    'Cerrar ganancias',
    'Sacar efectivo',
    'Sacar camiseta',
    'Historial de socios',
    'Deuda de tarjeta',
    'Disponible para nuevo corte'
  ]) {
    assert.match(source, new RegExp(label, 'i'));
  }

  for (const rpc of [
    'crear_corte_ganancias',
    'registrar_retiro_efectivo_socio',
    'registrar_retiro_producto_socio',
    'revertir_movimiento_socio',
    'anular_corte_ganancias',
    'vincular_retiro_producto_historico',
    'actualizar_nombre_socio',
    'actualizar_revision_tributaria_movimiento'
  ]) {
    assert.match(source, new RegExp(`rpc\\(['"]${rpc}['"]`, 'i'));
  }

  assert.match(source, /p_trm_snapshot:\s*Number\(/i);
});

test('routes new personal shirt withdrawals away from the generic transaction form', async () => {
  const admin = await readFile(adminUrl, 'utf8');

  assert.doesNotMatch(admin, /data-preset="retiro"/i);
  assert.match(admin, /Retiro Personal Socio[\s\S]*AdminPartnerLedger\.openProductWithdrawal/i);
});
