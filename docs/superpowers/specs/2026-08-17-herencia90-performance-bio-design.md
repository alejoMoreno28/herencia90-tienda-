# HERENCIA90 Performance And TikTok Bio Design

**Status:** Approved for implementation on 2026-08-17.

## Outcome

Make the customer-facing HERENCIA90 site materially faster on mobile without changing its recognizable visual language or commercial flows, and add a first-party `/bio` landing page for TikTok with WhatsApp as the primary conversion action.

## Evidence Behind The Design

- The home and `/preventa` currently score 89-90 in mobile PageSpeed laboratory runs, with LCP around 2.8 seconds and no field/CrUX data.
- The highest-cost pages are generated stock product and city pages: they eagerly request full-resolution galleries, omit intrinsic image dimensions, and contain malformed absolute image URLs.
- The first interaction can add large third-party icon-font and Supabase bundles.
- `/preventa` renders its first product cards only after JavaScript downloads catalog JSON, which delays image discovery.
- Static asset URLs use long immutable caching but their query versions are not consistently updated when content changes.
- The reference Beacons page has a simple four-action structure, but its hero delays the first CTA and it introduces third-party branding and continuous motion.

## Performance Architecture

### Static HTML remains the source of first paint

The existing static HTML/CSS/JavaScript architecture stays in place. Product, city, category, and preorder pages continue to be generated from repository data. No framework migration and no new runtime dependency are introduced.

### Images

- Normalize local and absolute URLs before rendering. Absolute `https://` assets must never receive `../` or the HERENCIA90 origin as a prefix.
- Use the full-size image only for the product's primary gallery image and lightbox target.
- Use an existing `-card.webp` derivative for thumbnails, related products, and city/category cards when one exists; otherwise keep the original as a safe fallback.
- The primary LCP candidate is `loading="eager"` and `fetchpriority="high"`; non-primary images are `loading="lazy"` and `decoding="async"`.
- Emit width, height, or an explicit aspect ratio for every storefront image to reserve layout space.
- Replace the oversized `logo.webp` in small UI placements with `logo-ui.webp`; use `favicon.webp` for favicons.

### Data and third parties

- Generated pages display useful static data immediately. Supabase is an enhancement, never a parser-blocking requirement.
- Defer live refresh until idle or meaningful demand, select only required fields, and update only values that actually changed. Avoid rebuilding an unchanged gallery.
- Remove artificial analytics events such as `modal_open` on page load.
- Load catalog data and realtime only on routes that contain a real catalog grid.
- `/preventa` keeps the static JSON catalog as its primary source. A remote query is a fallback or deferred refresh only, and it must not request missing columns.
- Retain analytics, but schedule the analytics library outside the critical rendering path.
- Avoid the full Phosphor icon-font payload on the new `/bio` page; use inline SVG/CSS decoration there.

### Discovery and caching

- Remove duplicate or obsolete catalog preloads.
- Add resource hints only for origins used during first paint, especially Supabase Storage where relevant.
- Produce deterministic content-derived query versions for mutable CSS, JavaScript, and JSON assets that are served with `immutable` caching.
- Keep HTML and catalog JSON revalidatable so inventory and content can update promptly.

## `/bio` Design Direction

### Direction summary

- **Aesthetic name:** The Golden Match Ticket.
- **Concept:** A compact digital match ticket/passport into HERENCIA90's football archive: dark stadium-night canvas, gold print details, a large cropped `90` watermark, and precise editorial typography.
- **Emotional target:** Trustworthy, exclusive, quick, and unmistakably football-first within the first three seconds.
- **Memorable anchor:** A CSS-only perforated golden ticket header with the HERENCIA90 mark and oversized `90`, avoiding a heavy hero photo or video.

### DFII

| Dimension | Score | Reason |
| --- | ---: | --- |
| Aesthetic impact | 4 | The match-ticket anchor is distinctive without becoming theatrical. |
| Context fit | 5 | Football heritage, dark/gold branding, and commerce are directly connected. |
| Implementation feasibility | 4 | Static HTML and CSS with existing small brand assets. |
| Performance safety | 4 | No framework, video, carousel, icon font, or required JavaScript. |
| Consistency risk | 3 | It uses existing colors and type hierarchy; the ticket motif must remain isolated to `/bio`. |

`DFII = (4 + 5 + 4 + 4) - 3 = 14`; this is an excellent direction. The implementation must remain restrained so the motif does not spread into unrelated storefront pages.

### Design system snapshot

- Display type: Oswald, with a metrically safe condensed fallback.
- Body type: Montserrat, with a system fallback. Remote fonts are non-blocking and the layout remains stable without them.
- Core colors: near-black `#101012`, warm paper `#F5F0E6`, HERENCIA90 gold `#85692F`, brighter interactive gold, and restrained muted gray.
- Spacing rhythm: 8 px base; 16/24/32 px structural steps.
- Shape language: squared editorial panels with small clipped/perforated ticket details; no generic pill-button stack.
- Motion: one short entrance transition honoring `prefers-reduced-motion`; no looping pulse, shake, marquee, or parallax.

### Content hierarchy

1. HERENCIA90 logo and value proposition.
2. Primary WhatsApp CTA with a prefilled TikTok-origin message.
3. In-stock catalog CTA.
4. Under-order/preorder CTA.
5. Mundial 2026 discovery CTA.
6. Compact trust strip: payment on delivery, nationwide shipping, quality review.
7. Small Instagram, TikTok, and FAQ links.

Only the four commercial actions receive full-width treatment. WhatsApp appears in the first viewport at 390 x 844 and is the strongest action.

### Tracking

- Internal destinations include `utm_source=tiktok&utm_medium=social&utm_campaign=bio` plus a distinct `utm_content` per CTA.
- WhatsApp uses a prefilled Spanish message identifying TikTok as the origin.
- Link labels remain understandable without icons, and analytics must not block navigation.

## Accessibility And Safety

- Semantic landmarks, one visible `h1`, descriptive link names, keyboard focus states, minimum 44 px targets, and Spanish `lang` metadata.
- Text and controls meet WCAG AA contrast.
- The page works with JavaScript disabled.
- Respect reduced motion and high-contrast preferences.
- Preserve all current stock, cart, WhatsApp, preorder, navigation, and SEO behavior.
- Do not upload, overwrite, or delete Supabase images or data as part of this work.

## Verification Contract

- Existing repository tests stay green.
- New tests first fail against the current implementation, then cover URL normalization, image loading/dimensions, lightweight logos, deferred third parties, deterministic asset versions, and `/bio` semantics/links.
- `node --check` passes for every changed JavaScript generator/runtime file.
- Generated output contains zero `../https://` and zero doubled HERENCIA90 origin URLs.
- Mobile browser tests at 390 x 844 cover home, catalog, preorder, one stock product, one city page, and `/bio` with console/network error capture.
- Target budgets under the agreed simulated mobile profile:
  - `/bio`: no horizontal overflow, no console errors, initial transfer under 200 KiB excluding cached third-party fonts, and LCP under 2.5 seconds.
  - Representative stock product and city pages: initial image transfer under 1 MiB, CLS under 0.1, and LCP under 2.5 seconds where network variability permits.
- Production is deployed only after tests, visual checks, Git diff review, and a successful preview/production smoke test.
