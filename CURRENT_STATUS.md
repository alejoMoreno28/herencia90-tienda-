# Current Status

## Implemented

- Static public storefront under `web/`.
- Homepage, catalog page, product detail pages, category pages, city landing pages, FAQ, nosotros, login, admin, and bajo pedido pages.
- Stock catalog data in `web/productos.json`.
- Bajo pedido catalog data in `web/preventa-catalogo.json` and `web/preventa-catalogo-list.json`.
- Generated static pages for stock products, preventa references, categories, and cities.
- WhatsApp-driven sales flow for stock checkout, product inquiry, and bajo pedido quote requests.
- Client-side search, filtering, pagination/render batching, local cart, and product modals in `web/js/app.js`.
- Bajo pedido filters, lightbox/gallery behavior, mobile view preference, and 4-step quote wizard in `web/js/preventa.js`.
- Admin surface with Supabase and modules for finance, inventory guard, lote workflow, photo review, and pedido payments.
- Import Studio V1 local review/dry-run process for new bajo pedido references.
- Automated supplier-order intake: reads the photos embedded in the supplier
  Excel, finds each shirt in the provider's yupoo stores, removes backgrounds
  locally on GPU, and loads the products with their stock. Documented in
  `docs/cargar-pedido-del-proveedor.md`. Last real run: PEDIDO5 on 2026-07-26
  (15 new references, 4 stock top-ups, 51 units).
- SEO files and docs: `web/sitemap.xml`, `web/robots.txt`, `web/llms.txt`, category/city pages, structured data, and multiple docs under `docs/`.
- Vercel deployment config with `web/` as output.

## Partially Implemented / Needs Care

- Tests exist, but no unified `npm test` script is declared.
- Build/deploy pipeline appears script-driven and Vercel-static, but there is no single documented build command.
- Admin functionality is concentrated in one large `web/admin.html` plus modules; changes can be fragile.
- Product/catalog generation scripts exist, but the exact required sequence for all page regeneration needs confirmation for each task.
- Preorder image/gallery imports have an approval gate: audit and review first, then import/upload only after explicit user approval.
- `.env` exists locally, but no `.env.example` was found. Do not copy or expose secrets.

## Broken / Risky / Unclear

- Adding lote stock is NOT repeatable. `persistLoteItems()` in `web/admin.html`
  reads the product's `tallas` and adds the Excel quantities on top, so running
  a load twice doubles the inventory. Products are created with zeros on
  purpose; never pre-fill them. Same rule applies to
  `scripts/cargar-lote.mjs`, which has `--solo-nuevos` to resume a half-failed
  run without re-adding stock.
- The `productos` table has no default for `id`; the admin assigns it by taking
  the highest existing id and adding one. Inserts without an explicit id fail.

- Some visible text in existing files appears mojibake/encoding-corrupted in terminal output. Needs confirmation before changing content because this may be a display/encoding issue or already present in source.
- `vercel.json` rewrites `/preventa` to `/preventa.html`, while the inspected preventa entry is `web/preventa/index.html`. Needs confirmation whether `web/preventa.html` exists elsewhere, is generated, or the rewrite is stale.
- Public JavaScript contains a Supabase anon key, which may be intentional for browser access; secret/service keys must remain out of client code.
- There are many local/media/work folders at the repo root. They should not be staged or deployed unless Camilo explicitly approves a narrow asset path.
- Existing docs sometimes use "preventa"; brand guidance also prefers "bajo pedido" / "pre orden" in customer-facing copy. Needs confirmation before broad wording changes.

## Missing

- Root-level architecture/project/status/roadmap docs were missing before this task.
- No root `.env.example` was found.
- No explicit npm `build`, `lint`, or `test` script.
- No concise root README was observed in the inspected file list.
- Needs confirmation: full production release checklist, admin login/security model, Supabase schema ownership, and rollback process.

