import test from 'node:test';
import assert from 'node:assert/strict';

import { inferPreventaMetadata } from '../scripts/import-studio/lib/preventa-row.mjs';
import { extractYupooAlbumFromHtml } from '../scripts/import-studio/lib/yupoo-album.mjs';

const sampleHtml = `
<!doctype html>
<html>
  <head>
    <title>2012-13拜仁主场 | 相册 | huiliyuan | Supplier Product Catalog</title>
    <meta property="og:image" content="https://photo.yupoo.com/huiliyuan/4955d919/medium.jpeg">
  </head>
  <body>
    <div id="infoCarry" data-username="huiliyuan" data-name="2012-13拜仁主场"></div>
    <span class="showalbumheader__gallerytitle" data-name="2012-13拜仁主场">2012-13拜仁主场</span>
    <main class="showalbum__imagecardwrap">
      <div class="showalbum__children image__main">
        <div class="image__imagewrap" data-type="photo">
          <img data-src="https://photo.yupoo.com/huiliyuan/21650978/big.jpeg"
               data-origin-src="https://photo.yupoo.com/huiliyuan/21650978/a2e7d1c1.jpeg"
               src="https://photo.yupoo.com/huiliyuan/21650978/small.jpeg">
        </div>
      </div>
      <div class="showalbum__children image__main">
        <div class="image__imagewrap" data-type="photo">
          <img data-src="https://photo.yupoo.com/huiliyuan/4955d919/big.jpeg"
               data-origin-src="https://photo.yupoo.com/huiliyuan/4955d919/7d300bb1.jpeg"
               src="https://photo.yupoo.com/huiliyuan/4955d919/small.jpeg">
        </div>
      </div>
      <img src="https://s.yupoo.com/website/icons/logo1.png">
    </main>
  </body>
</html>`;

test('extracts clean Yupoo album product images', () => {
  const album = extractYupooAlbumFromHtml(sampleHtml, 'https://huiliyuan.x.yupoo.com/albums/193589600?uid=1');

  assert.equal(album.title, '2012-13拜仁主场');
  assert.equal(album.albumId, '193589600');
  assert.equal(album.providerUsername, 'huiliyuan');
  assert.equal(album.candidates.length, 2);
  assert.equal(album.candidates[0].url, 'https://photo.yupoo.com/huiliyuan/4955d919/big.jpeg');
  assert.equal(album.candidates[0].sourceUrl, 'https://photo.yupoo.com/huiliyuan/4955d919/7d300bb1.jpeg');
  assert.ok(album.candidates.every((candidate) => candidate.provider === 'yupoo'));
});

test('infers Bayern local retro metadata from Yupoo Chinese title', () => {
  const metadata = inferPreventaMetadata({ title: '2012-13拜仁主场' });

  assert.equal(metadata.teamName, 'Bayern Munich');
  assert.equal(metadata.equipo, 'Bayern Munich');
  assert.equal(metadata.temporada, '2012-2013');
  assert.equal(metadata.variant, 'local');
  assert.equal(metadata.tipo, 'retro');
  assert.equal(metadata.categoria, 'clubes');
  assert.equal(metadata.decada, '2010s');
  assert.equal(metadata.slug, 'bayern-munich-2012-2013-local-retro');
});
