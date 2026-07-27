/**
 * Pruebas de cuando el sistema puede dar por hecho que una camiseta del pedido
 * ya esta en el catalogo y enlazarla sola.
 *
 * Equivocarse aqui mezcla el stock de dos camisetas distintas, asi que hacen
 * falta dos señales de acuerdo: la foto y el nombre.
 */
'use strict';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combinarCandidatos, esElMismoSeguro } from './lib/duplicados-visuales.mjs';

test('con foto muy parecida y nombre compatible, se enlaza sola', () => {
  // El caso real del PEDIDO5: "Real Madrid 1999 Visitante" contra la tercera
  // 1999/00 negra que ya estaba. Por nombre no coincidian del todo, pero
  // comparten "madrid" y "1999", y las fotos se parecen al 94%.
  const candidatos = [{ id: 42, equipo: 'Camiseta Retro Real Madrid Tercera 1999/00 Negra', score: 0.94, origen: 'foto' }];
  const r = esElMismoSeguro(candidatos, 'Camiseta Real Madrid 1999 Visitante Retro');
  assert.equal(r?.id, 42);
});

test('foto parecida pero de otro equipo NO se enlaza', () => {
  // Lo que aparecio con el PEDIDO6: la Belgica visitante daba 91% contra una
  // Real Madrid Player, solo porque las dos son una camiseta sobre fondo claro.
  const candidatos = [{ id: 63, equipo: 'Camiseta Real Madrid 26/27 Local Versión Player', score: 0.95, origen: 'foto' }];
  assert.equal(esElMismoSeguro(candidatos, 'Camiseta Belgica 26 Visitante'), null);
});

test('si hay dos candidatas casi iguales, decide una persona', () => {
  // Tipico entre la version Fan y la Player del mismo equipo y temporada.
  const candidatos = [
    { id: 60, equipo: 'Camiseta Real Madrid 26/27 Local', score: 0.95, origen: 'foto' },
    { id: 63, equipo: 'Camiseta Real Madrid 26/27 Local Versión Player', score: 0.94, origen: 'foto' },
  ];
  assert.equal(esElMismoSeguro(candidatos, 'Camiseta Real Madrid 26 27 Local'), null);
});

test('un parecido flojo no alcanza aunque el nombre calce', () => {
  const candidatos = [{ id: 60, equipo: 'Camiseta Real Madrid 26/27 Local', score: 0.88, origen: 'foto' }];
  assert.equal(esElMismoSeguro(candidatos, 'Camiseta Real Madrid 26 27 Local'), null);
});

test('un parecido solo por nombre nunca enlaza solo', () => {
  // El nombre solo no basta: por ahi entro repetida la Barcelona 26/27.
  const candidatos = [{ id: 59, equipo: 'Camiseta Barcelona 26/27 Local', score: 1, origen: 'nombre' }];
  assert.equal(esElMismoSeguro(candidatos, 'Camiseta Barcelona 26 27 Local Fan'), null);
});

test('palabras genericas compartidas no cuentan como nombre compatible', () => {
  // "camiseta", "local" y "retro" las comparten casi todas.
  const candidatos = [{ id: 30, equipo: 'Camiseta Retro AC Milan Visitante 2008/09', score: 0.95, origen: 'foto' }];
  assert.equal(esElMismoSeguro(candidatos, 'Camiseta Retro Liverpool Local'), null);
});

test('sin candidatos no pasa nada', () => {
  assert.equal(esElMismoSeguro([], 'Camiseta X'), null);
  assert.equal(esElMismoSeguro(null, 'Camiseta X'), null);
});

test('al juntar, la foto le gana al nombre para la misma camiseta', () => {
  const combinados = combinarCandidatos(
    [{ id: 59, equipo: 'Barcelona 26/27', score: 0.9 }],
    [{ id: 59, equipo: 'Barcelona 26/27', score: 0.97 }],
  );
  assert.equal(combinados.length, 1);
  assert.equal(combinados[0].origen, 'foto');
  assert.equal(combinados[0].score, 0.97);
});

test('los reconocidos por foto van primero', () => {
  const combinados = combinarCandidatos(
    [{ id: 1, equipo: 'A', score: 0.99 }],
    [{ id: 2, equipo: 'B', score: 0.88 }],
  );
  assert.equal(combinados[0].id, 2, 'la foto es mas confiable que el nombre');
});
