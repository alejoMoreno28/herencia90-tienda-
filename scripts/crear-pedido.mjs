/**
 * crear-pedido.mjs
 * Crea el Excel de pedido completo (formato + imágenes) en un solo paso.
 *
 * Uso:
 *   node scripts/crear-pedido.mjs
 *   node scripts/crear-pedido.mjs "mi-pedido.xlsx"   ← archivo de origen (formato viejo)
 *
 * El archivo de origen debe tener columnas: Size, Version, Comment, Quantity
 * (puede ser el Excel viejo "PEDIDO 2 HERENCIA 90 .xlsx" o cualquier otro compatible)
 *
 * Output: "PEDIDO HERENCIA 90 [fecha].xlsx" listo para enviar al proveedor.
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync }                 from 'fs';
import path                           from 'path';
import { fileURLToPath }              from 'url';
import sharp                          from 'sharp';
import ExcelJS                        from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.pedido-imagenes-cache');

// ── Configuración del proveedor ───────────────────────────────────────────────
// Para cambiar de proveedor: edita solo este bloque
// ── Proveedores ────────────────────────────────────────────────────────────────
// Cambiar ACTIVE_PROVIDER para generar el pedido con otro proveedor.
const PROVIDERS = {
  snake: {
    name:    'Snake',
    contact: '+86 178 7852 5090',
    catalog: 'Fans: https://1040-td.x.yupoo.com/albums (pass: bmd56789) | https://bomandi.x.yupoo.com/albums'
           + ' || Players: https://baike5555.x.yupoo.com/albums | https://3409834285.x.yupoo.com'
           + ' || Retro: https://huiliyuan.x.yupoo.com/categories | https://yangdekun.x.yupoo.com/albums',
    notes:   'Zapatos: https://lyzs88.x.yupoo.com | Chaquetas: https://sdfs888.x.yupoo.com',
    prices: {
      'FAN':                    11,
      'FAN WOMAN':              11,
      'SPECIAL EDITION FAN':    11,
      'PLAYER':                 14,
      'SPECIAL EDITION PLAYER': 14,
      'RETRO':                  15,
      'GOALKEEPER':             15,
      'LONG SLEEVE':            15,
      'POLO':                   15,
      'TRAINING CLOTHES':       35,
      "CHILDREN'S KIT":         13,
      'JACKET SET':             40,
      'NBA':                    20,
      'F1':                     22,
      'EMBROIDERED JERSEY':     30,
    },
    // Envio por cantidad total de piezas del pedido (lista real de Snake)
    shippingTiers: [
      { minUnits: 4, cost: 0 },
      { minUnits: 3, cost: 3 },
      { minUnits: 2, cost: 4 },
      { minUnits: 1, cost: 5 },
    ],
    // Descuento por volumen: 50+ camisetas => 1 USD menos por unidad
    volumeDiscount: { minUnits: 50, perUnit: 1 },
    extras: { personalizacion: 3, patch: 1, tallaGrande: 1 },
  },

  huangx: {
    name:    'Huang X',
    contact: '+86 180 5424 5771',
    catalog: 'https://jingdongtiyu.x.yupoo.com/collections/3804419  (pass: 111999) | https://1022669895.x.yupoo.com',
    notes:   'Football shoes: https://mzrycm102618.x.yupoo.com/albums',
    prices: {
      'FAN':                    12,
      'FAN WOMAN':              12,
      'SPECIAL EDITION FAN':    12,
      'SHORTS':                  8,
      'RETRO':                  15,
      'GOALKEEPER':             15,
      'TRAINING CLOTHES':       15,
      'POLO':                   15,
      'LONG SLEEVE':            15,
      'PLAYER':                 15,
      'SPECIAL EDITION PLAYER': 15,
      "CHILDREN'S KIT":         16,
      'NBA':                    18,
      'SOCKS':                   3,
    },
    shippingTiers: [
      { minUnits: 5, cost: 0 },
      { minUnits: 1, cost: 8 },
    ],
    volumeDiscount: null,
    extras: { personalizacion: 2, patch: 1, tallaGrande: 1 },
  },
};

const ACTIVE_PROVIDER = process.env.PEDIDO_PROVIDER || 'snake';
const PROVIDER = PROVIDERS[ACTIVE_PROVIDER];
if (!PROVIDER) {
  throw new Error(`Proveedor desconocido: "${ACTIVE_PROVIDER}". Opciones: ${Object.keys(PROVIDERS).join(', ')}`);
}

const PRICES = PROVIDER.prices;

// ── Tasa de cambio ─────────────────────────────────────────────────────────────
// Actualizar antes de cada pedido según TRM del día (COP por 1 USD)
const TRM = 3551; // TRM 25 abril 2026 — actualizar antes de cada pedido

// ── Costos de extras ───────────────────────────────────────────────────────────
const EXTRA_PERSONALIZACION = PROVIDER.extras.personalizacion; // dorsal, nombre, número
const EXTRA_PATCH           = PROVIDER.extras.patch;           // parche/escudo
const EXTRA_TALLA_GRANDE    = PROVIDER.extras.tallaGrande;     // 2XL, 3XL, 4XL

// Texto legible de la regla de envio, y formula de Excel equivalente.
// tiers viene ordenado de mayor a menor minUnits.
const SHIPPING_TIERS = PROVIDER.shippingTiers;

function shippingRuleText() {
  const parts = [];
  const sorted = [...SHIPPING_TIERS].sort((a, b) => a.minUnits - b.minUnits);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const next = sorted[i + 1];
    const label = next ? (next.minUnits - t.minUnits === 1 ? `${t.minUnits}` : `${t.minUnits}-${next.minUnits - 1}`) : `${t.minUnits}+`;
    parts.push(`${label} pcs: ${t.cost === 0 ? 'FREE' : '$' + t.cost}`);
  }
  return parts.join('  |  ');
}

/**
 * Formula anidada de Excel para el envio segun la celda de unidades totales.
 * OJO: se devuelve SIN el "=" inicial. En OOXML el contenido de <f> no lleva
 * el signo igual; incluirlo genera <f>=...</f>, que es invalido y algunos
 * lectores (Google Sheets, parsers estrictos) rechazan o muestran vacio.
 */
function shippingFormula(unitsCell) {
  const sorted = [...SHIPPING_TIERS].sort((a, b) => b.minUnits - a.minUnits);
  let formula = '0';
  for (let i = sorted.length - 1; i >= 0; i--) {
    formula = `IF(${unitsCell}>=${sorted[i].minUnits},${sorted[i].cost},${formula})`;
  }
  return formula;
}

// ── Constantes de imagen ───────────────────────────────────────────────────────
const IMG_W  = 70;
const IMG_H  = 70;
const UA     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

// ── Colores ───────────────────────────────────────────────────────────────────
const C = {
  darkBlue:  'FF1F3864',
  midBlue:   'FF2E75B6',
  lightBlue: 'FFD9E1F2',
  altRow:    'FFF2F7FF',
  yellow:    'FFFFF2CC',
  white:     'FFFFFFFF',
  border:    'FF8EAADB',
};

// ─── utilidades ──────────────────────────────────────────────────────────────

const sleep  = ms => new Promise(r => setTimeout(r, ms));
const safeFn = s => s.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 60);

function cellStyle(opts = {}) {
  const { bold = false, bg = null, fg = '000000', hAlign = 'left', wrap = false } = opts;
  const style = {
    font:      { bold, name: 'Calibri', size: 10, color: { argb: 'FF' + fg } },
    alignment: { vertical: 'middle', horizontal: hAlign, wrapText: wrap },
    border: {
      top:    { style: 'thin', color: { argb: C.border } },
      left:   { style: 'thin', color: { argb: C.border } },
      bottom: { style: 'thin', color: { argb: C.border } },
      right:  { style: 'thin', color: { argb: C.border } },
    },
  };
  if (bg) style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  return style;
}

// ─── imagen: búsqueda DuckDuckGo ─────────────────────────────────────────────

async function ddgImageUrls(query) {
  const res = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=images`,
    { headers: { 'User-Agent': UA } }
  );
  const html = await res.text();
  const m = html.match(/vqd=["']?([\d-]+)["']?/) || html.match(/vqd=([^&"'\s<]+)/);
  if (!m) return [];

  await sleep(400);
  const r2 = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(m[1])}&f=,,,,,&p=1`,
    { headers: { 'User-Agent': UA, 'Referer': 'https://duckduckgo.com/' } }
  );
  if (!r2.ok) return [];
  const data = await r2.json();
  return (data.results || []).slice(0, 6).map(x => x.image || x.thumbnail).filter(Boolean);
}

function buildQuery(version, comment) {
  const clean = comment.replace(/\(.*?\)/g, '').trim();
  const extra = version === 'RETRO'      ? 'retro' :
                version === 'FAN WOMAN'  ? 'women' :
                version === 'PLAYER'     ? 'player issue' :
                version === 'GOALKEEPER' ? 'goalkeeper' : '';
  return `${clean} ${extra} football shirt jersey flat lay white background`.trim();
}

async function getJerseyImage(version, comment) {
  const query    = buildQuery(version, comment);
  const cacheKey = safeFn(query);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.jpg`);

  if (existsSync(cachePath)) {
    console.log(`  ♻  cache → "${comment}"`);
    return readFile(cachePath);
  }

  console.log(`  🔍 "${query}"`);
  const urls = await ddgImageUrls(query);

  for (const url of urls) {
    try {
      const origin = new URL(url).origin + '/';
      const r = await fetch(url, {
        headers: { 'User-Agent': UA, 'Referer': origin },
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) { console.log(`     ✗ ${r.status}`); continue; }
      console.log(`     ↓ ${url.slice(0, 80)}`);

      const raw     = Buffer.from(await r.arrayBuffer());
      const resized = await sharp(raw)
        .resize(IMG_W, IMG_H, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 80 })
        .toBuffer();

      await writeFile(cachePath, resized);
      return resized;
    } catch (e) {
      console.log(`     ✗ ${e.message}`);
    }
  }
  console.log(`     Sin imagen válida — se omite`);
  return null;
}

// ─── parsear extras de la descripción ────────────────────────────────────────

function parseExtras(comment, size) {
  const parts = [];
  let cost = 0;

  if (/dorsal|personaliz|nombre|número|numero|printing/i.test(comment)) {
    parts.push('Dorsal / Personalization');
    cost += EXTRA_PERSONALIZACION;
  }
  if (/patch|parche|escudo badge/i.test(comment)) {
    parts.push('Patch');
    cost += EXTRA_PATCH;
  }
  if (/^[234]XL$/i.test(String(size).trim())) {
    parts.push('Size surcharge (2XL+)');
    cost += EXTRA_TALLA_GRANDE;
  }

  return { label: parts.join(' + '), cost };
}

// ─── Excel: hoja CONFIG ───────────────────────────────────────────────────────

function addConfigSheet(wb) {
  const ws = wb.addWorksheet('CONFIG', {
    properties: { tabColor: { argb: C.midBlue } },
  });

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 38;

  const addHeader = (label) => {
    const r = ws.addRow([label]);
    r.height = 20;
    ws.mergeCells(`A${r.number}:B${r.number}`);
    r.getCell(1).style = { ...cellStyle({ bold: true, bg: C.darkBlue, fg: 'FFFFFF', hAlign: 'center' }), font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' } };
    return r;
  };

  const addField = (label, value, editable = false) => {
    const r = ws.addRow([label, value]);
    r.height = 18;
    r.getCell(1).style = cellStyle({ bold: true, bg: C.lightBlue, fg: '1F3864' });
    r.getCell(2).style = cellStyle({ bold: editable, bg: editable ? C.white : C.white, fg: '000000' });
    if (editable) {
      r.getCell(2).style.font = { bold: true, color: { argb: 'FF1F3864' }, size: 11, name: 'Calibri' };
    }
    return r;
  };

  addHeader('⚽  HERENCIA 90 — PROVIDER CONFIG');
  ws.addRow([]);

  addHeader('ACTIVE PROVIDER  ← Edit here to change provider');
  addField('Name',        PROVIDER.name,    true);
  addField('WhatsApp',    PROVIDER.contact, true);
  addField('Catalog URL', PROVIDER.catalog, true);
  if (PROVIDER.notes) addField('Notes', PROVIDER.notes, true);

  ws.addRow([]);
  addHeader('PRICES BY TYPE (USD)  ← Edit column B to change prices');
  const ph = ws.addRow(['Type / Version', 'Price (USD)']);
  ph.height = 18;
  ph.getCell(1).style = cellStyle({ bold: true, bg: C.midBlue, fg: 'FFFFFF', hAlign: 'center' });
  ph.getCell(2).style = cellStyle({ bold: true, bg: C.midBlue, fg: 'FFFFFF', hAlign: 'center' });

  Object.entries(PRICES).forEach(([type, price], i) => {
    const bg = i % 2 === 0 ? C.white : C.altRow;
    const r = ws.addRow([type, price]);
    r.height = 17;
    r.getCell(1).style = cellStyle({ bg });
    r.getCell(2).style = { ...cellStyle({ bg, hAlign: 'center' }), numFmt: '"$"#,##0' };
  });

  ws.addRow([]);
  addHeader('SHIPPING');
  [...SHIPPING_TIERS].sort((a, b) => a.minUnits - b.minUnits).forEach((t, i, arr) => {
    const next = arr[i + 1];
    const label = next
      ? (next.minUnits - t.minUnits === 1 ? `${t.minUnits} pc` : `${t.minUnits}–${next.minUnits - 1} pcs`)
      : `${t.minUnits}+ pcs`;
    addField(label, t.cost);
  });

  if (PROVIDER.volumeDiscount) {
    ws.addRow([]);
    addHeader('VOLUME DISCOUNT');
    addField(`${PROVIDER.volumeDiscount.minUnits}+ units`, `-$${PROVIDER.volumeDiscount.perUnit} per unit`);
  }

  ws.addRow([]);
  addHeader('EXCHANGE RATE  ← Update before each order');
  const trmRow = addField('TRM  (1 USD = COP)', TRM, true);
  trmRow.getCell(2).numFmt = '"$ "#,##0';

  const noteR = ws.addRow(['Change the value in B to today\'s exchange rate (e.g. 4200)']);
  noteR.getCell(1).style = { font: { italic: true, color: { argb: 'FF888888' }, size: 9, name: 'Calibri' } };
  ws.mergeCells(`A${noteR.number}:B${noteR.number}`);

  return trmRow.number; // devuelve la fila para que ORDER pueda referenciarla
}

// ─── Excel: hoja ORDER ────────────────────────────────────────────────────────

async function addOrderSheet(wb, orderRows, trmRow) {
  const ws = wb.addWorksheet('ORDER', {
    properties: { tabColor: { argb: C.darkBlue } },
  });

  // ── Columnas ──
  // A=1:PHOTO  B=2:SIZE  C=3:TYPE  D=4:DESCRIPTION
  // E=5:EXTRAS  F=6:EXTRAS COST  G=7:QTY  H=8:UNIT PRICE
  // I=9:SUBTOTAL  J=10:RUNNING TOTAL  K=11:spacer  L=12:SUMMARY label  M=13:SUMMARY value
  ws.getColumn(1).width  = 12;   // PHOTO
  ws.getColumn(2).width  = 7;    // SIZE
  ws.getColumn(3).width  = 16;   // TYPE
  ws.getColumn(4).width  = 28;   // DESCRIPTION
  ws.getColumn(5).width  = 22;   // EXTRAS
  ws.getColumn(6).width  = 13;   // EXTRAS COST
  ws.getColumn(7).width  = 6;    // QTY
  ws.getColumn(8).width  = 15;   // UNIT PRICE
  ws.getColumn(9).width  = 14;   // SUBTOTAL
  ws.getColumn(10).width = 16;   // RUNNING TOTAL
  ws.getColumn(11).width = 3;    // spacer
  ws.getColumn(12).width = 22;   // SUMMARY label
  ws.getColumn(13).width = 20;   // SUMMARY value

  // ── Fila 1: título ──
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `HERENCIA 90 — ORDER   |   Provider: ${PROVIDER.name}   |   Contact: ${PROVIDER.contact}`;
  titleCell.style = { ...cellStyle({ bold: true, bg: C.darkBlue, fg: 'FFFFFF', hAlign: 'center' }), font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Calibri' } };
  ws.getRow(1).height = 26;

  // ── Fila 1: resumen título ──
  ws.mergeCells('L1:M1');
  ws.getCell('L1').value = 'ORDER SUMMARY';
  ws.getCell('L1').style = { ...cellStyle({ bold: true, bg: C.darkBlue, fg: 'FFFFFF', hAlign: 'center' }), font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' } };

  // ── Fila 2: headers ──
  const headers = ['PHOTO','SIZE','TYPE','DESCRIPTION','EXTRAS','EXTRAS COST (USD)','QTY','UNIT PRICE (USD)','SUBTOTAL (USD)','RUNNING TOTAL (USD)'];
  const hRow = ws.getRow(2);
  hRow.height = 22;
  headers.forEach((h, i) => {
    hRow.getCell(i + 1).value = h;
    hRow.getCell(i + 1).style = cellStyle({ bold: true, bg: C.midBlue, fg: 'FFFFFF', hAlign: 'center' });
  });

  // ── Resumen (cols L=12 / M=13) ──
  const MONEY = '"$"#,##0.00';
  const nData = orderRows.length;
  const lastDataRow = nData + 2;

  // OJO con los rangos: deben cubrir SOLO las filas de datos (3..lastDataRow).
  // Si el rango se pasa de lastDataRow y abajo hay una fila de subtotal, esa
  // fila se suma otra vez y el total sale al doble (bug real encontrado en
  // PEDIDO5/PEDIDO6: decian 102 y 12 unidades cuando eran 51 y 6).
  const vd = PROVIDER.volumeDiscount;
  const discountFormula = vd
    ? `IF(M4>=${vd.minUnits},-M4*${vd.perUnit},0)`
    : '0';

  // NOTA: las formulas van SIN "=" inicial (ver shippingFormula()).
  const summaryItems = [
    { r: 2,  label: 'Provider',            value: PROVIDER.name,                                                    fmt: null },
    { r: 3,  label: 'Contact',             value: PROVIDER.contact,                                                 fmt: null },
    // SUM (no COUNTA): COUNTA cuenta filas, no unidades — una fila con QTY 3
    // contaba como 1 sola unidad.
    { r: 4,  label: 'Total units',         value: { formula: `IFERROR(SUM(G3:G${lastDataRow}),0)` },                 fmt: null },
    { r: 5,  label: 'Subtotal (USD)',      value: { formula: `IFERROR(SUM(I3:I${lastDataRow}),0)` },                 fmt: MONEY },
    { r: 6,  label: 'Volume discount (USD)', value: { formula: discountFormula },                                   fmt: MONEY },
    { r: 7,  label: 'Shipping (USD)',      value: { formula: shippingFormula('M4') },                               fmt: MONEY },
    { r: 8,  label: 'TOTAL (USD)',         value: { formula: 'IFERROR(M5+M6+M7,0)' },  fmt: MONEY, bold: true, bg: C.yellow },
    { r: 9,  label: 'TRM  (1 USD = COP)',  value: { formula: `CONFIG!B${trmRow}` },    fmt: '"$ "#,##0' },
    { r: 10, label: 'TOTAL (COP)',         value: { formula: 'IFERROR(M8*M9,0)' },     fmt: '"$ "#,##0', bold: true, bg: C.yellow },
    { r: 11, label: 'Shipping rule',       value: shippingRuleText(),                                               fmt: null },
    { r: 12, label: 'Discount rule',       value: vd ? `${vd.minUnits}+ units: -$${vd.perUnit} per unit` : 'N/A',   fmt: null },
  ];

  for (const s of summaryItems) {
    const row = ws.getRow(s.r);
    row.height = 20;
    const lCell = row.getCell(12);
    const mCell = row.getCell(13);
    lCell.value = s.label;
    lCell.style = cellStyle({ bold: s.bold || false, bg: s.bg || C.lightBlue, fg: '1F3864' });
    mCell.value = s.value;
    if (s.fmt) mCell.numFmt = s.fmt;
    mCell.style = { ...cellStyle({ bold: s.bold || false, bg: s.bg || C.white }), numFmt: s.fmt || 'General' };
  }

  // ── Filas de datos ──
  const imgCache = new Map();

  for (let idx = 0; idx < orderRows.length; idx++) {
    const row    = orderRows[idx];
    const excelR = idx + 3;
    const xRow   = ws.getRow(excelR);
    xRow.height  = 58;
    const bg     = idx % 2 === 0 ? C.white : C.altRow;

    const { label: extrasLabel, cost: extrasCost } = parseExtras(row.comment, row.size);

    // B: SIZE
    const sc = xRow.getCell(2);
    sc.value = row.size;
    sc.style = cellStyle({ bg, hAlign: 'center' });

    // C: TYPE
    const tc = xRow.getCell(3);
    tc.value = row.version;
    tc.style = cellStyle({ bg, hAlign: 'center' });

    // D: DESCRIPTION
    const dc = xRow.getCell(4);
    dc.value = row.comment;
    dc.style = cellStyle({ bg, wrap: true });

    // E: EXTRAS
    const ec = xRow.getCell(5);
    ec.value = extrasLabel || '';
    ec.style = cellStyle({ bg, wrap: true });
    if (extrasLabel) {
      ec.style.font = { ...ec.style.font, color: { argb: 'FF7030A0' }, bold: true }; // morado para destacar
    }

    // F: EXTRAS COST
    const fc = xRow.getCell(6);
    fc.value = extrasCost || 0;
    fc.numFmt = '"$"#,##0.00';
    fc.style  = { ...cellStyle({ bg, hAlign: 'right' }), numFmt: '"$"#,##0.00' };
    if (extrasCost > 0) {
      fc.style.font = { ...fc.style.font, bold: true, color: { argb: 'FF7030A0' } };
    }

    // G: QTY
    const qc = xRow.getCell(7);
    qc.value = row.qty;
    qc.style = cellStyle({ bg, hAlign: 'center' });

    // H: UNIT PRICE
    const price = PRICES[row.version] || '';
    const pc = xRow.getCell(8);
    pc.value = price;
    pc.numFmt = '"$"#,##0.00';
    pc.style  = { ...cellStyle({ bg, hAlign: 'right' }), numFmt: '"$"#,##0.00' };

    // I: SUBTOTAL = (UNIT_PRICE + EXTRAS_COST) * QTY
    const stc = xRow.getCell(9);
    stc.value = { formula: `IF(OR(H${excelR}="",G${excelR}=""),"",( H${excelR}+F${excelR} )*G${excelR})` };
    stc.numFmt = '"$"#,##0.00';
    stc.style  = { ...cellStyle({ bg, hAlign: 'right' }), numFmt: '"$"#,##0.00' };

    // J: RUNNING TOTAL
    const rtc = xRow.getCell(10);
    rtc.value = { formula: `IF(I${excelR}="","",SUM($I$3:I${excelR}))` };
    rtc.numFmt = '"$"#,##0.00';
    rtc.style  = { ...cellStyle({ bg, hAlign: 'right' }), numFmt: '"$"#,##0.00' };

    // IMAGEN
    const imgKey = `${row.version}|${row.comment}`;
    let imgBuf;

    if (imgCache.has(imgKey)) {
      imgBuf = imgCache.get(imgKey);
      console.log(`Fila ${excelR}: ♻  reutilizando → "${row.comment}"`);
    } else {
      console.log(`Fila ${excelR}: buscando imagen → "${row.comment}" (${row.version})`);
      imgBuf = await getJerseyImage(row.version, row.comment);
      imgCache.set(imgKey, imgBuf);
      await sleep(1200);
    }

    if (imgBuf) {
      const imgId = wb.addImage({ buffer: imgBuf, extension: 'jpeg' });
      ws.addImage(imgId, {
        tl: { col: 0, row: excelR - 1 },
        br: { col: 1, row: excelR },
        editAs: 'oneCell',
      });
    }
  }

  ws.views = [{ state: 'frozen', ySplit: 2 }];
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });

  // Leer datos del pedido fuente
  const srcFile = process.argv[2]
    ? path.join(ROOT, process.argv[2])
    : path.join(ROOT, 'PEDIDO 2 HERENCIA 90 .xlsx');

  if (!existsSync(srcFile)) {
    console.error('Archivo de origen no encontrado:', srcFile);
    process.exit(1);
  }

  console.log('Leyendo datos de:', path.basename(srcFile));
  const { default: xlsx } = await import('xlsx');
  const srcWb = xlsx.readFile(srcFile);

  // Detectar hoja de pedido
  const sheetName = srcWb.SheetNames.includes('Pedido 2') ? 'Pedido 2'
                  : srcWb.SheetNames.includes('ORDER')    ? 'ORDER'
                  : srcWb.SheetNames[0];

  const srcWs   = srcWb.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(srcWs, { header: 1 });

  // Fila de headers: buscar la que tenga "Version" o "TYPE"
  let dataStart = 1;
  if (rawRows[1] && (String(rawRows[1][2]).toUpperCase().includes('VERSION') || String(rawRows[1][2]).toUpperCase().includes('TYPE'))) {
    dataStart = 2; // headers en fila 1 y 2 (ORDER sheet)
  }

  const orderRows = rawRows.slice(dataStart)
    .filter(r => r[2] || r[3])
    .map(r => ({
      size:    String(r[1] || '').trim(),
      version: String(r[2] || '').trim(),
      comment: String(r[3] || '').trim(),
      qty:     Number(r[4]) || 1,
    }));

  console.log(`Referencias en el pedido: ${orderRows.length}\n`);

  // Crear workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Herencia 90';
  wb.created = new Date();

  const trmRow = addConfigSheet(wb);
  await addOrderSheet(wb, orderRows, trmRow);

  // Guardar
  const date    = new Date().toISOString().slice(0, 10);
  const outFile = path.join(ROOT, `PEDIDO HERENCIA 90 ${date}.xlsx`);
  console.log('\nGuardando...');
  await wb.xlsx.writeFile(outFile);
  console.log('✓', path.basename(outFile));
}

run().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
