/**
 * scripts/lib/lote-carga.mjs
 *
 * Nucleo de la carga de un lote al catalogo. Lo usan tanto el cargador de
 * linea de comandos como la pantalla del cargador, para que los dos hagan
 * exactamente lo mismo y las protecciones no dependan de por donde se entre.
 *
 * Hace lo mismo que el admin al guardar un lote:
 *   1. crea un producto por cada referencia nueva
 *   2. suma al stock las unidades con destino STOCK
 *   3. crea un registro en `pedidos` por cada unidad de PREVENTA (una camiseta
 *      ya encargada por un cliente, que no cuenta como inventario disponible)
 *   4. registra en `transacciones` el gasto de lo que costo el lote
 *
 * Lo unico que NO hace es registrar cobros a clientes: los de preventa no
 * pagan al encargar, se les cobra al entregar, y ese ingreso se registra
 * despues desde el admin.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const ROBOT = process.env.ROBOT_URL || 'http://127.0.0.1:3001';

function credenciales() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env');
  return { url, key };
}

export async function api(ruta, opciones = {}) {
  const { url, key } = credenciales();
  const res = await fetch(`${url}/rest/v1/${ruta}`, {
    ...opciones,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opciones.headers || {}),
    },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`${ruta}: ${res.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

/** Todos los productos del catalogo, para detectar referencias repetidas. */
export async function traerProductos() {
  const salida = [];
  for (let desde = 0; ; desde += 1000) {
    const filas = await api(`productos?select=*&order=id.asc&offset=${desde}&limit=1000`);
    salida.push(...filas);
    if (filas.length < 1000) return salida;
  }
}

/**
 * Suma al stock SOLO las filas con destino STOCK. Las de preventa ya estan
 * vendidas a un cliente: no son inventario disponible, viven en `pedidos`.
 * Es el mismo criterio que usa el admin.
 */
export function sumarTallas(tallasActuales, filas) {
  const tallas = { S: 0, M: 0, L: 0, XL: 0, ...(tallasActuales || {}) };
  for (const fila of filas.filter(esStock)) {
    const talla = String(fila.talla || '').trim().toUpperCase();
    if (!talla) continue;
    tallas[talla] = (parseInt(tallas[talla], 10) || 0) + (parseInt(fila.cantidad, 10) || 0);
  }
  return tallas;
}

export function unidadesDe(referencias) {
  return referencias.reduce(
    (total, ref) => total + ref.filas.reduce((s, f) => s + (parseInt(f.cantidad, 10) || 0), 0),
    0,
  );
}

export const esPreventa = (fila) => String(fila.destino || '').toUpperCase() === 'PREVENTA';
export const esStock = (fila) => !esPreventa(fila);

/**
 * Una referencia puede traer filas de los dos tipos: en un mismo pedido suele
 * haber unidades para stock y otras ya encargadas por un cliente.
 */
export function referenciasConPreventa(referencias) {
  return referencias.filter((ref) => ref.filas.some(esPreventa));
}

export function unidadesPorDestino(referencias) {
  let stock = 0;
  let preventa = 0;
  for (const ref of referencias) {
    for (const fila of ref.filas) {
      const cantidad = parseInt(fila.cantidad, 10) || 0;
      if (esPreventa(fila)) preventa += cantidad; else stock += cantidad;
    }
  }
  return { stock, preventa, total: stock + preventa };
}

/** Costo total en USD de las referencias dadas, para el gasto de la compra. */
export function costoUsdDe(referencias) {
  return referencias.reduce(
    (total, ref) => total + ref.filas.reduce(
      (s, f) => s + ((parseFloat(ref.costoUsd) || 0) * (parseInt(f.cantidad, 10) || 0)), 0,
    ),
    0,
  );
}

/**
 * Aplica las decisiones del usuario sobre cada referencia. `decisiones` es
 * { clave: { prodId, albumIndex } }: a que producto del catalogo va (o null si
 * es nueva) y de que album del proveedor salen las fotos.
 */
export function aplicarDecisiones(referencias, decisiones = {}) {
  return referencias.map((ref) => {
    const decision = decisiones[ref.clave] || {};
    const copia = { ...ref };
    if ('prodId' in decision) copia.prodIdExistente = decision.prodId || null;
    if (decision.albumIndex != null && ref.ranking?.[decision.albumIndex]) {
      const elegido = ref.ranking[decision.albumIndex];
      copia.ranking = [elegido, ...ref.ranking.filter((c) => c !== elegido)];
    }
    return copia;
  });
}

export function resumirCarga(referencias) {
  const nuevos = referencias.filter((r) => !r.prodIdExistente);
  const existentes = referencias.filter((r) => r.prodIdExistente);
  const unidades = unidadesPorDestino(referencias);
  return {
    nuevos: nuevos.length,
    existentes: existentes.length,
    unidades: unidades.total,
    unidadesStock: unidades.stock,
    unidadesPreventa: unidades.preventa,
    costoUsd: Math.round(costoUsdDe(referencias) * 100) / 100,
    // Cuantos clientes quedarian sin nombre, para poder avisarlo antes.
    preventaSinCliente: referencias
      .filter((r) => r.filas.some(esPreventa) && !String(r.cliente || '').trim())
      .reduce((s, r) => s + r.filas.filter(esPreventa).reduce((n, f) => n + (parseInt(f.cantidad, 10) || 0), 0), 0),
    detalleNuevos: nuevos.map((r) => ({ titulo: r.titulo, tallas: sumarTallas(null, r.filas) })),
    detalleExistentes: existentes.map((r) => ({ titulo: r.titulo, prodId: r.prodIdExistente })),
  };
}

// ── Estado, para poder retomar una carga que fallo a mitad ────────────────
//
// Sumar stock NO es repetible: hacerlo dos veces duplica las unidades. Por eso
// cada referencia que se termina de aplicar se anota en disco apenas ocurre, y
// al retomar se salta.
//
// La anotacion es UNA POR REFERENCIA, no una por tipo de operacion, y se
// consulta ANTES de decidir si toca crear o sumar. Es a proposito: la primera
// vez una referencia se crea, pero en una segunda corrida esa misma referencia
// ya existe en el catalogo y por lo tanto cae en la rama de sumar stock. Con
// listas separadas de "creados" y "sumados", la anotacion de creado no la
// protegia en la segunda vuelta y se le sumaba el stock encima. Duplicaba el
// inventario justamente cuando la persona reintentaba por precaucion.

function rutaEstado(carpetaEstado, idLote) {
  return path.join(carpetaEstado, `${idLote}.json`);
}

export function leerEstado(carpetaEstado, idLote) {
  try {
    const guardado = JSON.parse(fs.readFileSync(rutaEstado(carpetaEstado, idLote), 'utf8'));
    return { aplicadas: guardado.aplicadas || {} };
  } catch {
    return { aplicadas: {} };
  }
}

/** Cuantas referencias de este lote ya se escribieron en el catalogo. */
export function resumenEstado(carpetaEstado, idLote) {
  const aplicadas = Object.values(leerEstado(carpetaEstado, idLote).aplicadas);
  return {
    total: aplicadas.length,
    creadas: aplicadas.filter((a) => a.accion === 'creada').length,
    sumadas: aplicadas.filter((a) => a.accion === 'sumada').length,
  };
}

function guardarEstado(carpetaEstado, idLote, estado) {
  fs.mkdirSync(carpetaEstado, { recursive: true });
  fs.writeFileSync(rutaEstado(carpetaEstado, idLote), JSON.stringify(estado, null, 1));
}

async function procesarFotos(referencia, maxFotos) {
  const ganador = referencia.ranking?.[0];
  if (!ganador?.photoUrls?.length) return [];
  const res = await fetch(`${ROBOT}/api/process-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      store: ganador.store,
      photoUrls: ganador.photoUrls.slice(0, maxFotos),
      slugHint: referencia.titulo,
    }),
  });
  if (!res.ok) throw new Error(`process-photo: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.images || [])
    .map((img) => (typeof img === 'string' ? img : img.url || img.publicUrl || ''))
    .filter(Boolean);
}

// Misma categoria que usa el usuario cuando registra la compra a mano.
const CATEGORIA_COMPRA = 'Compra Inventario';

/**
 * Filas de preventa de una referencia, convertidas en registros de `pedidos`:
 * uno por unidad, igual que hace el admin.
 *
 * El cliente no paga nada al encargar, se le cobra cuando recibe la camiseta,
 * asi que nacen en Pendiente con abono en cero. El pago se registra despues
 * desde el admin, que es donde se lleva el detalle de cada cliente.
 */
function pedidosDePreventa(referencia, prodId, equipo, basics) {
  const pedidos = [];
  const costoUsd = parseFloat(referencia.costoUsd) || 0;
  for (const fila of referencia.filas.filter(esPreventa)) {
    const cantidad = parseInt(fila.cantidad, 10) || 0;
    for (let i = 0; i < cantidad; i++) {
      pedidos.push({
        cliente: String(referencia.cliente || '').trim() || 'Pendiente por Asignar',
        canal: referencia.canal || 'Amigos/Confianza',
        producto_id: prodId,
        equipo,
        talla: fila.talla,
        cantidad: 1,
        precio_venta: referencia.precio || 99000,
        costo_usd: costoUsd,
        costo_landed_cop: costoUsd * basics.trm,
        trm: basics.trm,
        estado_pago: 'Pendiente',
        abono: 0,
        estado_entrega: 'Pendiente',
        lote_codigo: basics.loteNombre,
        fecha_pedido: new Date().toISOString().split('T')[0],
      });
    }
  }
  return pedidos;
}

/**
 * Registra en finanzas lo que costo el lote, como hace el admin: un gasto de
 * "Compra Inventario". Si ya existe uno de este mismo lote le suma, en vez de
 * crear otro, para que cargar el pedido en varias tandas no lo parta en
 * muchos gastos sueltos.
 *
 * Solo se le pasa el costo de lo que se ESCRIBIO en esta corrida. Lo que se
 * salto por estar ya cargado no vuelve a sumar, asi que reintentar no infla
 * el gasto.
 */
async function registrarGastoDeCompra(basics, totales) {
  if (!(totales.costoUsd > 0)) return null;
  const montoCop = Math.round(totales.costoUsd * basics.trm);
  const detalle = `${totales.total} und (${totales.stock} stock / ${totales.preventa} preventa)`;
  const descripcion = `[Compra Lote] ${basics.loteNombre} - ${detalle}`;

  const existentes = await api(
    `transacciones?select=id,monto,usd_amount,descripcion&tipo=eq.gasto`
    + `&categoria=eq.${encodeURIComponent(CATEGORIA_COMPRA)}`
    + `&descripcion=ilike.${encodeURIComponent(`[Compra Lote] ${basics.loteNombre}%`)}`
    + '&order=id.asc&limit=1',
  );

  if (existentes.length) {
    const previo = existentes[0];
    await api(`transacciones?id=eq.${previo.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        monto: (parseFloat(previo.monto) || 0) + montoCop,
        usd_amount: (parseFloat(previo.usd_amount) || 0) + totales.costoUsd,
      }),
    });
    return { id: previo.id, montoAgregado: montoCop, actualizado: true };
  }

  // La tabla de transacciones tampoco genera el id sola.
  const ultima = await api('transacciones?select=id&order=id.desc&limit=1');
  const creada = await api('transacciones', {
    method: 'POST',
    body: JSON.stringify({
      id: (ultima[0]?.id || 0) + 1,
      tipo: 'gasto',
      categoria: CATEGORIA_COMPRA,
      fecha: new Date().toISOString().split('T')[0],
      monto: montoCop,
      usd_amount: totales.costoUsd,
      trm: basics.trm,
      descripcion,
    }),
  });
  return { id: creada[0].id, montoAgregado: montoCop, actualizado: false };
}

/**
 * Escribe el lote: productos, stock, pedidos de preventa y el gasto de la
 * compra. No toca nada mas de finanzas; los cobros a clientes se registran
 * despues desde el admin.
 *
 * @param referencias   ya con las decisiones aplicadas
 * @param opciones.basics         { loteNombre, trm }
 * @param opciones.carpetaEstado  donde anotar lo que ya se hizo
 * @param opciones.idLote         identifica este lote entre corridas
 * @param opciones.maxFotos       cuantas fotos publicar por producto
 * @param opciones.alAvanzar      callback(paso) para mostrar progreso
 */
export async function cargarLote(referencias, opciones = {}) {
  const { carpetaEstado, idLote, basics, maxFotos = 6, alAvanzar = () => {} } = opciones;
  if (!carpetaEstado || !idLote) throw new Error('faltan carpetaEstado e idLote');
  if (!basics?.loteNombre) throw new Error('falta el nombre del lote');
  if (!(parseFloat(basics.trm) > 0)) throw new Error('falta la TRM de compra del lote');

  const estado = leerEstado(carpetaEstado, idLote);
  const resultado = { sumados: [], creados: [], preventa: [], saltados: [], gasto: null };
  // Solo lo escrito en ESTA corrida cuenta para el gasto.
  const aplicadasAhora = [];

  // Se pregunta por la referencia, no por la operacion: da igual si la vez
  // pasada se creo y esta vez tocaria sumar, si ya se aplico no se vuelve a
  // tocar.
  const yaSeAplico = (ref) => {
    const previo = estado.aplicadas[ref.clave];
    if (!previo) return false;
    resultado.saltados.push({
      titulo: ref.titulo,
      motivo: previo.accion === 'creada'
        ? `ya se habia creado en este mismo pedido (id ${previo.prodId})`
        : 'a este pedido ya se le habia sumado el stock',
    });
    alAvanzar({ tipo: 'saltado', titulo: ref.titulo });
    return true;
  };

  const anotar = (ref, accion, prodId) => {
    estado.aplicadas[ref.clave] = { accion, prodId, cuando: new Date().toISOString() };
    // Se guarda apenas se aplica, no al final: si el proceso muere aqui, al
    // retomar esta referencia ya queda protegida.
    guardarEstado(carpetaEstado, idLote, estado);
  };

  // Las filas de preventa de una referencia se guardan junto con ella, no
  // aparte: asi una referencia mixta (unas para stock y otras ya encargadas)
  // queda completa o no queda, y nunca a medias.
  const guardarPreventa = async (ref, prodId, equipo) => {
    const pedidos = pedidosDePreventa(ref, prodId, equipo, basics);
    if (!pedidos.length) return;
    await api('pedidos', { method: 'POST', body: JSON.stringify(pedidos) });
    resultado.preventa.push({
      titulo: equipo,
      unidades: pedidos.length,
      cliente: pedidos[0].cliente,
    });
  };

  // 1. Sumar stock a las que ya existen.
  for (const ref of referencias.filter((r) => r.prodIdExistente)) {
    if (yaSeAplico(ref)) continue;
    alAvanzar({ tipo: 'sumando', titulo: ref.titulo });
    const actual = await api(`productos?id=eq.${ref.prodIdExistente}&select=tallas,equipo`);
    const equipo = actual[0]?.equipo || ref.titulo;
    const tallas = sumarTallas(actual[0]?.tallas, ref.filas);

    // Solo se escribe si de verdad hay unidades para stock: una referencia
    // 100% preventa no debe tocar el inventario disponible.
    if (ref.filas.some(esStock)) {
      await api(`productos?id=eq.${ref.prodIdExistente}`, { method: 'PATCH', body: JSON.stringify({ tallas }) });
      resultado.sumados.push({ titulo: equipo, prodId: ref.prodIdExistente, tallas });
    }
    await guardarPreventa(ref, ref.prodIdExistente, equipo);

    anotar(ref, 'sumada', ref.prodIdExistente);
    aplicadasAhora.push(ref);
  }

  // 2. Crear las nuevas. La tabla no genera el id: lo asigna el admin tomando
  // el mayor que exista y sumando uno, y aqui se hace igual.
  const ultimo = await api('productos?select=id&order=id.desc&limit=1');
  let siguienteId = (ultimo[0]?.id || 0) + 1;

  for (const ref of referencias.filter((r) => !r.prodIdExistente)) {
    if (yaSeAplico(ref)) continue;
    alAvanzar({ tipo: 'creando', titulo: ref.titulo });

    let imagenes = [];
    let avisoFotos = null;
    try {
      imagenes = await procesarFotos(ref, maxFotos);
    } catch (err) {
      avisoFotos = err.message;
    }

    const producto = {
      id: siguienteId++,
      categoria: ref.categoria || 'Nueva Coleccion',
      equipo: ref.titulo,
      descripcion: ref.descripcionCatalogo || '',
      precio: ref.precio || 99000,
      costo_usd: ref.costoUsd || 0,
      tallas: sumarTallas(null, ref.filas),
      imagenes,
    };
    const creado = await api('productos', { method: 'POST', body: JSON.stringify(producto) });
    await guardarPreventa(ref, creado[0].id, producto.equipo);

    anotar(ref, 'creada', creado[0].id);
    aplicadasAhora.push(ref);
    resultado.creados.push({
      titulo: producto.equipo,
      prodId: creado[0].id,
      tallas: producto.tallas,
      fotos: imagenes.length,
      avisoFotos,
    });
  }

  // 3. El gasto de la compra, solo por lo que se escribio ahora.
  if (aplicadasAhora.length) {
    alAvanzar({ tipo: 'gasto', titulo: 'registrando la compra en finanzas' });
    const unidades = unidadesPorDestino(aplicadasAhora);
    resultado.gasto = await registrarGastoDeCompra(basics, {
      ...unidades,
      costoUsd: costoUsdDe(aplicadasAhora),
    });
  }

  return resultado;
}
