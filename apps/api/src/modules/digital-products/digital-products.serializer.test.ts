import assert from "node:assert/strict";
import { test } from "node:test";
import type { DigitalProductSettingsRow } from "../../db/schema/digital-product-settings";
import { DIGITAL_SETTINGS_DEFAULTS } from "./digital-products.schemas";
import { toDigitalSettingsDto } from "./digital-products.serializer";

const PRODUCT_ID = "22222222-2222-2222-2222-222222222222";

function makeRow(
  overrides: Partial<DigitalProductSettingsRow> = {},
): DigitalProductSettingsRow {
  return {
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    storeId: "11111111-1111-1111-1111-111111111111",
    productId: PRODUCT_ID,
    fulfillmentType: "subscription_code",
    isEnabled: true,
    autoDeliveryEnabled: false,
    deliveryMode: "manual",
    codePoolStrategy: "lifo",
    reserveOnStatuses: ["processing", "completed"],
    deliverOnStatuses: ["completed"],
    allowManualAssignment: true,
    allowReplacement: false,
    lowStockThreshold: 10,
    maxCodesPerOrderItem: 25,
    instructionsTemplate: "تعليمات التفعيل",
    metadata: {},
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    updatedAt: new Date("2026-06-02T10:00:00.000Z"),
    ...overrides,
  };
}

test("toDigitalSettingsDto returns defaults (unconfigured) when no row exists", () => {
  const dto = toDigitalSettingsDto(PRODUCT_ID, null);
  assert.equal(dto.productId, PRODUCT_ID);
  assert.equal(dto.configured, false);
  assert.equal(dto.updatedAt, null);
  assert.equal(dto.is_enabled, false);
  assert.equal(dto.fulfillment_type, DIGITAL_SETTINGS_DEFAULTS.fulfillment_type);
  assert.deepEqual(
    dto.reserve_on_statuses,
    DIGITAL_SETTINGS_DEFAULTS.reserve_on_statuses,
  );
});

test("toDigitalSettingsDto maps a persisted row to the snake_case DTO", () => {
  const dto = toDigitalSettingsDto(PRODUCT_ID, makeRow());
  assert.equal(dto.productId, PRODUCT_ID);
  assert.equal(dto.configured, true);
  assert.deepEqual(dto.updatedAt, new Date("2026-06-02T10:00:00.000Z"));
  assert.equal(dto.is_enabled, true);
  assert.equal(dto.fulfillment_type, "subscription_code");
  assert.equal(dto.auto_delivery_enabled, false);
  assert.equal(dto.delivery_mode, "manual");
  assert.equal(dto.code_pool_strategy, "lifo");
  assert.deepEqual(dto.deliver_on_statuses, ["completed"]);
  assert.equal(dto.low_stock_threshold, 10);
  assert.equal(dto.max_codes_per_order_item, 25);
  assert.equal(dto.instructions_template, "تعليمات التفعيل");
});
