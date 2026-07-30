/**
 * scripts/lib/publicar.mjs
 *
 * Publica los cambios del catalogo en la pagina: regenera las paginas
 * estaticas y el sitemap desde la base, y los sube a GitHub, que es lo que
 * dispara el despliegue.
 *
 * Existe para no tener que abrir la consola cada vez. Los productos ya se ven
 * en la tienda apenas se guardan (la pagina lee de la base al cargar), pero
 * las paginas estaticas son las que ve Google, y esas hay que regenerarlas.
 */
'use strict';

import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function correr(comando, args, { timeout = 600000 } = {}) {
  return new Promise((resolver) => {
    execFile(comando, args, { cwd: RAIZ, timeout, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolver({
        ok: !error,
        salida: String(stdout || '').trim(),
        error: error ? String(stderr || error.message).trim() : '',
      });
    });
  });
}

const git = (...args) => correr('git', args);

/**
 * @param alAvanzar callback(paso, detalle) para ir contando en pantalla
 * @returns { ok, pasos: [...], mensaje }
 */
export async function publicarCatalogo({ alAvanzar = () => {} } = {}) {
  const pasos = [];
  const anotar = (nombre, ok, detalle) => {
    pasos.push({ nombre, ok, detalle });
    alAvanzar(nombre, detalle);
    return ok;
  };

  // 1. Regenerar las paginas desde la base.
  alAvanzar('Regenerando las páginas…');
  const generado = await correr(process.execPath, ['scripts/generate-product-pages.mjs']);
  if (!generado.ok) {
    anotar('Regenerar las páginas', false, generado.error.slice(0, 300));
    return { ok: false, pasos, mensaje: 'No se pudieron regenerar las páginas.' };
  }
  anotar('Regenerar las páginas', true, generado.salida.split('\n').pop());

  // 2. Traer lo que otros hayan subido, para no chocar al empujar. El sitemap
  // lo regenera este mismo paso, asi que si hay conflicto ahi se resuelve
  // quedandose con lo local y volviendo a generar.
  alAvanzar('Sincronizando con GitHub…');
  await git('fetch', 'origin', '--quiet');
  const mezcla = await git('-c', 'core.safecrlf=false', 'merge', 'origin/main', '--no-edit');
  if (!mezcla.ok) {
    await git('checkout', '--ours', 'web/sitemap.xml');
    await git('-c', 'core.safecrlf=false', 'add', 'web/sitemap.xml');
    const otra = await correr(process.execPath, ['scripts/generate-product-pages.mjs']);
    if (!otra.ok) {
      anotar('Sincronizar con GitHub', false, 'quedo un conflicto sin resolver');
      return { ok: false, pasos, mensaje: 'Hay un conflicto que toca resolver a mano.' };
    }
    await git('-c', 'core.safecrlf=false', 'add', 'web');
    await git('-c', 'core.safecrlf=false', 'commit', '--no-edit');
  }
  anotar('Sincronizar con GitHub', true, '');

  // 3. Guardar los cambios de las paginas.
  await git('-c', 'core.safecrlf=false', 'add', 'web');
  const pendientes = await git('diff', '--cached', '--name-only');
  const cuantos = pendientes.salida ? pendientes.salida.split('\n').filter(Boolean).length : 0;

  if (cuantos) {
    const fecha = new Date().toISOString().slice(0, 10);
    const commit = await git(
      '-c', 'core.safecrlf=false', 'commit', '-m',
      `Publica el catalogo (${fecha})\n\nPaginas estaticas y sitemap regenerados desde la base, para que los\ncambios del catalogo lleguen a Google.\n\nPublicado desde la pantalla del cargador.`,
    );
    if (!commit.ok) {
      anotar('Guardar los cambios', false, commit.error.slice(0, 300));
      return { ok: false, pasos, mensaje: 'No se pudieron guardar los cambios.' };
    }
    anotar('Guardar los cambios', true, `${cuantos} archivo(s)`);
  } else {
    anotar('Guardar los cambios', true, 'no habia nada nuevo que guardar');
  }

  // 4. Subir. Esto es lo que dispara el despliegue de la pagina.
  alAvanzar('Subiendo a GitHub…');
  const subida = await git('push', 'origin', 'main');
  if (!subida.ok) {
    anotar('Subir a GitHub', false, subida.error.slice(0, 300));
    return { ok: false, pasos, mensaje: 'No se pudo subir. Revisa la conexión.' };
  }
  anotar('Subir a GitHub', true, '');

  return {
    ok: true,
    pasos,
    mensaje: cuantos
      ? 'Publicado. La página se actualiza en un par de minutos.'
      : 'Ya estaba todo publicado, no había cambios pendientes.',
  };
}
