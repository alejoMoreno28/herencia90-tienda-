import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';

import { parseOrderRows, readOrderRows } from '../scripts/lib/order-workbook-reader.mjs';

test('reads the preferred order sheet with the same zero-based row arrays used by order scripts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'herencia90-order-'));
  const file = path.join(directory, 'pedido.xlsx');

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Notas').addRow(['ignorar']);
    const order = workbook.addWorksheet('ORDER');
    order.addRow(['Image', 'Size', 'TYPE', 'Comment', 'Quantity']);
    order.addRow(['foto.jpg', 'M', 'FAN', '10', 2]);
    order.addRow(['foto-2.jpg', 'L', { formula: '1+1', result: 'RETRO' }, { richText: [{ text: 'Sin ' }, { text: 'nombre' }] }, 1]);
    await workbook.xlsx.writeFile(file);

    const result = await readOrderRows(file, ['Pedido 2', 'ORDER']);

    assert.equal(result.sheetName, 'ORDER');
    assert.deepEqual(result.rows, [
      ['Image', 'Size', 'TYPE', 'Comment', 'Quantity'],
      ['foto.jpg', 'M', 'FAN', '10', 2],
      ['foto-2.jpg', 'L', 'RETRO', 'Sin nombre', 1]
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('parses quantities from legacy and generated ORDER column layouts', () => {
  const legacy = parseOrderRows([
    ['Picture (FOTO)', 'Size', 'Version', 'Comment (Detalles)', 'Quantity'],
    ['foto.jpg', 'M', 'RETRO', 'Brasil 2004', 2]
  ]);
  const generated = parseOrderRows([
    ['HERENCIA 90 ORDER'],
    ['PHOTO', 'SIZE', 'TYPE', 'DESCRIPTION', 'EXTRAS', 'EXTRAS COST (USD)', 'QTY'],
    [undefined, 'L', 'PLAYER', 'Colombia 2026', 'Dorsal / Personalization', 3, 4]
  ]);

  assert.deepEqual(legacy, [{ size: 'M', version: 'RETRO', comment: 'Brasil 2004', qty: 2 }]);
  assert.deepEqual(generated, [{
    size: 'L',
    version: 'PLAYER',
    comment: 'Colombia 2026 | Dorsal / Personalization',
    qty: 4
  }]);
});

test('reads an operational historical HERENCIA90 order workbook when supplied', {
  skip: !process.env.H90_LEGACY_ORDER_FILE
}, async () => {
  const result = await readOrderRows(process.env.H90_LEGACY_ORDER_FILE, ['Pedido 2', 'ORDER']);

  assert.ok(['Pedido 2', 'ORDER'].includes(result.sheetName));
  assert.ok(result.rows.length >= 8);
  const parsed = parseOrderRows(result.rows);
  assert.ok(parsed.length > 0);
  assert.ok(parsed.every((row) => row.version && row.qty >= 1));

  const headerIndex = result.rows.findIndex((row) => row?.some((value) => /^(?:QTY|QUANTITY)$/i.test(String(value || '').trim())));
  assert.ok(headerIndex >= 0);
  const quantityIndex = result.rows[headerIndex].findIndex((value) => /^(?:QTY|QUANTITY)$/i.test(String(value || '').trim()));
  const sourceTotal = result.rows.slice(headerIndex + 1).reduce((sum, row) => sum + (Number(row?.[quantityIndex]) || 0), 0);
  const parsedTotal = parsed.reduce((sum, row) => sum + row.qty, 0);
  assert.equal(parsedTotal, sourceTotal);
});
