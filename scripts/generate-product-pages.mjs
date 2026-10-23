import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://www.herencia90.shop';
const supabaseUrl = process.env.SUPABASE_URL || 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
const supabaseProductsUrl = `${supabaseUrl}/rest/v1/productos?select=*&order=id`;
const supabasePreventaUrl = `${supabaseUrl}/rest/v1/preventa_catalogo?select=*&publicado=eq.true&order=destacado.desc&order=slug.asc`;
const outputDir = path.join(root, 'web', 'camisetas');
const preventaOutputDir = path.join(root, 'web', 'preventa');
const categoryOutputDir = path.join(root, 'web', 'categorias');
const cityOutputDir = path.join(root, 'web', 'ciudades');
const productsPath = path.join(root, 'web', 'productos.json');
const preventaCatalogPath = path.join(root, 'web', 'preventa-catalogo.json');
const sitemapPath = path.join(root, 'web', 'sitemap.xml');
const robotsPath = path.join(root, 'web', 'robots.txt');
const useLocalCatalogs = process.env.H90_GENERATE_LOCAL === '1';

async function loadProducts() {
  if (useLocalCatalogs) {
    console.warn('Using local products catalog');
    return JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  }

  try {
    const response = await fetch(supabaseProductsUrl, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase respondio ${response.status}`);
    }

    const liveProducts = await response.json();

    if (!Array.isArray(liveProducts) || liveProducts.length === 0) {
      throw new Error('Supabase no devolvio productos');
    }

    fs.writeFileSync(productsPath, `${JSON.stringify(liveProducts, null, 4)}\n`, 'utf8');
    return liveProducts;
  } catch (error) {
    console.warn(`No fue posible sincronizar productos desde Supabase: ${error.message}`);
    return JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  }
}

const products = await loadProducts();

async function loadPreventaItems() {
  if (useLocalCatalogs) {
    console.warn('Using local preventa catalog');
    return JSON.parse(fs.readFileSync(preventaCatalogPath, 'utf8'));
  }

  try {
    const response = await fetch(supabasePreventaUrl, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase respondio ${response.status}`);
    }

    const liveItems = await response.json();

    if (!Array.isArray(liveItems)) {
      throw new Error('Supabase no devolvio preventa_catalogo como arreglo');
    }

    fs.writeFileSync(preventaCatalogPath, `${JSON.stringify(liveItems, null, 4)}\n`, 'utf8');
    return liveItems;
  } catch (error) {
    console.warn(`No fue posible sincronizar preventa desde Supabase: ${error.message}`);
    if (fs.existsSync(preventaCatalogPath)) {
      return JSON.parse(fs.readFileSync(preventaCatalogPath, 'utf8'));
    }
    return [];
  }
}

const preventaItems = await loadPreventaItems();

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function includesNormalized(value, query) {
  return normalizeText(value).includes(normalizeText(query));
}

const seoCollections = [
  {
    slug: 'colombia',
    name: 'Colombia 2026',
    eyebrow: 'Seleccion Colombia',
    title: 'Camisetas Colombia 2026 Importadas | Herencia 90 Colombia',
    shortDescription: 'Explora camisetas de Colombia 2026 para hombre y mujer con enfoque en acabados importados, envio nacional y atencion por WhatsApp.',
    intro: 'Las referencias de Colombia son de las mas fuertes de Herencia 90. Aqui reunimos las camisetas de la seleccion para que la busqueda sea directa y Google entienda mejor esta coleccion.',
    faqTitle: 'Preguntas sobre Colombia 2026',
    match(product) {
      return includesNormalized(product.equipo, 'colombia');
    }
  },
  {
    slug: 'real-madrid',
    name: 'Real Madrid',
    eyebrow: 'Coleccion Merengue',
    title: 'Camisetas Real Madrid Importadas | Herencia 90 Colombia',
    shortDescription: 'Encuentra camisetas Real Madrid locales, visitantes, especiales y retro con envio a toda Colombia y atencion directa por WhatsApp.',
    intro: 'Real Madrid tiene varias referencias con busqueda fuerte. Esta landing agrupa temporada actual, ediciones especiales y retro para captar mejor la demanda de marca.',
    faqTitle: 'Preguntas sobre Real Madrid',
    match(product) {
      return includesNormalized(product.equipo, 'real madrid');
    }
  },
  {
    slug: 'barcelona',
    name: 'Barcelona',
    eyebrow: 'Coleccion Barca',
    title: 'Camisetas Barcelona 25/26 Importadas | Herencia 90 Colombia',
    shortDescription: 'Compra camisetas Barcelona 25/26 importadas en Colombia. Versiones local y visitante, envio nacional y soporte rapido por WhatsApp.',
    intro: 'Barcelona es una de las marcas con mas intencion de compra en este catalogo. Esta pagina concentra las referencias del club para fortalecer posicionamiento y conversion.',
    faqTitle: 'Preguntas sobre Barcelona',
    match(product) {
      return includesNormalized(product.equipo, 'barcelona');
    }
  },
  {
    slug: 'retro',
    name: 'Retro',
    eyebrow: 'Leyendas Clasicas',
    title: 'Camisetas Retro de Futbol en Colombia | Herencia 90',
    shortDescription: 'Descubre camisetas retro de futbol en Colombia. Referencias clasicas de clubes historicos con envio nacional y soporte por WhatsApp.',
    intro: 'Las camisetas retro atraen busquedas muy valiosas porque mezclan nostalgia y compra impulsiva. Esta coleccion agrupa las leyendas clasicas del catalogo actual.',
    faqTitle: 'Preguntas sobre camisetas retro',
    match(product) {
      return includesNormalized(product.equipo, 'retro') || includesNormalized(product.categoria, 'leyendas clasicas');
    }
  },
  {
    slug: 'temporada-25-26',
    name: 'Temporada 25/26',
    eyebrow: 'Temporada Actual',
    title: 'Camisetas Temporada 25/26 Importadas | Herencia 90 Colombia',
    shortDescription: 'Compra camisetas de temporada 25/26 importadas en Colombia. Clubes europeos, buenas terminaciones y envio nacional con Herencia 90.',
    intro: 'Esta landing junta las camisetas de temporada mas actuales del catalogo. Sirve para posicionar busquedas amplias por equipos y por temporada dentro del mismo bloque.',
    faqTitle: 'Preguntas sobre temporada 25/26',
    match(product) {
      return includesNormalized(product.categoria, 'temporada 25/26');
    }
  },
  {
    type: 'city',
    slug: 'bogota',
    name: 'Bogota',
    eyebrow: 'Envios a Bogota',
    title: 'Camisetas de Futbol en Bogota | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Bogota con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Bogota con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Bogota',
    match(product) { return true; }
  },
  {
    type: 'city',
    slug: 'medellin',
    name: 'Medellin',
    eyebrow: 'Envios a Medellin',
    title: 'Camisetas de Futbol en Medellin | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Medellin con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Medellin con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Medellin',
    match(product) { return true; }
  },
  {
    type: 'city',
    slug: 'cali',
    name: 'Cali',
    eyebrow: 'Envios a Cali',
    title: 'Camisetas de Futbol en Cali | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Cali con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Cali con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Cali',
    match(product) { return true; }
  },
  {
    type: 'city',
    slug: 'barranquilla',
    name: 'Barranquilla',
    eyebrow: 'Envios a Barranquilla',
    title: 'Camisetas de Futbol en Barranquilla | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Barranquilla con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Barranquilla con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Barranquilla',
    match(product) { return true; }
  },
  {
    type: 'city',
    slug: 'ibague',
    name: 'Ibague',
    eyebrow: 'Envios a Ibague',
    title: 'Camisetas de Futbol en Ibague | Herencia 90',
    shortDescription: 'Compra camisetas de futbol en Ibague con pago contra entrega. Camisetas retro, importadas y de temporada enviadas a tu casa.',
    intro: 'Llevamos la pasion del futbol a Ibague con envio seguro y pago contra entrega. Encuentra las mejores referencias retro y de la nueva temporada.',
    faqTitle: 'Preguntas sobre envios a Ibague',
    match(product) { return true; }
  }
];

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function formatPrice(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(value);
}

function getPreventaPrice(item) {
  if (Number(item.precio_aprox) > 0) return Number(item.precio_aprox);
  const prices = { fan: 99000, player: 110000, 'manga-larga': 110000, retro: 120000 };
  return prices[item.tipo] || 99000;
}

function formatPreventaTipo(item) {
  return String(item.tipo || 'preventa').replace(/-/g, ' ');
}

function buildPreventaTitle(item) {
  const baseText = normalizeText([item.slug, item.equipo, item.tipo, ...(item.tags || [])].join(' '));
  const name = String(item.equipo || '').trim();
  const season = String(item.temporada || '').trim();
  const type = formatPreventaTipo(item);
  const variant = [
    baseText.includes('local') && !normalizeText(name).includes('local') ? 'Local' : '',
    baseText.includes('visitante') && !normalizeText(name).includes('visitante') ? 'Visitante' : '',
    baseText.includes('tercera') && !normalizeText(name).includes('tercera') ? 'Tercera' : '',
    baseText.includes('manga larga') || baseText.includes('manga-larga') ? 'Manga Larga' : '',
    baseText.includes('player') && !normalizeText(name).includes('player') ? 'Player' : '',
  ].filter(Boolean).join(' ');
  const suffix = type !== 'fan' && !variant.toLowerCase().includes(type.toLowerCase()) ? type : '';
  return ['Camiseta', name, variant, season, suffix].filter(Boolean).join(' ');
}

function buildPreventaMetaDescription(item) {
  const title = buildPreventaTitle(item);
  const price = formatPrice(getPreventaPrice(item));
  return truncateText(`${title} por pre-venta en Colombia. Fotos de proveedor, anticipo 20%, entrega aprox. 15 dias. Desde ${price}.`, 158);
}

function buildPreventaWhatsAppUrl(item) {
  const message = `Hola Herencia 90, quiero pedir por pre-venta la ${buildPreventaTitle(item)}. Vi esta referencia en ${getPreventaUrl(item)} y quiero confirmar talla, precio final y disponibilidad.`;
  return `https://wa.me/573126428153?text=${encodeURIComponent(message)}`;
}

function truncateText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function absoluteAssetUrl(assetPath) {
  const raw = String(assetPath || '').trim();
  if (!raw) return `${siteUrl}/img/logo-ui.webp`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${siteUrl}/${normalizeLocalAssetPath(raw)}`;
}

function normalizeLocalAssetPath(assetPath) {
  return String(assetPath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/^\/+/, '');
}

function clientAssetUrl(assetPath) {
  const raw = String(assetPath || '').trim();
  if (!raw) return '../img/logo-ui.webp';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `../${normalizeLocalAssetPath(raw)}`;
}

function getCardAssetUrl(assetPath) {
  const raw = String(assetPath || '').trim();
  const masterUrl = clientAssetUrl(raw);
  if (!raw || /^https?:\/\//i.test(raw)) return masterUrl;

  const localPath = normalizeLocalAssetPath(raw);
  if (/-card\.webp$/i.test(localPath)) return `../${localPath}`;

  const extension = path.posix.extname(localPath);
  const stem = extension ? localPath.slice(0, -extension.length) : localPath;
  const cardPath = `${stem}-card.webp`;
  return fs.existsSync(path.join(root, 'web', ...cardPath.split('/'))) ? `../${cardPath}` : masterUrl;
}

function imageFallbackAttributes(previewUrl, masterUrl) {
  if (previewUrl === masterUrl) return '';
  return ` data-fallback-src="${escapeHtml(masterUrl)}" onerror="this.onerror=null;this.src=this.dataset.fallbackSrc"`;
}

function pickClientProductFields(product) {
  return {
    id: product.id,
    equipo: product.equipo,
    categoria: product.categoria,
    descripcion: product.descripcion,
    precio: product.precio,
    tallas: product.tallas || {},
    imagenes: product.imagenes || []
  };
}

function buildCardAssetMap(productList) {
  return Object.fromEntries(productList.flatMap((product) => (product.imagenes || []).map((image) => {
    const masterUrl = clientAssetUrl(image);
    const cardUrl = getCardAssetUrl(image);
    return [String(image), { cardUrl, masterUrl }];
  })));
}

function renderDeferredGa4() {
  return `  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    (function(){
      let loaded = false;
      const loadGtag = function(){
        if (loaded) return;
        loaded = true;
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-576MFSV66N';
        document.head.appendChild(script);
        gtag('js', new Date());
        gtag('config', 'G-576MFSV66N');
      };
      const schedule = function(){
        if ('requestIdleCallback' in window) window.requestIdleCallback(loadGtag, { timeout: 2500 });
        else window.setTimeout(loadGtag, 1200);
      };
      if (document.readyState === 'complete') schedule();
      else window.addEventListener('load', schedule, { once: true });
    })();
  </script>`;
}

function getAvailableSizes(product) {
  return Object.entries(product.tallas || {})
    .filter(([, qty]) => qty > 0)
    .map(([size]) => size);
}

function getStockTotal(product) {
  return Object.values(product.tallas || {}).reduce((sum, qty) => sum + Number(qty || 0), 0);
}

function getProductUrl(product) {
  return `${siteUrl}/camisetas/${slugify(product.equipo)}`;
}

function getProductAliasSlug(product) {
  if (product.id === 10) return 'camiseta-local-colombia-26';
  if (product.id === 24) return 'camiseta-local-colombia-26-mujer';
  return null;
}

const legacyProductAliasSlugs = new Map([
  [1, ['camiseta-local-alemania-26']],
  [2, ['camiseta-local-argentina-26']],
  [9, ['camiseta-local-brasil-26']],
  [10, ['camiseta-local-colombia-26']],
  [17, ['camiseta-edicion-especial-portugal-26']],
  [24, ['camiseta-local-colombia-26-mujer']],
  [28, ['retro-brasil-2004-home']],
  [29, ['roma-25-26-blanca']],
  [30, ['retro-milan-2008-home-dorsal-ronaldinho-dorsal-personalization']],
  [31, ['retro-colombia-90-anos-amarilla']],
  [32, ['retro-woman-colombia-90-anos-roja']],
  [33, ['colombia-azul-2026']],
  [34, ['colombia-100-anos-negra']],
  [35, ['espana-26-blanca']],
  [37, ['colombia-100-anos-blanca']],
  [53, ['camiseta-espana-2026-vsitante-mujer']]
]);

function getLegacyProductAliasSlugs(product) {
  return legacyProductAliasSlugs.get(Number(product.id)) || [];
}

function getProductUrls(product) {
  const canonical = getProductUrl(product);
  const aliasSlug = getProductAliasSlug(product);
  const urls = [canonical];

  if (aliasSlug) {
    urls.push(`${siteUrl}/camisetas/${aliasSlug}`);
  }

  return urls;
}

function getPreventaUrl(item) {
  return `${siteUrl}/preventa/${slugify(item.slug || item.equipo)}`;
}

function getPreventaImageUrl(image) {
  const raw = image?.card_url || image?.url || image?.publicUrl || image;
  if (!raw) return `${siteUrl}/img/logo-ui.webp`;
  if (String(raw).startsWith('http')) return raw;
  return absoluteAssetUrl(String(raw));
}

function getPreventaGalleryImageUrl(image) {
  const raw = image?.master_url || image?.url || image?.card_url || image?.publicUrl || image;
  if (!raw) return `${siteUrl}/img/logo-ui.webp`;
  if (String(raw).startsWith('http')) return raw;
  return absoluteAssetUrl(String(raw));
}

function getPreventaCuratedSourceUrl(image) {
  if (!image || typeof image === 'string') return '';
  return image.source_url || image.sourceUrl || '';
}

function isPreventaCuratedImage(image) {
  const url = getPreventaGalleryImageUrl(image);
  return url.includes('/preventa-curated/');
}

function getPreventaGalleryImageUrls(item) {
  const urls = [];
  const curatedSourceUrls = new Set();
  const primaryImages = Array.isArray(item.imagenes) ? item.imagenes : [];
  const detailImages = Array.isArray(item.imagenes_detalle) ? item.imagenes_detalle : item.imagenes_originales;
  const hasCuratedPrimary = primaryImages.some(isPreventaCuratedImage);

  primaryImages.forEach((image) => {
    const sourceUrl = getPreventaCuratedSourceUrl(image);
    if (sourceUrl) curatedSourceUrls.add(sourceUrl);
    if (!hasCuratedPrimary || isPreventaCuratedImage(image)) {
      urls.push(getPreventaGalleryImageUrl(image));
    }
  });

  if (Array.isArray(detailImages)) {
    detailImages.forEach((image) => {
      const url = getPreventaGalleryImageUrl(image);
      if (!url || curatedSourceUrls.has(url)) return;
      urls.push(url);
    });
  }

  const unique = urls.filter((url, index) => url && urls.indexOf(url) === index);
  return unique.length ? unique : [`${siteUrl}/img/logo-ui.webp`];
}

function getCollectionUrl(collection) {
  if (collection.type === 'city') return `${siteUrl}/ciudades/${collection.slug}`;
  return `${siteUrl}/categorias/${collection.slug}`;
}

// Una camiseta sin foto todavia mostraria el logo en la tarjeta; se lista
// cuando ya tenga fotos. Su ficha propia si se genera.
function getCollectionProducts(collection) {
  return products.filter((product) => collection.match(product) && Array.isArray(product.imagenes) && product.imagenes.length > 0);
}

function buildMetaDescription(product, availableSizes) {
  const sizeText = availableSizes.length > 0 ? `Tallas disponibles: ${availableSizes.join(', ')}.` : 'Consulta disponibilidad por WhatsApp.';
  return truncateText(`${product.equipo} en Herencia 90. ${product.descripcion} ${sizeText} Precio ${formatPrice(product.precio)} y envios a toda Colombia.`);
}

function buildWhatsAppUrl(product, availableSizes) {
  const sizeText = availableSizes.length > 0 ? ` Tallas disponibles: ${availableSizes.join(', ')}.` : '';
  const message = `Hola Herencia 90, me interesa la ${product.equipo}.${sizeText} Vi esta referencia en ${getProductUrl(product)} y quiero confirmar disponibilidad.`;
  return `https://wa.me/573126428153?text=${encodeURIComponent(message)}`;
}

function getRelatedProducts(currentProduct) {
  // Primero las de la misma categoria que tengan stock y foto: son las que se pueden comprar ya.
  const withStockFirst = (list) => [...list].sort((a, b) => Number(getStockTotal(b) > 0) - Number(getStockTotal(a) > 0));
  const hasPhoto = (product) => Array.isArray(product.imagenes) && product.imagenes.length > 0;
  const sameCategory = withStockFirst(products.filter((product) => product.id !== currentProduct.id && product.categoria === currentProduct.categoria && hasPhoto(product)));
  const fallback = withStockFirst(products.filter((product) => product.id !== currentProduct.id && product.categoria !== currentProduct.categoria && hasPhoto(product)));
  return [...sameCategory, ...fallback].slice(0, 3);
}

const SIZE_ORDER = { XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, '2XL': 6, '3XL': 7 };
const PREORDER_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// Tallas para elegir en la ficha. Sin stock la camiseta es bajo pedido y se
// puede pedir en cualquier talla.
function getSizeOptions(product) {
  const entries = Object.entries(product.tallas || {})
    .filter(([size]) => !size.startsWith('R_'))
    .map(([size, qty]) => ({ size, stock: Math.max(0, parseInt(qty, 10) || 0) }))
    .sort((a, b) => (SIZE_ORDER[a.size] || 99) - (SIZE_ORDER[b.size] || 99));
  const total = entries.reduce((sum, item) => sum + item.stock, 0);
  if (total > 0) return { bajoPedido: false, options: entries };
  return { bajoPedido: true, options: PREORDER_SIZES.map((size) => ({ size, stock: 0 })) };
}

function renderSizeOptions(product) {
  const { bajoPedido, options } = getSizeOptions(product);
  return options.map(({ size, stock }) => {
    const available = bajoPedido || stock > 0;
    const note = bajoPedido ? '' : stock > 0 ? `<small>${stock} disp.</small>` : '<small>Agotada</small>';
    return `<button type="button" class="size-option${available ? '' : ' is-out'}${!bajoPedido && stock === 1 ? ' is-low' : ''}" data-size="${escapeHtml(size)}" data-stock="${stock}"${available ? '' : ' disabled'}>${escapeHtml(size)}${note}</button>`;
  }).join('');
}

function getStockLine(product) {
  const { bajoPedido, options } = getSizeOptions(product);
  if (bajoPedido) return { cls: 'is-preorder', text: 'Bajo pedido: llega en 15 a 20 días hábiles' };
  const available = options.filter((item) => item.stock > 0);
  const total = available.reduce((sum, item) => sum + item.stock, 0);
  if (total === 1) return { cls: 'is-low', text: `Última unidad, talla ${available[0].size}` };
  return { cls: 'is-in', text: 'En stock: se despacha de inmediato' };
}

function getFitInfo(product) {
  const text = normalizeText(`${product.equipo || ''} ${product.categoria || ''} ${product.descripcion || ''}`);
  if (/\b(nino|nina|infantil|kid)/.test(text)) return { label: 'Corte niño', text: 'Referencia infantil. Confirma edad, estatura y pecho antes de pedir.' };
  if (/\b(mujer|woman|women|femenino)/.test(text)) return { label: 'Corte femenino', text: 'Horma más ajustada. Compara pecho y largo con una camiseta cómoda.' };
  if (text.includes('player') || text.includes('jugador')) return { label: 'Versión Player', text: 'Horma ajustada al cuerpo, como la usan los jugadores. Si te gusta suelta, pide una talla más.' };
  if (text.includes('retro') || text.includes('leyendas')) return { label: 'Corte clásico', text: 'Horma regular, como la original de su época. Si dudas entre dos tallas, escríbenos.' };
  return { label: 'Versión Fan', text: 'Horma regular y cómoda, para hombre o mujer. Si dudas entre dos tallas, escríbenos.' };
}

function cartImagePath(image) {
  const raw = String(image || 'img/logo-ui.webp').trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `/${normalizeLocalAssetPath(raw)}`;
}

function renderRelatedCards(currentProduct) {
  return getRelatedProducts(currentProduct)
    .map((product) => {
      const productUrl = `/camisetas/${slugify(product.equipo)}`;
      const masterImage = clientAssetUrl(product.imagenes?.[0] || 'img/logo-ui.webp');
      const cardImage = getCardAssetUrl(product.imagenes?.[0] || 'img/logo-ui.webp');
      return `
        <a class="related-card" href="${productUrl}">
          <img src="${escapeHtml(cardImage)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')}" loading="lazy" decoding="async" width="640" height="640"${imageFallbackAttributes(cardImage, masterImage)}>
          <div class="related-copy">
            <strong>${escapeHtml(product.equipo)}</strong>
            <span>${escapeHtml(formatPrice(product.precio))}</span>
          </div>
        </a>
      `;
    })
    .join('');
}

function renderGallery(product) {
  const images = product.imagenes?.length ? product.imagenes : ['img/logo-ui.webp'];
  const mainImage = clientAssetUrl(images[0]);
  const thumbs = images
    .map((image, index) => {
      const masterImage = clientAssetUrl(image);
      const cardImage = getCardAssetUrl(image);
      return `<button class="thumb ${index === 0 ? 'active' : ''}" type="button" data-image="${escapeHtml(masterImage)}"><img src="${escapeHtml(cardImage)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')} - Vista ${index + 1}" loading="lazy" decoding="async" width="640" height="640"${imageFallbackAttributes(cardImage, masterImage)}></button>`;
    })
    .join('');

  // La foto grande se desliza con el dedo (o con las flechas) y las miniaturas
  // quedan en una fila pequena, para que el precio aparezca sin hacer scroll.
  return `
    <div class="product-gallery">
      <div class="main-image-wrap" id="productMainWrap">
        ${getSeasonNumeral(product) ? `<span class="season-numeral" aria-hidden="true">${escapeHtml(getSeasonNumeral(product))}</span>` : ''}
        <img id="productMainImage" class="main-image" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')}" loading="eager" fetchpriority="high" decoding="async" width="1200" height="1500">
        <button type="button" class="gallery-arrow gallery-prev" id="galleryPrev" aria-label="Foto anterior"${images.length > 1 ? '' : ' hidden'}>&#8249;</button>
        <button type="button" class="gallery-arrow gallery-next" id="galleryNext" aria-label="Foto siguiente"${images.length > 1 ? '' : ' hidden'}>&#8250;</button>
        <span class="gallery-count" id="galleryCount"${images.length > 1 ? '' : ' hidden'}>1 / ${images.length}</span>
      </div>
      <div class="thumb-grid">${thumbs}</div>
    </div>
  `;
}

function getOtherCollections(currentCollection) {
  return seoCollections.filter((collection) => collection.slug !== currentCollection.slug);
}

function renderCollectionProductCards(collectionProducts) {
  return collectionProducts
    .map((product) => {
      const availableSizes = getAvailableSizes(product);
      const masterImage = clientAssetUrl(product.imagenes?.[0] || 'img/logo-ui.webp');
      const cardImage = getCardAssetUrl(product.imagenes?.[0] || 'img/logo-ui.webp');
      const productUrl = getProductAliasSlug(product) ? `/camisetas/${getProductAliasSlug(product)}` : `/camisetas/${slugify(product.equipo)}`;
      return `
        <article class="collection-product-card">
          <a class="collection-product-image" href="${productUrl}">
            <img src="${escapeHtml(cardImage)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')}" loading="lazy" decoding="async" width="640" height="640"${imageFallbackAttributes(cardImage, masterImage)}>
          </a>
          <div class="collection-product-copy">
            <span class="collection-product-category">${escapeHtml(product.categoria || 'Herencia 90')}</span>
            <h2><a href="${productUrl}">${escapeHtml(product.equipo)}</a></h2>
            <p>${escapeHtml(truncateText(product.descripcion || 'Consulta disponibilidad por WhatsApp.', 138))}</p>
            <div class="collection-product-meta">
              <span>${escapeHtml(formatPrice(product.precio))}</span>
              <span>${escapeHtml(availableSizes.join(', ') || 'Consultar')}</span>
            </div>
            <div class="collection-product-actions">
              <a class="mini-btn mini-btn-primary" href="${productUrl}">Ver ficha</a>
              <a class="mini-btn mini-btn-secondary" href="${buildWhatsAppUrl(product, availableSizes)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderCollectionPage(collection) {
  const collectionProducts = getCollectionProducts(collection);
  const clientCollectionProducts = collectionProducts.map(pickClientProductFields);
  const cardAssetMap = buildCardAssetMap(collectionProducts);
  const collectionProductIds = collectionProducts.map((product) => product.id);
  const totalStock = collectionProducts.reduce((sum, product) => sum + getStockTotal(product), 0);
  const firstImage = collectionProducts[0]?.imagenes?.[0] ? absoluteAssetUrl(collectionProducts[0].imagenes[0]) : `${siteUrl}/img/logo-ui.webp`;
  const relatedCollections = getOtherCollections(collection).slice(0, 3);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.title,
    description: collection.shortDescription,
    url: getCollectionUrl(collection),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: collectionProducts.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: getProductUrl(product),
        name: product.equipo
      }))
    }
  };
  const staticCollectionPayload = {
    slug: collection.slug,
    name: collection.name,
    eyebrow: collection.eyebrow,
    description: collection.shortDescription,
    productIds: collectionProductIds,
    products: clientCollectionProducts
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(collection.title)}</title>
  <meta name="description" content="${escapeHtml(collection.shortDescription)}">
  <link rel="canonical" href="${getCollectionUrl(collection)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Herencia 90">
  <meta property="og:title" content="${escapeHtml(collection.title)}">
  <meta property="og:description" content="${escapeHtml(collection.shortDescription)}">
  <meta property="og:url" content="${getCollectionUrl(collection)}">
  <meta property="og:image" content="${firstImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(collection.title)}">
  <meta name="twitter:description" content="${escapeHtml(collection.shortDescription)}">
  <meta name="twitter:image" content="${firstImage}">
  <link rel="icon" href="../img/favicon.webp" type="image/webp">
${renderDeferredGa4()}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap">
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet"></noscript>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root {
      --bg-dark: #f8fafc;
      --card-bg: #ffffff;
      --gold: #85692f;
      --gold-hover: #6f5524;
      --text-primary: #172033;
      --text-secondary: #556070;
      --glass-border: rgba(15, 23, 42, 0.1);
      --whatsapp: #0f7a41;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
      color: var(--text-primary);
      background: #f8fafc;
    }
    h1, h2, h3, .stat-number { font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; text-transform: none; letter-spacing: -0.02em; font-weight: 760; font-stretch: 78%; }
    a { color: inherit; }
    @keyframes grow-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    .scroll-progress {
      position: fixed; top: 0; left: 0; width: 100%; height: 3px;
      background: linear-gradient(90deg, #a38c59, #d9c391, #f7e6c1);
      transform-origin: left; transform: scaleX(0);
      animation: grow-progress linear; animation-timeline: scroll(root);
      z-index: 9999; pointer-events: none;
    }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #a38c59; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #d9c391; }
    :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 4px; }
    :focus:not(:focus-visible) { outline: none; }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
      .scroll-progress { display: none; }
      [data-aos] { opacity: 1 !important; transform: none !important; transition: none !important; }
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--glass-border);
    }
    .topbar a {
      text-decoration: none;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.86rem;
    }
    .topbar a:hover { color: var(--gold); }
    .topbar img { width: auto; height: 42px; }
    .page-shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 34px 18px 80px;
    }
    .breadcrumbs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--text-secondary);
      font-size: 0.82rem;
      margin-bottom: 20px;
    }
    .breadcrumbs a {
      text-decoration: none;
      color: inherit;
    }
    .breadcrumbs a:hover { color: var(--gold); }
    .collection-hero,
    .collection-products,
    .collection-benefits,
    .collection-links {
      background: var(--card-bg);
      border: 1px solid var(--glass-border);
      border-radius: 26px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
      backdrop-filter: blur(14px);
    }
    .collection-hero {
      padding: 30px;
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(240px, 0.9fr);
      gap: 24px;
      align-items: start;
    }
    .eyebrow {
      display: inline-flex;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid rgba(217, 195, 145, 0.26);
      background: rgba(217, 195, 145, 0.08);
      color: var(--gold);
      text-transform: none;
      letter-spacing: 1.2px;
      font-size: 0.72rem;
      font-weight: 700;
      margin-bottom: 14px;
    }
    h1 {
      margin: 0 0 14px;
      font-size: clamp(2.1rem, 4vw, 3.9rem);
      line-height: 1.02;
    }
    .collection-hero p {
      color: var(--text-secondary);
      font-size: 0.98rem;
      line-height: 1.7;
      margin: 0 0 18px;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 20px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 700;
      text-transform: none;
      letter-spacing: 0.8px;
      font-size: 0.82rem;
    }
    .btn-primary {
      background: var(--whatsapp);
      color: white;
      box-shadow: 0 10px 24px rgba(37,211,102,0.25);
    }
    .btn-secondary {
      border: 1px solid rgba(217, 195, 145, 0.32);
      color: var(--gold);
      background: rgba(217, 195, 145, 0.08);
    }
    .collection-stats {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }
    .stat-box {
      padding: 16px;
      border-radius: 18px;
      border: 1px solid rgba(15,23,42,0.08);
      background: #f8fafc;
    }
    .stat-number {
      display: block;
      color: var(--gold);
      font-size: 1.9rem;
      line-height: 1;
      margin-bottom: 6px;
    }
    .stat-box span {
      color: var(--text-secondary);
      font-size: 0.86rem;
    }
    .collection-products,
    .collection-benefits,
    .collection-links {
      margin-top: 26px;
      padding: 24px;
    }
    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 14px;
      margin-bottom: 18px;
    }
    .section-head h2 {
      margin: 0;
      font-size: 1.55rem;
      color: var(--gold);
    }
    .section-head p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .collection-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }
    .collection-product-card {
      display: flex;
      flex-direction: column;
      border-radius: 22px;
      overflow: hidden;
      border: 1px solid rgba(15,23,42,0.08);
      background: #f8fafc;
    }
    .collection-product-image {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 270px;
      background: radial-gradient(circle, #ffffff 0%, #f1f5f9 100%);
      padding: 20px;
      text-decoration: none;
    }
    .collection-product-image img {
      width: 100%;
      max-height: 230px;
      object-fit: contain;
      filter: drop-shadow(0 12px 20px rgba(15, 23, 42, 0.12));
    }
    .collection-product-copy {
      padding: 18px;
    }
    .collection-product-category {
      display: inline-flex;
      margin-bottom: 10px;
      color: var(--gold);
      font-size: 0.72rem;
      text-transform: none;
      letter-spacing: 0.9px;
      font-weight: 700;
    }
    .collection-product-copy h2 {
      margin: 0 0 10px;
      font-size: 1.2rem;
      line-height: 1.15;
    }
    .collection-product-copy h2 a {
      color: var(--text-primary);
      text-decoration: none;
    }
    .collection-product-copy p {
      margin: 0 0 14px;
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.55;
    }
    .collection-product-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
      color: var(--gold-hover);
      font-size: 0.82rem;
      font-weight: 700;
    }
    .collection-product-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .mini-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-decoration: none;
      text-transform: none;
      letter-spacing: 0.8px;
    }
    .mini-btn-primary {
      background: rgba(217, 195, 145, 0.14);
      color: var(--gold);
      border: 1px solid rgba(217, 195, 145, 0.24);
    }
    .mini-btn-secondary {
      background: #e5f3ea;
      color: #0f7a41;
      border: 1px solid rgba(15, 122, 65, 0.24);
    }
    .benefit-grid,
    .links-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .benefit-card,
    .link-card {
      padding: 18px;
      border-radius: 18px;
      border: 1px solid rgba(15,23,42,0.08);
      background: #f8fafc;
    }
    .benefit-card strong,
    .link-card strong {
      display: block;
      margin-bottom: 8px;
      color: var(--gold);
      font-size: 0.95rem;
    }
    .benefit-card p,
    .link-card p {
      margin: 0;
      color: var(--text-secondary);
      font-size: 0.88rem;
      line-height: 1.55;
    }
    .link-card a {
      text-decoration: none;
      color: inherit;
      display: block;
    }
    @media (max-width: 980px) {
      .collection-hero,
      .collection-grid,
      .benefit-grid,
      .links-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="scroll-progress" aria-hidden="true"></div>
  <header class="topbar">
    <a href="/catalogo">Ver catalogo</a>
    <img src="../img/logo-ui.webp" alt="Herencia 90" width="220" height="249" decoding="async">
    <a href="/preventa">Pre-venta</a>
  </header>

  <main class="page-shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Inicio</a>
      <span>/</span>
      <span>${collection.type === 'city' ? 'Ciudades' : 'Categorias'}</span>
      <span>/</span>
      <span>${escapeHtml(collection.name)}</span>
    </nav>

    <section class="collection-hero">
      <div>
        <span class="eyebrow">${escapeHtml(collection.eyebrow)}</span>
        <h1 id="collectionTitle">${escapeHtml(collection.name)}</h1>
        <p>${escapeHtml(collection.intro)}</p>
        <p id="collectionDescription">${escapeHtml(collection.shortDescription)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="https://wa.me/573126428153?text=${encodeURIComponent(`Hola Herencia 90, quiero ver referencias de la coleccion ${collection.name}. Vi esta pagina ${getCollectionUrl(collection)} y quiero disponibilidad.`)}" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a>
          <a class="btn btn-secondary" href="/#catalogo">Ver todo el catalogo</a>
        </div>
      </div>
      <div class="collection-stats">
        <div class="stat-box">
          <strong class="stat-number" id="collectionCount">${collectionProducts.length}</strong>
          <span>referencias activas</span>
        </div>
        <div class="stat-box">
          <strong class="stat-number">${totalStock}</strong>
          <span>unidades visibles en stock</span>
        </div>
        <div class="stat-box">
          <strong class="stat-number">2 x 180</strong>
          <span>promo solo refs seleccionadas de $99.000</span>
        </div>
      </div>
    </section>

    <section class="collection-products">
      <div class="section-head">
        <div>
          <h2>Referencias de la coleccion</h2>
          <p id="collectionCountLabel">${collectionProducts.length} productos listados con ficha propia</p>
        </div>
      </div>
      <div id="collectionProducts" class="collection-grid">
        ${renderCollectionProductCards(collectionProducts)}
      </div>
    </section>

    <section class="collection-benefits">
      <div class="section-head">
        <div>
          <h2>Compra con confianza</h2>
          <p>${escapeHtml(collection.faqTitle)}</p>
        </div>
      </div>
      <div class="benefit-grid">
        <article class="benefit-card">
          <strong>Pago contra entrega</strong>
          <p>Pagas cuando la camiseta llega a tu casa, en cualquier ciudad del pais.</p>
        </article>
        <article class="benefit-card">
          <strong>Stock al dia</strong>
          <p>El precio y las tallas que ves son los de hoy. Si una talla se agota, la puedes pedir bajo pedido.</p>
        </article>
        <article class="benefit-card">
          <strong>Cambio de talla en 7 dias</strong>
          <p>Si la talla no te queda, la cambias. Sin usar y con etiquetas; no aplica a personalizadas.</p>
        </article>
      </div>
    </section>

    <section class="collection-links">
      <div class="section-head">
        <div>
          <h2>Explora otras colecciones</h2>
          <p>Mas camisetas por equipo, seleccion y temporada</p>
        </div>
      </div>
      <div class="links-grid">
        ${relatedCollections.map((relatedCollection) => `
          <article class="link-card">
            <a href="/categorias/${relatedCollection.slug}">
              <strong>${escapeHtml(relatedCollection.name)}</strong>
              <p>${escapeHtml(relatedCollection.shortDescription)}</p>
            </a>
          </article>
        `).join('')}
      </div>
    </section>
  </main>

  <script>
    const SUPABASE_URL = ${serializeForScript(supabaseUrl)};
    const SUPABASE_ANON_KEY = ${serializeForScript(supabaseAnonKey)};
    const STATIC_COLLECTION = ${serializeForScript(staticCollectionPayload)};
    const STATIC_CARD_ASSETS = ${serializeForScript(cardAssetMap)};
    let dbPromise;
    let renderedCollectionSignature = collectionSignature(STATIC_COLLECTION.products);

    function loadExternalScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-src="' + src + '"]');
        if (existing) {
          if (existing.dataset.loaded === 'true') resolve();
          else existing.addEventListener('load', resolve, { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.src = src;
        script.addEventListener('load', () => {
          script.dataset.loaded = 'true';
          resolve();
        }, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
      });
    }

    function loadExternalStyle(href) {
      if (document.querySelector('link[data-href="' + href + '"]')) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.media = 'print';
      link.dataset.href = href;
      link.onload = () => { link.media = 'all'; };
      document.head.appendChild(link);
    }

    function runWhenIdle(callback) {
      const schedule = () => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 3500 });
        else window.setTimeout(callback, 1);
      };
      if (document.readyState === 'complete') schedule();
      else window.addEventListener('load', schedule, { once: true });
    }

    function getDb() {
      if (!dbPromise) {
        dbPromise = loadExternalScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js')
          .then(() => window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
      }
      return dbPromise;
    }

    function loadOptionalEnhancements() {
      loadExternalStyle('https://unpkg.com/aos@2.3.4/dist/aos.css');
      loadExternalScript('https://unpkg.com/aos@2.3.4/dist/aos.js')
        .then(() => window.AOS?.init({ duration: 600, easing: 'ease-out-cubic', once: true, offset: 60 }))
        .catch(() => {});
    }

    function slugifyText(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    function escapeHtmlClient(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatPriceClient(value) {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
    }

    function collectionSignature(items) {
      return (Array.isArray(items) ? items : [])
        .map((product) => [
          product.id,
          product.equipo,
          product.categoria,
          product.descripcion,
          product.precio,
          JSON.stringify(product.tallas || {}),
          JSON.stringify(product.imagenes || [])
        ].join('|'))
        .sort()
        .join('||');
    }

    function getAvailableSizesClient(product) {
      return Object.entries(product.tallas || {})
        .filter(([, qty]) => Number(qty || 0) > 0)
        .map(([size]) => size);
    }

    function getImageClient(product) {
      const image = product.imagenes && product.imagenes.length ? product.imagenes[0] : 'img/logo-ui.webp';
      const masterUrl = /^https?:\\/\\//i.test(image) ? image : '../' + image.replace(/^(?:\\.\\.\\/)+/, '').replace(/^\\/+/, '');
      return STATIC_CARD_ASSETS[image] || { cardUrl: masterUrl, masterUrl };
    }

    function buildProductUrlClient(product) {
      return '/camisetas/' + slugifyText(product.equipo);
    }

    function buildProductWhatsAppClient(product) {
      const sizes = getAvailableSizesClient(product);
      const sizeText = sizes.length ? ' Tallas disponibles: ' + sizes.join(', ') + '.' : '';
      const message = 'Hola Herencia 90, me interesa la ' + product.equipo + '.' + sizeText + ' Vi esta referencia en ' + buildProductUrlClient(product) + ' y quiero confirmar disponibilidad.';
      return 'https://wa.me/573126428153?text=' + encodeURIComponent(message);
    }

    function buildCollectionCard(product) {
      const sizes = getAvailableSizesClient(product);
      const image = getImageClient(product);
      const fallback = image.cardUrl === image.masterUrl ? '' : ' data-fallback-src="' + escapeHtmlClient(image.masterUrl) + '" onerror="this.onerror=null;this.src=this.dataset.fallbackSrc"';
      return '<article class="collection-product-card">' +
        '<a class="collection-product-image" href="' + buildProductUrlClient(product) + '">' +
          '<img src="' + escapeHtmlClient(image.cardUrl) + '" alt="' + escapeHtmlClient(product.equipo) + '" loading="lazy" decoding="async" width="640" height="640"' + fallback + '>' +
        '</a>' +
        '<div class="collection-product-copy">' +
          '<span class="collection-product-category">' + escapeHtmlClient(product.categoria || 'Herencia 90') + '</span>' +
          '<h2><a href="' + buildProductUrlClient(product) + '">' + escapeHtmlClient(product.equipo) + '</a></h2>' +
          '<p>' + escapeHtmlClient(product.descripcion || 'Consulta disponibilidad por WhatsApp.') + '</p>' +
          '<div class="collection-product-meta">' +
            '<span>' + formatPriceClient(product.precio) + '</span>' +
            '<span>' + escapeHtmlClient(sizes.join(', ') || 'Consultar') + '</span>' +
          '</div>' +
          '<div class="collection-product-actions">' +
            '<a class="mini-btn mini-btn-primary" href="' + buildProductUrlClient(product) + '">Ver ficha</a>' +
            '<a class="mini-btn mini-btn-secondary" href="' + buildProductWhatsAppClient(product) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
          '</div>' +
        '</div>' +
      '</article>';
    }

    function renderCollectionProducts(products) {
      const root = document.getElementById('collectionProducts');
      if (!root) return;

      const safeProducts = Array.isArray(products) ? products : [];
      const nextCollectionSignature = collectionSignature(safeProducts);
      if (nextCollectionSignature === renderedCollectionSignature) return;
      renderedCollectionSignature = nextCollectionSignature;
      document.getElementById('collectionCount').textContent = safeProducts.length;
      document.getElementById('collectionCountLabel').textContent = safeProducts.length + ' productos listados con ficha propia';

      if (safeProducts.length === 0) {
        root.innerHTML = '<p style="color:#a9a9a9;">No hay referencias visibles en esta coleccion por ahora.</p>';
        return;
      }

      root.innerHTML = safeProducts.map(buildCollectionCard).join('');
    }

    async function trackCollectionPage() {
      try {
        const db = await getDb();
        await db.from('analytics_events').insert({
          event_type: 'page_view',
          product_id: null,
          product_name: null,
          category: STATIC_COLLECTION.name,
          extra: { source: 'seo_collection_page' },
          referrer: document.referrer || null
        });
      } catch (error) {
        // Analytics nunca interrumpe la experiencia del usuario
      }
    }

    async function refreshCollectionFromSupabase() {
      if (!STATIC_COLLECTION.productIds.length) return;

      try {
        const db = await getDb();
        const { data, error } = await db.from('productos').select('id,equipo,categoria,descripcion,precio,tallas,imagenes').in('id', STATIC_COLLECTION.productIds).order('id');
        if (error || !data) return;
        renderCollectionProducts(data);
      } catch (error) {
        // Mantener contenido estatico como respaldo
      }
    }

    async function startCollectionLiveSync() {
      const db = await getDb();
      trackCollectionPage();
      refreshCollectionFromSupabase();
      db.channel('seo-collection-live-${collection.slug}')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos' }, (payload) => {
          if (payload && payload.new && STATIC_COLLECTION.productIds.includes(payload.new.id)) {
            refreshCollectionFromSupabase();
          }
        })
        .subscribe();
    }

    runWhenIdle(() => {
      startCollectionLiveSync().catch(() => {});
      loadOptionalEnhancements();
    });
  </script>
</body>
</html>`;
}

function renderPreventaPage(item) {
  const slug = slugify(item.slug || item.equipo);
  const title = buildPreventaTitle(item);
  const description = buildPreventaMetaDescription(item);
  const price = getPreventaPrice(item);
  const imageUrls = getPreventaGalleryImageUrls(item);
  const categoryLabel = item.categoria === 'selecciones' ? 'Selecciones' : 'Clubes';
  const tipoLabel = formatPreventaTipo(item);
  const related = preventaItems
    .filter((candidate) => candidate.slug !== item.slug && candidate.categoria === item.categoria)
    .slice(0, 4);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: title,
        image: imageUrls,
        description,
        brand: {
          '@type': 'Brand',
          name: 'Herencia 90'
        },
        sku: `H90-PV-${slug}`,
        category: `${categoryLabel} / ${tipoLabel}`,
        url: getPreventaUrl(item),
        offers: {
          '@type': 'Offer',
          url: getPreventaUrl(item),
          priceCurrency: 'COP',
          price,
          availability: 'https://schema.org/PreOrder',
          itemCondition: 'https://schema.org/NewCondition',
          seller: {
            '@type': 'Organization',
            name: 'Herencia 90'
          }
        }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Pre-venta', item: `${siteUrl}/preventa` },
          { '@type': 'ListItem', position: 3, name: title, item: getPreventaUrl(item) }
        ]
      }
    ]
  };

  const gallery = imageUrls
    .map((url, index) => `        <img src="${escapeHtml(url)}" alt="${escapeHtml(title)} foto ${index + 1}" loading="${index === 0 ? 'eager' : 'lazy'}"${index === 0 ? ' fetchpriority="high"' : ''} decoding="async" width="1200" height="1200">`)
    .join('\n');
  const relatedCards = related.map((candidate) => {
    const relatedImage = getPreventaImageUrl(candidate.imagenes?.[0]);
    return `        <a class="related-card" href="/preventa/${slugify(candidate.slug || candidate.equipo)}">
          <img src="${escapeHtml(relatedImage)}" alt="${escapeHtml(buildPreventaTitle(candidate))}" loading="lazy" decoding="async" width="640" height="640">
          <span>${escapeHtml(buildPreventaTitle(candidate))}</span>
        </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | Pre-venta Herencia 90</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${getPreventaUrl(item)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Herencia 90">
  <meta property="og:title" content="${escapeHtml(title)} | Herencia 90">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${getPreventaUrl(item)}">
  <meta property="og:image" content="${escapeHtml(imageUrls[0])}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)} | Herencia 90">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrls[0])}">
  <link rel="icon" href="/img/favicon.webp" type="image/webp">
${renderDeferredGa4()}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap">
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet"></noscript>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root { --bg:#f8fafc; --panel:#ffffff; --gold:#85692f; --gold-soft:#f3ead4; --text:#172033; --muted:#556070; --line:rgba(15,23,42,.1); --wa:#0f7a41; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:'Archivo','Helvetica Neue',Arial,sans-serif; color:var(--text); background:var(--bg); }
    h1,h2,.price { font-family:'Archivo','Helvetica Neue',Arial,sans-serif; text-transform:none; letter-spacing:-.02em; font-weight:760; font-stretch:78%; }
    a { color:inherit; }
    .topbar { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:10px max(18px,env(safe-area-inset-right,0px)) 10px max(18px,env(safe-area-inset-left,0px)); border-bottom:1px solid var(--line); background:rgba(255,255,255,.94); position:sticky; top:0; z-index:5; backdrop-filter:blur(12px); }
    .topbar img { width:auto; height:42px; display:block; }
    .topbar a { color:var(--muted); text-decoration:none; font-weight:700; font-size:.84rem; }
    .topbar a:hover { color:var(--gold); }
    .shell { max-width:1180px; margin:0 auto; padding:24px max(18px,env(safe-area-inset-right,0px)) 72px max(18px,env(safe-area-inset-left,0px)); }
    .breadcrumbs { display:flex; flex-wrap:wrap; gap:8px; color:var(--muted); font-size:.8rem; margin-bottom:18px; }
    .breadcrumbs a { text-decoration:none; }
    .layout { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr); gap:28px; align-items:start; }
    .gallery,.panel,.trust,.related { background:var(--panel); border:1px solid var(--line); border-radius:18px; }
    .gallery { padding:16px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .gallery img { width:100%; aspect-ratio:1/1; object-fit:contain; background:#f1f5f9; border-radius:12px; }
    .panel { padding:26px; position:sticky; top:84px; }
    .eyebrow { display:inline-flex; padding:5px 12px; border-radius:999px; color:#6f5524; background:var(--gold-soft); font-size:.68rem; text-transform:none; letter-spacing:1px; font-weight:800; margin-bottom:12px; }
    h1 { margin:0 0 10px; font-size:clamp(1.6rem,3.2vw,2.6rem); line-height:1.08; text-wrap:balance; }
    .description { color:var(--muted); line-height:1.6; margin:0 0 16px; font-size:.92rem; }
    .price { color:var(--gold); font-size:2rem; margin:0 0 16px; }
    .meta { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-bottom:20px; }
    .meta div { border:1px solid var(--line); border-radius:12px; padding:12px; background:#f8fafc; }
    .meta strong { display:block; color:var(--text); font-size:.74rem; text-transform:none; letter-spacing:.6px; margin-bottom:4px; }
    .meta span { color:var(--muted); font-size:.86rem; }
    .actions { display:grid; grid-template-columns:1fr; gap:10px; }
    .btn { min-height:52px; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:0 20px; font-weight:650; text-transform:none; text-decoration:none; letter-spacing:0; font-size:1rem; }
    .btn-primary { background:#141a2b; color:#fff; }
    .btn-primary:hover { background:#2a3247; }
    .btn-secondary { border:1.5px solid var(--text); color:var(--text); background:#fff; }
    .microcopy { color:var(--muted); font-size:.8rem; margin:14px 0 0; line-height:1.55; }
    .trust,.related { margin-top:26px; padding:22px; }
    .trust-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
    .trust-grid div { border:1px solid var(--line); border-radius:12px; padding:16px; background:#f8fafc; }
    .trust-grid strong { color:var(--text); display:block; margin-bottom:6px; }
    .trust-grid p { margin:0; color:var(--muted); line-height:1.55; font-size:.88rem; }
    .related h2 { margin:0 0 14px; font-size:1.3rem; }
    .related-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
    .related-card { text-decoration:none; border:1px solid var(--line); border-radius:14px; overflow:hidden; background:#fff; }
    .related-card:hover { border-color:var(--gold); }
    .related-card img { width:100%; aspect-ratio:1/1; object-fit:contain; background:#f1f5f9; display:block; }
    .related-card span { display:block; padding:12px; color:var(--text); font-size:.82rem; font-weight:800; }
    /* En celular las fotos se deslizan de lado y el precio queda arriba */
    @media (max-width:820px) {
      .layout,.trust-grid { grid-template-columns:1fr; gap:16px; }
      .related-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .gallery { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; padding:8px; gap:8px; scrollbar-width:none; }
      .gallery::-webkit-scrollbar { display:none; }
      .gallery img { flex:0 0 86%; scroll-snap-align:center; max-height:46vh; }
      .panel { padding:18px; position:static; }
      .shell { padding-top:12px; }
      .breadcrumbs { display:none; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <a href="/preventa">Volver a pre-venta</a>
    <a href="/"><img src="/img/logo-ui.webp" alt="Herencia 90" width="220" height="249" decoding="async"></a>
    <a href="/catalogo">Catalogo</a>
  </header>
  <main class="shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Inicio</a><span>/</span><a href="/preventa">Pre-venta</a><span>/</span><span>${escapeHtml(title)}</span>
    </nav>
    <section class="layout">
      <div class="gallery">${gallery}</div>
      <article class="panel">
        <span class="eyebrow">${escapeHtml(categoryLabel)} · ${escapeHtml(tipoLabel)}</span>
        <h1>${escapeHtml(title)}</h1>
        <div class="price">${escapeHtml(formatPrice(price))}</div>
        <p class="description">${escapeHtml(description)}</p>
        <div class="meta">
          <div><strong>Entrega</strong><span>Pre-venta aprox. 15 dias</span></div>
          <div><strong>Anticipo</strong><span>20% para separar</span></div>
          <div><strong>Temporada</strong><span>${escapeHtml(item.temporada || 'Consultar')}</span></div>
          <div><strong>Fotos</strong><span>${imageUrls.length} fotos de proveedor</span></div>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="${buildPreventaWhatsAppUrl(item)}" target="_blank" rel="noopener noreferrer">Pedir por WhatsApp</a>
          <a class="btn btn-secondary" href="/preventa">Ver mas referencias</a>
        </div>
        <p class="microcopy">Confirmamos talla, version, precio final y extras antes de pedir. Las imagenes son referencia de proveedor y pueden variar levemente segun lote.</p>
      </article>
    </section>
    <section class="trust">
      <div class="trust-grid">
        <div><strong>Compra guiada</strong><p>Te atendemos por WhatsApp para evitar errores de talla, version o referencia.</p></div>
        <div><strong>Envio Colombia</strong><p>Despacho nacional con seguimiento y soporte durante el proceso.</p></div>
        <div><strong>Pre-venta clara</strong><p>Anticipo del 20%, entrega aproximada de 15 dias y confirmacion antes de cerrar el pedido.</p></div>
      </div>
    </section>
    ${relatedCards ? `<section class="related"><h2>Tambien puede gustarte</h2><div class="related-grid">${relatedCards}</div></section>` : ''}
  </main>
</body>
</html>`;
}

function renderProductPage(product) {
  const slug = slugify(product.equipo);
  const availableSizes = getAvailableSizes(product);
  const description = buildMetaDescription(product, availableSizes);
  const imageUrls = (product.imagenes?.length ? product.imagenes : ['img/logo-ui.webp']).map(absoluteAssetUrl);
  const cardAssetMap = buildCardAssetMap([product]);
  const stockLine = getStockLine(product);
  const fit = getFitInfo(product);
  const { bajoPedido } = getSizeOptions(product);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.equipo,
    image: imageUrls,
    description: product.descripcion,
    brand: {
      '@type': 'Brand',
      name: 'Herencia 90'
    },
    sku: `HERENCIA90-${product.id}`,
    category: product.categoria,
    url: getProductUrl(product),
    offers: {
      '@type': 'Offer',
      url: getProductUrl(product),
      priceCurrency: 'COP',
      price: product.precio,
      availability: getStockTotal(product) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Herencia 90'
      }
    }
  };
  const staticProductPayload = pickClientProductFields(product);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#ffffff">
  <title>${escapeHtml(product.equipo)} | Herencia 90 Colombia</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${getProductUrl(product)}">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Herencia 90">
  <meta property="og:title" content="${escapeHtml(product.equipo)} | Herencia 90 Colombia">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${getProductUrl(product)}">
  <meta property="og:image" content="${imageUrls[0]}">
  <meta property="og:image:alt" content="${escapeHtml(product.equipo)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(product.equipo)} | Herencia 90 Colombia">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${imageUrls[0]}">
  <link rel="icon" href="../img/favicon.webp" type="image/webp">
${renderDeferredGa4()}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap">
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap" rel="stylesheet"></noscript>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
${PRODUCT_PAGE_STYLES}
  </style>
</head>
<body>
  <header class="topbar">
    <a class="topbar-logo" href="/"><img src="../img/logo-ui.webp" alt="Herencia 90" width="220" height="249" decoding="async"></a>
    <nav class="topbar-nav" aria-label="Navegacion">
      <a href="/catalogo">Catálogo</a>
      <a href="/preventa">Pre-orden</a>
      <a href="/catalogo.html#carrito" class="topbar-cart">Carrito <span id="topbarCartCount">0</span></a>
    </nav>
  </header>

  <main class="page-shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Inicio</a>
      <span>/</span>
      <a href="/catalogo">Catálogo</a>
      <span>/</span>
      <span>${escapeHtml(product.equipo)}</span>
    </nav>

    <section class="hero-layout">
      ${renderGallery(product)}
      <div class="product-panel">
        <span id="productCategory" class="eyebrow">${escapeHtml(product.categoria)}</span>
        <h1 id="productTitle">${escapeHtml(product.equipo)}</h1>
        <div id="productPrice" class="price">${escapeHtml(formatPrice(product.precio))}</div>
        <p id="productStock" class="stock-line ${stockLine.cls}">${escapeHtml(stockLine.text)}</p>

        <div class="size-head">
          <strong>Elige tu talla</strong>
          <a class="size-guide-link" href="/img/guia-tallas-herencia90-vertical.png" target="_blank" rel="noopener">Guía de tallas</a>
        </div>
        <div id="productSizeList" class="size-list">${renderSizeOptions(product)}</div>
        <p class="fit-note"><strong>${escapeHtml(fit.label)}:</strong> ${escapeHtml(fit.text)}</p>
        <p id="sizeHint" class="size-hint" hidden>Elige una talla primero.</p>

        <div class="actions">
          <a id="productWhatsAppBtn" class="btn btn-primary" href="${buildWhatsAppUrl(product, availableSizes)}" target="_blank" rel="noopener noreferrer">${bajoPedido ? 'Pedir bajo pedido por WhatsApp' : 'Comprar por WhatsApp'}</a>
          <button id="productAddCartBtn" class="btn btn-secondary" type="button">Agregar al carrito</button>
        </div>
        <p id="cartAdded" class="cart-added" hidden>Agregada al carrito. <a href="/catalogo.html#carrito">Ver carrito</a></p>

        <ul class="meta-list">
          <li><strong>Pago contra entrega</strong><span>Pagas cuando te llega, en todo el país.</span></li>
          <li><strong>Envío a toda Colombia</strong><span>Despacho desde Medellín con seguimiento.</span></li>
          <li><strong>Cambio de talla en 7 días</strong><span>Sin usar y con etiquetas.</span></li>
          ${Number(product.precio) === 99000 ? '<li><strong>Promo 2 x $180.000</strong><span>En referencias seleccionadas de $99.000.</span></li>' : ''}
        </ul>

        <div class="description-block">
          <h2>Descripción</h2>
          <p id="productDescription" class="description">${escapeHtml(product.descripcion)}</p>
          <p class="microcopy">Si quieres nombre, número o parches, también te cotizamos esos extras por WhatsApp.</p>
        </div>
      </div>
    </section>

    <section class="related-section">
      <h2>También te puede interesar</h2>
      <div class="related-grid">
        ${renderRelatedCards(product)}
      </div>
    </section>
  </main>

  <div class="mobile-buy-bar" aria-label="Compra rapida">
    <div class="mobile-buy-copy">
      <strong id="mobileBuyTitle">${escapeHtml(product.equipo)}</strong>
      <span id="mobileBuyPrice">${escapeHtml(formatPrice(product.precio))}</span>
    </div>
    <a id="mobileWhatsAppBtn" class="btn btn-primary" href="${buildWhatsAppUrl(product, availableSizes)}" target="_blank" rel="noopener noreferrer">Comprar</a>
  </div>

  <script>
    const SUPABASE_URL = ${serializeForScript(supabaseUrl)};
    const SUPABASE_ANON_KEY = ${serializeForScript(supabaseAnonKey)};
    const STATIC_PRODUCT = ${serializeForScript(staticProductPayload)};
    const STATIC_CARD_ASSETS = ${serializeForScript(cardAssetMap)};
    const PRODUCT_URL = ${serializeForScript(getProductUrl(product))};
    const FIT_LABEL = ${serializeForScript(fit.label)};
    const CART_IMAGE = ${serializeForScript(cartImagePath(product.imagenes?.[0]))};
    const CART_KEY = 'herencia90_cart';
    const SIZE_ORDER = { XS: 1, S: 2, M: 3, L: 4, XL: 5, XXL: 6, '2XL': 6, '3XL': 7 };
    let dbPromise;
    let currentProduct = STATIC_PRODUCT;
    let renderedImageSignature = imageSignature(STATIC_PRODUCT.imagenes);
    let selectedSize = '';
    let galleryIndex = 0;

    function loadExternalScript(src) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-src="' + src + '"]');
        if (existing) {
          if (existing.dataset.loaded === 'true') resolve();
          else existing.addEventListener('load', resolve, { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.src = src;
        script.addEventListener('load', () => {
          script.dataset.loaded = 'true';
          resolve();
        }, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
      });
    }

    function runWhenIdle(callback) {
      const schedule = () => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 3500 });
        else window.setTimeout(callback, 1);
      };
      if (document.readyState === 'complete') schedule();
      else window.addEventListener('load', schedule, { once: true });
    }

    function getDb() {
      if (!dbPromise) {
        dbPromise = loadExternalScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js')
          .then(() => window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
      }
      return dbPromise;
    }

    function formatPriceClient(value) {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
    }

    function getSizeEntriesClient(product) {
      return Object.entries(product.tallas || {})
        .filter(([size]) => !size.startsWith('R_'))
        .map(([size, qty]) => ({ size, stock: Math.max(0, parseInt(qty, 10) || 0) }))
        .sort((a, b) => (SIZE_ORDER[a.size] || 99) - (SIZE_ORDER[b.size] || 99));
    }

    function getAvailableSizesClient(product) {
      return getSizeEntriesClient(product).filter((item) => item.stock > 0).map((item) => item.size);
    }

    function isBajoPedidoClient(product) {
      return getAvailableSizesClient(product).length === 0;
    }

    function buildWhatsAppClient(product, size) {
      const bajoPedido = isBajoPedidoClient(product);
      let message;
      if (size) {
        message = bajoPedido
          ? 'Hola Herencia 90, quiero pedir bajo pedido la ' + product.equipo + ' en talla ' + size + '. Vi esta referencia en ' + PRODUCT_URL + '. Entiendo que llega en 15 a 20 dias habiles.'
          : 'Hola Herencia 90, quiero comprar la ' + product.equipo + ' en talla ' + size + '. Vi esta referencia en ' + PRODUCT_URL + ' y quiero confirmar disponibilidad.';
      } else {
        const sizes = getAvailableSizesClient(product);
        const sizeText = sizes.length > 0 ? ' Tallas disponibles: ' + sizes.join(', ') + '.' : '';
        message = 'Hola Herencia 90, me interesa la ' + product.equipo + '.' + sizeText + ' Vi esta referencia en ' + PRODUCT_URL + ' y quiero confirmar disponibilidad.';
      }
      return 'https://wa.me/573126428153?text=' + encodeURIComponent(message);
    }

    function escapeHtmlClient(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function imageSignature(images) {
      return JSON.stringify(Array.isArray(images) ? images : []);
    }

    function getImageAssetClient(image) {
      const raw = String(image || 'img/logo-ui.webp');
      const masterUrl = /^https?:\\/\\//i.test(raw) ? raw : '../' + raw.replace(/^(?:\\.\\.\\/)+/, '').replace(/^\\/+/, '');
      return STATIC_CARD_ASSETS[raw] || { cardUrl: masterUrl, masterUrl };
    }

    function buildThumbGrid(images, title) {
      return images.map((image, index) => {
        const asset = getImageAssetClient(image);
        const activeClass = index === 0 ? ' active' : '';
        const fallback = asset.cardUrl === asset.masterUrl ? '' : ' data-fallback-src="' + escapeHtmlClient(asset.masterUrl) + '" onerror="this.onerror=null;this.src=this.dataset.fallbackSrc"';
        return '<button class="thumb' + activeClass + '" type="button" data-image="' + escapeHtmlClient(asset.masterUrl) + '"><img src="' + escapeHtmlClient(asset.cardUrl) + '" alt="' + escapeHtmlClient(title) + ' vista ' + (index + 1) + '" loading="lazy" decoding="async" width="640" height="640"' + fallback + '></button>';
      }).join('');
    }

    // ── Galeria: miniaturas, flechas y deslizar con el dedo ──
    function showImage(index) {
      const thumbs = Array.from(document.querySelectorAll('.thumb'));
      if (!thumbs.length) return;
      galleryIndex = (index + thumbs.length) % thumbs.length;
      const mainImage = document.getElementById('productMainImage');
      if (mainImage) mainImage.src = thumbs[galleryIndex].dataset.image;
      thumbs.forEach((thumb, i) => thumb.classList.toggle('active', i === galleryIndex));
      const count = document.getElementById('galleryCount');
      if (count) count.textContent = (galleryIndex + 1) + ' / ' + thumbs.length;
      const active = thumbs[galleryIndex];
      const row = active.parentElement;
      if (row) row.scrollTo({ left: active.offsetLeft - (row.clientWidth - active.clientWidth) / 2, behavior: 'smooth' });
    }

    function bindThumbs() {
      document.querySelectorAll('.thumb').forEach((button, index) => {
        button.onclick = () => showImage(index);
      });
      const total = document.querySelectorAll('.thumb').length;
      ['galleryPrev', 'galleryNext', 'galleryCount'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = total < 2;
      });
      galleryIndex = 0;
      const count = document.getElementById('galleryCount');
      if (count) count.textContent = '1 / ' + total;
    }

    function bindGallerySwipe() {
      const wrap = document.getElementById('productMainWrap');
      if (!wrap) return;
      let startX = 0;
      let startY = 0;
      wrap.addEventListener('touchstart', (event) => {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
      }, { passive: true });
      wrap.addEventListener('touchend', (event) => {
        const dx = event.changedTouches[0].clientX - startX;
        const dy = event.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) showImage(galleryIndex + (dx < 0 ? 1 : -1));
      }, { passive: true });
      document.getElementById('galleryPrev').addEventListener('click', () => showImage(galleryIndex - 1));
      document.getElementById('galleryNext').addEventListener('click', () => showImage(galleryIndex + 1));
    }

    // ── Tallas, WhatsApp y carrito ──
    function readCart() {
      try {
        const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        return Array.isArray(cart) ? cart : [];
      } catch (error) {
        return [];
      }
    }

    function updateCartCount() {
      const total = readCart().reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
      const badge = document.getElementById('topbarCartCount');
      if (badge) {
        badge.textContent = total;
        badge.hidden = total === 0;
      }
    }

    function updateBuyButtons() {
      const bajoPedido = isBajoPedidoClient(currentProduct);
      const whatsapp = document.getElementById('productWhatsAppBtn');
      const mobile = document.getElementById('mobileWhatsAppBtn');
      whatsapp.href = buildWhatsAppClient(currentProduct, selectedSize);
      mobile.href = buildWhatsAppClient(currentProduct, selectedSize);
      if (selectedSize) {
        whatsapp.textContent = (bajoPedido ? 'Pedir talla ' : 'Comprar talla ') + selectedSize + ' por WhatsApp';
        mobile.textContent = 'Comprar ' + selectedSize;
      } else {
        whatsapp.textContent = bajoPedido ? 'Pedir bajo pedido por WhatsApp' : 'Comprar por WhatsApp';
        mobile.textContent = 'Comprar';
      }
    }

    function bindSizes() {
      document.querySelectorAll('.size-option').forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.size === selectedSize);
        button.onclick = () => {
          if (button.disabled) return;
          selectedSize = button.dataset.size;
          document.querySelectorAll('.size-option').forEach((b) => b.classList.toggle('is-selected', b === button));
          document.getElementById('sizeHint').hidden = true;
          updateBuyButtons();
        };
      });
    }

    function renderSizeButtons(product) {
      const entries = getSizeEntriesClient(product);
      const bajoPedido = isBajoPedidoClient(product);
      const options = bajoPedido ? ['S', 'M', 'L', 'XL', 'XXL'].map((size) => ({ size, stock: 0 })) : entries;
      if (selectedSize && !options.some((item) => item.size === selectedSize && (bajoPedido || item.stock > 0))) selectedSize = '';
      document.getElementById('productSizeList').innerHTML = options.map((item) => {
        const available = bajoPedido || item.stock > 0;
        const note = bajoPedido ? '' : item.stock > 0 ? '<small>' + item.stock + ' disp.</small>' : '<small>Agotada</small>';
        return '<button type="button" class="size-option' + (available ? '' : ' is-out') + (!bajoPedido && item.stock === 1 ? ' is-low' : '') + '" data-size="' + escapeHtmlClient(item.size) + '" data-stock="' + item.stock + '"' + (available ? '' : ' disabled') + '>' + escapeHtmlClient(item.size) + note + '</button>';
      }).join('');
      bindSizes();
    }

    function renderStockLine(product) {
      const line = document.getElementById('productStock');
      const available = getSizeEntriesClient(product).filter((item) => item.stock > 0);
      const total = available.reduce((sum, item) => sum + item.stock, 0);
      if (!available.length) {
        line.className = 'stock-line is-preorder';
        line.textContent = 'Bajo pedido: llega en 15 a 20 días hábiles';
      } else if (total === 1) {
        line.className = 'stock-line is-low';
        line.textContent = 'Última unidad, talla ' + available[0].size;
      } else {
        line.className = 'stock-line is-in';
        line.textContent = 'En stock: se despacha de inmediato';
      }
    }

    function addToCart() {
      if (!selectedSize) {
        document.getElementById('sizeHint').hidden = false;
        document.getElementById('productSizeList').classList.remove('needs-size');
        void document.getElementById('productSizeList').offsetWidth;
        document.getElementById('productSizeList').classList.add('needs-size');
        return;
      }
      const cart = readCart();
      const existing = cart.find((item) => item.id === currentProduct.id && item.talla === selectedSize);
      if (existing) existing.cantidad += 1;
      else cart.push({ id: currentProduct.id, equipo: currentProduct.equipo, talla: selectedSize, corte: FIT_LABEL, precio: currentProduct.precio, imagen: CART_IMAGE, cantidad: 1 });
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
      } catch (error) {
        // Sin almacenamiento el carrito no se guarda; WhatsApp sigue funcionando
      }
      updateCartCount();
      document.getElementById('cartAdded').hidden = false;
      trackEvent('cart_add', currentProduct);
    }

    function renderLiveProduct(product) {
      currentProduct = product;
      const images = product.imagenes && product.imagenes.length ? product.imagenes : ['img/logo-ui.webp'];
      const nextImageSignature = imageSignature(images);

      document.getElementById('productCategory').textContent = product.categoria || 'Herencia 90';
      document.getElementById('productTitle').textContent = product.equipo || STATIC_PRODUCT.equipo;
      document.getElementById('productPrice').textContent = formatPriceClient(product.precio);
      document.getElementById('mobileBuyPrice').textContent = formatPriceClient(product.precio);
      document.getElementById('productDescription').textContent = product.descripcion || '';
      document.getElementById('mobileBuyTitle').textContent = product.equipo || STATIC_PRODUCT.equipo;
      renderStockLine(product);
      renderSizeButtons(product);
      updateBuyButtons();

      if (nextImageSignature !== renderedImageSignature) {
        const firstImage = getImageAssetClient(images[0]).masterUrl;
        const mainImage = document.getElementById('productMainImage');
        if (mainImage) {
          mainImage.src = firstImage;
          mainImage.alt = product.equipo || STATIC_PRODUCT.equipo;
        }

        const thumbGrid = document.querySelector('.thumb-grid');
        if (thumbGrid) {
          thumbGrid.innerHTML = buildThumbGrid(images, product.equipo || STATIC_PRODUCT.equipo);
          bindThumbs();
        }
        renderedImageSignature = nextImageSignature;
      }
    }

    async function trackEvent(eventType, product) {
      try {
        const db = await getDb();
        await db.from('analytics_events').insert({
          event_type: eventType,
          product_id: product && product.id ? product.id : null,
          product_name: product && product.equipo ? product.equipo : null,
          category: product && product.categoria ? product.categoria : null,
          extra: { source: 'seo_product_page', talla: selectedSize || null },
          referrer: document.referrer || null
        });
      } catch (error) {
        // Analytics nunca interrumpe la experiencia del usuario
      }
    }

    async function refreshProductFromSupabase() {
      try {
        const db = await getDb();
        const { data, error } = await db.from('productos').select('id,equipo,categoria,descripcion,precio,tallas,imagenes').eq('id', STATIC_PRODUCT.id).single();
        if (error || !data) return;
        renderLiveProduct(data);
      } catch (error) {
        // Mantener contenido estatico como respaldo
      }
    }

    bindThumbs();
    bindGallerySwipe();
    bindSizes();
    updateCartCount();
    document.getElementById('productAddCartBtn').addEventListener('click', addToCart);
    document.getElementById('productWhatsAppBtn').addEventListener('click', () => trackEvent('whatsapp_click', currentProduct));
    document.getElementById('mobileWhatsAppBtn').addEventListener('click', () => trackEvent('whatsapp_click', currentProduct));

    async function startProductLiveSync() {
      const db = await getDb();
      trackEvent('page_view', STATIC_PRODUCT);
      refreshProductFromSupabase();
      db.channel('seo-product-live-${slug}')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos', filter: 'id=eq.${product.id}' }, (payload) => {
          if (payload && payload.new) {
            renderLiveProduct(payload.new);
          }
        })
        .subscribe();
    }

    runWhenIdle(() => startProductLiveSync().catch(() => {}));
  </script>
</body>
</html>`;
}

// Estilo de la ficha de producto: claro, igual al resto de la tienda.
const PRODUCT_PAGE_STYLES = `
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #172033;
      --muted: #556070;
      --line: rgba(15, 23, 42, 0.1);
      --gold: #85692f;
      --gold-soft: #f3ead4;
      --gold-light: #d9c391;
      --whatsapp: #0f7a41;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: 'Montserrat', system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    h1, h2, h3, .price { font-family: 'Oswald', 'Arial Narrow', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; }
    a { color: inherit; }
    :focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; border-radius: 4px; }
    :focus:not(:focus-visible) { outline: none; }
    @media (prefers-reduced-motion: reduce) {
      * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 10px max(18px, env(safe-area-inset-right, 0px)) 10px max(18px, env(safe-area-inset-left, 0px));
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
    }
    .topbar-logo img { display: block; width: auto; height: 44px; }
    .topbar-nav { display: flex; align-items: center; gap: 6px; }
    .topbar-nav a {
      text-decoration: none;
      color: var(--muted);
      font-weight: 700;
      font-size: 0.82rem;
      padding: 8px 10px;
      border-radius: 8px;
    }
    .topbar-nav a:hover { color: var(--gold); background: var(--gold-soft); }
    .topbar-cart span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      margin-left: 4px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--gold);
      color: #ffffff;
      font-size: 0.7rem;
    }
    .topbar-cart span[hidden] { display: none; }
    .page-shell {
      max-width: 1240px;
      margin: 0 auto;
      padding: 22px max(18px, env(safe-area-inset-right, 0px)) 80px max(18px, env(safe-area-inset-left, 0px));
    }
    .breadcrumbs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font-size: 0.8rem;
      margin-bottom: 18px;
    }
    .breadcrumbs a { text-decoration: none; }
    .breadcrumbs a:hover { color: var(--gold); }
    .hero-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      gap: 32px;
      align-items: start;
    }
    .product-gallery,
    .product-panel,
    .related-section {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 18px;
    }
    .product-gallery { padding: 18px; position: sticky; top: 84px; }
    .main-image-wrap {
      position: relative;
      background: radial-gradient(circle at center, #ffffff 0%, #f1f5f9 100%);
      border-radius: 14px;
      padding: 22px;
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      touch-action: pan-y;
    }
    .main-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 14px 24px rgba(15, 23, 42, 0.14));
    }
    .gallery-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.92);
      color: var(--text);
      font-size: 1.6rem;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gallery-arrow[hidden], .gallery-count[hidden] { display: none; }
    .gallery-prev { left: 10px; }
    .gallery-next { right: 10px; }
    .gallery-count {
      position: absolute;
      bottom: 10px;
      right: 12px;
      padding: 3px 10px;
      border-radius: 999px;
      background: rgba(23, 32, 51, 0.72);
      color: #ffffff;
      font-size: 0.72rem;
      font-weight: 700;
    }
    .thumb-grid {
      display: flex;
      gap: 8px;
      margin-top: 12px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .thumb-grid::-webkit-scrollbar { display: none; }
    .thumb {
      flex: 0 0 72px;
      height: 72px;
      background: #f1f5f9;
      border: 2px solid transparent;
      border-radius: 10px;
      padding: 4px;
      cursor: pointer;
    }
    .thumb.active, .thumb:hover { border-color: var(--gold); }
    .thumb img { width: 100%; height: 100%; object-fit: contain; }
    .product-panel { padding: 26px; }
    .eyebrow {
      display: inline-flex;
      padding: 5px 12px;
      border-radius: 999px;
      background: var(--gold-soft);
      color: #6f5524;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 0.68rem;
      font-weight: 800;
      margin-bottom: 12px;
    }
    h1 {
      font-size: clamp(1.6rem, 3.2vw, 2.6rem);
      line-height: 1.08;
      margin: 0 0 10px;
      text-wrap: balance;
    }
    .price {
      font-size: clamp(1.7rem, 3vw, 2.3rem);
      color: var(--gold);
      margin-bottom: 6px;
      line-height: 1.1;
    }
    .stock-line {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 20px;
      font-size: 0.84rem;
      font-weight: 700;
    }
    .stock-line::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .stock-line.is-in { color: #1f6b3a; }
    .stock-line.is-low { color: #a1281e; }
    .stock-line.is-preorder { color: #6f5524; }
    .size-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .size-head strong { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 1px; }
    .size-guide-link { color: var(--gold); font-size: 0.8rem; font-weight: 700; }
    .size-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .size-option {
      min-width: 58px;
      padding: 9px 12px;
      border-radius: 10px;
      border: 1.5px solid rgba(15, 23, 42, 0.16);
      background: #ffffff;
      color: var(--text);
      font: inherit;
      font-weight: 800;
      font-size: 0.92rem;
      cursor: pointer;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.2;
      transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
    }
    .size-option small { font-size: 0.62rem; font-weight: 700; color: var(--muted); }
    .size-option:hover:not(:disabled) { border-color: var(--gold); }
    .size-option.is-low small { color: #a1281e; }
    .size-option.is-selected { background: var(--text); border-color: var(--text); color: #ffffff; }
    .size-option.is-selected small { color: rgba(255, 255, 255, 0.75); }
    .size-option.is-out { opacity: 0.45; cursor: not-allowed; text-decoration: line-through; }
    .size-list.needs-size { animation: nudge 0.4s ease; }
    @keyframes nudge { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
    .fit-note { margin: 0 0 6px; font-size: 0.84rem; color: var(--muted); line-height: 1.5; }
    .fit-note strong { color: var(--text); }
    .size-hint { margin: 6px 0 0; color: #a1281e; font-size: 0.82rem; font-weight: 700; }
    .size-hint[hidden], .cart-added[hidden] { display: none; }
    .actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      margin: 18px 0 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 52px;
      padding: 0 20px;
      border-radius: 12px;
      text-decoration: none;
      font: inherit;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-size: 0.84rem;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    }
    .btn-primary { background: var(--whatsapp); color: #ffffff; border: 1px solid var(--whatsapp); }
    .btn-primary:hover { background: #0b6536; }
    .btn-secondary { border: 1.5px solid var(--text); color: var(--text); background: #ffffff; }
    .btn-secondary:hover { background: var(--text); color: #ffffff; }
    .cart-added { margin: 0 0 8px; font-size: 0.86rem; font-weight: 700; color: #1f6b3a; }
    .cart-added a { color: var(--gold); }
    .meta-list {
      list-style: none;
      margin: 18px 0 0;
      padding: 16px 0 0;
      border-top: 1px solid var(--line);
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 18px;
    }
    .meta-list strong { display: block; font-size: 0.8rem; }
    .meta-list span { font-size: 0.78rem; color: var(--muted); line-height: 1.4; }
    .description-block { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--line); }
    .description-block h2 { font-size: 1rem; margin: 0 0 8px; }
    .description { color: var(--muted); font-size: 0.92rem; margin: 0 0 10px; }
    .microcopy { color: var(--muted); font-size: 0.8rem; margin: 0; }
    .mobile-buy-bar { display: none; }
    .related-section { margin-top: 28px; padding: 22px; }
    .related-section h2 { margin: 0 0 14px; font-size: 1.3rem; }
    .related-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .related-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border-radius: 14px;
      border: 1px solid var(--line);
      text-decoration: none;
      background: #ffffff;
      transition: border-color 0.2s ease;
    }
    .related-card:hover { border-color: var(--gold); }
    .related-card img {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: contain;
      border-radius: 10px;
      background: #f1f5f9;
      padding: 10px;
    }
    .related-copy strong { display: block; font-size: 0.86rem; line-height: 1.3; }
    .related-copy span { color: var(--gold); font-weight: 800; font-size: 0.86rem; }
    @media (max-width: 900px) {
      body { padding-bottom: 84px; }
      .hero-layout { grid-template-columns: 1fr; gap: 16px; }
      .product-gallery { position: static; padding: 8px; border-radius: 14px; }
      .main-image-wrap { padding: 10px; aspect-ratio: auto; height: min(78vw, 40vh); }
      .thumb-grid { margin-top: 8px; }
      .thumb { flex-basis: 50px; height: 50px; }
      .product-panel { padding: 16px 18px; border-radius: 14px; }
      .eyebrow { display: none; }
      .page-shell { padding-top: 12px; }
      .breadcrumbs { display: none; }
      .topbar-logo img { height: 38px; }
      .topbar-nav a { padding: 8px 6px; font-size: 0.78rem; }
      .related-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .related-grid .related-card:nth-child(3) { display: none; }
      .mobile-buy-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px max(14px, env(safe-area-inset-right, 0px)) calc(10px + env(safe-area-inset-bottom, 0px)) max(14px, env(safe-area-inset-left, 0px));
        border-top: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.97);
        box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08);
      }
      .mobile-buy-copy { min-width: 0; }
      .mobile-buy-copy strong {
        display: block;
        font-size: 0.76rem;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 52vw;
      }
      .mobile-buy-copy span { color: var(--gold); font-weight: 800; font-size: 0.95rem; }
      .mobile-buy-bar .btn { min-height: 46px; padding: 0 18px; font-size: 0.78rem; white-space: nowrap; }
    }
    @media (max-width: 420px) {
      .meta-list { grid-template-columns: 1fr; }
    }

    /* Vitrina 2026: una familia, tinta azul noche y la temporada detras de la camiseta */
    :root { --ink: #141a2b; --stage: #eef1f4; --numeral: #d7dde5; --ease-out: cubic-bezier(.23, 1, .32, 1); }
    body { font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; color: var(--ink); background: #ffffff; -webkit-font-smoothing: antialiased; }
    h1, h2, h3, .price { font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; text-transform: none; letter-spacing: -0.02em; font-weight: 760; font-stretch: 78%; }
    .price { color: var(--ink); font-weight: 700; font-stretch: 90%; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
    .eyebrow { display: none; }
    .topbar { background: rgba(255, 255, 255, 0.94); }
    .topbar-nav a { font-weight: 600; font-size: 14px; color: var(--ink); }
    .topbar-nav a:hover { background: var(--stage); color: var(--ink); }
    .topbar-cart span { background: var(--ink); }
    .product-gallery, .product-panel, .related-section { border: 0; }
    .product-gallery { padding: 0; background: transparent; }
    .main-image-wrap { background: var(--stage); border-radius: 22px; padding: 9%; }
    .main-image { position: relative; z-index: 1; filter: drop-shadow(0 22px 28px rgba(20, 26, 43, 0.16)); animation: rise .9s var(--ease-out) both; }
    @keyframes rise { from { opacity: 0; transform: translateY(16px) scale(.985); } to { opacity: 1; transform: none; } }
    .season-numeral {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 0; pointer-events: none; user-select: none;
      font-size: clamp(220px, 36vw, 560px); font-weight: 900; font-stretch: 62%; line-height: .8; letter-spacing: -0.04em; color: var(--numeral);
    }
    .gallery-arrow, .gallery-count { z-index: 2; }
    .thumb { background: var(--stage); border-radius: 12px; }
    .thumb.active, .thumb:hover { border-color: var(--ink); }
    .product-panel { padding: 8px 4px 0; background: transparent; }
    .size-head strong { text-transform: none; letter-spacing: 0; font-size: 15px; font-weight: 650; }
    .size-guide-link, .cart-added a { color: var(--ink); }
    .size-option { border-radius: 10px; font-weight: 650; }
    .size-option:hover:not(:disabled) { border-color: var(--ink); }
    .size-option.is-selected { background: var(--ink); border-color: var(--ink); }
    .btn { border-radius: 999px; text-transform: none; letter-spacing: 0; font-size: 16px; font-weight: 650; transition: transform .16s var(--ease-out), background-color .2s ease, color .2s ease; }
    .btn:active { transform: scale(.97); }
    .btn-primary { background: var(--ink); border-color: var(--ink); }
    .btn-primary:hover { background: #2a3247; }
    .btn-secondary { border-color: #dde2e8; color: var(--ink); }
    .btn-secondary:hover { background: #ffffff; color: var(--ink); border-color: var(--ink); }
    .meta-list strong { font-weight: 650; }
    .description-block h2 { font-size: 20px; }
    .related-section { padding: 0; margin-top: 56px; background: transparent; }
    .related-section h2 { font-size: clamp(26px, 3.4vw, 36px); }
    .related-card { border: 0; padding: 0; background: transparent; }
    .related-card img { background: var(--stage); border-radius: 16px; padding: 8%; }
    .related-copy strong { font-weight: 600; font-size: 15px; }
    .related-copy span { color: var(--ink); font-weight: 700; font-variant-numeric: tabular-nums; }
    .mobile-buy-copy span { color: var(--ink); }
    :focus-visible { outline-color: var(--ink); }
    @media (max-width: 900px) {
      .main-image-wrap { border-radius: 18px; }
      .season-numeral { font-size: 64vw; }
      .product-panel { padding: 4px 2px 0; }
    }
    @media (prefers-reduced-motion: reduce) { .main-image { animation: none; } }
`;

// Temporada en dos cifras para mostrar detras de la camiseta, como un dorsal.
function getSeasonNumeral(product) {
  const text = String(product.equipo || '');
  const corta = text.match(/\b(\d{2})\s*\/\s*\d{2}\b/);
  if (corta) return corta[1];
  const larga = text.match(/\b(19\d{2}|20\d{2})\b/);
  return larga ? larga[1].slice(2) : '';
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `${siteUrl}/`,
    `${siteUrl}/preventa`,
    `${siteUrl}/catalogo`,
    `${siteUrl}/bio`,
    `${siteUrl}/nosotros`,
    `${siteUrl}/preguntas-frecuentes`,
    ...['mundial-2026', 'alemania', 'argentina', 'arsenal', 'bayern-munich', 'brasil', 'liverpool', 'manchester-city', 'manchester-united', 'portugal', 'psg', 'mujer'].map((s) => `${siteUrl}/categorias/${s}`),
    ...seoCollections.map((collection) => getCollectionUrl(collection)),
    ...products.flatMap((product) => getProductUrls(product)),
    ...preventaItems.map((item) => getPreventaUrl(item))
  ];

  const items = urls
    .map((url) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

function buildRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

function cleanGeneratedMarkup(markup) {
  return String(markup).replace(/[ \t]+$/gm, '');
}

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(preventaOutputDir, { recursive: true });
fs.mkdirSync(categoryOutputDir, { recursive: true });
fs.mkdirSync(cityOutputDir, { recursive: true });

for (const product of products) {
  const filePath = path.join(outputDir, `${slugify(product.equipo)}.html`);
  fs.writeFileSync(filePath, cleanGeneratedMarkup(renderProductPage(product)), 'utf8');
  for (const aliasSlug of getLegacyProductAliasSlugs(product)) {
    fs.writeFileSync(path.join(outputDir, `${aliasSlug}.html`), cleanGeneratedMarkup(renderProductPage(product)), 'utf8');
  }
}

for (const item of preventaItems) {
  const filePath = path.join(preventaOutputDir, `${slugify(item.slug || item.equipo)}.html`);
  fs.writeFileSync(filePath, cleanGeneratedMarkup(renderPreventaPage(item)), 'utf8');
}

for (const collection of seoCollections) {
  const filePath = collection.type === 'city' 
    ? path.join(cityOutputDir, `${collection.slug}.html`)
    : path.join(categoryOutputDir, `${collection.slug}.html`);
  if (collection.type === 'city' || !fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, cleanGeneratedMarkup(renderCollectionPage(collection)), 'utf8');
  }
}

fs.writeFileSync(sitemapPath, buildSitemap(), 'utf8');
fs.writeFileSync(robotsPath, buildRobots(), 'utf8');

console.log(`Generated ${products.length} product pages, ${preventaItems.length} preventa pages, sitemap.xml and robots.txt`);
