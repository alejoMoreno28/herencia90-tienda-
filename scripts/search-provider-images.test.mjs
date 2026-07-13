import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { _private } = require('../api/search-provider-images.js');

test('provider image extraction exposes up to 8 review photos', () => {
  assert.equal(_private.MAX_PROVIDER_IMAGES, 8);
});

test('scrapeImages extracts relative and lazy product image urls', async () => {
  const fetcher = async () => ({
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

  const images = await _private.scrapeImages('https://leyendasdelfutbol.com/camiseta-test.html', fetcher);

  assert.deepEqual(images, [
    'https://leyendasdelfutbol.com/image/cache/catalog/product/spain-2026-front-800x800.jpg',
    'https://leyendasdelfutbol.com/image/cache/catalog/product/spain-2026-back-800x800.jpg',
    'https://leyendasdelfutbol.com/image/cache/catalog/product/spain-2026-detail-900x900.webp',
  ]);
});

test('scrapeImages keeps only one size variant for the same gallery photo', async () => {
  const fetcher = async () => ({
    ok: true,
    text: async () => `
      <main>
        <div class="woocommerce-product-gallery">
          <img
            src="/wp-content/uploads/2026/05/brasil-front-300x300.jpg"
            srcset="/wp-content/uploads/2026/05/brasil-front-300x300.jpg 300w, /wp-content/uploads/2026/05/brasil-front-600x600.jpg 600w, /wp-content/uploads/2026/05/brasil-front.jpg 1000w">
          <img
            src="/wp-content/uploads/2026/05/brasil-back-300x300.jpg"
            srcset="/wp-content/uploads/2026/05/brasil-back-300x300.jpg 300w, /wp-content/uploads/2026/05/brasil-back.jpg 1000w">
        </div>
      </main>
    `,
  });

  const images = await _private.scrapeImages('https://futboldeprimera.com.co/producto/brasil-2004', fetcher);

  assert.deepEqual(images, [
    'https://futboldeprimera.com.co/wp-content/uploads/2026/05/brasil-front.jpg',
    'https://futboldeprimera.com.co/wp-content/uploads/2026/05/brasil-back.jpg',
  ]);
});
