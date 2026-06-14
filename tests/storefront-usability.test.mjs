import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function listHtmlFiles(dirPath) {
  const fullDir = path.join(root, dirPath);
  return fs.readdirSync(fullDir)
    .filter((file) => file.endsWith('.html'))
    .map((file) => path.join(dirPath, file).replaceAll('\\', '/'));
}

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}`);
    console.error(error.message);
  }
}

function hexToRgb(hex) {
  const value = hex.replace('#', '').trim();
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function channelToLinear(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelToLinear);
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function cssVariable(css, name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, 'i'));
  assert.ok(match, `${name} should be defined`);
  return match[1];
}

check('legacy product pages keep the compact product topbar', () => {
  const legacyProductPages = [
    'web/camisetas/camiseta-local-alemania-26.html',
    'web/camisetas/camiseta-local-argentina-26.html',
    'web/camisetas/camiseta-local-brasil-26.html',
    'web/camisetas/camiseta-local-colombia-26.html',
    'web/camisetas/camiseta-local-colombia-26-mujer.html',
    'web/camisetas/camiseta-edicion-especial-portugal-26.html',
  ];

  for (const page of legacyProductPages) {
    const html = read(page);
    assert.match(html, /<header class="topbar">/i, `${page} should use the compact product topbar`);
    assert.doesNotMatch(html, /<header class="header">/i, `${page} should not use the catalog header without its CSS`);
    assert.doesNotMatch(html, /<div class="mobile-top">/i, `${page} should not include the catalog mobile header`);
    assert.doesNotMatch(html, /category-drawer|drawer-logo|mobile-bottom-nav|search-overlay/i, `${page} should not include unstyled catalog mobile chrome`);
  }
});

check('preventa page exposes a real h1 for the visible page title', () => {
  const html = read('web/preventa/index.html');

  assert.match(html, /<h1 class="pv-galeria-title pv-galeria-title-minimal">Bajo pedido<\/h1>/i);
  assert.doesNotMatch(html, /<h2 class="pv-galeria-title pv-galeria-title-minimal">Bajo pedido<\/h2>/i);
});

check('desktop search fields have accessible names and form attributes', () => {
  const pages = [
    'web/index.html',
    'web/catalogo.html',
    'web/nosotros.html',
    'web/preguntas-frecuentes.html',
    ...listHtmlFiles('web/categorias'),
  ];

  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<label class="sr-only" for="searchInput">Buscar camisetas<\/label>/i, `${page} should label the search field`);
    assert.match(html, /<input type="text" id="searchInput" class="search-input" name="q" autocomplete="off"/i, `${page} should name the search field`);
  }
});

check('preventa search has an accessible name and stable form attributes', () => {
  const html = read('web/preventa/index.html');

  assert.match(html, /<label class="sr-only" for="pv-search">Buscar referencias bajo pedido<\/label>/i);
  assert.match(html, /<input type="text" class="pv-search" id="pv-search" name="q" autocomplete="off"/i);
});

check('preventa cards use stock-like square image treatment', () => {
  const js = read('web/js/preventa.js');
  const css = read('web/css/preventa.css');
  const cardImageBlock = css.match(/\.pv-card-img-wrap img\s*\{[\s\S]*?\n\s*\}/i)?.[0] || '';

  assert.match(js, /function getPreventaCardImageUrl/i, 'preventa should support curated card images');
  assert.match(js, /width="640" height="640"/i, 'preventa cards should declare square image dimensions');
  assert.match(cardImageBlock, /object-fit:\s*contain;/i, 'preventa card images should not be cropped');
  assert.doesNotMatch(cardImageBlock, /object-fit:\s*cover;/i, 'preventa card images should avoid cover crops');
});

check('homepage retro card is marked as pre-order and routes to preventa', () => {
  const html = read('web/index.html');
  const card = html.match(/<a href="\/preventa" class="category-mosaic-card card-medium"[\s\S]*?<h3>Leyendas Retro<\/h3>[\s\S]*?<\/a>/i);

  assert.ok(card, 'retro card should link to the pre-order page');
  assert.match(card[0], /<span class="mosaic-badge"[^>]*>Bajo Pedido<\/span>/i);
  assert.match(card[0], /disponibles bajo pedido/i);
  assert.match(card[0], /<span class="mosaic-link">Ver Pre-orden &rarr;<\/span>/i);
  assert.doesNotMatch(html, /<a href="\/categorias\/retro" class="category-mosaic-card card-medium"/i);
});

check('modal image placeholders use real fallback images', () => {
  const pages = [
    'web/index.html',
    'web/catalogo.html',
    'web/preventa/index.html',
    ...listHtmlFiles('web/categorias'),
    'scripts/fix_html_landing_pages.js',
  ];

  for (const page of pages) {
    assert.doesNotMatch(read(page), /<img[^>]+(?:id="mainImage"|id="pv-lb-img")[^>]+src=""/i, `${page} should not leave modal image src empty`);
  }
});

check('primary storefront colors meet readable text contrast on light backgrounds', () => {
  const css = read('web/css/style.css');
  const gold = cssVariable(css, '--gold');
  const whatsapp = cssVariable(css, '--whatsapp-green');

  assert.ok(contrastRatio(gold, '#ffffff') >= 4.5, `--gold contrast on white is ${contrastRatio(gold, '#ffffff').toFixed(2)}`);
  assert.ok(contrastRatio(whatsapp, '#ffffff') >= 4.5, `--whatsapp-green contrast with white text is ${contrastRatio(whatsapp, '#ffffff').toFixed(2)}`);
});

check('standalone product, city, and preventa pages avoid low-contrast whatsapp green', () => {
  const pages = [
    ...listHtmlFiles('web/camisetas'),
    ...listHtmlFiles('web/ciudades'),
    ...listHtmlFiles('web/preventa').filter((file) => file !== 'web/preventa/index.html'),
    'scripts/generate-product-pages.mjs',
  ];

  for (const page of pages) {
    assert.doesNotMatch(read(page), /#25d366/i, `${page} should use the accessible whatsapp green`);
  }
});

if (failures.length > 0) {
  process.exitCode = 1;
}
