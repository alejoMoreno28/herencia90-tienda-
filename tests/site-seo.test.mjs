import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
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

check('homepage includes core SEO metadata and structured data', () => {
  const html = read('web/index.html');

  assert.match(html, /<meta\s+name="description"/i);
  assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/www\.herencia90\.shop\/"/i);
  assert.match(html, /<meta\s+property="og:title"/i);
  assert.match(html, /<meta\s+property="og:description"/i);
  assert.match(html, /<meta\s+property="og:image"/i);
  assert.match(html, /<meta\s+name="twitter:card"/i);
  assert.match(html, /application\/ld\+json/i);
});

check('homepage catalog CTA points to an existing catalog section', () => {
  const html = read('web/index.html');

  assert.match(html, /href="#catalogo"/i);
  assert.match(html, /id="catalogo"/i);
  assert.match(html, /\/categorias\/colombia/i);
  assert.match(html, /\/categorias\/real-madrid/i);
  assert.match(html, /\/categorias\/retro/i);
});

check('pre-sale page uses the current whatsapp number and has SEO metadata', () => {
  const html = read('web/preventa.html');

  assert.match(html, /3126428153/);
  assert.match(html, /<meta\s+name="description"/i);
  assert.match(html, /<link\s+rel="canonical"/i);
});

check('robots and sitemap files exist and point to the live domain', () => {
  const robotsPath = path.join(root, 'web', 'robots.txt');
  const sitemapPath = path.join(root, 'web', 'sitemap.xml');

  assert.ok(fs.existsSync(robotsPath), 'robots.txt should exist');
  assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml should exist');

  const robots = fs.readFileSync(robotsPath, 'utf8');
  const sitemap = fs.readFileSync(sitemapPath, 'utf8');

  assert.match(robots, /Sitemap:\s*https:\/\/www\.herencia90\.shop\/sitemap\.xml/i);
  assert.match(sitemap, /https:\/\/www\.herencia90\.shop\//i);
});

check('vercel rewrites include clean product and category URLs', () => {
  const vercelConfig = read('vercel.json');

  assert.match(vercelConfig, /"source":\s*"\/categorias\/:slug"/i);
  assert.match(vercelConfig, /"destination":\s*"\/categorias\/:slug\.html"/i);
  assert.match(vercelConfig, /"source":\s*"\/camisetas\/:slug"/i);
  assert.match(vercelConfig, /"destination":\s*"\/camisetas\/:slug\.html"/i);
});

check('a static product page exists for every product in the catalog', () => {
  const products = JSON.parse(read('web/productos.json'));
  const productPagesDir = path.join(root, 'web', 'camisetas');

  assert.ok(fs.existsSync(productPagesDir), 'web/camisetas should exist');

  const htmlFiles = fs.readdirSync(productPagesDir).filter((file) => file.endsWith('.html'));

  assert.ok(htmlFiles.length >= products.length, 'every product should have a static html page');

  const samplePage = path.join(productPagesDir, 'camiseta-local-real-madrid-25-26.html');
  assert.ok(fs.existsSync(samplePage), 'sample product page should exist');

  const sampleHtml = fs.readFileSync(samplePage, 'utf8');
  assert.match(sampleHtml, /application\/ld\+json/i);
  assert.match(sampleHtml, /Camiseta local Real Madrid 25\/26/i);
});

check('product pages preserve analytics and refresh live product data', () => {
  const samplePage = path.join(root, 'web', 'camisetas', 'camiseta-local-real-madrid-25-26.html');
  const sampleHtml = fs.readFileSync(samplePage, 'utf8');

  assert.match(sampleHtml, /analytics_events/i);
  assert.match(sampleHtml, /trackEvent\('page_view'/i);
  assert.match(sampleHtml, /trackEvent\('modal_open'/i);
  assert.match(sampleHtml, /trackEvent\('whatsapp_click'/i);
  assert.match(sampleHtml, /db\.from\('productos'\)\.select\('\*'\)\.eq\('id'/i);
  assert.match(sampleHtml, /db\.channel\('seo-product-live-/i);
});

<<<<<<< HEAD
=======
check('static category pages exist and are included in the sitemap', () => {
  const categoryPagesDir = path.join(root, 'web', 'categorias');
  assert.ok(fs.existsSync(categoryPagesDir), 'web/categorias should exist');

  const samplePage = path.join(categoryPagesDir, 'colombia.html');
  assert.ok(fs.existsSync(samplePage), 'sample category page should exist');

  const sampleHtml = fs.readFileSync(samplePage, 'utf8');
  assert.match(sampleHtml, /Colombia 2026/i);
  assert.match(sampleHtml, /application\/ld\+json/i);
  assert.match(sampleHtml, /\/camisetas\/camiseta-local-colombia-26/i);

  const sitemap = fs.readFileSync(path.join(root, 'web', 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /https:\/\/www\.herencia90\.shop\/categorias\/colombia/i);
  assert.match(sitemap, /https:\/\/www\.herencia90\.shop\/categorias\/real-madrid/i);
});

check('category pages preserve analytics and live collection refresh', () => {
  const samplePage = path.join(root, 'web', 'categorias', 'colombia.html');
  const sampleHtml = fs.readFileSync(samplePage, 'utf8');

  assert.match(sampleHtml, /analytics_events/i);
  assert.match(sampleHtml, /STATIC_COLLECTION/i);
  assert.match(sampleHtml, /db\.from\('productos'\)\.select\('\*'\)\.in\('id'/i);
  assert.match(sampleHtml, /db\.channel\('seo-collection-live-/i);
});

>>>>>>> origin/main
check('generator syncs products from Supabase and automation workflow exists', () => {
  const generatorScript = read('scripts/generate-product-pages.mjs');
  const workflowPath = path.join(root, '.github', 'workflows', 'sync-seo-catalog.yml');

  assert.match(generatorScript, /rest\/v1\/productos\?select=\*&order=id/i);
  assert.match(generatorScript, /fs\.writeFileSync\(productsPath/i);
  assert.ok(fs.existsSync(workflowPath), 'sync workflow should exist');

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /schedule:/i);
  assert.match(workflow, /workflow_dispatch:/i);
  assert.match(workflow, /node scripts\/generate-product-pages\.mjs/i);
  assert.match(workflow, /node tests\/site-seo\.test\.mjs/i);
});

if (failures.length > 0) {
  process.exitCode = 1;
}
