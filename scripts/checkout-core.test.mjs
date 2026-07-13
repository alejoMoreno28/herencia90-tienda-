import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const modulePath = resolve(import.meta.dirname, '..', 'web', 'js', 'checkout-core.js');

function loadCheckoutCore() {
  assert.equal(existsSync(modulePath), true, 'checkout-core.js debe existir');
  delete require.cache[modulePath];
  return require(modulePath);
}

test('checkout recalculates totals from trusted catalog prices', () => {
  const { buildCheckout } = loadCheckoutCore();
  const result = buildCheckout(
    [{ id: 7, talla: 'M', cantidad: 2, precio: 1 }],
    [{ id: 7, equipo: 'Colombia 1990', precio: 120000, tallas: { M: 3 } }]
  );

  assert.equal(result.lines[0].unitPrice, 120000);
  assert.equal(result.lines[0].lineTotal, 240000);
  assert.equal(result.subtotal, 240000);
  assert.equal(result.total, 240000);
  assert.equal(result.ready, true);
});
test('checkout rejects invalid lines and limits quantity to sellable stock', () => {
  const { buildCheckout } = loadCheckoutCore();
  const result = buildCheckout([
    { id: 7, talla: 'M', cantidad: 9 },
    { id: 7, talla: 'L', cantidad: 1 },
    { id: 999, talla: 'M', cantidad: 1 }
  ], [{ id: 7, equipo: 'Colombia 1990', precio: 100000, tallas: { M: 2, L: 0, R_M: 5 } }]);

  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.lines[0].available, 2);
  assert.equal(result.errors.some((error) => error.code === 'out_of_stock'), true);
  assert.equal(result.errors.some((error) => error.code === 'unknown_product'), true);
  assert.equal(result.ready, false);
});

test('checkout supports clearly marked bajo pedido products without inventing stock', () => {
  const { buildCheckout } = loadCheckoutCore();
  const result = buildCheckout(
    [{ id: 22, talla: 'XL', cantidad: 1 }],
    [{ id: 22, equipo: 'Retro bajo pedido', precio: 110000, categoria: 'Pre-Venta', tallas: { XL: 0 } }]
  );

  assert.equal(result.lines[0].mode, 'preorder');
  assert.equal(result.lines[0].available, null);
  assert.equal(result.ready, true);
});

test('customer validation and WhatsApp summary require complete delivery data', () => {
  const { buildCheckout, buildWhatsAppOrder, validateCustomer } = loadCheckoutCore();
  assert.equal(validateCustomer({ name: 'A', phone: '123', city: '', address: '' }).valid, false);

  const checkout = buildCheckout(
    [{ id: 7, talla: 'M', cantidad: 1 }],
    [{ id: 7, equipo: 'Colombia 1990', precio: 120000, tallas: { M: 2 } }]
  );
  const order = buildWhatsAppOrder(checkout, {
    name: 'Ana Pérez', phone: '3001234567', city: 'Medellín', address: 'Calle 10 # 20-30'
  });

  assert.equal(order.valid, true);
  assert.match(order.message, /Colombia 1990/);
  assert.match(order.message, /\$120\.000/);
  assert.doesNotMatch(order.message, /pagado|pago exitoso/i);
});

test('checkout requests a fresh server quote instead of trusting the deployed catalog snapshot', () => {
  const page = readFileSync(resolve(root, 'web/js/checkout.js'), 'utf8');
  const endpoint = readFileSync(resolve(root, 'api/checkout-quote.js'), 'utf8');

  assert.match(page, /fetch\(['"]\/api\/checkout-quote['"]/);
  assert.doesNotMatch(page, /fetch\(['"]\/productos\.json['"]/);
  assert.match(endpoint, /from\(['"]productos['"]\)/);
  assert.match(endpoint, /Cache-Control['"],\s*['"]no-store/);
  assert.doesNotMatch(endpoint, /return[^\n]+service[_-]?key/i);
});
