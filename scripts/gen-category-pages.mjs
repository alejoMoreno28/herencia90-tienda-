import { readFileSync, writeFileSync } from 'fs';

const SUPABASE_URL = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';
const BASE = 'C:/Users/PC/Desktop/HERENCIA90';

// Extraer CSS y funciones JS comunes de colombia.html
const templateHtml = readFileSync(`${BASE}/web/categorias/colombia.html`, 'utf8');
const cssStart = templateHtml.indexOf('<style>');
const cssEnd = templateHtml.indexOf('</style>') + '</style>'.length;
const CSS = templateHtml.slice(cssStart, cssEnd);

const jsUtilsStart = templateHtml.indexOf('function slugifyText');
const jsUtilsEnd = templateHtml.lastIndexOf('</script>');
const JS_UTILS = templateHtml.slice(jsUtilsStart, jsUtilsEnd);

// Leer productos del temporada-25-26
const html25 = readFileSync(`${BASE}/web/categorias/temporada-25-26.html`, 'utf8');
const scStart = html25.indexOf('const STATIC_COLLECTION = ') + 'const STATIC_COLLECTION = '.length;
const scEnd = html25.indexOf(';\n      const { createClient }');
const allProducts = JSON.parse(html25.slice(scStart, scEnd)).products;
const byId = {};
allProducts.forEach(p => { byId[p.id] = p; });

function slugify(v) {
  return String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function esc(v) {
  return String(v || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtPrice(v) {
  return '$ ' + Number(v || 0).toLocaleString('es-CO');
}
function sizes(p) {
  return Object.entries(p.tallas || {}).filter(([, q]) => Number(q) > 0).map(([s]) => s);
}
function imgSrc(p) {
  const i = p.imagenes && p.imagenes.length ? p.imagenes[0] : 'img/logo.webp';
  return i.startsWith('http') ? i : '../' + i.replace(/^\/+/, '');
}
function pUrl(p) { return '/camisetas/' + slugify(p.equipo); }
function waUrl(p) {
  const sz = sizes(p);
  const szTxt = sz.length ? ' Tallas disponibles: ' + sz.join(', ') + '.' : '';
  const msg = 'Hola Herencia 90, me interesa la ' + p.equipo + '.' + szTxt +
    ' Vi esta referencia en https://www.herencia90.shop' + pUrl(p) + ' y quiero confirmar disponibilidad.';
  return 'https://wa.me/573126428153?text=' + encodeURIComponent(msg);
}

function buildPage(cfg) {
  const { slug, title, metaDesc, ogImage, eyebrow, h1, intro1, intro2, waMsg, channelName, products, otherLinks, faqItems } = cfg;
  const productIds = products.map(p => p.id);
  const url = 'https://www.herencia90.shop/categorias/' + slug;

  const schemaCollection = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: title, description: metaDesc, url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem', position: i + 1,
        url: 'https://www.herencia90.shop' + pUrl(p), name: p.equipo
      }))
    }
  });

  const schemaBreadcrumb = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://www.herencia90.shop/' },
      { '@type': 'ListItem', position: 2, name: 'Categorias', item: 'https://www.herencia90.shop/categorias' },
      { '@type': 'ListItem', position: 3, name: h1 }
    ]
  });

  const schemaFaq = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map(f => ({
      '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  });

  const staticCollection = JSON.stringify({
    slug, name: h1, eyebrow, description: metaDesc, productIds,
    products: products.map(({ id, equipo, categoria, descripcion, precio, tallas, imagenes }) =>
      ({ id, equipo, categoria, descripcion, precio, tallas, imagenes }))
  });

  const cardsHtml = products.map((p, i) => {
    const sz = sizes(p);
    return `
        <article class="collection-product-card">
          <a class="collection-product-image" href="${pUrl(p)}">
            <img src="${imgSrc(p)}" alt="${esc(p.equipo)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} width="400" height="400">
          </a>
          <div class="collection-product-copy">
            <span class="collection-product-category">${esc(p.categoria || 'Herencia 90')}</span>
            <h2><a href="${pUrl(p)}">${esc(p.equipo)}</a></h2>
            <p>${esc((p.descripcion || '').slice(0, 140))}...</p>
            <div class="collection-product-meta">
              <span>${fmtPrice(p.precio)}</span>
              <span>${esc(sz.join(', ') || 'Consultar')}</span>
            </div>
            <div class="collection-product-actions">
              <a class="mini-btn mini-btn-primary" href="${pUrl(p)}">Ver ficha</a>
              <a class="mini-btn mini-btn-secondary" href="${waUrl(p)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          </div>
        </article>`;
  }).join('');

  const benefitsHtml = faqItems.slice(0, 3).map(f => `
        <article class="benefit-card">
          <strong>${esc(f.q)}</strong>
          <p>${esc(f.a)}</p>
        </article>`).join('');

  const linksHtml = otherLinks.map(l => `
          <article class="link-card">
            <a href="/categorias/${l.slug}">
              <strong>${esc(l.name)}</strong>
              <p>${esc(l.desc)}</p>
            </a>
          </article>`).join('');

  const waHeroUrl = 'https://wa.me/573126428153?text=' + encodeURIComponent(waMsg);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/img/logo.webp" type="image/webp">
  <meta name="theme-color" content="#050505">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${metaDesc}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Herencia 90">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://www.herencia90.shop/${ogImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${metaDesc}">
  <meta name="twitter:image" content="https://www.herencia90.shop/${ogImage}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://unpkg.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preload" as="style" href="https://unpkg.com/aos@2.3.4/dist/aos.css">
  <link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://unpkg.com/aos@2.3.4/dist/aos.css"></noscript>
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet"></noscript>
  <script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script type="application/ld+json">${schemaCollection}</script>
  <script type="application/ld+json">${schemaBreadcrumb}</script>
  <script type="application/ld+json">${schemaFaq}</script>
  ${CSS}
</head>
<body>
  <header class="topbar">
    <a href="/">Volver al catalogo</a>
    <img src="../img/logo.webp" alt="Herencia 90" width="120" height="42" fetchpriority="high">
    <a href="/preventa">Pre-venta</a>
  </header>

  <main class="page-shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Inicio</a>
      <span>/</span>
      <span>Categorias</span>
      <span>/</span>
      <span>${h1}</span>
    </nav>

    <section class="collection-hero">
      <div>
        <span class="eyebrow">${eyebrow}</span>
        <h1 id="collectionTitle">${h1}</h1>
        <p>${intro1}</p>
        <p id="collectionDescription">${intro2}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="${waHeroUrl}" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a>
          <a class="btn btn-secondary" href="/#catalogo">Ver todo el catalogo</a>
        </div>
      </div>
      <div class="collection-stats">
        <div class="stat-box">
          <strong class="stat-number" id="collectionCount">${products.length}</strong>
          <span>referencias activas</span>
        </div>
        <div class="stat-box">
          <strong class="stat-number">10</strong>
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
          <p id="collectionCountLabel">${products.length} productos listados con ficha propia</p>
        </div>
      </div>
      <div id="collectionProducts" class="collection-grid">${cardsHtml}
      </div>
    </section>

    <section class="collection-benefits">
      <div class="section-head">
        <div>
          <h2>Preguntas frecuentes</h2>
          <p>Todo lo que necesitas saber sobre esta coleccion</p>
        </div>
      </div>
      <div class="benefit-grid">${benefitsHtml}
      </div>
    </section>

    <section class="collection-links">
      <div class="section-head">
        <div>
          <h2>Explora otras colecciones</h2>
          <p>Enlaces internos para reforzar navegacion y descubrimiento</p>
        </div>
      </div>
      <div class="links-grid">${linksHtml}
      </div>
    </section>
  </main>

  <script>
    const SUPABASE_URL = "${SUPABASE_URL}";
    const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
    const STATIC_COLLECTION = ${staticCollection};
    const { createClient } = window.supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    ${JS_UTILS}

    trackCollectionPage();
    refreshCollectionFromSupabase();
    db.channel('${channelName}')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'productos' }, (payload) => {
        if (payload && payload.new && STATIC_COLLECTION.productIds.includes(payload.new.id)) {
          refreshCollectionFromSupabase();
        }
      })
      .subscribe();
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

const pages = [
  {
    slug: 'arsenal',
    title: 'Camisetas Arsenal 25/26 Importadas | Herencia 90 Colombia',
    metaDesc: 'Compra camisetas Arsenal 25/26 importadas en Colombia. Local y visitante de los Gunners con envio nacional y atencion por WhatsApp.',
    ogImage: 'img/arsenal_25-26_home_fan_1.webp',
    eyebrow: 'Arsenal FC',
    h1: 'Camisetas Arsenal 25/26',
    intro1: 'Las camisetas del Arsenal son de las mas reconocidas de la Premier League. Aqui concentramos todas las referencias disponibles de los Gunners para que encuentres rapido lo que buscas.',
    intro2: 'Compra camisetas Arsenal 25/26 importadas en Colombia. Local y visitante con acabados de calidad, envio nacional y atencion directa por WhatsApp.',
    waMsg: 'Hola Herencia 90, quiero ver referencias de camisetas Arsenal 25/26. Vi esta pagina https://www.herencia90.shop/categorias/arsenal y quiero disponibilidad.',
    channelName: 'seo-collection-live-arsenal',
    products: [byId[4], byId[3]],
    faqItems: [
      { q: '¿Las camisetas Arsenal son importadas?', a: 'Si, todas nuestras referencias del Arsenal son importadas directamente, version Fan con acabados de calidad y telas livianas.' },
      { q: '¿Tienen stock inmediato del Arsenal 25/26?', a: 'Manejamos stock fisico en Bogota con envio a toda Colombia. La disponibilidad exacta por talla la confirmas por WhatsApp.' },
      { q: '¿Puedo pedir una talla agotada del Arsenal?', a: 'Si, a traves del servicio de pre-pedido traemos tu talla en aproximadamente 15 dias habiles.' }
    ],
    otherLinks: [
      { slug: 'liverpool', name: 'Liverpool', desc: 'Camisetas Liverpool 25/26 importadas en Colombia. Local y visitante del equipo de Anfield con envio nacional.' },
      { slug: 'manchester-united', name: 'Manchester United', desc: 'Camisetas Manchester United 25/26 importadas. Los Red Devils con envio a toda Colombia.' },
      { slug: 'temporada-25-26', name: 'Temporada 25/26', desc: 'Toda la coleccion de camisetas de clubes europeos temporada 25/26 importadas disponibles en Colombia.' }
    ]
  },
  {
    slug: 'liverpool',
    title: 'Camisetas Liverpool 25/26 Importadas | Herencia 90 Colombia',
    metaDesc: 'Compra camisetas Liverpool 25/26 importadas en Colombia. Local y visitante del equipo de Anfield con envio nacional y atencion por WhatsApp.',
    ogImage: 'img/liverpool_25-26_home_red_fan_1.webp',
    eyebrow: 'Liverpool FC',
    h1: 'Camisetas Liverpool 25/26',
    intro1: 'El rojo de Anfield ahora disponible en Colombia. Reunimos las referencias del Liverpool 25/26 para que encuentres rapido la camiseta de los Reds con envio nacional garantizado.',
    intro2: 'Compra camisetas Liverpool 25/26 importadas en Colombia. Local y visitante con acabados premium, envio a toda Colombia y soporte rapido por WhatsApp.',
    waMsg: 'Hola Herencia 90, quiero ver referencias de camisetas Liverpool 25/26. Vi esta pagina https://www.herencia90.shop/categorias/liverpool y quiero disponibilidad.',
    channelName: 'seo-collection-live-liverpool',
    products: [byId[11], byId[12]],
    faqItems: [
      { q: '¿Las camisetas Liverpool son importadas?', a: 'Si, todas nuestras referencias del Liverpool son importadas, version Fan con telas livianas y acabados de calidad.' },
      { q: '¿Tienen la camiseta local roja del Liverpool 25/26?', a: 'Si, tenemos la camiseta local del Liverpool en rojo intenso de Anfield y la visitante en blanco. Stock disponible con envio inmediato.' },
      { q: '¿Puedo solicitar tallas agotadas del Liverpool?', a: 'Si, mediante el servicio de pre-pedido conseguimos tu talla en aproximadamente 15 dias habiles.' }
    ],
    otherLinks: [
      { slug: 'arsenal', name: 'Arsenal', desc: 'Camisetas Arsenal 25/26 importadas en Colombia. Los Gunners con envio nacional.' },
      { slug: 'manchester-united', name: 'Manchester United', desc: 'Camisetas Manchester United 25/26 importadas. Los Red Devils con envio a toda Colombia.' },
      { slug: 'temporada-25-26', name: 'Temporada 25/26', desc: 'Toda la coleccion de clubes europeos 25/26 importadas disponibles en Colombia.' }
    ]
  },
  {
    slug: 'manchester-united',
    title: 'Camisetas Manchester United 25/26 Importadas | Herencia 90 Colombia',
    metaDesc: 'Compra camisetas Manchester United 25/26 importadas en Colombia. Los Red Devils de Old Trafford con envio nacional y atencion por WhatsApp.',
    ogImage: 'img/manchester_united_25-26_home_fan_1.webp',
    eyebrow: 'Manchester United',
    h1: 'Camisetas Manchester United 25/26',
    intro1: 'Los Red Devils de Old Trafford ahora disponibles en Colombia. La camiseta local del Manchester United 25/26 importada con los acabados que los hinchas colombianos exigen.',
    intro2: 'Compra camisetas Manchester United 25/26 importadas en Colombia. Version Fan de calidad con envio a toda Colombia y atencion directa por WhatsApp.',
    waMsg: 'Hola Herencia 90, quiero ver referencias de camisetas Manchester United 25/26. Vi esta pagina https://www.herencia90.shop/categorias/manchester-united y quiero disponibilidad.',
    channelName: 'seo-collection-live-manchester-united',
    products: [byId[16]],
    faqItems: [
      { q: '¿Las camisetas Manchester United son importadas?', a: 'Si, todas nuestras referencias del Manchester United son importadas directamente, version Fan con acabados de calidad.' },
      { q: '¿Tienen la camiseta local roja del Man United 25/26?', a: 'Si, tenemos la camiseta local del Manchester United en rojo intenso de Old Trafford. Disponibilidad por talla via WhatsApp.' },
      { q: '¿Hacen envios a toda Colombia del Manchester United?', a: 'Si, enviamos a todos los municipios de Colombia. El tiempo de entrega es de 1 a 3 dias habiles segun la ciudad.' }
    ],
    otherLinks: [
      { slug: 'liverpool', name: 'Liverpool', desc: 'Camisetas Liverpool 25/26 importadas en Colombia. El rojo de Anfield con envio nacional.' },
      { slug: 'arsenal', name: 'Arsenal', desc: 'Camisetas Arsenal 25/26 importadas en Colombia. Los Gunners con envio a toda Colombia.' },
      { slug: 'temporada-25-26', name: 'Temporada 25/26', desc: 'Toda la coleccion de clubes europeos temporada 25/26 importadas y disponibles en Colombia.' }
    ]
  },
  {
    slug: 'bayern-munich',
    title: 'Camisetas Bayern Munich 25/26 Importadas | Herencia 90 Colombia',
    metaDesc: 'Compra camisetas Bayern Munich 25/26 importadas en Colombia. Local y tercera del gigante aleman con envio nacional y atencion por WhatsApp.',
    ogImage: 'img/bayern_munich_25-26_home_fan_1.webp',
    eyebrow: 'Bayern Munchen',
    h1: 'Camisetas Bayern Munich 25/26',
    intro1: 'El gigante rojo de la Bundesliga disponible en Colombia. Reunimos las referencias del Bayern Munich 25/26 para que encuentres rapido la camiseta del club aleman mas ganador de la historia.',
    intro2: 'Compra camisetas Bayern Munich 25/26 importadas en Colombia. Local en rojo bavaro y tercera en negro elegante, con envio a toda Colombia y soporte por WhatsApp.',
    waMsg: 'Hola Herencia 90, quiero ver referencias de camisetas Bayern Munich 25/26. Vi esta pagina https://www.herencia90.shop/categorias/bayern-munich y quiero disponibilidad.',
    channelName: 'seo-collection-live-bayern-munich',
    products: [byId[7], byId[8]],
    faqItems: [
      { q: '¿Las camisetas Bayern Munich son importadas?', a: 'Si, todas nuestras referencias del Bayern son importadas directamente, version Fan con telas livianas y acabados de calidad.' },
      { q: '¿Tienen la camiseta local roja y la tercera negra del Bayern 25/26?', a: 'Si, tenemos ambas referencias del Bayern Munich 25/26: la local en rojo bavaro y la tercera en negro. Stock confirmable por WhatsApp.' },
      { q: '¿Puedo pedir tallas agotadas del Bayern Munich?', a: 'Si, a traves del pre-pedido conseguimos tu talla en aproximadamente 15 dias habiles con envio a toda Colombia.' }
    ],
    otherLinks: [
      { slug: 'liverpool', name: 'Liverpool', desc: 'Camisetas Liverpool 25/26 importadas en Colombia. Local y visitante del equipo de Anfield.' },
      { slug: 'arsenal', name: 'Arsenal', desc: 'Camisetas Arsenal 25/26 importadas en Colombia. Los Gunners con envio nacional.' },
      { slug: 'temporada-25-26', name: 'Temporada 25/26', desc: 'Toda la coleccion de clubes europeos 25/26 importadas disponibles en Colombia.' }
    ]
  },
  {
    slug: 'psg',
    title: 'Camisetas PSG 25/26 Importadas | Herencia 90 Colombia',
    metaDesc: 'Compra camisetas PSG 25/26 importadas en Colombia. Paris Saint-Germain con elegancia parisina, envio nacional y atencion por WhatsApp.',
    ogImage: 'img/psg_25-26_home_fan_1.webp',
    eyebrow: 'Paris Saint-Germain',
    h1: 'Camisetas PSG 25/26',
    intro1: 'La elegancia del futbol parisino ahora disponible en Colombia. Las camisetas del Paris Saint-Germain 25/26 importadas con los acabados que los hinchas colombianos esperan.',
    intro2: 'Compra camisetas PSG 25/26 importadas en Colombia. La camiseta local del club parisino con envio a toda Colombia y atencion directa por WhatsApp.',
    waMsg: 'Hola Herencia 90, quiero ver referencias de camisetas PSG 25/26. Vi esta pagina https://www.herencia90.shop/categorias/psg y quiero disponibilidad.',
    channelName: 'seo-collection-live-psg',
    products: [byId[18]],
    faqItems: [
      { q: '¿Las camisetas PSG son importadas?', a: 'Si, todas nuestras referencias del PSG son importadas directamente, version Fan con acabados premium y telas de calidad.' },
      { q: '¿Tienen la camiseta local azul del PSG 25/26?', a: 'Si, tenemos la camiseta local del Paris Saint-Germain en azul, rojo y blanco. Disponibilidad por talla se confirma via WhatsApp.' },
      { q: '¿Hacen envios a toda Colombia de camisetas PSG?', a: 'Si, enviamos a todos los municipios de Colombia con tiempos de 1 a 3 dias habiles segun la ciudad.' }
    ],
    otherLinks: [
      { slug: 'barcelona', name: 'Barcelona', desc: 'Camisetas Barcelona 25/26 importadas en Colombia. Los blaugrana con envio nacional.' },
      { slug: 'real-madrid', name: 'Real Madrid', desc: 'Camisetas Real Madrid 25/26 importadas en Colombia. El equipo mas ganador con envio a toda Colombia.' },
      { slug: 'temporada-25-26', name: 'Temporada 25/26', desc: 'Toda la coleccion de clubes europeos 25/26 importadas y disponibles en Colombia.' }
    ]
  }
];

pages.forEach(cfg => {
  const html = buildPage(cfg);
  const path = `${BASE}/web/categorias/${cfg.slug}.html`;
  writeFileSync(path, html, 'utf8');
  console.log('OK:', cfg.slug + '.html');
});
