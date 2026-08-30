# Checklist móvil de inventario físico Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar una ruta privada, rápida y móvil para contar el inventario físico, guardar el avance y descargar diferencias sin modificar `productos`.

**Architecture:** Una página estática separada autentica con Supabase y usa dos tablas nuevas de auditoría protegidas por RLS. Un módulo puro calcula tallas, diferencias y CSV; otro módulo controla exclusivamente la interfaz y las escrituras en las tablas de auditoría. La tabla `productos` se consulta en modo lectura y jamás se muta.

**Tech Stack:** HTML/CSS/JavaScript sin framework, Supabase JS v2, PostgreSQL/RLS, Node `node:test`, Vercel rewrites.

---

## Estructura de archivos

- Crear `web/admin-inventario-fisico.html`: estructura semántica, metadatos privados y carga de dependencias.
- Crear `web/css/admin-inventario-fisico.css`: diseño móvil, estados, accesibilidad y adaptación de escritorio.
- Crear `web/js/admin-inventory-audit-core.js`: funciones puras de tallas, comparación, progreso y CSV.
- Crear `web/js/admin-inventory-audit.js`: sesión, consultas y escrituras limitadas a auditorías, navegación y renderizado.
- Crear `docs/supabase/migrations/20260830_inventario_fisico_auditoria.sql`: tablas, índices, RLS y permisos.
- Crear `scripts/admin-inventory-audit.test.mjs`: pruebas unitarias y contrato de no escritura sobre `productos`.
- Crear `scripts/admin-inventory-audit-ui.test.mjs`: contrato HTML, ruta, privacidad y carga de assets.
- Modificar `vercel.json`: rewrite y cabeceras `no-store` para la ruta privada.
- Modificar `web/login.html`: conservar en `next` la ruta privada solicitada y regresar a ella después del login.

### Task 1: Núcleo puro de comparación

**Files:**
- Create: `web/js/admin-inventory-audit-core.js`
- Create: `scripts/admin-inventory-audit.test.mjs`

- [ ] **Step 1: Escribir las pruebas fallidas del núcleo**

Crear pruebas que carguen el módulo en `vm`, expongan `window.AdminInventoryAuditCore` y verifiquen este contrato:

```js
assert.deepEqual(core.stockSizes({ S: 1, M: 2, R_M: 1, XL: 0 }), ['S', 'M', 'XL']);
assert.deepEqual(core.compareCounts({ S: 1, M: 2 }, { S: 1, M: 1 }), {
  status: 'difference', missing: 1, extra: 0, difference: -1
});
assert.equal(core.compareCounts({ S: 1 }, { S: 1 }).status, 'match');
assert.equal(core.progress([{ reviewed: true }, { reviewed: false }]).percent, 50);
assert.match(core.toCsv([{ productId: 7, product: 'Colombia', size: 'M', expected: 2, physical: 1, issue: 'No aparece', note: '' }]), /Colombia/);
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `node --test scripts/admin-inventory-audit.test.mjs`

Expected: FAIL porque `web/js/admin-inventory-audit-core.js` todavía no existe.

- [ ] **Step 3: Implementar el módulo mínimo**

Exponer estas funciones sin acceso a DOM ni Supabase:

```js
window.AdminInventoryAuditCore = {
  stockSizes,
  normalizeExpected,
  compareCounts,
  progress,
  auditRowsFromProducts,
  toCsv
};
```

`stockSizes()` excluye claves que empiecen por `R_`; `compareCounts()` suma por talla y devuelve `match` o `difference`; `toCsv()` escapa comillas, comas y saltos de línea y emite BOM UTF-8 para Excel móvil.

- [ ] **Step 4: Ejecutar las pruebas del núcleo**

Run: `node --test scripts/admin-inventory-audit.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit exacto**

```powershell
git add -- web/js/admin-inventory-audit-core.js scripts/admin-inventory-audit.test.mjs
git commit -m "test: define inventory audit calculations"
```

### Task 2: Persistencia segura en Supabase

**Files:**
- Create: `docs/supabase/migrations/20260830_inventario_fisico_auditoria.sql`
- Modify: `scripts/admin-inventory-audit.test.mjs`

- [ ] **Step 1: Agregar pruebas fallidas del contrato SQL**

Leer la migración como texto y comprobar:

```js
assert.match(sql, /create table if not exists public\.inventario_auditorias/i);
assert.match(sql, /create table if not exists public\.inventario_auditoria_items/i);
assert.match(sql, /owner_id uuid not null default auth\.uid\(\)/i);
assert.match(sql, /enable row level security/i);
assert.match(sql, /owner_id = auth\.uid\(\)/i);
assert.doesNotMatch(sql, /update\s+public\.productos|delete\s+from\s+public\.productos/i);
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `node --test scripts/admin-inventory-audit.test.mjs`

Expected: FAIL porque la migración no existe.

- [ ] **Step 3: Crear la migración**

La tabla `inventario_auditorias` tendrá `id uuid`, `owner_id`, `estado`, `total_referencias`, `created_at`, `updated_at`, `completed_at`. La tabla `inventario_auditoria_items` tendrá una fila por referencia con `audit_id`, `product_id`, copia de `equipo`, `descripcion`, `imagen`, `expected_counts jsonb`, `physical_counts jsonb`, `issue`, `note`, `reviewed`, `reviewed_at` y restricción única `(audit_id, product_id)`.

Crear políticas `select/insert/update/delete` que exijan `owner_id = auth.uid()` en la cabecera y que validen la propiedad de la auditoría mediante `exists` para los ítems. Revocar todo a `anon` y otorgar solo las operaciones requeridas a `authenticated`. No crear triggers ni funciones que escriban en `productos`.

- [ ] **Step 4: Ejecutar las pruebas del contrato SQL**

Run: `node --test scripts/admin-inventory-audit.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit exacto**

```powershell
git add -- docs/supabase/migrations/20260830_inventario_fisico_auditoria.sql scripts/admin-inventory-audit.test.mjs
git commit -m "feat: add protected inventory audit storage"
```

### Task 3: Interfaz móvil y controlador

**Files:**
- Create: `web/admin-inventario-fisico.html`
- Create: `web/css/admin-inventario-fisico.css`
- Create: `web/js/admin-inventory-audit.js`
- Create: `scripts/admin-inventory-audit-ui.test.mjs`

- [ ] **Step 1: Escribir las pruebas fallidas de interfaz y seguridad**

Verificar que el HTML contiene `meta robots="noindex, nofollow"`, `audit-progress`, `product-search`, `match-button`, `save-next-button`, `issue-fields` y `summary-view`; que carga Supabase, core y controlador; y que el controlador cumple:

```js
assert.match(controller, /\.from\(['"]productos['"]\)\.select/);
assert.doesNotMatch(controller, /\.from\(['"]productos['"]\)\.(?:insert|update|upsert|delete)/);
assert.match(controller, /\.from\(['"]inventario_auditorias['"]\)/);
assert.match(controller, /\.from\(['"]inventario_auditoria_items['"]\)/);
assert.match(css, /@media\s*\(min-width:\s*700px\)/);
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `node --test scripts/admin-inventory-audit-ui.test.mjs`

Expected: FAIL porque la pantalla y sus assets no existen.

- [ ] **Step 3: Crear el HTML accesible y mínimo**

La página tendrá encabezado HERENCIA90, estado de guardado, progreso, buscador, una tarjeta de producto, cantidades por talla, botones `Todo coincide`, `Anterior`, `Guardar y siguiente`, panel de novedad inicialmente oculto y vista de resumen. Todos los controles tendrán `label`, `type="button"` cuando corresponda y objetivos táctiles mínimos de 44 px.

- [ ] **Step 4: Crear el CSS móvil**

Usar fondo claro, negro y dorado de HERENCIA90; una sola columna hasta 699 px; inputs numéricos grandes; barra inferior fija solo en móvil; estados verde para coincidencia, rojo para faltante y azul para sobrante; y `overflow-x: hidden` sin tablas anchas.

- [ ] **Step 5: Crear el controlador**

Implementar `init()` con este orden:

```js
const { data: { session } } = await db.auth.getSession();
if (!session) return location.assign('/login?next=/admin-inventario-fisico');
const products = await loadProductsReadOnly();
const audit = await loadOrCreateActiveAudit(session.user.id, products);
renderCurrent(audit);
```

`loadProductsReadOnly()` solo usa `.from('productos').select(...)`. La creación congela los valores esperados. `Todo coincide` copia `expected_counts` a `physical_counts`. `Guardar y siguiente` hace `upsert` únicamente en `inventario_auditoria_items`, espera confirmación y luego avanza. La búsqueda salta entre referencias sin borrar estado. El resumen usa las funciones puras y descarga CSV mediante `Blob` y `URL.createObjectURL()`.

- [ ] **Step 6: Ejecutar ambas suites**

Run: `node --test scripts/admin-inventory-audit.test.mjs scripts/admin-inventory-audit-ui.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit exacto**

```powershell
git add -- web/admin-inventario-fisico.html web/css/admin-inventario-fisico.css web/js/admin-inventory-audit.js scripts/admin-inventory-audit-ui.test.mjs
git commit -m "feat: add mobile physical inventory checklist"
```

### Task 4: Ruta privada y retorno desde login

**Files:**
- Modify: `vercel.json`
- Modify: `web/login.html`
- Modify: `scripts/admin-inventory-audit-ui.test.mjs`

- [ ] **Step 1: Agregar pruebas fallidas de routing**

Comprobar que `vercel.json` define una cabecera `no-store` y rewrite de `/admin-inventario-fisico` a `/admin-inventario-fisico.html`. Comprobar que el login acepta únicamente `next` de una lista local permitida:

```js
const allowedNext = new Set(['/admin', '/admin.html', '/admin-inventario-fisico']);
const requestedNext = new URLSearchParams(location.search).get('next');
const nextPath = allowedNext.has(requestedNext) ? requestedNext : '/admin';
```

- [ ] **Step 2: Ejecutar y confirmar el fallo**

Run: `node --test scripts/admin-inventory-audit-ui.test.mjs`

Expected: FAIL por falta de rewrite, cabecera y retorno seguro.

- [ ] **Step 3: Implementar ruta y retorno seguro**

Agregar la cabecera privada antes de rutas públicas, agregar el rewrite y reemplazar las dos redirecciones fijas del login por `nextPath`. No aceptar URLs absolutas para impedir redirecciones abiertas.

- [ ] **Step 4: Validar JSON, JavaScript y pruebas**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"`

Run: `node --test scripts/admin-inventory-audit.test.mjs scripts/admin-inventory-audit-ui.test.mjs`

Expected: `vercel.json OK` y todas las pruebas PASS.

- [ ] **Step 5: Commit exacto**

```powershell
git add -- vercel.json web/login.html scripts/admin-inventory-audit-ui.test.mjs
git commit -m "feat: route private inventory checklist"
```

### Task 5: Validación real, migración y publicación

**Files:**
- Modify only if a defect is found: files created in Tasks 1-4.

- [ ] **Step 1: Ejecutar verificaciones estáticas completas**

Run: `node --check web/js/admin-inventory-audit-core.js`

Run: `node --check web/js/admin-inventory-audit.js`

Run: `node --test scripts/admin-inventory-audit.test.mjs scripts/admin-inventory-audit-ui.test.mjs scripts/admin-inventory-guard.test.mjs`

Expected: syntax OK and all tests PASS.

- [ ] **Step 2: Levantar servidor local y revisar a 390 × 844**

Run: `npx --yes serve web -l 4173`

Abrir `/admin-inventario-fisico.html`, confirmar que no existe desplazamiento horizontal, que sesión ausente redirige con `next`, que los botones son táctiles y que un error de red no avanza la referencia.

- [ ] **Step 3: Aplicar la migración de producción de forma controlada**

Crear primero un backup de solo esquema de las tablas implicadas si las herramientas locales lo permiten. Aplicar exactamente `docs/supabase/migrations/20260830_inventario_fisico_auditoria.sql` al proyecto Supabase configurado y verificar con consultas de solo lectura que existen ambas tablas, RLS está activo y `anon` no tiene permisos.

- [ ] **Step 4: Prueba autenticada sin alterar catálogo**

Registrar el hash o snapshot de IDs y `tallas` de `productos`, crear una auditoría de prueba, guardar un conteo, recargar y verificar reanudación, descargar CSV y eliminar solo la auditoría de prueba. Comparar nuevamente IDs y `tallas`; deben ser idénticos.

- [ ] **Step 5: Publicar y verificar el enlace real**

Publicar mediante el flujo Vercel existente, comprobar estado Ready y luego validar en el dominio real: `/admin-inventario-fisico` responde 200, usa `Cache-Control: no-store`, redirige al login sin sesión y vuelve al checklist después de autenticar.

- [ ] **Step 6: Entrega final**

Entregar el enlace real, resumir archivos cambiados, migración aplicada, comandos ejecutados, resultados de pruebas y evidencia de que el hash/snapshot de `productos` no cambió.
