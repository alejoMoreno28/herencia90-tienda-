/**
 * scripts/afinar-catalogo.mjs
 *
 * Corrige lo que quedo flojo en el catalogo despues de revisar las 72 fichas
 * contra sus fotos: titulos que no dicen que camiseta es, una descripcion
 * vacia, y productos que quedaron en la categoria comodin.
 *
 * Uso: node --env-file=.env scripts/afinar-catalogo.mjs [--aplicar]
 */
'use strict';

import { api } from './lib/lote-carga.mjs';

const CAMBIOS = {
  // "Lfstlr" era "lifestyle" abreviado. Mirando la foto es la Real Madrid x
  // Adidas Originals negra, con el trebol y el monograma. Nadie la encontraba
  // buscando, y seguia con la descripcion automatica vieja.
  57: {
    equipo: 'Camiseta Real Madrid Adidas Originals Negra',
    descripcion: 'Camiseta Real Madrid x Adidas Originals en negro, con el logo del trébol, las tres rayas '
      + 'en las mangas y un monograma tono sobre tono. Más de calle que de cancha, para llevarla a diario. Manga corta.',
  },
  // El titulo decia que era la visitante del Mundial 2026, pero la foto muestra
  // otra cosa: negra con motivos azules y el parche de campeon del mundo 2022.
  // Ademas era la unica ficha del catalogo sin descripcion.
  62: {
    equipo: 'Camiseta Argentina Edición Especial Negra Campeones 2022',
    descripcion: 'Camiseta edición especial de Argentina en negro con motivos azules, el escudo de la AFA '
      + 'con las tres estrellas y el parche de campeón del mundo 2022. Una pieza llamativa, distinta a las '
      + 'equipaciones de siempre. Manga corta.',
  },
  // El titulo no decia "Colombia", asi que no aparecia buscando la seleccion.
  // Es la version mujer de la conmemorativa de los 100 años (la de hombre es
  // otro producto).
  64: {
    equipo: 'Camiseta Colombia 100 Años Blanca Mujer Versión Player',
    categoria: "Women's Collection",
    descripcion: 'Camiseta conmemorativa de los 100 años de la Selección Colombia en blanco, con la franja '
      + 'tricolor al pecho y detalles dorados. Corte femenino en versión Player: más ajustado y con tela más '
      + 'ligera. Manga corta.',
  },
  // Quedaron en la categoria comodin porque el sistema no reconocia "Korea" ni
  // "City". Ya se arreglo el reconocimiento; estas dos hay que moverlas a mano.
  78: { categoria: 'Selecciones Nacionales' },
  79: { categoria: 'Equipos Europeos' },
  // Categoria de un solo producto. Es una retro y encaja con las demas.
  15: { categoria: 'Retro' },
  // La descripcion nunca decia Colombia, aunque el titulo si.
  46: {
    descripcion: 'Camiseta retro de la Selección Colombia por Adidas Originals, con el logo del trébol y las '
      + 'clásicas tres rayas en las mangas. Tejido suave que mezcla poliéster y algodón, y corte holgado '
      + 'cómodo para el día a día. Una pieza de estilo vintage, tanto para la tribuna como para la calle.',
  },
};

const aplicar = process.argv.includes('--aplicar');

const slug = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const ids = Object.keys(CAMBIOS).join(',');
  const productos = await api(`productos?select=id,equipo,categoria,descripcion&id=in.(${ids})&order=id.asc`);
  const redirecciones = [];

  for (const producto of productos) {
    const nuevo = CAMBIOS[producto.id];
    const cambios = {};
    for (const campo of ['equipo', 'categoria', 'descripcion']) {
      if (nuevo[campo] && nuevo[campo] !== producto[campo]) cambios[campo] = nuevo[campo];
    }
    if (!Object.keys(cambios).length) { console.log(`id ${producto.id}: ya estaba bien`); continue; }

    console.log(`\nid ${producto.id} — ${producto.equipo}`);
    if (cambios.equipo) {
      console.log(`  titulo:    ${producto.equipo}  ->  ${cambios.equipo}`);
      // Cambiar el titulo cambia la direccion de la pagina: hace falta
      // redirigir la vieja para no perder lo que Google ya tenia.
      const antes = slug(producto.equipo);
      const ahora = slug(cambios.equipo);
      if (antes !== ahora) redirecciones.push([antes, ahora]);
    }
    if (cambios.categoria) console.log(`  categoria: ${producto.categoria}  ->  ${cambios.categoria}`);
    if (cambios.descripcion) console.log(`  desc:      ${cambios.descripcion.slice(0, 90)}...`);

    if (aplicar) {
      await api(`productos?id=eq.${producto.id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
      console.log('  guardado');
    }
  }

  if (redirecciones.length) {
    console.log('\nRedirecciones que hay que agregar a vercel.json:');
    redirecciones.forEach(([a, b]) => console.log(`  /camisetas/${a}  ->  /camisetas/${b}`));
  }
  console.log(aplicar ? '\nListo.' : '\nSimulacion. Para guardarlo: agregar --aplicar');
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
