# HERENCIA90 Socios, Cortes de Ganancias y Retiros

Date: 2026-07-28

Workspace: `C:\Users\PC\Desktop\HERENCIA90`

Status: Design approved in conversation; written specification awaiting review

Scope: Admin financiero only

## 1. Objective

Add an auditable partner-accounting module to the HERENCIA90 admin for two 50/50 partners.

The module must:

- Reserve the outstanding partner credit-card debt before any profit is made available.
- Treat the remaining eligible cash as the pool that can be approved for distribution.
- Allocate every approved distribution 50/50.
- Track cash withdrawals separately for each partner.
- Track shirts taken by each partner at the real business cost.
- Preserve a separate commercial value and tax-review status for every shirt withdrawal.
- Keep partner withdrawals out of sales, operating expenses, and realized net profit.
- Prevent the same surplus from being approved twice.
- Preserve an audit trail through reversals instead of silent deletion.

## 2. Confirmed Business Rule

HERENCIA90 will use this operating rule:

1. Determine current business cash before partner withdrawals.
2. Subtract the outstanding partner credit-card debt.
3. Treat the positive remainder as the cumulative basis that may be approved for partner distribution.
4. Subtract amounts already approved in prior active profit cuts.
5. The remaining amount is the maximum available for a new cut.
6. An approved cut is assigned 50/50.

This is an internal cash-distribution rule. It is intentionally separate from the existing card named `Ganancia neta realizada`, which remains an accounting performance metric.

## 3. Current Admin Behavior

The current admin already separates:

- realized net profit;
- collected sales;
- cost of sold products;
- sales expenses;
- cash;
- credit-card debt;
- inventory value.

Relevant current files:

- `web/admin.html`
- `web/js/admin-finance-metrics.js`
- `web/js/admin-inventory-guard.js`
- `scripts/admin-finance-metrics.test.mjs`

The current quick action `Retiro personal` is not a cash withdrawal. It removes a shirt from inventory through the category `Retiro Personal Socio`. It does not identify which partner took the shirt and cannot maintain a partner balance.

The existing financial engine treats most `gasto` rows that are not inventory purchases as operating expenses. A cash distribution cannot be inserted as a normal expense because that would incorrectly reduce realized net profit.

## 4. Options Considered

### Option A - Add More Categories to `transacciones`

Add `Retiro efectivo socio 1`, `Retiro efectivo socio 2`, and more text categories.

Advantages:

- Smallest initial code change.

Disadvantages:

- Partner identity would depend on category text.
- Profit-cut approvals would not exist.
- The same surplus could be distributed more than once.
- Product and cash withdrawals would remain difficult to reconcile.
- Historical corrections would be fragile.

### Option B - Continuous 50/50 Balance from Current Profit

Give each partner 50% of the current realized net profit and subtract withdrawals continuously.

Advantages:

- Easy to understand.
- No explicit cut workflow.

Disadvantages:

- Realized profit is not the same as available cash.
- It can expose money needed to pay the card debt.
- A later expense or correction can make a previously shown balance invalid.

### Option C - Approved Profit Cuts and Partner Ledger

Create explicit profit cuts and a separate partner-movement ledger.

Advantages:

- Matches the confirmed business rule.
- Separates business performance from owner distributions.
- Prevents double allocation.
- Supports cash and in-kind shirt withdrawals.
- Produces an auditable history.

Disadvantages:

- Requires a Supabase schema migration and dedicated admin UI.
- Requires careful handling of stock and reversals.

### Decision

Use Option C.

## 5. Financial Definitions

### 5.1 Operational Cash

`operational_cash` is the cash computed from existing `transacciones` before partner cash withdrawals.

It continues to include the existing transaction rules:

- income increases cash;
- normal cash expenses decrease cash;
- paying the credit-card debt decreases cash;
- buying inventory with a personal card increases debt but does not reduce cash;
- partner distributions are not stored as ordinary operating expenses.

### 5.2 Current Physical Cash

```text
current_physical_cash =
  operational_cash
  - active_partner_cash_withdrawals
  + active_partner_cash_reversals
```

This becomes the number displayed by `Caja Física`.

### 5.3 Cumulative Distribution Basis

```text
cash_before_partner_withdrawals =
  current_physical_cash
  + net_active_partner_cash_withdrawals

distribution_basis =
  max(0, cash_before_partner_withdrawals - max(0, credit_card_debt))
```

Adding prior partner cash withdrawals back reconstructs the cash that existed before distributions. This prevents a prior withdrawal from erasing the historical basis used by an approved cut.

Paying the card debt does not create new profit. When a card payment lowers cash and debt by the same amount, `distribution_basis` remains unchanged.

### 5.4 Maximum for a New Cut

```text
new_cut_available =
  max(0, distribution_basis - sum(active_approved_cuts))
```

Only active approved cuts are subtracted. An annulled cut is excluded.

The admin may approve any amount from zero through `new_cut_available`. It must never auto-approve the maximum.

### 5.5 50/50 Rounding

Approved COP amounts must be whole and even numbers so both partners receive exactly 50%.

If the calculated maximum is odd, the suggested amount is rounded down by COP 1.

Example:

```text
Maximum calculated: COP 3,091,311
Suggested approvable cut: COP 3,091,310
Partner 1 allocation: COP 1,545,655
Partner 2 allocation: COP 1,545,655
COP 1 remains unapproved in the business
```

### 5.6 Partner Balance

```text
partner_balance =
  partner_allocations_from_active_cuts
  - active_cash_withdrawals
  - active_product_withdrawals_at_cost
  + active_reversals
```

A partner cannot withdraw more than this balance.

## 6. Supabase Data Model

### 6.1 `socios`

Purpose: store stable partner identities shared across devices.

Fields:

- `id`: small integer primary key.
- `nombre`: required text.
- `porcentaje`: numeric, fixed at `50.00` for this version.
- `activo`: boolean.
- `created_at`.
- `updated_at`.

Rules:

- Exactly two active partners.
- Active percentages must total 100.
- Version 1 does not support changing ownership percentages after cuts exist.

### 6.2 `cortes_ganancias`

Purpose: record every approved allocation decision.

Fields:

- `id`: bigint primary key.
- `fecha`: date.
- `caja_fisica_snapshot`: numeric.
- `retiros_efectivo_snapshot`: numeric.
- `caja_antes_socios_snapshot`: numeric.
- `deuda_tarjeta_snapshot`: numeric.
- `base_repartible_snapshot`: numeric.
- `cortes_previos_snapshot`: numeric.
- `maximo_nuevo_corte_snapshot`: numeric.
- `monto_aprobado`: numeric.
- `monto_socio_1`: numeric.
- `monto_socio_2`: numeric.
- `estado`: `activo` or `anulado`.
- `nota`: text.
- `created_at`.
- `anulado_at`: nullable timestamp.
- `motivo_anulacion`: nullable text.

Rules:

- `monto_aprobado` must be positive, whole, and even.
- `monto_aprobado` cannot exceed the server-calculated maximum.
- Partner allocations must equal exactly 50% each.
- A cut with withdrawals attached cannot be annulled until those withdrawals are reversed.

### 6.3 `movimientos_socios`

Purpose: store partner cash and product withdrawals plus reversals.

Fields:

- `id`: bigint primary key.
- `corte_id`: required foreign key to `cortes_ganancias`.
- `socio_id`: required foreign key to `socios`.
- `tipo`: `retiro_efectivo`, `retiro_producto`, or `reversion`.
- `fecha`: date.
- `valor_participacion_cop`: numeric.
- `efecto_caja_cop`: numeric.
- `producto_id`: nullable product reference.
- `talla`: nullable text.
- `cantidad`: nullable integer.
- `costo_unitario_usd`: nullable numeric.
- `trm_snapshot`: nullable numeric.
- `costo_unitario_cop`: nullable numeric.
- `valor_comercial_unitario_cop`: nullable numeric.
- `revision_tributaria`: `pendiente`, `revisado`, or `no_aplica`.
- `movimiento_revertido_id`: nullable self-reference.
- `transaccion_origen_id`: nullable reference for historical linking.
- `nota`: text.
- `created_at`.

Rules:

- Cash withdrawal:
  - `valor_participacion_cop` equals the withdrawn cash.
  - `efecto_caja_cop` equals the withdrawn cash.
  - It affects physical cash and the partner balance.
  - It does not affect realized net profit or operating expenses.
- Product withdrawal:
  - `valor_participacion_cop` equals quantity times real unit cost in COP.
  - `efecto_caja_cop` equals zero.
  - It reduces stock and the partner balance.
  - It saves the current public or commercial price separately.
  - `revision_tributaria` defaults to `pendiente`.
- Reversal:
  - References the original movement.
  - Applies the exact opposite financial effect.
  - A product reversal restores the same product, size, and quantity.
- Original movements are immutable after creation.

### 6.4 Security

All three tables must:

- have Row Level Security enabled;
- allow authenticated admin users only;
- deny anonymous access;
- use database constraints for invariant checks.

## 7. Database Operations

The following operations must be atomic Supabase RPC functions:

### `crear_corte_ganancias`

- Recalculates the current maximum on the server.
- Rejects stale or excessive amounts.
- Enforces an even COP amount.
- Stores all snapshots.
- Assigns 50% to each partner.

### `registrar_retiro_efectivo_socio`

- Locks or rechecks the selected partner balance.
- Rejects an amount above the partner balance.
- Rejects an amount above current physical cash.
- Inserts the movement.

### `registrar_retiro_producto_socio`

- Locks or rechecks the selected partner balance.
- Rechecks current stock for the selected size.
- Calculates cost from the current product cost and saved TRM.
- Stores cost and commercial-value snapshots.
- Decrements product stock.
- Inserts the partner movement in the same database transaction.

### `revertir_movimiento_socio`

- Rejects a second reversal of the same movement.
- Creates an audit reversal.
- Restores cash effect or stock as applicable.
- Restores the partner balance effect.

Client-side sequences that can leave stock changed without a saved movement are not acceptable for this module.

## 8. Admin User Experience

### 8.1 New Section

Add `Socios y ganancias` inside `Inicio Financiero`, close to the main financial cards.

It contains:

- `Disponible para nuevo corte`.
- `Deuda de tarjeta reservada`.
- `Total aprobado históricamente`.
- `Caja física después de retiros`.
- One balance card per partner.

Each partner card shows:

- total assigned;
- cash withdrawn;
- shirts withdrawn at cost;
- current balance.

### 8.2 Primary Actions

Add three explicit actions:

- `Crear corte de ganancias`.
- `Retirar efectivo`.
- `Sacar camiseta`.

The existing generic `Retiro personal` preset is removed from the generic movement form after the new product-withdrawal flow is live.

### 8.3 Create-Cut Modal

Show:

- current physical cash;
- prior partner cash withdrawals;
- reconstructed cash before partner withdrawals;
- current card debt;
- cumulative distribution basis;
- prior approved cuts;
- maximum for this cut;
- amount to approve;
- exact 50/50 allocation preview;
- optional internal note.

The confirmation text must state:

`Este corte asigna saldo a los socios. No retira dinero todavía.`

### 8.4 Cash-Withdrawal Modal

Fields:

- partner;
- active cut or automatic oldest-balance allocation;
- amount;
- date;
- note or transfer reference.

Show before saving:

- partner balance before;
- withdrawal;
- partner balance after;
- current physical cash after.

### 8.5 Product-Withdrawal Modal

Fields:

- partner;
- product;
- size;
- quantity;
- date;
- note.

Automatically show:

- available stock;
- unit cost USD;
- TRM snapshot;
- total internal cost charged to the partner;
- commercial value;
- partner balance after;
- tax-review warning.

Required warning:

`La camiseta se descuenta de tu saldo al costo. El valor comercial se guarda para revisión tributaria; esto no es una venta normal.`

### 8.6 History

Add a dedicated `Historial de socios` table with:

- date;
- partner;
- cut;
- movement type;
- product and size when applicable;
- participation value;
- cash effect;
- tax-review status;
- note;
- reversal status;
- reversal action.

Do not expose a hard-delete button.

### 8.7 Existing Historical Shirt Withdrawals

Existing `Retiro Personal Socio` transactions must not be automatically assigned to either partner.

The new panel will list them as `Requiere asignar socio`. The admin can link each historical transaction once:

- select the partner;
- select an active cut with enough remaining partner balance;
- use the already stored product cost and TRM;
- create a partner-ledger movement with `transaccion_origen_id`;
- do not decrement stock again.

If no approved cut exists, the admin must create the first cut before linking historical withdrawals. This avoids guessing the partner, creating an unexplained negative balance, or double-decrementing inventory.

## 9. Finance-Engine Changes

Extend `web/js/admin-finance-metrics.js` without mixing partner distributions into business expenses.

Required outputs:

- existing `netProfitRealized` unchanged by partner movements;
- existing `profitExpenses` unchanged by partner movements;
- `partnerCashWithdrawals`;
- `currentPhysicalCash`;
- `distributionBasis`;
- `approvedCutsTotal`;
- `newCutAvailable`.

Monthly cash charts must show partner cash withdrawals as cash outflows.

The profit waterfall must remain unchanged because distributions are not operating costs.

A separate pure module should compute partner balances and cut availability so the rules can be tested without the DOM or Supabase.

## 10. Tax Boundary

The admin is not a tax engine.

For product withdrawals it must:

- preserve internal cost;
- preserve commercial value;
- preserve date and quantity;
- default tax status to `pendiente`;
- export the data for accountant review.

It must not:

- automatically charge or declare IVA;
- generate an electronic invoice;
- assume HERENCIA90 is responsible for IVA;
- mark a product withdrawal as tax-complete automatically.

The correct tax treatment depends on HERENCIA90's legal and tax registration. That confirmation remains outside this implementation.

## 11. Error Handling

- Supabase load failure: show a visible partner-module error and keep existing finance cards available.
- Stale balance during save: reject the operation and refresh all partner metrics.
- Insufficient cash: reject cash withdrawal.
- Insufficient partner balance: reject cash or product withdrawal.
- Insufficient stock: reject product withdrawal without inserting a movement.
- Invalid TRM or cost: block product withdrawal and identify the product field that needs correction.
- RPC failure: make no local optimistic stock change.
- Reversal failure: leave the original movement active and show the database error.
- Duplicate historical link: reject by unique constraint on `transaccion_origen_id`.

## 12. Example Using the Current Screenshot

Starting snapshot:

```text
Ganancia neta realizada: COP 5,874,311
Caja física: COP 5,613,000
Deuda tarjeta: COP 2,521,689
Prior approved cuts: COP 0
Prior partner withdrawals: COP 0
```

Cut calculation:

```text
Distribution basis: 5,613,000 - 2,521,689 = 3,091,311
Suggested even approved cut: COP 3,091,310
Partner 1: COP 1,545,655
Partner 2: COP 1,545,655
Unapproved remainder: COP 1
```

If Partner 1 takes a shirt:

```text
Business cost: COP 50,000
Commercial price snapshot: COP 90,000
Cash effect: COP 0
Partner 1 new balance: COP 1,495,655
Inventory: minus one unit in the selected size
Tax review: pending
```

If Partner 2 withdraws COP 500,000:

```text
Cash effect: minus COP 500,000
Realized net profit effect: COP 0
Partner 2 new balance: COP 1,045,655
```

No second cut can reapprove the original COP 3,091,310 because it is already included in `active_approved_cuts`.

## 13. Testing Strategy

### Pure Finance Tests

- Card purchase increases debt without reducing physical cash.
- Card payment lowers cash and debt equally without changing distribution basis.
- Cash partner withdrawal lowers physical cash but not realized profit.
- Product partner withdrawal lowers partner balance but not cash or realized profit.
- Prior approved cuts reduce the next available cut.
- Reversal restores the correct balance and effect.
- Odd maximum is rounded down for a 50/50 suggestion.
- Negative debt is clamped to zero.

### Database Tests

- A cut above the current maximum is rejected.
- A partner withdrawal above their balance is rejected.
- A product withdrawal with insufficient stock is rejected atomically.
- A successful product withdrawal updates stock and ledger together.
- A repeated reversal is rejected.
- A historical transaction cannot be linked twice.
- Anonymous users cannot access partner tables or RPCs.

### Admin Integration Tests

- Partner cards reconcile with cuts and movements.
- Existing profit cards remain unchanged after partner withdrawals.
- Physical cash changes only for cash withdrawals and reversals.
- Product modal previews match saved snapshots.
- History shows active and reversed movements clearly.
- CSV export contains all tax-review fields.

### Regression Checks

- `node --test scripts/admin-finance-metrics.test.mjs`
- relevant inventory-guard tests;
- JavaScript syntax checks for changed files;
- focused browser smoke test for the finance and partner flows.

## 14. Rollout

1. Add schema migration and RPC functions.
2. Add pure partner-finance module and tests.
3. Load partner tables in the admin without changing the visible UI.
4. Add read-only partner cards.
5. Add profit-cut creation.
6. Add cash withdrawals.
7. Add atomic product withdrawals.
8. Add reversals and history.
9. Add historical-link review.
10. Run local regression and browser checks.
11. Apply the migration to production only after SQL and UI review.
12. Verify production with a low-value controlled test and reverse it.

## 15. Acceptance Criteria

The feature is complete when:

- exactly two active partners are configured at 50/50;
- card debt is reserved before a cut is offered;
- the same cumulative surplus cannot be approved twice;
- cash withdrawals reduce physical cash but not net profit;
- shirts reduce stock and the selected partner balance at cost;
- commercial value and tax-review status are stored for shirts;
- no partner can exceed their balance;
- all corrections use traceable reversals;
- current sales, expense, COGS, ROI, and inventory behavior still passes regression checks;
- no anonymous user can access partner financial records.

## 16. Out of Scope

- Automatic tax or IVA calculation.
- Electronic invoicing for product withdrawals.
- Partner salaries or payroll.
- Ownership percentages other than 50/50.
- More than two partners.
- Bank-account reconciliation.
- Automatically approving every available peso.
- Modifying public storefront behavior.

## 17. Next Step

After the user reviews this written specification, create an implementation plan with exact SQL, file changes, test order, and deployment gates.
