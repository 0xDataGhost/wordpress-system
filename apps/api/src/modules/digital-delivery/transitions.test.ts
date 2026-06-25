import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertCodeTransition,
  decideReleaseOutcome,
  isAssignmentTransitionAllowed,
  isCodeTransitionAllowed,
  orderStatusForRelease,
  requiresReason,
} from "./transitions";

/* ----------------------------- Release safety ---------------------------- */

test("release: an UNDELIVERED (assigned) code returns to available for every mode", () => {
  for (const mode of ["cancel", "refund", "manual_release"] as const) {
    const outcome = decideReleaseOutcome("assigned", mode);
    assert.equal(outcome.action, "release_to_available");
    assert.equal(outcome.newCodeStatus, "available");
    assert.equal(outcome.newAssignmentStatus, "cancelled");
    assert.equal(outcome.delivered, false);
  }
});

test("release: a DELIVERED code NEVER returns to available (cancel/refund lock it)", () => {
  const refund = decideReleaseOutcome("delivered", "refund");
  assert.equal(refund.action, "lock_refunded");
  assert.equal(refund.newCodeStatus, "refunded");
  assert.notEqual(refund.newCodeStatus, "available");
  assert.equal(refund.newAssignmentStatus, "refunded");

  const cancel = decideReleaseOutcome("delivered", "cancel");
  assert.equal(cancel.action, "lock_refunded");
  assert.equal(cancel.newCodeStatus, "refunded");
  assert.equal(cancel.newAssignmentStatus, "cancelled");
});

test("release: manual_release leaves a delivered code untouched (skip)", () => {
  const outcome = decideReleaseOutcome("delivered", "manual_release");
  assert.equal(outcome.action, "skip");
  assert.equal(outcome.newCodeStatus, null);
  assert.equal(outcome.delivered, true);
});

test("release: already-terminal assignments are skipped", () => {
  for (const s of ["replaced", "refunded", "cancelled", "failed"]) {
    assert.equal(decideReleaseOutcome(s, "refund").action, "skip");
  }
});

test("orderStatusForRelease maps modes to order digital status", () => {
  assert.equal(orderStatusForRelease("cancel"), "cancelled");
  assert.equal(orderStatusForRelease("refund"), "refunded");
  assert.equal(orderStatusForRelease("manual_release"), "manual_review");
});

/* --------------------------- Code transitions ---------------------------- */

test("code: a delivered code can never transition back to available", () => {
  assert.equal(isCodeTransitionAllowed("delivered", "available"), false);
  assert.throws(() => assertCodeTransition("delivered", "available"));
});

test("code: allowed exception transitions", () => {
  assert.equal(isCodeTransitionAllowed("available", "sold"), true);
  assert.equal(isCodeTransitionAllowed("sold", "available"), true); // release undelivered
  assert.equal(isCodeTransitionAllowed("sold", "invalid"), true);
  assert.equal(isCodeTransitionAllowed("delivered", "refunded"), true);
  assert.equal(isCodeTransitionAllowed("delivered", "invalid"), true); // replace a bad delivered code
});

/* ------------------------- Assignment transitions ------------------------ */

test("assignment: active assignments can be replaced; terminal ones cannot", () => {
  assert.equal(isAssignmentTransitionAllowed("assigned", "replaced"), true);
  assert.equal(isAssignmentTransitionAllowed("delivered", "replaced"), true);
  assert.equal(isAssignmentTransitionAllowed("assigned", "cancelled"), true);
  assert.equal(isAssignmentTransitionAllowed("replaced", "assigned"), false);
});

/* ----------------------------- Reason policy ----------------------------- */

test("reason is required for destructive/support target statuses", () => {
  for (const s of ["invalid", "voided", "replaced", "refunded", "released", "cancelled"]) {
    assert.equal(requiresReason(s), true);
  }
  for (const s of ["available", "sold", "delivered", "reserved"]) {
    assert.equal(requiresReason(s), false);
  }
});
