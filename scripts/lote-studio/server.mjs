/**
 * scripts/lote-studio/server.mjs
 *
 * Pantalla para cargar un pedido del proveedor al catalogo sin usar la
 * terminal: se suelta el excel, se revisa lo que encontro, y se carga.
 *
 * Va montada dentro del robot de fotos porque todo el trabajo pesado (comparar
 * con CLIP, quitar fondo con BiRefNet) corre en la GPU de este PC. Por eso esto
 * no puede vivir en la web publica ni en el admin.
 *
 * El estado de cada lote se guarda en disco para poder retomar una carga que
 * se corto a mitad sin volver a sumar stock.
 */
'use strict';

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepararReferencias, analizarReferencias } from '../lib/lote-analisis.mjs';
import {
  api, traerProductos, cargarLote, resumirCarga, aplicarDecisiones,
  leerEstado, resumenEstado, sumarTallas,
} from '../lib/lote-carga.mjs';
import { downloadYupooPhoto } from '../lib/yupoo-search.mjs';
import {
  prepararCatalogoVisual, buscarParecidosVisuales, combinarCandidatos, esElMismoSeguro,
} from '../lib/duplicados-visuales.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
// Va en el repo, no en una carpeta temporal: si este registro se pierde, volver
// a cargar un pedido duplicaria el inventario sin avisar. Estando en git queda
// respaldado. Ver lotes-cargados/LEEME.md.
const CARPETA_ESTADO = path.join(RAIZ, 'lotes-cargados');

// Los lotes viven en memoria mientras el robot este abierto. Lo que SI
// sobrevive a un reinicio es el archivo de estado con lo que ya se escribio
// en el catalogo, que es lo unico que no se puede rehacer sin hacer daño.
const lotes = new Map();

function idDelArchivo(buffer) {
  return createHash('md5').update(buffer).digest('hex').slice(0, 12);
}

/** Version del lote apta para mandar al navegador: sin buffers ni fotos. */
function loteParaLaPantalla(lote) {
  return {
    id: lote.id,
    nombreArchivo: lote.nombreArchivo,
    estado: lote.estado,
    progreso: lote.progreso,
    error: lote.error || null,
    resultado: lote.resultado || null,
    yaEscrito: lote.yaEscrito || null,
    referencias: (lote.referencias || []).map((ref, indice) => ({
      indice,
      clave: ref.clave,
      titulo: ref.titulo,
      descripcion: ref.descripcion,
      tipo: ref.tipo,
      categoria: ref.categoria,
      precio: ref.precio,
      costoUsd: ref.costoUsd,
      filas: ref.filas,
      unidades: ref.filas.reduce((s, f) => s + (parseInt(f.cantidad, 10) || 0), 0),
      tallasQueQuedarian: sumarTallas(null, ref.filas),
      tieneFotoExcel: !!ref.fotoExcel,
      cliente: ref.cliente || '',
      unidadesStock: ref.filas.filter((f) => String(f.destino || '').toUpperCase() !== 'PREVENTA')
        .reduce((s, f) => s + (parseInt(f.cantidad, 10) || 0), 0),
      unidadesPreventa: ref.filas.filter((f) => String(f.destino || '').toUpperCase() === 'PREVENTA')
        .reduce((s, f) => s + (parseInt(f.cantidad, 10) || 0), 0),
      yaAplicada: !!ref.yaAplicada,
      prodIdExistente: ref.prodIdExistente,
      candidatosDuplicados: (ref.candidatosDuplicados || []).map((c) => ({
        ...c, foto: lote.fotoDeProducto?.get(c.id) || null,
      })),
      enlazadaPorFoto: ref.enlazadaPorFoto || null,
      decision: ref.decision,
      error: ref.error || null,
      motivoSinResultados: ref.motivoSinResultados || null,
      queries: ref.queries || [],
      candidatos: (ref.ranking || []).map((c, i) => ({
        indice: i,
        titulo: c.title,
        score: c.score,
        yupooUrl: c.yupooUrl,
        fotos: Math.min((c.photoUrls || []).length, 3),
      })),
    })),
  };
}

async function correrAnalisis(lote) {
  try {
    lote.estado = 'leyendo';
    const productos = await traerProductos();
    lote.productos = productos;
    // La pantalla muestra la foto del producto del catalogo al lado de la del
    // excel, para que decidir si son la misma sea mirar y no leer nombres.
    lote.fotoDeProducto = new Map(productos.map((x) => [x.id, (x.imagenes || [])[0] || null]));
    lote.referencias = prepararReferencias(lote.buffer, productos);
    lote.progreso = { hechas: 0, total: lote.referencias.length, actual: null };

    // Antes de buscar en el proveedor, se mira si la camiseta ya esta en el
    // catalogo comparando fotos. Los nombres se escriben de mil formas; las
    // fotos no mienten.
    lote.estado = 'comparando';
    const catalogoVisual = await prepararCatalogoVisual(productos, {
      alAvanzar: ({ hechos, total }) => { lote.progreso = { hechas: hechos, total, actual: 'revisando el catalogo' }; },
    });

    let revisadas = 0;
    for (const ref of lote.referencias) {
      lote.progreso = { hechas: revisadas, total: lote.referencias.length, actual: ref.titulo };
      const porFoto = await buscarParecidosVisuales(ref.fotoExcel?.buffer?.toString('base64'), catalogoVisual);
      ref.candidatosDuplicados = combinarCandidatos(ref.candidatosDuplicados, porFoto);

      // Si la foto no deja duda, se enlaza sola y una decision menos que tomar.
      const seguro = esElMismoSeguro(ref.candidatosDuplicados, ref.titulo);
      if (seguro && !ref.prodIdExistente) {
        ref.prodIdExistente = seguro.id;
        ref.enlazadaPorFoto = seguro.score;
      }
      revisadas += 1;
    }

    lote.estado = 'buscando';
    await analizarReferencias(lote.referencias, {
      alAvanzar: (p) => { lote.progreso = p; },
    });

    // Si este mismo archivo ya se cargo antes, se avisa en la pantalla. Las
    // referencias ya aplicadas se saltan al cargar, pero la persona tiene que
    // enterarse igual: normalmente significa que no hace falta cargar nada.
    const previo = resumenEstado(CARPETA_ESTADO, lote.id);
    if (previo.total) lote.yaEscrito = previo;

    const aplicadas = leerEstado(CARPETA_ESTADO, lote.id).aplicadas;
    lote.referencias.forEach((ref) => { ref.yaAplicada = !!aplicadas[ref.clave]; });

    lote.estado = 'listo';
  } catch (err) {
    lote.estado = 'error';
    lote.error = err.message;
  }
}

/** Pega en cada referencia el nombre de cliente que se escribio en pantalla. */
function conClientes(referencias, decisiones = {}) {
  return referencias.map((ref) => ({ ...ref, cliente: (decisiones[ref.clave] || {}).cliente || '' }));
}

export function crearRouterLoteStudio() {
  const router = express.Router();

  router.use('/cargador', express.static(path.join(AQUI, 'app')));

  router.post('/api/lote/analizar', async (req, res) => {
    const { nombreArchivo, xlsxBase64 } = req.body || {};
    if (!xlsxBase64) return res.status(400).json({ error: 'falta el archivo' });

    const buffer = Buffer.from(xlsxBase64, 'base64');
    // El id sale del contenido: subir el mismo archivo otra vez cae en el mismo
    // lote y por lo tanto encuentra lo que ya se habia escrito.
    const id = idDelArchivo(buffer);

    const lote = {
      id,
      nombreArchivo: nombreArchivo || 'pedido.xlsx',
      buffer,
      estado: 'leyendo',
      progreso: { hechas: 0, total: 0, actual: null },
      referencias: [],
      cacheFotos: new Map(),
    };
    lotes.set(id, lote);
    correrAnalisis(lote);
    res.json({ id });
  });

  router.get('/api/lote/:id', (req, res) => {
    const lote = lotes.get(req.params.id);
    if (!lote) return res.status(404).json({ error: 'ese lote ya no esta en memoria; vuelve a subir el archivo' });
    res.json(loteParaLaPantalla(lote));
  });

  router.get('/api/lote/:id/foto-excel/:indice', (req, res) => {
    const lote = lotes.get(req.params.id);
    const ref = lote?.referencias?.[Number(req.params.indice)];
    if (!ref?.fotoExcel) return res.sendStatus(404);
    res.type(ref.fotoExcel.ext === 'jpg' ? 'image/jpeg' : `image/${ref.fotoExcel.ext}`);
    res.send(ref.fotoExcel.buffer);
  });

  router.get('/api/lote/:id/foto/:indice/:candidato/:foto', async (req, res) => {
    const lote = lotes.get(req.params.id);
    const ref = lote?.referencias?.[Number(req.params.indice)];
    const cand = ref?.ranking?.[Number(req.params.candidato)];
    const url = cand?.photoUrls?.[Number(req.params.foto)];
    if (!url) return res.sendStatus(404);

    // Las fotos del proveedor solo se sirven con el referer correcto, asi que
    // pasan por aqui. Se cachean para no volver a bajarlas al redibujar.
    if (lote.cacheFotos.has(url)) {
      res.type('image/jpeg');
      return res.send(lote.cacheFotos.get(url));
    }
    try {
      const buffer = await downloadYupooPhoto(url, cand.store);
      lote.cacheFotos.set(url, buffer);
      res.type('image/jpeg');
      res.send(buffer);
    } catch {
      res.sendStatus(502);
    }
  });

  router.post('/api/lote/:id/resumen', (req, res) => {
    const lote = lotes.get(req.params.id);
    if (!lote) return res.status(404).json({ error: 'lote no encontrado' });
    const todas = conClientes(aplicarDecisiones(lote.referencias, req.body?.decisiones || {}), req.body?.decisiones);
    // Las que ya se aplicaron no cuentan: el resumen debe decir lo que de
    // verdad va a pasar, no prometer trabajo que se va a saltar.
    const pendientes = todas.filter((r, i) => !lote.referencias[i].yaAplicada);
    res.json({
      ...resumirCarga(pendientes),
      yaAplicadas: todas.length - pendientes.length,
    });
  });

  router.post('/api/lote/:id/cargar', async (req, res) => {
    const lote = lotes.get(req.params.id);
    if (!lote) return res.status(404).json({ error: 'lote no encontrado' });
    if (lote.estado === 'cargando') return res.status(409).json({ error: 'ya se esta cargando' });

    const basics = {
      loteNombre: String(req.body?.loteNombre || '').trim(),
      trm: parseFloat(req.body?.trm) || 0,
    };
    if (!basics.loteNombre) return res.status(400).json({ error: 'falta el nombre del lote' });
    if (!(basics.trm > 0)) return res.status(400).json({ error: 'falta la TRM de compra' });

    const referencias = conClientes(aplicarDecisiones(lote.referencias, req.body?.decisiones || {}), req.body?.decisiones);
    lote.estado = 'cargando';
    lote.progreso = { hechas: 0, total: referencias.length, actual: null };
    res.json({ ok: true });

    let hechas = 0;
    try {
      lote.resultado = await cargarLote(referencias, {
        carpetaEstado: CARPETA_ESTADO,
        idLote: lote.id,
        basics,
        alAvanzar: (paso) => {
          lote.progreso = { hechas, total: referencias.length, actual: paso.titulo };
          if (paso.tipo !== 'saltado') hechas += 1;
        },
      });
      lote.estado = 'cargado';
    } catch (err) {
      lote.estado = 'error';
      lote.error = err.message;
    }
  });

  // ── Corregir las fotos de un producto que ya esta en la tienda ──────────
  //
  // Pasa: una camiseta queda con las fotos de otra parecida y uno se da cuenta
  // despues, viendola en la pagina. Sin esto tocaria rehacerla a mano.

  const buscadas = new Map();

  router.get('/api/producto/buscar', async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.json([]);
    const productos = await traerProductos();
    const normal = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    res.json(productos
      .filter((p) => normal(p.equipo).includes(normal(q)))
      .slice(0, 12)
      .map((p) => ({ id: p.id, equipo: p.equipo, categoria: p.categoria, fotos: (p.imagenes || []) })));
  });

  router.post('/api/producto/:id/buscar-fotos', async (req, res) => {
    const id = Number(req.params.id);
    const productos = await traerProductos();
    const producto = productos.find((p) => p.id === id);
    if (!producto) return res.status(404).json({ error: 'producto no encontrado' });

    // Sin foto de referencia: aqui la persona ya sabe cual quiere y elige
    // viendo. Puede afinar el texto desde la pantalla, porque el titulo del
    // catalogo no siempre es el mejor termino para buscar en el proveedor.
    const titulo = producto.equipo;
    const busqueda = String(req.body && req.body.busqueda || '').trim() || titulo;
    const tipo = /player/i.test(busqueda) ? 'PLAYER' : /retro/i.test(busqueda) ? 'RETRO' : 'FAN';
    try {
      const r = await fetch(`http://127.0.0.1:3001/api/match-provider-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tipo, description: busqueda, maxCandidates: 8 }),
      });
      const data = await r.json();
      buscadas.set(id, data.ranking || []);
      res.json({
        tipo,
        buscadoCon: busqueda,
        tiendas: (data.searchInfo?.storesSearched || []).map((s) => s.replace('https://', '').split('.')[0]),
        queries: data.searchInfo?.queries || [],
        candidatos: (data.ranking || []).map((c, i) => ({
          indice: i, titulo: c.title, yupooUrl: c.yupooUrl, fotos: Math.min((c.photoUrls || []).length, 3),
        })),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/api/producto/:id/foto/:cand/:foto', async (req, res) => {
    const cand = (buscadas.get(Number(req.params.id)) || [])[Number(req.params.cand)];
    const url = cand?.photoUrls?.[Number(req.params.foto)];
    if (!url) return res.sendStatus(404);
    try {
      res.type('image/jpeg').send(await downloadYupooPhoto(url, cand.store));
    } catch {
      res.sendStatus(502);
    }
  });

  router.post('/api/producto/:id/reemplazar-fotos', async (req, res) => {
    const id = Number(req.params.id);
    const cand = (buscadas.get(id) || [])[Number(req.body?.candidato)];
    if (!cand) return res.status(400).json({ error: 'primero hay que buscar las fotos' });

    const productos = await traerProductos();
    const producto = productos.find((p) => p.id === id);
    if (!producto) return res.status(404).json({ error: 'producto no encontrado' });

    try {
      const r = await fetch('http://127.0.0.1:3001/api/process-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Se mandan todas: process-photo descarta las que no se pueden
        // recortar y para cuando junte seis buenas.
        body: JSON.stringify({ store: cand.store, photoUrls: cand.photoUrls || [], maxFotos: 6, slugHint: producto.equipo }),
      });
      if (!r.ok) throw new Error(`process-photo: ${r.status}`);
      const data = await r.json();
      const imagenes = (data.images || [])
        .map((x) => (typeof x === 'string' ? x : x.url || x.publicUrl || '')).filter(Boolean);
      if (!imagenes.length) throw new Error('no se pudo procesar ninguna foto');

      // Las viejas no se borran: si la nueva eleccion tampoco era la correcta,
      // se puede volver atras desde el admin.
      await api(`productos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ imagenes }) });
      res.json({ ok: true, fotos: imagenes.length, album: cand.title, anteriores: (producto.imagenes || []).length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

export { CARPETA_ESTADO };
