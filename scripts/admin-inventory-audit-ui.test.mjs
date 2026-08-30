import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const web = new URL('../web/', import.meta.url);

test('mobile audit page exposes the minimal accessible workflow', async () => {
  const html = await readFile(new URL('admin-inventario-fisico.html', web), 'utf8');
  assert.match(html, /name="robots" content="noindex, nofollow/i);
  for (const id of ['audit-progress', 'product-search', 'match-button', 'save-next-button', 'issue-fields', 'summary-view']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /@supabase\/supabase-js@2/);
  assert.match(html, /js\/admin-inventory-audit-core\.js/);
  assert.match(html, /js\/admin-inventory-audit\.js/);
});

test('controller reads products but never writes to them', async () => {
  const controller = await readFile(new URL('js/admin-inventory-audit.js', web), 'utf8');
  assert.match(controller, /\.from\(['"]productos['"]\)\s*\.select/);
  assert.doesNotMatch(controller, /\.from\(['"]productos['"]\)\s*\.(?:insert|update|upsert|delete)/);
  assert.match(controller, /\.from\(['"]inventario_auditorias['"]\)/);
  assert.match(controller, /\.from\(['"]inventario_auditoria_items['"]\)/);
  assert.match(controller, /\/login\?next=\/admin-inventario-fisico/);
});

test('controller reuses the same public Supabase configuration as login', async () => {
  const controller = await readFile(new URL('js/admin-inventory-audit.js', web), 'utf8');
  const login = await readFile(new URL('login.html', web), 'utf8');
  const keyPattern = /SUPABASE_ANON_KEY\s*=\s*'([^']+)'/;
  assert.equal(controller.match(keyPattern)?.[1], login.match(keyPattern)?.[1]);
});

test('mobile stylesheet includes a desktop enhancement and touch-size controls', async () => {
  const css = await readFile(new URL('css/admin-inventario-fisico.css', web), 'utf8');
  assert.match(css, /@media\s*\(min-width:\s*700px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test('vercel serves the private route without caching', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrite = config.rewrites.find(item => item.source === '/admin-inventario-fisico');
  assert.deepEqual(rewrite, { source: '/admin-inventario-fisico', destination: '/admin-inventario-fisico.html' });
  const privateHeader = config.headers.find(item => item.source === '/admin-inventario-fisico');
  assert.match(privateHeader.headers.find(header => header.key === 'Cache-Control').value, /no-store/);
});

test('login returns only to an explicitly allowed local admin route', async () => {
  const login = await readFile(new URL('login.html', web), 'utf8');
  assert.match(login, /new Set\(\[['"]\/admin['"],\s*['"]\/admin\.html['"],\s*['"]\/admin-inventario-fisico['"]\]\)/);
  assert.match(login, /allowedNext\.has\(requestedNext\)\s*\?\s*requestedNext\s*:\s*['"]\/admin['"]/);
  assert.match(login, /window\.location\.href\s*=\s*nextPath/);
});
