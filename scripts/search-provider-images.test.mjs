import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _private } = require('../api/search-provider-images.js');

test('scrapeImages extracts relative and lazy product image urls', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    text: async () => `
      <main id="content">
        <img src="/image/cache/catalog/product/spain-2026-front-800x800.jpg">
        <img data-zoom-image="image/cache/catalog/product/spain-2026-back-800x800.jpg">
        <img srcset="/image/cache/catalog/product/spain-2026-detail-400x400.webp 400w, /image/cache/catalog/product/spain-2026-detail-900x900.webp 900w">
        <img src="/catalog/view/theme/logo.png">
        <a href="/image/cache/catalog/product/spain-2026-extra.png">zoom</a>
      </main>
    `,
  });

  try {
    const images = await _private.scrapeImages('https://www.camisetafutboles.com/camiseta-test.html');

    assert.deepEqual(images, [
      'https://www.camisetafutboles.com/image/cache/catalog/product/spain-2026-front-800x800.jpg',
      'https://www.camisetafutboles.com/image/cache/catalog/product/spain-2026-back-800x800.jpg',
      'https://www.camisetafutboles.com/image/cache/catalog/product/spain-2026-detail-400x400.webp',
      'https://www.camisetafutboles.com/image/cache/catalog/product/spain-2026-detail-900x900.webp',
    ]);
  } finally {
    global.fetch = previousFetch;
  }
});
