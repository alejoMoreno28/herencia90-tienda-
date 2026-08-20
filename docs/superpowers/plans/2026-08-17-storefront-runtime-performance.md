# Storefront Runtime Performance Implementation Plan

> **Owner:** Codex storefront performance workstream

**Goal:** Avoid unnecessary storefront network/runtime work, keep the preorder catalog static-first, and move analytics/icon loading outside the critical interaction path without changing customer-facing behavior.

**Architecture:** Keep the existing static HTML/CSS/JavaScript application. Add explicit runtime guards for pages that render products, reuse small load/idle schedulers for delayed third-party work, and keep local JSON as the primary preorder source with direct REST only as fallback or deferred enhancement.

**Tech Stack:** Static HTML, browser JavaScript, Node.js built-in test runner, Puppeteer smoke tests when locally available.

---

### Task 1: Lock the performance contracts

**Files:**
- Create: `tests/storefront-performance.test.mjs`

1. Assert product data and Supabase runtime are gated behind a real product surface.
2. Assert catalog resource hints match the fetched JSON and remove stale image preloads.
3. Assert GA4 and Phosphor are scheduled after load/idle, not first input.
4. Assert preorder remains static-first and excludes the invalid remote column/UMD client.
5. Run the test and record the expected RED failures before editing production files.

### Task 2: Gate storefront runtime work

**Files:**
- Modify: `web/js/app.js`
- Modify: `web/index.html`
- Modify: `web/catalogo.html`
- Modify: `web/nosotros.html`
- Modify: `web/preguntas-frecuentes.html`
- Modify: `web/categorias/*.html`

1. Render static navigation on every page, but initialize product JSON/REST/realtime only when a product or featured-product grid exists.
2. Move GA4 to a post-load idle schedule with a bounded fallback.
3. Load only the Phosphor weights used by the storefront, on the same delayed schedule.
4. Remove duplicated inline analytics bootstraps from storefront pages and obsolete catalog preloads.

### Task 3: Keep preorder static-first

**Files:**
- Modify: `web/js/preventa.js`
- Modify: `web/preventa/index.html`

1. Preserve list JSON then full JSON as the primary and fallback local sources.
2. Replace the Supabase UMD fallback with direct REST and an explicit valid column list.
3. Keep remote refresh deferred until after load/idle.
4. Defer GA4 and load only the Phosphor bold stylesheet.
5. Add favicon and stable image dimensions without changing search, filters, lightbox, cart, or WhatsApp flows.

### Task 4: Verify and commit

1. Run the new test, relevant existing Node tests, and `node --check` for changed JavaScript.
2. Run a local browser smoke when Puppeteer is already available.
3. Review the exact diff, stage only named files, and create one conventional commit.
