/**
 * scripts/descripciones-catalogo.mjs
 *
 * Reemplaza por texto de venta las descripciones automaticas que quedaron
 * publicadas en la tienda.
 *
 * Las que puso el cargador eran de uso interno ("Referencia lista para
 * catalogo Herencia 90 con fotos de proveedor o carga manual aprobada"), y eso
 * lo estaba leyendo el cliente en la ficha del producto. Se escriben a mano
 * siguiendo el estilo de las que ya estaban en el catalogo: que camiseta es,
 * de que color, el detalle que la hace especial, y el dorsal que trae impreso
 * cuando aplica, que es justo lo que busca quien compra retro.
 *
 * El texto va con tildes y eñes, como el resto del catalogo. La base guarda
 * UTF-8 sin problema.
 *
 * Uso: node --env-file=.env scripts/descripciones-catalogo.mjs [--aplicar]
 */
'use strict';

import { api } from './lib/lote-carga.mjs';

const TEXTOS = {
  28: {
    equipo: 'Camiseta Retro Brasil Local 2004',
    descripcion: 'Camiseta retro local de Brasil 2004 en el clásico amarillo con detalles en verde. '
      + 'Llega estampada con el dorsal de Ronaldinho #10, en plena época de su mejor fútbol con la selección.',
  },
  65: {
    descripcion: 'Camiseta retro visitante del AC Milan temporada 2006/07 en color blanco, con el escudo rossonero '
      + 'y el patrocinador Bwin. Manga corta, de la temporada en que el Milan volvió a levantar la Champions.',
  },
  66: {
    descripcion: 'Camiseta retro del Liverpool 1995/96 en verde y blanco a cuadros, uno de los diseños más recordados '
      + 'y distintos de los noventa. Manga corta, para quien busca una pieza que no se ve en todas partes.',
  },
  67: {
    descripcion: 'Camiseta retro de Francia 1998 en azul, la del Mundial que se ganó en casa. '
      + 'Llega estampada con el dorsal de Zidane #10, el hombre de la final. Manga corta.',
  },
  68: {
    descripcion: 'Camiseta retro de Brasil 1998 en el amarillo de siempre, la del Mundial de Francia. '
      + 'Llega estampada con el dorsal de Ronaldo #9, en el torneo que lo consagró como el mejor del mundo. Manga corta.',
  },
  69: {
    descripcion: 'Camiseta retro local de Argentina 2006 con las franjas celestes y blancas. '
      + 'Llega estampada con el dorsal de Messi #19, el número que usó en su primer Mundial. Manga corta.',
  },
  70: {
    descripcion: 'Camiseta retro local del Manchester United 2007/08 en rojo, la temporada en que el equipo ganó '
      + 'la Premier y la Champions. Manga larga y estampada con el dorsal de Cristiano Ronaldo #7.',
  },
  71: {
    descripcion: 'Camiseta retro local del FC Barcelona 2008/09, versión de la final de Champions, con las franjas '
      + 'azulgranas y el escudo de UNICEF. Llega estampada con el dorsal de Messi #10, del año del sextete. Manga corta.',
  },
  72: {
    descripcion: 'Camiseta retro local del FC Barcelona 2005/06, versión de la final de Champions ganada en París. '
      + 'Manga larga y estampada con el dorsal de Ronaldinho #10, en su mejor momento como blaugrana.',
  },
  73: {
    descripcion: 'Camiseta retro local del Santos 2012/13 en blanco con detalles negros. Llega estampada con el dorsal '
      + 'de Neymar Jr. #11, de sus últimos años en Brasil antes de dar el salto a Europa. Manga corta.',
  },
  74: {
    descripcion: 'Camiseta retro local del Real Madrid 2011/12 en blanco con detalles dorados y el patrocinador Bwin, '
      + 'la temporada del récord de 100 puntos en Liga. Llega estampada con el dorsal de Cristiano Ronaldo #7. Manga corta.',
  },
  75: {
    descripcion: 'Camiseta local del FC Barcelona temporada 2026/27, versión Fan, con las franjas azulgranas de siempre. '
      + 'Corte cómodo y tela transpirable para el día a día o para el partido. Manga corta.',
  },
  76: {
    descripcion: 'Camiseta del Real Madrid temporada 2026/27 en rosa, una de las alternativas más llamativas del año. '
      + 'Versión Fan de corte cómodo y tela transpirable. Manga corta.',
  },
  77: {
    descripcion: 'Camiseta local del Manchester United temporada 2026/27 en el rojo tradicional de Old Trafford. '
      + 'Versión Fan de corte cómodo y tela transpirable. Manga corta.',
  },
  78: {
    descripcion: 'Camiseta local de la selección de Corea del Sur, versión Player: corte más ajustado y tela más ligera, '
      + 'la misma línea que usan los jugadores en cancha. Manga corta.',
  },
  79: {
    descripcion: 'Camiseta local del Manchester City temporada 2026/27 en celeste, con el escudo del club. '
      + 'Versión Fan de corte cómodo y tela transpirable. Manga corta.',
  },

  // Cargas anteriores (pedido 4). Tenian el mismo texto interno publicado.
  52: {
    descripcion: 'Camiseta visitante de la Selección Colombia 2026 en azul, versión mujer. '
      + 'Corte femenino, cómodo y con tela transpirable. Manga corta.',
  },
  53: {
    equipo: 'Camiseta España 2026 Visitante Mujer',
    descripcion: 'Camiseta visitante de la Selección de España 2026, versión mujer. '
      + 'Corte femenino, cómodo y con tela transpirable. Manga corta.',
  },
  54: {
    equipo: 'Camiseta Portugal Local 2026',
    descripcion: 'Camiseta local de la Selección de Portugal 2026 en el rojo tradicional. '
      + 'Corte cómodo y tela transpirable. Manga corta.',
  },
  55: {
    descripcion: 'Camiseta visitante de la Selección de Brasil 2026 en azul, la alternativa al clásico amarillo. '
      + 'Corte cómodo y tela transpirable. Manga corta.',
  },
  56: {
    descripcion: 'Camiseta local de la Selección de Francia 2026 en azul. '
      + 'Corte cómodo y tela transpirable. Manga corta.',
  },
  58: {
    descripcion: 'Camiseta retro local del Manchester United 2007/08 en rojo, la temporada del doblete de Premier '
      + 'y Champions. Manga larga.',
  },
  59: {
    descripcion: 'Camiseta local del FC Barcelona temporada 2026/27 con las franjas azulgranas de siempre. '
      + 'Versión Fan de corte cómodo y tela transpirable. Manga corta.',
  },
  60: {
    equipo: 'Camiseta Real Madrid 26/27 Local',
    descripcion: 'Camiseta local del Real Madrid temporada 2026/27 en el blanco de siempre. '
      + 'Versión Fan de corte cómodo y tela transpirable. Manga corta.',
  },
  61: {
    descripcion: 'Camiseta local del Arsenal temporada 2026/27 en rojo con mangas blancas. '
      + 'Versión Fan de corte cómodo y tela transpirable. Manga corta.',
  },
  63: {
    equipo: 'Camiseta Real Madrid 26/27 Local Versión Player',
    descripcion: 'Camiseta local del Real Madrid temporada 2026/27, versión Player: corte más ajustado y tela más '
      + 'ligera, la misma línea que usan los jugadores en cancha. Manga corta.',
  },
  64: {
    descripcion: 'Camiseta blanca de la edición 100 años, versión Player para mujer: corte más ajustado y tela más '
      + 'ligera. Manga corta.',
  },
  // El id 57 ("Camiseta Real Madrid Lfstlr") queda por fuera a proposito: ese
  // titulo no se entiende y hay que preguntar que camiseta es antes de
  // escribirle una descripcion.
};

const aplicar = process.argv.includes('--aplicar');

async function main() {
  const ids = Object.keys(TEXTOS).join(',');
  const productos = await api(`productos?select=id,equipo,descripcion&id=in.(${ids})&order=id.asc`);

  for (const producto of productos) {
    const nuevo = TEXTOS[producto.id];
    const cambios = {};
    if (nuevo.equipo && nuevo.equipo !== producto.equipo) cambios.equipo = nuevo.equipo;
    if (nuevo.descripcion !== producto.descripcion) cambios.descripcion = nuevo.descripcion;
    if (!Object.keys(cambios).length) { console.log(`id ${producto.id}: ya estaba bien`); continue; }

    console.log(`\nid ${producto.id} — ${producto.equipo}`);
    if (cambios.equipo) console.log(`  titulo:  "${producto.equipo}"  ->  "${cambios.equipo}"`);
    console.log(`  ahora:  ${cambios.descripcion}`);

    if (aplicar) {
      await api(`productos?id=eq.${producto.id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
      console.log('  guardado');
    }
  }

  console.log(aplicar ? '\nListo.' : '\nSimulacion. Para guardarlo: agregar --aplicar');
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
