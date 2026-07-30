/**
 * Las fotos que se sacan del album del proveedor.
 *
 * El proveedor no usa la misma extension en todos los albumes. Cuando el
 * filtro solo aceptaba .jpeg, un album servido en .jpg perdia TODAS sus fotos
 * grandes y la ficha se publicaba con una sola: paso con la Liverpool 95/96
 * visitante, que tiene 9.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fotosDelHtmlDeAlbum } from '../lib/yupoo-search.mjs';

const img = (url) => `<img data-origin-src="${url}">`;
const album = (ext) => [1, 2, 3]
  .map((n) => img(`//photo.yupoo.com/tienda/abc${n}/big.${ext}`) + img(`//photo.yupoo.com/tienda/abc${n}/small.${ext}`))
  .join('');

test('un album servido en .jpeg trae sus fotos grandes', () => {
  assert.equal(fotosDelHtmlDeAlbum(album('jpeg')).length, 3);
});

test('un album servido en .jpg trae las suyas igual', () => {
  assert.equal(fotosDelHtmlDeAlbum(album('jpg')).length, 3);
});

test('sin fotos grandes se cae a las medianas', () => {
  const html = img('//photo.yupoo.com/tienda/abc1/medium.jpg') + img('//photo.yupoo.com/tienda/abc2/medium.jpg');
  assert.equal(fotosDelHtmlDeAlbum(html).length, 2);
});

test('las pequeñas no cuentan como foto del album', () => {
  const html = img('//photo.yupoo.com/tienda/abc1/small.jpg') + img('//photo.yupoo.com/tienda/abc2/square.jpg');
  assert.deepEqual(fotosDelHtmlDeAlbum(html), []);
});

test('no repite la misma foto anclada varias veces', () => {
  const una = '//photo.yupoo.com/tienda/abc1/big.jpg';
  assert.equal(fotosDelHtmlDeAlbum(img(una) + img(una) + img(`${una}?x=1`)).length, 1);
});

test('respeta el tope que se le pida', () => {
  assert.equal(fotosDelHtmlDeAlbum(album('jpg'), 2).length, 2);
});
