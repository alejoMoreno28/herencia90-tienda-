# HERENCIA90 Import Studio V1

Import Studio V1 is a local-first tool for preparing new `bajo pedido` / preorder references before publishing.

It does not upload to Supabase, does not edit the live catalog, and does not publish products. It creates review and dry-run files so the owner can approve references first.

For the full local UI app, use `docs/import-studio-local-app.md` and start it with:

```powershell
npm run import-studio:app
```

## Input CSV

Create a CSV with these columns:

```csv
url,equipo,temporada,tipo,precio,colores,notas,imagenes
https://supplier.example/inter,Inter de Milan,1997/1998,Local Retro,120000,"azul, negro","Umbro, Pirelli",https://img.example/front.webp;https://img.example/detail.webp
```

Useful columns:

- `url`: supplier product/page URL.
- `equipo`: team or country.
- `temporada`: year or season.
- `tipo`: local, visitante, tercera, portero, player, manga larga, retro.
- `precio`: public price in COP.
- `colores`: expected colors, separated by comma.
- `notas`: details to help review.
- `imagenes`: optional direct image URLs, separated by semicolon.

If `imagenes` is empty, the tool tries to extract image URLs from `url`.

## Prepare a Job

```powershell
npm run import-studio -- prepare --input .codex_tmp\new-references.csv --job-id batch-001
```

This creates:

```text
.codex_tmp/import-studio/jobs/batch-001/job.json
.codex_tmp/import-studio/jobs/batch-001/review/index.html
.codex_tmp/import-studio/jobs/batch-001/approval-manifest.example.json
```

Open the review dashboard:

```text
.codex_tmp/import-studio/jobs/batch-001/review/index.html
```

## Review Images

In the dashboard, assign each candidate image:

- `Frente`
- `Espalda`
- `Detalle`
- `Rechazar`

Download or copy the generated `approval-manifest.json` into:

```text
.codex_tmp/import-studio/jobs/batch-001/approval-manifest.json
```

## Generate Supabase Dry Run

```powershell
npm run import-studio -- dry-run --job-id batch-001
```

Output:

```text
.codex_tmp/import-studio/jobs/batch-001/dry-run/supabase-dry-run.json
```

The dry-run lists:

- planned storage uploads
- planned catalog upserts
- warnings
- references that are not publish-ready

## Safety Rules

- Do not stage `.codex_tmp`.
- Do not upload images before visual approval.
- Do not publish rows with `publicado: true` from V1.
- Do not include size charts, watermarks, store handles, shipping tables, or wrong variants.
- Front image is required.
- Back image is optional but only one is allowed.

## Tests

```powershell
node --test tests\import-studio-intake.test.mjs tests\import-studio-dashboard.test.mjs tests\import-studio-manifest.test.mjs tests\import-studio-dry-run.test.mjs tests\import-studio-cli.test.mjs
```
