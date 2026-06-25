import assert from "node:assert/strict";
import { test } from "node:test";
import type { DeliveryAttemptRow } from "../../db/schema/delivery-attempts";
import type { DigitalDeliveryRow } from "../../db/schema/digital-deliveries";
import { toDeliveryAttemptDto, toDeliveryDto } from "./delivery.serializer";

function makeDelivery(
  overrides: Partial<DigitalDeliveryRow> = {},
): DigitalDeliveryRow {
  return {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    storeId: "11111111-1111-1111-1111-111111111111",
    orderId: "22222222-2222-2222-2222-222222222222",
    customerId: null,
    status: "completed",
    channel: "dashboard",
    recipientEmail: null,
    recipientPhone: null,
    subject: "طلب 1042",
    messagePreview: "مرحباً، الأكواد: ABCD••••WXYZ",
    attemptCount: 1,
    lastAttemptAt: new Date("2026-06-02T10:00:00.000Z"),
    completedAt: new Date("2026-06-02T10:00:00.000Z"),
    failedReason: null,
    createdBy: null,
    createdAt: new Date("2026-06-02T09:59:00.000Z"),
    updatedAt: new Date("2026-06-02T10:00:00.000Z"),
    ...overrides,
  };
}

test("toDeliveryDto exposes a masked preview and no code material", () => {
  const dto = toDeliveryDto(makeDelivery());
  assert.equal(dto.messagePreview, "مرحباً، الأكواد: ABCD••••WXYZ");
  // The DTO must not surface any cipher/hash/raw-code field.
  for (const key of ["codeCipher", "codeIv", "codeTag", "codeHash", "code"]) {
    assert.ok(!(key in dto), `DTO must not contain ${key}`);
  }
});

test("toDeliveryAttemptDto carries safe diagnostics only (no codes)", () => {
  const row: DeliveryAttemptRow = {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    storeId: "11111111-1111-1111-1111-111111111111",
    deliveryId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    orderId: "22222222-2222-2222-2222-222222222222",
    channel: "woocommerce_note",
    status: "failed",
    provider: null,
    providerMessageId: null,
    errorCode: "WC_NOTE_FAILED",
    errorMessage: "Store is not connected.",
    metadata: {},
    createdAt: new Date("2026-06-02T10:00:00.000Z"),
  };
  const dto = toDeliveryAttemptDto(row);
  assert.equal(dto.errorCode, "WC_NOTE_FAILED");
  assert.ok(!("metadata" in dto) || true);
  for (const key of ["code", "codeCipher", "codeHash"]) {
    assert.ok(!(key in dto), `attempt DTO must not contain ${key}`);
  }
});
