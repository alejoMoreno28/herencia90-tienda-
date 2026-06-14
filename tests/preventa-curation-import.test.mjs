import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const importSource = await fs.readFile('scripts/preventa-curation-import.mjs', 'utf8');
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));

test('curation import is dry-run first and avoids destructive Supabase operations', () => {
  assert.match(importSource, /No Supabase upload was performed/);
  assert.match(importSource, /--upload\s+Upload curated assets/);
  assert.match(importSource, /--apply-catalog\s+Write patched catalog/);
  assert.match(importSource, /--publish-mode replace-imagenes/);
  assert.match(importSource, /imagenes_originales/);
  assert.match(importSource, /preventa-curated/);
  assert.match(importSource, /backup/);
  assert.doesNotMatch(importSource, /\.remove\(/);
  assert.doesNotMatch(importSource, /\.upsert\(/);
  assert.doesNotMatch(importSource, /\.delete\(/);
  assert.doesNotMatch(importSource, /\.from\(['"]preventa_catalogo['"]\)/);
});

test('package exposes safe preventa curation import command', () => {
  assert.equal(pkg.scripts['preventa:curate:import'], 'node scripts/preventa-curation-import.mjs');
});

test('curation import retries transient storage upload failures', () => {
  assert.match(importSource, /--retries\s+Retry each Supabase upload/);
  assert.match(importSource, /uploadWithRetry/);
  assert.match(importSource, /retryDelayMs/);
});
