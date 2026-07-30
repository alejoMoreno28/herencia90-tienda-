/**
 * Pruebas de como se interpreta la temporada que viene escrita en el pedido.
 *
 * De aqui sale el filtro que descarta camisetas de otros años. Si el patron no
 * cubre la forma en que el proveedor titula sus albumes, el filtro no encuentra
 * nada, se cae hacia atras y salen mezcladas todas las temporadas del equipo.
 */
'use strict';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractSeasonPattern } from './lib/team-translator.mjs';
import { esDeTemporadaVieja } from './lib/yupoo-search.mjs';

const cubre = (descripcion, tituloAlbum, isClub = true) => {
  const patron = extractSeasonPattern(descripcion, isClub);
  return patron ? new RegExp(patron, 'i').test(tituloAlbum) : false;
};

test('reconoce el formato del proveedor: año completo y cierre en dos digitos', () => {
  // El proveedor titula "1995-96利物浦客场". Ese formato faltaba, y por eso la
  // Liverpool 95/96 traia candidatas de 25-26 y 26-27.
  assert.ok(cubre('Camiseta Retro Liverpool 1995/96', '1995-96利物浦客场'));
  assert.ok(cubre('Camiseta Liverpool 1995-1996', '1995-96利物浦客场'));
});

test('el cambio de siglo no retrocede cien años', () => {
  // "1999/00" es 1999-2000. Se leia como 1999-1900.
  const patron = extractSeasonPattern('Real Madrid Tercera 1999/00', true);
  assert.ok(patron.includes('1999-2000'), `deberia contener 1999-2000: ${patron}`);
  assert.ok(!patron.includes('1900'), `no deberia contener 1900: ${patron}`);
  assert.ok(cubre('Real Madrid Tercera 1999/00', '1999-00皇马客场'));
});

test('no deja pasar otras temporadas', () => {
  assert.ok(!cubre('Camiseta Retro Liverpool 1995/96', '25-26利物浦主场'));
  assert.ok(!cubre('Camiseta Retro Liverpool 1995/96', '2005-06利物浦主场'));
});

test('acepta las formas largas y cortas de la misma temporada', () => {
  ['2008-2009', '2008/2009', '2008-09', '2008/09', '08-09', '08/09'].forEach((forma) => {
    assert.ok(cubre('Barcelona 2008-2009', `${forma}巴萨主场`), `deberia cubrir ${forma}`);
  });
});

test('la temporada escrita con espacio, como en el excel', () => {
  assert.ok(cubre('BARCELONA 26 27 LOCAL', '26-27巴塞主场'));
  assert.ok(cubre('BARCELONA 26 27 LOCAL', '2026-2027巴塞主场'));
  assert.ok(!cubre('BARCELONA 26 27 LOCAL', '25-26巴塞主场'));
});

test('un año suelto de seleccion busca ese año', () => {
  assert.ok(cubre('Brasil 1998 amarilla', '1998巴西主场', false));
  assert.ok(!cubre('Brasil 1998 amarilla', '2006巴西主场', false));
});

test('un año suelto de club abre la temporada hacia los dos lados', () => {
  // El excel pone "2006" y el proveedor puede titular 2006-07 o 2005-06.
  assert.ok(cubre('AC Milan 2006 visitante', '2006-07AC客场'));
  assert.ok(cubre('AC Milan 2006 visitante', '05-06AC客场'));
});

test('sin año no hay patron', () => {
  assert.equal(extractSeasonPattern('Camiseta especial sin año', true), null);
});

// Un año suelto de dos cifras, como lo escribe uno al buscar a mano.
//
// "Barcelona retro 08" se buscaba entre las camisetas de la temporada actual
// porque el 08 no se leia como 2008, y ahi no existe nada de ese año.

test('un año suelto de dos cifras con la palabra retro es una temporada vieja', () => {
  assert.equal(esDeTemporadaVieja('Barcelona retro 08', 2026), true);
  assert.equal(esDeTemporadaVieja('Camiseta Retro Real Madrid 99', 2026), true);
});

test('sin la palabra retro, un numero de dos cifras es un dorsal y no un año', () => {
  assert.equal(esDeTemporadaVieja('messi 10', 2026), false);
  assert.equal(esDeTemporadaVieja('camiseta 7 mbappe', 2026), false);
});

test('una retro de la temporada actual no se manda a los albumes viejos', () => {
  assert.equal(esDeTemporadaVieja('camiseta retro barcelona 26', 2026), false);
});
