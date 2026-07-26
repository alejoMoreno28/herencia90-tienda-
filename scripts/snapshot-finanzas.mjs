/**
 * scripts/snapshot-finanzas.mjs
 *
 * Foto de los numeros del admin (ventas, saldos, inventario) en un momento dado.
 * Sirve para correrlo ANTES y DESPUES de cargar un lote y confirmar que lo unico
 * que cambio fue lo que se esperaba: productos nuevos y stock sumado. Cualquier
 * movimiento en transacciones o pedidos que no se haya pedido salta a la vista.
 *
 * Uso:
 *   node --env-file=.env scripts/snapshot-finanzas.mjs            imprime la foto
 *   node --env-file=.env scripts/snapshot-finanzas.mjs antes.json guarda la foto
 *   node --env-file=.env scripts/snapshot-finanzas.mjs antes.json --comparar
 */
'use strict';

import fs from 'node:fs';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

async function traer(tabla) {
  const salida = [];
  for (let desde = 0; ; desde += 1000) {
    const res = await fetch(`${URL_BASE}/rest/v1/${tabla}?select=*&order=id.asc&offset=${desde}&limit=1000`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!res.ok) throw new Error(`${tabla}: ${res.status} ${await res.text()}`);
    const filas = await res.json();
    salida.push(...filas);
    if (filas.length < 1000) return salida;
  }
}

function sumar(filas, campo) {
  return filas.reduce((total, fila) => total + (Number(fila[campo]) || 0), 0);
}

async function tomarFoto() {
  const [productos, pedidos, transacciones] = await Promise.all([
    traer('productos'), traer('pedidos'), traer('transacciones'),
  ]);

  const unidadesEnStock = productos.reduce((total, p) => {
    const tallas = p.tallas || {};
    return total + Object.values(tallas).reduce((s, n) => s + (parseInt(n, 10) || 0), 0);
  }, 0);

  const porTipo = {};
  transacciones.forEach((t) => {
    const tipo = t.tipo || 'sin-tipo';
    porTipo[tipo] = porTipo[tipo] || { cantidad: 0, monto: 0 };
    porTipo[tipo].cantidad += 1;
    porTipo[tipo].monto += Number(t.monto) || 0;
  });

  return {
    productos: productos.length,
    unidadesEnStock,
    pedidos: pedidos.length,
    pedidosAbonado: sumar(pedidos, 'abono'),
    transacciones: transacciones.length,
    transaccionesPorTipo: porTipo,
    montoTotalTransacciones: sumar(transacciones, 'monto'),
  };
}

function aplanar(foto, prefijo = '') {
  const salida = {};
  Object.entries(foto).forEach(([clave, valor]) => {
    const nombre = prefijo ? `${prefijo}.${clave}` : clave;
    if (valor && typeof valor === 'object') Object.assign(salida, aplanar(valor, nombre));
    else salida[nombre] = valor;
  });
  return salida;
}

const archivo = process.argv[2];
const comparar = process.argv.includes('--comparar');
const foto = await tomarFoto();

if (comparar) {
  if (!archivo || !fs.existsSync(archivo)) {
    console.error('Falta el archivo de la foto anterior.');
    process.exit(1);
  }
  const antes = aplanar(JSON.parse(fs.readFileSync(archivo, 'utf8')));
  const ahora = aplanar(foto);
  const claves = new Set([...Object.keys(antes), ...Object.keys(ahora)]);
  let cambios = 0;
  for (const clave of [...claves].sort()) {
    const a = antes[clave] ?? 0;
    const b = ahora[clave] ?? 0;
    if (a === b) continue;
    cambios += 1;
    const delta = typeof a === 'number' && typeof b === 'number' ? ` (${b - a >= 0 ? '+' : ''}${b - a})` : '';
    console.log(`CAMBIO  ${clave.padEnd(40)} ${a}  ->  ${b}${delta}`);
  }
  console.log(cambios ? `\n${cambios} valores cambiaron.` : '\nNada cambio.');
} else {
  console.log(JSON.stringify(foto, null, 2));
  if (archivo) {
    fs.writeFileSync(archivo, JSON.stringify(foto, null, 2));
    console.log(`\nGuardado en ${archivo}`);
  }
}
