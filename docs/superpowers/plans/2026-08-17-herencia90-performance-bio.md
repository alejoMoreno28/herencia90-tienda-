# HERENCIA90 Performance And TikTok Bio Implementation Plan

> **For Codex:** Execute with test-first changes, exact-file Git staging, independent worktrees for parallel work, and verification before every completion claim.

**Goal:** Repair the confirmed mobile performance and generated-page correctness issues, add an ultralight first-party TikTok `/bio` page led by WhatsApp, and publish the fully verified result to Git and Vercel production.

**Architecture:** Preserve the static `web/` storefront and its generator. Improve the generation boundary so static HTML is fast and correct before enhancement scripts run; reduce unnecessary third parties and data fetches per route; add one standalone HTML/CSS bio route. Integrate independently reviewed branches into `codex/performance-bio`, then fast-forward or merge verified work into `main` and deploy.

**Tech Stack:** Static HTML, CSS, modern JavaScript/Node.js, Node test runner/assertions, Puppeteer/Chrome for browser checks, Vercel CLI, Git/GitHub.

---

## Task 1: Freeze The Baseline And Add Regression Tests

**Files:**

- Modify: `tests/site-seo.test.mjs`
- Modify: `tests/storefront-usability.test.mjs`
- Create: `tests/performance-regressions.test.mjs`

1. Record the existing passing baseline:

   - `node tests/site-seo.test.mjs`
   - `node tests/storefront-usability.test.mjs`
   - `node --check scripts/generate-product-pages.mjs`
   - `node --check web/js/app.js`
   - `node --check web/js/preventa.js`

2. Add focused failing assertions for:

   - no `../https://` or doubled production origins in generated pages;
   - one eager/high-priority primary product image and lazy/async secondary images;
   - intrinsic dimensions or explicit aspect ratios on cards;
   - absence of `logo.webp` in small visual/favicon placements;
   - no parser-blocking Supabase script and no synthetic `modal_open` at startup;
   - no unconditional product JSON/realtime work on pages without catalog grids;
   - no duplicate unversioned/versioned `productos.json` preload/fetch pair;
   - deterministic asset versions rather than hand-maintained timestamps.

3. Run the new test and confirm it fails for the expected current defects.

4. Commit only the test files on the owning workstream branch.

## Task 2: Repair Generated Product And City Pages

**Files:**

- Modify: `scripts/generate-product-pages.mjs`
- Modify: relevant generator tests from Task 1
- Regenerate: `web/camisetas/*.html`
- Regenerate: `web/ciudades/*.html`
- Regenerate only if produced by the same generator: `web/categorias/*.html`, `web/preventa/*.html`, `web/sitemap.xml`

1. Make the URL/image regression tests fail.

2. Introduce small pure helpers:

   - `isAbsoluteUrl(value)`;
   - `resolveAssetUrl(value, { absolute })`;
   - `cardAssetUrl(value)` that selects an existing local `-card.webp` and otherwise returns the source;
   - image attribute rendering that distinguishes primary and deferred images.

3. Update gallery, thumbnail, related-product, category, and city markup:

   - primary image eager/high priority with stable geometry;
   - thumbnails/cards lazy + async + stable geometry;
   - thumbnail `src` may use card image while `data-full`/link retains the master;
   - all URLs flow through the helpers.

4. Replace small occurrences of `logo.webp` and favicon use with `logo-ui.webp`/`favicon.webp`.

5. Move Supabase/AOS/Tilt outside parser-critical work. Preserve static content and interactions; select only required live columns; update DOM only on actual changes; eliminate false `modal_open` startup tracking.

6. Regenerate pages using the repository generator without any Supabase upload or asset replacement.

7. Verify:

   - targeted tests pass;
   - `node --check scripts/generate-product-pages.mjs`;
   - `rg --fixed-strings "../https://" web/camisetas web/ciudades` returns no match;
   - `rg --fixed-strings "https://www.herencia90.shop/https://" web/camisetas web/ciudades` returns no match;
   - representative generated HTML has the intended loading and sizing attributes.

8. Stage and commit only the generator, targeted tests, and intentional generated output.

## Task 3: Reduce Main Storefront Critical Work

**Files:**

- Modify: `web/js/app.js`
- Modify: `web/js/preventa.js`
- Modify: `web/index.html`
- Modify: `web/catalogo.html`
- Modify: `web/preventa/index.html`
- Modify if required: `web/nosotros.html`, `web/preguntas-frecuentes.html`
- Modify: tests owned by this workstream

1. Add failing tests proving catalog fetch/REST/realtime is guarded by the presence of a catalog grid.

2. In `app.js`, return early from catalog-data and realtime setup on routes without `productGrid` or `featuredProductGrid`.

3. In `catalogo.html`, remove stale hard-coded product-image preloads, align or remove the duplicate catalog JSON preload, and add the relevant Supabase resource hint.

4. In `preventa.js`:

   - remove missing database columns from remote selects;
   - treat local static JSON as the successful primary path;
   - run remote refresh only as a deferred enhancement/fallback;
   - avoid loading Supabase UMD merely to show the static catalog;
   - keep search, pagination, cards, lightbox, and WhatsApp behavior unchanged.

5. Delay GA4 loading using idle time after `load` with a bounded timeout, not the first pointer/key event. Keep page measurement functional.

6. Reduce icon payload safely on critical storefront paths. Prefer inline/local SVG for icons touched in this scope; if full replacement would risk visual regression, load the existing library only after content becomes interactive and document the residual cost.

7. Add missing favicon and image dimensions on `/preventa`.

8. Verify JavaScript syntax, relevant tests, and browser behavior on home/catalog/preventa/nosotros/FAQ.

9. Stage and commit exact files only.

## Task 4: Build The First-Party `/bio` Page

**Files:**

- Create: `web/bio.html`
- Create: `web/css/bio.css`
- Create: `tests/bio-page.test.mjs`

1. Write failing tests for:

   - Spanish semantic page with one `h1`;
   - canonical `/bio` metadata and share metadata;
   - WhatsApp as the first and visually primary CTA;
   - valid WhatsApp number and prefilled TikTok-origin message;
   - at most four large commercial CTA links;
   - UTM tags on internal commercial links;
   - no app bundle, Supabase, video, icon-font CDN, or carousel;
   - accessible focus/reduced-motion behavior and 44 px targets;
   - use of small HERENCIA90 logo/favicon assets.

2. Implement semantic HTML following the approved Golden Match Ticket design.

3. Implement small dedicated CSS with the ticket/perforation anchor, dark/gold palette, responsive first viewport, accessible focus, and reduced motion.

4. Keep JavaScript optional; if analytics click events are added, use a tiny defensive inline handler that never blocks navigation.

5. Run the test, syntax/static checks, and mobile visual inspection at 390 x 844 and 412 x 915.

6. Commit only the bio HTML, CSS, and test.

## Task 5: Make Cache Versions Deterministic And Wire `/bio`

**Files:**

- Modify or replace behavior in: `scripts/cache_bust.js`
- Modify: `package.json`
- Modify: `vercel.json`
- Modify: `web/sitemap.xml`
- Modify: `tests/performance-regressions.test.mjs`
- Modify: `tests/site-seo.test.mjs`

1. Add failing tests for content-derived versions, `/bio` rewrite/cache policy, and sitemap inclusion.

2. Change `cache_bust.js` from `Date.now()` mutation to deterministic hashes derived from actual asset bytes. It must:

   - update local CSS/JS references in HTML;
   - align known JSON fetch/preload versions;
   - preserve the existing Vercel caching policy rather than overwriting it with a second policy;
   - be idempotent when asset contents have not changed;
   - avoid generated/temp/heavy media directories.

3. Add a narrowly named npm script such as `assets:version`.

4. Add `/bio` rewrite and public revalidation header in `vercel.json`.

5. Add the canonical `/bio` URL to `web/sitemap.xml`.

6. Run the versioning script twice and assert the second run produces no diff.

7. Stage exact files and commit.

## Task 6: Integrate And Review The Parallel Work

**Files:** All intentional changed files.

1. Merge each reviewed workstream branch into `codex/performance-bio`.

2. Resolve generated sitemap/version conflicts by rerunning the deterministic generator/versioning commands, not by manually discarding one workstream.

3. Run a spec-compliance review against the approved design and user request.

4. Run a code-quality review focused on correctness, unintended visual changes, accessibility, cache semantics, and third-party loading.

5. Fix all critical/important findings test-first; re-run targeted checks after each fix.

## Task 7: Full Local Verification

1. Run every `*.test.mjs` file that is safe and part of the normal suite, explicitly excluding scripts that require service secrets.

2. Run:

   - `node --check scripts/generate-product-pages.mjs`
   - `node --check scripts/cache_bust.js`
   - `node --check web/js/app.js`
   - `node --check web/js/preventa.js`
   - `git diff --check main...HEAD`

3. Start a local static server and run browser smoke checks at mobile and desktop sizes for:

   - `/`;
   - `/catalogo.html`;
   - `/preventa/index.html`;
   - a representative `/camisetas/*.html` page containing absolute Supabase images;
   - `/ciudades/barranquilla.html`;
   - `/bio.html`.

4. Capture console errors, failed requests, LCP/CLS, initial transferred bytes, image request counts, and first-viewport screenshots.

5. Verify cart, filters/search, product gallery, WhatsApp URLs, responsive navigation, and no horizontal overflow.

6. Compare against the recorded baseline and document any residual third-party costs honestly.

## Task 8: Git Publication And Vercel Production Deployment

1. Inspect `git status`, `git diff --stat`, and the exact changed file list. Confirm no raw media, cache, secrets, `.codex_tmp`, or unrelated user files are included.

2. Stage only exact intended files. Never use `git add .`, `git add -A`, `git add --`, or the repository-incompatible broad commit helper.

3. Commit the final integration if needed with a conventional Spanish message.

4. Refresh `origin/main`; verify whether it moved; resolve safely and rerun affected tests.

5. Push `codex/performance-bio`, merge the verified result to `main` according to the repository's current remote state, and push `main`.

6. Deploy production using the linked Vercel project. Capture the deployment URL and wait for `Ready`.

7. Production smoke test canonical URLs and headers, including `/bio`, representative product/city routes, JSON, hashed CSS/JS, WhatsApp CTA, and zero malformed image URLs.

8. Re-run mobile PageSpeed/Lighthouse when service quota allows; otherwise reproduce the local throttled measurement and clearly label it as laboratory evidence.

9. Report the production URL, commit SHA, changed-file groups, tests, measured before/after results, and any remaining low-priority limitations.
