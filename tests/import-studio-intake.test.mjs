import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeImportRow, parseCsvRows, slugifyReference } from '../scripts/import-studio/lib/intake.mjs';

test('normalizes a supplier import row', () => {
  const row = normalizeImportRow({
    url: 'https://supplier.example/item',
    equipo: 'Inter de Milan',
    temporada: '1997/1998',
    tipo: 'Local Retro',
    precio: '120000',
    colores: 'azul, negro',
    notas: 'Umbro, Pirelli',
  });

  assert.equal(row.providerUrl, 'https://supplier.example/item');
  assert.equal(row.teamName, 'Inter de Milan');
  assert.equal(row.seasonLabel, '1997/1998');
  assert.equal(row.shirtType, 'local');
  assert.equal(row.categoryPrimary, 'retro');
  assert.equal(row.price, 120000);
  assert.deepEqual(row.expectedColors, ['azul', 'negro']);
  assert.equal(row.notes, 'Umbro, Pirelli');
  assert.equal(row.slug, 'inter-de-milan-1997-1998-local-retro');
});

test('parses quoted CSV rows for batch intake', () => {
  const rows = parseCsvRows('url,equipo,temporada,tipo,precio,colores\n"https://x.test/p,1","Real Madrid","2011/2012","Local Manga Larga","150.000","blanco, dorado"\n');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].url, 'https://x.test/p,1');
  assert.equal(rows[0].equipo, 'Real Madrid');
  assert.equal(rows[0].precio, '150.000');
});

test('slugifies references with ASCII output', () => {
  assert.equal(slugifyReference('Selección Colombia 2024 Local Niño'), 'seleccion-colombia-2024-local-nino');
});
