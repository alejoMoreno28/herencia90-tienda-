import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = 'https://www.herencia90.shop';
const supabaseUrl = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
const outputDir = path.join(root, 'web', 'camisetas');
const productsPath = path.join(root, 'web', 'productos.json');
const sitemapPath = path.join(root, 'web', 'sitemap.xml');
const robotsPath = path.join(root, 'web', 'robots.txt');

const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

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
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
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
          <img src="${escapeHtml(image)}" alt="${escapeHtml(product.equipo)}">
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
      return `<button class="thumb ${index === 0 ? 'active' : ''}" type="button" data-image="${escapeHtml(src)}"><img src="${escapeHtml(src)}" alt="${escapeHtml(product.equipo)} vista ${index + 1}"></button>`;
    })
    .join('');

  return `
    <div class="product-gallery">
      <div class="main-image-wrap">
        <img id="productMainImage" class="main-image" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.equipo)}">
      </div>
      <div class="thumb-grid">${thumbs}</div>
    </div>
  `;
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
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
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
  <header class="topbar">
    <a href="/">Volver al catalogo</a>
    <img src="../img/logo.webp" alt="Herencia 90">
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
  </script>
</body>
</html>`;
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `${siteUrl}/`,
    `${siteUrl}/preventa`,
    ...products.map((product) => `${siteUrl}/camisetas/${slugify(product.equipo)}`)
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

for (const product of products) {
  const filePath = path.join(outputDir, `${slugify(product.equipo)}.html`);
  fs.writeFileSync(filePath, renderProductPage(product), 'utf8');
}

fs.writeFileSync(sitemapPath, buildSitemap(), 'utf8');
fs.writeFileSync(robotsPath, buildRobots(), 'utf8');

console.log(`Generated ${products.length} product pages, sitemap.xml and robots.txt`);
