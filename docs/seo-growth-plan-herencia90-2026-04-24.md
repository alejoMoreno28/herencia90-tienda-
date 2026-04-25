# SEO Growth Plan - Herencia 90

Fecha: 2026-04-24

Objetivo: posicionar Herencia 90 cuando alguien busque una camiseta especifica, por ejemplo `camiseta barcelona 1998 local`, `camiseta colombia 100 anos`, `camiseta real madrid 2011 visitante`, y que el resultado transmita confianza para comprar por WhatsApp.

## 1. Conclusion ejecutiva

La mejor forma de SEO para Herencia 90 no es intentar que una sola pagina `/preventa` rankee por todo. Google necesita paginas especificas, rastreables y con contenido claro para cada busqueda.

La formula correcta es:

- una URL limpia por camiseta: `/preventa/barcelona-1998-1999-local`
- titulo con equipo + ano/temporada + variante: `Camiseta Barcelona Local 1998/1999 Retro`
- fotos visibles en HTML con `img src` real
- datos estructurados `Product` + `Offer`
- precio, disponibilidad de pre-venta y CTA claro
- sitemap actualizado con todas las URLs
- enlaces internos desde la grilla y desde categorias
- contenido de confianza: anticipo, entrega, fotos de proveedor, WhatsApp, ciudad/pais

Eso es lo que se implemento como primera fase tecnica.

## 2. Investigacion usada

Fuentes principales:

- Google Search Central - Ecommerce SEO: https://developers.google.com/search/docs/specialty/ecommerce
- Google Search Central - Product structured data: https://developers.google.com/search/docs/appearance/structured-data/product
- Google Search Central - Product snippets: https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- Google Search Central - Image SEO: https://developers.google.com/search/docs/appearance/google-images
- Google Search Central - Ecommerce structured data: https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce

Lectura aplicada:

- Google entiende mejor un producto cuando cada referencia tiene su propia pagina y datos explicitos.
- Las fotos importan para busquedas visuales; Google recomienda usar etiquetas `img`, nombres/alt descriptivos y paginas de destino relevantes.
- Para ecommerce, el marcado `Product` y `Offer` ayuda a que Google entienda precio, disponibilidad e imagenes.
- El sitemap debe incluir las URLs que realmente queremos que Google descubra.
- Para productos por encargo, la disponibilidad correcta es `PreOrder`, no `InStock`.

## 3. Lo que se ejecuto en esta fase

Se agrego generacion SEO para preventa:

- 154 paginas estaticas nuevas bajo `web/preventa/*.html`
- 154 URLs nuevas en `web/sitemap.xml`
- archivo local sincronizado `web/preventa-catalogo.json`
- rewrite limpio en Vercel para `/preventa/:slug`
- Product JSON-LD por cada camiseta
- Breadcrumb JSON-LD por cada camiseta
- canonical URL por camiseta
- meta title, meta description, OG y Twitter cards
- CTA de WhatsApp con mensaje especifico de la referencia

Tambien se ajusto la grilla de preventa:

- cada card ahora tiene `href="/preventa/<slug>"` para que Google vea enlaces reales
- el comportamiento visual se mantiene: al usuario le sigue abriendo el lightbox
- se evito cambiar el diseno actual de preventa

## 4. Por que esto es importante

Antes:

- Google veia una pagina general de preventa.
- Muchas camisetas existian solo despues de cargar JS/Supabase.
- Las busquedas exactas tipo `camiseta barcelona 1998 local` no tenian una URL propia fuerte.

Ahora:

- cada camiseta puede rankear individualmente
- el sitemap le entrega a Google cada URL
- el marcado `Product` le da precio, imagenes y disponibilidad
- los enlaces internos desde la grilla reparten autoridad hacia las fichas

## 5. Que falta para la fase 2

Prioridad alta:

1. Crear landings por intencion comercial:
   - `/colecciones/colombia`
   - `/colecciones/real-madrid`
   - `/colecciones/barcelona`
   - `/colecciones/camisetas-retro`
   - `/colecciones/preventa`

2. Agregar contenido confiable en paginas clave:
   - como funciona la pre-venta
   - tiempos de entrega
   - anticipo del 20%
   - fotos de proveedor
   - atencion por WhatsApp
   - envio en Colombia

3. Fortalecer imagenes:
   - `alt` descriptivo por camiseta
   - evitar guias de tallas, logos de otra tienda o screenshots dentro de galerias
   - usar solo fotos de proveedor que coincidan con ano, color, sponsor, cuello y escudo

4. Mejorar confianza:
   - seccion visible de preguntas frecuentes sin usar FAQ schema comercial innecesario
   - testimonios o capturas limpias de entregas reales
   - politica de cambios/tallas
   - tiempos claros de importacion

5. Search Console:
   - reenviar sitemap
   - pedir indexacion manual de las primeras 20 URLs con mayor demanda
   - monitorear consultas reales y ajustar titulos

## 6. Que no se debe hacer

- No meter 200 camisetas con fotos dudosas solo por crecer.
- No usar imagenes que sean guia de tallas o tengan marca visible de otra tienda.
- No repetir fichas con el mismo producto y fotos distintas.
- No escribir titulos falsos tipo `oficial` si no es oficial.
- No llenar titles con spam de keywords.
- No sobrescribir paginas visuales actuales de categorias con plantillas viejas.

## 7. Proxima medicion

Despues de publicar:

- Revisar Search Console a los 7 dias.
- Revisar indexacion a los 14 dias.
- Revisar consultas con impresiones a los 21-30 dias.
- Ajustar titles/metas segun busquedas reales.

URLs iniciales para pedir indexacion manual:

- `https://www.herencia90.shop/preventa/colombia-2024-centenary-blanca`
- `https://www.herencia90.shop/preventa/colombia-2024-2025-100-aniversario-negra`
- `https://www.herencia90.shop/preventa/colombia-2025-2026-visitante`
- `https://www.herencia90.shop/preventa/barcelona-1998-1999-local`
- `https://www.herencia90.shop/preventa/barcelona-2008-2009-local-manga-larga`
- `https://www.herencia90.shop/preventa/real-madrid-2011-2012-local`
- `https://www.herencia90.shop/preventa/real-madrid-2017-2018-visitante`
- `https://www.herencia90.shop/preventa/manchester-united-1998-1999-local`
- `https://www.herencia90.shop/preventa/ac-milan-2006-2007-local`
- `https://www.herencia90.shop/preventa/brasil-2002-local`

