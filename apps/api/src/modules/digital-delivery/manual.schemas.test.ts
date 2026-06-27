import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignmentStatusSchema,
  manualAssignSchema,
  releaseSchema,
  replaceSchema,
  resendSchema,
} from "./manual.schemas";

const CODE = "11111111-1111-1111-1111-111111111111";
const ITEM = "22222222-2222-2222-2222-222222222222";
const PRODUCT = "33333333-3333-3333-3333-333333333333";

test("manualAssignSchema requires a reason", () => {
  assert.equal(
    manualAssignSchema.safeParse({ codeId: CODE, orderItemId: ITEM }).success,
    false,
  );
  assert.equal(
    manualAssignSchema.safeParse({ codeId: CODE, orderItemId: ITEM, reason: "ok reason" })
      .success,
    true,
  );
});

test("manualAssignSchema requires orderItemId or productId", () => {
  assert.equal(
    manualAssignSchema.safeParse({ codeId: CODE, reason: "manual pick" }).success,
    false,
  );
  assert.equal(
    manualAssignSchema.safeParse({ codeId: CODE, productId: PRODUCT, reason: "manual pick" })
      .success,
    true,
  );
});

test("replaceSchema requires a reason; replacementCodeId is optional; resendNow defaults false", () => {
  assert.equal(replaceSchema.safeParse({}).success, false);
  const parsed = replaceSchema.parse({ reason: "code already used" });
  assert.equal(parsed.resendNow, false);
  assert.equal(parsed.replacementCodeId, undefined);
});

test("releaseSchema requires a valid mode + reason", () => {
  assert.equal(releaseSchema.safeParse({ mode: "refund", reason: "customer refund" }).success, true);
  assert.equal(releaseSchema.safeParse({ mode: "refund" }).success, false);
  assert.equal(releaseSchema.safeParse({ mode: "delete", reason: "x reason" }).success, false);
  for (const mode of ["cancel", "refund", "manual_release"]) {
    assert.equal(releaseSchema.safeParse({ mode, reason: "valid reason" }).success, true);
  }
});

test("resendSchema defaults the channel to dashboard and rejects unknown channels", () => {
  assert.equal(resendSchema.parse({}).channel, "dashboard");
  assert.equal(resendSchema.parse({ channel: "email" }).channel, "email");
  assert.equal(resendSchema.safeParse({ channel: "carrier-pigeon" }).success, false);
});

test("assignmentStatusSchema accepts only destructive targets and requires a reason", () => {
  for (const status of ["cancelled", "refunded", "failed"]) {
    assert.equal(
      assignmentStatusSchema.safeParse({ status, reason: "support case" }).success,
      true,
    );
    assert.equal(assignmentStatusSchema.safeParse({ status }).success, false);
  }
  assert.equal(
    assignmentStatusSchema.safeParse({ status: "delivered", reason: "no" }).success,
    false,
  );
});
