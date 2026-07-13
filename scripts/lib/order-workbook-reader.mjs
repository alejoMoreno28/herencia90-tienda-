import ExcelJS from 'exceljs';

function cellValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || value instanceof Date) return value;
  if ('result' in value) return cellValue(value.result);
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  if ('text' in value) return value.text;
  return value;
}

function normalizeHeader(value) {
  return String(value || '').trim().toUpperCase();
}

function findColumn(headers, names, fallback) {
  const accepted = new Set(names);
  const index = headers.findIndex((header) => accepted.has(normalizeHeader(header)));
  return index >= 0 ? index : fallback;
}

export function parseOrderRows(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const headerIndex = safeRows.findIndex((row) => {
    const headers = Array.isArray(row) ? row.map(normalizeHeader) : [];
    return headers.includes('SIZE')
      && (headers.includes('VERSION') || headers.includes('TYPE'))
      && (headers.includes('QUANTITY') || headers.includes('QTY'));
  });
  const effectiveHeaderIndex = headerIndex >= 0 ? headerIndex : 0;
  const headers = safeRows[effectiveHeaderIndex] || [];
  const sizeIndex = findColumn(headers, ['SIZE'], 1);
  const versionIndex = findColumn(headers, ['VERSION', 'TYPE'], 2);
  const commentIndex = findColumn(headers, ['COMMENT (DETALLES)', 'COMMENT', 'DESCRIPTION'], 3);
  const extrasIndex = findColumn(headers, ['EXTRAS'], -1);
  const quantityIndex = findColumn(headers, ['QUANTITY', 'QTY'], 4);

  return safeRows.slice(effectiveHeaderIndex + 1)
    .filter((row) => row && (row[versionIndex] || row[commentIndex]))
    .map((row) => {
      const comment = String(row[commentIndex] || '').trim();
      const extras = extrasIndex >= 0 ? String(row[extrasIndex] || '').trim() : '';
      const quantity = Math.floor(Number(row[quantityIndex]) || 1);
      return {
        size: String(row[sizeIndex] || '').trim(),
        version: String(row[versionIndex] || '').trim(),
        comment: [comment, extras].filter(Boolean).join(' | '),
        qty: Math.max(1, quantity)
      };
    });
}

export async function readOrderRows(file, preferredSheetNames = []) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const worksheet = preferredSheetNames
    .map((name) => workbook.getWorksheet(name))
    .find(Boolean) || workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('El archivo no contiene hojas de cálculo.');
  }

  const rows = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    rows[rowNumber - 1] = Array.from(
      { length: row.cellCount },
      (_, index) => cellValue(row.getCell(index + 1).value)
    );
  });

  return { sheetName: worksheet.name, rows };
}
