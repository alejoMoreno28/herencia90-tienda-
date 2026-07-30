/**
 * Prueba interna del flujo de corregir fotos, de punta a punta, SIN escribir
 * nada: ni en la base ni en el almacenamiento.
 *
 * Por cada producto: busca en el proveedor igual que la pantalla, coge el
 * primer candidato, baja TODAS las fotos del album, les pasa el borrador de
 * fondos y las encuadra. Reporta lo mismo que veria la persona en la vista
 * previa.
 */
import sharp from 'sharp';
import { traerProductos } from './lib/lote-carga.mjs';
import { todasLasFotosDelAlbum, downloadYupooPhoto, esDeTemporadaVieja } from './lib/yupoo-search.mjs';
import { alphaStats, buildSquareAssetBuffer, MASTER_SIZE, MASTER_FIT, CARD_SIZE, CARD_FIT } from './preventa-square-assets.mjs';

const IDS = process.argv.slice(2).map(Number);
const BORDE_LIBRE_MAX = 0.05;
const OCUPACION_MINIMA = 0.35;

async function coloresEnElPecho(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    const { data } = await sharp(buffer)
      .extract({
        left: Math.round(meta.width * 0.25), top: Math.round(meta.height * 0.2),
        width: Math.round(meta.width * 0.5), height: Math.round(meta.height * 0.35),
      })
      .removeAlpha().resize(64, 64).raw().toBuffer({ resolveWithObject: true });
    const tonos = new Set();
    for (let p = 0; p < data.length; p += 3) tonos.add(`${data[p] >> 5}-${data[p + 1] >> 5}-${data[p + 2] >> 5}`);
    return tonos.size;
  } catch { return 0; }
}

async function buscar(producto) {
  const busqueda = producto.equipo;
  const tipo = /player/i.test(busqueda) ? 'PLAYER'
    : (/retro/i.test(busqueda) || esDeTemporadaVieja(busqueda)) ? 'RETRO' : 'FAN';
  const r = await fetch('http://127.0.0.1:3001/api/match-provider-photo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: tipo, description: busqueda, maxCandidates: 8 }),
  });
  if (!r.ok) throw new Error(`match-provider-photo ${r.status}`);
  const d = await r.json();
  return { tipo, tiendas: d.searchInfo?.storesSearched || [], ranking: d.ranking || [] };
}

async function prepararComoLaPantalla(cand) {
  const urls = await todasLasFotosDelAlbum(cand.store, cand.href, cand.photoUrls || []);
  const recortadas = [];
  for (const url of urls) {
    try {
      const original = await downloadYupooPhoto(url, cand.store);
      const res = await fetch('http://127.0.0.1:5055/remove-bg', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: original.toString('base64') }),
      });
      const d = await res.json();
      recortadas.push({
        original,
        buffer: Buffer.from(d.image_b64, 'base64'),
        recortada: d.recortada !== false,
        proporcion: d.proporcion, bordeOpaco: d.borde_opaco,
      });
    } catch (e) { recortadas.push({ error: e.message }); }
  }

  const completas = []; const planos = [];
  for (const f of recortadas.filter((x) => !x.error)) {
    const cabe = f.bordeOpaco != null && f.bordeOpaco <= BORDE_LIBRE_MAX;
    const ocupa = f.proporcion != null && f.proporcion >= OCUPACION_MINIMA;
    if (f.recortada && cabe && ocupa) completas.push({ ...f, publicar: f.buffer, sinFondo: true });
    else planos.push({ ...f, publicar: f.original, sinFondo: false });
  }
  for (const f of completas) f.colores = await coloresEnElPecho(f.publicar);
  completas.sort((a, b) => b.colores - a.colores);
  const elegidas = [...completas, ...planos];

  const publicables = [];
  for (const f of elegidas) {
    if (publicables.length >= 6) break;
    try {
      let listo;
      if (f.sinFondo) {
        const st = await alphaStats(f.publicar);
        if (st.transparentRatio < 0.05) throw new Error('sin fondo transparente');
        listo = await sharp(f.publicar).rotate().ensureAlpha().extract(st.bbox).png().toBuffer();
      } else {
        listo = await sharp(f.publicar).rotate().ensureAlpha().png().toBuffer();
      }
      const m = await buildSquareAssetBuffer(listo, MASTER_SIZE, MASTER_FIT);
      const c = await buildSquareAssetBuffer(listo, CARD_SIZE, CARD_FIT);
      publicables.push({ sinFondo: f.sinFondo, kbMaster: Math.round(m.length / 1024), kbCard: Math.round(c.length / 1024) });
    } catch (e) { publicables.push({ error: e.message }); }
  }
  return { enAlbum: urls.length, fallosAlBajar: recortadas.filter((x) => x.error).length, publicables };
}

const productos = await traerProductos();
const fallos = [];

for (const id of IDS) {
  const p = productos.find((x) => x.id === id);
  if (!p) { console.log(`\nid ${id}: NO EXISTE`); continue; }
  console.log(`\n── id ${id}  ${p.equipo}`);
  try {
    const { tipo, tiendas, ranking } = await buscar(p);
    console.log(`   seccion ${tipo}  (${tiendas.map((s) => s.replace('https://', '').split('.')[0]).join(', ')})`);
    if (!ranking.length) { console.log('   ✗ SIN CANDIDATOS'); fallos.push(`${id}: sin candidatos`); continue; }
    console.log(`   ${ranking.length} candidatos, primero: ${ranking[0].title}`);

    const r = await prepararComoLaPantalla(ranking[0]);
    const buenas = r.publicables.filter((x) => !x.error);
    const orden = buenas.map((x) => (x.sinFondo ? 'S' : 'c')).join('');
    console.log(`   album ${r.enAlbum} fotos -> publicables ${buenas.length}   orden: ${orden}   (S=sin fondo, c=con su fondo)`);
    if (buenas.length) {
      console.log(`   peso: master ${Math.round(buenas.reduce((s, x) => s + x.kbMaster, 0) / buenas.length)} KB, card ${Math.round(buenas.reduce((s, x) => s + x.kbCard, 0) / buenas.length)} KB`);
    }

    if (buenas.length < 2) fallos.push(`${id}: solo ${buenas.length} foto(s) publicables`);
    if (!buenas.length || !buenas[0].sinFondo) fallos.push(`${id}: la portada no es una prenda completa`);
    if (r.fallosAlBajar) fallos.push(`${id}: ${r.fallosAlBajar} foto(s) no se pudieron bajar`);
    const rotas = r.publicables.filter((x) => x.error);
    if (rotas.length) fallos.push(`${id}: ${rotas.length} fallaron al encuadrar (${rotas[0].error})`);
  } catch (e) {
    console.log('   ✗ ERROR:', e.message);
    fallos.push(`${id}: ${e.message}`);
  }
}

console.log('\n' + '='.repeat(60));
if (fallos.length) { console.log('PROBLEMAS:'); fallos.forEach((f) => console.log('  -', f)); }
else console.log('Todos los casos pasaron.');
