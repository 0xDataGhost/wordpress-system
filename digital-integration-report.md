# Digital Fulfillment — Integration Validation Report

> **Date:** 2026-06-27 · **Scope:** Phases 15–20.5 (digital product fulfillment) · **Assumption:** Phase 20.5 complete.
> **Method:** End-to-end trace of the actual code paths (engine, delivery, manual, webhooks, suppliers, reports, notifications, audit, RBAC, tenant scoping), cross-checked by five parallel read-only validators quoting `file:line`, plus the automated test/build suite.
> **Environment constraint:** No PostgreSQL/Redis or live WooCommerce store is available here (documented since Phase 13). Flows were validated by **code-level tracing + the unit suite**, not a live round-trip. Concurrency claims are reasoned from SQL/index guarantees.

## Verification suite (after fixes)

| Check | Result |
|---|---|
| API typecheck (`tsc --noEmit`) | ✅ PASS |
| API unit tests (`tsx --test`) | ✅ **293 / 293 pass** |
| API lint (`eslint`) | ✅ PASS |
| Dashboard build (`vite build`) | ✅ PASS |
| Dashboard lint (`eslint`) | ✅ PASS |

## Scenario results

| # | Scenario | Verdict | Notes |
|---|---|---|---|
| 1 | Enable → import → order webhook → assignment → delivery | ✅ PASS | Order upserted first; assign gated on `reserve_on_statuses`; deliver gated on auto+automatic+`deliver_on_statuses`; code flows available→sold→delivered; order→completed. |
| 2 | Quantity > 1 | ✅ PASS | `required = Σ(order_items.quantity)` per product; N codes locked & assigned. |
| 3 | Repeated webhook (idempotency) | ✅ PASS | Sequential: event dedup + engine `missing<=0` skip + active-code partial-unique index + delivery no-op. See "Documented limitations" for a concurrency-only caveat. |
| 4 | Insufficient stock | ✅ PASS | Partial-assigns available stock, sets `partial`/`manual_review`, raises notification; non-partial fails all-or-nothing. No over-assignment / negatives / crash. |
| 5 | Manual assignment | ✅ PASS | Available-only + product-match + atomic claim; audit `digital_code_manually_assigned`. |
| 6 | Replacement | ✅ PASS | Old→replaced (linked), old code→invalid (never restocked), new code claimed atomically; `allowReplacement` + reason enforced; `resendNow` redelivers. |
| 7 | Refund | ✅ PASS | Webhook + manual; delivered codes locked `refunded` (never `available`); audit `digital_assignment_refunded`; best-effort + idempotent. |
| 8 | Cancel | ✅ PASS | Undelivered→`available`, delivered→`refunded`; cancelled order not re-assigned/re-delivered (status-gated); audit `digital_assignment_cancelled`. |
| 9 | Reveal code | ✅ PASS | `digital_inventory.reveal` + rate-limited + tenant-scoped; AES-256-GCM decrypt; audit carries preview/status only; `Cache-Control: no-store`; no other DTO exposes the code. |
| 10 | Supplier batches & cost | ✅ PASS | Import validates active store-owned supplier; persists supplier/cost/currency on batch + codes at `numeric(12,4)`; metrics store-scoped; soft-archive blocked on active batches; mapping unique. |
| 11 | Reports & profit analytics | ✅ PASS | All routes gated by `digital_reports.view`; tenant-scoped; paid-status revenue; cost `coalesce(code,batch)` with unknown≠zero; divisions guarded; **no raw/cipher/hash/preview in any DTO**. |
| 12 | Notifications | ✅ PASS | 10 digital call sites; store-scoped; valid type/severity; best-effort (never breaks the action); no secrets. |
| 13 | Audit logs | ✅ PASS | Every sensitive action audited via the best-effort recorder; metadata is ids/counts/status only (reveal logs preview not plaintext; mark-invalid/status log no reason text); webhook actions use `user_id = null`; all Phase-20.5 actions present. |
| 14 | RBAC | ✅ PASS *(after fix)* | Was **PARTIAL** — `/release` (refund/cancel) was gated by `.retry`, allowing refunds without `.refund`. **Fixed** (see below). All other routes correctly gated. |
| 15 | Tenant isolation | ✅ PASS | 78/78 digital-module queries store-scoped; `storeId` from JWT (`getAuth`) or connector key; no id-only escape hatch, no cross-store join. |

**Overall: 15 / 15 PASS after one fix.**

---

## Defect found & fixed

### DEF-1 (HIGH, Scenario 14) — Order-level release allowed refunds without the refund permission

- **Root cause:** `POST /digital-delivery/orders/:orderId/release` accepts `mode: "cancel" | "refund" | "manual_release"` and, for `refund`/`cancel`, locks delivered codes as `refunded` (a money-sensitive action) — but the route was gated by `digital_delivery.retry`. Roles **Order Employee** and **Customer Support** hold `.retry` but not `.refund`, so they could issue order-wide refunds, bypassing the `.refund` permission that the dedicated per-assignment route (`PATCH /assignments/:id/status`) correctly requires. The dashboard already gated the release button on `.refund`, so only the backend route was inconsistent.
- **Affected files:** `apps/api/src/modules/digital-delivery/digital-delivery.routes.ts` (release route guard); doc comment in `apps/api/src/modules/digital-delivery/manual.controller.ts`.
- **Minimal fix applied:** changed the `/release` route guard from `requirePermission("digital_delivery.retry")` → `requirePermission("digital_delivery.refund")`, matching the per-assignment status route and the frontend gating, and aligned with plan §3.1 (refunds = Owner/Manager). Owner & Manager are unaffected (they hold `.refund`). No tests broke (293/293 still pass).

### DEF-2 (LOW, Scenarios 5/6) — Stale permission docstrings

- **Root cause:** controller docstrings drifted after Phase 20.5 — `replaceHandler` said `(digital_delivery.assign)` and `releaseHandler` said `(digital_delivery.retry)`, while the routes enforce the stricter `.replace` / `.refund`.
- **Affected file:** `apps/api/src/modules/digital-delivery/manual.controller.ts`.
- **Fix applied:** corrected both docstrings. (Documentation accuracy only — no behavior change.)

---

## Documented limitations (NOT fixed — by design or unsafe to patch now)

1. **Concurrent same-order delivery could duplicate the customer notice (Scenario 3, MEDIUM, concurrency-only).** `digital_deliveries` has no DB-level uniqueness on `order_id`; the idempotent no-op check and the `processing`-row insert in `deliverCodesForOrder` are not atomic. Under two *simultaneous* `order.updated` webhooks for the same order, both could insert a delivery row and run the channel send → a duplicate "codes ready" notice. **Money-safety is intact** — the code→`delivered` transition is guarded by `WHERE status='assigned'`, so codes are never double-consumed and counts never go negative. Today webhooks process inline/synchronously per request, so this path is not reachable in practice.
   - **Why not patched:** the obvious fix (a partial-unique index on `digital_deliveries(store_id, order_id) WHERE status in ('processing','completed')`) would **break the legitimate resend/force path**, which intentionally creates a *new* completed delivery row per resend. A correct fix requires an order-row `SELECT … FOR UPDATE` around the no-op-check + insert — a behavioral change beyond "fix confirmed defects." Recommended for a future hardening pass if webhook processing ever moves to a concurrent worker.
   - **Affected file (for the future fix):** `apps/api/src/modules/digital-delivery/delivery.service.ts` (`deliverCodesForOrder`).

2. **`maxCodesPerOrderItem` is a per-product cap despite its name (Scenario 2, LOW, by design).** The engine sums `required` per product across lines, then caps assignment at `maxCodesPerOrderItem` (default 50). A single product needing > 50 codes is intentionally held at `partial` (the documented safety cap). Not a correctness bug for typical quantities; flagged as a naming/semantic note.

3. **Reveal has no code-status gate (Scenario 9, LOW, likely intentional).** Any code in the store (including `voided`/`invalid`) can be revealed by a `.reveal` holder. Defensible (operators may need to inspect a bad code) and fully audited. Confirm with product if a status restriction is desired.

4. **Rate limiter fails open on Redis outage (Scenario 9, LOW).** `middleware/rate-limit.ts` allows the request if Redis is unreachable — availability over strictness, consistent with the auth limiters. Noted for the sensitive reveal endpoint.

5. **`costTotal` uses float multiply before `.toFixed(2)` (Scenario 10, LOW).** Safe within current import bounds; not integer-cent arithmetic. Note only.

---

## Cross-cutting confirmations

- **Money-safety invariant (delivered/revealed codes never return to stock):** centrally enforced by `CODE_TRANSITIONS` (no `delivered → available` edge) and applied uniformly across manual-assign, replace, release, assignment-status, and webhook refund/cancel paths (`transitions.ts` `decideReleaseOutcome` / `decideAssignmentStatusOutcome`).
- **Double-sell prevention:** `FOR UPDATE SKIP LOCKED` selection + `WHERE status='available'` guarded update + partial-unique index `code_assignments_active_code_unique (store_id, code_id) WHERE status in ('assigned','delivered')`.
- **Idempotency:** webhook event-level (`webhook_events` unique delivery index) + engine assignment-level (`missing <= 0` skip) + delivery no-op + refund/cancel terminal-status short-circuit.
- **Secret hygiene:** no list/summary/assignment/report/audit/notification surface exposes a raw or encrypted code; the full plaintext is returned only by the audited, rate-limited reveal endpoint.
- **Tenant isolation:** every digital query is `store_id`-scoped; `storeId` is always derived from the verified JWT or connector API key, never from request body/params.

## RBAC matrix (post-fix, digital permissions)

| Permission | Owner | Manager | Product-Mgr | Order-Emp | Cust-Support | Marketer | Accountant | Viewer |
|---|---|---|---|---|---|---|---|---|
| digital_inventory.view | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ |
| digital_inventory.edit / import | ✅ | ✅ | ✅ | — | — | — | — | — |
| digital_inventory.reveal / export | ✅ | ✅ | — | — | — | — | — | — |
| digital_inventory.delete | ✅ | — | — | — | — | — | — | — |
| digital_delivery.view | ✅ | ✅ | — | ✅ | ✅ | — | — | ✅ |
| digital_delivery.assign / deliver | ✅ | ✅ | — | ✅ | — | — | — | — |
| digital_delivery.retry / resend / replace | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| **digital_delivery.refund** (incl. `/release`) | ✅ | ✅ | — | — | — | — | — | — |
| digital_suppliers.view / create / edit | ✅ | ✅ | ✅ | — | — | — | — | — |
| digital_suppliers.delete | ✅ | ✅ | — | — | — | — | — | — |
| digital_reports.view | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | — |

> Note: the new `digital_delivery.refund` grant must be materialized by running `npm run db:seed` against an existing database before the tightened `/release` route behaves as expected for non-Owner/Manager roles.

## Conclusion

The digital fulfillment workflow is **integration-sound end-to-end**. One genuine privilege-escalation defect (order-level release bypassing `.refund`) was found and fixed; two stale docstrings were corrected. The remaining items are by-design caps or a concurrency-only edge that cannot be safely patched without a behavioral change and is unreachable under today's inline webhook processing. All automated checks pass (293/293 API tests, both builds, both lints).
