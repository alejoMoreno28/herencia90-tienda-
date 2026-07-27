/**
 * Pruebas de la proteccion contra cargar dos veces el mismo pedido.
 *
 * Es la parte que si falla hace daño de verdad: duplicar stock ensucia el
 * inventario y de ahi en adelante los margenes salen mal.
 */
'use strict';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { leerEstado, resumenEstado, sumarTallas, resumirCarga, aplicarDecisiones, referenciasConPreventa } from './lib/lote-carga.mjs';

function carpetaTemporal() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lote-test-'));
}

function escribirEstado(carpeta, id, aplicadas) {
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, `${id}.json`), JSON.stringify({ aplicadas }));
}

test('sumarTallas parte de cero y suma cada fila', () => {
  assert.deepEqual(
    sumarTallas(null, [{ talla: 'M', cantidad: 1 }, { talla: 'L', cantidad: 2 }]),
    { S: 0, M: 1, L: 2, XL: 0 },
  );
});

test('sumarTallas se apoya en lo que ya tenia el producto', () => {
  assert.deepEqual(
    sumarTallas({ S: 0, M: 0, L: 2, XL: 1 }, [{ talla: 'L', cantidad: 1 }]),
    { S: 0, M: 0, L: 3, XL: 1 },
  );
});

test('las tallas en minuscula o con espacios cuentan igual', () => {
  assert.deepEqual(
    sumarTallas(null, [{ talla: ' m ', cantidad: 1 }, { talla: 'xl', cantidad: 2 }]),
    { S: 0, M: 1, L: 0, XL: 2 },
  );
});

test('una referencia ya aplicada se reconoce aunque cambie de rama', () => {
  // Esto es lo que fallaba: la primera vez la referencia se CREA, pero en una
  // segunda corrida ya existe en el catalogo y por lo tanto le tocaria SUMAR
  // stock. Si la proteccion se guardara por tipo de operacion, la anotacion de
  // "creada" no la salvaria de que le sumaran el stock encima.
  const carpeta = carpetaTemporal();
  escribirEstado(carpeta, 'lote1', { 'barcelona 26 27': { accion: 'creada', prodId: 75 } });

  const estado = leerEstado(carpeta, 'lote1');
  assert.ok(estado.aplicadas['barcelona 26 27'], 'debe encontrarse por la clave de la referencia');
  assert.equal(estado.aplicadas['barcelona 26 27'].accion, 'creada');

  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('un lote sin historia arranca vacio', () => {
  const carpeta = carpetaTemporal();
  assert.deepEqual(leerEstado(carpeta, 'nuevo'), { aplicadas: {} });
  assert.deepEqual(resumenEstado(carpeta, 'nuevo'), { total: 0, creadas: 0, sumadas: 0 });
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('el resumen del estado cuenta creadas y sumadas por separado', () => {
  const carpeta = carpetaTemporal();
  escribirEstado(carpeta, 'l', {
    a: { accion: 'creada', prodId: 1 },
    b: { accion: 'creada', prodId: 2 },
    c: { accion: 'sumada', prodId: 3 },
  });
  assert.deepEqual(resumenEstado(carpeta, 'l'), { total: 3, creadas: 2, sumadas: 1 });
  fs.rmSync(carpeta, { recursive: true, force: true });
});

test('las filas de PREVENTA se detectan para no cargarlas por aqui', () => {
  const refs = [
    { titulo: 'A', filas: [{ talla: 'M', cantidad: 1, destino: 'STOCK' }] },
    { titulo: 'B', filas: [{ talla: 'L', cantidad: 1, destino: 'PREVENTA' }] },
  ];
  assert.deepEqual(referenciasConPreventa(refs).map((r) => r.titulo), ['B']);
});

test('una decision manda la referencia a un producto que ya existe', () => {
  const refs = [{ clave: 'rm 26 27', titulo: 'RM', prodIdExistente: null, filas: [], ranking: [] }];
  const salida = aplicarDecisiones(refs, { 'rm 26 27': { prodId: 60 } });
  assert.equal(salida[0].prodIdExistente, 60);
  assert.equal(refs[0].prodIdExistente, null, 'no debe modificar el original');
});

test('una decision puede forzar que sea nueva', () => {
  const refs = [{ clave: 'x', titulo: 'X', prodIdExistente: 42, filas: [], ranking: [] }];
  assert.equal(aplicarDecisiones(refs, { x: { prodId: null } })[0].prodIdExistente, null);
});

test('elegir otro album lo deja de primero, que es de donde salen las fotos', () => {
  const refs = [{ clave: 'x', titulo: 'X', filas: [], ranking: [{ title: 'a' }, { title: 'b' }, { title: 'c' }] }];
  const salida = aplicarDecisiones(refs, { x: { albumIndex: 2 } });
  assert.deepEqual(salida[0].ranking.map((r) => r.title), ['c', 'a', 'b']);
});

test('el resumen separa lo que se crea de lo que suma stock', () => {
  const refs = [
    { clave: 'a', titulo: 'A', prodIdExistente: null, filas: [{ talla: 'M', cantidad: 2 }] },
    { clave: 'b', titulo: 'B', prodIdExistente: 60, filas: [{ talla: 'L', cantidad: 3 }] },
  ];
  const r = resumirCarga(refs);
  assert.equal(r.nuevos, 1);
  assert.equal(r.existentes, 1);
  assert.equal(r.unidades, 5);
});
