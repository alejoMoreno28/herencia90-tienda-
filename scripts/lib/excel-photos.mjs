/**
 * scripts/lib/excel-photos.mjs
 *
 * Saca las fotos que estan pegadas dentro del excel del pedido y las asocia a
 * su fila. La foto es el dato confiable: la descripcion escrita a mano puede
 * tener errores de dedo o nombres ambiguos, pero la foto siempre es la
 * camiseta correcta.
 *
 * En un .xlsx las imagenes no viven en la celda. Estan en xl/media/ y hay un
 * archivo de dibujo (xl/drawings/drawingN.xml) que dice en que celda va cada
 * una. Hay que cruzar tres archivos para armar el mapa:
 *
 *   hoja  --rId-->  drawingN.xml       (que dibujo le corresponde a la hoja)
 *   dibujo: ancla (fila/columna) + rId  (donde va cada imagen)
 *   drawingN.xml.rels --rId--> media/   (que archivo es esa imagen)
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { abrirZip } from './zip-lector.mjs';

/** Mapa rId -> destino, leido de un archivo .rels */
function leerRelaciones(xml) {
  const mapa = {};
  const re = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml))) mapa[m[1]] = m[2];
  // El atributo Target puede ir antes que Id segun quien genero el archivo.
  const re2 = /<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"/g;
  while ((m = re2.exec(xml))) mapa[m[2]] = m[1];
  return mapa;
}

/**
 * Lee las anclas del dibujo. Cada ancla trae la fila/columna donde arranca la
 * imagen (base 0) y el rId del archivo de imagen.
 */
function leerAnclas(xml) {
  const anclas = [];
  // Sirve tanto para twoCellAnchor como para oneCellAnchor.
  const bloques = xml.split(/<xdr:(?:two|one)CellAnchor\b/).slice(1);
  for (const bloque of bloques) {
    const fila = bloque.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const col = bloque.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/);
    const rel = bloque.match(/r:embed="([^"]+)"/);
    if (!fila || !rel) continue;
    anclas.push({ row: parseInt(fila[1], 10), col: col ? parseInt(col[1], 10) : 0, rId: rel[1] });
  }
  return anclas;
}

/**
 * Devuelve [{ row, col, buffer, ext }] con las fotos de la hoja indicada.
 * `row` es el indice de fila base 0, igual que el que usa sheet_to_json con
 * header:1, para poder cruzarlo directo con las filas del pedido.
 */
export function extraerFotosDeExcel(xlsx, nombreHoja = 'ORDER') {
  // Acepta una ruta o el archivo ya en memoria. Con buffer se escribe a un
  // temporal porque el lector de zip trabaja sobre archivos.
  let rutaXlsx = xlsx;
  let temporal = null;
  if (Buffer.isBuffer(xlsx)) {
    temporal = path.join(os.tmpdir(), `lote-${process.pid}-${Buffer.from(String(xlsx.length)).toString('hex')}.xlsx`);
    fs.writeFileSync(temporal, xlsx);
    rutaXlsx = temporal;
  }
  try {
    return extraerDeRuta(rutaXlsx, nombreHoja);
  } finally {
    if (temporal) { try { fs.unlinkSync(temporal); } catch { /* da igual si no se puede borrar */ } }
  }
}

function extraerDeRuta(rutaXlsx, nombreHoja) {
  // El zip se abre una sola vez y de ahi salen todas las lecturas de abajo.
  const zip = abrirZip(rutaXlsx);
  const leerDelZip = (_ruta, entrada) => zip.leer(entrada);
  const entradas = zip.listar();

  // 1. Que numero de hoja es la que nos interesa.
  const wbXml = leerDelZip(rutaXlsx, 'xl/workbook.xml').toString('utf8');
  const wbRels = leerRelaciones(leerDelZip(rutaXlsx, 'xl/_rels/workbook.xml.rels').toString('utf8'));
  const hoja = new RegExp(`<sheet[^>]*name="${nombreHoja}"[^>]*r:id="([^"]+)"`).exec(wbXml)
    || new RegExp(`<sheet[^>]*r:id="([^"]+)"[^>]*name="${nombreHoja}"`).exec(wbXml);
  if (!hoja) throw new Error(`no se encontro la hoja "${nombreHoja}"`);
  const rutaHoja = `xl/${wbRels[hoja[1]].replace(/^\/?xl\//, '')}`;

  // 2. Que dibujo usa esa hoja.
  const relsHoja = `${path.dirname(rutaHoja)}/_rels/${path.basename(rutaHoja)}.rels`;
  const bufRelsHoja = leerDelZip(rutaXlsx, relsHoja);
  if (!bufRelsHoja) return [];
  const relacionesHoja = leerRelaciones(bufRelsHoja.toString('utf8'));
  const hojaXml = leerDelZip(rutaXlsx, rutaHoja).toString('utf8');
  const refDibujo = /<drawing[^>]*r:id="([^"]+)"/.exec(hojaXml);
  if (!refDibujo) return [];
  const rutaDibujo = path.posix.normalize(path.posix.join(path.dirname(rutaHoja), relacionesHoja[refDibujo[1]]));

  // 3. Anclas + a que archivo de media apunta cada una.
  const anclas = leerAnclas(leerDelZip(rutaXlsx, rutaDibujo).toString('utf8'));
  const relsDibujo = leerRelaciones(
    leerDelZip(rutaXlsx, `${path.dirname(rutaDibujo)}/_rels/${path.basename(rutaDibujo)}.rels`).toString('utf8'),
  );

  const fotos = [];
  for (const ancla of anclas) {
    const destino = relsDibujo[ancla.rId];
    if (!destino) continue;
    const entrada = path.posix.normalize(path.posix.join(path.dirname(rutaDibujo), destino));
    if (!entradas.includes(entrada)) continue;
    const buffer = leerDelZip(rutaXlsx, entrada);
    if (!buffer || !buffer.length) continue;
    fotos.push({ row: ancla.row, col: ancla.col, buffer, ext: path.extname(entrada).slice(1) || 'png' });
  }
  return fotos.sort((a, b) => a.row - b.row);
}

/**
 * Deja una sola copia de cada foto. La misma imagen suele estar anclada varias
 * veces (una por talla de la misma referencia), asi que se agrupan por
 * contenido y se guardan todas las filas donde aparece.
 */
export async function agruparFotosUnicas(fotos) {
  const { createHash } = await import('node:crypto');
  const porHash = new Map();
  for (const foto of fotos) {
    const hash = createHash('md5').update(foto.buffer).digest('hex');
    if (!porHash.has(hash)) porHash.set(hash, { hash, buffer: foto.buffer, ext: foto.ext, rows: [] });
    porHash.get(hash).rows.push(foto.row);
  }
  return [...porHash.values()].sort((a, b) => Math.min(...a.rows) - Math.min(...b.rows));
}

/**
 * Asocia cada foto unica con la fila de datos que le corresponde.
 *
 * El ancla del dibujo no cae siempre exacto sobre su fila: la imagen flota
 * sobre la celda y segun el alto de la fila el ancla queda una fila mas arriba
 * o mas abajo. Por eso no se confia en un desplazamiento fijo, sino que se
 * mira a que clave (referencia) apuntan la mayoria de las anclas de esa foto.
 *
 * @param fotosUnicas  salida de agruparFotosUnicas()
 * @param clavePorFila array donde clavePorFila[i] es la referencia de la fila i
 *                     de datos (mismo orden que las filas pegadas en el admin)
 * @param desplazamientos desplazamientos a probar entre fila de dibujo y fila de datos
 * @returns Map clave -> { buffer, ext, hash }
 */
export function asociarFotosAFilas(fotosUnicas, clavePorFila, desplazamientos = [-1, -2, 0]) {
  const porClave = new Map();

  // Las referencias, en el orden en que aparecen en el excel.
  const clavesEnOrden = [];
  for (const clave of clavePorFila) {
    if (clave != null && !clavesEnOrden.includes(clave)) clavesEnOrden.push(clave);
  }

  // Caso normal: hay una foto por referencia. Como las dos listas van en el
  // mismo orden, se emparejan en orden y listo.
  //
  // Es mas fiable que mirar en que fila cae cada ancla. En un pedido corto las
  // anclas se amontonan (en el PEDIDO6 dos caian en la misma fila y dos
  // referencias quedaban sin foto), porque la imagen flota sobre la celda y su
  // posicion depende del alto de cada fila.
  if (fotosUnicas.length === clavesEnOrden.length) {
    fotosUnicas.forEach((foto, i) => {
      porClave.set(clavesEnOrden[i], { buffer: foto.buffer, ext: foto.ext, hash: foto.hash });
    });
    return porClave;
  }

  // Si no cuadran las cuentas (falta alguna foto, o sobra), se cae a mirar
  // donde esta anclada cada una. Una referencia ya emparejada no se pisa.
  for (const foto of fotosUnicas) {
    const votos = new Map();
    for (const row of foto.rows) {
      for (const desp of desplazamientos) {
        const clave = clavePorFila[row + desp];
        if (clave == null || porClave.has(clave)) continue;
        // El primer desplazamiento de la lista es el mas probable, asi que
        // pesa mas. Los otros solo desempatan.
        const peso = desp === desplazamientos[0] ? 2 : 1;
        votos.set(clave, (votos.get(clave) || 0) + peso);
      }
    }
    if (!votos.size) continue;
    const ganadora = [...votos.entries()].sort((a, b) => b[1] - a[1])[0][0];
    porClave.set(ganadora, { buffer: foto.buffer, ext: foto.ext, hash: foto.hash });
  }
  return porClave;
}

/** Guarda las fotos en una carpeta, una por fila. Util para revisarlas a ojo. */
export function guardarFotos(fotos, carpeta) {
  fs.mkdirSync(carpeta, { recursive: true });
  return fotos.map((f) => {
    const destino = path.join(carpeta, `fila${String(f.row + 1).padStart(3, '0')}.${f.ext}`);
    fs.writeFileSync(destino, f.buffer);
    return destino;
  });
}

// Comparacion tolerante: en Windows la url trae file:///C:/... y argv[1] trae
// C:\... , asi que se normalizan ambos antes de comparar.
const rutaEsteArchivo = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(rutaEsteArchivo)) {
  const ruta = process.argv[2];
  if (!ruta) { console.error('uso: node scripts/lib/excel-photos.mjs <archivo.xlsx> [carpeta]'); process.exit(1); }
  const fotos = extraerFotosDeExcel(ruta);
  console.log(`${fotos.length} fotos encontradas`);
  fotos.forEach((f) => console.log(`  fila ${f.row + 1} (col ${f.col})  ${(f.buffer.length / 1024).toFixed(0)} KB`));
  const carpeta = process.argv[3] || path.join(os.tmpdir(), 'fotos-excel');
  guardarFotos(fotos, carpeta);
  console.log(`\nguardadas en ${carpeta}`);
}
