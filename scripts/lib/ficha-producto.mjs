/**
 * scripts/lib/ficha-producto.mjs
 *
 * Escribe el titulo y la descripcion con que sale un producto nuevo a la
 * tienda, a partir de la fila del excel y de la foto que se va a publicar.
 *
 * ── El reparto de responsabilidades es la parte importante ──
 *
 * Los DATOS (equipo, temporada, local/visitante, manga, dorsal impreso) salen
 * del excel y del titulo del album del proveedor. Son datos verificables y no
 * se negocian.
 *
 * La REDACCION la hace un modelo mirando la foto, y solo puede hablar de lo que
 * se ve: colores, patrocinador, escudos, parches. Tiene prohibido inventar
 * temporadas, campeonatos o historias.
 *
 * Esto es a proposito. Un modelo tiene fecha de corte de conocimiento y puede
 * afirmar con toda seguridad que una camiseta de la temporada en curso "no
 * existe" o es de otro año. El excel y el proveedor, en cambio, son datos del
 * presente. Ya paso una vez: se cambio el titulo de la Argentina 2026 visitante
 * porque el parche de campeon 2022 hizo pensar que era de otra temporada,
 * cuando Argentina justamente lo lleva por ser la campeona defensora.
 *
 * Si el modelo no esta disponible o devuelve algo raro, se cae al texto
 * generado por reglas, que es mas seco pero nunca se inventa nada.
 */
'use strict';

const MODELO = 'gemini-flash-latest';

/** Traduce lo que dice el titulo del album del proveedor, que es dato fresco. */
function pistasDelProveedor(tituloAlbum) {
  const t = String(tituloAlbum || '');
  const pistas = [];
  if (/主场/.test(t)) pistas.push('es la equipacion LOCAL');
  if (/客场/.test(t) && !/二客/.test(t)) pistas.push('es la equipacion VISITANTE');
  if (/二客/.test(t)) pistas.push('es la SEGUNDA equipacion visitante');
  if (/门将|守门员/.test(t)) pistas.push('es camiseta de ARQUERO');
  if (/欧冠/.test(t)) pistas.push('es la version de CHAMPIONS LEAGUE, con sus parches');
  if (/联赛/.test(t)) pistas.push('es la version de LIGA');
  if (/长袖/.test(t)) pistas.push('es de MANGA LARGA');
  if (/女装|女款/.test(t)) pistas.push('es version MUJER');
  if (/童装|儿童/.test(t)) pistas.push('es version NIÑO');
  return pistas;
}

function versionLegible(tipo) {
  const t = String(tipo || '').trim().toUpperCase();
  if (t === 'RETRO') return 'retro';
  if (t === 'PLAYER') return 'Player (corte ajustado, tela ligera, la que usan los jugadores)';
  return 'Fan (corte comodo, tela transpirable)';
}

function construirInstruccion(datos) {
  const pistas = pistasDelProveedor(datos.tituloAlbum);
  return [
    'Eres quien escribe las fichas de producto de Herencia 90, una tienda colombiana de camisetas de futbol importadas.',
    'Te doy los DATOS VERIFICADOS de una camiseta y su FOTO. Escribe el titulo y la descripcion para la tienda.',
    '',
    'DATOS VERIFICADOS (no los contradigas nunca, aunque creas otra cosa):',
    `- Como viene escrita en el pedido: "${datos.descripcionExcel}"`,
    `- Version: ${versionLegible(datos.tipo)}`,
    `- Manga: ${datos.manga}`,
    datos.dorsal ? `- Viene estampada con el dorsal de ${datos.dorsal}` : null,
    pistas.length ? `- Segun el proveedor: ${pistas.join('; ')}` : null,
    '',
    'REGLAS:',
    '1. De la FOTO puedes describir lo que se ve: colores, patrocinador, escudos, parches, detalles del diseño.',
    '2. NO inventes datos que no puedas ver ni esten arriba. Nada de campeonatos ganados, records,',
    '   jugadores, ni "la temporada en que...", salvo que sea una camiseta retro claramente antigua',
    '   y el dato sea historia conocida y segura.',
    '3. NUNCA cambies la temporada ni si es local o visitante. Eso ya viene dado y es correcto,',
    '   aunque la camiseta te parezca de otro año. Puede ser mas reciente de lo que conoces.',
    '4. Si algo no se ve claro en la foto, simplemente no lo menciones. Nunca supongas.',
    '5. Español de Colombia, con tildes. Tono de tienda: claro y directo, sin exagerar.',
    '',
    'TITULO: empieza por "Camiseta", luego el equipo completo, la temporada y si es local/visitante.',
    'Maximo 70 caracteres. Sin comillas ni emojis.',
    '',
    'DESCRIPCION: de 2 a 3 frases, entre 150 y 320 caracteres. Menciona el color y el detalle',
    'que hace especial a la camiseta. Si trae dorsal impreso, dilo, que es lo que mas preguntan.',
    'Cierra diciendo la version y la manga.',
    '',
    'Responde SOLO este JSON: {"titulo": "...", "descripcion": "..."}',
  ].filter(Boolean).join('\n');
}

/**
 * Revisa que lo que devolvio el modelo sirva para publicar. Ante cualquier
 * duda se rechaza y se usa el texto por reglas: es preferible una ficha seca a
 * una ficha inventada.
 */
export function validarFicha(ficha, datos) {
  const titulo = String(ficha?.titulo || '').trim();
  const descripcion = String(ficha?.descripcion || '').trim();
  const problemas = [];

  if (!/^camiseta\b/i.test(titulo)) problemas.push('el titulo no empieza por "Camiseta"');
  if (titulo.length < 12 || titulo.length > 90) problemas.push(`titulo de ${titulo.length} caracteres`);
  if (descripcion.length < 90 || descripcion.length > 600) problemas.push(`descripcion de ${descripcion.length} caracteres`);
  if (/[�]/.test(titulo + descripcion)) problemas.push('trae caracteres corruptos');
  if (/[<>{}]|https?:\/\//.test(titulo + descripcion)) problemas.push('trae codigo o enlaces');

  // El equipo del excel tiene que seguir estando: si el modelo lo cambio por
  // otro, se equivoco de camiseta.
  //
  // Se comparan solo las palabras que identifican la camiseta. Sin quitar las
  // genericas, un titulo que dice "Camiseta Retro Barcelona" pasaba como valido
  // para un pedido de Real Madrid, porque compartian "camiseta" y "retro".
  const GENERICAS = new Set([
    'camiseta', 'camisa', 'jersey', 'retro', 'local', 'visitante', 'tercera', 'version',
    'player', 'fan', 'manga', 'larga', 'corta', 'edicion', 'especial', 'kit', 'mundial',
    'temporada', 'final', 'champions', 'league', 'dorsal', 'personalizacion', 'talla',
    'blanca', 'blanco', 'negra', 'negro', 'azul', 'roja', 'rojo', 'verde', 'amarilla',
    'amarillo', 'rosa', 'gris', 'dorada', 'dorado', 'celeste', 'morada', 'morado',
  ]);
  const normal = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const distintivas = normal(datos.descripcionExcel)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length > 2 && !GENERICAS.has(p) && !/^\d+$/.test(p));
  const enTitulo = normal(titulo);
  if (distintivas.length && !distintivas.some((p) => enTitulo.includes(p))) {
    problemas.push('el titulo habla de otra camiseta, no de la del pedido');
  }

  // La temporada del pedido no se puede cambiar.
  const temporadaExcel = String(datos.descripcionExcel).match(/\b(19|20)\d{2}\b|\b\d{2}[\s/-]\d{2}\b/);
  if (temporadaExcel) {
    const años = temporadaExcel[0].match(/\d{2}/g) || [];
    const ultimos = años[años.length - 1];
    if (ultimos && !titulo.includes(ultimos)) problemas.push('el titulo cambio la temporada');
  }

  // "Retro" y "Player" en el titulo no son adorno: la gente busca por ahi y
  // ademas es lo que separa una version de otra en el catalogo.
  const tipo = String(datos.tipo || '').trim().toUpperCase();
  if (tipo === 'RETRO' && !/\bretro\b/i.test(titulo)) problemas.push('el titulo no dice que es retro');
  if (tipo === 'PLAYER' && !/\bplayer\b/i.test(titulo)) problemas.push('el titulo no dice que es version Player');

  return { ok: problemas.length === 0, problemas, titulo, descripcion };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// 429 es cuota agotada por minuto y 503 es el modelo saturado. Las dos se
// pasan solas esperando un poco, y en un pedido de 19 referencias salen a cada
// rato. Sin reintentos, media tienda quedaria con el texto seco por reglas.
const REINTENTABLES = new Set([429, 500, 503, 504]);

async function pedirleAlModelo(datos, apiKey, { intentos = 4 } = {}) {
  const partes = [{ text: construirInstruccion(datos) }];
  if (datos.fotoBase64) {
    partes.push({ inline_data: { mime_type: datos.fotoMime || 'image/jpeg', data: datos.fotoBase64 } });
  }
  const cuerpo = JSON.stringify({
    contents: [{ parts: partes }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  });

  let ultimoError = null;
  for (let intento = 1; intento <= intentos; intento += 1) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo },
      );
    } catch (err) {
      ultimoError = new Error(`sin conexion (${err.message})`);
      if (intento < intentos) { await esperar(2000 * intento); continue; }
      throw ultimoError;
    }

    if (res.ok) {
      const data = await res.json();
      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!texto) throw new Error('Gemini no devolvio texto');
      return JSON.parse(texto.replace(/```json|```/g, '').trim());
    }

    ultimoError = new Error(`Gemini respondio ${res.status}`);
    if (!REINTENTABLES.has(res.status) || intento === intentos) {
      throw new Error(`${ultimoError.message}: ${(await res.text()).slice(0, 160)}`);
    }
    // Espera creciente: 3s, 9s, 27s. Da tiempo a que se libere la cuota.
    await esperar(3000 * (3 ** (intento - 1)));
  }
  throw ultimoError;
}

/**
 * Devuelve { titulo, descripcion, fuente, aviso }.
 *
 * `fuente` dice de donde salio: 'modelo' o 'reglas'. Nunca lanza excepcion:
 * si algo falla, cae al texto por reglas y lo explica en `aviso`, para que la
 * carga no se detenga por no poder escribir bonito.
 */
export async function redactarFicha(datos, { apiKey, porReglas } = {}) {
  const respaldo = {
    titulo: datos.tituloPorReglas,
    descripcion: porReglas,
    fuente: 'reglas',
  };
  if (!apiKey) return { ...respaldo, aviso: 'sin GEMINI_API_KEY, se uso el texto automatico' };

  try {
    const ficha = await pedirleAlModelo(datos, apiKey);
    const revision = validarFicha(ficha, datos);
    if (!revision.ok) {
      return { ...respaldo, aviso: `texto del modelo descartado (${revision.problemas.join(', ')})` };
    }
    return { titulo: revision.titulo, descripcion: revision.descripcion, fuente: 'modelo' };
  } catch (err) {
    return { ...respaldo, aviso: `no se pudo redactar con el modelo (${err.message})` };
  }
}
