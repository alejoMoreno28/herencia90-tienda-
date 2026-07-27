/**
 * scripts/lib/duplicados-visuales.mjs
 *
 * Busca si una camiseta del pedido ya esta en el catalogo, comparando la foto
 * del excel contra las fotos de los productos que ya existen.
 *
 * Por que hace falta, si ya se comparan los nombres: porque los nombres fallan.
 * La Barcelona 26/27 entro repetida y con el stock partido en dos fichas
 * simplemente porque el excel escribe "26 27" y el catalogo "26/27". Ese caso
 * concreto ya se arreglo, pero la lista de formas de escribir mal el mismo
 * equipo no se acaba nunca: abreviaturas, erratas, ingles contra español.
 *
 * La foto no tiene ese problema. Dos fotos de la misma camiseta se parecen
 * aunque los nombres no se parezcan en nada.
 */
'use strict';

const PHOTO_SERVICE = process.env.PHOTO_SERVICE_URL || 'http://127.0.0.1:5055';

// Las fotos del catalogo no cambian entre analisis, asi que se guardan en
// memoria mientras el robot este abierto. Sin esto habria que bajar 70 fotos
// cada vez que se sube un pedido.
const cacheFotos = new Map();

async function fotoDelProducto(producto) {
  const url = (producto.imagenes || [])[0];
  if (!url) return null;
  if (cacheFotos.has(url)) return cacheFotos.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    cacheFotos.set(url, b64);
    return b64;
  } catch {
    return null;
  }
}

/**
 * Prepara las fotos del catalogo para comparar. Se llama una vez por analisis.
 * Devuelve [{ producto, fotoBase64 }].
 */
export async function prepararCatalogoVisual(productos, { alAvanzar = () => {} } = {}) {
  const listos = [];
  let hechos = 0;
  for (const producto of productos) {
    const fotoBase64 = await fotoDelProducto(producto);
    hechos += 1;
    alAvanzar({ hechos, total: productos.length });
    if (fotoBase64) listos.push({ producto, fotoBase64 });
  }
  return listos;
}

/**
 * Compara la foto del excel contra el catalogo y devuelve los productos que
 * mas se le parecen, de mayor a menor.
 *
 * @param umbral  por debajo de esto ni se menciona: son camisetas distintas y
 *                llenar la pantalla de parecidos flojos solo estorba.
 */
export async function buscarParecidosVisuales(fotoExcelBase64, catalogoVisual, { umbral = 0.75, maximo = 4 } = {}) {
  if (!fotoExcelBase64 || !catalogoVisual.length) return [];

  const groups = catalogoVisual.map(({ producto, fotoBase64 }) => ({
    label: `prod_${producto.id}`,
    photos_b64: [fotoBase64],
  }));

  let data;
  try {
    const res = await fetch(`${PHOTO_SERVICE}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference_b64: fotoExcelBase64, groups }),
    });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    // Sin comparacion visual el sistema sigue funcionando con los nombres.
    return [];
  }

  const porId = new Map(catalogoVisual.map(({ producto }) => [`prod_${producto.id}`, producto]));
  return (data.ranking || [])
    .filter((r) => r.score >= umbral)
    .slice(0, maximo)
    .map((r) => {
      const producto = porId.get(r.label);
      return producto ? { id: producto.id, equipo: producto.equipo, score: r.score } : null;
    })
    .filter(Boolean);
}

/**
 * Junta los parecidos por nombre con los parecidos por foto, sin repetir.
 *
 * Se prioriza la foto: si la misma camiseta aparece por los dos caminos, se
 * queda el puntaje visual, que es el que de verdad dice si son la misma prenda.
 */
export function combinarCandidatos(porNombre, porFoto) {
  const combinados = new Map();
  for (const c of porNombre || []) {
    combinados.set(c.id, { id: c.id, equipo: c.equipo, score: c.score, origen: 'nombre' });
  }
  for (const c of porFoto || []) {
    combinados.set(c.id, { id: c.id, equipo: c.equipo, score: c.score, origen: 'foto' });
  }
  return [...combinados.values()].sort((a, b) => {
    // Primero los que se reconocieron por foto, que son los confiables.
    if (a.origen !== b.origen) return a.origen === 'foto' ? -1 : 1;
    return b.score - a.score;
  });
}

/**
 * Cuando el parecido visual es altisimo es la misma camiseta, sin discusion,
 * y no vale la pena hacer que alguien lo confirme.
 */
export function esElMismoSeguro(candidatos) {
  const mejor = (candidatos || [])[0];
  if (!mejor || mejor.origen !== 'foto') return null;
  if (mejor.score < 0.93) return null;
  // Si hay otra casi igual de parecida, mejor que decida una persona: suelen
  // ser la version local y la visitante del mismo equipo y temporada.
  const segunda = candidatos[1];
  if (segunda && segunda.origen === 'foto' && mejor.score - segunda.score < 0.03) return null;
  return mejor;
}
