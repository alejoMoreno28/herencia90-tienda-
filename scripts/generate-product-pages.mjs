import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://www.herencia90.shop';
const supabaseUrl = process.env.SUPABASE_URL || 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
const supabaseProductsUrl = `${supabaseUrl}/rest/v1/productos?select=*&order=id`;
const outputDir = path.join(root, 'web', 'camisetas');
const categoryOutputDir = path.join(root, 'web', 'categorias');
const cityOutputDir = path.join(root, 'web', 'ciudades');
const productsPath = path.join(root, 'web', 'productos.json');
const sitemapPath = path.join(root, 'web', 'sitemap.xml');
const robotsPath = path.join(root, 'web', 'robots.txt');

async function loadProducts() {
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

function truncateText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function absoluteAssetUrl(assetPath) {
  return `${siteUrl}/${assetPath.replace(/^\/+/, '')}`;
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

function getProductUrls(product) {
  const canonical = getProductUrl(product);
  const aliasSlug = getProductAliasSlug(product);
  const urls = [canonical];

  if (aliasSlug) {
    urls.push(`${siteUrl}/camisetas/${aliasSlug}`);
  }

  return urls;
}

function getCollectionUrl(collection) {
  if (collection.type === 'city') return `${siteUrl}/ciudades/${collection.slug}`;
  return `${siteUrl}/categorias/${collection.slug}`;
}

function getCollectionProducts(collection) {
  return products.filter((product) => collection.match(product));
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
  const sameCategory = products.filter((product) => product.id !== currentProduct.id && product.categoria === currentProduct.categoria);
  const fallback = products.filter((product) => product.id !== currentProduct.id && product.categoria !== currentProduct.categoria);
  return [...sameCategory, ...fallback].slice(0, 3);
}

function renderRelatedCards(currentProduct) {
  return getRelatedProducts(currentProduct)
    .map((product) => {
      const productUrl = `/camisetas/${slugify(product.equipo)}`;
      const image = product.imagenes?.[0] ? `../${product.imagenes[0]}` : '../img/logo.webp';
      return `
        <a class="related-card" href="${productUrl}">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')}">
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
  const images = product.imagenes?.length ? product.imagenes : ['img/logo.webp'];
  const mainImage = `../${images[0]}`;
  const thumbs = images
    .map((image, index) => {
      const src = `../${image}`;
      return `<button class="thumb ${index === 0 ? 'active' : ''}" type="button" data-image="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')} - Vista ${index + 1}"></button>`;
    })
    .join('');

  return `
    <div class="product-gallery">
      <div class="main-image-wrap">
        <img id="productMainImage" class="main-image" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')}" width="600" height="600" fetchpriority="high">
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
    .map((product, i) => {
      const availableSizes = getAvailableSizes(product);
      const image = product.imagenes?.[0] ? `../${product.imagenes[0]}` : '../img/logo.webp';
      const productUrl = getProductAliasSlug(product) ? `/camisetas/${getProductAliasSlug(product)}` : `/camisetas/${slugify(product.equipo)}`;
      return `
        <article class="collection-product-card">
          <a class="collection-product-image" href="${productUrl}">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(product.equipo)} - ${escapeHtml(product.categoria || '')}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} width="400" height="400">
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
  const collectionProductIds = collectionProducts.map((product) => product.id);
  const totalStock = collectionProducts.reduce((sum, product) => sum + getStockTotal(product), 0);
  const firstImage = collectionProducts[0]?.imagenes?.[0] ? absoluteAssetUrl(collectionProducts[0].imagenes[0]) : `${siteUrl}/img/logo.webp`;
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
    products: collectionProducts
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/img/logo.webp" type="image/webp">
  <meta name="theme-color" content="#050505">
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://unpkg.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet"></noscript>
  <link rel="preload" as="style" href="https://unpkg.com/aos@2.3.4/dist/aos.css">
  <link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css"></noscript>
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root {
      --bg-dark: #050505;
      --card-bg: rgba(20, 20, 20, 0.82);
      --gold: #d9c391;
      --gold-hover: #f7e6c1;
      --text-primary: #ffffff;
      --text-secondary: #a9a9a9;
      --glass-border: rgba(217, 195, 145, 0.16);
      --whatsapp: #25d366;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Montserrat', sans-serif;
      color: var(--text-primary);
      background: radial-gradient(circle at 50% 0%, #1a1712 0%, #050505 60%, #000 100%);
    }
    h1, h2, h3, .stat-number { font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 1px; }
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
    ::-webkit-scrollbar-track { background: #050505; }
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
      background: rgba(5, 5, 5, 0.9);
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
    .topbar img { height: 42px; }
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
      box-shadow: 0 16px 48px rgba(0,0,0,0.28);
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
      text-transform: uppercase;
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
      text-transform: uppercase;
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
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
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
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
    }
    .collection-product-image {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 270px;
      background: radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%);
      padding: 20px;
      text-decoration: none;
    }
    .collection-product-image img {
      width: 100%;
      max-height: 230px;
      object-fit: contain;
      filter: drop-shadow(0 16px 28px rgba(0,0,0,0.45));
    }
    .collection-product-copy {
      padding: 18px;
    }
    .collection-product-category {
      display: inline-flex;
      margin-bottom: 10px;
      color: var(--gold);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.9px;
      font-weight: 700;
    }
    .collection-product-copy h2 {
      margin: 0 0 10px;
      font-size: 1.2rem;
      line-height: 1.15;
    }
    .collection-product-copy h2 a {
      color: white;
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
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .mini-btn-primary {
      background: rgba(217, 195, 145, 0.14);
      color: var(--gold);
      border: 1px solid rgba(217, 195, 145, 0.24);
    }
    .mini-btn-secondary {
      background: rgba(37,211,102,0.14);
      color: #aef3c3;
      border: 1px solid rgba(37,211,102,0.24);
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
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
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
    <a href="/">Volver al catalogo</a>
    <img src="../img/logo.webp" alt="Herencia 90" width="120" height="42" fetchpriority="high">
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
          <span>promo vigente para impulsar ticket promedio</span>
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
          <h2>Por que esta coleccion importa</h2>
          <p>${escapeHtml(collection.faqTitle)}</p>
        </div>
      </div>
      <div class="benefit-grid">
        <article class="benefit-card">
          <strong>Busqueda directa</strong>
          <p>Esta landing concentra una intencion de compra concreta y ayuda a que Google entienda mejor la tematica.</p>
        </article>
        <article class="benefit-card">
          <strong>Stock conectado</strong>
          <p>Los productos visibles pueden refrescar precio y disponibilidad desde Supabase para no quedarse congelados.</p>
        </article>
        <article class="benefit-card">
          <strong>Conversion mas clara</strong>
          <p>El usuario entra, compara referencias cercanas y pasa rapido a ficha o WhatsApp sin perderse en el catalogo completo.</p>
        </article>
      </div>
    </section>

    <section class="collection-links">
      <div class="section-head">
        <div>
          <h2>Explora otras colecciones</h2>
          <p>Enlaces internos para reforzar navegacion y descubrimiento</p>
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
    document.addEventListener('DOMContentLoaded', () => {
      const SUPABASE_URL = ${serializeForScript(supabaseUrl)};
      const SUPABASE_ANON_KEY = ${serializeForScript(supabaseAnonKey)};
      const STATIC_COLLECTION = ${serializeForScript(staticCollectionPayload)};
      const { createClient } = window.supabase;
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

    function getAvailableSizesClient(product) {
      return Object.entries(product.tallas || {})
        .filter(([, qty]) => Number(qty || 0) > 0)
        .map(([size]) => size);
    }

    function getImageClient(product) {
      const image = product.imagenes && product.imagenes.length ? product.imagenes[0] : 'img/logo.webp';
      return image.startsWith('http') ? image : '../' + image.replace(/^\\/+/, '');
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
      return '<article class="collection-product-card">' +
        '<a class="collection-product-image" href="' + buildProductUrlClient(product) + '">' +
          '<img src="' + getImageClient(product) + '" alt="' + escapeHtmlClient(product.equipo) + '">' +
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
        const { data, error } = await db.from('productos').select('*').in('id', STATIC_COLLECTION.productIds).order('id');
        if (error || !data) return;
        renderCollectionProducts(data);
      } catch (error) {
        // Mantener contenido estatico como respaldo
      }
    }

    trackCollectionPage();
    refreshCollectionFromSupabase();
    db.channel(\`seo-collection-live-\${STATIC_COLLECTION.slug}\`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos' }, (payload) => {
        if (payload && payload.new && STATIC_COLLECTION.productIds.includes(payload.new.id)) {
          refreshCollectionFromSupabase();
        }
      })
      .subscribe();
    });
  </script>
  <script defer src="https://unpkg.com/aos@2.3.4/dist/aos.js"></script>
  <script defer src="https://unpkg.com/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js"></script>
  <script defer>
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof AOS !== 'undefined') AOS.init({ duration: 600, easing: 'ease-out-cubic', once: true, offset: 60 });
    });
  </script>
</body>
</html>`;
}

function renderProductPage(product) {
  const slug = slugify(product.equipo);
  const availableSizes = getAvailableSizes(product);
  const sizeTags = availableSizes.length
    ? availableSizes.map((size) => `<span>${escapeHtml(size)}</span>`).join('')
    : '<span>Consultar</span>';
  const description = buildMetaDescription(product, availableSizes);
  const imageUrls = (product.imagenes?.length ? product.imagenes : ['img/logo.webp']).map(absoluteAssetUrl);
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
  const staticProductPayload = {
    id: product.id,
    equipo: product.equipo,
    categoria: product.categoria,
    descripcion: product.descripcion,
    precio: product.precio,
    tallas: product.tallas || {},
    imagenes: product.imagenes || []
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/img/logo.webp" type="image/webp">
  <meta name="theme-color" content="#050505">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://unpkg.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet"></noscript>
  <link rel="preload" as="style" href="https://unpkg.com/aos@2.3.4/dist/aos.css">
  <link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css"></noscript>
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root {
      --bg-dark: #050505;
      --card-bg: rgba(20, 20, 20, 0.82);
      --gold: #d9c391;
      --gold-hover: #f7e6c1;
      --text-primary: #ffffff;
      --text-secondary: #a9a9a9;
      --glass-border: rgba(217, 195, 145, 0.16);
      --whatsapp: #25d366;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: 'Montserrat', sans-serif;
      background: radial-gradient(circle at 50% 0%, #1a1712 0%, #050505 60%, #000 100%);
      color: var(--text-primary);
      line-height: 1.6;
    }
    h1, h2, h3, .price { font-family: 'Oswald', sans-serif; text-transform: uppercase; letter-spacing: 1px; }
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
    ::-webkit-scrollbar-track { background: #050505; }
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
      background: rgba(5, 5, 5, 0.9);
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
    .topbar img { height: 42px; }
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
    .hero-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.95fr);
      gap: 28px;
      align-items: start;
    }
    .product-gallery,
    .product-panel,
    .benefits,
    .related-section {
      background: var(--card-bg);
      border: 1px solid var(--glass-border);
      border-radius: 26px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.28);
      backdrop-filter: blur(14px);
    }
    .product-gallery { padding: 24px; }
    .main-image-wrap {
      background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 72%);
      border-radius: 20px;
      padding: 22px;
      aspect-ratio: 4 / 5;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .main-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 18px 30px rgba(0,0,0,0.5));
    }
    .thumb-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(78px, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .thumb {
      background: rgba(255,255,255,0.03);
      border: 1px solid transparent;
      border-radius: 14px;
      padding: 8px;
      cursor: pointer;
    }
    .thumb.active,
    .thumb:hover { border-color: var(--gold); }
    .thumb img {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: contain;
    }
    .product-panel { padding: 28px; }
    .eyebrow {
      display: inline-flex;
      padding: 6px 14px;
      border-radius: 999px;
      border: 1px solid rgba(217, 195, 145, 0.26);
      background: rgba(217, 195, 145, 0.08);
      color: var(--gold);
      text-transform: uppercase;
      letter-spacing: 1.2px;
      font-size: 0.72rem;
      font-weight: 700;
      margin-bottom: 14px;
    }
    h1 {
      font-size: clamp(2rem, 4vw, 3.6rem);
      line-height: 1.05;
      margin: 0 0 12px;
    }
    .price {
      font-size: clamp(1.7rem, 3vw, 2.6rem);
      color: var(--gold);
      margin-bottom: 14px;
    }
    .description {
      color: var(--text-secondary);
      font-size: 0.98rem;
      margin-bottom: 24px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .meta-box {
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
    }
    .meta-box strong {
      display: block;
      color: var(--gold);
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .meta-box span {
      color: var(--text-primary);
      font-size: 0.9rem;
      font-weight: 600;
    }
    .size-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 22px;
    }
    .size-list span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 46px;
      padding: 9px 14px;
      border-radius: 999px;
      border: 1px solid rgba(217, 195, 145, 0.25);
      background: rgba(217, 195, 145, 0.08);
      color: var(--gold-hover);
      font-weight: 700;
      font-size: 0.84rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 18px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 50px;
      padding: 0 20px;
      border-radius: 999px;
      text-decoration: none;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-size: 0.82rem;
      transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
    }
    .btn:hover { transform: translateY(-2px); }
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
    .microcopy {
      color: var(--text-secondary);
      font-size: 0.82rem;
    }
    .benefits,
    .related-section {
      margin-top: 26px;
      padding: 24px;
    }
    .benefits h2,
    .related-section h2 {
      margin: 0 0 12px;
      font-size: 1.45rem;
      color: var(--gold);
    }
    .benefits ul {
      margin: 0;
      padding-left: 20px;
      color: var(--text-secondary);
    }
    .benefits li + li { margin-top: 8px; }
    .related-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .related-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.08);
      text-decoration: none;
      background: rgba(255,255,255,0.03);
    }
    .related-card:hover {
      border-color: var(--gold);
      transform: translateY(-2px);
    }
    .related-card img {
      width: 100%;
      aspect-ratio: 4 / 5;
      object-fit: contain;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      padding: 10px;
    }
    .related-copy strong {
      display: block;
      color: white;
      font-size: 0.92rem;
    }
    .related-copy span {
      color: var(--gold);
      font-weight: 700;
      font-size: 0.86rem;
    }
    @media (max-width: 900px) {
      .hero-layout {
        grid-template-columns: 1fr;
      }
      .related-grid {
        grid-template-columns: 1fr;
      }
      .meta-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="scroll-progress" aria-hidden="true"></div>
  <header class="topbar">
    <a href="/">Volver al catalogo</a>
    <img src="../img/logo.webp" alt="Herencia 90" width="120" height="42" fetchpriority="high">
    <a href="/preventa">Pre-venta</a>
  </header>

  <main class="page-shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Inicio</a>
      <span>/</span>
      <a href="/#catalogo">${escapeHtml(product.categoria)}</a>
      <span>/</span>
      <span>${escapeHtml(product.equipo)}</span>
    </nav>

    <section class="hero-layout">
      ${renderGallery(product)}
      <div class="product-panel">
        <span id="productCategory" class="eyebrow">${escapeHtml(product.categoria)}</span>
        <h1 id="productTitle">${escapeHtml(product.equipo)}</h1>
        <div id="productPrice" class="price">${escapeHtml(formatPrice(product.precio))}</div>
        <p id="productDescription" class="description">${escapeHtml(product.descripcion)}</p>

        <div class="meta-grid">
          <div class="meta-box">
            <strong>Tallas activas</strong>
            <span id="productSizesSummary">${escapeHtml(availableSizes.join(', ') || 'Consultar')}</span>
          </div>
          <div class="meta-box">
            <strong>Promo vigente</strong>
            <span>2 x $180.000</span>
          </div>
          <div class="meta-box">
            <strong>Entrega</strong>
            <span>Envios a toda Colombia</span>
          </div>
          <div class="meta-box">
            <strong>Compra multiple</strong>
            <span>Caja desde 2 unidades</span>
          </div>
        </div>

        <div id="productSizeList" class="size-list">${sizeTags}</div>

        <div class="actions">
          <a id="productWhatsAppBtn" class="btn btn-primary" href="${buildWhatsAppUrl(product, availableSizes)}" target="_blank" rel="noopener noreferrer">Comprar por WhatsApp</a>
          <a class="btn btn-secondary" href="/">Seguir viendo camisetas</a>
        </div>

        <p class="microcopy">Si quieres nombre, numero o parches, tambien te cotizamos esos extras por WhatsApp.</p>
      </div>
    </section>

    <section class="benefits">
      <h2>Compra con confianza</h2>
      <ul>
        <li>Calidad importada, referencias retro y de temporada con enfoque en buenos acabados.</li>
        <li>Atencion rapida por WhatsApp para confirmar talla, disponibilidad y forma de pago.</li>
        <li>Promo 2 x $180.000 en referencias seleccionadas para impulsar ticket promedio.</li>
        <li>Compras desde 2 unidades pueden entregarse con caja para mejorar presentacion.</li>
      </ul>
    </section>

    <section class="related-section">
      <h2>Tambien te puede interesar</h2>
      <div class="related-grid">
        ${renderRelatedCards(product)}
      </div>
    </section>
  </main>

  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const SUPABASE_URL = ${serializeForScript(supabaseUrl)};
      const SUPABASE_ANON_KEY = ${serializeForScript(supabaseAnonKey)};
      const STATIC_PRODUCT = ${serializeForScript(staticProductPayload)};
      const PRODUCT_URL = ${serializeForScript(getProductUrl(product))};
      const { createClient } = window.supabase;
      const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      let currentProduct = STATIC_PRODUCT;

    function formatPriceClient(value) {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
    }

    function getAvailableSizesClient(product) {
      return Object.entries(product.tallas || {})
        .filter(([, qty]) => Number(qty || 0) > 0)
        .map(([size]) => size);
    }

    function buildWhatsAppClient(product) {
      const sizes = getAvailableSizesClient(product);
      const sizeText = sizes.length > 0 ? ' Tallas disponibles: ' + sizes.join(', ') + '.' : '';
      const message = 'Hola Herencia 90, me interesa la ' + product.equipo + '.' + sizeText + ' Vi esta referencia en ' + PRODUCT_URL + ' y quiero confirmar disponibilidad.';
      return 'https://wa.me/573126428153?text=' + encodeURIComponent(message);
    }

    function buildThumbGrid(images, title) {
      return images.map((image, index) => {
        const src = image.startsWith('http') ? image : '../' + image.replace(/^\\/+/, '');
        const activeClass = index === 0 ? ' active' : '';
        return '<button class="thumb' + activeClass + '" type="button" data-image="' + src + '"><img src="' + src + '" alt="' + title + ' vista ' + (index + 1) + '"></button>';
      }).join('');
    }

    function bindThumbs() {
      document.querySelectorAll('.thumb').forEach((button) => {
        button.onclick = () => {
          const mainImage = document.getElementById('productMainImage');
          if (!mainImage) return;
          mainImage.src = button.dataset.image;
          document.querySelectorAll('.thumb').forEach((thumb) => thumb.classList.remove('active'));
          button.classList.add('active');
        };
      });
    }

    function renderLiveProduct(product) {
      currentProduct = product;
      const sizes = getAvailableSizesClient(product);
      const images = product.imagenes && product.imagenes.length ? product.imagenes : ['img/logo.webp'];
      const firstImage = images[0].startsWith('http') ? images[0] : '../' + images[0].replace(/^\\/+/, '');

      document.getElementById('productCategory').textContent = product.categoria || 'Herencia 90';
      document.getElementById('productTitle').textContent = product.equipo || STATIC_PRODUCT.equipo;
      document.getElementById('productPrice').textContent = formatPriceClient(product.precio);
      document.getElementById('productDescription').textContent = product.descripcion || '';
      document.getElementById('productSizesSummary').textContent = sizes.join(', ') || 'Consultar';
      document.getElementById('productSizeList').innerHTML = (sizes.length ? sizes : ['Consultar']).map((size) => '<span>' + size + '</span>').join('');
      document.getElementById('productWhatsAppBtn').href = buildWhatsAppClient(product);

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
    }

    async function trackEvent(eventType, product) {
      try {
        await db.from('analytics_events').insert({
          event_type: eventType,
          product_id: product && product.id ? product.id : null,
          product_name: product && product.equipo ? product.equipo : null,
          category: product && product.categoria ? product.categoria : null,
          extra: { source: 'seo_product_page' },
          referrer: document.referrer || null
        });
      } catch (error) {
        // Analytics nunca interrumpe la experiencia del usuario
      }
    }

    async function refreshProductFromSupabase() {
      try {
        const { data, error } = await db.from('productos').select('*').eq('id', STATIC_PRODUCT.id).single();
        if (error || !data) return;
        renderLiveProduct(data);
      } catch (error) {
        // Mantener contenido estatico como respaldo
      }
    }

    bindThumbs();
    trackEvent('page_view', STATIC_PRODUCT);
    trackEvent('modal_open', STATIC_PRODUCT);
    document.getElementById('productWhatsAppBtn').addEventListener('click', () => trackEvent('whatsapp_click', currentProduct));
    refreshProductFromSupabase();
      db.channel(\`seo-product-live-\${currentProduct.id}\`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos', filter: \`id=eq.\${currentProduct.id}\` }, (payload) => {
          if (payload && payload.new) {
            renderLiveProduct(payload.new);
          }
        })
        .subscribe();
    });
  </script>
  <script defer src="https://unpkg.com/aos@2.3.4/dist/aos.js"></script>
  <script defer src="https://unpkg.com/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js"></script>
  <script defer>
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof AOS !== 'undefined') AOS.init({ duration: 600, easing: 'ease-out-cubic', once: true, offset: 60 });
      if (typeof VanillaTilt !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
        VanillaTilt.init(document.querySelectorAll('.pp-thumbs img, .pp-main-img'), {
          max: 4, speed: 500, glare: true, 'max-glare': 0.06, scale: 1.02
        });
      }
    });
  </script>
</body>
</html>`;
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `${siteUrl}/`,
    `${siteUrl}/preventa`,
    ...seoCollections.map((collection) => getCollectionUrl(collection)),
    ...products.flatMap((product) => getProductUrls(product))
  ];

  const items = urls
    .map((url) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

function buildRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
}

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(categoryOutputDir, { recursive: true });
fs.mkdirSync(cityOutputDir, { recursive: true });

for (const product of products) {
  const filePath = path.join(outputDir, `${slugify(product.equipo)}.html`);
  fs.writeFileSync(filePath, renderProductPage(product), 'utf8');
}

for (const collection of seoCollections) {
  const filePath = collection.type === 'city' 
    ? path.join(cityOutputDir, `${collection.slug}.html`)
    : path.join(categoryOutputDir, `${collection.slug}.html`);
  fs.writeFileSync(filePath, renderCollectionPage(collection), 'utf8');
}

fs.writeFileSync(sitemapPath, buildSitemap(), 'utf8');
fs.writeFileSync(robotsPath, buildRobots(), 'utf8');

console.log(`Generated ${products.length} product pages, sitemap.xml and robots.txt`);
