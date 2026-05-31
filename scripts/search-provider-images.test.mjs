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
        <aside>
          <img src="/includes/templates/masmodas/images/1.jpg">
          <img src="/images/related/wrong-shirt.jpg">
        </aside>
        <div id="pb-right-column">
          <div id="image-block">
            <img src="/image/cache/catalog/product/spain-2026-front-800x800.jpg">
          </div>
          <ul class="thumbnail-list">
            <li><a href="image/cache/catalog/product/spain-2026-back-800x800.jpg"><img src="image/cache/catalog/product/spain-2026-back-800x800.jpg"></a></li>
            <li><img srcset="/image/cache/catalog/product/spain-2026-detail-400x400.webp 400w, /image/cache/catalog/product/spain-2026-detail-900x900.webp 900w"></li>
          </ul>
        </div>
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
