# Auditoria UX/UI Herencia 90 - 2026-05-22

## Alcance

Auditoria visual y funcional de todo el sitio local, no solo preventa.

Rutas revisadas:

- Home: `/index.html`
- Catalogo general: `/catalogo.html`
- Categoria: `/categorias/colombia.html`
- Producto: `/camisetas/camiseta-local-barcelona-25-26.html`
- Pre-venta: `/preventa.html`
- Detalle pre-venta: `/preventa/barcelona-2008-2009-local.html`
- Nosotros: `/nosotros.html`
- Preguntas frecuentes: `/preguntas-frecuentes.html`

Viewports:

- Desktop: 1440 x 1050
- Movil: 390 x 844

Evidencia generada:

- Carpeta de pantallazos: `C:\Users\PC\Desktop\HERENCIA90\.codex_tmp\full-site-ux-audit-2026-05-22`
- Archivo de metricas: `C:\Users\PC\Desktop\HERENCIA90\.codex_tmp\full-site-ux-audit-2026-05-22\metrics.json`
- Total capturas: 38 pantallazos base + estados moviles de busqueda, menu y carrito.

## Resumen Ejecutivo

Herencia 90 ya tiene una identidad visual fuerte: fondo oscuro, dorado, futbol retro, producto protagonista y sensacion premium. El problema principal no es falta de estilo, sino falta de una arquitectura de compra consistente.

La experiencia actual se siente como varias paginas buenas, pero no como un sistema unico. Home, catalogo, producto y preventa tienen distintos niveles de densidad, distintas reglas de tarjetas, distintos CTAs y distintos patrones de navegacion. Eso hace que el usuario entienda cada pantalla, pero no siempre sepa cual es el siguiente paso.

La mejora mas importante no es agregar mas texto. Es crear una experiencia de catalogo clara:

1. Buscar.
2. Filtrar.
3. Ordenar.
4. Ver resultados con contador.
5. Cambiar pagina o cargar mas.
6. Llegar al producto.
7. Comprar o pedir por WhatsApp sin perderse.

## Hallazgos Criticos

### P0 - Error JavaScript Global

En todas las rutas revisadas aparece:

`TypeError: Cannot set properties of null (setting 'onclick') at web/js/app.js:326`

Esto viene de asignar `onclick` a `#closeModal` sin validar si existe. Aunque la pagina se vea bien, este error puede cortar ejecucion posterior y afectar interacciones.

Recomendacion: agregar guards a todos los bindings globales de `app.js`, especialmente modal, carrito, drawer y search overlay.

### P0 - Producto Movil Es Bonito Pero Convierte Tarde

En producto movil, la galeria ocupa casi todo el primer scroll. El precio, tallas y boton de compra quedan muy abajo.

Problema: el usuario ve la camiseta, pero no tiene accion inmediata.

Recomendacion:

- Barra sticky inferior en producto movil: precio + talla seleccionada + `Comprar por WhatsApp`.
- CTA principal visible antes de terminar la galeria.
- Galeria movil mas compacta: imagen principal + carrusel horizontal de miniaturas, no una grilla tan larga.

### P0 - Catalogo y Preventa Necesitan Control De Resultados

El catalogo general y preventa no tienen una barra tipo:

`Mostrando 1-24 de 178` + `Ordenar por` + `Pagina 1 2 3`

Esto es justo lo bueno de la referencia que compartiste. Da control, contexto y sensacion profesional.

Recomendacion:

- Agregar `Ordenar por` con opciones reales.
- Agregar contador de resultados.
- Agregar paginacion para catalogos largos.
- Guardar estado en URL: `?q=river&orden=populares&page=2`.

## Hallazgos Por Superficie

### Home

Fortalezas:

- Primer impacto fuerte.
- Buena marca.
- CTA principal claro en movil.
- Las categorias aparecen temprano.

Problemas:

- El promo marquee genera ruido y aparece como overflow tecnico.
- Hay varias promesas arriba compitiendo: promo, envio, pago contra entrega, WhatsApp, categorias.
- En desktop el header es visualmente alto y ocupa mucho espacio antes del producto.

Mejora:

- Reducir el marquee a una sola promesa fuerte o hacerlo menos protagonista.
- Mantener hero, pero conectar mejor con catalogo: `Ver camisetas`, `Pre-venta`, `No la encuentras?`.
- Separar Home como puerta de entrada, no como catalogo completo.

### Catalogo General

Fortalezas:

- Las tarjetas se ven potentes.
- El producto manda.
- La grilla es entendible.

Problemas:

- No hay ordenar por.
- No hay contador de resultados.
- No hay paginacion.
- No hay una herramienta clara para explorar cuando crezca el inventario.
- En scroll medio el header sticky compite con tarjetas.
- Las descripciones dentro de tarjetas agregan densidad y no siempre ayudan a decidir.

Mejora:

- Crear barra de catalogo.
- Quitar descripcion larga de la tarjeta o dejarla solo en detalle.
- Mantener tarjeta con: foto, nombre, precio, tallas, CTA.
- Usar `Recomendadas` como default, no `Mas vendidos` hasta tener datos reales.

### Categorias

Fortalezas:

- Funcionan como landing SEO.
- El usuario entiende el equipo/coleccion.

Problemas:

- Categoria Colombia no muestra H1 visible en la captura; empieza directo en `Mundial 2026`.
- Con pocos productos queda demasiado espacio vacio.
- No hay recomendaciones cruzadas ni salida clara si la categoria tiene poco contenido.

Mejora:

- Header compacto por categoria: `Camisetas Colombia`, cantidad y CTA.
- Si hay pocos productos, agregar bloque `Tambien puedes mirar` con selecciones, retro o preventa.
- Misma barra de catalogo que catalogo general, aunque sea simplificada.

### Producto

Fortalezas:

- Desktop es de las mejores superficies del sitio.
- Imagen grande, precio y confianza estan bien resueltos.
- CTA verde WhatsApp contrasta y funciona.

Problemas:

- Movil entierra compra despues de galeria.
- El bloque de informacion es pesado si el usuario ya quiere comprar.
- El enlace `Pre-venta` arriba puede competir con compra.

Mejora:

- Sticky CTA movil.
- Imagen principal mas compacta en movil.
- Tallas y precio visibles antes del segundo scroll.
- `Seguir viendo camisetas` como accion secundaria mas discreta.

### Pre-Venta

Fortalezas:

- Visualmente mejoro mucho tras quitar badges repetidos.
- Primeras tarjetas ahora impactan mas.
- Buscador y filtros estan arriba.
- Bloque `No aparece?` esta bien ubicado.

Problemas:

- Faltan ordenar por, contador y paginacion.
- Muchas secciones hacen que movil tenga 8833px de alto.
- Filtros horizontales se cortan en movil sin pista visual.
- La pagina mezcla exploracion editorial con catalogo operativo.

Mejora recomendada:

- Arriba: `Populares` corto con 8 o 12 referencias.
- Luego: `Catalogo de pre-venta` con toolbar, ordenar y paginacion.
- Filtros como chips compactos.
- `No aparece?` como modulo sticky/compacto entre buscador y catalogo.

### Detalle Pre-Venta

Fortalezas:

- Desktop se siente premium.
- Galeria de proveedor da confianza.
- WhatsApp directo es claro.

Problemas:

- En movil la galeria puede retrasar la accion.
- Algunos titulos generados se pueden volver largos o repetitivos en referencias complejas.

Mejora:

- Mismo sticky CTA movil que producto.
- Galeria movil en carrusel compacto.
- Limpiar generacion de titulos para evitar duplicaciones como `Manga Larga Manga Larga`.

### Nosotros Y Preguntas Frecuentes

Fortalezas:

- Buen tono de confianza.
- Secciones utiles para reducir objeciones.
- Botones sociales claros.

Problemas:

- Algunas secciones son muy card-heavy.
- FAQ tiene H1 largo y podria ser mas escaneable.
- Los testimonios parecen utiles, pero deben sentirse reales y no demasiado genericos.

Mejora:

- FAQ tipo acordeon.
- Nosotros con menos cajas y mas prueba visual: entregas, mensajes, clientes reales si existen.
- Reforzar confianza con evidencia concreta y poca palabra.

## Decision Sobre Ordenar Y Paginacion

Si se copia la referencia literalmente, se vera mas profesional que ahora, pero todavia algo antiguo. La mejor version para Herencia 90 es una barra propia, minimalista y oscura.

### Ordenes recomendados

- `Recomendadas`: curacion de Herencia 90.
- `Populares`: ranking visual/comercial.
- `Mas recientes`: ultimos agregados.
- `Precio: menor a mayor`.
- `Precio: mayor a menor`.
- `Mas fotos`: mas confianza visual.
- `A-Z`: busqueda por equipo.

No recomiendo `Mas vendidos` todavia, a menos que exista data real. Si no hay data, se siente falso. Mejor usar `Populares` o `Mas pedidos` cuando se conecte con pedidos reales.

### Paginacion recomendada

- Desktop: 24 productos por pagina.
- Movil: 20 productos por pagina.
- Paginador superior compacto y repetido abajo.
- Scroll automatico al inicio del catalogo al cambiar pagina.
- Estado en URL para compartir y volver atras.

Formato ideal:

`178 referencias` | `Ordenar: Recomendadas` | `1 2 3 ... 8`

## Plan Maestro De Implementacion

### Fase 0 - Estabilidad

1. Corregir error global de `app.js`.
2. Validar todos los bindings opcionales con null guards.
3. Revisar que search, drawer, carrito, modal y WhatsApp no dependan de elementos inexistentes.
4. Crear checklist de QA por pagina.

### Fase 1 - Sistema De Catalogo

1. Crear componente visual de toolbar de catalogo.
2. Agregar contador de resultados.
3. Agregar `Ordenar por`.
4. Agregar paginacion.
5. Guardar estado en URL.
6. Reutilizarlo en catalogo general y preventa.

### Fase 2 - Conversion Movil

1. Sticky CTA en producto.
2. Sticky CTA en detalle preventa.
3. Galeria movil compacta.
4. Reducir choque entre WhatsApp flotante y bottom nav.
5. Revisar que el usuario pueda comprar desde el primer o segundo viewport.

### Fase 3 - Reorganizacion Visual

1. Catalogo: menos descripcion en tarjetas.
2. Preventa: `Populares` corto + catalogo paginado.
3. Categorias: H1 claro + related categories.
4. FAQ: acordeon.
5. Nosotros: menos texto, mas prueba visual.

### Fase 4 - Pulido Premium

1. Unificar radios, bordes, sombras y transitions.
2. Eliminar `transition: all`.
3. Hover solo en desktop.
4. Botones con `:active`.
5. Revisar cada viewport con pantallazos antes/despues.

## Checklist De Validacion

Desktop:

- Home top/mid/bottom.
- Catalogo con orden por cada opcion.
- Catalogo pagina 1, 2 y ultima.
- Producto con talla y WhatsApp.
- Preventa busqueda `river`.
- Preventa filtro `selecciones`.
- Preventa pagina 2.
- Detalle preventa WhatsApp.
- Nosotros y FAQ.

Movil:

- Bottom nav no tapa CTAs.
- WhatsApp flotante no compite con carrito.
- Menu drawer abre/cierra.
- Search overlay busca y muestra resultados.
- Producto permite comprar sin scroll excesivo.
- Preventa permite ordenar/paginar con una mano.

## Prioridad Recomendada

Primero haria:

1. Fix JS global.
2. Toolbar + ordenar + paginacion en preventa.
3. Toolbar + ordenar + paginacion en catalogo.
4. Sticky CTA movil en producto y detalle preventa.
5. Reorganizar preventa en `Populares` + `Catalogo completo`.

Esto ataca conversion, confianza y percepcion profesional sin redisenar todo desde cero.
