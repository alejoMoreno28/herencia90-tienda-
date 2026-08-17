import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const htmlPath = path.join(root, 'web', 'bio.html');
const cssPath = path.join(root, 'web', 'css', 'bio.css');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getAttribute(tag, name) {
  return tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'i'))?.[1] ?? '';
}

function getAnchorsByAttribute(html, attribute) {
  return [...html.matchAll(new RegExp(`<a\\b[^>]*\\s${attribute}="([^"]+)"[^>]*>`, 'gi'))]
    .map((match) => ({
      name: match[1],
      href: getAttribute(match[0], 'href').replaceAll('&amp;', '&'),
      tag: match[0],
    }));
}

test('bio page HTML and stylesheet exist', () => {
  assert.ok(fs.existsSync(htmlPath), 'web/bio.html should exist');
  assert.ok(fs.existsSync(cssPath), 'web/css/bio.css should exist');
});

test('bio page exposes Spanish, canonical and social metadata', () => {
  const html = read(htmlPath);

  assert.match(html, /<html\s+lang="es">/i);
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, 'bio page should have exactly one h1');
  assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/www\.herencia90\.shop\/bio">/i);
  assert.match(html, /<meta\s+property="og:title"/i);
  assert.match(html, /<meta\s+property="og:description"/i);
  assert.match(html, /<meta\s+property="og:url"\s+content="https:\/\/www\.herencia90\.shop\/bio">/i);
  assert.match(html, /<meta\s+property="og:image"\s+content="https:\/\/www\.herencia90\.shop\/img\/logo\.webp">/i);
  assert.match(html, /<link\s+rel="icon"\s+href="\/img\/favicon\.webp"/i);
  assert.match(html, /<link\s+rel="stylesheet"\s+href="\/css\/bio\.css(?:\?v=[a-f0-9]{12})?">/i);
});

test('web fonts load without blocking and retain a no-JavaScript fallback', () => {
  const html = read(htmlPath);

  assert.match(html, /<link\s+rel="preload"\s+as="style"\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^>]+">/i);
  assert.match(html, /<link\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^>]+"\s+rel="stylesheet"\s+media="print"\s+onload="this\.media='all'">/i);
  assert.match(html, /<noscript><link\s+href="https:\/\/fonts\.googleapis\.com\/css2\?[^>]+"\s+rel="stylesheet"><\/noscript>/i);
});

test('exactly four large CTAs keep the approved conversion order', () => {
  const html = read(htmlPath);
  const ctas = getAnchorsByAttribute(html, 'data-cta');

  assert.deepEqual(ctas.map(({ name }) => name), ['whatsapp', 'stock', 'preorden', 'mundial-2026']);
  assert.match(ctas[0].tag, /class="[^"]*cta-card--primary[^"]*"/i);

  const whatsapp = new URL(ctas[0].href);
  assert.equal(whatsapp.hostname, 'wa.me');
  assert.equal(whatsapp.pathname, '/573126428153');
  assert.match(whatsapp.searchParams.get('text') ?? '', /TikTok/i);
});

test('every internal CTA carries TikTok attribution and unique content', () => {
  const html = read(htmlPath);
  const internalAnchors = getAnchorsByAttribute(html, 'data-internal');
  const contents = new Set();

  assert.equal(internalAnchors.length, 4, 'stock, pre-order, Mundial 2026 and FAQ should be attributed');

  for (const anchor of internalAnchors) {
    const url = new URL(anchor.href, 'https://www.herencia90.shop');
    assert.equal(url.searchParams.get('utm_source'), 'tiktok', `${anchor.name} should include utm_source`);
    assert.equal(url.searchParams.get('utm_medium'), 'social', `${anchor.name} should include utm_medium`);
    assert.equal(url.searchParams.get('utm_campaign'), 'bio', `${anchor.name} should include utm_campaign`);
    assert.ok(url.searchParams.get('utm_content'), `${anchor.name} should include utm_content`);
    contents.add(url.searchParams.get('utm_content'));
  }

  assert.equal(contents.size, internalAnchors.length, 'utm_content values should be unique');
});

test('ticket anchor, trust signals and secondary links are present', () => {
  const html = read(htmlPath);

  assert.match(html, /class="ticket-number"[^>]*>[\s\S]*90[\s\S]*<\/span>/i);
  assert.match(html, /Pago contra entrega/i);
  assert.match(html, /Env[ií]os a toda Colombia/i);
  assert.match(html, /Calidad revisada/i);
  assert.match(html, /href="https:\/\/www\.instagram\.com\/herencia90_\/"/i);
  assert.match(html, /href="https:\/\/www\.tiktok\.com\/@herencia90_"/i);
  assert.match(html, /data-internal="faq"/i);
});

test('page stays static and loads only the lightweight brand logo', () => {
  const html = read(htmlPath);
  const imageSources = [...html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/gi)].map((match) => match[1]);

  assert.doesNotMatch(html, /<script\b|app\.js|supabase|icon[-_ ]?font|carousel/i);
  assert.doesNotMatch(html, /<(?:video|picture|source)\b/i);
  assert.deepEqual(imageSources, ['/img/logo-ui.webp']);
});

test('CSS protects accessibility, touch targets and horizontal fit', () => {
  const css = read(cssPath);

  assert.match(css, /--font-display:\s*['"]Oswald['"][^;]*;/i);
  assert.match(css, /--font-body:\s*['"]Montserrat['"][^;]*;/i);
  assert.match(css, /\.cta-card\s*\{[\s\S]*?min-height:\s*(?:[5-9]\d|\d{3,})px;/i);
  assert.match(css, /\.secondary-link\s*\{[\s\S]*?min-height:\s*(?:4[4-9]|[5-9]\d|\d{3,})px;/i);
  assert.match(css, /:focus-visible/i);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
  assert.match(css, /overflow-x:\s*(?:hidden|clip)/i);
});

test('skip link lands on the focusable CTA navigation', () => {
  const html = read(htmlPath);

  assert.match(html, /<a\s+class="skip-link"\s+href="#acciones">Ir a los enlaces<\/a>/i);
  assert.match(html, /<nav\s+class="cta-list"\s+id="acciones"\s+tabindex="-1"\s+aria-label="Compra y atención">/i);
});

test('HTML and CSS stay inside the lightweight budget', () => {
  assert.ok(fs.statSync(htmlPath).size <= 18 * 1024, 'bio HTML should stay at or below 18 KB');
  assert.ok(fs.statSync(cssPath).size <= 24 * 1024, 'bio CSS should stay at or below 24 KB');
});
