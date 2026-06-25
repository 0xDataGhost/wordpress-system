import assert from "node:assert/strict";
import { test } from "node:test";
import { AUDIT_ACTIONS } from "../../db/schema/audit-logs";
import { buildDeliveryAuditEntry, type DeliveryRunResult } from "./delivery.service";
import {
  deliverSchema,
  listDeliveriesQuerySchema,
  retrySchema,
} from "./delivery.schemas";

function makeResult(overrides: Partial<DeliveryRunResult> = {}): DeliveryRunResult {
  return {
    orderId: "22222222-2222-2222-2222-222222222222",
    delivery: {
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      storeId: "s",
      orderId: "22222222-2222-2222-2222-222222222222",
      customerId: null,
      status: "completed",
      channel: "dashboard",
      recipientEmail: null,
      recipientPhone: null,
      subject: null,
      messagePreview: "masked",
      attemptCount: 1,
      lastAttemptAt: new Date("2026-06-02T10:00:00.000Z"),
      completedAt: new Date("2026-06-02T10:00:00.000Z"),
      failedReason: null,
      createdBy: null,
      createdAt: new Date("2026-06-02T09:59:00.000Z"),
      updatedAt: new Date("2026-06-02T10:00:00.000Z"),
    },
    attempt: null,
    delivered: true,
    idempotentNoop: false,
    orderStatus: "completed",
    assignmentCount: 2,
    channel: "dashboard",
    ...overrides,
  };
}

test("delivered (non-retry) → digital_codes_delivered", () => {
  const entry = buildDeliveryAuditEntry(makeResult(), false);
  assert.equal(entry.action, AUDIT_ACTIONS.DIGITAL_CODES_DELIVERED);
});

test("delivered via retry → digital_delivery_retried", () => {
  const entry = buildDeliveryAuditEntry(makeResult(), true);
  assert.equal(entry.action, AUDIT_ACTIONS.DIGITAL_DELIVERY_RETRIED);
});

test("not delivered → digital_delivery_failed", () => {
  const entry = buildDeliveryAuditEntry(
    makeResult({ delivered: false }),
    false,
  );
  assert.equal(entry.action, AUDIT_ACTIONS.DIGITAL_DELIVERY_FAILED);
});

test("audit metadata contains exactly the required safe fields (no codes)", () => {
  const entry = buildDeliveryAuditEntry(makeResult(), false);
  assert.deepEqual(Object.keys(entry.metadata).sort(), [
    "assignmentCount",
    "channel",
    "deliveryId",
    "orderId",
    "status",
  ]);
});

test("deliverSchema defaults to the dashboard channel and force=false", () => {
  const parsed = deliverSchema.parse({});
  assert.equal(parsed.channel, "dashboard");
  assert.equal(parsed.force, false);
});

test("deliverSchema rejects an unknown channel", () => {
  assert.equal(deliverSchema.safeParse({ channel: "carrier-pigeon" }).success, false);
});

test("retrySchema defaults the channel; listDeliveriesQuerySchema bounds the limit", () => {
  assert.equal(retrySchema.parse({}).channel, "dashboard");
  assert.equal(listDeliveriesQuerySchema.safeParse({ limit: "500" }).success, false);
  assert.equal(listDeliveriesQuerySchema.safeParse({ status: "completed" }).success, true);
});
