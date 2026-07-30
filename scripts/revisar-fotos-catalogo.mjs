/**
 * scripts/revisar-fotos-catalogo.mjs
 *
 * Busca fotos del catalogo a las que el quitador de fondos les comio la
 * prenda.
 *
 * Pasa con los primeros planos: cuando la tela llena todo el encuadre no hay
 * fondo que quitar, el modelo se confunde y recorta la camiseta dejando
 * flotando solo el escudo o el logo. En la Barcelona 08/09 quedo publicado el
 * swoosh de Nike y la palabra UNICEF sobre el vacio.
 *
 * Se detecta midiendo que proporcion de la imagen quedo opaca. Medido sobre el
 * catalogo real: una foto sana deja entre 0.40 y 0.60, y una rota baja de 0.15.
 *
 * No borra ni cambia nada: solo dice cuales revisar.
 *
 * Uso:
 *   node --env-file=.env scripts/revisar-fotos-catalogo.mjs
 *   node --env-file=.env scripts/revisar-fotos-catalogo.mjs --todas   (mira todas las fotos, no solo la principal)
 */
'use strict';

import sharp from 'sharp';
import { traerProductos } from './lib/lote-carga.mjs';

// Por debajo de esto la foto no muestra la prenda completa: quedo el logo
// suelto, o un recorte tan cerrado que no se entiende que es.
const SOSPECHOSA = 0.18;
// Entre este valor y el anterior no esta rota, pero se ve pobre.
const JUSTITA = 0.28;

const todas = process.argv.includes('--todas');

async function proporcionOpaca(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opacos = 0;
  for (let i = 3; i < data.length; i += info.channels) if (data[i] > 127) opacos += 1;
  return opacos / (info.width * info.height);
}

async function main() {
  const productos = await traerProductos();
  const rotos = [];
  const flojos = [];
  let revisadas = 0;

  for (const producto of productos) {
    const fotos = todas ? (producto.imagenes || []) : (producto.imagenes || []).slice(0, 1);
    for (const [i, url] of fotos.entries()) {
      let ratio;
      try {
        ratio = await proporcionOpaca(url);
      } catch {
        continue;
      }
      revisadas += 1;
      if (ratio == null) continue;
      const dato = { id: producto.id, equipo: producto.equipo, foto: i + 1, ratio };
      if (ratio < SOSPECHOSA) rotos.push(dato);
      else if (ratio < JUSTITA) flojos.push(dato);
    }
    process.stdout.write(`\rrevisando… ${revisadas} fotos`);
  }

  console.log(`\r${revisadas} fotos revisadas de ${productos.length} productos\n`);

  if (rotos.length) {
    console.log(`ROTAS (${rotos.length}) — al quitar el fondo se comio la prenda:`);
    rotos.sort((a, b) => a.ratio - b.ratio).forEach((r) => {
      console.log(`  id ${String(r.id).padStart(3)}  foto ${r.foto}  queda ${(r.ratio * 100).toFixed(0)}%  ${r.equipo}`);
    });
    console.log('\nSe arreglan desde la pantalla del cargador, en "¿Una camiseta quedó');
    console.log('con las fotos equivocadas?": se busca el producto y se vuelve a elegir');
    console.log('el mismo album. Las fotos malas ahora se descartan solas.');
  } else {
    console.log('Ninguna foto rota.');
  }

  if (flojos.length) {
    console.log(`\nJUSTITAS (${flojos.length}) — no estan rotas pero la prenda se ve pequeña:`);
    flojos.sort((a, b) => a.ratio - b.ratio).forEach((r) => {
      console.log(`  id ${String(r.id).padStart(3)}  foto ${r.foto}  queda ${(r.ratio * 100).toFixed(0)}%  ${r.equipo}`);
    });
  }
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
