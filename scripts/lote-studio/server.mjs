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
  traerProductos, cargarLote, resumirCarga, aplicarDecisiones,
  leerEstado, resumenEstado, sumarTallas,
} from '../lib/lote-carga.mjs';
import { downloadYupooPhoto } from '../lib/yupoo-search.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
const CARPETA_ESTADO = path.join(RAIZ, '.codex_tmp', 'lote-studio');

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
      candidatosDuplicados: ref.candidatosDuplicados || [],
      decision: ref.decision,
      error: ref.error || null,
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
    lote.referencias = prepararReferencias(lote.buffer, productos);
    lote.progreso = { hechas: 0, total: lote.referencias.length, actual: null };

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

  return router;
}

export { CARPETA_ESTADO };
