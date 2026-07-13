import ExcelJS from 'exceljs';

function cellValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object' || value instanceof Date) return value;
  if ('result' in value) return cellValue(value.result);
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
  if ('text' in value) return value.text;
  return value;
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
