import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadPartnerFinance() {
  const source = await readFile(new URL('../web/js/admin-partner-finance.js', import.meta.url), 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'admin-partner-finance.js' });
  return context.window.AdminPartnerFinance;
}

function twoPartners() {
  return [
    { id: 1, nombre: 'Socio 1', porcentaje: 50, activo: true },
    { id: 2, nombre: 'Socio 2', porcentaje: 50, activo: true }
  ];
}

test('reserves card debt before offering a new cut', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 5613000,
    creditCardDebt: 2521689,
    cuts: [],
    movements: [],
    partners: twoPartners()
  });

  assert.equal(result.distributionBasis, 3091311);
  assert.equal(result.newCutAvailable, 3091311);
  assert.equal(result.suggestedEvenCut, 3091310);
});

test('does not offer an already approved surplus twice', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 5613000,
    creditCardDebt: 2521689,
    cuts: [{ id: 10, estado: 'activo', monto_aprobado: 3091310 }],
    movements: [],
    partners: twoPartners()
  });

  assert.equal(result.approvedCutsTotal, 3091310);
  assert.equal(result.newCutAvailable, 1);
  assert.equal(result.suggestedEvenCut, 0);
});

test('cash and product withdrawals reduce only the selected partner balance', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 5613000,
    creditCardDebt: 2521689,
    cuts: [{
      id: 10,
      estado: 'activo',
      monto_aprobado: 3091310,
      monto_socio_1: 1545655,
      monto_socio_2: 1545655
    }],
    movements: [
      { socio_id: 1, tipo: 'retiro_producto', valor_participacion_cop: 50000, efecto_caja_cop: 0 },
      { socio_id: 2, tipo: 'retiro_efectivo', valor_participacion_cop: 500000, efecto_caja_cop: 500000 }
    ],
    partners: twoPartners()
  });

  assert.equal(result.netCashWithdrawals, 500000);
  assert.equal(result.currentPhysicalCash, 5113000);
  assert.equal(result.partnerBalances[1].balance, 1495655);
  assert.equal(result.partnerBalances[2].balance, 1045655);
});

test('signed reversals restore cash and partner balance without changing the approved cut', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 2000000,
    creditCardDebt: 0,
    cuts: [{
      id: 11,
      estado: 'activo',
      monto_aprobado: 1000000,
      monto_socio_1: 500000,
      monto_socio_2: 500000
    }],
    movements: [
      { socio_id: 1, tipo: 'retiro_efectivo', valor_participacion_cop: 200000, efecto_caja_cop: 200000 },
      { socio_id: 1, tipo: 'reversion', valor_participacion_cop: -200000, efecto_caja_cop: -200000 }
    ],
    partners: twoPartners()
  });

  assert.equal(result.netCashWithdrawals, 0);
  assert.equal(result.currentPhysicalCash, 2000000);
  assert.equal(result.partnerBalances[1].withdrawn, 0);
  assert.equal(result.partnerBalances[1].balance, 500000);
  assert.equal(result.approvedCutsTotal, 1000000);
});

test('ignores annulled cuts and normalizes invalid numeric values', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 'not-a-number',
    creditCardDebt: -500,
    cuts: [
      { estado: 'anulado', monto_aprobado: 900000 },
      { estado: 'activo', monto_aprobado: '200000', monto_socio_1: '100000', monto_socio_2: '100000' }
    ],
    movements: [],
    partners: twoPartners()
  });

  assert.equal(result.operationalCash, 0);
  assert.equal(result.creditCardDebt, 0);
  assert.equal(result.approvedCutsTotal, 200000);
  assert.equal(result.newCutAvailable, 0);
});

test('falls back to an exact 50/50 cut split when snapshot allocations are absent', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 1000000,
    creditCardDebt: 0,
    cuts: [{ id: 12, estado: 'activo', monto_aprobado: 600000 }],
    movements: [],
    partners: twoPartners()
  });

  assert.equal(result.partnerBalances[1].allocated, 300000);
  assert.equal(result.partnerBalances[2].allocated, 300000);
});
