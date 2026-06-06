import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

async function loadPayments() {
  const source = await readFile(new URL('../web/js/admin-pedido-payments.js', import.meta.url), 'utf8');
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'admin-pedido-payments.js' });
  return context.window.AdminPedidoPayments;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('parses Colombian peso amounts from common admin inputs', async () => {
  const payments = await loadPayments();

  assert.equal(payments.parseCopAmount('175000'), 175000);
  assert.equal(payments.parseCopAmount('175.000'), 175000);
  assert.equal(payments.parseCopAmount('$175.000'), 175000);
  assert.equal(payments.parseCopAmount('175,000'), 175000);
  assert.equal(payments.parseCopAmount('175 mil'), 175000);
  assert.equal(payments.parseCopAmount('50.000'), 50000);
});

test('normalizes a direct abono as a replacement value, not an accumulated payment', async () => {
  const payments = await loadPayments();

  assert.deepEqual(plain(payments.normalizePaymentState(110000, 50000)), {
    total: 110000,
    abono: 50000,
    saldo: 60000,
    estado_pago: 'Abonado',
    wasCapped: false
  });
});

test('allocates one client payment across pending pedidos in order', async () => {
  const payments = await loadPayments();
  const pedidos = [
    { id: 1, cliente: 'LOBO', lote_codigo: 'Lote 2026-06-06', precio_venta: 110000, abono: 0 },
    { id: 2, cliente: 'LOBO', lote_codigo: 'Lote 2026-06-06', precio_venta: 110000, abono: 0 },
    { id: 3, cliente: 'LOBO', lote_codigo: 'Lote 2026-06-06', precio_venta: 140000, abono: 0 }
  ];

  const result = payments.allocateClientPayment(pedidos, 175000);

  assert.equal(result.appliedAmount, 175000);
  assert.equal(result.unappliedAmount, 0);
  assert.deepEqual(plain(result.updates.map((update) => ({
    id: update.id,
    delta: update.delta,
    nextAbono: update.nextAbono,
    estado_pago: update.estado_pago,
    saldo: update.saldo
  }))), [
    { id: 1, delta: 110000, nextAbono: 110000, estado_pago: 'Pagado', saldo: 0 },
    { id: 2, delta: 65000, nextAbono: 65000, estado_pago: 'Abonado', saldo: 45000 }
  ]);
});

test('builds client-lote groups using only pedidos with saldo', async () => {
  const payments = await loadPayments();
  const groups = payments.buildClientPaymentGroups([
    { id: 1, cliente: 'LOBO', lote_codigo: 'Lote A', precio_venta: 110000, abono: 110000 },
    { id: 2, cliente: 'LOBO', lote_codigo: 'Lote A', precio_venta: 110000, abono: 50000 },
    { id: 3, cliente: 'ALBA', lote_codigo: 'Lote A', precio_venta: 130000, abono: 0 }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.cliente === 'LOBO').saldo, 60000);
  assert.equal(groups.find((group) => group.cliente === 'ALBA').saldo, 130000);
});

test('admin CRM exposes separated abono controls', async () => {
  const html = await readFile(new URL('../web/admin.html', import.meta.url), 'utf8');

  assert.match(html, /js\/admin-pedido-payments\.js/);
  assert.match(html, /Abonos por cliente/);
  assert.match(html, /registrarAbonoGrupoSeleccionado/);
  assert.match(html, /editarAbonoPedido/);
  assert.match(html, /registrarAbonoClienteDesdePedido/);
  assert.match(html, /\+ Pago/);
});
