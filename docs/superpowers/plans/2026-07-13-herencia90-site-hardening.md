# HERENCIA90 Site Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar localmente una tienda HERENCIA90 más segura, medible, encontrable y fácil de comprar, sin publicar ni escribir en servicios remotos.

**Architecture:** Se conserva HTML/CSS/JavaScript estático, funciones serverless y Supabase. La seguridad se extrae a utilidades CommonJS compatibles con endpoints existentes; las reglas puras de stock/SEO y checkout se separan para poder probarlas sin red; el generador sigue siendo la fuente durable de páginas.

**Tech Stack:** Node.js 24, `node:test`, HTML/CSS/JavaScript, Vercel Functions, Supabase JS, Puppeteer.

---

## Mapa de archivos

- `api/_lib/admin-security.cjs`: autenticación administrativa, CORS y validación de URLs.
- `api/search-provider-images.js`: endpoint protegido de búsqueda y subida de imágenes.
- `api/optimize-product.js`: endpoint protegido de Gemini.
- `api/preventa-yupoo-import.js`: importador sin credencial de respaldo.
- `api/admin-upload-image.js`: reutiliza autenticación compartida.
- `scripts/admin-api-security.test.mjs`: pruebas unitarias y contractuales de seguridad.
- `scripts/lib/catalog-seo.mjs`: reglas puras de URL, talla, stock y schema.
- `scripts/catalog-seo.test.mjs`: regresiones SEO/stock.
- `scripts/generate-product-pages.mjs`: consume las reglas durables y regenera páginas.
- `web/js/analytics-consent.js`: consentimiento y contrato de eventos anónimos.
- `scripts/storefront-analytics.test.mjs`: consentimiento, campos permitidos y eventos.
- `web/catalogo.html`, `web/js/app.js`, `web/css/style.css`: diálogo accesible, confianza y conversión.
- `tests/storefront-usability.test.mjs`: regresiones semánticas y de teclado.
- `web/checkout.html`, `web/js/checkout-core.js`, `web/js/checkout.js`: revisión del pedido y canal de finalización configurado.
- `scripts/checkout-core.test.mjs`: precios confiables, validación y resumen.
- `web/privacidad.html`, `web/envios.html`, `web/cambios-devoluciones.html`, `web/terminos.html`: políticas públicas.
- `web/js/inventory-stock.js`, `web/admin.html`: cálculos consistentes y guardado más seguro.
- `scripts/admin-inventory-consistency.test.mjs`: disponible/reservado y duplicación de funciones.
- `docs/migrations/checkout-and-inventory-hardening.sql`: migración preparada, no ejecutada.
- `docs/marketing/calendario-contenido-30-dias.md`: ejecución social.
- `docs/operaciones/guia-fotografia-producto.md`: estándar de fotografía.
- `docs/operaciones/plan-lote-piloto.csv`: matriz inicial de compra y reposición.

## Task 1: Seguridad compartida y endpoints administrativos

**Files:**
- Create: `api/_lib/admin-security.cjs`
- Create: `scripts/admin-api-security.test.mjs`
- Modify: `api/search-provider-images.js`
- Modify: `api/optimize-product.js`
- Modify: `api/preventa-yupoo-import.js`
- Modify: `api/admin-upload-image.js`

- [ ] **Step 1: escribir pruebas rojas para sesión y URL**

```js
test('rejects a missing bearer session before external work', async () => {
  const result = await authorizeAdminRequest({ headers: {} }, fakeEnvironment);
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('rejects private and unapproved provider urls', async () => {
  await assert.rejects(() => validateProviderUrl('http://127.0.0.1/admin'));
  await assert.rejects(() => validateProviderUrl('https://example.com/product'));
});
```

- [ ] **Step 2: ejecutar RED**

Run: `node --test scripts/admin-api-security.test.mjs`
Expected: FAIL porque `api/_lib/admin-security.cjs` no existe.

- [ ] **Step 3: implementar utilidades mínimas**

```js
async function authorizeAdminRequest(req, env, createClient) {
  const token = getBearerToken(req);
  if (!token) return { ok: false, status: 401, error: 'Sesion de admin requerida.' };
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, error: 'Sesion invalida o expirada.' };
  return { ok: true, user: data.user, supabase };
}
```

`validateProviderUrl()` aceptará solo HTTPS, hostname incluido en la lista aprobada, puerto vacío/443, sin usuario/contraseña y resolverá DNS para rechazar loopback, rangos privados, link-local y metadata.

- [ ] **Step 4: proteger handlers antes de leer cuerpo o invocar red**

Cada handler ejecutará `authorizeAdminRequest()` y devolverá su status si `ok` es falso. El importador requerirá `ADMIN_TOKEN` explícito o sesión Supabase, sin valor alternativo. Los errores internos se registran en servidor y al cliente se devuelve un mensaje estable.

- [ ] **Step 5: ejecutar GREEN y regresiones**

Run: `node --test scripts/admin-api-security.test.mjs scripts/search-provider-images.test.mjs`
Expected: PASS, sin solicitudes externas reales.

- [ ] **Step 6: commit local exacto**

Run: `git add -- api/_lib/admin-security.cjs api/search-provider-images.js api/optimize-product.js api/preventa-yupoo-import.js api/admin-upload-image.js scripts/admin-api-security.test.mjs scripts/search-provider-images.test.mjs`
Run: `git commit -m "fix: protect administrative APIs"`

## Task 2: Stock vendible y Product schema

**Files:**
- Create: `scripts/lib/catalog-seo.mjs`
- Create: `scripts/catalog-seo.test.mjs`
- Modify: `scripts/generate-product-pages.mjs`
- Regenerate: `web/camisetas/*.html`, `web/categorias/*.html`, `web/ciudades/*.html`, `web/sitemap.xml`

- [ ] **Step 1: escribir pruebas rojas de URL y reservas**

```js
test('keeps absolute asset urls unchanged', () => {
  assert.equal(absoluteAssetUrl('https://cdn.example/a.webp', SITE), 'https://cdn.example/a.webp');
});

test('excludes reserved keys from sellable stock', () => {
  const tallas = { S: 1, M: 2, R_M: 4 };
  assert.deepEqual(getSellableSizes(tallas), ['S', 'M']);
  assert.equal(getSellableStock(tallas), 3);
});
```

- [ ] **Step 2: ejecutar RED**

Run: `node --test scripts/catalog-seo.test.mjs`
Expected: FAIL por módulo ausente.

- [ ] **Step 3: implementar reglas puras e importarlas en el generador**

```js
export function absoluteAssetUrl(path, siteUrl) {
  const value = String(path || '').trim();
  if (/^https:\/\//i.test(value)) return value;
  return new URL(value.replace(/^\/+/, ''), `${siteUrl}/`).href;
}

export function getSellableSizes(tallas = {}) {
  return Object.entries(tallas)
    .filter(([size, qty]) => !size.startsWith('R_') && Number(qty) > 0)
    .map(([size]) => size);
}
```

- [ ] **Step 4: ejecutar GREEN y prueba SEO existente**

Run: `node --test scripts/catalog-seo.test.mjs tests/site-seo.test.mjs`
Expected: PASS.

- [ ] **Step 5: regenerar y comprobar que no aparezca `/https://` ni talla `R_`**

Run: `node scripts/generate-product-pages.mjs`
Run: `rg -n 'herencia90\.shop/https://|>R_[^<]*<' web/camisetas web/categorias web/ciudades`
Expected: salida vacía.

- [ ] **Step 6: commit local exacto**

Stage solo el generador, biblioteca, prueba, sitemap y HTML generado intencional mediante rutas exactas o listas revisadas; no usar `git add .` ni `git add -A`.

## Task 3: Consentimiento y embudo medible

**Files:**
- Create: `web/js/analytics-consent.js`
- Create: `scripts/storefront-analytics.test.mjs`
- Modify: `web/js/app.js`
- Modify: `web/js/preventa.js`
- Modify: `scripts/generate-product-pages.mjs`
- Modify: entry HTML pages that load the storefront scripts

- [ ] **Step 1: escribir pruebas rojas del contrato de privacidad**

```js
test('tracking is disabled until the visitor accepts', () => {
  const consent = createAnalyticsConsent(memoryStorage());
  assert.equal(consent.canTrack(), false);
});

test('event payload removes personal and unknown fields', () => {
  assert.deepEqual(sanitizeAnalyticsEvent({ event_type: 'add_to_cart', phone: 'x', product_id: 7 }), {
    event_type: 'add_to_cart', product_id: 7
  });
});
```

- [ ] **Step 2: ejecutar RED**

Run: `node --test scripts/storefront-analytics.test.mjs`
Expected: FAIL por script ausente.

- [ ] **Step 3: implementar consentimiento accesible y funciones puras**

El script expondrá `window.H90AnalyticsConsent`, persistirá `accepted` o `rejected`, inyectará un banner con botones reales y restaurará la decisión sin bloquear la navegación.

- [ ] **Step 4: reemplazar el interruptor desactivado**

`trackEvent()` retornará si `canTrack()` es falso y enviará únicamente el payload saneado. Los eventos serán `page_view`, `view_item`, `select_size`, `add_to_cart`, `begin_checkout` y `whatsapp_support`.

- [ ] **Step 5: ejecutar GREEN y pruebas del storefront**

Run: `node --test scripts/storefront-analytics.test.mjs tests/storefront-usability.test.mjs tests/site-seo.test.mjs`
Expected: PASS.

- [ ] **Step 6: commit local exacto**

Stage solo scripts, páginas y pruebas relacionadas con analítica.

## Task 4: Políticas públicas y enlaces de confianza

**Files:**
- Create: `web/privacidad.html`
- Create: `web/envios.html`
- Create: `web/cambios-devoluciones.html`
- Create: `web/terminos.html`
- Create: `tests/legal-pages.test.mjs`
- Modify: `web/index.html`
- Modify: `web/catalogo.html`
- Modify: `web/preventa/index.html`
- Modify: `scripts/generate-product-pages.mjs`
- Modify: `web/sitemap.xml`

- [ ] **Step 1: escribir pruebas rojas de disponibilidad y contenido mínimo**

Las pruebas exigirán title, description, canonical, H1 único, canal de contacto, fecha de actualización y enlaces recíprocos en footer. También rechazarán marcadores internos de implementación o confirmación en páginas públicas.

- [ ] **Step 2: ejecutar RED**

Run: `node --test tests/legal-pages.test.mjs`
Expected: FAIL porque las cuatro páginas no existen.

- [ ] **Step 3: crear páginas sobrias y verificables**

La privacidad explica finalidad, datos mínimos, derechos y canal de soporte; envíos explica cobertura nacional y que plazo/costo se muestran antes de confirmar; cambios explica el proceso sin prometer condiciones no confirmadas; términos separa stock y pre orden y prohíbe inferir autenticidad no demostrada.

- [ ] **Step 4: enlazar y añadir al sitemap**

Los footers de páginas principales y plantillas generadas incluirán las cuatro rutas. El carrito y checkout enlazarán cambios, envíos y privacidad.

- [ ] **Step 5: ejecutar GREEN**

Run: `node --test tests/legal-pages.test.mjs tests/site-seo.test.mjs`
Expected: PASS.

- [ ] **Step 6: commit local exacto**

Stage las cuatro páginas, las plantillas fuente, sitemap y pruebas.

## Task 5: Modal accesible, información de compra y checkout local

**Files:**
- Create: `web/checkout.html`
- Create: `web/js/checkout-core.js`
- Create: `web/js/checkout.js`
- Create: `scripts/checkout-core.test.mjs`
- Modify: `web/catalogo.html`
- Modify: `web/js/app.js`
- Modify: `web/css/style.css`
- Modify: `tests/storefront-usability.test.mjs`

- [ ] **Step 1: escribir pruebas rojas de diálogo y cálculo**

```js
test('checkout recalculates line totals from trusted catalog prices', () => {
  const result = buildCheckout([{ id: 7, talla: 'M', cantidad: 2, precio: 1 }], [{ id: 7, precio: 120000, tallas: { M: 3 } }]);
  assert.equal(result.total, 240000);
});
```

La prueba de HTML exigirá `role="dialog"`, `aria-modal="true"`, nombre accesible, botón de cierre, manejo de Escape, trampa de foco y retorno al elemento que abrió el modal.

- [ ] **Step 2: ejecutar RED**

Run: `node --test scripts/checkout-core.test.mjs tests/storefront-usability.test.mjs`
Expected: FAIL por archivos/semántica ausentes.

- [ ] **Step 3: implementar checkout puro y página de revisión**

`buildCheckout(cart, catalog)` rechaza referencias/tallas sin stock, limita cantidades, usa precios del catálogo y devuelve líneas, subtotal y total. La interfaz solicita solo nombre, ciudad, dirección y teléfono cuando el usuario decide continuar; sin proveedor de pago configurado genera el resumen para WhatsApp y nunca marca el pedido como pagado.

- [ ] **Step 4: implementar foco y jerarquía de compra**

Al abrir se guarda `document.activeElement`; se enfoca el título o primer control; Tab/Shift+Tab permanecen dentro; Escape cierra; al cerrar se restaura foco. La ficha muestra disponibilidad, talla, envío nacional, cambios y botones “Agregar al carrito” y “Pedir ayuda por WhatsApp”.

- [ ] **Step 5: ejecutar GREEN y prueba visual local**

Run: `node --test scripts/checkout-core.test.mjs tests/storefront-usability.test.mjs`
Run: prueba Puppeteer en 390x844 y 1440x900 para catálogo, modal, carrito y checkout.
Expected: PASS, sin overflow ni errores de consola.

- [ ] **Step 6: commit local exacto**

Stage checkout, catálogo, app, CSS y pruebas relacionadas.

## Task 6: Consistencia del admin

**Files:**
- Create: `web/js/inventory-stock.js`
- Create: `scripts/admin-inventory-consistency.test.mjs`
- Modify: `web/admin.html`
- Modify: `scripts/admin-inventory-guard.test.mjs`

- [ ] **Step 1: escribir pruebas rojas de stock y estructura**

```js
test('inventory summary separates sellable and reserved units', () => {
  assert.deepEqual(summarizeStock({ S: 2, M: 1, R_M: 3 }), { available: 3, reserved: 3, totalPhysical: 6 });
});
```

Una prueba textual exigirá una sola declaración activa de `renderInventory`, `uD` y `uS` y que el dashboard no sume reservas como disponible.

- [ ] **Step 2: ejecutar RED**

Run: `node --test scripts/admin-inventory-consistency.test.mjs scripts/admin-inventory-guard.test.mjs`
Expected: FAIL por módulo ausente y duplicados.

- [ ] **Step 3: implementar módulo UMD puro y reemplazar cálculos**

`window.H90InventoryStock` expondrá `summarizeStock`, `getAvailableUnits` y `getReservedUnits`; admin consumirá estas funciones para tarjetas, tabla y validación.

- [ ] **Step 4: eliminar sobrescrituras y hacer guardado explícito**

Conservar la versión funcional más completa de cada función duplicada. El guardado construirá una lista de IDs modificados, mostrará cantidad y pedirá confirmación; si no hay cambios, no ejecutará upsert.

- [ ] **Step 5: ejecutar GREEN y suite admin**

Run: `node --test scripts/admin-inventory-consistency.test.mjs scripts/admin-inventory-guard.test.mjs scripts/admin-finance-metrics.test.mjs scripts/admin-lote-workflow.test.mjs scripts/admin-pedido-payments.test.mjs`
Expected: PASS.

- [ ] **Step 6: commit local exacto**

Stage `web/admin.html`, el módulo y pruebas exactas.

## Task 7: Preparación de pagos y migración no ejecutada

**Files:**
- Create: `docs/migrations/checkout-and-inventory-hardening.sql`
- Create: `docs/PAGOS-SANDBOX-HERENCIA90.md`
- Create: `tests/payment-readiness.test.mjs`
- Modify: `web/checkout.html`

- [ ] **Step 1: escribir prueba roja de seguridad operativa**

La prueba exigirá que checkout no incluya claves privadas, que el modo predeterminado sea sin cobro, que no exista texto “pago exitoso” sin confirmación de webhook y que la documentación defina idempotencia, firma, estados y rollback.

- [ ] **Step 2: ejecutar RED**

Run: `node --test tests/payment-readiness.test.mjs`
Expected: FAIL porque documentación/migración no existen.

- [ ] **Step 3: escribir migración preparada**

La migración definirá tablas/columnas para órdenes, líneas, reservas, estado de pago, referencia única, timestamps y una función transaccional que valida stock. El archivo comienza con `BEGIN;` y termina con `ROLLBACK;` para impedir aplicación accidental; una copia operativa posterior requerirá aprobación.

- [ ] **Step 4: documentar sandbox**

El documento enumera variables de entorno por nombre, flujo de sesión, webhook firmado, estados `pending/approved/declined/voided`, idempotencia, prueba de monto mínimo y criterios para producción. No contiene valores reales.

- [ ] **Step 5: ejecutar GREEN**

Run: `node --test tests/payment-readiness.test.mjs`
Expected: PASS.

- [ ] **Step 6: commit local exacto**

Stage solo migración, documentación, checkout y prueba.

## Task 8: Kit operativo de contenido, fotos e inventario

**Files:**
- Create: `docs/marketing/calendario-contenido-30-dias.md`
- Create: `docs/operaciones/guia-fotografia-producto.md`
- Create: `docs/operaciones/plan-lote-piloto.csv`
- Create: `tests/operations-kit.test.mjs`

- [ ] **Step 1: escribir prueba roja de cobertura**

La prueba exige 30 días numerados, CTA consistente a `herencia90.shop`, WhatsApp como soporte, lenguaje `bajo pedido`/`pre orden`, 8–10 referencias piloto, mezcla S1/M2/L2/XL1 y reglas explícitas de reposición.

- [ ] **Step 2: ejecutar RED**

Run: `node --test tests/operations-kit.test.mjs`
Expected: FAIL por artefactos ausentes.

- [ ] **Step 3: crear los tres artefactos**

El calendario combina historia, detalles, comparaciones, prueba social y oferta; la guía define equipo mínimo, fondo, encuadres, color y exportación; el CSV registra referencia, hipótesis, unidades, costo, precio, fecha, ventas y disparador de recompra.

- [ ] **Step 4: ejecutar GREEN**

Run: `node --test tests/operations-kit.test.mjs`
Expected: PASS.

- [ ] **Step 5: commit local exacto**

Stage solo los cuatro archivos del kit.

## Task 9: Verificación integral y entrega local

**Files:**
- Modify: `docs/superpowers/plans/2026-07-13-herencia90-site-hardening.md` only to mark completed checkboxes

- [ ] **Step 1: sintaxis**

Run `node --check` sobre cada `.js`, `.cjs` y `.mjs` modificado.
Expected: 0 errores.

- [ ] **Step 2: suite completa**

Run: `$files = @(rg --files tests scripts -g '*.test.mjs'); node --test $files`
Expected: 0 fallos.

- [ ] **Step 3: servidor y navegador**

Levantar servidor Node local, probar home, catálogo, producto, pre orden, cuatro políticas, checkout y login/admin. Verificar 390x844 y 1440x900, teclado, consola, imágenes, enlaces, carrito y consentimiento.

- [ ] **Step 4: auditoría de artefactos y secretos**

Run: `git diff --check` y búsquedas de claves privadas, credenciales predeterminadas, `herencia90.shop/https://`, talla `R_` visible y marcadores pendientes.
Expected: salida limpia, salvo nombres de variables de entorno sin valores.

- [ ] **Step 5: revisar alcance Git**

Confirmar que no aparecen videos, caches, imágenes generadas, `.codex_tmp`, medios del proveedor o cambios ajenos. No hacer push.

- [ ] **Step 6: finalizar rama local**

Ejecutar la habilidad `superpowers:finishing-a-development-branch`, resumir commits, archivos, pruebas, límites externos y solicitar autorización separada antes de cualquier push o deploy.
