import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function htmlFiles(relativeDir, { exclude = [] } = {}) {
  return fs.readdirSync(path.join(root, relativeDir))
    .filter((file) => file.endsWith('.html') && !exclude.includes(file))
    .map((file) => ({ file, html: read(path.join(relativeDir, file)) }));
}

function maintainedProductPages() {
  const retiredLegacyPages = new Set([
    'arsenal-local-25-26.html',
    'camiseta-retro-brasil-local-2004-ronaldo.html',
  ]);
  return htmlFiles('web/camisetas').filter(({ file }) => !retiredLegacyPages.has(file));
}

function imageTags(fragment) {
  return fragment.match(/<img\b[^>]*>/gi) || [];
}

function assertResponsiveImage(tag, label, loading = 'lazy') {
  assert.match(tag, new RegExp(`\\bloading=["']${loading}["']`, 'i'), `${label} should load ${loading}`);
  assert.match(tag, /\bdecoding=["']async["']/i, `${label} should decode asynchronously`);
  assert.match(tag, /\bwidth=["']\d+["']/i, `${label} should declare a width`);
  assert.match(tag, /\bheight=["']\d+["']/i, `${label} should declare a height`);
}

test('generated pages never prefix an absolute asset URL', () => {
  const generatedPages = [
    ...maintainedProductPages(),
    ...htmlFiles('web/ciudades'),
    ...htmlFiles('web/preventa', { exclude: ['index.html'] }),
  ];

  for (const { file, html } of generatedPages) {
    assert.doesNotMatch(html, /(?:\.\.\/)+https?:\/\//i, `${file} should not contain ../https URLs`);
    assert.doesNotMatch(html, /herencia90\.shop\/https?:\/\//i, `${file} should not duplicate the site domain`);
  }
});

test('stock product main image is prioritized while local thumbnails use card assets and keep masters', () => {
  const html = read('web/camisetas/camiseta-local-arsenal-25-26.html');
  const mainImage = html.match(/<img\b[^>]*\bid=["']productMainImage["'][^>]*>/i)?.[0] || '';
  const thumbGrid = html.match(/<div class=["']thumb-grid["']>([\s\S]*?)<\/div>/i)?.[1] || '';
  const thumbs = imageTags(thumbGrid);

  assertResponsiveImage(mainImage, 'product main image', 'eager');
  assert.match(mainImage, /\bfetchpriority=["']high["']/i);
  assert.ok(thumbs.length > 1, 'sample product should expose thumbnail images');

  for (const [index, tag] of thumbs.entries()) {
    assertResponsiveImage(tag, `thumbnail ${index + 1}`);
    assert.match(tag, /-card\.webp/i, `thumbnail ${index + 1} should use an existing local card asset`);
    assert.match(tag, /\bdata-fallback-src=["'][^"']+\.webp["']/i, `thumbnail ${index + 1} should retain a master fallback`);
    assert.match(tag, /\bonerror=["'][^"']*fallbackSrc/i, `thumbnail ${index + 1} should activate its fallback on error`);
  }

  assert.match(
    thumbGrid,
    /data-image=["']\.\.\/img\/arsenal_25-26_home_fan_1\.webp["'][^>]*>[\s\S]*?<img[^>]+src=["']\.\.\/img\/arsenal_25-26_home_fan_1-card\.webp["']/i,
    'thumbnail preview should keep the master image URL for the main image/lightbox target',
  );
});

test('related and city cards are lazy, async, dimensioned, and use local card assets', () => {
  const productHtml = read('web/camisetas/camiseta-local-arsenal-25-26.html');
  const relatedSection = productHtml.match(/<section class=["']related-section["'][\s\S]*?<\/section>/i)?.[0] || '';
  const relatedImages = imageTags(relatedSection);
  assert.ok(relatedImages.length > 0, 'sample product should expose related cards');

  const cityHtml = read('web/ciudades/barranquilla.html');
  const cityGrid = cityHtml.match(/<div id=["']collectionProducts["'][^>]*>([\s\S]*?)<\/div>\s*<\/section>/i)?.[1] || '';
  const cityImages = imageTags(cityGrid);
  assert.ok(cityImages.length > 0, 'sample city should expose product cards');

  for (const [label, tags] of [['related', relatedImages], ['city', cityImages]]) {
    for (const [index, tag] of tags.entries()) {
      assertResponsiveImage(tag, `${label} image ${index + 1}`);
      if (/src=["']\.\.\/img\//i.test(tag)) {
        assert.match(tag, /-card\.webp/i, `${label} image ${index + 1} should use its local card asset`);
        assert.match(tag, /\bdata-fallback-src=["'][^"']+\.webp["']/i, `${label} image ${index + 1} should retain a master fallback`);
      }
    }
  }
});

test('generated pages use lightweight identity assets and stable preventa image geometry', () => {
  const generatedPages = [
    ...maintainedProductPages(),
    ...htmlFiles('web/ciudades'),
    ...htmlFiles('web/preventa', { exclude: ['index.html'] }),
  ];

  for (const { file, html } of generatedPages) {
    assert.match(html, /<link\s+rel=["']icon["']\s+href=["'](?:\.\.\/|\/)img\/favicon\.webp["']/i, `${file} should use favicon.webp`);
    assert.match(html, /<img\b[^>]*src=["'](?:\.\.\/|\/)img\/logo-ui\.webp["'][^>]*\bwidth=["']220["'][^>]*\bheight=["']249["']/i, `${file} should use the dimensioned UI logo`);
  }

  const preventaHtml = read('web/preventa/ac-milan-1988-1989-local.html');
  const gallery = preventaHtml.match(/<div class=["']gallery["']>([\s\S]*?)<\/div>/i)?.[1] || '';
  const galleryImages = imageTags(gallery);
  assert.ok(galleryImages.length > 1, 'sample preventa page should expose a gallery');
  assertResponsiveImage(galleryImages[0], 'preventa hero image', 'eager');
  assert.match(galleryImages[0], /\bfetchpriority=["']high["']/i);
  for (const [index, tag] of galleryImages.slice(1).entries()) {
    assertResponsiveImage(tag, `preventa gallery image ${index + 2}`);
  }
});

test('stock and city pages defer optional SDKs and live synchronization', () => {
  const pages = [
    read('web/camisetas/camiseta-local-arsenal-25-26.html'),
    read('web/ciudades/barranquilla.html'),
  ];

  for (const html of pages) {
    assert.doesNotMatch(html, /<script\b[^>]*src=["'][^"']*(?:supabase|aos|vanilla-tilt)[^"']*["'][^>]*>/i);
    assert.doesNotMatch(html, /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*aos[^"']*["']/i);
    assert.match(html, /requestIdleCallback/i);
    assert.match(html, /loadExternalScript/i);
  }
});

test('all generated templates load GA4 only after load and an idle window', () => {
  const pages = [
    read('web/camisetas/camiseta-local-arsenal-25-26.html'),
    read('web/ciudades/barranquilla.html'),
    read('web/preventa/ac-milan-1988-1989-local.html'),
  ];

  for (const html of pages) {
    const gaSnippet = html.match(/<script>\s*window\.dataLayer[\s\S]*?<\/script>/i)?.[0] || '';
    assert.match(gaSnippet, /G-576MFSV66N/);
    assert.match(gaSnippet, /addEventListener\(["']load["']/i);
    assert.match(gaSnippet, /requestIdleCallback/i);
    assert.doesNotMatch(gaSnippet, /pointerdown|keydown|touchstart/i);
  }
});

test('live product refresh is narrow, skips unchanged galleries, and has no artificial modal event', () => {
  const productHtml = read('web/camisetas/camiseta-local-arsenal-25-26.html');
  const cityHtml = read('web/ciudades/barranquilla.html');

  assert.doesNotMatch(productHtml, /trackEvent\(["']modal_open["']/i);
  assert.doesNotMatch(productHtml, /\.select\(["']\*["']\)/i);
  assert.match(productHtml, /\.select\(["']id,equipo,categoria,descripcion,precio,tallas,imagenes["']\)/i);
  assert.match(productHtml, /nextImageSignature\s*!==\s*renderedImageSignature/i);

  assert.doesNotMatch(cityHtml, /\.select\(["']\*["']\)/i);
  assert.match(cityHtml, /\.select\(["']id,equipo,categoria,descripcion,precio,tallas,imagenes["']\)/i);
  assert.match(cityHtml, /nextCollectionSignature\s*===\s*renderedCollectionSignature/i);
});
