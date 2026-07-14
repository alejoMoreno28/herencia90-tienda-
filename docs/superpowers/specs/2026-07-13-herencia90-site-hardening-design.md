# HERENCIA90 Site Hardening and Conversion Design

**Fecha:** 2026-07-13
**Estado:** aprobado por Camilo para implementación local
**Publicación:** fuera de alcance hasta recibir autorización posterior

## Objetivo

Dejar HERENCIA90 lista localmente para operar con una base más segura, medible, encontrable y fácil de comprar, sin migrar la arquitectura estática ni modificar datos remotos de Supabase. El resultado debe conservar el comportamiento que ya funciona, demostrar cada cambio con pruebas y separar claramente lo que necesita credenciales, información legal o aprobación de publicación.

## Principios de ejecución

1. Seguridad y medición antes de pauta o pagos.
2. Cambios pequeños, reversibles y cubiertos por pruebas.
3. Una sola fuente de verdad para stock disponible; las reservas no se venden ni aparecen en schema.
4. El sitio web es el CTA principal; WhatsApp es soporte y cierre alternativo.
5. No se inventan datos legales, autorizaciones de marca, testimonios ni métricas.
6. No se suben imágenes, no se hace upsert y no se reemplazan recursos de Supabase.
7. No se hace deploy, commit de medios ni push durante esta entrega.

## Alcance local

### 1. Seguridad de APIs administrativas

- Crear utilidades compartidas para extraer y validar la sesión Supabase del administrador.
- Proteger los endpoints que consumen Gemini, descargan imágenes o escriben en Storage.
- Eliminar cualquier credencial administrativa predeterminada en código.
- Validar URLs externas con HTTPS, lista explícita de proveedores, rechazo de credenciales en URL, puertos no estándar, localhost e IPs privadas o de metadata.
- Restringir CORS al dominio de HERENCIA90 y al entorno local de desarrollo.
- Limitar cuerpo, cantidad de imágenes y tamaño descargado.
- Devolver errores públicos estables sin filtrar detalles internos.

### 2. Medición con privacidad

- Sustituir el interruptor global desactivado por consentimiento explícito persistido localmente.
- Medir únicamente eventos comerciales anónimos: página, producto, talla, carrito, inicio de checkout y WhatsApp.
- No almacenar nombre, teléfono, dirección, texto libre ni identificadores publicitarios.
- Añadir controles accesibles para aceptar o rechazar analítica.
- Mantener la compra y navegación funcionando si Supabase o la analítica fallan.

### 3. Stock y SEO técnico

- Corregir el generador para conservar URLs absolutas y convertir solo rutas locales.
- Excluir claves `R_*` de tallas visibles, disponibilidad, totales de stock y Product schema.
- Generar descripciones de schema no vacías usando una alternativa segura cuando falte descripción.
- Corregir enlaces de regreso al catálogo y mantener sitemap, canonical y páginas generadas sincronizados.
- Añadir pruebas sobre URLs absolutas, reservas, schema y páginas huérfanas.

### 4. Confianza y políticas

- Crear páginas públicas para privacidad, envíos, cambios y devoluciones, y términos.
- Usar únicamente reglas confirmadas por el sitio y normativa general; datos comerciales no disponibles se marcarán `Needs confirmation` en documentación interna, no como afirmaciones públicas.
- Enlazar las políticas desde footer, carrito y checkout.
- Evitar afirmar que una prenda es “oficial” si el catálogo local no aporta evidencia.

### 5. Conversión y accesibilidad

- Mantener la estética negro/dorado con dirección “archivo futbolero premium”.
- Convertir el modal de producto en un diálogo accesible: foco inicial, trampa de foco, Escape, retorno de foco y etiquetas semánticas.
- Mejorar jerarquía de talla, disponibilidad, entrega, cambios y acción principal.
- Unificar el comportamiento del catálogo y las páginas de producto.
- Añadir una ruta de checkout local que recopile datos mínimos, valide el pedido y continúe con el canal configurado.
- Mantener WhatsApp como alternativa visible, no como única explicación del proceso.

### 6. Admin y automatizaciones

- Centralizar el cálculo de stock disponible y reservado.
- Eliminar declaraciones duplicadas que sobrescriben lógica.
- Guardar solo referencias modificadas cuando sea posible, con resumen previo y control de error.
- Añadir estados de carga y evitar cifras engañosas antes de que terminen las consultas.
- Preparar, sin ejecutar, una migración SQL para IDs de base de datos, reservas separadas y operación transaccional de lotes.

### 7. Pagos y preparación operativa

- Definir un adaptador de checkout para que el storefront no dependa de un proveedor concreto.
- Dejar el modo local sin cobro real y documentar variables de entorno, webhook, idempotencia y estados de orden.
- No activar Wompi o Mercado Pago sin credenciales de sandbox y una compra de prueba autorizada.

### 8. Marketing e inventario

- Entregar calendario de 30 días para TikTok e Instagram, guiones y CTA al sitio.
- Entregar matriz de lote piloto, tallas, reposición y registro de rotación.
- Entregar guía de fotografías propias para productos ganadores y anuncios.
- Mantener estos artefactos en Markdown/CSV; no publicar en redes ni comprar inventario.

## Arquitectura

La aplicación seguirá siendo HTML/CSS/JavaScript estático con funciones serverless y Supabase. Las utilidades de seguridad vivirán bajo `api/_lib/`; las funciones puras reutilizables del storefront vivirán bajo `web/js/`; el generador seguirá siendo la fuente durable de páginas SEO. Los cambios generados se producirán desde el script corregido, no mediante edición manual repetida.

El checkout tendrá un contrato pequeño: recibe líneas de carrito validadas, calcula el total desde el catálogo confiable y devuelve el siguiente paso. Sin credenciales externas permanecerá en modo local/WhatsApp y nunca simulará un pago exitoso.

## Datos y errores

- Todo total comercial se recalcula desde productos confiables; no se acepta precio enviado por el navegador como autoridad.
- Los endpoints fallan cerrados: sin sesión, configuración o proveedor permitido no ejecutan trabajo costoso ni escritura.
- Los errores mostrados al cliente son claros y no contienen claves, respuestas completas de proveedores o stack traces.
- La analítica es best-effort y no bloquea interacción.

## Diseño visual

**Dirección:** archivo futbolero premium.

**Ancla diferenciadora:** fichas y microcopys con lenguaje de archivo/temporada, sostenidos por negro carbón, dorado HERENCIA90 y fotografía de producto.

**DFII:** 13/15 (impacto 4 + ajuste 5 + factibilidad 5 + rendimiento 4 - riesgo de consistencia 5).

**Movimiento:** escaso, funcional y respetuoso de `prefers-reduced-motion`.
**Tipografía:** conservar la familia de marca existente para evitar descargas y deriva visual; mejorar escala, ritmo y contraste antes de introducir otra fuente.

## Pruebas y criterios de aceptación

- Cada cambio de comportamiento inicia con una prueba que falla por la razón esperada.
- Todos los tests existentes continúan pasando.
- Los endpoints protegidos responden 401 sin sesión y no invocan servicios externos.
- URLs privadas, localhost, HTTP y dominios no permitidos son rechazados.
- Ninguna clave `R_*` aparece como talla o stock vendible.
- Product schema contiene imágenes válidas y descripción no vacía.
- Modal y consentimiento son utilizables con teclado.
- No hay errores de consola en home, catálogo, producto, pre orden, políticas y checkout.
- Las pruebas móviles verifican 390 px y escritorio 1440 px.
- Git no incluye videos, caches, imágenes generadas o cambios ajenos.

## Fuera de alcance hasta nueva autorización

- Deploy, push o publicación en redes.
- Cobros reales y webhooks de producción.
- Migraciones o escrituras en Supabase.
- Compra de inventario.
- Sustitución masiva de fotografías.
- Afirmaciones legales, tributarias o de autenticidad no confirmadas.
