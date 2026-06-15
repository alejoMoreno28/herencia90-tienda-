# HERENCIA90 Platform Phase 1 Design

Date: 2026-06-15
Workspace: C:\Users\PC\Desktop\HERENCIA90
Status: Approved by owner for phased planning
Phase: 1 - Professional catalog and operating foundation

## 1. Vision

HERENCIA90 should become a serious ecommerce platform for retro and current-season football shirts. The public store must feel organized, trustworthy, fast, and premium, even when the catalog grows to hundreds or thousands of references. The internal workflow must let the owner add new shirts from supplier pages with minimal manual effort, while preserving visual quality and avoiding wrong references.

The long-term system has two connected products:

1. The public store: customer-facing catalog, product pages, filters, cart, add-ons, payments, and order tracking.
2. The internal operating panel: product import, supplier image review, AI content assistant, photo curation, pricing, catalog publishing, order operations, and reporting.

Phase 1 does not build all of that. Phase 1 defines the professional foundation so later phases can be built without reworking the catalog repeatedly.

## 2. Current State

The project already has:

- Static public pages under `web/`.
- Product and preorder catalogs in JSON files.
- Supabase as the production backend/storage layer.
- Existing admin-related scripts and pages.
- A local image curation pipeline for preorder shirts using BiRefNet.
- A published preorder gallery system where curated front/back images are first and original detail images follow.
- Recent production commit for gallery ordering: `58e497e feat: curate preorder gallery ordering`.

The current risk is not lack of capability. The risk is growth without a strict operating model. If many new references are added without a canonical data model, category rules, media rules, and review gates, the store can become hard to browse and harder to maintain.

## 3. Product Principles

1. Quality before volume.
   HERENCIA90 can have many references, but every reference must look intentional.

2. Human approval before publishing.
   AI can classify, write, sort, and suggest, but the owner approves product identity, images, price, and publish state.

3. One source of truth.
   Public JSON, Supabase rows, static pages, and internal review reports must be generated from a canonical product model.

4. Separate reference from offer.
   A shirt reference is the historical/visual product. An offer is how it is sold: stock, bajo pedido, fan, player, manga larga, with patches, with dorsal, etc.

5. Details matter.
   Close-up photos of logos, fabric, patches, tags, collar, and finishes are valuable and should not be deleted just because the first gallery images are cleaned.

6. No destructive bulk changes.
   New uploads should go to new paths or have explicit backups/mappings before replacing public assets.

7. Public catalog should scale by structure, not by endless scrolling.
   Search, filters, collections, and product pages must be designed for a large catalog from the start.

## 4. Approach Options

### Option A - Keep Improving Scripts Only

Use command-line scripts for imports, images, descriptions, and deploys.

Pros:
- Fastest to build.
- Fits the current repository.
- Low infrastructure cost.

Cons:
- Still depends on technical operation.
- Harder for the owner to review at scale.
- Risk of mistakes if commands are run in the wrong order.

### Option B - Build a Local HERENCIA90 Import Studio

Create a local review dashboard and supporting scripts. The owner imports supplier links or a CSV, reviews images and AI suggestions visually, then exports/uploads approved references.

Pros:
- Best balance of speed and control.
- Gives the owner independence.
- Keeps risky operations local until approved.
- Can reuse existing scripts.

Cons:
- Still not a full cloud admin.
- Requires local machine setup.

### Option C - Build a Full Cloud Admin Immediately

Create a production admin with auth, Supabase writes, AI generation, image processing, and publishing.

Pros:
- Most polished long-term experience.
- Accessible from anywhere.
- Better for multiple team members later.

Cons:
- More complex and risky now.
- Requires auth, permissions, audit logs, and payment/order safety sooner.
- Slower before it saves time.

### Recommended Approach

Choose Option B first. Build the foundation and a local Import Studio, then evolve toward a cloud admin after the catalog, media rules, and import workflow are proven.

## 5. Roadmap

### Phase 1 - Professional Catalog Foundation

Goal: define the canonical data model, taxonomy, media rules, review workflow, publish gates, and future ecommerce structure.

Outputs:
- Catalog data dictionary.
- Category and collection standards.
- Product reference vs offer model.
- Media role rules.
- Supplier import workflow.
- AI assistant boundaries.
- Add-ons and cart model prepared for future implementation.
- Acceptance criteria for Phase 2.

### Phase 2 - HERENCIA90 Import Studio V1

Goal: let the owner add new supplier references quickly and safely.

Capabilities:
- Import from provider URL or CSV.
- Download/extract candidate images.
- Generate local review board.
- AI proposes title, category, season, tags, description, and image roles.
- Owner approves front, back, details, rejected images.
- Run background removal only where needed.
- Generate local preview.
- Prepare Supabase upload/upsert dry-run.

### Phase 3 - Public Catalog UX for Scale

Goal: make the public store easy to browse with many references.

Capabilities:
- Search and filters.
- Collections by club, country, season, retro/current, player/fan, manga larga, stock/bajo pedido.
- Better product grid states.
- Better product pages.
- SEO landing pages generated from structured catalog data.

### Phase 4 - Cart and Add-ons

Goal: allow customers to configure a shirt before checkout.

Capabilities:
- Size selection.
- Version selection when applicable.
- Patches.
- Dorsal.
- Custom name.
- Quantity.
- Stock vs bajo pedido handling.
- Cart summary with add-on pricing.

### Phase 5 - Payments and Orders

Goal: turn the store into a direct checkout business.

Capabilities:
- Payment gateway.
- Full payment or deposit depending on product type.
- Order states.
- Customer contact data.
- Shipping data.
- Admin order dashboard.
- Payment reconciliation.

### Phase 6 - Operations, Analytics, and Growth

Goal: help HERENCIA90 operate like a serious ecommerce brand.

Capabilities:
- Product demand tracking.
- Supplier backlog.
- Search analytics.
- Conversion analytics.
- Best-selling teams and categories.
- Campaign exports for social media.
- AI suggestions for new references to add.

## 6. Canonical Concepts

### Product Reference

A product reference is the shirt identity independent of how it is sold.

Example:
- Inter de Milan 1997/1998 local retro
- Colombia 2024 local
- Real Madrid 2011/2012 local manga larga

Fields:
- `slug`
- `canonical_name`
- `team_name`
- `team_type`: `club`, `national_team`, `other`
- `country`
- `league`
- `season_label`
- `season_start_year`
- `season_end_year`
- `category_primary`: `retro`, `temporada_actual`, `seleccion`, `club`, `edicion_especial`
- `shirt_type`: `local`, `visitante`, `tercera`, `portero`, `entrenamiento`, `especial`
- `sleeve_type`: `corta`, `larga`, `sin_manga`, `unknown`
- `fit_type`: `fan`, `player`, `kids`, `women`, `unknown`
- `dominant_colors`
- `supplier_notes`
- `public_status`: `draft`, `review`, `published`, `hidden`, `archived`
- `created_at`
- `updated_at`

### Offer

An offer is the commercial way a reference is sold.

Examples:
- Stock immediate in size M.
- Bajo pedido with 15-day delivery.
- Player version with higher price.
- Bundle with patches.

Fields:
- `reference_slug`
- `offer_type`: `stock`, `bajo_pedido`, `pre_orden`
- `base_price`
- `cost`
- `margin_target`
- `lead_time_days`
- `available_sizes`
- `stock_by_size`
- `supplier_id`
- `supplier_url`
- `purchase_notes`
- `published`

### Add-on

An add-on is an optional customization or paid extra.

Examples:
- Champions League patch
- League patch
- Dorsal number
- Player name
- Custom name
- Gift packaging

Fields:
- `addon_id`
- `name`
- `type`: `patch`, `dorsal`, `name`, `bundle`, `service`
- `price`
- `cost`
- `compatible_categories`
- `compatible_teams`
- `compatible_seasons`
- `requires_text`
- `requires_number`
- `max_characters`
- `public_status`

### Media Asset

An image or video attached to a reference.

Fields:
- `reference_slug`
- `role`: `front`, `back`, `detail`, `logo`, `patch`, `collar`, `fabric`, `tag`, `size_chart`, `rejected`
- `url`
- `card_url`
- `master_url`
- `source_url`
- `storage_path`
- `sort_order`
- `background_removed`
- `is_curated`
- `needs_review`
- `rejection_reason`
- `created_at`

## 7. Taxonomy and Store Organization

### Primary Navigation

Recommended public navigation for a large catalog:

- Inicio
- Stock
- Bajo pedido
- Retro
- Temporada actual
- Selecciones
- Clubes
- Colombia
- Buscar

### Collection Types

Each product can belong to multiple collections, but every product must have one primary category.

Core collections:
- `retro`
- `temporada_actual`
- `clubes`
- `selecciones`
- `colombia`
- `real_madrid`
- `barcelona`
- `manga_larga`
- `player_version`
- `porteros`
- `ediciones_especiales`
- `bajo_pedido`
- `stock`

### Naming Standard

Recommended product title format:

`Camiseta {Equipo} {Temporada} {Tipo} {Version opcional}`

Examples:
- Camiseta Inter de Milan 1997/1998 Local Retro
- Camiseta Colombia 2024 Local
- Camiseta Real Madrid 2011/2012 Local Manga Larga

Public text can use Spanish accents and polished copy. Slugs and internal IDs should stay ASCII.

## 8. Media Rules

### Gallery Ordering

1. First image: curated front when available.
2. Second image: curated back only when confidently confirmed.
3. Additional images: original detail photos such as logo, collar, fabric, patches, tags, sponsor, and finishing details.
4. Do not repeat the original raw front/back if the curated version already exists.
5. Never include size charts, shipping tables, store banners, watermarked images, or supplier branding in product galleries.
6. Preserve rejected images in local reports, not public gallery.

### Background Removal Rules

Use background removal for:
- front full-shirt photos
- back full-shirt photos
- mannequin or hanger shots where the wall/background hurts the store aesthetic

Do not use background removal for:
- close-up logos
- fabric texture photos
- patches occupying most of the image
- tags
- detail photos where the background is part of the close-up context

### Quality Gates

Reject or review manually when:
- team/year/season does not match
- local/visitante/player/fan variant is unclear
- color is wrong
- shirt is cropped too aggressively
- watermark or store handle is visible
- image is too low-resolution
- detail photo belongs to a different shirt

## 9. Supplier Import Workflow

### Step 1 - Intake

Owner provides:
- provider URL
- expected team
- expected season/year
- expected type
- expected colors
- expected price/cost when known

Input formats:
- single URL
- batch CSV
- Google Sheet export
- manual form in future admin

### Step 2 - Candidate Extraction

Tool downloads:
- product images
- page metadata
- possible title
- possible price
- supplier URL

The extractor must not publish anything.

### Step 3 - AI Matching

AI proposes:
- product title
- slug
- team
- season
- category
- shirt type
- tags
- front/back/detail classification
- description
- SEO title and meta description
- risk notes

AI output must include confidence and reasons.

### Step 4 - Human Review

Owner approves:
- correct product identity
- accepted images
- rejected images
- image order
- price
- offer type
- description
- publish state

### Step 5 - Local Curation

Tool creates:
- transparent PNG cutouts for approved front/back images
- square WebP card images
- square WebP master images
- review sheet
- warning report

### Step 6 - Dry Run

Tool prints:
- rows to insert/update
- storage paths to upload
- fields that changed
- warnings
- preview URL

### Step 7 - Publish

Only after approval:
- upload images to new Supabase Storage paths
- upsert catalog rows
- regenerate local JSON/static pages
- test locally
- commit exact source/catalog files
- push and verify production

## 10. AI Assistant Boundaries

AI can:
- read supplier page text
- suggest product metadata
- classify images
- generate descriptions
- generate SEO copy
- detect likely mismatches
- propose categories and tags
- generate social copy after publication

AI cannot without owner approval:
- publish a product
- delete images
- overwrite Supabase assets
- change prices
- mark a product as stock
- charge a customer
- create a paid order

## 11. Public Store Requirements Prepared by Phase 1

The Phase 1 model must support later public features:

- product search
- collection pages
- filters
- stock vs bajo pedido labels
- SEO pages by team/season/category
- product gallery with front/back/details
- add-ons
- cart
- payments
- order status
- WhatsApp fallback

Phase 1 does not need to build these features, but it must define data fields so they are not blocked later.

## 12. Cart and Add-ons Future Model

Every purchasable cart line should eventually contain:

- `reference_slug`
- `offer_id`
- `size`
- `quantity`
- `base_price`
- selected add-ons
- custom name text
- custom number
- notes
- estimated delivery
- final line total

Add-on compatibility must be controlled so impossible combinations are not offered.

Examples:
- A Champions League patch may apply to club shirts only.
- A Colombia patch may apply to national team shirts only.
- A retro shirt may have different patch rules than a current-season shirt.
- Dorsal/name may require manual confirmation for some references.

## 13. Data Storage Direction

Recommended future Supabase structure:

- `catalog_references`
- `catalog_offers`
- `catalog_images`
- `catalog_collections`
- `catalog_reference_collections`
- `catalog_addons`
- `catalog_addon_rules`
- `provider_sources`
- `import_jobs`
- `import_job_images`
- `orders`
- `order_items`
- `order_item_addons`

Migration should be incremental. Existing tables and JSON files should remain compatible until the new model is ready.

## 14. Phase 1 Deliverables

Phase 1 is complete when HERENCIA90 has:

1. Approved catalog field dictionary.
2. Approved taxonomy and navigation rules.
3. Approved image role and gallery ordering rules.
4. Approved supplier import workflow.
5. Approved AI boundaries.
6. Draft Supabase schema direction.
7. Acceptance criteria for Import Studio V1.

## 15. Phase 1 Acceptance Criteria

The Phase 1 specification is accepted if it answers:

- What is a product reference?
- What is an offer?
- How are stock and bajo pedido separated?
- How are front, back, and details handled?
- What can AI do automatically?
- What requires owner approval?
- What fields are required before publishing?
- How will add-ons fit later?
- How will future payments and orders connect?
- What should Phase 2 build first?

## 16. Phase 2 Recommended First Build

Build HERENCIA90 Import Studio V1 as a local tool with a visual review dashboard.

Minimum V1 flow:

1. Input CSV or provider URL.
2. Extract candidate images.
3. Generate AI product suggestion.
4. Generate image review board.
5. Owner selects front, back, details, rejected.
6. Run local curation for front/back.
7. Generate preview JSON and static preview.
8. Create Supabase dry-run report.

V1 should not publish automatically. Publishing can be a separate approved step.

## 17. Risks and Mitigations

Risk: wrong supplier images are imported.
Mitigation: expected-reference fields, AI confidence, visual review, hard rejection gates.

Risk: catalog grows but becomes hard to browse.
Mitigation: strict taxonomy, collections, filters, and product naming rules.

Risk: AI creates inaccurate descriptions.
Mitigation: AI copy is draft-only until owner approval.

Risk: payments are added before operations are ready.
Mitigation: build cart and order model before payment gateway.

Risk: local tools become hard to use.
Mitigation: V1 should generate a visual dashboard, not only terminal reports.

Risk: old assets are overwritten.
Mitigation: upload new assets to new paths and keep backup mappings.

## 18. Recommended Immediate Next Step

After this document is reviewed, create an implementation plan for Phase 2: HERENCIA90 Import Studio V1.

That plan should define:
- exact input format
- local folders
- review dashboard layout
- AI prompt outputs
- Supabase dry-run format
- tests
- first sample batch
