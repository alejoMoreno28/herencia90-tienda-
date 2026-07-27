/**
 * Pruebas del emparejamiento entre las fotos pegadas en el excel y su
 * referencia.
 *
 * Importa porque de ahi sale la foto que decide cual camiseta se baja del
 * proveedor. Si una referencia se queda sin foto, esa eleccion pasa a ser
 * manual; si se empareja con la foto equivocada, se bajan las fotos de otra
 * camiseta.
 */
'use strict';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { asociarFotosAFilas } from './lib/excel-photos.mjs';

const foto = (hash, ...rows) => ({ hash, buffer: Buffer.from(hash), ext: 'jpeg', rows });

test('una foto por referencia se empareja en orden', () => {
  const claves = ['mexico', 'real madrid', 'belgica'];
  const mapa = asociarFotosAFilas([foto('a', 2), foto('b', 3), foto('c', 5)], claves);
  assert.equal(mapa.size, 3);
  assert.equal(mapa.get('mexico').hash, 'a');
  assert.equal(mapa.get('real madrid').hash, 'b');
  assert.equal(mapa.get('belgica').hash, 'c');
});

test('no se pierde ninguna aunque las anclas se amontonen', () => {
  // El caso del PEDIDO6: seis fotos ancladas en las filas 2,3,3,5,6,7. Con el
  // metodo de votacion dos caian en la misma referencia y dos se quedaban sin
  // foto.
  const claves = ['a', 'b', 'c', 'd', 'e', 'f'];
  const fotos = [foto('1', 2), foto('2', 3), foto('3', 3), foto('4', 5), foto('5', 6), foto('6', 7)];
  const mapa = asociarFotosAFilas(fotos, claves);
  assert.equal(mapa.size, 6, 'las seis referencias deben quedar con foto');
  assert.equal(mapa.get('a').hash, '1');
  assert.equal(mapa.get('f').hash, '6');
});

test('la misma foto repetida por talla cuenta una sola vez', () => {
  // En un pedido normal la misma imagen esta anclada una vez por cada talla.
  const claves = ['barcelona', 'barcelona', 'barcelona', 'arsenal'];
  const mapa = asociarFotosAFilas([foto('barca', 2, 3, 4), foto('gunners', 5)], claves);
  assert.equal(mapa.size, 2);
  assert.equal(mapa.get('barcelona').hash, 'barca');
  assert.equal(mapa.get('arsenal').hash, 'gunners');
});

test('si faltan fotos, las que hay no se pisan entre si', () => {
  const claves = ['a', 'b', 'c'];
  const mapa = asociarFotosAFilas([foto('x', 2), foto('y', 2)], claves);
  assert.equal(mapa.size, 2, 'dos fotos no pueden caer en la misma referencia');
});

test('un excel sin fotos no rompe nada', () => {
  assert.equal(asociarFotosAFilas([], ['a', 'b']).size, 0);
});
