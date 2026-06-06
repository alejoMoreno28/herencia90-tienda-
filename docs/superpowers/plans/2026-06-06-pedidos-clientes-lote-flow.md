# Pedidos y Clientes Lote Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the admin lot import flow so new lots are parsed, priced, matched, photo-approved, and saved with fewer manual mistakes and no accidental duplicate references.

**Architecture:** Put deterministic lot parsing/matching rules in `web/js/admin-lote-workflow.js`, then call those helpers from `web/admin.html`. Keep Supabase writes in the existing admin page and protect the existing manual photo upload work.

**Tech Stack:** Plain HTML/JavaScript, Supabase browser client, Node test runner with VM-loaded browser helpers.

---

### Task 1: Workflow Helper

**Files:**
- Create: `web/js/admin-lote-workflow.js`
- Create: `scripts/admin-lote-workflow.test.mjs`

- [ ] Write failing tests for Excel row parsing, generated names/descriptions, extra-price suggestions, Manchester United year matching, and unresolved duplicate detection.
- [ ] Implement `window.AdminLoteWorkflow` with pure functions for parsing, pricing, naming, category inference, candidate matching, and duplicate validation.
- [ ] Run `node --test scripts/admin-lote-workflow.test.mjs`.

### Task 2: Admin Wiring

**Files:**
- Modify: `web/admin.html`

- [ ] Load `js/admin-lote-workflow.js` before the inline admin script.
- [ ] Replace inline lot row parsing with `AdminLoteWorkflow.buildLoteItemFromColumns`.
- [ ] Show generated descriptions, extras, manga, and candidate actions in the preview table.
- [ ] Add `seleccionarCandidatoLote` and `confirmarNuevaReferenciaLote` actions.
- [ ] Block full or partial save when unresolved candidate duplicates exist.

### Task 3: Catalog Product Creation

**Files:**
- Modify: `web/js/admin-lote-photo-review.js`
- Modify: `scripts/admin-lote-photo-review.test.mjs`

- [ ] Make product creation prefer the generated `nombre_oficial`, `descripcion`, `categoria`, `precioVenta`, `costUsd`, and approved images.
- [ ] Keep extra metadata out of the `productos` insert payload unless the existing table already supports it.
- [ ] Run the photo-review tests.

### Task 4: Verification

**Files:**
- Modify only if tests expose bugs.

- [ ] Run `node --test scripts/admin-lote-workflow.test.mjs`.
- [ ] Run `node --test scripts/admin-lote-photo-review.test.mjs`.
- [ ] Run `node --test scripts/admin-inventory-guard.test.mjs`.
- [ ] Start a local server and smoke-test `web/admin.html` import UI where possible.
- [ ] Stage exact source/test/docs files only.
- [ ] Commit and push after verification.
