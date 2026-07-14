import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'docs/PLAN_COMERCIAL_90_DIAS.md',
  'docs/COMPETENCIA_COLOMBIA_2026-07-13.md',
  'docs/GUIA_FOTOS_PRODUCTO.md',
  'docs/CONTENIDO_30_DIAS.csv',
  'docs/PILOTO_INVENTARIO.csv',
  'docs/PRECIOS_MARGENES.csv'
];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function parseSemicolonCsv(path) {
  const lines = read(path).trim().split(/\r?\n/);
  const headers = lines.shift().split(';');
  return lines.map((line) => Object.fromEntries(line.split(';').map((value, index) => [headers[index], value])));
}

test('the operating kit contains every approved commercial deliverable', () => {
  for (const path of requiredFiles) {
    assert.equal(existsSync(resolve(root, path)), true, `${path} debe existir`);
  }

  const plan = read('docs/PLAN_COMERCIAL_90_DIAS.md');
  assert.match(plan, /No migrar a Shopify durante este ciclo de 90 días/i);
  assert.match(plan, /SEO no es publicidad pagada/i);
  assert.match(plan, /WOMPI_ENABLED=false/);
  assert.match(plan, /Needs confirmation: identidad legal, NIT y dirección/i);
  assert.match(plan, /WhatsApp como soporte/i);
});

test('the inventory pilot commits 30 units and keeps a 20-unit winner reserve', () => {
  const rows = parseSemicolonCsv('docs/PILOTO_INVENTARIO.csv');
  assert.equal(rows.length, 11);

  const total = (key) => rows.reduce((sum, row) => sum + Number(row[key]), 0);
  assert.equal(total('unidades_iniciales'), 30);
  assert.equal(total('reserva_si_gana'), 20);

  const unisex = rows.filter((row) => row.corte === 'unisex');
  const women = rows.filter((row) => row.corte === 'mujer');
  assert.deepEqual(
    Object.fromEntries(['S', 'M', 'L', 'XL'].map((size) => [size, unisex.reduce((sum, row) => sum + Number(row[size]), 0)])),
    { S: 3, M: 10, L: 9, XL: 4 }
  );
  assert.deepEqual(
    Object.fromEntries(['S', 'M', 'L', 'XL'].map((size) => [size, women.reduce((sum, row) => sum + Number(row[size]), 0)])),
    { S: 2, M: 1, L: 1, XL: 0 }
  );
  assert.ok(rows.some((row) => row.referencia.includes('Colombia Local 2026')));
  assert.ok(rows.some((row) => row.estado === 'muestra_por_aprobar'));
});

test('the 30-day calendar has two executable posts per day and the brand pillar mix', () => {
  const rows = parseSemicolonCsv('docs/CONTENIDO_30_DIAS.csv');
  assert.equal(rows.length, 60);

  const counts = {};
  for (const row of rows) {
    counts[row.pilar] = (counts[row.pilar] || 0) + 1;
    for (const field of ['plataforma', 'formato', 'producto', 'hook', 'desarrollo', 'cta', 'toma']) {
      assert.ok(row[field]?.trim(), `día ${row.dia} requiere ${field}`);
    }
  }
  assert.deepEqual(counts, { deseo_producto: 24, nostalgia: 15, confianza_proceso: 12, interaccion: 6, venta_directa: 3 });

  for (let day = 1; day <= 30; day += 1) {
    const slots = rows.filter((row) => Number(row.dia) === day).map((row) => row.hora).sort();
    assert.deepEqual(slots, ['15:00', '20:00'], `día ${day} debe tener dos horarios`);
  }
});

test('the price guardrails are contribution-based and never fabricate landed cost', () => {
  const rows = parseSemicolonCsv('docs/PRECIOS_MARGENES.csv');
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.match(row.estado_costo, /Needs confirmation/i);
    assert.ok(Number(row.precio_referencia_cop) > 0);
    assert.ok(Number(row.contribucion_objetivo_pct) >= 35);
    assert.match(row.formula_piso, /costo_puesto_en_medellin/);
  }
});

test('public copy does not present unverified products or patches as official', () => {
  const catalog = read('web/productos.json');
  const home = read('web/index.html');
  assert.doesNotMatch(catalog, /camiseta oficial de/i);
  assert.doesNotMatch(home, /parches oficiales/i);
});
