import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getAllowedTransitions,
  importCodesSchema,
  isDestructiveStatus,
  isTransitionAllowed,
  updateCodeStatusSchema,
} from "./digital-inventory.schemas";

const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";

test("importCodesSchema requires a product id and non-empty codesText", () => {
  assert.equal(
    importCodesSchema.safeParse({ productId: PRODUCT_ID, codesText: "A" })
      .success,
    true,
  );
  assert.equal(
    importCodesSchema.safeParse({ productId: PRODUCT_ID, codesText: "" })
      .success,
    false,
  );
  assert.equal(
    importCodesSchema.safeParse({ productId: "not-a-uuid", codesText: "A" })
      .success,
    false,
  );
});

test("importCodesSchema defaults source to manual_import", () => {
  const parsed = importCodesSchema.parse({
    productId: PRODUCT_ID,
    codesText: "A",
  });
  assert.equal(parsed.source, "manual_import");
});

test("updateCodeStatusSchema only accepts manually-settable destructive targets", () => {
  for (const status of ["voided", "invalid", "expired"]) {
    assert.equal(
      updateCodeStatusSchema.safeParse({ status, reason: "supplier issue" })
        .success,
      true,
    );
  }
  // Engine-driven / refund statuses cannot be set here.
  for (const status of ["available", "sold", "delivered", "refunded", "reserved"]) {
    assert.equal(
      updateCodeStatusSchema.safeParse({ status, reason: "x reason" }).success,
      false,
    );
  }
});

test("updateCodeStatusSchema requires a reason of at least 3 chars", () => {
  assert.equal(
    updateCodeStatusSchema.safeParse({ status: "invalid" }).success,
    false,
  );
  assert.equal(
    updateCodeStatusSchema.safeParse({ status: "invalid", reason: "no" })
      .success,
    false,
  );
});

test("allowed status transitions match the plan", () => {
  assert.equal(isTransitionAllowed("available", "voided"), true);
  assert.equal(isTransitionAllowed("available", "invalid"), true);
  assert.equal(isTransitionAllowed("available", "expired"), true);
  assert.equal(isTransitionAllowed("reserved", "voided"), true);
  assert.equal(isTransitionAllowed("sold", "invalid"), true);
});

test("disallowed transitions are rejected", () => {
  // No path back to an active state, no direct refund, delivered is terminal here.
  assert.equal(isTransitionAllowed("available", "sold"), false);
  assert.equal(isTransitionAllowed("sold", "refunded"), false);
  assert.equal(isTransitionAllowed("delivered", "invalid"), false);
  assert.equal(isTransitionAllowed("reserved", "invalid"), false);
  assert.equal(isTransitionAllowed("voided", "available"), false);
});

test("getAllowedTransitions returns an empty list for terminal states", () => {
  assert.deepEqual(getAllowedTransitions("delivered"), []);
  assert.deepEqual(getAllowedTransitions("refunded"), []);
});

test("destructive statuses are flagged", () => {
  for (const s of ["voided", "invalid", "refunded", "expired"]) {
    assert.equal(isDestructiveStatus(s), true);
  }
  for (const s of ["available", "sold", "delivered"]) {
    assert.equal(isDestructiveStatus(s), false);
  }
});
