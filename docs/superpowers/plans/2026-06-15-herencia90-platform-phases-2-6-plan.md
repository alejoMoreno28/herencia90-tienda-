# HERENCIA90 Platform Phases 2-6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build HERENCIA90 from a curated catalog site into a scalable ecommerce operating system for retro and current-season football shirts.

**Architecture:** The platform should evolve incrementally from the current static/Supabase setup. Each phase must ship as a working, testable milestone without breaking the live store. The internal tooling starts local-first, proves the workflow, then later graduates into a secure cloud admin.

**Tech Stack:** Static `web/` frontend, Node.js scripts, Supabase database/storage, Sharp image processing, BiRefNet local background removal, Vercel production hosting, future AI API integration, future payment gateway.

---

## Current Context

The repo already has:

- Public pages under `web/`.
- JSON catalogs: `web/productos.json`, `web/preventa-catalogo.json`, `web/preventa-catalogo-list.json`.
- Static product pages in `web/camisetas/` and `web/preventa/`.
- Admin surface in `web/admin.html`.
- Supabase scripts and schema docs.
- Preorder image curation scripts:
  - `scripts/preventa-curate-local.mjs`
  - `scripts/preventa-birefnet-remove-bg.py`
  - `scripts/preventa-curation-import.mjs`
  - `scripts/preventa-gallery-curate.mjs`
- Provider/import scripts:
  - `scripts/pv-discover-provider-catalog.mjs`
  - `scripts/pv-import-approved-from-matches.mjs`
  - `scripts/yupoo-extractor.mjs`
- Current production reference point:
  - `58e497e feat: curate preorder gallery ordering`

Phase 1 specification:

- `docs/superpowers/specs/2026-06-15-herencia90-platform-phase-1-design.md`

## Program Rule

Do not implement all phases as one giant code change. Implement in order:

1. Phase 2: Import Studio V1
2. Phase 3: Public Catalog UX for Scale
3. Phase 4: Cart and Add-ons
4. Phase 5: Payments and Orders
5. Phase 6: Operations, Analytics, and Growth

Each phase must end with:

- local verification
- production safety checklist
- exact-file commit
- user approval before push or deploy when user-facing behavior changes

## Approval Gates Reserved for the Owner

The owner must approve these decisions before implementation reaches the relevant point:

1. Preferred payment gateway.
2. Add-on price table for patches, dorsales, names, and bundles.
3. Whether deposits are accepted online or only full payments.
4. Shipping carriers and shipping fee rules.
5. Whether Import Studio remains local-only or becomes a cloud admin.
6. AI provider and monthly budget for product content generation.
7. Whether existing stock and bajo pedido stay visually separate or merge into one unified catalog with filters.
8. Whether customers can buy bajo pedido directly online or must request WhatsApp confirmation first.

---

## Phase 2: HERENCIA90 Import Studio V1

**Goal:** Let the owner add supplier references quickly and safely with visual review before publishing.

**Architecture:** Local-first Node workflow that takes provider URLs or CSV rows, extracts candidate product images, generates a local review dashboard, runs image curation for approved front/back images, and produces Supabase dry-run manifests. Publishing remains a separate approved step.

**Primary Files:**

- Create: `scripts/import-studio/import-studio.mjs`
- Create: `scripts/import-studio/lib/intake.mjs`
- Create: `scripts/import-studio/lib/provider-extract.mjs`
- Create: `scripts/import-studio/lib/ai-product-draft.mjs`
- Create: `scripts/import-studio/lib/review-dashboard.mjs`
- Create: `scripts/import-studio/lib/approval-manifest.mjs`
- Create: `scripts/import-studio/lib/supabase-dry-run.mjs`
- Create: `scripts/import-studio/templates/review-dashboard.html`
- Create: `tests/import-studio-intake.test.mjs`
- Create: `tests/import-studio-manifest.test.mjs`
- Modify: `package.json`

**Local Working Folders:**

- `.codex_tmp/import-studio/jobs/<job-id>/`
- `.codex_tmp/import-studio/jobs/<job-id>/candidates/`
- `.codex_tmp/import-studio/jobs/<job-id>/review/`
- `.codex_tmp/import-studio/jobs/<job-id>/approved/`
- `.codex_tmp/import-studio/jobs/<job-id>/dry-run/`

These folders must never be staged.

### Task 2.1: Define Intake Format

**Files:**
- Create: `scripts/import-studio/lib/intake.mjs`
- Test: `tests/import-studio-intake.test.mjs`

- [ ] **Step 1: Write intake parser tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImportRow } from '../scripts/import-studio/lib/intake.mjs';

test('normalizes a supplier import row', () => {
  const row = normalizeImportRow({
    url: 'https://supplier.example/item',
    equipo: 'Inter de Milan',
    temporada: '1997/1998',
    tipo: 'Local Retro',
    precio: '120000',
    colores: 'azul, negro',
    notas: 'Umbro, Pirelli'
  });

  assert.equal(row.providerUrl, 'https://supplier.example/item');
  assert.equal(row.teamName, 'Inter de Milan');
  assert.equal(row.seasonLabel, '1997/1998');
  assert.equal(row.shirtType, 'local');
  assert.equal(row.categoryPrimary, 'retro');
  assert.equal(row.price, 120000);
  assert.deepEqual(row.expectedColors, ['azul', 'negro']);
  assert.equal(row.notes, 'Umbro, Pirelli');
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
node --test tests\import-studio-intake.test.mjs
```

Expected: fails because `scripts/import-studio/lib/intake.mjs` does not exist.

- [ ] **Step 3: Implement intake normalization**

Create `scripts/import-studio/lib/intake.mjs`:

```js
export function normalizeImportRow(row) {
  const tipo = String(row.tipo || row.type || '').toLowerCase();
  const categoria = String(row.categoria || row.category || tipo).toLowerCase();

  return {
    providerUrl: String(row.url || row.providerUrl || '').trim(),
    teamName: String(row.equipo || row.teamName || '').trim(),
    seasonLabel: String(row.temporada || row.seasonLabel || '').trim(),
    shirtType: inferShirtType(tipo),
    categoryPrimary: inferCategory(categoria),
    price: Number(String(row.precio || row.price || '0').replace(/[^\d]/g, '')),
    expectedColors: String(row.colores || row.expectedColors || '')
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean),
    notes: String(row.notas || row.notes || '').trim()
  };
}

function inferShirtType(value) {
  if (value.includes('visitante')) return 'visitante';
  if (value.includes('tercera')) return 'tercera';
  if (value.includes('portero')) return 'portero';
  if (value.includes('local')) return 'local';
  return 'unknown';
}

function inferCategory(value) {
  if (value.includes('retro')) return 'retro';
  if (value.includes('seleccion') || value.includes('selección')) return 'seleccion';
  if (value.includes('temporada')) return 'temporada_actual';
  return 'club';
}
```

- [ ] **Step 4: Run passing test**

Run:

```powershell
node --test tests\import-studio-intake.test.mjs
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add -- scripts/import-studio/lib/intake.mjs tests/import-studio-intake.test.mjs
git commit -m "feat: add import studio intake parser"
```

### Task 2.2: Generate Review Dashboard

**Files:**
- Create: `scripts/import-studio/lib/review-dashboard.mjs`
- Create: `scripts/import-studio/templates/review-dashboard.html`
- Test: `tests/import-studio-dashboard.test.mjs`

- [ ] **Step 1: Write dashboard generation test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReviewDashboard } from '../scripts/import-studio/lib/review-dashboard.mjs';

test('renders review dashboard with candidate role controls', () => {
  const html = renderReviewDashboard({
    jobId: 'job-test',
    references: [
      {
        slug: 'inter-1997-local',
        title: 'Inter de Milan 1997 Local',
        candidates: [
          { id: 'img-1', url: 'candidates/1.webp' },
          { id: 'img-2', url: 'candidates/2.webp' }
        ]
      }
    ]
  });

  assert.match(html, /Inter de Milan 1997 Local/);
  assert.match(html, /data-role="front"/);
  assert.match(html, /data-role="back"/);
  assert.match(html, /data-role="detail"/);
  assert.match(html, /data-role="rejected"/);
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
node --test tests\import-studio-dashboard.test.mjs
```

Expected: fails because dashboard renderer is missing.

- [ ] **Step 3: Implement dashboard renderer**

Create `scripts/import-studio/lib/review-dashboard.mjs`:

```js
import fs from 'node:fs';
import path from 'node:path';

export function renderReviewDashboard(job) {
  const cards = job.references.map(renderReference).join('\n');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HERENCIA90 Import Studio - ${escapeHtml(job.jobId)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f6f4; color: #111; }
    header { padding: 18px 22px; background: #111; color: #fff; }
    main { padding: 22px; display: grid; gap: 18px; }
    section { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
    figure { margin: 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; background: #fafafa; }
    img { width: 100%; aspect-ratio: 1 / 1; object-fit: contain; display: block; background: #f2f2f2; }
    .roles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 8px; }
    button { min-height: 34px; border: 1px solid #bbb; background: #fff; border-radius: 6px; cursor: pointer; }
  </style>
</head>
<body>
  <header><h1>HERENCIA90 Import Studio</h1><p>${escapeHtml(job.jobId)}</p></header>
  <main>${cards}</main>
</body>
</html>`;
}

export function writeReviewDashboard(job, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderReviewDashboard(job), 'utf8');
}

function renderReference(reference) {
  const candidates = reference.candidates.map((candidate) => `
    <figure data-image-id="${escapeHtml(candidate.id)}">
      <img src="${escapeHtml(candidate.url)}" alt="${escapeHtml(reference.title)} candidato ${escapeHtml(candidate.id)}">
      <figcaption class="roles">
        <button data-role="front">Frente</button>
        <button data-role="back">Espalda</button>
        <button data-role="detail">Detalle</button>
        <button data-role="rejected">Rechazar</button>
      </figcaption>
    </figure>`).join('\n');

  return `<section>
    <h2>${escapeHtml(reference.title)}</h2>
    <p>${escapeHtml(reference.slug)}</p>
    <div class="grid">${candidates}</div>
  </section>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
```

- [ ] **Step 4: Run passing test**

Run:

```powershell
node --test tests\import-studio-dashboard.test.mjs
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add -- scripts/import-studio/lib/review-dashboard.mjs tests/import-studio-dashboard.test.mjs
git commit -m "feat: add import studio review dashboard"
```

### Task 2.3: Create Approval Manifest

**Files:**
- Create: `scripts/import-studio/lib/approval-manifest.mjs`
- Test: `tests/import-studio-manifest.test.mjs`

- [ ] **Step 1: Write manifest validation test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateApprovalManifest } from '../scripts/import-studio/lib/approval-manifest.mjs';

test('requires exactly one front image before publish', () => {
  const result = validateApprovalManifest({
    slug: 'inter-1997-local',
    images: [
      { id: '1', role: 'front' },
      { id: '2', role: 'detail' }
    ]
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('rejects manifest without front image', () => {
  const result = validateApprovalManifest({
    slug: 'inter-1997-local',
    images: [{ id: '1', role: 'detail' }]
  });

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /front/);
});
```

- [ ] **Step 2: Run failing test**

```powershell
node --test tests\import-studio-manifest.test.mjs
```

Expected: fails because manifest validator is missing.

- [ ] **Step 3: Implement approval manifest validation**

```js
export function validateApprovalManifest(manifest) {
  const errors = [];
  const images = Array.isArray(manifest.images) ? manifest.images : [];
  const frontCount = images.filter((image) => image.role === 'front').length;
  const backCount = images.filter((image) => image.role === 'back').length;

  if (!manifest.slug) errors.push('slug is required');
  if (frontCount !== 1) errors.push('exactly one front image is required');
  if (backCount > 1) errors.push('at most one back image is allowed');

  images.forEach((image) => {
    if (!['front', 'back', 'detail', 'logo', 'patch', 'collar', 'fabric', 'tag', 'rejected'].includes(image.role)) {
      errors.push(`invalid role for image ${image.id || 'unknown'}`);
    }
  });

  return {
    ok: errors.length === 0,
    errors
  };
}
```

- [ ] **Step 4: Run passing test**

```powershell
node --test tests\import-studio-manifest.test.mjs
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add -- scripts/import-studio/lib/approval-manifest.mjs tests/import-studio-manifest.test.mjs
git commit -m "feat: validate import studio approval manifests"
```

### Task 2.4: Wire Import Studio CLI

**Files:**
- Create: `scripts/import-studio/import-studio.mjs`
- Modify: `package.json`
- Test: `tests/import-studio-cli.test.mjs`

- [ ] **Step 1: Add CLI smoke test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('import studio help prints available commands', () => {
  const result = spawnSync(process.execPath, ['scripts/import-studio/import-studio.mjs', '--help'], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /HERENCIA90 Import Studio/);
  assert.match(result.stdout, /prepare/);
  assert.match(result.stdout, /dry-run/);
});
```

- [ ] **Step 2: Run failing test**

```powershell
node --test tests\import-studio-cli.test.mjs
```

Expected: fails because CLI is missing.

- [ ] **Step 3: Implement CLI help**

```js
const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  console.log(`HERENCIA90 Import Studio

Commands:
  prepare --input <csv-or-json> --job-id <id>
  dashboard --job-id <id>
  dry-run --job-id <id>

Safety:
  This tool never publishes without an approval manifest.
`);
  process.exit(0);
}

console.error(`Unknown command: ${args[0]}`);
process.exit(1);
```

- [ ] **Step 4: Add package script**

Modify `package.json` scripts:

```json
"import-studio": "node scripts/import-studio/import-studio.mjs"
```

- [ ] **Step 5: Run passing test**

```powershell
node --test tests\import-studio-cli.test.mjs
```

Expected: pass.

- [ ] **Step 6: Commit**

```powershell
git add -- package.json scripts/import-studio/import-studio.mjs tests/import-studio-cli.test.mjs
git commit -m "feat: add import studio cli"
```

### Phase 2 Exit Criteria

- [ ] Owner can prepare a local import job from a CSV or URL input.
- [ ] Owner can open a local dashboard and review candidate images.
- [ ] Approved manifest validates front/back/detail roles.
- [ ] Tool can generate a Supabase dry-run without uploading.
- [ ] No generated images, provider downloads, or `.codex_tmp` folders are staged.
- [ ] At least one sample batch is reviewed visually before publishing support is added.

---

## Phase 3: Public Catalog UX for Scale

**Goal:** Make the public site easy to browse when HERENCIA90 has hundreds or thousands of references.

**Architecture:** Add structured catalog indexes and reusable frontend filtering/search logic before changing the visual surface heavily. Keep pages static-friendly and fast.

**Primary Files:**

- Create: `web/catalog-index.json`
- Create: `scripts/generate-catalog-index.mjs`
- Create: `web/js/catalog-search.js`
- Create: `tests/catalog-index.test.mjs`
- Modify: `web/catalogo.html`
- Modify: `web/preventa.html` if present or the relevant preventa page file
- Modify: `scripts/generate-product-pages.mjs`

### Task 3.1: Build Catalog Index

- [ ] Create a test that reads `web/productos.json` and `web/preventa-catalogo-list.json`.
- [ ] Assert every indexed item has `slug`, `title`, `category`, `collections`, `search_text`, `image`, `price`, and `availability`.
- [ ] Implement `scripts/generate-catalog-index.mjs` to merge stock and bajo pedido into a search-friendly index.
- [ ] Add npm script `catalog:index`.
- [ ] Run `node --test tests/catalog-index.test.mjs`.
- [ ] Commit exact files.

### Task 3.2: Add Search and Filter Logic

- [ ] Create `web/js/catalog-search.js` with pure functions: `normalizeQuery`, `filterCatalogItems`, `sortCatalogItems`.
- [ ] Test search by team, season, category, color, and availability.
- [ ] Add filter UI to the public catalog page using compact controls.
- [ ] Verify mobile layout does not overlap.
- [ ] Commit exact files.

### Task 3.3: Create Scalable Collections

- [ ] Define canonical collections: Retro, Temporada Actual, Selecciones, Clubes, Colombia, Real Madrid, Barcelona, Manga Larga, Player, Porteros, Stock, Bajo Pedido.
- [ ] Generate collection landing pages from `web/catalog-index.json`.
- [ ] Add collection links to navigation without overcrowding.
- [ ] Update sitemap generation.
- [ ] Run SEO tests.
- [ ] Commit exact files.

### Phase 3 Exit Criteria

- [ ] A customer can find a shirt by team, season, type, and availability.
- [ ] Stock and bajo pedido are clear.
- [ ] Collection pages exist for major buying paths.
- [ ] Site remains fast and static-friendly.
- [ ] Existing preventa gallery behavior remains unchanged.

---

## Phase 4: Cart and Add-ons

**Goal:** Let customers configure shirts with size and optional extras before checkout.

**Architecture:** Build cart state and add-on compatibility first, without payment gateway. Cart should support both stock and bajo pedido lines.

**Primary Files:**

- Create: `web/js/cart-core.js`
- Create: `web/js/addons-core.js`
- Create: `web/cart.html`
- Create: `web/addons.json`
- Create: `tests/cart-core.test.mjs`
- Create: `tests/addons-core.test.mjs`
- Modify: product detail pages and preventa detail rendering.

### Task 4.1: Define Add-on Catalog

- [ ] Create `web/addons.json` with patches, dorsales, custom name, and bundles.
- [ ] Add fields: `id`, `name`, `type`, `price`, `requires_text`, `requires_number`, `compatibility`.
- [ ] Write tests ensuring incompatible add-ons do not appear for wrong references.
- [ ] Commit exact files.

### Task 4.2: Build Cart Core

- [ ] Create pure cart functions: `createCart`, `addLine`, `removeLine`, `updateQuantity`, `calculateTotals`.
- [ ] Support base price plus add-ons.
- [ ] Support stock and bajo pedido estimated delivery labels.
- [ ] Test totals, quantity, add-ons, and removal.
- [ ] Commit exact files.

### Task 4.3: Add Product Page Cart Controls

- [ ] Add size selector.
- [ ] Add add-on selectors based on compatibility.
- [ ] Add custom text/number inputs when required.
- [ ] Add "Agregar al carrito" button.
- [ ] Preserve WhatsApp fallback.
- [ ] Verify mobile product page layout.
- [ ] Commit exact files.

### Phase 4 Exit Criteria

- [ ] Customer can add a shirt with size to cart.
- [ ] Customer can add compatible patches/dorsal/name.
- [ ] Cart totals are correct.
- [ ] WhatsApp remains available.
- [ ] No payment is collected yet.

---

## Phase 5: Payments and Orders

**Goal:** Turn configured carts into real orders and collect payment safely.

**Architecture:** Implement order creation and payment intent flow after cart is stable. Payment gateway must be chosen by owner before coding.

**Primary Files:**

- Create: `docs/payments-decision.md`
- Create: `scripts/orders/order-schema.sql`
- Create: `web/checkout.html`
- Create: `web/js/checkout.js`
- Create: `tests/order-payload.test.mjs`
- Modify: Supabase schema docs.

### Task 5.1: Payment Gateway Decision

- [ ] Compare Wompi, Mercado Pago, PayU, Stripe, and manual WhatsApp transfer.
- [ ] Document fees, Colombia support, checkout UX, refund handling, and API complexity.
- [ ] Owner approves one gateway.
- [ ] Commit decision doc.

### Task 5.2: Order Model

- [ ] Define `orders`, `order_items`, `order_item_addons`, `payment_events`.
- [ ] Include order states: `draft`, `pending_payment`, `paid`, `confirmed`, `ordered_to_supplier`, `shipped`, `delivered`, `cancelled`, `refunded`.
- [ ] Include payment states: `unpaid`, `deposit_paid`, `paid`, `failed`, `refunded`.
- [ ] Write payload validation tests.
- [ ] Commit schema docs and tests.

### Task 5.3: Checkout Without Payment

- [ ] Build checkout page that collects customer name, phone, city, address, shipping notes.
- [ ] Create order payload locally.
- [ ] Show WhatsApp confirmation fallback.
- [ ] Test payload shape.
- [ ] Commit exact files.

### Task 5.4: Payment Integration

- [ ] Add gateway-specific payment creation after owner approval.
- [ ] Store payment event response safely.
- [ ] Handle success, pending, and failure returns.
- [ ] Never trust frontend-only payment status.
- [ ] Add webhook verification if gateway supports it.
- [ ] Commit exact files.

### Phase 5 Exit Criteria

- [ ] A customer can checkout from cart.
- [ ] Orders are recorded with line items and add-ons.
- [ ] Payment state is reliable.
- [ ] Failed payments do not create confirmed orders.
- [ ] Owner can reconcile order/payment status.

---

## Phase 6: Operations, Analytics, and Growth

**Goal:** Help HERENCIA90 operate and grow like a professional ecommerce brand.

**Architecture:** Add internal dashboards after order and catalog data are structured. Focus on decisions: what to restock, what to import, what sells, what customers search.

**Primary Files:**

- Create: `web/admin-ops.html`
- Create: `web/js/admin-ops.js`
- Create: `scripts/analytics/catalog-metrics.mjs`
- Create: `scripts/analytics/order-metrics.mjs`
- Create: `tests/catalog-metrics.test.mjs`
- Create: `tests/order-metrics.test.mjs`

### Task 6.1: Catalog Metrics

- [ ] Count references by team, country, category, status, and availability.
- [ ] Identify products missing front/back/details.
- [ ] Identify products missing SEO descriptions.
- [ ] Identify products with low image counts.
- [ ] Commit metrics script and tests.

### Task 6.2: Order Metrics

- [ ] Calculate revenue by category.
- [ ] Calculate add-on revenue.
- [ ] Calculate top teams.
- [ ] Calculate pending bajo pedido count.
- [ ] Calculate order aging by state.
- [ ] Commit metrics script and tests.

### Task 6.3: Growth Backlog

- [ ] Generate suggested references to add based on search demand, sold products, and missing major teams.
- [ ] Track supplier links by priority.
- [ ] Export a weekly import list for Import Studio.
- [ ] Commit exact files.

### Phase 6 Exit Criteria

- [ ] Owner can see what categories are growing.
- [ ] Owner can identify missing photos/content.
- [ ] Owner can prioritize new references.
- [ ] Owner can monitor pending orders and supplier backlog.

---

## Suggested Commit Strategy

Use small commits, never broad staging:

```powershell
git add -- exact/file1 exact/file2
git commit -m "feat: add import studio intake parser"
```

Recommended commit groups:

1. `feat: add import studio intake parser`
2. `feat: add import studio review dashboard`
3. `feat: validate import studio approval manifests`
4. `feat: add catalog index generation`
5. `feat: add storefront catalog filters`
6. `feat: add cart core`
7. `feat: add product add-ons`
8. `feat: define order and payment schema`
9. `feat: add checkout order capture`
10. `feat: add operations metrics`

## Testing Strategy

Every phase should run:

```powershell
node tests\site-seo.test.mjs
node --test tests\preventa-curate-local.test.mjs tests\preventa-curation-import.test.mjs
```

Add phase-specific tests:

```powershell
node --test tests\import-studio-intake.test.mjs
node --test tests\import-studio-manifest.test.mjs
node --test tests\catalog-index.test.mjs
node --test tests\cart-core.test.mjs
node --test tests\addons-core.test.mjs
node --test tests\order-payload.test.mjs
node --test tests\catalog-metrics.test.mjs
node --test tests\order-metrics.test.mjs
```

Before public deploys, verify:

- `/`
- `/catalogo`
- `/preventa`
- representative stock product page
- representative bajo pedido product page
- cart page after Phase 4
- checkout page after Phase 5

## Final Owner Questions Before Phase 5

These can wait until the relevant phase:

1. Which payment gateway should HERENCIA90 use?
2. Should bajo pedido require full payment, deposit, or WhatsApp confirmation first?
3. What are exact prices for patches, dorsales, and custom names?
4. Which shipping carriers and fixed/ranged shipping prices should be used?
5. Should checkout require account login or remain guest checkout?
6. Should internal admin become cloud-based after Import Studio V1 proves the workflow?

## Recommended Immediate Next Action

Start Phase 2 only.

Build Import Studio V1 in the smallest useful version:

1. intake parser
2. review dashboard
3. approval manifest
4. dry-run output
5. one supplier sample

Do not begin cart, payments, or cloud admin until Import Studio V1 is working and approved.
