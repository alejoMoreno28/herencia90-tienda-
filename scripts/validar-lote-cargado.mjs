/**
 * scripts/validar-lote-cargado.mjs
 *
 * Revisa que un pedido ya cargado haya quedado bien en la pagina: unidades y
 * tallas iguales al excel, y productos con titulo, descripcion, categoria,
 * precio y fotos en el mismo formato que los que ya estaban.
 *
 * Uso: node --env-file=.env scripts/validar-lote-cargado.mjs "PEDIDO5HERENCIA 90.xlsx"
 */
'use strict';

import XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { traerProductos, sumarTallas, leerEstado } from './lib/lote-carga.mjs';
import { claveDeReferencia } from './lib/lote-analisis.mjs';

const archivo = process.argv[2];
if (!archivo) { console.error('falta el excel'); process.exit(1); }

const problemas = [];
const avisos = [];
const marca = (lista, texto) => lista.push(texto);

function filasDelExcel(ruta) {
  const rows = XLSX.utils.sheet_to_json(XLSX.readFile(ruta).Sheets.ORDER, { header: 1, blankrows: false });
  return rows.slice(2).filter((r) => r[1] && r[3]).map((r) => ({
    talla: String(r[1]).trim().toUpperCase(),
    descripcion: String(r[3]),
    cantidad: parseInt(r[6], 10) || 0,
    destino: String(r[11] || 'STOCK').trim().toUpperCase(),
  }));
}

/** Como se ve una foto valida del catalogo: webp servido desde el storage. */
function revisarFotos(producto, referencia) {
  const fotos = producto.imagenes || [];
  if (!fotos.length) { marca(problemas, `${referencia}: sin ninguna foto`); return; }
  if (fotos.length < 3) marca(avisos, `${referencia}: solo ${fotos.length} foto(s), el album del proveedor no tenia mas`);
  const noWebp = fotos.filter((f) => !/\.webp($|\?)/i.test(f));
  if (noWebp.length) marca(problemas, `${referencia}: ${noWebp.length} foto(s) no son .webp (el catalogo las mostraria rotas)`);
  const fuera = fotos.filter((f) => !f.includes('/storage/v1/object/public/product-images/'));
  if (fuera.length) marca(problemas, `${referencia}: ${fuera.length} foto(s) fuera del storage del catalogo`);
}

async function fotosAccesibles(producto, referencia) {
  for (const url of (producto.imagenes || []).slice(0, 3)) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) { marca(problemas, `${referencia}: una foto responde ${res.status}`); return; }
      const tipo = res.headers.get('content-type') || '';
      if (!tipo.includes('webp')) marca(problemas, `${referencia}: una foto llega como ${tipo}, no webp`);
      const kb = Math.round((res.headers.get('content-length') || 0) / 1024);
      if (kb > 400) marca(avisos, `${referencia}: una foto pesa ${kb} KB, mas de lo normal`);
    } catch (err) {
      marca(problemas, `${referencia}: no se pudo abrir una foto (${err.message})`);
    }
  }
}

function revisarTexto(producto, referencia, categoriasConocidas, preciosConocidos) {
  const titulo = String(producto.equipo || '');
  if (!titulo.trim()) marca(problemas, `${referencia}: sin titulo`);
  if (!/^camiseta/i.test(titulo)) marca(avisos, `${referencia}: el titulo no empieza por "Camiseta"`);
  if (/\s{2,}|\s$/.test(titulo)) marca(avisos, `${referencia}: el titulo tiene espacios de mas ("${titulo}")`);
  if (/[�]/.test(titulo + producto.descripcion)) marca(problemas, `${referencia}: tiene caracteres corruptos`);

  const desc = String(producto.descripcion || '').trim();
  if (!desc) marca(problemas, `${referencia}: sin descripcion`);
  else if (desc.length < 40) marca(avisos, `${referencia}: descripcion muy corta (${desc.length} caracteres)`);

  if (!categoriasConocidas.has(producto.categoria)) {
    marca(problemas, `${referencia}: categoria "${producto.categoria}" no existe en el resto del catalogo`);
  }
  if (!(producto.precio > 0)) marca(problemas, `${referencia}: sin precio`);
  else if (!preciosConocidos.has(producto.precio)) {
    marca(avisos, `${referencia}: precio $${producto.precio.toLocaleString('es-CO')}, distinto a los que ya usas`);
  }
  if (!(producto.costo_usd > 0)) marca(avisos, `${referencia}: sin costo en USD, el margen no se puede calcular`);
}

async function main() {
  const filas = filasDelExcel(archivo);
  const productos = await traerProductos();
  const porId = new Map(productos.map((p) => [p.id, p]));

  // Referencias del excel, con sus tallas esperadas.
  const referencias = new Map();
  for (const fila of filas) {
    const clave = claveDeReferencia(fila.descripcion);
    if (!referencias.has(clave)) referencias.set(clave, { clave, descripcion: fila.descripcion, filas: [] });
    referencias.get(clave).filas.push(fila);
  }

  // Lo "normal" del catalogo se toma de los productos que ya estaban antes de
  // este pedido, para comparar contra ellos y no contra un ideal inventado.
  const anteriores = productos.filter((p) => p.id < 65);
  const categorias = new Set(anteriores.map((p) => p.categoria));
  const precios = new Set(anteriores.map((p) => p.precio));

  console.log(`${referencias.size} referencias en el excel, ${filas.length} filas\n`);

  // El enlace referencia -> producto sale del registro de la carga, que es
  // exacto. Emparejar por parecido de nombre daba falsos positivos: confundia
  // referencias distintas del mismo equipo y reportaba tallas que no eran.
  const idLote = createHash('md5').update(fs.readFileSync(archivo)).digest('hex').slice(0, 12);
  const aplicadas = leerEstado(path.join(process.cwd(), '.codex_tmp', 'lote-studio'), idLote).aplicadas;
  if (!Object.keys(aplicadas).length) {
    console.error('No hay registro de carga para este archivo, no se puede validar contra el excel.');
    process.exit(1);
  }

  for (const [clave, info] of Object.entries(aplicadas)) {
    const id = info.prodId;
    const producto = porId.get(id);
    if (!producto) { marca(problemas, `id ${id} (${clave}): el producto no existe`); continue; }
    const ref = referencias.get(clave);

    const nombre = `${producto.equipo} (id ${id})`;
    revisarTexto(producto, nombre, categorias, precios);
    revisarFotos(producto, nombre);
    await fotosAccesibles(producto, nombre);

    const esperado = ref ? sumarTallas(null, ref.filas.map((f) => ({ talla: f.talla, cantidad: f.cantidad, destino: f.destino }))) : null;
    const unidades = ref ? ref.filas.reduce((s, f) => s + f.cantidad, 0) : 0;
    const enCatalogo = Object.entries(producto.tallas || {})
      .filter(([, n]) => parseInt(n, 10) > 0).map(([t, n]) => `${t}:${n}`).join(' ') || 'sin stock';

    console.log(`id ${String(id).padEnd(3)} ${producto.equipo.slice(0, 56).padEnd(56)} ${String(producto.imagenes?.length || 0).padStart(2)} fotos  ${enCatalogo}`);
    if (!ref) { marca(problemas, `${nombre}: el registro apunta a "${clave}", que no esta en el excel`); continue; }

    console.log(`${' '.repeat(7)}excel: ${unidades} und ${JSON.stringify(esperado)}${info.accion === 'sumada' ? '  (sumadas a lo que ya tenia)' : ''}`);

    // Solo se puede exigir igualdad exacta en las que se CREARON: las que ya
    // existian traian stock de antes y aqui solo se les sumo.
    if (info.accion === 'creada') {
      const igual = ['S', 'M', 'L', 'XL'].every((t) => (parseInt(producto.tallas?.[t], 10) || 0) === (esperado[t] || 0));
      if (!igual) {
        marca(problemas, `${nombre}: el stock no coincide con el excel. `
          + `catalogo ${JSON.stringify(producto.tallas)} vs excel ${JSON.stringify(esperado)}`);
      }
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  if (problemas.length) {
    console.log(`\nPROBLEMAS (${problemas.length}):`);
    problemas.forEach((p) => console.log('  - ' + p));
  } else {
    console.log('\nSin problemas.');
  }
  if (avisos.length) {
    console.log(`\nPara mirar (${avisos.length}):`);
    avisos.forEach((a) => console.log('  - ' + a));
  }
}

main().catch((e) => { console.error('Error:', e); process.exit(1); });
