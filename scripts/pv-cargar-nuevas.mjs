/**
 * scripts/pv-cargar-nuevas.mjs
 *
 * Carga al bajo pedido las referencias nuevas de scripts/data/preventa-nuevas-2026-10.json
 * (investigacion de octubre: lo que mas se vende en Colombia y el proveedor tiene).
 * Baja las fotos del album de Yupoo y crea la fila OCULTA (publicado = false):
 * despues se limpia con limpiar-preventa.mjs, se revisa la hoja y se publica.
 *
 *   node --env-file=.env scripts/pv-cargar-nuevas.mjs [--solo slug1,slug2]
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const { importFromYupoo } = require('../api/preventa-yupoo-import.js');

const PRECIOS = { fan: 99000, player: 110000, 'manga-larga': 110000, retro: 120000 };
const filas = JSON.parse(fs.readFileSync('scripts/data/preventa-nuevas-2026-10.json', 'utf8'));
const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > 0 ? process.argv[soloIdx + 1].split(',') : [];

const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, ' ').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: existentes, error } = await supabase.from('preventa_catalogo').select('slug');
if (error) throw error;
const usados = new Set(existentes.map((x) => x.slug));

for (const f of filas) {
  const slug = slugify(`${f.equipo} ${f.temporada}${f.slug_sufijo ? ` ${f.slug_sufijo}` : ""}`);
  if (solo.length && !solo.includes(slug)) continue;
  if (usados.has(slug)) { console.log(`${slug}: ya existe, se salta`); continue; }
  try {
    const r = await importFromYupoo({ yupoo_album_url: f.yupoo, slug_hint: slug, max_imagenes: 14 });
    if (!r.imagenes.length) { console.log(`${slug}: el album no dio fotos`); continue; }
    const palabras = slugify(f.equipo).split('-').filter((w) => w.length > 2);
    const row = {
      slug, equipo: f.equipo, temporada: f.temporada, tipo: f.tipo, categoria: f.categoria, decada: f.decada,
      imagenes: r.imagenes, yupoo_origen: f.yupoo, precio_aprox: PRECIOS[f.tipo] || 99000,
      publicado: false, destacado: f.prioridad === 1,
      descripcion: `${f.equipo} ${f.temporada}${f.especial ? ' - edición especial' : ''} - ${f.tipo.replace('-', ' ')}`,
      tags: [...new Set([...palabras, f.temporada, f.tipo, ...(f.especial ? ['edicion especial', 'especial'] : []), 'nuevo'])],
    };
    const { error: e } = await supabase.from('preventa_catalogo').insert(row);
    if (e) throw new Error(e.message);
    usados.add(slug);
    console.log(`${slug}: ${r.imagenes.length} fotos, oculta`);
  } catch (err) {
    console.log(`${slug}: ERROR ${err.message}`);
  }
}
