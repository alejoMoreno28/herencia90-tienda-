---
name: provider-photo-matcher
description: Use when importing or replacing supplier jersey photos for preventa/catalog items from Yupoo, SportShirts, Shopee, Tienda Nube, or other provider pages. The skill audits product name, team, season/year, color, variant, type, and image content before any download/import, rejects mismatches and size charts/watermarks/store-branded images, and produces a dry-run match report before Supabase or main changes.
---

# Provider Photo Matcher

This skill is mandatory before changing `preventa_catalogo` images or creating new preventa jersey references from provider pages.

The core rule: **audit first, import later**. Do not upload to Supabase, commit, or push until the match report is reviewed.

## Workflow

1. Define the expected reference before looking at images:
   - `slug`
   - team/country
   - year or season
   - local/visitante/tercera/player/retro
   - expected colors
   - forbidden colors
   - notes such as collar, crest color, sponsor, sleeve length, or special edition

2. Extract candidate images from provider pages with `scripts/extract-provider-candidates.mjs`.

3. Review every candidate image visually. Reject any image that fails one hard gate.

4. Produce a dry-run report with accepted and rejected images. Include evidence for each decision.

5. Ask for explicit approval before:
   - deleting or hiding existing rows
   - uploading images to Supabase Storage
   - upserting rows in `preventa_catalogo`
   - committing or pushing to `main`

## Hard Rejection Gates

Reject the whole candidate set or the individual image if any of these are true:

- The year/season does not match the reference.
- The color does not match the reference.
- The variant does not match: local vs visitante vs player vs retro.
- The shirt is a different edition even if the team is correct.
- The image is a size guide, shipping chart, table, banner, or store promo.
- The image includes a visible store handle, watermark, URL, phone number, or another page name.
- The image is an official brand render/mockup instead of a supplier-style product photo.
- The photo is too low-quality to identify the shirt.
- The photo shows a different product mixed into the gallery.

If a gallery has 4 good shirt photos and 1 size chart, keep the 4 good photos and reject the size chart.

## Accepted Image Style

Prefer:

- shirt hanging on a hanger
- shirt on mannequin
- mesh/grid background
- plain supplier wall/background
- Chinese provider catalog style
- real close-up details of crest, collar, fabric, tags

Do not prefer:

- official Adidas/Nike/Umbro product render
- polished ecommerce mockup
- editorial/player photo
- screenshots from Google Images
- size tables or store-branded graphics

## Match Report Format

Before importing, return a report like:

```markdown
Reference: colombia-2024-local-player
Expected: Colombia, 2024, player version, local, yellow
Source: https://example.com/product
Decision: APPROVE / REJECT / NEEDS USER REVIEW

Accepted images:
- image-01.webp: front, yellow, Colombia crest, player cut, matches.
- image-02.webp: back/detail, no watermark, matches.

Rejected images:
- image-05.webp: size chart with store handle.
- image-06.webp: black away shirt, wrong variant.

Risks:
- Collar detail not fully visible.

Next action:
- Await user approval before upload.
```

## Using The Extractor

Create a config JSON:

```json
{
  "outDir": ".tmp-provider-photo-audit",
  "references": [
    {
      "slug": "colombia-2024-local-player",
      "expected": {
        "team": "Colombia",
        "season": "2024",
        "variant": "local player",
        "colors": ["yellow"],
        "forbidden": ["black", "blue"],
        "notes": ["Adidas", "player version"]
      },
      "sourcePages": [
        "https://www.sportshirts.co/productos/colombia-2024-2025-local-player-version-gtryz/"
      ]
    }
  ]
}
```

Run:

```powershell
node .agents/skills/provider-photo-matcher/scripts/extract-provider-candidates.mjs --config .tmp-provider-photo-audit/config.json
```

Then inspect:

- generated images under `.tmp-provider-photo-audit/<slug>/`
- `manifest.json`
- `match-report-template.md`

## Supabase Import Rules

Only after approval:

- Upload accepted images only.
- Preserve previous images in a backup manifest before overwriting.
- Use one slug per actual jersey reference.
- Do not include size charts in `imagenes`.
- Do not use `yupoo_origen` for non-Yupoo sources; use the actual source URL even if the column name is legacy.
- Re-query Supabase after import and verify `slug`, `equipo`, `temporada`, `tipo`, `categoria`, `publicado`, and image count.
- Generate a preview and inspect the lightbox before pushing.

## Production Safety

Never push to `main` in the same step as a bulk image import. First:

1. Produce the match report.
2. Get approval.
3. Import to Supabase.
4. Verify preview visually.
5. Run tests.
6. Commit tooling/reference changes.
7. Push only after the user approves the preview.
