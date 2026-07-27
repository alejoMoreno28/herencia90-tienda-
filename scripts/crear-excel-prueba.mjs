/**
 * scripts/crear-excel-prueba.mjs
 *
 * Arma un excel de pedido pequeño, con la misma estructura y con fotos
 * incrustadas, para poder probar el flujo completo de punta a punta sin
 * ensuciar un pedido de verdad.
 *
 * Las fotos salen del propio proveedor, asi que la comparacion visual tiene
 * algo real contra que medir, igual que en un pedido de verdad.
 *
 * Uso: node scripts/crear-excel-prueba.mjs _prueba.xlsx
 */
'use strict';

import ExcelJS from 'exceljs';
import { searchYupooAlbums, downloadAlbumPhotos } from './lib/yupoo-search.mjs';

const salida = process.argv[2] || '_prueba-cargador.xlsx';

// Camisetas reales que NO estan en el catalogo, para que la prueba ejercite el
// camino de crear productos nuevos.
// Se mezclan destinos a proposito: asi la prueba cubre una referencia que va
// toda a stock, otra toda encargada, y una partida entre las dos.
const FILAS = [
  { talla: 'M', tipo: 'FAN', descripcion: 'BELGICA 26 VISITANTE', qty: 1, precio: 11, destino: 'STOCK', busqueda: '比利时 26-27' },
  { talla: 'L', tipo: 'FAN', descripcion: 'BELGICA 26 VISITANTE', qty: 2, precio: 11, destino: 'PREVENTA', busqueda: '比利时 26-27' },
  { talla: 'M', tipo: 'FAN', descripcion: 'CHAPECOENSE ESPECIAL EDITION', qty: 1, precio: 11, destino: 'PREVENTA', busqueda: '沙佩科恩斯' },
];

async function fotoDeReferencia(termino) {
  for (const tienda of ['https://bomandi.x.yupoo.com', 'https://1040-td.x.yupoo.com']) {
    try {
      const albumes = await searchYupooAlbums(tienda, termino);
      if (!albumes.length) continue;
      const fotos = await downloadAlbumPhotos(tienda, albumes[0].href, 1);
      if (fotos.length) return fotos[0].buffer;
    } catch { /* se prueba la siguiente tienda */ }
  }
  return null;
}

async function main() {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('ORDER');

  hoja.addRow(['HERENCIA 90 — ORDER   |   Provider: SNAKE   |   PRUEBA']);
  hoja.addRow(['PHOTO', 'SIZE', 'TYPE', 'DESCRIPTION', 'EXTRAS', 'EXTRAS COST (USD)',
    'QTY', 'UNIT PRICE (USD)', 'SUBTOTAL (USD)', 'RUNNING TOTAL (USD)', 'PERSONAS', 'DESTINO']);

  const fotosPorDescripcion = new Map();
  let acumulado = 0;

  for (const [i, fila] of FILAS.entries()) {
    const subtotal = fila.qty * fila.precio;
    acumulado += subtotal;
    hoja.addRow(['', fila.talla, fila.tipo, fila.descripcion, '', 0,
      fila.qty, fila.precio, subtotal, acumulado, '', fila.destino]);

    // Una sola descarga por referencia, igual que en los pedidos de verdad
    // donde la misma foto se repite en las filas de cada talla.
    if (!fotosPorDescripcion.has(fila.descripcion)) {
      process.stdout.write(`bajando foto de ${fila.descripcion}… `);
      fotosPorDescripcion.set(fila.descripcion, await fotoDeReferencia(fila.busqueda));
      console.log(fotosPorDescripcion.get(fila.descripcion) ? 'ok' : 'SIN FOTO');
    }
    const buffer = fotosPorDescripcion.get(fila.descripcion);
    if (!buffer) continue;

    const idImagen = libro.addImage({ buffer, extension: 'jpeg' });
    // Anclada a la celda de la columna PHOTO de esta fila, como hace el excel real.
    hoja.addImage(idImagen, { tl: { col: 0, row: i + 2 }, ext: { width: 120, height: 120 } });
  }

  FILAS.forEach((_, i) => { hoja.getRow(i + 3).height = 92; });
  hoja.getColumn(1).width = 18;
  hoja.getColumn(4).width = 40;

  await libro.xlsx.writeFile(salida);
  const unidades = FILAS.reduce((s, f) => s + f.qty, 0);
  console.log(`\n${salida}: ${FILAS.length} filas, ${unidades} unidades, ${fotosPorDescripcion.size} referencias`);
}

main().catch((e) => { console.error('Error:', e); process.exit(1); });
