import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const policies = [
  { file: 'privacidad.html', path: '/privacidad', words: ['datos personales', 'finalidades', 'derechos', 'suprimir'] },
  { file: 'envios.html', path: '/envios', words: ['Colombia', 'costo', 'plazo', 'antes de confirmar'] },
  { file: 'cambios-devoluciones.html', path: '/cambios-devoluciones', words: ['retracto', 'cinco (5) días hábiles', 'quince (15) días calendario', 'garantía'] },
  { file: 'terminos.html', path: '/terminos', words: ['stock', 'bajo pedido', 'precio total', 'Superintendencia de Industria y Comercio'] }
];

function readWeb(path) {
  return readFileSync(resolve(root, 'web', path), 'utf8');
}

function literalPattern(value) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

test('the four public policy pages expose complete metadata and a support channel', () => {
  for (const policy of policies) {
    const file = resolve(root, 'web', policy.file);
    assert.equal(existsSync(file), true, `${policy.file} debe existir`);
    const html = readFileSync(file, 'utf8');
    assert.match(html, /<title>[^<]+\| Herencia 90<\/title>/i);
    assert.match(html, /<meta name="description" content="[^"]{50,}">/i);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://www\\.herencia90\\.shop${policy.path}">`, 'i'));
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${policy.file} debe tener un H1`);
    assert.match(html, /Última actualización:\s*13 de julio de 2026/i);
    assert.match(html, /https:\/\/wa\.me\/573126428153/i);
    assert.doesNotMatch(html, /Needs confirmation|por definir|<!--\s*(?:TODO|PLACEHOLDER)/i);
    for (const word of policy.words) assert.match(html, literalPattern(word), `${policy.file} debe explicar ${word}`);
  }
});

test('every policy page links the complete policy set and the consumer authority', () => {
  for (const policy of policies) {
    const html = readWeb(policy.file);
    for (const expected of policies) assert.match(html, new RegExp(`href="${expected.path}"`, 'i'));
    assert.match(html, /href="https:\/\/(www\.)?sic\.gov\.co\/?"/i);
  }
});

test('main storefront footers expose every policy route', () => {
  for (const file of ['index.html', 'catalogo.html', 'nosotros.html', 'preguntas-frecuentes.html', 'preventa/index.html']) {
    const html = readWeb(file);
    for (const policy of policies) {
      assert.match(html, new RegExp(`href="${policy.path}"`, 'i'), `${file} debe enlazar ${policy.path}`);
    }
  }
});

test('generated templates and sitemap source include policy navigation', () => {
  const generator = readFileSync(resolve(root, 'scripts', 'generate-product-pages.mjs'), 'utf8');
  for (const policy of policies) assert.match(generator, new RegExp(policy.path.replace('/', '\\/'), 'i'));
  assert.match(generator, /legal-footer-links/);

  const sitemap = readWeb('sitemap.xml');
  for (const policy of policies) {
    assert.match(sitemap, new RegExp(`https://www\\.herencia90\\.shop${policy.path}`));
  }
});

test('every static category and city page uses consent and legal navigation', () => {
  for (const directory of ['categorias', 'ciudades']) {
    for (const file of readdirSync(resolve(root, 'web', directory)).filter((name) => name.endsWith('.html'))) {
      const html = readWeb(`${directory}/${file}`);
      assert.match(html, /js\/analytics-consent\.js/i, `${directory}/${file} debe pedir consentimiento`);
      assert.match(html, /href="\/privacidad"/i, `${directory}/${file} debe enlazar privacidad`);
      assert.doesNotMatch(html, /window\.dataLayer\s*=|googletagmanager\.com\/gtag\/js/i);
    }
  }
});
