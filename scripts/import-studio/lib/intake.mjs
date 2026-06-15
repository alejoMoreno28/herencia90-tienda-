import fs from 'node:fs/promises';
import path from 'node:path';

export async function readInputRows(inputPath) {
  const source = await fs.readFile(inputPath, 'utf8');
  const ext = path.extname(inputPath).toLowerCase();

  if (ext === '.json') {
    const payload = JSON.parse(source);
    return Array.isArray(payload) ? payload : payload.references || payload.items || [];
  }

  if (ext === '.csv') {
    return parseCsvRows(source);
  }

  throw new Error(`Unsupported import input extension: ${ext || '(none)'}`);
}

export function normalizeImportRows(rows) {
  return rows.map((row) => normalizeImportRow(row));
}

export function normalizeImportRow(row) {
  const rawType = String(row.tipo || row.type || row.shirtType || '').trim();
  const rawCategory = String(row.categoria || row.category || row.categoryPrimary || rawType).trim();
  const teamName = String(row.equipo || row.teamName || row.team || '').trim();
  const seasonLabel = String(row.temporada || row.seasonLabel || row.season || '').trim();
  const shirtType = inferShirtType(rawType);
  const categoryPrimary = inferCategory(rawCategory, rawType);
  const fitType = inferFitType(rawType);
  const sleeveType = inferSleeveType(rawType);
  const title = String(row.titulo || row.title || '').trim() || buildTitle({ teamName, seasonLabel, shirtType, categoryPrimary, fitType, sleeveType });
  const slug = String(row.slug || '').trim() || slugifyReference(title);

  return {
    slug,
    providerUrl: String(row.url || row.providerUrl || row.proveedor_url || '').trim(),
    teamName,
    seasonLabel,
    shirtType,
    categoryPrimary,
    fitType,
    sleeveType,
    price: parsePrice(row.precio ?? row.price ?? 0),
    cost: parsePrice(row.costo ?? row.cost ?? 0),
    expectedColors: parseList(row.colores ?? row.expectedColors ?? row.colors),
    forbiddenColors: parseList(row.colores_prohibidos ?? row.forbiddenColors ?? row.forbidden),
    notes: String(row.notas || row.notes || '').trim(),
    sourceImages: parseList(row.imagenes ?? row.images ?? row.imageUrls),
    title,
  };
}

export function parseCsvRows(source) {
  const rows = parseCsvTable(source.replace(/^\uFEFF/, ''));
  if (rows.length === 0) return [];
  const [headers, ...body] = rows;
  return body
    .filter((cells) => cells.some((cell) => String(cell).trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [String(header).trim(), cells[index] ?? ''])));
}

export function slugifyReference(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function parsePrice(value) {
  if (typeof value === 'number') return value;
  const digits = String(value || '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

export function parseList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvTable(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function inferShirtType(value) {
  const normalized = normalize(value);
  if (normalized.includes('visitante') || normalized.includes('away')) return 'visitante';
  if (normalized.includes('tercera') || normalized.includes('third')) return 'tercera';
  if (normalized.includes('portero') || normalized.includes('arquero') || normalized.includes('goalkeeper')) return 'portero';
  if (normalized.includes('entrenamiento') || normalized.includes('training')) return 'entrenamiento';
  if (normalized.includes('local') || normalized.includes('home')) return 'local';
  if (normalized.includes('especial') || normalized.includes('special')) return 'especial';
  return 'unknown';
}

function inferCategory(category, type) {
  const normalized = normalize(`${category} ${type}`);
  if (normalized.includes('retro')) return 'retro';
  if (normalized.includes('seleccion') || normalized.includes('national')) return 'seleccion';
  if (normalized.includes('temporada') || normalized.includes('25/26') || normalized.includes('2025')) return 'temporada_actual';
  if (normalized.includes('especial')) return 'edicion_especial';
  return 'club';
}

function inferFitType(value) {
  const normalized = normalize(value);
  if (normalized.includes('player') || normalized.includes('jugador')) return 'player';
  if (normalized.includes('mujer') || normalized.includes('women')) return 'women';
  if (normalized.includes('nino') || normalized.includes('kids')) return 'kids';
  if (normalized.includes('fan')) return 'fan';
  return 'unknown';
}

function inferSleeveType(value) {
  const normalized = normalize(value);
  if (normalized.includes('manga larga') || normalized.includes('long sleeve')) return 'larga';
  if (normalized.includes('manga corta') || normalized.includes('short sleeve')) return 'corta';
  return 'unknown';
}

function buildTitle({ teamName, seasonLabel, shirtType, categoryPrimary, fitType, sleeveType }) {
  return [
    teamName,
    seasonLabel,
    labelForShirtType(shirtType),
    fitType !== 'unknown' ? fitType : '',
    sleeveType === 'larga' ? 'manga larga' : '',
    categoryPrimary === 'retro' ? 'retro' : '',
  ].filter(Boolean).join(' ');
}

function labelForShirtType(value) {
  const labels = {
    local: 'local',
    visitante: 'visitante',
    tercera: 'tercera',
    portero: 'portero',
    entrenamiento: 'entrenamiento',
    especial: 'especial',
  };
  return labels[value] || '';
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
