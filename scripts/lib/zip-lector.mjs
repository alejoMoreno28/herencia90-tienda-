/**
 * scripts/lib/zip-lector.mjs
 *
 * Lector de zip minimo, en JavaScript puro.
 *
 * Antes se llamaba al comando `unzip` del sistema. En Windows ese comando NO
 * existe: solo aparece si se abre una consola de Git Bash, asi que el cargador
 * arrancado desde CARGAR-PEDIDO.bat moria con "spawnSync unzip ENOENT" apenas
 * se soltaba el excel. Un .xlsx es un zip normal y solo hay que sacarle unos
 * pocos archivos, asi que se lee aqui y se acaba la dependencia externa.
 */
'use strict';

import fs from 'node:fs';
import zlib from 'node:zlib';

const FIRMA_FIN_CENTRAL = 0x06054b50;
const FIRMA_ENTRADA_CENTRAL = 0x02014b50;

/**
 * El directorio central esta al final del archivo, despues de un comentario de
 * largo variable, asi que se busca su firma hacia atras.
 */
function buscarFinCentral(buf) {
  const minimo = Math.max(0, buf.length - 66 * 1024);
  for (let i = buf.length - 22; i >= minimo; i--) {
    if (buf.readUInt32LE(i) === FIRMA_FIN_CENTRAL) return i;
  }
  return -1;
}

/** Devuelve Map nombre -> { offset, metodo, tamComprimido } */
function leerDirectorio(buf) {
  const fin = buscarFinCentral(buf);
  if (fin < 0) throw new Error('el archivo no parece un .xlsx valido (no se encontro el indice del zip)');

  let cursor = buf.readUInt32LE(fin + 16);
  const total = buf.readUInt16LE(fin + 10);
  const entradas = new Map();

  for (let i = 0; i < total; i++) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== FIRMA_ENTRADA_CENTRAL) break;
    const metodo = buf.readUInt16LE(cursor + 10);
    const tamComprimido = buf.readUInt32LE(cursor + 20);
    const largoNombre = buf.readUInt16LE(cursor + 28);
    const largoExtra = buf.readUInt16LE(cursor + 30);
    const largoComentario = buf.readUInt16LE(cursor + 32);
    const offsetLocal = buf.readUInt32LE(cursor + 42);
    const nombre = buf.toString('utf8', cursor + 46, cursor + 46 + largoNombre);
    entradas.set(nombre, { offset: offsetLocal, metodo, tamComprimido });
    cursor += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

/**
 * Abre el zip una sola vez y deja leer varias entradas. El excel se consulta
 * media docena de veces seguidas (hoja, dibujo, relaciones, cada imagen) y no
 * tiene sentido volver a parsear el indice cada vez.
 */
export function abrirZip(ruta) {
  const buf = fs.readFileSync(ruta);
  const entradas = leerDirectorio(buf);

  return {
    /** Nombres de todo lo que hay dentro. */
    listar() {
      return [...entradas.keys()];
    },

    /** Contenido de una entrada, o null si no esta. */
    leer(nombre) {
      const entrada = entradas.get(nombre);
      if (!entrada) return null;

      // El nombre y los extras del encabezado local pueden medir distinto que
      // los del directorio central, asi que se releen de aqui.
      const base = entrada.offset;
      const largoNombre = buf.readUInt16LE(base + 26);
      const largoExtra = buf.readUInt16LE(base + 28);
      const inicio = base + 30 + largoNombre + largoExtra;
      const crudo = buf.subarray(inicio, inicio + entrada.tamComprimido);

      if (entrada.metodo === 0) return Buffer.from(crudo);        // guardado tal cual
      if (entrada.metodo === 8) return zlib.inflateRawSync(crudo); // deflate, lo normal
      throw new Error(`compresion no soportada (${entrada.metodo}) en ${nombre}`);
    },
  };
}
