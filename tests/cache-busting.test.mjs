import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('asset versions are content-derived and idempotent', async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'herencia90-assets-'));

  try {
    const webDir = path.join(fixtureRoot, 'web');
    await mkdir(path.join(webDir, 'css'), { recursive: true });
    await mkdir(path.join(webDir, 'js'), { recursive: true });
    await writeFile(path.join(webDir, 'css', 'site.css'), 'body { color: #111; }\n');
    await writeFile(path.join(webDir, 'data.json'), '{"ok":true}\n');
    await writeFile(
      path.join(webDir, 'js', 'app.js'),
      "fetch('/data.json?v=stale').then((response) => response.json());\n"
    );
    await writeFile(
      path.join(webDir, 'index.html'),
      '<link rel="stylesheet" href="/css/site.css?v=old"><script src="/js/app.js?v=old"></script><link rel="preload" href="/data.json?v=old" as="fetch">\n'
    );
    await writeFile(path.join(fixtureRoot, 'vercel.json'), '{"headers":[{"source":"kept"}]}\n');

    const versioner = require('../scripts/lib/asset-versioning.js');
    const first = await versioner.versionRepository(fixtureRoot);
    const htmlAfterFirst = await readFile(path.join(webDir, 'index.html'), 'utf8');
    const jsAfterFirst = await readFile(path.join(webDir, 'js', 'app.js'), 'utf8');
    const vercelAfterFirst = await readFile(path.join(fixtureRoot, 'vercel.json'), 'utf8');

    assert.match(htmlAfterFirst, /site\.css\?v=[a-f0-9]{12}/);
    assert.match(htmlAfterFirst, /app\.js\?v=[a-f0-9]{12}/);
    assert.match(htmlAfterFirst, /data\.json\?v=[a-f0-9]{12}/);
    assert.match(jsAfterFirst, /data\.json\?v=[a-f0-9]{12}/);
    assert.deepEqual(vercelAfterFirst, '{"headers":[{"source":"kept"}]}\n');
    assert.ok(first.changedFiles.length >= 2);

    const second = await versioner.versionRepository(fixtureRoot);
    assert.deepEqual(second.changedFiles, []);

    await writeFile(path.join(webDir, 'css', 'site.css'), 'body { color: #222; }\n');
    const third = await versioner.versionRepository(fixtureRoot);
    const htmlAfterThird = await readFile(path.join(webDir, 'index.html'), 'utf8');

    assert.notEqual(htmlAfterThird, htmlAfterFirst);
    assert.deepEqual(third.changedFiles, [path.join(webDir, 'index.html')]);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('production routing exposes the first-party bio page', async () => {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const vercel = JSON.parse(await readFile(path.join(repoRoot, 'vercel.json'), 'utf8'));
  const sitemap = await readFile(path.join(repoRoot, 'web', 'sitemap.xml'), 'utf8');

  assert.ok(
    vercel.rewrites.some((entry) => entry.source === '/bio' && entry.destination === '/bio.html'),
    'Expected /bio to rewrite to /bio.html'
  );
  assert.ok(
    vercel.headers.some((entry) => entry.source === '/bio'),
    'Expected an explicit cache policy for /bio'
  );
  assert.match(sitemap, /<loc>https:\/\/www\.herencia90\.shop\/bio<\/loc>/);
});
