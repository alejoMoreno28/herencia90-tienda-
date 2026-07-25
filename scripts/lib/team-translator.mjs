/**
 * scripts/lib/team-translator.mjs
 *
 * Traduce el nombre de un equipo/seleccion (tal como viene en la
 * DESCRIPTION del excel del proveedor) a terminos de busqueda en chino
 * para el buscador nativo de yupoo, y genera variantes de temporada/manga
 * a partir del texto.
 *
 * Diccionario propio (NO reutiliza scripts/data/preventa-approved-references.mjs,
 * ese archivo tiene mojibake irrecuperable). Los terminos marcados VERIFICADO
 * se confirmaron reales viendo resultados de busqueda reales de huiliyuan
 * durante las pruebas de esta sesion; el resto son terminos estandar en
 * chino simplificado, sin verificar todavia contra esta tienda especifica.
 */
'use strict';

// clave: forma canonica en español/ingles que puede aparecer en el excel
// valor: array de alias (para deteccion) + terminos chinos (para buscar)
export const TEAM_DICTIONARY = {
  // --- Selecciones ---
  'brasil':      { aliases: ['brasil', 'brazil'],                 zh: ['巴西'],          isClub: false },      // VERIFICADO
  'argentina':   { aliases: ['argentina'],                        zh: ['阿根廷'],        isClub: false },      // VERIFICADO
  'alemania':    { aliases: ['alemania', 'germany'],               zh: ['德国'],          isClub: false },      // VERIFICADO
  'francia':     { aliases: ['francia', 'france'],                 zh: ['法国'],          isClub: false },      // VERIFICADO
  'italia':      { aliases: ['italia', 'italy'],                   zh: ['意大利'],        isClub: false },      // VERIFICADO
  'portugal':    { aliases: ['portugal'],                          zh: ['葡萄牙'],        isClub: false },      // VERIFICADO
  'espana':      { aliases: ['espana', 'espana', 'spain'],         zh: ['西班牙'],        isClub: false },
  'inglaterra':  { aliases: ['inglaterra', 'england'],             zh: ['英格兰'],        isClub: false },      // VERIFICADO
  'holanda':     { aliases: ['holanda', 'netherlands'],            zh: ['荷兰'],          isClub: false },      // VERIFICADO
  'mexico':      { aliases: ['mexico'],                            zh: ['墨西哥'],        isClub: false },      // VERIFICADO
  'colombia':    { aliases: ['colombia', 'seleccion colombia'],    zh: ['哥伦比亚'],      isClub: false },
  'japon':       { aliases: ['japon', 'japan'],                    zh: ['日本'],          isClub: false },      // VERIFICADO
  'croacia':     { aliases: ['croacia', 'croatia'],                zh: ['克罗地亚'],      isClub: false },
  'uruguay':     { aliases: ['uruguay'],                           zh: ['乌拉圭'],        isClub: false },
  'usa':         { aliases: ['usa', 'estados unidos'],             zh: ['美国'],          isClub: false },

  // --- Clubes europeos ---
  'real madrid': { aliases: ['real madrid', 'r madrid', 'r. madrid'], zh: ['皇马'],       isClub: true },       // VERIFICADO
  'barcelona':   { aliases: ['barcelona', 'barca'],                zh: ['巴塞'],          isClub: true },       // VERIFICADO (esta tienda usa 巴塞, no 巴萨)
  'ac milan':    { aliases: ['ac milan', 'milan'],                 zh: ['AC米兰', 'AC'],  isClub: true },       // VERIFICADO
  'inter':       { aliases: ['inter', 'inter milan', 'inter de milan'], zh: ['国米'],     isClub: true },       // VERIFICADO (no 国际米兰)
  'liverpool':   { aliases: ['liverpool'],                         zh: ['利物浦'],        isClub: true },       // VERIFICADO
  'manchester united': { aliases: ['manchester united', 'man united', 'man utd'], zh: ['曼联'], isClub: true }, // VERIFICADO
  'manchester city':   { aliases: ['manchester city', 'man city'], zh: ['曼城'],          isClub: true },
  'arsenal':     { aliases: ['arsenal'],                           zh: ['阿森纳'],        isClub: true },       // VERIFICADO
  'chelsea':     { aliases: ['chelsea'],                           zh: ['切尔西'],        isClub: true },       // VERIFICADO
  'bayern munich': { aliases: ['bayern munich', 'bayern'],         zh: ['拜仁'],          isClub: true },       // VERIFICADO
  'psg':         { aliases: ['psg', 'paris saint-germain'],        zh: ['大巴黎'],        isClub: true },
  'juventus':    { aliases: ['juventus', 'juve'],                  zh: ['尤文'],          isClub: true },
  'napoli':      { aliases: ['napoli'],                            zh: ['那不勒斯'],      isClub: true },
  'roma':        { aliases: ['roma', 'as roma'],                   zh: ['罗马'],          isClub: true },
  'porto':       { aliases: ['porto'],                             zh: ['波尔图'],        isClub: true },
  'benfica':     { aliases: ['benfica'],                           zh: ['本菲卡'],        isClub: true },
  'valencia':    { aliases: ['valencia'],                          zh: ['瓦伦西亚'],      isClub: true },       // VERIFICADO
  'celtic':      { aliases: ['celtic'],                            zh: ['凯尔特人'],      isClub: true },       // VERIFICADO

  // --- Clubes sudamericanos ---
  'boca juniors': { aliases: ['boca juniors', 'boca'],             zh: ['博卡'],          isClub: true },
  'river plate':  { aliases: ['river plate', 'river'],             zh: ['河床'],          isClub: true },
  'santos':       { aliases: ['santos'],                           zh: ['桑托斯'],        isClub: true },
};

const TEAM_ENTRIES = Object.entries(TEAM_DICTIONARY);

function stripAccents(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeText(value) {
  return stripAccents(String(value || '')).toLowerCase().trim();
}

/**
 * Busca el equipo en el diccionario a partir de la descripcion del excel.
 * Devuelve el primer match mas largo (para no confundir 'arsenal' con
 * un texto que en realidad dice 'ac milan arsenal edition' etc.)
 */
export function findTeamInDictionary(description) {
  const text = normalizeText(description);
  let best = null;
  for (const [key, entry] of TEAM_ENTRIES) {
    for (const alias of entry.aliases) {
      const normAlias = normalizeText(alias);
      if (text.includes(normAlias)) {
        if (!best || normAlias.length > best.matchedAlias.length) {
          best = { key, entry, matchedAlias: normAlias };
        }
      }
    }
  }
  return best;
}

/**
 * Extrae temporada(s) del texto: soporta año suelto (2004), rango (1995-1996
 * o 1995-96), y genera el patron regex con las variantes que yupoo suele usar.
 */
export function extractSeasonPattern(description, isClub) {
  const text = String(description || '');

  // rango explicito: 1995-1996, 1995-96, 95-96, 1995/96
  const rangeMatch = text.match(/\b((?:19|20)\d{2})\s*[-/]\s*(\d{2,4})\b/);
  if (rangeMatch) {
    const startFull = rangeMatch[1];
    const endRaw = rangeMatch[2];
    const endFull = endRaw.length === 2 ? startFull.slice(0, 2) + endRaw : endRaw;
    const startShort = startFull.slice(2);
    const endShort = endFull.slice(2);
    return [
      `${startFull}-${endFull}`, `${startFull}/${endFull}`,
      `${startShort}-${endShort}`, `${startShort}/${endShort}`,
    ].join('|');
  }

  // año suelto
  const yearMatch = text.match(/\b((?:19|20)\d{2})\b/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);

  if (!isClub) {
    // seleccion nacional: normalmente se referencia por año unico (no temporada)
    return `${year}`;
  }

  // club: el excel suele poner un solo año para una temporada que en yupoo
  // aparece como año/año+1 (ej "2006" -> "2006-07") o año-1/año (ej "06-07").
  const y = String(year);
  const yShort = y.slice(2);
  const yPlus1 = String(year + 1).slice(2);
  const yMinus1 = String(year - 1).slice(2);
  return [
    `${y}-${yPlus1}`, `${y}/${yPlus1}`,
    `${yShort}-${yPlus1}`, `${yShort}/${yPlus1}`,
    `${yMinus1}-${yShort}`, `${yMinus1}/${yShort}`,
  ].join('|');
}

const LONG_SLEEVE_RE = /\bmanga\s*larga\b|\blong\s*sleeve\b|长袖/i;

export function detectSleeve(description, extrasText) {
  const combined = `${description || ''} ${extrasText || ''}`;
  return LONG_SLEEVE_RE.test(combined) ? 'long' : 'short';
}

function queriesFromChineseTerms(zh, season) {
  const queries = new Set();
  for (const term of zh) {
    queries.add(term);
    if (season) {
      const firstSeason = season.split('|')[0];
      queries.add(`${term} ${firstSeason}`);
    }
  }
  return [...queries];
}

/**
 * Construye las variantes de query a probar en yupoo para una referencia,
 * usando el diccionario propio. Devuelve null si no reconoce el equipo
 * (usar buildQueriesWithGeminiFallback en ese caso).
 */
export function buildQueriesFromDescription(description, { extrasText } = {}) {
  const match = findTeamInDictionary(description);
  if (!match) return null;

  const season = extractSeasonPattern(description, match.entry.isClub);
  const sleeve = detectSleeve(description, extrasText);

  return {
    teamKey: match.key,
    queries: queriesFromChineseTerms(match.entry.zh, season),
    season,
    sleeve,
    source: 'dictionary',
  };
}

// ── Respaldo con Gemini (solo para equipos que no estan en el diccionario) ──
const geminiCache = new Map();

async function translateTeamWithGemini(teamGuess, apiKey) {
  const cacheKey = teamGuess.toLowerCase().trim();
  if (geminiCache.has(cacheKey)) return geminiCache.get(cacheKey);

  const prompt = `Eres un experto en camisetas de futbol retro y en la jerga de vendedores chinos en plataformas como yupoo.
Te doy el nombre de un equipo o seleccion de futbol: "${teamGuess}".
Devuelve SOLO un JSON (sin markdown) con:
1. "zh": array de 1-3 terminos en CHINO SIMPLIFICADO que un vendedor chino usaria para nombrar este equipo en el titulo de un album de fotos (ej. para "Real Madrid" seria ["皇马"], para "AC Milan" seria ["AC米兰"], para "Inter de Milan" seria ["国米"]). Prioriza el apodo corto que de verdad se usa en tiendas, no la traduccion literal larga.
2. "isClub": true si es un club (temporada tipo 2006-07), false si es seleccion nacional (año suelto tipo 2004).
Devuelve SOLO el JSON valido.`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini respondio ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const textResponse = data.candidates[0].content.parts[0].text;
  const clean = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(clean);

  geminiCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * Igual que buildQueriesFromDescription, pero si el equipo no esta en el
 * diccionario propio, le pregunta a Gemini (GEMINI_API_KEY) como fallback.
 * Requiere await porque el fallback hace una llamada de red.
 */
export async function buildQueriesWithGeminiFallback(description, { extrasText, geminiApiKey } = {}) {
  const dictResult = buildQueriesFromDescription(description, { extrasText });
  if (dictResult) return dictResult;

  if (!geminiApiKey) {
    return { teamKey: null, queries: [], season: null, sleeve: detectSleeve(description, extrasText), source: 'sin-match', error: 'equipo no reconocido y no hay GEMINI_API_KEY para el respaldo' };
  }

  // Heuristica simple para adivinar el "nombre del equipo" a partir de la
  // descripcion cruda (quitar numeros/años y palabras de variante comunes).
  const teamGuess = String(description || '')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(local|visitante|home|away|retro|edicion|especial|version|fan|player|manga\s*larga|manga\s*corta|corta|especial)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  try {
    const gemini = await translateTeamWithGemini(teamGuess, geminiApiKey);
    const zh = Array.isArray(gemini.zh) ? gemini.zh : [];
    if (!zh.length) throw new Error('Gemini no devolvio terminos en chino');
    const season = extractSeasonPattern(description, !!gemini.isClub);
    const sleeve = detectSleeve(description, extrasText);
    return {
      teamKey: teamGuess,
      queries: queriesFromChineseTerms(zh, season),
      season,
      sleeve,
      source: 'gemini',
    };
  } catch (err) {
    return { teamKey: teamGuess, queries: [], season: null, sleeve: detectSleeve(description, extrasText), source: 'gemini-error', error: err.message };
  }
}
