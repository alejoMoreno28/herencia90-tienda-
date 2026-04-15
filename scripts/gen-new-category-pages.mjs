import { readFileSync, writeFileSync } from 'fs';

const BASE = 'C:/Users/PC/Desktop/HERENCIA90';
const SUPABASE_URL = 'https://nlnrdtcgbdkzfzwnsffp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sbnJkdGNnYmRremZ6d25zZmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDUyNTcsImV4cCI6MjA5MTQyMTI1N30.T51eC1fJFc5Wn79JcA5l4m9CIYSYVhE7B7YU19CPQ00';

const templateHtml = readFileSync(`${BASE}/web/categorias/arsenal.html`, 'utf8');
const cssStart = templateHtml.indexOf('<style>');
const cssEnd = templateHtml.indexOf('</style>') + '</style>'.length;
const CSS = templateHtml.slice(cssStart, cssEnd);
const jsUtilsStart = templateHtml.indexOf('function slugifyText');
const jsUtilsEnd = templateHtml.lastIndexOf('</script>');
const JS_UTILS = templateHtml.slice(jsUtilsStart, jsUtilsEnd);

function slugify(v) {
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
function esc(v) { return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmtPrice(v) { return '$ ' + Number(v||0).toLocaleString('es-CO'); }
function sizes(p) { return Object.entries(p.tallas||{}).filter(([,q])=>Number(q)>0).map(([s])=>s); }
function imgSrc(p) { const i=p.imagenes&&p.imagenes.length?p.imagenes[0]:'img/logo.webp'; return i.startsWith('http')?i:'../'+i.replace(/^\/+/,''); }
function pUrl(p) { return '/camisetas/'+slugify(p.equipo); }
function waUrl(p) {
  const sz=sizes(p), szTxt=sz.length?' Tallas disponibles: '+sz.join(', ')+'.':'';
  const msg='Hola Herencia 90, me interesa la '+p.equipo+'.'+szTxt+' Vi esta referencia en https://www.herencia90.shop'+pUrl(p)+' y quiero confirmar disponibilidad.';
  return 'https://wa.me/573126428153?text='+encodeURIComponent(msg);
}

function buildPage(cfg) {
  const { slug, title, metaDesc, ogImage, eyebrow, h1, intro1, intro2, waMsg, channelName, products, otherLinks, faqItems } = cfg;
  const productIds = products.map(p => p.id);
  const url = 'https://www.herencia90.shop/categorias/' + slug;

  const schemaCollection = JSON.stringify({
    '@context':'https://schema.org','@type':'CollectionPage',
    name:title, description:metaDesc, url,
    mainEntity:{ '@type':'ItemList', itemListElement:products.map((p,i)=>({'@type':'ListItem',position:i+1,url:'https://www.herencia90.shop'+pUrl(p),name:p.equipo})) }
  });
  const schemaBreadcrumb = JSON.stringify({
    '@context':'https://schema.org','@type':'BreadcrumbList',
    itemListElement:[
      {'@type':'ListItem',position:1,name:'Inicio',item:'https://www.herencia90.shop/'},
      {'@type':'ListItem',position:2,name:'Categorias',item:'https://www.herencia90.shop/categorias'},
      {'@type':'ListItem',position:3,name:h1}
    ]
  });
  const schemaFaq = JSON.stringify({
    '@context':'https://schema.org','@type':'FAQPage',
    mainEntity:faqItems.map(f=>({'@type':'Question',name:f.q,acceptedAnswer:{'@type':'Answer',text:f.a}}))
  });
  const staticCollection = JSON.stringify({
    slug, name:h1, eyebrow, description:metaDesc, productIds,
    products:products.map(({id,equipo,categoria,descripcion,precio,tallas,imagenes})=>({id,equipo,categoria,descripcion,precio,tallas,imagenes}))
  });

  const cardsHtml = products.map(p => {
    const sz=sizes(p);
    return `
        <article class="collection-product-card">
          <a class="collection-product-image" href="${pUrl(p)}">
            <img src="${imgSrc(p)}" alt="${esc(p.equipo)}">
          </a>
          <div class="collection-product-copy">
            <span class="collection-product-category">${esc(p.categoria||'Herencia 90')}</span>
            <h2><a href="${pUrl(p)}">${esc(p.equipo)}</a></h2>
            <p>${esc((p.descripcion||'').slice(0,140))}...</p>
            <div class="collection-product-meta">
              <span>${fmtPrice(p.precio)}</span>
              <span>${esc(sz.join(', ')||'Consultar')}</span>
            </div>
            <div class="collection-product-actions">
              <a class="mini-btn mini-btn-primary" href="${pUrl(p)}">Ver ficha</a>
              <a class="mini-btn mini-btn-secondary" href="${waUrl(p)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
            </div>
          </div>
        </article>`;
  }).join('');

  const benefitsHtml = faqItems.slice(0,3).map(f=>`
        <article class="benefit-card">
          <strong>${esc(f.q)}</strong>
          <p>${esc(f.a)}</p>
        </article>`).join('');

  const linksHtml = otherLinks.map(l=>`
          <article class="link-card">
            <a href="/categorias/${l.slug}">
              <strong>${esc(l.name)}</strong>
              <p>${esc(l.desc)}</p>
            </a>
          </article>`).join('');

  const waHeroUrl = 'https://wa.me/573126428153?text='+encodeURIComponent(waMsg);
  const initStock = products.reduce((s,p)=>s+Object.values(p.tallas||{}).reduce((a,q)=>a+Number(q||0),0),0);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
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
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
  <script type="application/ld+json">${schemaCollection}</script>
  <script type="application/ld+json">${schemaBreadcrumb}</script>
  <script type="application/ld+json">${schemaFaq}</script>
  ${CSS}
</head>
<body>
  <header class="topbar">
    <a href="/">Volver al catalogo</a>
    <img src="../img/logo.webp" alt="Herencia 90">
    <a href="/preventa">Pre-venta</a>
  </header>
  <main class="page-shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Inicio</a><span>/</span><span>Categorias</span><span>/</span><span>${h1}</span>
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
          <strong class="stat-number" id="collectionStock">${initStock}</strong>
          <span>unidades en stock</span>
        </div>
        <div class="stat-box">
          <strong class="stat-number">Medellin</strong>
          <span>stock fisico, envio a toda Colombia</span>
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
        <div><h2>Preguntas frecuentes</h2><p>Todo lo que necesitas saber sobre esta coleccion</p></div>
      </div>
      <div class="benefit-grid">${benefitsHtml}</div>
    </section>
    <section class="collection-links">
      <div class="section-head">
        <div><h2>Explora otras colecciones</h2><p>Mas camisetas disponibles en Herencia 90</p></div>
      </div>
      <div class="links-grid">${linksHtml}</div>
    </section>
  </main>
  <script>
    const SUPABASE_URL = "${SUPABASE_URL}";
    const SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
    const STATIC_COLLECTION = ${staticCollection};
    const { createClient } = window.supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    ${JS_UTILS}
    const initStockEl = document.getElementById('collectionStock');
    const initStock = (STATIC_COLLECTION.products||[]).reduce((s,p)=>s+Object.values(p.tallas||{}).reduce((a,q)=>a+Number(q||0),0),0);
    if (initStockEl) initStockEl.textContent = initStock > 0 ? initStock : 'Consultar';
    trackCollectionPage();
    refreshCollectionFromSupabase();
    db.channel('${channelName}')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'productos'},(payload)=>{
        if(payload&&payload.new&&STATIC_COLLECTION.productIds.includes(payload.new.id)) refreshCollectionFromSupabase();
      }).subscribe();
  </script>
</body>
</html>`;
}

const p1 = { id:1,categoria:'Coleccion 2026',equipo:'Camiseta Alemania Mundial 2026',descripcion:'Camiseta oficial de la Seleccion de Alemania para el Mundial 2026. Diseno blanco clasico con detalles en negro y el aguila federal bordada. Version Fan con tela transpirable y corte moderno.',precio:99000,tallas:{L:1,M:1,S:0,XL:0},imagenes:['img/alemania_2026_version_fan_1.webp','img/alemania_2026_version_fan_2.webp','img/alemania_2026_version_fan_3.webp'] };
const p2 = { id:2,categoria:'Coleccion 2026',equipo:'Camiseta Argentina Mundial 2026',descripcion:'La camiseta mas iconica del mundo en su version 2026. Rayas celeste y blanco con detalles dorados en honor a los campeones del mundo. Version Fan de alta calidad para los verdaderos hinchas de la Albiceleste.',precio:99000,tallas:{L:1,M:1,S:0,XL:0},imagenes:['img/argnetina_2026_home_fan_1.webp','img/argnetina_2026_home_fan_2.webp','img/argnetina_2026_home_fan_3.webp'] };
const p9 = { id:9,categoria:'Coleccion 2026',equipo:'Camiseta Brasil Mundial 2026',descripcion:'La canarinha para el Mundial 2026. El iconico amarillo de Vinicius Jr. y Rodrygo con detalles verdes y el escudo de la CBF bordado. Para los hinchas de la Selecao que suenan con el hexacampeonato.',precio:99000,tallas:{L:1,M:1,S:0,XL:0},imagenes:['img/brasil_2026_version_fan_1.webp','img/brasil_2026_version_fan_2.webp','img/brasil_2026_version_fan_3.webp'] };
const p17 = { id:17,categoria:'Coleccion 2026',equipo:'Camiseta Portugal Edicion Especial Mundial 2026',descripcion:'Edicion especial de la Seleccion de Portugal para el ciclo 2026-27. El rojo de Cristiano Ronaldo y Bruno Fernandes en un diseno unico y atrevido que rompe con lo convencional. Version Fan de coleccion exclusiva.',precio:110000,tallas:{L:1,M:1,S:0,XL:0},imagenes:['img/portugal_2026_especial_26-27_fan_1.webp','img/portugal_2026_especial_26-27_fan_2.webp','img/portugal_2026_especial_26-27_fan_3.webp'] };
const p13 = { id:13,categoria:'Temporada 25/26',equipo:'Camiseta tercera Manchester City 25/26',descripcion:'Tercera equipacion del Manchester City 2025-26 en negro. Un diseno oscuro y sofisticado del campeon ingles, alejado del clasico celeste. Version Fan de edicion limitada para los Citizens mas atrevidos.',precio:99000,tallas:{L:1,M:1,S:0,XL:0},imagenes:['img/man_city_25-26_black_fan_1.webp','img/man_city_25-26_black_fan_2.webp','img/man_city_25-26_black_fan_3.webp'] };
const p14 = { id:14,categoria:'Temporada 25/26',equipo:'Camiseta local Manchester City 25/26',descripcion:'La camiseta local del Manchester City 2025-26 en el clasico celeste de los Citizens. El diseno del campeon ingles para la nueva era. Version Fan premium con tela ligera y acabados de calidad.',precio:99000,tallas:{L:1,M:1,S:0,XL:0},imagenes:['img/man_city_25-26_fan_home_1.webp','img/man_city_25-26_fan_home_2.webp','img/man_city_25-26_fan_home_3.webp'] };

const pages = [
  {
    slug:'brasil', title:'Camisetas Brasil Mundial 2026 Importadas | Herencia 90 Colombia',
    metaDesc:'Compra camisetas Brasil Mundial 2026 importadas en Colombia. La canarinha con envio a Medellin y toda Colombia. Atencion por WhatsApp.',
    ogImage:'img/brasil_2026_version_fan_1.webp', eyebrow:'Seleccion Brasil', h1:'Camisetas Brasil Mundial 2026',
    intro1:'La canarinha disponible en Colombia. La camiseta mas buscada del mundo para el Mundial 2026, con el amarillo iconico de la Selecao y envio a toda Colombia desde Medellin.',
    intro2:'Compra camisetas Brasil Mundial 2026 importadas en Colombia. Version Fan de calidad con envio nacional y atencion directa por WhatsApp.',
    waMsg:'Hola Herencia 90, quiero ver la camiseta Brasil Mundial 2026. Vi esta pagina https://www.herencia90.shop/categorias/brasil y quiero disponibilidad.',
    channelName:'seo-collection-live-brasil', products:[p9],
    faqItems:[
      {q:'¿La camiseta de Brasil es importada?',a:'Si, nuestra camiseta de Brasil 2026 es importada directamente, version Fan con el iconico amarillo de la Selecao y acabados de calidad.'},
      {q:'¿Tienen la camiseta amarilla del Brasil Mundial 2026?',a:'Si, tenemos la camiseta local amarilla de Brasil para el Mundial 2026. Disponibilidad por talla se confirma por WhatsApp.'},
      {q:'¿Hacen envios a toda Colombia de la camiseta de Brasil?',a:'Si, despachamos desde Medellin a todos los municipios de Colombia en 1 a 3 dias habiles.'}
    ],
    otherLinks:[
      {slug:'argentina',name:'Argentina',desc:'Camisetas Argentina Mundial 2026 importadas. La Albiceleste de Messi con envio a toda Colombia.'},
      {slug:'colombia',name:'Colombia 2026',desc:'Camisetas Colombia Mundial 2026 importadas. La tricolor con envio nacional desde Medellin.'},
      {slug:'temporada-25-26',name:'Temporada 25/26',desc:'Camisetas de clubes europeos temporada 25/26 importadas y disponibles en Colombia.'}
    ]
  },
  {
    slug:'argentina', title:'Camisetas Argentina Mundial 2026 Importadas | Herencia 90 Colombia',
    metaDesc:'Compra camisetas Argentina Mundial 2026 importadas en Colombia. La Albiceleste campeona del mundo con envio a Medellin y toda Colombia.',
    ogImage:'img/argnetina_2026_home_fan_1.webp', eyebrow:'Seleccion Argentina', h1:'Camisetas Argentina Mundial 2026',
    intro1:'La Albiceleste campeona del mundo disponible en Colombia. Las rayas celeste y blanco de los campeones en version importada con envio a toda Colombia desde Medellin.',
    intro2:'Compra camisetas Argentina Mundial 2026 importadas en Colombia. Version Fan de alta calidad con envio nacional y atencion directa por WhatsApp.',
    waMsg:'Hola Herencia 90, quiero ver la camiseta Argentina Mundial 2026. Vi esta pagina https://www.herencia90.shop/categorias/argentina y quiero disponibilidad.',
    channelName:'seo-collection-live-argentina', products:[p2],
    faqItems:[
      {q:'¿La camiseta de Argentina es importada?',a:'Si, nuestra camiseta de Argentina 2026 es importada directamente, version Fan con las rayas celeste y blanco de los campeones del mundo.'},
      {q:'¿Tienen la camiseta Argentina Mundial 2026 en stock?',a:'Si, tenemos la camiseta de Argentina en stock en Medellin. Disponibilidad exacta por talla se confirma por WhatsApp.'},
      {q:'¿Hacen envios a toda Colombia de la camiseta de Argentina?',a:'Si, despachamos desde Medellin a todos los municipios de Colombia en 1 a 3 dias habiles.'}
    ],
    otherLinks:[
      {slug:'brasil',name:'Brasil',desc:'Camisetas Brasil Mundial 2026 importadas. La canarinha con envio a toda Colombia.'},
      {slug:'colombia',name:'Colombia 2026',desc:'Camisetas Colombia Mundial 2026 importadas. La tricolor con envio nacional desde Medellin.'},
      {slug:'temporada-25-26',name:'Temporada 25/26',desc:'Camisetas de clubes europeos temporada 25/26 importadas disponibles en Colombia.'}
    ]
  },
  {
    slug:'alemania', title:'Camisetas Alemania Mundial 2026 Importadas | Herencia 90 Colombia',
    metaDesc:'Compra camisetas Alemania Mundial 2026 importadas en Colombia. La seleccion alemana con envio a Medellin y toda Colombia. Atencion por WhatsApp.',
    ogImage:'img/alemania_2026_version_fan_1.webp', eyebrow:'Seleccion Alemania', h1:'Camisetas Alemania Mundial 2026',
    intro1:'El blanco clasico de la seleccion alemana disponible en Colombia. La camiseta de Alemania para el Mundial 2026 en version importada con envio a toda Colombia desde Medellin.',
    intro2:'Compra camisetas Alemania Mundial 2026 importadas en Colombia. Version Fan con tela transpirable, envio nacional y atencion directa por WhatsApp.',
    waMsg:'Hola Herencia 90, quiero ver la camiseta Alemania Mundial 2026. Vi esta pagina https://www.herencia90.shop/categorias/alemania y quiero disponibilidad.',
    channelName:'seo-collection-live-alemania', products:[p1],
    faqItems:[
      {q:'¿La camiseta de Alemania es importada?',a:'Si, nuestra camiseta de Alemania 2026 es importada directamente, version Fan con el diseno blanco clasico y el aguila federal.'},
      {q:'¿Tienen la camiseta blanca de Alemania Mundial 2026?',a:'Si, tenemos la camiseta de Alemania en blanco con detalles en negro. Disponibilidad por talla se confirma por WhatsApp.'},
      {q:'¿Hacen envios a toda Colombia de la camiseta de Alemania?',a:'Si, despachamos desde Medellin a todos los municipios de Colombia en 1 a 3 dias habiles.'}
    ],
    otherLinks:[
      {slug:'brasil',name:'Brasil',desc:'Camisetas Brasil Mundial 2026 importadas con envio a toda Colombia.'},
      {slug:'argentina',name:'Argentina',desc:'Camisetas Argentina Mundial 2026. La Albiceleste campeona con envio nacional.'},
      {slug:'temporada-25-26',name:'Temporada 25/26',desc:'Camisetas de clubes europeos temporada 25/26 importadas en Colombia.'}
    ]
  },
  {
    slug:'portugal', title:'Camisetas Portugal Mundial 2026 Importadas | Herencia 90 Colombia',
    metaDesc:'Compra camisetas Portugal Mundial 2026 importadas en Colombia. Edicion especial de la Seleccion portuguesa con envio nacional y atencion por WhatsApp.',
    ogImage:'img/portugal_2026_especial_26-27_fan_1.webp', eyebrow:'Seleccion Portugal', h1:'Camisetas Portugal Mundial 2026',
    intro1:'Portugal disponible en Colombia. La seleccion de Ronaldo y Bruno Fernandes en version importada con envio a toda Colombia desde Medellin. Edicion especial unica.',
    intro2:'Compra camisetas Portugal Mundial 2026 importadas en Colombia. Edicion especial de coleccion con envio nacional y atencion directa por WhatsApp.',
    waMsg:'Hola Herencia 90, quiero ver la camiseta Portugal Mundial 2026. Vi esta pagina https://www.herencia90.shop/categorias/portugal y quiero disponibilidad.',
    channelName:'seo-collection-live-portugal', products:[p17],
    faqItems:[
      {q:'¿La camiseta de Portugal es importada?',a:'Si, nuestra camiseta de Portugal es importada directamente, version Fan en edicion especial con diseno unico para el ciclo 2026-27.'},
      {q:'¿Que tiene de especial la camiseta de Portugal que venden?',a:'Es una edicion especial que rompe con el diseno convencional, con detalles exclusivos. Precio de $110.000 por ser edicion de coleccion.'},
      {q:'¿Hacen envios a toda Colombia de la camiseta de Portugal?',a:'Si, despachamos desde Medellin a todos los municipios de Colombia en 1 a 3 dias habiles.'}
    ],
    otherLinks:[
      {slug:'brasil',name:'Brasil',desc:'Camisetas Brasil Mundial 2026 importadas con envio a toda Colombia.'},
      {slug:'argentina',name:'Argentina',desc:'Camisetas Argentina Mundial 2026. La Albiceleste con envio nacional.'},
      {slug:'colombia',name:'Colombia 2026',desc:'Camisetas Colombia Mundial 2026. La tricolor con envio desde Medellin.'}
    ]
  },
  {
    slug:'manchester-city', title:'Camisetas Manchester City 25/26 Importadas | Herencia 90 Colombia',
    metaDesc:'Compra camisetas Manchester City 25/26 importadas en Colombia. Local celeste y tercera negra de los Citizens con envio nacional y atencion por WhatsApp.',
    ogImage:'img/man_city_25-26_fan_home_1.webp', eyebrow:'Manchester City', h1:'Camisetas Manchester City 25/26',
    intro1:'El celeste de los Citizens disponible en Colombia. Las camisetas del Manchester City 25/26 importadas con envio a toda Colombia desde Medellin.',
    intro2:'Compra camisetas Manchester City 25/26 importadas en Colombia. Local en celeste y tercera en negro, con envio nacional y atencion directa por WhatsApp.',
    waMsg:'Hola Herencia 90, quiero ver referencias Manchester City 25/26. Vi esta pagina https://www.herencia90.shop/categorias/manchester-city y quiero disponibilidad.',
    channelName:'seo-collection-live-manchester-city', products:[p14,p13],
    faqItems:[
      {q:'¿Las camisetas del Manchester City son importadas?',a:'Si, todas nuestras referencias del City son importadas directamente, version Fan con telas livianas y acabados de calidad.'},
      {q:'¿Tienen la camiseta celeste local y la tercera negra del City?',a:'Si, tenemos ambas referencias del Manchester City 25/26. Disponibilidad por talla se confirma por WhatsApp desde Medellin.'},
      {q:'¿Hacen envios a toda Colombia del Manchester City?',a:'Si, despachamos desde Medellin a todos los municipios de Colombia en 1 a 3 dias habiles.'}
    ],
    otherLinks:[
      {slug:'manchester-united',name:'Manchester United',desc:'Camisetas Manchester United 25/26 importadas. Los Red Devils con envio a toda Colombia.'},
      {slug:'liverpool',name:'Liverpool',desc:'Camisetas Liverpool 25/26 importadas en Colombia. El rojo de Anfield con envio nacional.'},
      {slug:'temporada-25-26',name:'Temporada 25/26',desc:'Toda la coleccion de clubes europeos 25/26 importadas en Colombia.'}
    ]
  }
];

pages.forEach(cfg => {
  const html = buildPage(cfg);
  writeFileSync(`${BASE}/web/categorias/${cfg.slug}.html`, html, 'utf8');
  console.log('OK:', cfg.slug + '.html');
});
