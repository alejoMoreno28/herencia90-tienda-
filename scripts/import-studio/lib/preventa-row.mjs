const CLUB_PATTERNS = [
  { team: 'Bayern Munich', keys: ['拜仁', 'bayern', 'munich'] },
  { team: 'Real Madrid', keys: ['皇马', 'real madrid', 'madrid'] },
  { team: 'Barcelona', keys: ['巴萨', 'barcelona', 'barca'] },
  { team: 'AC Milan', keys: ['ac米兰', 'ac milan', 'milan'] },
  { team: 'Inter de Milan', keys: ['国米', 'inter', 'internazionale'] },
  { team: 'Arsenal', keys: ['阿森纳', 'arsenal'] },
  { team: 'Chelsea', keys: ['切尔西', 'chelsea'] },
  { team: 'Liverpool', keys: ['利物浦', 'liverpool'] },
  { team: 'Manchester United', keys: ['曼联', 'manchester united', 'man united'] },
  { team: 'Juventus', keys: ['尤文', 'juventus'] },
  { team: 'PSG', keys: ['巴黎', 'psg', 'paris saint'] },
  { team: 'Porto', keys: ['波尔图', 'porto'] },
  { team: 'Roma', keys: ['罗马', 'roma'] },
  { team: 'Napoli', keys: ['那不勒斯', 'napoli'] },
  { team: 'Boca Juniors', keys: ['博卡', 'boca'] },
  { team: 'River Plate', keys: ['河床', 'river plate'] },
  { team: 'Santos', keys: ['桑托斯', 'santos'] },
  { team: 'Atletico Madrid', keys: ['马竞', 'atletico'] },
  { team: 'Fiorentina', keys: ['佛罗伦萨', 'fiorentina'] },
  { team: 'Benfica', keys: ['本菲卡', 'benfica'] },
];

const COUNTRY_PATTERNS = [
  { team: 'Colombia', keys: ['哥伦比亚', 'colombia'] },
  { team: 'Brasil', keys: ['巴西', 'brasil', 'brazil'] },
  { team: 'Argentina', keys: ['阿根廷', 'argentina'] },
  { team: 'Alemania', keys: ['德国', 'alemania', 'germany'] },
  { team: 'Francia', keys: ['法国', 'francia', 'france'] },
  { team: 'Italia', keys: ['意大利', 'italia', 'italy'] },
  { team: 'Espana', keys: ['西班牙', 'espana', 'spain'] },
  { team: 'Portugal', keys: ['葡萄牙', 'portugal'] },
  { team: 'Holanda', keys: ['荷兰', 'holanda', 'netherlands'] },
  { team: 'Inglaterra', keys: ['英格兰', 'inglaterra', 'england'] },
];

const VARIANT_LABELS = {
  local: 'Local',
  visitante: 'Visitante',
  tercera: 'Tercera',
  portero: 'Portero',
};

export function inferPreventaMetadata(input = {}) {
  const title = String(input.title || '').trim();
  const normalizedTitle = normalize(title);
  const countryMatch = findTeam(COUNTRY_PATTERNS, normalizedTitle);
  const clubMatch = countryMatch ? null : findTeam(CLUB_PATTERNS, normalizedTitle);
  const teamName = input.teamName || countryMatch?.team || clubMatch?.team || '';
  const variant = input.variant || inferVariant(normalizedTitle);
  const productType = input.productType || inferProductType(normalizedTitle, title, variant);
  const seasonLabel = input.seasonLabel || inferSeason(title);
  const categoria = input.categoria || (countryMatch ? 'selecciones' : 'clubes');
  const decada = input.decada || decadeForSeason(seasonLabel);
  const equipo = input.equipo || displayEquipo(teamName, variant);
  const slug = input.slug || slugifyReference([teamName || equipo || title, seasonLabel, variant !== 'unknown' ? variant : '', productType === 'retro' ? 'retro' : ''].filter(Boolean).join(' '));

  return {
    rawTitle: title,
    teamName,
    equipo,
    temporada: seasonLabel,
    variant,
    tipo: productType,
    categoria,
    decada,
    slug,
    confidence: confidenceFor({ teamName, seasonLabel, variant, title }),
  };
}

export function buildNormalizedFromMetadata(metadata, options = {}) {
  const title = [
    metadata.equipo || metadata.teamName,
    metadata.temporada,
    metadata.variant && metadata.variant !== 'unknown' ? metadata.variant : '',
    metadata.tipo === 'retro' ? 'retro' : '',
  ].filter(Boolean).join(' ');

  return {
    slug: options.slug || metadata.slug,
    providerUrl: options.providerUrl || '',
    teamName: metadata.equipo || metadata.teamName || '',
    seasonLabel: metadata.temporada || '',
    shirtType: metadata.variant || 'unknown',
    categoryPrimary: metadata.tipo === 'retro' ? 'retro' : metadata.categoria === 'selecciones' ? 'seleccion' : 'club',
    fitType: ['fan', 'player'].includes(metadata.tipo) ? metadata.tipo : 'unknown',
    sleeveType: metadata.tipo === 'manga-larga' ? 'larga' : 'unknown',
    price: Number(options.price || defaultPriceFor(metadata.tipo)),
    cost: 0,
    expectedColors: options.expectedColors || [],
    forbiddenColors: [],
    notes: options.notes || '',
    sourceImages: options.sourceImages || [],
    title,
    preventa: metadata,
  };
}

export function buildPreventaCatalogRow(reference, images, options = {}) {
  const normalized = reference.normalized || {};
  const metadata = {
    ...inferPreventaMetadata({
      title: reference.providerTitle || reference.title || normalized.title,
      teamName: normalized.teamName,
      seasonLabel: normalized.seasonLabel,
      variant: normalized.shirtType,
      productType: normalized.preventa?.tipo,
      slug: reference.slug || normalized.slug,
    }),
    ...(normalized.preventa || {}),
  };

  const accepted = (images || []).filter((image) => image.role !== 'rejected');
  const galleryImages = accepted.filter((image) => image.role === 'front' || image.role === 'back');
  const detailImages = accepted.filter((image) => image.role !== 'front' && image.role !== 'back');
  const hasBack = galleryImages.some((image) => image.role === 'back');
  const rowImages = galleryImages.map((image) => publicImageObject(image));
  const rowDetails = detailImages.map((image) => publicImageObject(image));
  const allOriginals = accepted.map((image) => publicImageObject(image));
  const equipo = options.equipo || metadata.equipo || normalized.teamName || reference.title || reference.slug;
  const temporada = options.temporada || metadata.temporada || normalized.seasonLabel || '';
  const tipo = validTipo(options.tipo || metadata.tipo || schemaTipoFromNormalized(normalized));
  const categoria = validCategoria(options.categoria || metadata.categoria || schemaCategoriaFromNormalized(normalized));
  const descripcion = options.descripcion || reference.draft?.description || `${equipo} ${temporada} - ${tipo}`;

  return {
    slug: options.slug || reference.slug || metadata.slug,
    equipo,
    temporada,
    tipo,
    categoria,
    pais_o_club: options.pais_o_club || null,
    decada: options.decada || metadata.decada || decadeForSeason(temporada) || null,
    descripcion,
    imagenes: rowImages,
    imagenes_detalle: rowDetails,
    imagenes_originales: allOriginals,
    photo_count: rowImages.length,
    photo_count_original: allOriginals.length,
    photo_count_gallery: rowImages.length + rowDetails.length,
    gallery_status: {
      has_confirmed_back: hasBack,
      needs_review: hasBack ? [] : ['no_confirmed_back'],
    },
    tags: tagsFor({ equipo, temporada, tipo, categoria, variant: metadata.variant }),
    precio_aprox: Number(options.precio_aprox || normalized.price || defaultPriceFor(tipo)),
    yupoo_origen: normalized.providerUrl || reference.providerUrl || '',
    publicado: Boolean(options.publicado),
    destacado: Boolean(options.destacado),
    orden: Number(options.orden || 0),
    curation: {
      source: 'HERENCIA90 Import Studio',
      job_id: options.jobId || '',
      storage_bucket: options.bucket || 'preventa-images',
      storage_prefix: options.prefix || '',
      publish_mode: options.publicado ? 'published' : 'draft',
    },
  };
}

export function slugifyReference(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || `referencia-${Date.now().toString(36)}`;
}

export function decadeForSeason(value) {
  const match = String(value || '').match(/(19|20)\d{2}/);
  if (!match) return '';
  const year = Number(match[0]);
  if (year >= 1970 && year < 1980) return '70s';
  if (year >= 1980 && year < 1990) return '80s';
  if (year >= 1990 && year < 2000) return '90s';
  if (year >= 2000 && year < 2010) return '2000s';
  if (year >= 2010 && year < 2020) return '2010s';
  if (year >= 2020 && year < 2030) return '2020s';
  return '';
}

function findTeam(patterns, normalizedTitle) {
  return patterns.find((pattern) => pattern.keys.some((key) => normalizedTitle.includes(normalize(key))));
}

function inferVariant(normalizedTitle) {
  if (/portero|arquero|goalkeeper|keeper|门将|守门/.test(normalizedTitle)) return 'portero';
  if (/tercera|third|三客|第二客|二客/.test(normalizedTitle)) return 'tercera';
  if (/visitante|away|客场/.test(normalizedTitle)) return 'visitante';
  if (/local|home|主场/.test(normalizedTitle)) return 'local';
  return 'unknown';
}

function inferProductType(normalizedTitle, title, variant) {
  if (/player|jugador|球员版/.test(normalizedTitle)) return 'player';
  if (/fan|球迷版/.test(normalizedTitle)) return 'fan';
  if (/manga larga|long sleeve|长袖/.test(normalizedTitle)) return 'manga-larga';
  if (variant === 'portero') return 'portero';
  if (/retro|复古/.test(normalizedTitle)) return 'retro';

  const year = Number(String(title || '').match(/(19|20)\d{2}/)?.[0] || 0);
  if (year && year < 2024) return 'retro';
  return 'fan';
}

function inferSeason(title) {
  const source = String(title || '');
  const range = source.match(/((?:19|20)\d{2})\s*[-/]\s*(\d{2,4})/);
  if (range) {
    const start = range[1];
    const endRaw = range[2];
    const end = endRaw.length === 2 ? `${start.slice(0, 2)}${endRaw}` : endRaw;
    return `${start}-${end}`;
  }

  const single = source.match(/(?:19|20)\d{2}/);
  return single ? single[0] : '';
}

function displayEquipo(teamName, variant) {
  if (!teamName) return '';
  if (!variant || variant === 'unknown' || variant === 'local') return teamName;
  return `${teamName} ${VARIANT_LABELS[variant] || variant}`;
}

function defaultPriceFor(tipo) {
  const prices = {
    fan: 120000,
    player: 130000,
    'manga-larga': 130000,
    portero: 130000,
    retro: 120000,
  };
  return prices[tipo] || 120000;
}

function schemaTipoFromNormalized(normalized) {
  if (normalized.preventa?.tipo) return normalized.preventa.tipo;
  if (normalized.fitType === 'player') return 'player';
  if (normalized.fitType === 'fan') return 'fan';
  if (normalized.sleeveType === 'larga') return 'manga-larga';
  if (normalized.shirtType === 'portero') return 'portero';
  if (normalized.categoryPrimary === 'retro') return 'retro';
  return 'fan';
}

function schemaCategoriaFromNormalized(normalized) {
  if (normalized.preventa?.categoria) return normalized.preventa.categoria;
  if (normalized.categoryPrimary === 'seleccion') return 'selecciones';
  if (normalized.categoryPrimary === 'club' || normalized.categoryPrimary === 'retro') return 'clubes';
  return 'otros';
}

function validTipo(value) {
  const allowed = new Set(['local', 'visitante', 'tercera', 'retro', 'portero', 'manga-larga', 'fan', 'player']);
  return allowed.has(value) ? value : 'retro';
}

function validCategoria(value) {
  const allowed = new Set(['selecciones', 'clubes', 'ligas-nba', 'otros']);
  return allowed.has(value) ? value : 'clubes';
}

function publicImageObject(image) {
  return {
    url: image.cardUrl || image.url || image.sourceUrl || '',
    path: image.cardPath || image.path || '',
    card_url: image.cardUrl || image.url || '',
    card_path: image.cardPath || image.path || '',
    master_url: image.masterUrl || image.sourceUrl || image.url || '',
    master_path: image.masterPath || image.path || '',
    source_url: image.sourceUrl || '',
    role: image.role || 'detail',
    gallery_role: image.role || 'detail',
    source_image_id: image.id || '',
  };
}

function tagsFor({ equipo, temporada, tipo, categoria, variant }) {
  return [...new Set([
    equipo,
    temporada,
    tipo,
    categoria,
    variant && variant !== 'unknown' ? variant : '',
  ].filter(Boolean).map((item) => normalize(item)))];
}

function confidenceFor({ teamName, seasonLabel, variant, title }) {
  let score = 0.25;
  if (title) score += 0.15;
  if (teamName) score += 0.3;
  if (seasonLabel) score += 0.2;
  if (variant && variant !== 'unknown') score += 0.1;
  return Number(Math.min(score, 0.95).toFixed(2));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
