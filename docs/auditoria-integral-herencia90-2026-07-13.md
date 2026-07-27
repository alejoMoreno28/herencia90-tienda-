# Auditoría integral de HERENCIA90

**Fecha:** 13 de julio de 2026  
**Alcance:** negocio, precios, catálogo, experiencia de compra, diseño, SEO, rendimiento, redes sociales, contenido, pauta, inventario, fotografías, pagos, Shopify, admin, automatizaciones, seguridad y plan de crecimiento.  
**Estado:** diagnóstico y estrategia. No se modificó código ni se hicieron cargas, publicaciones, pedidos, pagos o cambios en Supabase.

## Veredicto ejecutivo

HERENCIA90 **sí puede convertirse en una marca rentable y en una tienda que venda sin depender de conversaciones manuales**, pero todavía no está lista para escalar pauta ni para recibir un volumen alto de compras autónomas.

La oportunidad es real por cuatro razones:

1. La economía ya tiene señales positivas: 89 movimientos de venta, COP 9.797.000 cobrados y COP 5.242.612 de utilidad neta realizada entre marzo y julio de 2026. El margen neto registrado es 53,5%.
2. El precio está bien ubicado: HERENCIA90 vende gran parte del stock entre COP 99.000 y COP 130.000, mientras competidores comparables están aproximadamente entre COP 120.000 y COP 219.000.
3. El producto está en una ola cultural favorable: Mundial, nostalgia, coleccionismo y uso de camisetas como moda urbana, no solo como uniforme de hincha.
4. La identidad negra, blanca y dorada se ve más seria y cuidada que muchas tiendas pequeñas de la categoría.

El freno no es la falta de producto. El freno es que hoy hay cuatro negocios distintos sin terminar de conectarse:

- una vitrina pública atractiva;
- un carrito que termina en WhatsApp;
- un catálogo bajo pedido separado;
- un admin potente, pero monolítico y expuesto a errores operativos.

La prioridad correcta no es migrar todo a Shopify ni comprar mucho inventario. Es esta:

> **Primero asegurar el negocio, medir el embudo, dar confianza y habilitar un checkout real para stock. Después crear contenido de forma consistente. Solo entonces invertir en pauta y profundizar inventario.**

## Puntuación actual

| Área | Nota | Lectura |
|---|---:|---|
| Oportunidad de mercado | 8,5/10 | El momento Mundial + retro + moda urbana es favorable. |
| Economía unitaria registrada | 8,5/10 | Margen alto, aunque falta separar mejor costos de adquisición, devoluciones y pasarela. |
| Competitividad de precios | 8,0/10 | Precio atractivo; algunas referencias podrían sostener un premium con mejor prueba de calidad. |
| Identidad visual | 7,5/10 | Marca reconocible y más premium que el promedio pequeño. |
| Catálogo y navegación | 6,5/10 | Funciona, pero falta filtrado, coherencia entre fichas y una ruta de compra única. |
| Rendimiento móvil | 6,5/10 | Inicio rápido; catálogo y bajo pedido necesitan mejorar LCP. |
| SEO técnico | 6,0/10 | Buena infraestructura base, pero hay errores de schema y muchas páginas débiles. |
| Admin y automatizaciones | 5,0/10 | Mucha capacidad, pero demasiada lógica crítica en una sola página y operaciones no atómicas. |
| Planeación de inventario | 4,5/10 | Hay mucha amplitud y poca profundidad por referencia. |
| Contenido SEO | 4,0/10 | Demasiadas fichas programáticas con poco contenido diferenciador. |
| Confianza y preparación legal | 3,5/10 | Faltan políticas públicas, identidad comercial completa y revisión de procedencia/marcas. |
| Seguridad operativa | 3,0/10 | Hay endpoints administrativos sin autenticación suficiente. |
| Compra autónoma | 3,0/10 | No existe pago web ni pedido confirmado automáticamente. |
| Redes sociales | 2,5/10 | Instagram y TikTok están apenas empezando. |
| Analítica de conversión | 2,0/10 | El dashboard no refleja el embudo actual porque la analítica pública está desactivada. |

**Madurez global estimada: 5,6/10.** La base comercial es mejor que la madurez digital. Eso es una buena noticia: hay algo que ordenar y escalar, no un negocio que inventar desde cero.

## Datos comprobados

### Ventas y margen

| Indicador | Valor observado |
|---|---:|
| Movimientos de venta | 89 |
| Ventas cobradas | COP 9.797.000 |
| Utilidad neta realizada | COP 5.242.612 |
| Margen neto registrado | 53,5% |
| Ticket promedio aproximado | COP 110.079 |
| Utilidad promedio por movimiento de venta | COP 58.906 |

Estos valores provienen del admin y representan el acumulado disponible, no una proyección mensual. Tampoco prueban por sí solos que la web originó las ventas: las notas observadas indican que una parte importante llegó por relaciones personales o canales de confianza.

### Inventario público actual

| Indicador | Valor |
|---|---:|
| Referencias visibles | 58 |
| Unidades realmente disponibles | 54 |
| Unidades reservadas | 5 |
| Referencias agotadas | 27 (46,6%) |
| Referencias con stock | 31 |
| Referencias con 1–2 unidades | 28 |
| Valor de venta potencial disponible | COP 5.793.000 |

El inventario tiene menos de una unidad disponible por referencia en promedio. El problema no es falta de variedad; es **fragmentación**.

Distribución disponible por talla:

| Talla | Unidades | Participación del stock disponible |
|---|---:|---:|
| S | 4 | 7,4% |
| M | 19 | 35,2% |
| L | 22 | 40,7% |
| XL | 9 | 16,7% |

Esto describe lo que queda, no lo que más se vende. No debe usarse como demanda histórica hasta exportar ventas por talla.

## Prioridades críticas

### P0 — antes de pautar o habilitar pagos

| Hallazgo | Riesgo | Acción |
|---|---|---|
| `/api/search-provider-images` no autentica al usuario y permite indicar una URL externa antes de subir resultados con credenciales de servicio. | Abuso de almacenamiento, consumo de recursos y riesgo de SSRF. | Exigir sesión admin, lista estricta de dominios, bloquear IP privadas/metadata, limitar tamaño y rate limit. |
| `/api/optimize-product` llama a un servicio de IA pagado sin exigir sesión admin. | Consumo no autorizado y costo. | Exigir usuario autenticado, rate limit y cuota. |
| El importador de Yupoo acepta un token administrativo con valor predeterminado en código si falta la variable de entorno. | Credencial predecible. | Eliminar cualquier valor predeterminado y validar sesión/rol admin. |
| No existen páginas públicas completas de términos, privacidad, envíos, cambios, garantía, retracto y reversión. | Baja confianza y exposición en comercio electrónico. | Publicar políticas revisadas para Colombia antes del checkout. |
| Dos descripciones llaman “oficial” a prendas cuya autorización no está demostrada. | Riesgo de información engañosa, propiedad intelectual y suspensión publicitaria. | Auditar proveedor, facturas y autorización; corregir toda afirmación que no pueda probarse. |
| La analítica del storefront está desactivada con `ENABLE_PUBLIC_ANALYTICS = false`. | No se conocen conversión, abandono, productos ganadores ni CAC. | Definir consentimiento y reactivar un embudo medible de forma segura. |
| El dashboard mezcla 54 unidades disponibles con 5 reservadas y muestra 59 como inventario. | Decisiones de compra y valoración incorrectas. | Una sola función de stock disponible; reservas como entidad separada. |
| El generador crea URLs de imagen inválidas en Product schema. | Pérdida de resultados enriquecidos y señales de calidad. | Tratar correctamente URLs absolutas y excluir tallas reservadas. |

### P1 — siguientes 30 días

- Checkout de stock con pasarela, confirmación y webhook.
- Página de producto coherente con carrito, talla, envío, políticas y pago.
- Fotografías reales de las 10–12 referencias principales.
- Eventos GA4/first-party: `view_item`, `select_size`, `add_to_cart`, `begin_checkout`, `purchase`, `whatsapp_support`.
- Arreglo de navegación, accesibilidad del modal y filtros del catálogo.
- Consolidación SEO: menos páginas débiles y más páginas útiles.
- Primer sistema ABC de inventario y reposición.
- Calendario de 30 días para TikTok e Instagram.

### P2 — 31 a 90 días

- Contenido editorial y páginas de colección con intención de búsqueda.
- Automatización de pedidos, estados, notificaciones y conciliación.
- Reseñas verificadas y contenido de clientes.
- Pruebas pequeñas de pauta, condicionadas a medición y cumplimiento de políticas.
- Programa de creadores/afiliados en Medellín y Colombia.

## Auditoría comercial y de precios

### Posicionamiento recomendado

HERENCIA90 no debe competir solo como “la camiseta barata”. La posición más defendible es:

> **La tienda colombiana que cuenta la historia detrás de cada camiseta, muestra su calidad real y entrega con condiciones claras.**

Los tres atributos de marca deben ser:

1. **Historia:** nostalgia, partidos, jugadores y momentos.
2. **Prueba:** fotos propias, video de tejido, escudo, costuras, tallaje y empaque.
3. **Claridad:** stock real, plazo real, precio total, cambios, pedido y seguimiento.

### Comparación de precios en Colombia

| Tienda | Precio observado | Compra | Ventaja visible | Debilidad visible |
|---|---:|---|---|---|
| HERENCIA90 | Stock COP 79.000–150.000; mayoría COP 99.000–130.000; bajo pedido COP 120.000 | Carrito + WhatsApp | Precio, diseño de marca, entrega bajo pedido de ~15 días | Sin pago web, pocas reseñas/políticas, fichas inconsistentes |
| [Escorpión](https://camisetasdefutbol.com.co/products/camiseta-colombia-1990-local-retro) | COP 120.000 | Checkout Shopify | Reseñas, personalización +COP 10.000, políticas | Bajo encargo de 3–5 semanas; no cambios por talla |
| [Fútbol de Primera](https://futboldeprimera.com.co/categoria-producto/camisetas/camisetas_retro/) | Retro COP 130.000; manga larga COP 140.000 | Carrito/checkout | Mucha variedad, talla y jugador | Fichas muy cortas y diseño menos premium |
| [Sport Shirts](https://www.sportshirts.co/retro/?Talla=S) | Aproximadamente COP 124.000 | Carrito y varios medios de pago | Cuenta, seguimiento, personalización, amplitud | Muchas referencias agotadas |
| [Gambeta](https://gambetatienda.com/) | COP 129.000–149.000 | Carrito | Oferta retro directa | Web y confianza visual más débiles |
| [RetroChimbas](https://retrochimbas.com/) | COP 160.000–200.000 | Checkout | Historia, cuidados, stock inmediato | Precio considerablemente mayor |
| [Panitas](https://panitastienda.com/collections/camisetas-retro-personalizadas-1) | COP 189.000–219.000 | Checkout | Contenido largo, personalización, marca activa | Precios altos y señales de copy sin depurar |
| [adidas Colombia](https://www.adidas.co/retro-colombia) | COP 379.950 | Checkout oficial | Producto autorizado, confianza, logística | Precio alto para el segmento alternativo |

Conclusión: **HERENCIA90 no está cara.** En varias referencias está 15%–40% por debajo de competidores especializados. No recomiendo subir todo de inmediato; recomiendo ganar confianza y probar aumentos controlados.

### Arquitectura de precios

| Nivel | Producto | Precio guía |
|---|---|---:|
| Entrada | Fan actual seleccionada / liquidación | COP 99.000–109.000 |
| Núcleo | Retro y temporada con alta demanda | COP 119.000–129.000 |
| Premium | Player, manga larga, detalles o personalización | COP 139.000–159.000 |
| Bundle | Dos referencias seleccionadas | COP 180.000–220.000 según costo |

Reglas:

- Mantener COP 99.000 como precio de entrada, no como precio universal.
- Usar `Desde` solo cuando existan variantes con precios distintos.
- Probar +COP 10.000 en 3 referencias con fotos propias y medir conversión contra control.
- Mantener la promoción 2 x COP 180.000 solo en inventario que deba rotar y con margen confirmado.
- Considerar envío gratis desde COP 199.000 si el costo logístico permite elevar el ticket a dos prendas.
- Cobrar personalización separada, con confirmación clara de que una prenda personalizada puede tener condiciones de cambio distintas. Needs confirmation legal.

## Qué puede llegar a ser la marca

No es una valoración del negocio ni una promesa. Son escenarios de capacidad usando el ticket observado de COP 110.079 y un margen de contribución futuro más conservador de 35%–45% después de pagos, contenido, devoluciones y adquisición.

| Escenario | Pedidos/mes | Ingresos/mes | Contribución estimada |
|---|---:|---:|---:|
| Negocio estable | 30 | COP 3,30 M | COP 1,16–1,49 M |
| Marca regional fuerte | 75 | COP 8,26 M | COP 2,89–3,72 M |
| E-commerce nacional pequeño | 150 | COP 16,51 M | COP 5,78–7,43 M |

El sitio actual puede llegar al primer escenario. Para 75 pedidos/mes necesita checkout, medición, políticas, contenido y admin seguro. Para 150 pedidos/mes necesita procesos atómicos, atención estructurada, logística medible y probablemente una plataforma operativa más modular.

## Página pública: diseño y experiencia

### Lo que debe conservarse

- Paleta negra/blanca/dorada: premium y recordable.
- Hero de nostalgia futbolera y doble oferta stock / bajo pedido.
- Tarjetas limpias con tallas y escasez visible.
- Contra entrega, envío nacional y guía de tallas como reductores de riesgo.
- Catálogo bajo pedido con filtros por selección, club, década y destacados.
- Carga local primero y sincronización diferida: buena decisión de rendimiento.

### Problemas de conversión

1. **La ruta de compra cambia según la página.** En catálogo existe carrito; en fichas de stock y bajo pedido solo WhatsApp.
2. **El producto individual devuelve al inicio**, no a `/catalogo`, desde varios enlaces de “volver”.
3. **El CTA de agregar al carrito parece activo antes de elegir talla.** Debe estar deshabilitado y explicar el siguiente paso.
4. **Falta un checkout.** El carrito solo construye un mensaje de WhatsApp; no crea pedido, no reserva stock y no confirma pago.
5. **La home tarda en mostrar producto.** En móvil el hero y mensajes de confianza ocupan demasiado antes del primer artículo.
6. **El catálogo tiene orden, pero no filtros visibles suficientes** por disponibilidad, talla, precio, selección/club, retro/actual y género.
7. **Stock y bajo pedido parecen dos sistemas de diseño diferentes.** El verde debe reservarse para WhatsApp; las acciones principales de marca deben usar dorado/negro.
8. **La palabra “Pre-venta” aparece en fichas generadas.** La convención comercial debe ser `bajo pedido` o `pre orden`.
9. **Las políticas prometidas no están enlazadas.** Se anuncia “Cambios en 7 días” y “Garantía de cambios” sin una página pública que defina condiciones.

### Embudo recomendado

```text
Contenido / Google
        ↓
Colección o ficha útil
        ↓
Talla + stock/plazo + fotos reales + políticas
        ↓
Agregar al carrito
        ↓
Datos mínimos + entrega + método de pago
        ↓
Pago / contra entrega
        ↓
Pedido confirmado + seguimiento
        ↓
Reseña / segunda compra
```

WhatsApp debe quedar como **soporte y recuperación**, no como único checkout.

## Fotografías

### Recomendación: modelo híbrido

- **Stock y anuncios:** fotos propias.
- **Bajo pedido de cola larga:** fotos del proveedor, claramente identificadas.
- **Referencias ganadoras bajo pedido:** comprar una muestra y producir material propio antes de pautarlas.

No conviene fotografiar las 232 referencias de una vez. Empezar con las 10–12 que generan más intención.

Estándar mínimo:

1. Frontal y posterior en 4:5, fondo consistente.
2. Escudo, cuello, tejido, costura y etiqueta en macro.
3. Video de 8–15 segundos moviendo la tela con luz natural.
4. Persona real con altura, peso y talla usada.
5. Empaque y prueba de despacho.
6. Archivo WebP/AVIF optimizado, sin eliminar el máster.

El contenido propio permite subir precio, defender calidad y reducir cambios. Las fotos del proveedor dan amplitud, pero no construyen suficiente confianza para una compra autónoma.

## Accesibilidad y consistencia visual

- Las imágenes auditadas tienen `alt`; es una fortaleza.
- El modal de producto no tiene `role="dialog"`, `aria-modal`, nombre accesible, trampa de foco ni retorno de foco.
- El cierre del modal es un `span`, no un botón semántico.
- Falta enlace de “saltar al contenido”.
- Hay 44 usos aproximados de `transition: all` entre los estilos principales y bajo pedido.
- El admin contiene elementos `div/span` accionables y formularios con etiquetado desigual.
- Hay soporte parcial de `prefers-reduced-motion`, pero no cubre todo el sitio.

## Rendimiento móvil

Medición de laboratorio propia: viewport 390×844, CPU 4×, red móvil simulada, caché fría. No sustituye CrUX ni Search Console.

| Ruta | LCP aproximado | CLS | Transferencia | Lectura |
|---|---:|---:|---:|---|
| `/` | 1,78 s | 0,0004 | 246 KB | Bueno |
| `/catalogo` | 3,98 s | 0 | 134 KB | Necesita mejora |
| `/preventa` | 2,84 s | 0 | 82 KB | Necesita mejora |

El inicio ya no presenta el problema severo de carga que tenía anteriormente. El foco ahora debe estar en el tiempo hasta que la imagen principal del catálogo se estabilice, el DOM de 821 nodos y la carga de primeras imágenes. La API pública de PageSpeed respondió 429 durante la auditoría, por lo que faltan datos de campo.

## SEO

### Fortalezas técnicas

- `robots.txt`, `sitemap.xml` y `llms.txt` responden 200.
- Las 261 URLs del sitemap respondieron 200 en una comprobación completa.
- Títulos y meta descripciones estáticas son únicos en el conjunto auditado.
- Canonical presente en las páginas públicas principales.
- No se encontraron imágenes sin atributo `alt` en los HTML generados.
- Hay datos estructurados de Organization, LocalBusiness, Product y Breadcrumb.

### Hallazgos críticos

| Hallazgo | Evidencia | Acción |
|---|---|---|
| URLs de imagen inválidas en Product schema | 47 fichas de stock contienen `https://www.herencia90.shop/https://...` | Corregir el generador y regenerar. |
| Descripciones vacías en Product schema | 11 fichas | No publicar schema incompleto. |
| Reservas tratadas como stock en fichas generadas | 6 páginas contienen claves `R_*`; el generador suma todas las tallas | Excluir reservas de disponibilidad y tallas. |
| Fichas de stock huérfanas | 75 archivos de ficha, pero 15 no están en sitemap | Redirigir, eliminar o justificar; evitar páginas obsoletas. |
| Bajo pedido demasiado programático | 174 fichas; descripción fuente mediana de 5 palabras | Enriquecer ganadoras y no indexar las débiles hasta tener valor real. |
| Categorías sin contenido visible | 17 páginas con H1 solo para lector y una cuadrícula dinámica | H1 visible + 300–500 palabras útiles + FAQs reales + enlaces. |
| Páginas de ciudad casi duplicadas | 5 páginas de 1.011 palabras con 99,4%–100% de vocabulario compartido | Mantener solo ubicaciones con información local real; consolidar el resto en “Envíos a Colombia”. |
| La marca no apareció en la muestra externa | Búsquedas de marca y `site:` no devolvieron HERENCIA90 | Verificar cobertura, consultas e indexación en Search Console. No es prueba definitiva de desindexación. |

### Qué posicionar primero

1. `camisetas retro colombia` y años 1990, 1994, 2014.
2. `camisetas retro mundial`: Japón 1998, Alemania 1990, Brasil 2002.
3. `camiseta retro [equipo] [temporada]`: páginas solo para referencias con demanda.
4. `camisetas retro medellín`: una página local real, con entrega/recogida, fotos y testimonios de clientes locales.
5. Guías: tallas fan vs player, cómo cuidar una camiseta, cómo funciona bajo pedido y cómo identificar buena confección.

### Plan SEO de 90 días

- Semana 1–2: schema, reservas, huérfanas, políticas, Search Console.
- Semana 3–4: reescribir 10 fichas principales con 250–400 palabras realmente únicas.
- Mes 2: crear 4 colecciones fuertes y consolidar ciudades duplicadas.
- Mes 3: publicar 6 historias/guías con video propio e interlinking.
- Añadir `MerchantReturnPolicy` y `ShippingService` solo cuando las políticas reales estén confirmadas.
- Usar Review/AggregateRating únicamente con reseñas verificables.

## Analítica y medición

El dashboard muestra en los últimos 30 días:

- 127 visitas de página;
- 128 aperturas de modal;
- 0 clics a WhatsApp;
- 0 agregados al carrito;
- 0% de conversión.

Estos valores **no describen el comportamiento real actual**. El storefront tiene `ENABLE_PUBLIC_ANALYTICS = false`; además, una prueba de agregar al carrito no produjo evento visible. Las aperturas pueden mezclar datos históricos y fichas generadas que todavía envían eventos.

Antes de cualquier pauta, implementar:

| Evento | Propiedades mínimas |
|---|---|
| `view_item_list` | colección, fuente, dispositivo |
| `view_item` | producto, precio, stock/pre orden |
| `select_size` | producto, talla |
| `add_to_cart` | producto, talla, cantidad, valor |
| `begin_checkout` | items, valor, entrega |
| `purchase` | order_id, valor, canal, pago |
| `whatsapp_support` | página y motivo, sin datos sensibles |

El evento `purchase` debe llegar desde el backend/webhook de pago o desde la confirmación operativa, no solo desde un clic del navegador.

KPIs semanales:

- sesiones cualificadas;
- vistas de producto por sesión;
- selección de talla;
- add-to-cart rate;
- inicio de checkout;
- conversión pagada y contra entrega;
- ticket promedio;
- margen de contribución;
- CAC por canal;
- tasa de rechazo contra entrega;
- cambios/devoluciones;
- días para vender 50% del lote.

## Inventario: qué comprar y cuánto

### Diagnóstico

- 27 de 58 referencias están agotadas.
- 28 de las 31 que sí tienen stock solo tienen 1–2 unidades.
- `Temporada 25/26` conserva 19 unidades en 18 referencias; la temporada ya terminó.
- `Retro` tiene 12 referencias, pero solo 6 unidades disponibles y 8 referencias agotadas.
- Bayern 2026/27 concentra 8 unidades. No debe recibir más stock hasta demostrar rotación.

### Método obligatorio antes del próximo lote grande

1. Publicar 8–10 candidatas en bajo pedido durante 14 días.
2. Medir intención cualificada: talla elegida + carrito/checkout, mensaje específico o anticipo.
3. Seleccionar las 3 con mayor intención, no las 3 con más vistas.
4. Comprar 6 unidades por ganadora: **S1, M2, L2, XL1** como piloto neutral.
5. Reordenar cuando venda 50% en 14 días o queden menos de 3 semanas de cobertura.
6. No comprar 2XL en profundidad hasta tener pedidos por talla.

### Referencias que vale la pena probar

**Prioridad A — prueba inmediata en pre orden**

- Colombia 1990 local/visitante y Colombia 1994.
- Japón 1998.
- Brasil 2002/Ronaldo.
- Alemania 1990 o 1994.
- Argentina 1986, 1994 o 2006.
- Barcelona 2008/09.
- Real Madrid 1999/00 o 2006/07.

**Prioridad B — test de contenido y lista de espera**

- Nigeria 1994/2018.
- Inglaterra Euro 1996.
- Milan 2006/07.
- Liverpool 2004/05.
- Inter 1997/98.
- Arsenal 2003/04.

La señal reciente local más clara pide Japón 1998; las conversaciones globales recientes repiten Alemania 1990/94, Brasil 2002 y camisetas mundialistas. La colección oficial Bringback de adidas también mezcla reediciones con siluetas crop, señal para explorar público femenino y styling.

### Liquidación y profundidad

- No profundizar `25/26`; usarla en bundles, contenido y salida controlada.
- Stock inmediato debe concentrarse en 8–12 referencias, no 58.
- Bajo pedido absorbe la cola larga de clubes, décadas y rarezas.
- Separar ABC:
  - A: 60% del capital, ganadoras probadas.
  - B: 25%, referencias con intención media.
  - C: 15%, pruebas y rarezas bajo pedido.

## Redes sociales

### Estado observado

| Red | Cuenta | Estado público |
|---|---|---|
| Instagram | `@herencia90_` | 69 seguidores, 2 seguidos, 5 publicaciones |
| TikTok | `@herencia90_` | 22 seguidores, 145 me gusta, 5 videos |

La biografía ya comunica retro/temporada, envío nacional y web. El problema es volumen y prueba social, no la existencia de las cuentas.

### Estrategia de 30 días

Publicar 2 piezas cortas al día reutilizando una producción: 1 video principal + 1 corte/variación. Reels y TikTok primero; Shorts como reutilización.

| Pilar | % | Ejemplos |
|---|---:|---|
| Historia y nostalgia | 40% | “La camiseta que cambió este Mundial”, jugadores, partidos, curiosidades |
| Prueba de calidad | 25% | tejido, escudo, costuras, comparación fan/player, empaque |
| Estilo y tallaje | 20% | outfits, blokecore, mujer, crop/oversize, M vs L |
| Drop y escasez | 10% | llegadas, últimas tallas, lista de espera |
| Fundador/comunidad | 5% | por qué existe HERENCIA90, pedidos reales, clientes |

Hooks iniciales:

- “La camiseta que convirtió una derrota en historia.”
- “¿Por qué Japón 98 volvió a estar en todas partes?”
- “3 detalles que separan una camiseta buena de una mala.”
- “Así queda la talla M frente a la L.”
- “Del proveedor a Medellín: este fue el pedido real.”
- “¿Original de COP 379.950 o versión fan? Estas son las diferencias reales.”
- “La camiseta retro que usarías aunque no vieras fútbol.”

CTA principal: **“Disponible en herencia90.shop”**. WhatsApp queda para dudas, talla y soporte.

### Producción semanal

- Lunes: grabar 12–15 clips de 3 camisetas.
- Martes a domingo: editar, publicar y responder comentarios.
- Cada semana: 1 cliente, 1 comparación de talla, 1 historia larga, 1 llegada, 1 outfit.
- Pedir reseña/foto 7 días después de entregar. Incentivo solo si es transparente y no condicionado a una opinión positiva.

## Pauta: TikTok, Meta, Google y SEO

### Respuesta directa

- **SEO no se paga a Google.** Se invierte en contenido, técnica y autoridad.
- **Google Ads sí se paga**, pero no debe activarse todavía.
- **Meta/TikTok Ads tampoco deben escalarse** hasta medir compra y resolver la procedencia/autorización del producto.

Google prohíbe anuncios y Shopping para productos que imitan marcas y logos sin autorización, incluso si se describen como réplica. Una suspensión puede ocurrir sin aviso. Antes de Google Ads o Merchant Center, revisar facturas, proveedor, licencias y la descripción legal del producto con un profesional.

### Secuencia de inversión

1. COP 0–300.000: medición, fotos, políticas y contenido orgánico.
2. Cuando existan al menos 20 intenciones de compra medibles y un checkout funcional: Meta retargeting pequeño.
3. Presupuesto de prueba: COP 20.000–30.000/día durante 10–14 días, máximo 3 creativos y 2 audiencias.
4. Objetivo inicial de CAC: COP 20.000–25.000; detener o corregir si supera COP 30.000 sin recompra.
5. Prospecting amplio solo después de 20–30 compras atribuidas.
6. Google Search únicamente si los productos y la cuenta cumplen políticas; usar búsquedas de alta intención y landing específica.

No pautar publicaciones genéricas. Pautar videos que ya obtuvieron retención, guardados, visitas de perfil y clics orgánicos.

## Pasarela de pagos

### Sí vale la pena

El pago web es el paso más importante para que el cliente compre solo. Debe empezar **solo con stock inmediato**.

Wompi publica una tarifa de 2,65% + COP 700 + IVA por transacción exitosa en su plan avanzado. Con el ticket observado, el costo ilustrativo es aproximadamente COP 4.304, o 3,91% del pedido. La economía actual puede absorberlo si disminuye fricción y se controla fraude/devolución.

Fases:

1. Link/WebCheckout para validar demanda.
2. Checkout propio que crea pedido pendiente.
3. Webhook firmado confirma pago y descuenta/reserva stock de forma atómica.
4. Confirmación por email/WhatsApp con número de pedido.
5. Contra entrega continúa como alternativa, con confirmación para reducir rechazos.
6. Bajo pedido cobra anticipo del 20% mediante enlace o checkout separado y no promete stock inmediato.

Mercado Pago Checkout Pro también es una alternativa razonable; redirige al entorno de Mercado Pago y reduce complejidad PCI. Comparar aprobación, PSE/Nequi, tiempos de desembolso, soporte y contracargos con una cuenta real antes de elegir.

## ¿Shopify o seguir con la página propia?

### Recomendación: seguir con la página propia por ahora

No recomiendo migrar en este momento. Shopify Basic cuesta US$ 19/mes con pago anual o US$ 25 mensual y cobra 2% adicional cuando se usa un proveedor externo. Colombia no aparece en la lista pública de Shopify Payments, por lo que debe asumirse un proveedor externo hasta confirmación.

Con ticket promedio de COP 110.079:

- Wompi ilustrativo con IVA: ~COP 4.304 por pedido.
- Cargo externo Shopify Basic: ~COP 2.202 adicionales por pedido.
- Variable combinada: ~COP 6.506, 5,91%, más la suscripción.

Shopify sí aportaría checkout probado, recuperación de carrito, apps, pedidos e inventario integrados. Pero migrar hoy no arregla por sí solo contenido, procedencia, políticas, fotos ni medición.

### Disparadores para reconsiderar Shopify

Migrar cuando ocurra al menos uno:

- 100+ pedidos web pagados/mes durante 3 meses;
- mantenimiento y corrección consumen más de 10 horas/mes;
- se necesita omnicanal/POS, automatización de marketing o recuperación de carrito más rápido de lo que se puede construir;
- errores de inventario/pedidos cuestan más que plataforma + comisión;
- se incorpora un equipo no técnico que necesita operar todo sin tocar código.

Mientras tanto: endurecer la arquitectura actual y agregar checkout incremental.

## Admin y automatizaciones

### Fortalezas

- Finanzas separa utilidad realizada, inventario y caja.
- Inventario maneja tallas, costos, fotos y reservas.
- CRM agrupa pagos parciales, pedidos, lotes y entregas.
- Flujo de lote exige revisar fotos antes de crear nuevas referencias.
- RLS anónima bloquea lectura de transacciones y pedidos; la lectura pública de productos funciona.
- 35 pruebas relevantes pasaron durante la auditoría.

### Riesgos

1. `web/admin.html` tiene 5.178 líneas y ~290 KB, con estilos, vistas y lógica crítica juntas.
2. `renderInventory`, `uD` y `uS` están declaradas dos veces; la segunda definición sobrescribe la primera.
3. Guardar inventario hace `upsert` de las 58 referencias, aunque se cambie una.
4. Comprar lote actualiza productos, pedidos y finanzas en llamadas separadas; un error intermedio puede dejar estado parcial.
5. Los IDs de transacciones se calculan leyendo el máximo y sumando uno; dos sesiones podrían colisionar.
6. Reservas se guardan dentro de `tallas` con claves `R_*`, lo que produce cálculos contradictorios.
7. La vista permite editar y borrar en tablas densas; faltan modo lectura, borrador y resumen antes de guardar.
8. Las tarjetas muestran cero durante la carga inicial y luego cambian, sin skeleton ni estado de carga claro.
9. Faltan pruebas para autenticación de endpoints, schema de imágenes, stock reservado y analítica activada.

### Arquitectura objetivo

- Dashboard de solo lectura.
- Módulos separados: inventario, compras, pedidos, finanzas, contenido y configuración.
- Tabla `reservas`/`order_items`, no claves `R_*` dentro de tallas.
- Operación transaccional/RPC para lote, pedido, pago e inventario.
- IDs generados por base de datos.
- Versionado u optimistic locking para inventario.
- Registro de auditoría: quién cambió qué y cuándo.
- Roles: propietario, operaciones, contenido y solo lectura.
- Borradores y publicación explícita para catálogo bajo pedido.
- Backups/exportación mensual verificados.

## Confianza, legal y operación en Colombia

Antes de pago autónomo, publicar y confirmar:

- identidad del vendedor y datos de contacto/notification aplicables;
- términos de venta;
- precio total y envío antes de pagar;
- disponibilidad, tiempos y seguimiento;
- política de cambios, garantía y retracto;
- procedimiento de reversión de pago;
- política de tratamiento de datos y autorización;
- condiciones de anticipo bajo pedido;
- procedencia, fabricante y relación —o ausencia de relación— con marcas/equipos;
- facturación según responsabilidades DIAN. Needs confirmation con contador.

La SIC indica que las ventas a distancia pueden tener derecho de retracto por 5 días hábiles y que los pagos electrónicos pueden ser objeto de reversión en situaciones como fraude, no entrega, producto distinto o defectuoso. La política actual de “cambios en 7 días” no reemplaza estas obligaciones y debe revisarse profesionalmente.

## Hoja de ruta

### Días 0–7: proteger y medir

- [ ] Autenticar y limitar los tres endpoints administrativos señalados.
- [ ] Confirmar procedencia/autorización y retirar afirmaciones no demostrables.
- [ ] Publicar políticas y datos de vendedor.
- [ ] Corregir cálculo disponible/reservado.
- [ ] Corregir schema, tallas reservadas, navegación y wording.
- [ ] Definir el embudo y activar eventos con consentimiento.
- [ ] Conectar Search Console y revisar cobertura real.

### Días 8–30: vender sin conversación obligatoria

- [ ] Checkout de stock con Wompi/Mercado Pago y webhook.
- [ ] Confirmación de pedido y reserva atómica.
- [ ] Fotos y videos propios de 10–12 referencias.
- [ ] Filtros de catálogo y ficha de producto unificada.
- [ ] Modal accesible y CTA de talla claro.
- [ ] 60 piezas cortas reutilizadas en 30 días.
- [ ] Prueba de pre orden de 8–10 referencias; comprar solo 3 ganadoras.

### Días 31–90: adquirir y retener

- [ ] Reescribir 10 fichas y 4 colecciones prioritarias.
- [ ] Consolidar páginas de ciudad y fichas débiles.
- [ ] Programa de reseñas/UGC.
- [ ] Retargeting pequeño si el embudo funciona y los productos cumplen políticas.
- [ ] Email/WhatsApp postcompra y segunda compra.
- [ ] Admin modular, transacciones y audit log.

### Meses 4–12: convertirlo en marca nacional

- [ ] 8–12 SKUs A con profundidad y reposición por sell-through.
- [ ] Drops retro narrados, no catálogo infinito.
- [ ] Afiliados y microcreadores de fútbol/moda.
- [ ] Activaciones en Medellín, coleccionismo y fútbol amateur.
- [ ] Decidir Shopify con los disparadores definidos, no por moda.
- [ ] Revisar expansión a accesorios, chaquetas y mujer solo con demanda medida.

## Decisiones finales

| Pregunta | Respuesta |
|---|---|
| ¿La página está bien montada? | La base sí; no está lista para compra autónoma ni escala de pauta. |
| ¿Tiene buen diseño? | Sí. Mantener identidad y mejorar coherencia, confianza y producto sobre el fold. |
| ¿Pasarela de pagos? | Sí, primero para stock y con webhook. |
| ¿Shopify? | No todavía. Reconsiderar con volumen/costo operativo medido. |
| ¿Fotos propias o proveedor? | Híbrido: propias para stock, ganadoras y anuncios; proveedor para explorar bajo pedido. |
| ¿Invertir en pauta ahora? | No escalar. Primero seguridad, políticas, medición, checkout y procedencia. |
| ¿Google Ads? | Solo después de confirmar cumplimiento de políticas de marcas/producto. |
| ¿TikTok o Instagram? | Ambos. Un sistema de producción, dos distribuciones; web como CTA. |
| ¿Qué inventario traer? | Probar 8–10, comprar 3 ganadoras x 6 unidades; evitar amplitud sin datos. |
| ¿Qué tallas? | Piloto S1/M2/L2/XL1 por ganadora hasta tener ventas por talla. |
| ¿Puede crecer mucho? | Sí; 75–150 pedidos/mes es un objetivo operativo plausible, no inmediato, después de resolver P0/P1. |

## Fuentes externas principales

- [Shopify Colombia — precios](https://www.shopify.com/co/precios)
- [Shopify — proveedores de pago externos](https://help.shopify.com/en/manual/payments/third-party-providers)
- [Shopify Payments — países admitidos](https://help.shopify.com/es/manual/payments/shopify-payments/supported-countries)
- [Wompi — Plan Avanzado Agregador](https://wompi.co/es/co/planes-tarifas/plan-avanzado-agregador)
- [Mercado Pago — Checkout Pro](https://www.mercadopago.com.co/developers/es/reference/online-payments/checkout-pro/overview)
- [Google Ads — productos falsificados](https://support.google.com/adspolicy/answer/176017?hl=en)
- [Google Merchant Center — productos falsificados](https://support.google.com/merchants/answer/6149993?hl=en)
- [SIC — retracto en compras a distancia](https://sedeelectronica.sic.gov.co/noticias/se-arrepintio-de-una-compra-y-no-sabe-que-hacer)
- [SIC — reversión del pago](https://sedeelectronica.sic.gov.co/atencion-y-servicios-a-la-ciudadania/glosario/reversion-del-pago)
- [SIC — políticas de tratamiento de datos](https://sedeelectronica.sic.gov.co/publicaciones/boletin-juridico/concepto/politicas-de-tratamiento-de-datos-personales)
- [DIAN — quién debe facturar electrónicamente](https://www.dian.gov.co/impuestos/factura-electronica/como-hacerlo/Paginas/ser-facturador-electronico.aspx)
- [EL PAÍS — consumo del Mundial en Colombia](https://elpais.com/america-colombia/2026-06-15/el-comercio-en-colombia-crece-gracias-al-mundial.html)
- [El Colombiano — camisetas clásicas y nostalgia en Medellín](https://www.elcolombiano.com/generacion/las-camisetas-clasicas-de-futbol-una-mezcla-de-pasion-y-nostalgia-IH36461119)
- [adidas — Bringback Collection](https://news.adidas.com/sportsbrandcombinedcategory/adidas-celebrates-iconic-fifa-world-cup--moments-with-the-launch-of-the-bringback-collection/s/98218c3e-f35e-4920-abfc-b8e9879547a4)
- [r/medellin — demanda reciente de camisetas retro](https://www.reddit.com/r/medellin/comments/1uog6q1/camisas_retro_de_futbol/)

## Límites de la auditoría

- No se tuvo acceso a Search Console, datos internos de Meta/TikTok ni exportación de ventas por SKU/talla.
- Instagram y TikTok se auditaron con metadatos públicos; no se midieron retención ni alcance por publicación.
- La investigación de los últimos 30 días tuvo cobertura útil limitada: Reddit y Hacker News estaban activos; X, YouTube, TikTok e Instagram no estuvieron disponibles en el motor. La evidencia útil se completó con búsqueda web, medios, competidores y perfiles públicos.
- No se hicieron pruebas destructivas de RLS, endpoints, pagos, pedidos ni uploads.
- Los puntos legales y tributarios son señales de riesgo, no asesoría jurídica o contable.

