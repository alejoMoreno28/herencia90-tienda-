import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const curateSource = await fs.readFile('scripts/preventa-curate-local.mjs', 'utf8');
const removeBgSource = await fs.readFile('scripts/preventa-birefnet-remove-bg.py', 'utf8');
const catalog = JSON.parse(await fs.readFile('web/preventa-catalogo-list.json', 'utf8'));

test('local preventa curation is a dry run and writes only review artifacts', () => {
  assert.match(curateSource, /\.codex_tmp\/preventa-curation-local/);
  assert.match(curateSource, /No Supabase upload was performed/);
  assert.match(curateSource, /--all\s+Process every preorder reference/);
  assert.match(curateSource, /--all-images\s+Process every image/);
  assert.match(curateSource, /--rows-per-sheet/);
  assert.match(curateSource, /--force\s+Regenerate existing local cutouts/);
  assert.match(curateSource, /warningContactSheets/);
  assert.doesNotMatch(curateSource, /createClient|from\(['"]preventa|storage\.from|\.upload\(|\.upsert\(|\.remove\(/);
});

test('default curation sample references still exist in the preorder catalog', () => {
  const slugs = new Set(catalog.map((item) => item.slug));
  for (const slug of [
    'barcelona-2008-2009-local',
    'ac-milan-2006-2007-local',
    'brasil-2002-local',
  ]) {
    assert.ok(slugs.has(slug), `missing sample slug ${slug}`);
    assert.match(curateSource, new RegExp(slug));
  }
});

test('background remover supports local CPU output with transparent PNG cutouts', () => {
  assert.match(removeBgSource, /model\.float\(\)/);
  assert.match(removeBgSource, /cutout\.putalpha\(mask\)/);
  assert.match(removeBgSource, /cutout\.save\(output_path, "PNG"/);
});
