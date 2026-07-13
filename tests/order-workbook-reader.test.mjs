import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import ExcelJS from 'exceljs';

import { readOrderRows } from '../scripts/lib/order-workbook-reader.mjs';

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
