/**
 * Pruebas del filtro que decide si el texto escrito por el modelo se puede
 * publicar o hay que descartarlo.
 *
 * Es la pieza que evita que una alucinacion termine en la tienda. Cuando falla,
 * el sistema usa el texto por reglas, que es mas seco pero nunca se inventa
 * nada.
 */
'use strict';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validarFicha } from './lib/ficha-producto.mjs';

const base = {
  descripcionExcel: 'Camiseta Real Madrid 2011-2012 blanca retro',
  tipo: 'RETRO',
};

const buena = {
  titulo: 'Camiseta Retro Real Madrid 2011/12 Local',
  descripcion: 'Camiseta blanca del Real Madrid con cuello tipo polo y detalles dorados en los hombros. '
    + 'Llega estampada con el dorsal de Cristiano Ronaldo #7. Versión retro de manga corta.',
};

test('una ficha bien escrita pasa', () => {
  assert.equal(validarFicha(buena, base).ok, true);
});

test('se rechaza si el titulo no empieza por Camiseta', () => {
  const r = validarFicha({ ...buena, titulo: 'Real Madrid 2011/12 Retro' }, base);
  assert.equal(r.ok, false);
  assert.match(r.problemas.join(), /empieza por/);
});

test('se rechaza si el modelo cambia la temporada', () => {
  // El caso que importa: el excel dice 2011-2012 y el modelo escribe otro año
  // porque "le parece" que la camiseta es de otra epoca.
  const r = validarFicha({ ...buena, titulo: 'Camiseta Retro Real Madrid 2013/14 Local' }, base);
  assert.equal(r.ok, false);
  assert.match(r.problemas.join(), /temporada/);
});

test('se rechaza si el titulo habla de otro equipo', () => {
  const r = validarFicha({ ...buena, titulo: 'Camiseta Retro Barcelona 2011/12 Local' }, base);
  assert.equal(r.ok, false);
  assert.match(r.problemas.join(), /otra camiseta/);
});

test('una retro tiene que decir que es retro', () => {
  const r = validarFicha({ ...buena, titulo: 'Camiseta Real Madrid 2011/12 Local' }, base);
  assert.equal(r.ok, false);
  assert.match(r.problemas.join(), /retro/);
});

test('una Player tiene que decir que es Player', () => {
  const datos = { descripcionExcel: 'KOREA 26 27 LOCAL', tipo: 'PLAYER' };
  const ficha = {
    titulo: 'Camiseta Corea del Sur 26/27 Local',
    descripcion: 'Camiseta local de la selección de Corea del Sur en rojo, con el escudo al pecho. '
      + 'Corte ajustado y tela ligera. Manga corta.',
  };
  assert.equal(validarFicha(ficha, datos).ok, false);
  assert.match(validarFicha(ficha, datos).problemas.join(), /Player/);
});

test('se rechaza una descripcion demasiado corta', () => {
  const r = validarFicha({ ...buena, descripcion: 'Camiseta blanca.' }, base);
  assert.equal(r.ok, false);
  assert.match(r.problemas.join(), /descripcion de/);
});

test('se rechaza una descripcion kilometrica', () => {
  const r = validarFicha({ ...buena, descripcion: 'a'.repeat(700) }, base);
  assert.equal(r.ok, false);
});

test('se rechaza si trae enlaces o etiquetas', () => {
  assert.equal(validarFicha({ ...buena, descripcion: buena.descripcion + ' https://otra-tienda.com' }, base).ok, false);
  assert.equal(validarFicha({ ...buena, titulo: 'Camiseta <b>Real Madrid</b> 2011/12 Retro' }, base).ok, false);
});

test('se rechaza si el texto viene con caracteres corruptos', () => {
  const r = validarFicha({ ...buena, descripcion: buena.descripcion.replace('blanca', 'bl�nca') }, base);
  assert.equal(r.ok, false);
  assert.match(r.problemas.join(), /corruptos/);
});

test('una respuesta vacia no pasa', () => {
  assert.equal(validarFicha({}, base).ok, false);
  assert.equal(validarFicha(null, base).ok, false);
});

test('las camisetas sin año en el pedido no exigen temporada', () => {
  const datos = { descripcionExcel: 'CHAPECOENSE ESPECIAL EDITION', tipo: 'FAN' };
  const ficha = {
    titulo: 'Camiseta Chapecoense Edición Especial',
    descripcion: 'Camiseta especial del Chapecoense en verde con detalles blancos y el escudo del club '
      + 'al pecho. Versión Fan de corte cómodo y tela transpirable. Manga corta.',
  };
  assert.equal(validarFicha(ficha, datos).ok, true);
});
