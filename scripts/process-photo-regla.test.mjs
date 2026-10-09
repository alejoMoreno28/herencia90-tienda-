/**
 * La regla que decide que fotos del album se publican.
 *
 * Valores reales medidos con scripts/medir-recortes.mjs. Si alguien cambia los
 * umbrales, estas pruebas dicen si vuelve a pasar lo del PEDIDO 6 de octubre
 * (camisetas acostadas publicadas con el fondo gris) o lo de la Barcelona
 * 08/09 (el escudo suelto publicado como si fuera la camiseta).
 */
'use strict';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { esCamisetaEntera } from '../api/process-photo.mjs';

const foto = (proporcion, bordeOpaco, ancho) => ({ recortada: true, proporcion, bordeOpaco, ancho });

test('camiseta acostada en los albumes Fan: se publica sin fondo', () => {
  assert.ok(esCamisetaEntera(foto(0.331, 0, 0.84)));  // Barcelona 26/27 visitante, espalda
  assert.ok(esCamisetaEntera(foto(0.319, 0, 0.89)));  // Real Madrid 26/27 visitante
  assert.ok(esCamisetaEntera(foto(0.357, 0, 0.89)));  // Ghana 2026 visitante
});

test('camiseta colgada: se publica sin fondo', () => {
  assert.ok(esCamisetaEntera(foto(0.55, 0.001, 0.93)));   // Barcelona 08/09
  assert.ok(esCamisetaEntera(foto(0.519, 0.001, 0.93)));  // River 26/27
});

test('escudo suelto: no se publica', () => {
  assert.equal(esCamisetaEntera(foto(0.237, 0, 0.65)), false);  // Barcelona 08/09
  assert.equal(esCamisetaEntera(foto(0.275, 0, 0.63)), false);  // River 26/27
  assert.equal(esCamisetaEntera(foto(0.205, 0, 0.58)), false);  // Barcelona 26/27
});

test('acercamiento o maniqui que toca el borde: no se publica', () => {
  assert.equal(esCamisetaEntera(foto(0.541, 0.401, 1.0)), false);  // cuello Barcelona 08/09
  assert.equal(esCamisetaEntera(foto(0.546, 0.146, 0.87)), false); // River en maniqui
});

test('si el servicio no pudo recortar, no se publica', () => {
  assert.equal(esCamisetaEntera({ ...foto(0.6, 0, 0.9), recortada: false }), false);
});
