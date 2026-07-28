# HERENCIA90 Partner Profit Cuts and Withdrawals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-ready 50/50 partner ledger to the HERENCIA90 finance admin, reserving card debt before profit cuts and supporting cash and shirt withdrawals without changing realized profit.

**Architecture:** Keep `transacciones` as the source for business operations and add focused Supabase tables for partners, approved profit cuts, and partner movements. A pure browser module computes balances and distribution availability; authenticated SQL RPC functions enforce cut, cash, stock, and reversal rules atomically. The existing static `web/admin.html` loads the new data and renders a dedicated partner panel.

**Tech Stack:** Static HTML/CSS/JavaScript, Supabase Postgres/PostgREST/Auth, Node.js built-in test runner, Vercel static hosting.

---

## File Map

- Create `web/js/admin-partner-finance.js`: pure partner calculations and formatting-safe numeric normalization.
- Create `scripts/admin-partner-finance.test.mjs`: unit tests for debt reservation, 50/50 cuts, withdrawals, reversals, and rounding.
- Create `docs/supabase/migrations/20260728_socios_ganancias.sql`: tables, indexes, RLS policies, seed partners, and authenticated RPC functions.
- Create `scripts/admin-partner-schema.test.mjs`: static migration contract tests for required tables, constraints, policies, and RPCs.
- Modify `web/js/admin-finance-metrics.js`: include partner cash withdrawals in physical cash and monthly cash-out metrics without changing profit.
- Modify `scripts/admin-finance-metrics.test.mjs`: regression tests for partner cash and product withdrawals.
- Modify `web/admin.html`: load partner data, render cards and history, open forms, call RPCs, refresh inventory, and export partner history.
- Create `scripts/admin-partner-ui.test.mjs`: verify required UI hooks, script loading, labels, and absence of the old ambiguous preset.
- Create `docs/ADMIN-SOCIOS-GANANCIAS.md`: short operating guide for creating cuts, withdrawing money, taking shirts, and reversing mistakes.

## Task 1: Pure Partner-Finance Engine

**Files:**

- Create: `scripts/admin-partner-finance.test.mjs`
- Create: `web/js/admin-partner-finance.js`

- [ ] **Step 1: Write failing calculation tests**

Cover these exact cases:

```js
test('reserves card debt before offering a new cut', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 5613000,
    creditCardDebt: 2521689,
    cuts: [],
    movements: [],
    partners: twoPartners()
  });

  assert.equal(result.distributionBasis, 3091311);
  assert.equal(result.newCutAvailable, 3091311);
  assert.equal(result.suggestedEvenCut, 3091310);
});

test('does not offer an already approved surplus twice', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 5613000,
    creditCardDebt: 2521689,
    cuts: [{ id: 10, estado: 'activo', monto_aprobado: 3091310 }],
    movements: [],
    partners: twoPartners()
  });

  assert.equal(result.newCutAvailable, 1);
  assert.equal(result.suggestedEvenCut, 0);
});

test('cash and product withdrawals reduce only the selected partner balance', async () => {
  const PartnerFinance = await loadPartnerFinance();
  const result = PartnerFinance.computePartnerFinance({
    operationalCash: 5613000,
    creditCardDebt: 2521689,
    cuts: [{
      id: 10,
      estado: 'activo',
      monto_aprobado: 3091310,
      monto_socio_1: 1545655,
      monto_socio_2: 1545655
    }],
    movements: [
      { socio_id: 1, tipo: 'retiro_producto', valor_participacion_cop: 50000, efecto_caja_cop: 0 },
      { socio_id: 2, tipo: 'retiro_efectivo', valor_participacion_cop: 500000, efecto_caja_cop: 500000 }
    ],
    partners: twoPartners()
  });

  assert.equal(result.currentPhysicalCash, 5113000);
  assert.equal(result.partnerBalances[1].balance, 1495655);
  assert.equal(result.partnerBalances[2].balance, 1045655);
});
```

- [ ] **Step 2: Run the new tests and confirm RED**

Run:

```powershell
node --test scripts/admin-partner-finance.test.mjs
```

Expected: failure because `web/js/admin-partner-finance.js` does not exist.

- [ ] **Step 3: Implement the pure module**

Expose:

```js
window.AdminPartnerFinance = {
  computePartnerFinance,
  activeCuts,
  netPartnerMovements,
  suggestedEvenAmount
};
```

`computePartnerFinance` must return:

```js
{
  operationalCash,
  netCashWithdrawals,
  currentPhysicalCash,
  cashBeforePartnerWithdrawals,
  creditCardDebt,
  distributionBasis,
  approvedCutsTotal,
  newCutAvailable,
  suggestedEvenCut,
  partnerBalances
}
```

Use finite-number normalization, ignore annulled cuts, and treat reversals through signed values saved by the database.

- [ ] **Step 4: Run tests and confirm GREEN**

Run:

```powershell
node --test scripts/admin-partner-finance.test.mjs
node --check web/js/admin-partner-finance.js
```

Expected: all partner tests pass and syntax check exits zero.

- [ ] **Step 5: Commit exact files**

```powershell
git add -- scripts/admin-partner-finance.test.mjs web/js/admin-partner-finance.js
git commit -m "feat: add partner finance calculations"
```

## Task 2: Supabase Schema and Atomic RPC Contract

**Files:**

- Create: `docs/supabase/migrations/20260728_socios_ganancias.sql`
- Create: `scripts/admin-partner-schema.test.mjs`

- [ ] **Step 1: Write failing migration-contract tests**

The test must load the SQL as text and assert:

```js
for (const table of ['socios', 'cortes_ganancias', 'movimientos_socios']) {
  assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
}

for (const fn of [
  'crear_corte_ganancias',
  'registrar_retiro_efectivo_socio',
  'registrar_retiro_producto_socio',
  'revertir_movimiento_socio',
  'vincular_retiro_producto_historico',
  'actualizar_nombre_socio',
  'actualizar_revision_tributaria_movimiento'
]) {
  assert.match(sql, new RegExp(`create or replace function public\\.${fn}`, 'i'));
}
```

Also assert that anonymous/public execution is revoked and authenticated execution is granted for every RPC.

- [ ] **Step 2: Run schema tests and confirm RED**

Run:

```powershell
node --test scripts/admin-partner-schema.test.mjs
```

Expected: failure because the migration file does not exist.

- [ ] **Step 3: Write the idempotent migration**

The SQL must:

1. Create `socios`, `cortes_ganancias`, and `movimientos_socios`.
2. Seed partner IDs 1 and 2 with editable names and `50.00`.
3. Add check constraints from the approved design.
4. Add a unique partial index on active `movimiento_revertido_id`.
5. Add a unique partial index on non-null `transaccion_origen_id`.
6. Enable RLS and create authenticated-only policies.
7. Create `security definer` RPCs with `set search_path = public`.
8. Recalculate balances and stock inside the transaction before inserts.
9. Use existing `productos.tallas` JSONB and `productos.costo_usd`.
10. Revoke public/anon execution and grant authenticated execution.

The cut function must calculate:

```sql
v_caja_operativa := ingresos - salidas_operativas;
v_retiros_efectivo := retiros_efectivo_activos - reversiones_efectivo;
v_caja_fisica := v_caja_operativa - v_retiros_efectivo;
v_base := greatest(0, v_caja_fisica + v_retiros_efectivo - greatest(0, v_deuda));
v_disponible := greatest(0, v_base - v_cortes_aprobados);
```

The product-withdrawal function must:

```sql
v_unit_cost_cop := round(v_product.costo_usd * p_trm_snapshot);
v_total_cost_cop := v_unit_cost_cop * p_cantidad;
```

Then validate partner balance and stock before updating the selected JSONB size and inserting the ledger row.

- [ ] **Step 4: Run migration-contract tests and confirm GREEN**

Run:

```powershell
node --test scripts/admin-partner-schema.test.mjs
```

Expected: all migration contract assertions pass.

- [ ] **Step 5: Commit exact files**

```powershell
git add -- docs/supabase/migrations/20260728_socios_ganancias.sql scripts/admin-partner-schema.test.mjs
git commit -m "feat: define partner ledger database"
```

## Task 3: Integrate Partner Cash into Existing Finance Metrics

**Files:**

- Modify: `scripts/admin-finance-metrics.test.mjs`
- Modify: `web/js/admin-finance-metrics.js`

- [ ] **Step 1: Add failing regression tests**

Call:

```js
computeFinanceMetrics(transactions, {
  globalTrm: 4000,
  partnerMovements: [
    { tipo: 'retiro_efectivo', fecha: '2026-05-04', efecto_caja_cop: 25000 },
    { tipo: 'retiro_producto', fecha: '2026-05-04', efecto_caja_cop: 0 }
  ]
});
```

Assert:

```js
assert.equal(metrics.partnerCashWithdrawals, 25000);
assert.equal(metrics.cashAvailableBeforePartnerWithdrawals, 100000);
assert.equal(metrics.cashAvailable, 75000);
assert.equal(metrics.profitExpenses, 20000);
assert.equal(metrics.netProfitRealized, 40000);
assert.deepEqual(Array.from(metrics.monthly.cashOut), [45000]);
```

- [ ] **Step 2: Run the finance tests and confirm RED**

```powershell
node --test scripts/admin-finance-metrics.test.mjs
```

Expected: the partner cash fields are missing.

- [ ] **Step 3: Extend the finance engine**

Add `partnerMovements` option, filter movements by selected period, total `efecto_caja_cop`, and include that amount only in:

- `partnerCashWithdrawals`;
- `cashOutTotal`;
- `cashAvailable`;
- monthly `cashOut`.

Do not add it to:

- `profitExpenses`;
- `inventoryPurchases`;
- `cogs`;
- `netProfitRealized`.

- [ ] **Step 4: Run finance and partner tests**

```powershell
node --test scripts/admin-finance-metrics.test.mjs scripts/admin-partner-finance.test.mjs
node --check web/js/admin-finance-metrics.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit exact files**

```powershell
git add -- scripts/admin-finance-metrics.test.mjs web/js/admin-finance-metrics.js
git commit -m "feat: separate partner withdrawals from profit"
```

## Task 4: Add the Partner Dashboard and Read-Only Data Flow

**Files:**

- Modify: `web/admin.html`
- Create: `scripts/admin-partner-ui.test.mjs`

- [ ] **Step 1: Write failing static UI tests**

Assert that `web/admin.html`:

- loads `js/admin-partner-finance.js`;
- contains `id="partner-finance-panel"`;
- contains `id="partner-new-cut-available"`;
- contains `id="partner-card-1"` and `id="partner-card-2"`;
- contains `id="partner-history-body"`;
- contains the three action labels;
- no longer contains `onclick="setMovementPreset('retiro')"`.

- [ ] **Step 2: Run UI tests and confirm RED**

```powershell
node --test scripts/admin-partner-ui.test.mjs
```

Expected: required hooks are absent.

- [ ] **Step 3: Add script, CSS, markup, and state**

Add:

```html
<script src="js/admin-partner-finance.js?v=20260728"></script>
```

Add state:

```js
let partnerData = {
  partners: [],
  cuts: [],
  movements: []
};
```

Load the three tables in `init()` alongside products and transactions. A missing-table error must show the migration-required state inside the partner panel without breaking the existing admin.

Add `renderPartnerFinance(metrics)` and call it from `renderFinance()`.

Add a compact authenticated edit action for each seeded partner name. Save through:

```js
await db.rpc('actualizar_nombre_socio', {
  p_socio_id: partnerId,
  p_nombre: name
});
```

- [ ] **Step 4: Add cards and history**

Render:

- available for new cut;
- reserved card debt;
- approved total;
- physical cash;
- one card per partner;
- history with reversal/tax status.

Use compact responsive cards matching the existing black, gold, green, and red admin system.

- [ ] **Step 5: Run UI, finance, and syntax checks**

```powershell
node --test scripts/admin-partner-ui.test.mjs scripts/admin-finance-metrics.test.mjs scripts/admin-partner-finance.test.mjs
node --check web/js/admin-partner-finance.js
```

Extract the inline admin script in the test and compile it with `vm.Script` so broken JavaScript fails the UI test.

- [ ] **Step 6: Commit exact files**

```powershell
git add -- web/admin.html scripts/admin-partner-ui.test.mjs
git commit -m "feat: show partner profit dashboard"
```

## Task 5: Implement Cuts, Cash Withdrawals, and Product Withdrawals

**Files:**

- Modify: `web/admin.html`
- Modify: `scripts/admin-partner-ui.test.mjs`

- [ ] **Step 1: Extend failing UI contract tests**

Assert the presence of:

```text
openPartnerCutModal
submitPartnerCut
openPartnerCashModal
submitPartnerCashWithdrawal
openPartnerProductModal
submitPartnerProductWithdrawal
refreshPartnerData
```

Also assert the exact customer-facing warnings from the design.

- [ ] **Step 2: Run tests and confirm RED**

```powershell
node --test scripts/admin-partner-ui.test.mjs
```

- [ ] **Step 3: Implement cut creation**

Call:

```js
await db.rpc('crear_corte_ganancias', {
  p_monto_aprobado: amount,
  p_fecha: date,
  p_nota: note
});
```

Preview exact 50/50 values before submission. Refresh all finance and partner data after success.

- [ ] **Step 4: Implement cash withdrawal**

Call:

```js
await db.rpc('registrar_retiro_efectivo_socio', {
  p_corte_id: cutId,
  p_socio_id: partnerId,
  p_monto: amount,
  p_fecha: date,
  p_nota: note
});
```

Show balance and physical cash before and after. Never insert a normal `gasto`.

- [ ] **Step 5: Implement product withdrawal**

Populate product and size from `productData`, show stock, cost USD, TRM, internal COP cost, public price, and remaining balance.

Call:

```js
await db.rpc('registrar_retiro_producto_socio', {
  p_corte_id: cutId,
  p_socio_id: partnerId,
  p_producto_id: productId,
  p_talla: size,
  p_cantidad: quantity,
  p_trm_snapshot: GLOBAL_TRM,
  p_fecha: date,
  p_nota: note
});
```

Do not change local stock before the RPC succeeds. Reload products after success.

- [ ] **Step 6: Verify and commit**

```powershell
node --test scripts/admin-partner-ui.test.mjs scripts/admin-partner-finance.test.mjs scripts/admin-finance-metrics.test.mjs scripts/admin-inventory-guard.test.mjs
git diff --check
git add -- web/admin.html scripts/admin-partner-ui.test.mjs
git commit -m "feat: register partner profit withdrawals"
```

## Task 6: Reversals, Historical Linking, Export, and Operating Guide

**Files:**

- Modify: `web/admin.html`
- Modify: `scripts/admin-partner-ui.test.mjs`
- Create: `docs/ADMIN-SOCIOS-GANANCIAS.md`

- [ ] **Step 1: Add failing UI tests**

Require:

```text
reversePartnerMovement
linkHistoricalPartnerWithdrawal
exportPartnerHistory
Requiere asignar socio
updatePartnerTaxReview
```

- [ ] **Step 2: Implement reversals**

Call:

```js
await db.rpc('revertir_movimiento_socio', {
  p_movimiento_id: movementId,
  p_fecha: new Date().toISOString().slice(0, 10),
  p_nota: reason
});
```

Require a non-empty reason and confirmation. Reload products when the reversed movement is a product withdrawal.

- [ ] **Step 3: Implement historical linking**

List existing `transacciones` whose normalized category includes `retiro personal` and whose ID is not already linked. Require an active cut with enough partner balance.

Call:

```js
await db.rpc('vincular_retiro_producto_historico', {
  p_transaccion_id: transactionId,
  p_corte_id: cutId,
  p_socio_id: partnerId,
  p_valor_participacion_cop: storedCostUsd * storedTrm,
  p_nota: note
});
```

This RPC must not change stock.

- [ ] **Step 4: Implement tax-review updates**

Allow an authenticated admin to change a product withdrawal from `pendiente` to `revisado` or `no_aplica` through:

```js
await db.rpc('actualizar_revision_tributaria_movimiento', {
  p_movimiento_id: movementId,
  p_estado: status
});
```

Cash withdrawals and reversals must reject this operation.

- [ ] **Step 5: Implement CSV export and guide**

CSV columns:

```text
fecha,socio,corte,tipo,producto,talla,cantidad,valor_participacion_cop,
efecto_caja_cop,costo_unitario_usd,trm_snapshot,valor_comercial_unitario_cop,
revision_tributaria,estado,nota
```

The guide must explain the three actions, reversal behavior, and `revision_tributaria`.

- [ ] **Step 6: Verify and commit**

```powershell
node --test scripts/admin-partner-ui.test.mjs scripts/admin-partner-schema.test.mjs
git diff --check
git add -- web/admin.html scripts/admin-partner-ui.test.mjs docs/ADMIN-SOCIOS-GANANCIAS.md
git commit -m "feat: audit partner withdrawal history"
```

## Task 7: Full Local Verification

**Files:**

- No production file changes unless a test exposes a defect.

- [ ] **Step 1: Run all repository test files**

```powershell
$tests = rg --files scripts -g '*.test.mjs'
node --test $tests
```

Expected: zero failures.

- [ ] **Step 2: Run syntax and diff checks**

```powershell
node --check web/js/admin-finance-metrics.js
node --check web/js/admin-partner-finance.js
git diff --check
git status --short
```

- [ ] **Step 3: Run a local browser smoke test**

Start a static server and verify:

- login redirect still works;
- authenticated admin loads;
- partner panel shows migration-required state before the DB migration;
- no console syntax errors;
- mobile width does not overflow.

- [ ] **Step 4: Review exact change scope**

Expected source scope:

```text
docs/ADMIN-SOCIOS-GANANCIAS.md
docs/supabase/migrations/20260728_socios_ganancias.sql
scripts/admin-finance-metrics.test.mjs
scripts/admin-partner-finance.test.mjs
scripts/admin-partner-schema.test.mjs
scripts/admin-partner-ui.test.mjs
web/admin.html
web/js/admin-finance-metrics.js
web/js/admin-partner-finance.js
```

Do not stage `.codex_tmp`, media, caches, or worktree folders.

## Task 8: Production Migration, Publication, and Verification

**Files:**

- Use the committed migration and source files only.

- [ ] **Step 1: Inspect production immediately before migration**

Confirm existing tables and columns through a read-only schema request. Confirm that `socios`, `cortes_ganancias`, and `movimientos_socios` do not already exist.

- [ ] **Step 2: Apply the idempotent SQL migration**

Use an authenticated Supabase dashboard/CLI session. Do not paste or log service-role keys. Apply only:

```text
docs/supabase/migrations/20260728_socios_ganancias.sql
```

- [ ] **Step 3: Verify the live schema and seed rows**

Read-only checks:

```sql
select id, nombre, porcentaje, activo from public.socios order by id;
select count(*) from public.cortes_ganancias;
select count(*) from public.movimientos_socios;
```

Expected: two active 50% partners and zero cuts/movements on first deployment.

- [ ] **Step 4: Push the verified feature branch**

```powershell
git push -u origin codex/socios-ganancias
```

- [ ] **Step 5: Integrate into `main` only after checks are green**

Recheck `origin/main`, merge without broad staging, and push the verified commit set.

- [ ] **Step 6: Verify Vercel production**

Verify:

- `/admin` returns 200 with no-store headers;
- the new versioned JS returns 200;
- login and session behavior remain intact;
- authenticated partner panel reads the live tables;
- cards reconcile with current `Caja Física` and `Deuda Tarjeta`.

- [ ] **Step 7: Controlled functional verification**

Before creating financial records, confirm both partner names. Then perform either:

- a read-only calculation check; or
- a deliberately small cut only with explicit user confirmation.

Do not create or reverse live financial records merely as a smoke test without that confirmation.
