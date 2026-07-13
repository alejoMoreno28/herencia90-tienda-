import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const modulePath = resolve(root, 'scripts', 'lib', 'catalog-seo.mjs');
const siteUrl = 'https://www.herencia90.shop';

async function loadCatalogSeo() {
  assert.equal(existsSync(modulePath), true, 'catalog-seo.mjs debe existir');
  return import(`${new URL(`file:///${modulePath.replace(/\\/g, '/')}`).href}?test=${Date.now()}`);
}

test('asset urls keep absolute sources and normalize local paths', async () => {
  const { absoluteAssetUrl } = await loadCatalogSeo();
  assert.equal(
    absoluteAssetUrl('https://cdn.example.com/product.webp', siteUrl),
    'https://cdn.example.com/product.webp'
  );
  assert.equal(
    absoluteAssetUrl('/img/product.webp', siteUrl),
    'https://www.herencia90.shop/img/product.webp'
  );
});

test('sellable sizes and totals exclude reserved keys', async () => {
  const { getSellableSizes, getSellableStock } = await loadCatalogSeo();
  const sizes = { S: 1, M: '2', L: 0, R_M: 4, R_XL: '1' };
  assert.deepEqual(getSellableSizes(sizes), ['S', 'M']);
  assert.equal(getSellableStock(sizes), 3);
});

test('schema description is never empty', async () => {
  const { buildProductSchemaDescription } = await loadCatalogSeo();
  assert.equal(
    buildProductSchemaDescription({ equipo: 'Colombia 1990', descripcion: '' }, ['M', 'L']),
    'Camiseta Colombia 1990 disponible en HERENCIA90. Tallas disponibles: M y L.'
  );
});

test('generated product pages contain valid image urls and no reserved sizes', () => {
  const productDir = resolve(root, 'web', 'camisetas');
  const files = readdirSync(productDir).filter((name) => name.endsWith('.html'));
  assert.ok(files.length > 0);

  for (const file of files) {
    const html = readFileSync(resolve(productDir, file), 'utf8');
    assert.doesNotMatch(html, /herencia90\.shop\/https:\/\//i, `${file} contiene una imagen schema invalida`);
    assert.doesNotMatch(html, /<span>R_[^<]+<\/span>/i, `${file} expone una reserva como talla`);

    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    const productSchema = scripts
      .map((match) => JSON.parse(match[1]))
      .find((schema) => schema['@type'] === 'Product');
    assert.ok(productSchema, `${file} debe incluir Product schema`);
    assert.ok(String(productSchema.description || '').trim(), `${file} debe incluir descripcion schema`);
    for (const image of Array.isArray(productSchema.image) ? productSchema.image : [productSchema.image]) {
      assert.match(String(image), /^https:\/\//i, `${file} debe usar imagen absoluta HTTPS`);
    }
  }
});
