/**
 * scripts/cargar-lote.mjs
 *
 * Carga un pedido al catalogo desde la consola. Es la misma carga que hace la
 * pantalla (CARGAR-PEDIDO.bat), util para depurar o para correr solo este paso.
 *
 * Todo el trabajo lo hace scripts/lib/lote-carga.mjs. Aqui no hay ninguna copia
 * de esa logica a proposito: antes si la habia, y se habia quedado atras. Esa
 * version vieja no llevaba registro de lo ya cargado, asi que correr este
 * script despues de haber cargado por la pantalla habria duplicado el
 * inventario sin avisar. Una sola implementacion, una sola proteccion.
 *
 * Uso:
 *   node --env-file=.env scripts/cargar-lote.mjs _p5_match.json --lote PEDIDO6 --trm 3350
 *   node --env-file=.env scripts/cargar-lote.mjs _p5_match.json --lote PEDIDO6 --trm 3350 --confirmar
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  cargarLote, resumirCarga, aplicarDecisiones, resumenEstado, sumarTallas, api,
} from './lib/lote-carga.mjs';

const CARPETA_ESTADO = path.join(process.cwd(), 'lotes-cargados');

const rutaJson = process.argv[2];
const confirmar = process.argv.includes('--confirmar');
if (!rutaJson) {
  console.error('uso: node --env-file=.env scripts/cargar-lote.mjs <match.json> --lote NOMBRE --trm 3350 [--confirmar]');
  process.exit(1);
}

function opcion(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > -1 ? process.argv[i + 1] : null;
}

/**
 * Decisiones manuales. El sistema no las adivina a proposito: confundir dos
 * camisetas parecidas mezclaria el stock de ambas.
 *
 *   --existente "real madrid 26 27=60"   la referencia va al producto 60
 *   --nueva     "real madrid 26 27 rosa" se crea aparte
 *   --album     "camiseta ...=2"         usa el 2do candidato para las fotos
 *   --cliente   "korea 26 27=Juan"       cliente de una fila de preventa
 */
function leerDecisiones(argv) {
  const decisiones = {};
  const poner = (clave, campo, valor) => {
    const k = clave.trim().toLowerCase();
    decisiones[k] = { ...(decisiones[k] || {}), [campo]: valor };
  };
  argv.forEach((arg, i) => {
    const valor = String(argv[i + 1] || '');
    const [clave, resto] = valor.split('=');
    if (arg === '--existente' && clave && resto) poner(clave, 'prodId', parseInt(resto, 10));
    if (arg === '--nueva' && valor) poner(valor, 'prodId', null);
    if (arg === '--album' && clave && resto) poner(clave, 'albumIndex', parseInt(resto, 10) - 1);
    if (arg === '--cliente' && clave && resto) poner(clave, 'cliente', resto);
  });
  return decisiones;
}

async function main() {
  const referenciasCrudas = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
  const decisiones = leerDecisiones(process.argv);

  // El id del lote sale del contenido del excel, igual que en la pantalla, para
  // que las dos vias compartan el mismo registro de lo ya cargado.
  const excel = opcion('excel');
  const idLote = excel
    ? createHash('md5').update(fs.readFileSync(excel)).digest('hex').slice(0, 12)
    : createHash('md5').update(fs.readFileSync(rutaJson)).digest('hex').slice(0, 12);

  const basics = {
    loteNombre: opcion('lote') || path.basename(rutaJson).replace(/\.json$/i, ''),
    trm: parseFloat(opcion('trm')) || 0,
  };

  const referencias = aplicarDecisiones(referenciasCrudas, decisiones)
    .map((ref) => ({ ...ref, cliente: (decisiones[ref.clave] || {}).cliente || ref.cliente || '' }));

  const previo = resumenEstado(CARPETA_ESTADO, idLote);
  const resumen = resumirCarga(referencias);

  console.log(`lote: ${basics.loteNombre}  |  TRM: ${basics.trm || '(falta)'}  |  id: ${idLote}`);
  console.log(`${referencias.length} referencias | ${resumen.nuevos} nuevas | ${resumen.existentes} ya existen`);
  console.log(`${resumen.unidadesStock} unidades a stock | ${resumen.unidadesPreventa} ya encargadas`);
  console.log(`gasto de la compra: US$${resumen.costoUsd}`);
  if (previo.total) console.log(`\nAVISO: de este lote ya hay ${previo.total} referencia(s) cargadas. Esas se saltan.`);
  if (resumen.preventaSinCliente) {
    console.log(`AVISO: ${resumen.preventaSinCliente} unidad(es) de preventa quedan como "Pendiente por Asignar".`);
  }

  if (!confirmar) {
    console.log('\nSIMULACION (no se escribe nada):\n');
    for (const ref of referencias) {
      if (ref.prodIdExistente) {
        const actual = await api(`productos?id=eq.${ref.prodIdExistente}&select=equipo,tallas`);
        console.log(`  SUMAR  ${actual[0]?.equipo} (id ${ref.prodIdExistente})`);
        console.log(`         ${JSON.stringify(actual[0]?.tallas)}  ->  ${JSON.stringify(sumarTallas(actual[0]?.tallas, ref.filas))}`);
      } else {
        console.log(`  CREAR  ${ref.titulo}`);
        console.log(`         stock ${JSON.stringify(sumarTallas(null, ref.filas))} | fotos de: ${ref.ranking?.[0]?.title || '(sin album)'}`);
      }
    }
    console.log('\nPara hacerlo de verdad: agregar --confirmar');
    return;
  }

  const resultado = await cargarLote(referencias, {
    carpetaEstado: CARPETA_ESTADO,
    idLote,
    basics,
    alAvanzar: (paso) => console.log(`  ${paso.tipo.padEnd(9)} ${paso.titulo}`),
  });

  console.log('');
  resultado.creados.forEach((c) => console.log(`CREADO   id ${c.prodId}  ${c.titulo}  ${JSON.stringify(c.tallas)}  ${c.fotos} fotos  [${c.fichaFuente}]`));
  resultado.sumados.forEach((c) => console.log(`SUMADO   id ${c.prodId}  ${c.titulo}  ${JSON.stringify(c.tallas)}`));
  resultado.preventa.forEach((c) => console.log(`PEDIDOS  ${c.unidades} und  ${c.titulo}  (${c.cliente})`));
  resultado.saltados.forEach((c) => console.log(`SALTADO  ${c.titulo}  (${c.motivo})`));
  if (resultado.gasto) console.log(`GASTO    $${resultado.gasto.montoAgregado.toLocaleString('es-CO')} registrado`);
  console.log('\nListo. No se toco ninguna venta, cobro ni saldo.');
}

main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
