import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(resolve(ROOT, relativePath), 'utf8');

const appSource = read('web/js/app.js');
const preventaSource = read('web/js/preventa.js');
const catalogHtml = read('web/catalogo.html');
const preventaHtml = read('web/preventa/index.html');

function sectionBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing section start: ${startMarker}`);
    assert.notEqual(end, -1, `Missing section end: ${endMarker}`);
    return source.slice(start, end);
}

test('product data and Supabase runtime are gated behind a real product surface', () => {
    assert.match(
        appSource,
        /function hasProductSurface\(\)[\s\S]*?productGrid[\s\S]*?featuredProductGrid/,
        'the catalog and home grids should be the only product-runtime entry points'
    );

    const initializer = sectionBetween(
        appSource,
        'function initializeProductSurface()',
        '// ── DOM Ready'
    );
    const guardIndex = initializer.indexOf('if (!hasProductSurface()) return;');
    assert.ok(guardIndex >= 0, 'initializeProductSurface must return on content-only pages');

    for (const networkCall of ['loadProducts()', 'refreshProductsFromSupabase(', 'ensureSupabaseClient()']) {
        assert.ok(
            initializer.indexOf(networkCall) > guardIndex,
            `${networkCall} must run only after the product-surface guard`
        );
    }

    assert.match(appSource, /renderNavigation\(\);\s*initializeProductSurface\(\);/);
});

test('catalog preloads the exact product JSON once and drops stale image preloads', () => {
    const productJsonHints = catalogHtml.match(/<link[^>]+href="\/productos\.json[^>]*>/g) || [];
    const fetchUrl = appSource.match(/fetch\('(?<url>\/productos\.json\?v=[a-f0-9]{12})'\)/)?.groups?.url;
    assert.equal(productJsonHints.length, 1, 'catalog should emit one product JSON resource hint');
    assert.ok(fetchUrl, 'loadLocalProducts should fetch content-hashed product JSON');
    assert.match(productJsonHints[0], /rel="preload"[^>]+as="fetch"/);
    assert.match(productJsonHints[0], new RegExp(`href="${fetchUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), 'the preload URL must exactly match loadLocalProducts()');
    assert.doesNotMatch(catalogHtml, /<link[^>]+rel="preload"[^>]+as="image"/);
});

test('storefront analytics and icons start only after window load plus idle time', () => {
    assert.match(appSource, /function runAfterWindowLoadIdle\(/);
    assert.match(appSource, /runAfterWindowLoadIdle\(loadGoogleAnalytics/);
    assert.doesNotMatch(appSource, /runAfterFirstInteraction\(loadGoogleAnalytics/);
    assert.doesNotMatch(appSource, /unpkg\.com\/@phosphor-icons\/web/);
    assert.match(appSource, /loadPhosphorStyles\(\['regular', 'bold', 'fill'\]\)/);

    const categoryPages = readdirSync(resolve(ROOT, 'web/categorias'))
        .filter((name) => name.endsWith('.html'))
        .map((name) => `web/categorias/${name}`);
    const appPages = [
        'web/index.html',
        'web/catalogo.html',
        'web/nosotros.html',
        'web/preguntas-frecuentes.html',
        ...categoryPages,
    ];

    for (const page of appPages) {
        const html = read(page);
        assert.doesNotMatch(html, /googletagmanager|loadGtag/, `${page} should use app.js analytics scheduling`);
        assert.doesNotMatch(html, /preconnect[^>]+unpkg\.com/, `${page} should not warm an unused icon host`);
    }
});

test('preorder keeps local JSON primary and uses delayed direct REST as fallback', () => {
    assert.doesNotMatch(preventaSource, /SUPABASE_SCRIPT_URL|window\.supabase|createClient\(/);
    assert.match(preventaSource, /var PV_REMOTE_SELECT = '[^']+';/);
    const remoteSelect = preventaSource.match(/var PV_REMOTE_SELECT = '([^']+)'/)[1];
    assert.doesNotMatch(
        remoteSelect,
        /imagenes_detalle|imagenes_originales|photo_count_gallery|gallery_status/,
        'the REST fallback must request only columns present in preventa_catalogo'
    );
    assert.match(preventaSource, /fetch\(SUPABASE_URL \+ '\/rest\/v1\/preventa_catalogo\?'/);

    const loader = sectionBetween(preventaSource, 'async function pvCargar()', 'function getFilteredItems');
    assert.ok(loader.indexOf('pvFetchJson(PV_LIST_URL)') < loader.indexOf('pvLoadFullCatalog()'));
    assert.ok(loader.indexOf('pvLoadFullCatalog()') < loader.indexOf('pvLoadFromSupabaseFallback()'));
    assert.match(preventaSource, /pvRunAfterWindowLoadIdle\(function \(\) \{\s*pvRefreshFromSupabaseLater\(\);/);

    assert.doesNotMatch(preventaSource, /unpkg\.com\/@phosphor-icons\/web/);
    assert.match(preventaSource, /pvLoadPhosphorStyles\(\['bold'\]\)/);
    assert.match(preventaSource, /pvRunAfterWindowLoadIdle\(pvLoadGoogleAnalytics/);
});

test('preorder head and stable images carry the required browser hints', () => {
    assert.match(preventaHtml, /<link rel="icon" href="\/img\/favicon\.webp" type="image\/webp">/);
    assert.match(preventaHtml, /<link rel="preconnect" href="https:\/\/nlnrdtcgbdkzfzwnsffp\.supabase\.co" crossorigin>/);
    assert.doesNotMatch(preventaHtml, /preconnect[^>]+unpkg\.com/);
    assert.match(preventaHtml, /id="pv-lb-img"[^>]+width="640"[^>]+height="640"/);
    assert.match(preventaHtml, /class="drawer-logo"[^>]+width="220"[^>]+height="249"/);
    assert.doesNotMatch(preventaHtml, /googletagmanager|loadGtag/);
});
