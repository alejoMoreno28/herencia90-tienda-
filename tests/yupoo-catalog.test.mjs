import test from 'node:test';
import assert from 'node:assert/strict';

import { buildYupooPageUrl, parseYupooAlbumList } from '../scripts/lib/yupoo-catalog.mjs';

test('parseYupooAlbumList extracts album titles and urls from a root catalog page', () => {
  const html = `
    <a href="/albums/123?uid=1"> 9 2006-07皇马主场 </a>
    <a href="/albums/456?uid=1"> 10 2008-09巴塞主场 </a>
    <a href="/contact"> Contact </a>
  `;

  const items = parseYupooAlbumList(html, 'https://huiliyuan.x.yupoo.com/albums/?page=1');

  assert.deepEqual(items, [
    { title: '9 2006-07皇马主场', url: 'https://huiliyuan.x.yupoo.com/albums/123?uid=1' },
    { title: '10 2008-09巴塞主场', url: 'https://huiliyuan.x.yupoo.com/albums/456?uid=1' },
  ]);
});

test('buildYupooPageUrl creates paginated album URLs from a root profile url', () => {
  assert.equal(
    buildYupooPageUrl('https://huiliyuan.x.yupoo.com/', 3),
    'https://huiliyuan.x.yupoo.com/albums/?page=3'
  );
});
