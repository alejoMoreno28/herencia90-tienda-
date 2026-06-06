# Pedidos y Clientes Lote Flow Design

**Goal:** Make the admin lot import flow fast, clear, and resistant to duplicate references while supporting supplier links, manual photos, stock/preventa destinations, automatic names, descriptions, and editable pricing.

## Scope

This first version improves the `Ingresar Nuevo Lote` workflow in `web/admin.html` without changing the Supabase schema. It keeps the Excel paste format fixed: columns from `SIZE` through `DESTINO`, in the same order used for supplier orders.

The CRM edit overhaul and existing duplicate cleanup remain later work. This version must avoid creating new duplicate products and make new product creation safer.

## Rules

- A pasted row becomes one lot item with size, type, raw description, extras text, extra USD, quantity, unit cost, subtotal, destination, suggested customer price, name, description, category, and candidate matches.
- FAN costs usually map to 11 USD and $99.000.
- PLAYER costs usually map to 14 USD and $110.000.
- RETRO costs usually map to 15 USD and $130.000.
- Supplier extra USD is treated as the strongest clue for customization:
  - 3 USD: dorsal/personalizacion.
  - 4 USD: dorsal/personalizacion plus one patch.
  - 5+ USD: dorsal/personalizacion plus multiple patches.
- Text mentioning `PATCH` or `PARCHE` adds a patch label.
- Text mentioning `MANGA LARGA` marks the row as manga larga and suggests +$10.000 to the customer price.
- Suggested prices are editable before saving.
- New references get a generated clean name and a short sellable description even if the external AI endpoint fails.
- Photos for new references can come from provider links or manual multi-file upload.
- New references cannot be saved without approved photos.
- If a row has possible existing catalog matches, the system must require a user decision: choose an existing reference or explicitly create a new one.
- `STOCK` updates physical inventory.
- `PREVENTA` creates CRM pedidos. Empty clients stay as `Pendiente por Asignar`.

## UX

The preview table should show the item status near each row:

- `En catalogo`: matched to an existing product.
- `Posible duplicado`: candidate matches exist and no choice has been made.
- `Nueva referencia`: no strong match exists.
- `Crear nueva confirmado`: user intentionally bypassed candidates.
- `Fotos pendientes` or `Fotos aprobadas`: for references that need photo review.

Candidate matches should appear as compact action buttons under the product search input. The row should also provide a `Crear nueva` action when the candidate is not correct.

## Implementation Shape

Create a focused helper at `web/js/admin-lote-workflow.js` for deterministic parsing, naming, pricing, category inference, candidate matching, and unresolved-duplicate validation. Keep DOM rendering and Supabase persistence inside `web/admin.html`.

Add tests in `scripts/admin-lote-workflow.test.mjs` and keep existing photo-review tests.

## Verification

Run:

- `node --test scripts/admin-lote-workflow.test.mjs`
- `node --test scripts/admin-lote-photo-review.test.mjs`
- `node --test scripts/admin-inventory-guard.test.mjs`

Then smoke-test the admin import UI locally if a dev/static server can run.
