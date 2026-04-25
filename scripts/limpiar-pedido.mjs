/**
 * limpiar-pedido.mjs
 * Reconstruye el Excel de pedido con:
 *  - Formato de precios correcto ($15, no $015)
 *  - Hoja de Configuración clara con datos del proveedor fáciles de cambiar
 *  - Hoja de pedido limpia (sin hojas innecesarias)
 *  - Encabezados en inglés para el proveedor chino
 *
 * Uso: node scripts/limpiar-pedido.mjs
 */

import ExcelJS from 'exceljs';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ─── colores / estilos ────────────────────────────────────────────────────────
const COLOR = {
  headerBg:    '1F3864',   // azul oscuro
  headerFg:    'FFFFFF',
  providerBg:  '2E75B6',   // azul medio (bloque proveedor)
  providerFg:  'FFFFFF',
  priceBg:     'D9E1F2',   // azul claro (tabla precios)
  altRow:      'F2F7FF',
  totalBg:     'FFF2CC',   // amarillo (total)
  border:      '8EAADB',
};

function hCell(bold = true, bg = null, fg = '000000', size = 10) {
  const style = {
    font: { bold, color: { argb: 'FF' + fg }, size, name: 'Calibri' },
    alignment: { vertical: 'middle', wrapText: true },
    border: {
      top:    { style: 'thin', color: { argb: 'FF' + COLOR.border } },
      left:   { style: 'thin', color: { argb: 'FF' + COLOR.border } },
      bottom: { style: 'thin', color: { argb: 'FF' + COLOR.border } },
      right:  { style: 'thin', color: { argb: 'FF' + COLOR.border } },
    },
  };
  if (bg) style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
  return style;
}

// ─── hoja PROVIDER CONFIG ─────────────────────────────────────────────────────
function buildConfigSheet(wb, providerData, prices) {
  const ws = wb.addWorksheet('CONFIG', { properties: { tabColor: { argb: 'FF2E75B6' } } });

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 6;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 16;

  // ── Título ──
  ws.mergeCells('A1:B1');
  const title = ws.getCell('A1');
  title.value = '⚽ HERENCIA 90 — ORDER CONFIGURATION';
  title.style = { ...hCell(true, COLOR.headerBg, COLOR.headerFg, 13), alignment: { horizontal: 'center', vertical: 'middle' } };
  ws.getRow(1).height = 28;

  ws.addRow([]);

  // ── Proveedor activo ──
  const provRow = ws.addRow(['ACTIVE PROVIDER', providerData.name]);
  provRow.height = 22;
  provRow.getCell(1).style = hCell(true, COLOR.providerBg, COLOR.providerFg);
  provRow.getCell(2).style = { ...hCell(true, 'EBF3FB', '1F3864', 11), alignment: { vertical: 'middle' } };

  const fields = [
    ['WhatsApp / Contact', providerData.contact],
    ['Catalog URL',        providerData.catalog],
    ['Notes',             providerData.notes],
  ];
  for (const [label, val] of fields) {
    const r = ws.addRow([label, val]);
    r.height = 18;
    r.getCell(1).style = hCell(true, 'D9E1F2', '1F3864');
    r.getCell(2).style = hCell(false, 'FFFFFF', '000000');
  }

  ws.addRow([]);

  // ── Otros proveedores ──
  const h2 = ws.addRow(['OTHER PROVIDERS', '', '', 'Edit this list to add / switch providers']);
  h2.height = 20;
  h2.getCell(1).style = hCell(true, COLOR.headerBg, COLOR.headerFg);
  h2.getCell(2).style = hCell(false, COLOR.headerBg, '888888');
  ws.mergeCells(`D${h2.number}:E${h2.number}`);
  h2.getCell(4).style = { font: { italic: true, color: { argb: 'FFAAAAAA' }, size: 9 } };

  const otherHeaders = ws.addRow(['Name', 'WhatsApp / Contact', '', 'Catalog URL', 'Notes']);
  otherHeaders.height = 18;
  [1,2,4,5].forEach(c => { otherHeaders.getCell(c).style = hCell(true, 'BDD7EE', '1F3864'); });

  for (const p of providerData.others) {
    const r = ws.addRow([p.name, p.contact, '', p.catalog, p.notes]);
    r.height = 18;
    [1,2,4,5].forEach(c => { r.getCell(c).style = hCell(false, 'FFFFFF', '000000'); });
  }

  ws.addRow([]);

  // ── Precios ──
  const ph = ws.addRow(['JERSEY TYPES & BASE PRICES (USD)', '', '', 'Shipping rules', '']);
  ph.height = 20;
  ph.getCell(1).style = hCell(true, COLOR.headerBg, COLOR.headerFg);
  ph.getCell(4).style = hCell(true, COLOR.headerBg, COLOR.headerFg);
  ws.mergeCells(`A${ph.number}:B${ph.number}`);
  ws.mergeCells(`D${ph.number}:E${ph.number}`);

  const priceH = ws.addRow(['Type / Version', 'Price (USD)', '', 'Rule', 'Cost (USD)']);
  priceH.height = 18;
  [1,2].forEach(c => priceH.getCell(c).style = hCell(true, 'BDD7EE', '1F3864'));
  [4,5].forEach(c => priceH.getCell(c).style = hCell(true, 'BDD7EE', '1F3864'));

  const shipping = [
    ['1-4 units', 8],
    ['5+ units',  0],
  ];

  prices.forEach((p, i) => {
    const r = ws.addRow([p.type, p.price, '', shipping[i]?.[0] || '', shipping[i]?.[1] ?? '']);
    r.height = 17;
    r.getCell(1).style = hCell(false, i % 2 === 0 ? 'FFFFFF' : COLOR.altRow, '1F3864');
    r.getCell(2).style = { ...hCell(false, i % 2 === 0 ? 'FFFFFF' : COLOR.altRow), numFmt: '"$"#,##0' };
    if (shipping[i]) {
      r.getCell(4).style = hCell(false, i % 2 === 0 ? 'FFFFFF' : COLOR.altRow);
      r.getCell(5).style = { ...hCell(false, i % 2 === 0 ? 'FFFFFF' : COLOR.altRow), numFmt: '"$"#,##0' };
    }
  });

  ws.addRow([]);
  const noteR = ws.addRow(['💡 To change prices: edit column B above. The ORDER sheet recalculates automatically.']);
  noteR.getCell(1).style = { font: { italic: true, color: { argb: 'FF666666' }, size: 9 } };
  ws.mergeCells(`A${noteR.number}:E${noteR.number}`);

  return ws;
}

// ─── hoja ORDER ───────────────────────────────────────────────────────────────
function buildOrderSheet(wb, rows, providerName, configSheetName) {
  const ws = wb.addWorksheet('ORDER', { properties: { tabColor: { argb: 'FF1F3864' } } });

  // Anchos de columna
  ws.getColumn(1).width = 14;   // PHOTO
  ws.getColumn(2).width = 8;    // SIZE
  ws.getColumn(3).width = 16;   // TYPE
  ws.getColumn(4).width = 32;   // DESCRIPTION
  ws.getColumn(5).width = 8;    // QTY
  ws.getColumn(6).width = 16;   // UNIT PRICE
  ws.getColumn(7).width = 14;   // SUBTOTAL
  ws.getColumn(8).width = 16;   // RUNNING TOTAL
  ws.getColumn(9).width = 4;    // spacer
  ws.getColumn(10).width = 22;  // SUMMARY label
  ws.getColumn(11).width = 20;  // SUMMARY value

  // ── Encabezado de pedido ──
  ws.mergeCells('A1:H1');
  const title = ws.getCell('A1');
  title.value = `HERENCIA 90 — ORDER   |   Provider: ${providerName}`;
  title.style = { ...hCell(true, COLOR.headerBg, COLOR.headerFg, 13), alignment: { horizontal: 'center', vertical: 'middle' } };
  ws.getRow(1).height = 26;

  // ── Encabezados de columna ──
  const headers = ['PHOTO', 'SIZE', 'TYPE', 'DESCRIPTION', 'QTY', 'UNIT PRICE (USD)', 'SUBTOTAL (USD)', 'RUNNING TOTAL (USD)'];
  const hRow = ws.getRow(2);
  hRow.height = 22;
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.style = { ...hCell(true, COLOR.providerBg, COLOR.providerFg), alignment: { horizontal: 'center', vertical: 'middle' } };
  });

  // ── Encabezados resumen (col J-K) ──
  ws.mergeCells('J1:K1');
  const sumTitle = ws.getCell('J1');
  sumTitle.value = 'ORDER SUMMARY';
  sumTitle.style = { ...hCell(true, COLOR.headerBg, COLOR.headerFg, 11), alignment: { horizontal: 'center', vertical: 'middle' } };

  const summaryRows = [
    { label: 'Provider',       formula: null, value: providerName },
    { label: 'Total units',    formula: `=COUNTA(E3:E302)`, value: null },
    { label: 'Subtotal (USD)', formula: `=IFERROR(SUM(G3:G302),"")`, value: null, fmt: '"$"#,##0.00' },
    { label: 'Shipping (USD)', formula: `=IFERROR(IF(COUNTA(E3:E302)>=5,0,${configSheetName}!B16*1),"")`, value: null, fmt: '"$"#,##0.00' },
    { label: 'TOTAL (USD)',    formula: `=IFERROR(J4+J5,"")`, value: null, fmt: '"$"#,##0.00', bold: true, bg: COLOR.totalBg },
    { label: 'Shipping rule',  formula: null, value: '1-4 units: $8  |  5+: FREE' },
  ];

  summaryRows.forEach((s, i) => {
    const r = ws.getRow(i + 2);
    const jCell = r.getCell(10);
    const kCell = r.getCell(11);
    jCell.value = s.label;
    jCell.style = hCell(s.bold || false, s.bg || 'D9E1F2', '1F3864');
    if (s.formula) {
      kCell.value = { formula: s.formula };
    } else {
      kCell.value = s.value;
    }
    if (s.fmt) kCell.numFmt = s.fmt;
    kCell.style = {
      ...hCell(s.bold || false, s.bg || 'FFFFFF'),
      numFmt: s.fmt || 'General',
    };
    r.height = 20;
  });

  // ── Filas de datos ──
  const MONEY_FMT = '"$"#,##0.00';
  const PRICE_COL = 6;
  const SUBTOTAL_COL = 7;
  const RUNNING_COL = 8;

  rows.forEach((dataRow, idx) => {
    const excelRow = idx + 3; // filas de datos empiezan en 3
    const r = ws.getRow(excelRow);
    const bg = idx % 2 === 0 ? 'FFFFFF' : COLOR.altRow;

    // SIZE
    const sizeCell = r.getCell(2);
    sizeCell.value = dataRow.size || '';
    sizeCell.style = { ...hCell(false, bg), alignment: { horizontal: 'center', vertical: 'middle' } };

    // TYPE
    const typeCell = r.getCell(3);
    typeCell.value = dataRow.version || '';
    typeCell.style = { ...hCell(false, bg), alignment: { horizontal: 'center', vertical: 'middle' } };

    // DESCRIPTION
    const descCell = r.getCell(4);
    descCell.value = dataRow.comment || '';
    descCell.style = { ...hCell(false, bg), alignment: { vertical: 'middle', wrapText: true } };

    // QTY
    const qtyCell = r.getCell(5);
    qtyCell.value = dataRow.qty || 1;
    qtyCell.style = { ...hCell(false, bg), alignment: { horizontal: 'center', vertical: 'middle' } };

    // UNIT PRICE (fórmula VLOOKUP desde CONFIG)
    const priceCell = r.getCell(PRICE_COL);
    priceCell.value = { formula: `IFERROR(VLOOKUP($C${excelRow},${configSheetName}!$A$12:$B$25,2,FALSE),"")` };
    priceCell.numFmt = MONEY_FMT;
    priceCell.style = { ...hCell(false, bg), numFmt: MONEY_FMT, alignment: { horizontal: 'right', vertical: 'middle' } };

    // SUBTOTAL
    const subCell = r.getCell(SUBTOTAL_COL);
    subCell.value = { formula: `IF(OR(F${excelRow}="",E${excelRow}=""),"",F${excelRow}*E${excelRow})` };
    subCell.numFmt = MONEY_FMT;
    subCell.style = { ...hCell(false, bg), numFmt: MONEY_FMT, alignment: { horizontal: 'right', vertical: 'middle' } };

    // RUNNING TOTAL
    const runCell = r.getCell(RUNNING_COL);
    runCell.value = { formula: `IF(G${excelRow}="","",SUM($G$3:G${excelRow}))` };
    runCell.numFmt = MONEY_FMT;
    runCell.style = { ...hCell(false, bg), numFmt: MONEY_FMT, alignment: { horizontal: 'right', vertical: 'middle' } };

    r.height = 65; // altura para las fotos
  });

  // Filas vacías preparadas (para añadir más referencias)
  const BLANK_ROWS = 30;
  for (let i = 0; i < BLANK_ROWS; i++) {
    const excelRow = rows.length + 3 + i;
    const r = ws.getRow(excelRow);
    r.height = 22;

    const priceCell = r.getCell(PRICE_COL);
    priceCell.value = { formula: `IFERROR(VLOOKUP($C${excelRow},${configSheetName}!$A$12:$B$25,2,FALSE),"")` };
    priceCell.numFmt = MONEY_FMT;

    const subCell = r.getCell(SUBTOTAL_COL);
    subCell.value = { formula: `IF(OR(F${excelRow}="",E${excelRow}=""),"",F${excelRow}*E${excelRow})` };
    subCell.numFmt = MONEY_FMT;

    const runCell = r.getCell(RUNNING_COL);
    runCell.value = { formula: `IF(G${excelRow}="","",SUM($G$3:G${excelRow}))` };
    runCell.numFmt = MONEY_FMT;
  }

  // Freeze header rows
  ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 0 }];

  return ws;
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function run() {
  const srcFile = path.join(ROOT, 'PEDIDO 2 HERENCIA 90 .xlsx');
  if (!existsSync(srcFile)) {
    console.error('Archivo de origen no encontrado:', srcFile);
    process.exit(1);
  }

  // Leer datos del pedido original
  const { default: xlsx } = await import('xlsx');
  const srcWb = xlsx.readFile(srcFile);
  const srcWs = srcWb.Sheets['Pedido 2'];
  const rawRows = xlsx.utils.sheet_to_json(srcWs, { header: 1 });

  // Extraer filas de datos (skip header row 0)
  const orderRows = rawRows.slice(1)
    .filter(r => r[2] || r[3]) // tiene version o comment
    .map(r => ({
      size:    String(r[1] || ''),
      version: String(r[2] || ''),
      comment: String(r[3] || ''),
      qty:     Number(r[4]) || 1,
    }));

  console.log(`Filas de pedido encontradas: ${orderRows.length}`);

  // Config proveedor
  const provider = {
    name:    'Feng',
    contact: '+86 138 7819 1561',
    catalog: 'https://yupooscolombia.wixsite.com/yupooscolombia',
    notes:   'Main supplier for fan, retro, player jerseys',
    others: [
      { name: 'Helen', contact: '', catalog: '', notes: '' },
    ],
  };

  // Precios (desde Configuracion original)
  const prices = [
    { type: 'FAN',                    price: 10 },
    { type: 'FAN WOMAN',              price: 10 },
    { type: 'SPECIAL EDITION FAN',    price: 12 },
    { type: 'SHORTS',                 price: 8  },
    { type: 'RETRO',                  price: 15 },
    { type: 'GOALKEEPER',             price: 13 },
    { type: 'TRAINING CLOTHES',       price: 13 },
    { type: 'POLO',                   price: 13 },
    { type: 'LONG SLEEVE',            price: 15 },
    { type: 'PLAYER',                 price: 13 },
    { type: 'SPECIAL EDITION PLAYER', price: 15 },
    { type: "CHILDREN'S KIT",         price: 15 },
    { type: 'NBA',                    price: 18 },
    { type: 'SOCKS',                  price: 7  },
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Herencia 90';
  wb.lastModifiedBy = 'Herencia 90 Script';
  wb.created = new Date();

  const CONFIG_SHEET = 'CONFIG';

  buildConfigSheet(wb, provider, prices);
  buildOrderSheet(wb, orderRows, provider.name, CONFIG_SHEET);

  const outFile = path.join(ROOT, 'PEDIDO HERENCIA 90 LIMPIO.xlsx');
  await wb.xlsx.writeFile(outFile);
  console.log('✓ Guardado:', outFile);
  console.log('\nSiguiente paso: node scripts/pedido-imagenes.mjs "PEDIDO HERENCIA 90 LIMPIO.xlsx"');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
