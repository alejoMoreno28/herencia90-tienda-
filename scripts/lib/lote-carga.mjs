/**
 * scripts/lib/lote-carga.mjs
 *
 * Nucleo de la carga de un lote al catalogo. Lo usan tanto el cargador de
 * linea de comandos como la pantalla del cargador, para que los dos hagan
 * exactamente lo mismo y las protecciones no dependan de por donde se entre.
 *
 * Hace lo mismo que el admin al guardar un lote y NADA mas:
 *   1. crea un producto por cada referencia nueva
 *   2. le SUMA a las tallas las unidades de cada fila del excel
 *
 * No escribe en `transacciones` ni en `pedidos`.
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

export function sumarTallas(tallasActuales, filas) {
  const tallas = { S: 0, M: 0, L: 0, XL: 0, ...(tallasActuales || {}) };
  for (const fila of filas) {
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

/**
 * Las filas de PREVENTA generan pedidos y movimientos de plata. Esta carga no
 * las toca a proposito: van por el admin, que es quien sabe registrar el
 * anticipo y el cliente.
 */
export function referenciasConPreventa(referencias) {
  return referencias.filter((ref) => ref.filas.some((f) => String(f.destino || '').toUpperCase() === 'PREVENTA'));
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
  return {
    nuevos: nuevos.length,
    existentes: existentes.length,
    unidades: unidadesDe(referencias),
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

/**
 * Escribe el lote en el catalogo.
 *
 * @param referencias   ya con las decisiones aplicadas
 * @param opciones.carpetaEstado  donde anotar lo que ya se hizo
 * @param opciones.idLote         identifica este lote entre corridas
 * @param opciones.maxFotos       cuantas fotos publicar por producto
 * @param opciones.alAvanzar      callback(paso) para mostrar progreso
 */
export async function cargarLote(referencias, opciones = {}) {
  const { carpetaEstado, idLote, maxFotos = 6, alAvanzar = () => {} } = opciones;
  if (!carpetaEstado || !idLote) throw new Error('faltan carpetaEstado e idLote');

  const conPreventa = referenciasConPreventa(referencias);
  if (conPreventa.length) {
    throw new Error(
      `hay filas de PREVENTA (${conPreventa.map((r) => r.titulo).join(', ')}). `
      + 'Esas generan pedidos y movimientos de plata: van por el admin.',
    );
  }

  const estado = leerEstado(carpetaEstado, idLote);
  const resultado = { sumados: [], creados: [], saltados: [] };

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

  // 1. Sumar stock a las que ya existen.
  for (const ref of referencias.filter((r) => r.prodIdExistente)) {
    if (yaSeAplico(ref)) continue;
    alAvanzar({ tipo: 'sumando', titulo: ref.titulo });
    const actual = await api(`productos?id=eq.${ref.prodIdExistente}&select=tallas,equipo`);
    const tallas = sumarTallas(actual[0]?.tallas, ref.filas);
    await api(`productos?id=eq.${ref.prodIdExistente}`, { method: 'PATCH', body: JSON.stringify({ tallas }) });

    anotar(ref, 'sumada', ref.prodIdExistente);
    resultado.sumados.push({ titulo: actual[0]?.equipo || ref.titulo, prodId: ref.prodIdExistente, tallas });
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

    anotar(ref, 'creada', creado[0].id);
    resultado.creados.push({
      titulo: producto.equipo,
      prodId: creado[0].id,
      tallas: producto.tallas,
      fotos: imagenes.length,
      avisoFotos,
    });
  }

  return resultado;
}
