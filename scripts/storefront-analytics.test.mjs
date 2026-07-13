import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const modulePath = resolve(root, 'web', 'js', 'analytics-consent.js');

function loadAnalytics() {
  assert.equal(existsSync(modulePath), true, 'analytics-consent.js debe existir');
  delete require.cache[modulePath];
  return require(modulePath);
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test('analytics remains disabled until the visitor accepts', () => {
  const { createAnalyticsConsent, STORAGE_KEY } = loadAnalytics();
  const storage = memoryStorage();
  const consent = createAnalyticsConsent(storage);

  assert.equal(consent.getDecision(), 'undecided');
  assert.equal(consent.canTrack(), false);
  consent.accept();
  assert.equal(consent.canTrack(), true);
  assert.equal(storage.getItem(STORAGE_KEY), 'accepted');
  consent.reject();
  assert.equal(consent.canTrack(), false);
});

test('analytics payload keeps commercial fields and removes personal data', () => {
  const { sanitizeAnalyticsEvent } = loadAnalytics();
  assert.deepEqual(sanitizeAnalyticsEvent({
    event_type: 'add_to_cart',
    product_id: 7,
    product_name: 'Colombia 1990',
    category: 'Retro',
    phone: '3000000000',
    email: 'persona@example.com',
    referrer: 'https://example.com/path?phone=3000000000#private',
    extra: { source: 'catalog', talla: 'M', total: 120000, note: 'dato libre' }
  }), {
    event_type: 'add_to_cart',
    product_id: 7,
    product_name: 'Colombia 1990',
    category: 'Retro',
    referrer: 'https://example.com/path',
    extra: { source: 'catalog', talla: 'M', total: 120000 }
  });
});

test('unknown event names are rejected', () => {
  const { sanitizeAnalyticsEvent } = loadAnalytics();
  assert.equal(sanitizeAnalyticsEvent({ event_type: 'free_form_event' }), null);
});

test('public entry pages load consent instead of starting Google Analytics directly', () => {
  for (const path of [
    'web/index.html',
    'web/catalogo.html',
    'web/nosotros.html',
    'web/preguntas-frecuentes.html',
    'web/preventa/index.html'
  ]) {
    const html = readFileSync(resolve(root, path), 'utf8');
    assert.match(html, /js\/analytics-consent\.js/);
    assert.doesNotMatch(html, /window\.dataLayer\s*=|googletagmanager\.com\/gtag\/js/);
  }
});

test('storefront events use the consent contract and the normalized funnel names', () => {
  const appSource = readFileSync(resolve(root, 'web', 'js', 'app.js'), 'utf8');
  assert.doesNotMatch(appSource, /ENABLE_PUBLIC_ANALYTICS/);
  assert.match(appSource, /H90AnalyticsConsent\.canTrack\(\)/);
  for (const eventName of ['page_view', 'view_item', 'select_size', 'add_to_cart', 'begin_checkout', 'whatsapp_support']) {
    assert.match(appSource, new RegExp(`['"]${eventName}['"]`), `${eventName} debe estar instrumentado`);
  }
  for (const legacyName of ['modal_open', 'cart_add', 'whatsapp_click']) {
    assert.doesNotMatch(appSource, new RegExp(`['"]${legacyName}['"]`));
  }
});
