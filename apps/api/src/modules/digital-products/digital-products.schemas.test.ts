import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIGITAL_SETTINGS_DEFAULTS,
  digitalSettingsAuditMetadata,
  digitalSettingsSchema,
  mergeDigitalSettings,
  updateDigitalSettingsSchema,
} from "./digital-products.schemas";

test("digitalSettingsSchema parses the recommended defaults", () => {
  const result = digitalSettingsSchema.safeParse(DIGITAL_SETTINGS_DEFAULTS);
  assert.equal(result.success, true);
});

test("digitalSettingsSchema rejects a deferred (non-MVP) fulfillment type", () => {
  const result = digitalSettingsSchema.safeParse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    fulfillment_type: "account_credentials",
  });
  assert.equal(result.success, false);
});

test("digitalSettingsSchema rejects an unknown delivery mode", () => {
  const result = digitalSettingsSchema.safeParse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    delivery_mode: "telepathy",
  });
  assert.equal(result.success, false);
});

test("digitalSettingsSchema rejects an unknown code pool strategy", () => {
  const result = digitalSettingsSchema.safeParse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    code_pool_strategy: "spiral",
  });
  assert.equal(result.success, false);
});

test("digitalSettingsSchema rejects an invalid WooCommerce status", () => {
  const result = digitalSettingsSchema.safeParse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    reserve_on_statuses: ["processing", "shipped"],
  });
  assert.equal(result.success, false);
});

test("digitalSettingsSchema rejects deliver_on_statuses not subset of reserve_on_statuses", () => {
  const result = digitalSettingsSchema.safeParse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    reserve_on_statuses: ["processing"],
    deliver_on_statuses: ["processing", "completed"],
  });
  assert.equal(result.success, false);
});

test("digitalSettingsSchema accepts deliver_on_statuses equal to reserve set", () => {
  const result = digitalSettingsSchema.safeParse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    reserve_on_statuses: ["processing", "completed"],
    deliver_on_statuses: ["completed"],
  });
  assert.equal(result.success, true);
});

test("digitalSettingsSchema dedupes status arrays", () => {
  const result = digitalSettingsSchema.parse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    reserve_on_statuses: ["processing", "processing", "completed"],
    deliver_on_statuses: ["completed", "completed"],
  });
  assert.deepEqual(result.reserve_on_statuses, ["processing", "completed"]);
  assert.deepEqual(result.deliver_on_statuses, ["completed"]);
});

test("digitalSettingsSchema enforces max_codes_per_order_item bounds", () => {
  assert.equal(
    digitalSettingsSchema.safeParse({
      ...DIGITAL_SETTINGS_DEFAULTS,
      max_codes_per_order_item: 0,
    }).success,
    false,
  );
  assert.equal(
    digitalSettingsSchema.safeParse({
      ...DIGITAL_SETTINGS_DEFAULTS,
      max_codes_per_order_item: 501,
    }).success,
    false,
  );
  assert.equal(
    digitalSettingsSchema.safeParse({
      ...DIGITAL_SETTINGS_DEFAULTS,
      max_codes_per_order_item: 1,
    }).success,
    true,
  );
});

test("digitalSettingsSchema rejects a negative low_stock_threshold", () => {
  const result = digitalSettingsSchema.safeParse({
    ...DIGITAL_SETTINGS_DEFAULTS,
    low_stock_threshold: -1,
  });
  assert.equal(result.success, false);
});

test("updateDigitalSettingsSchema rejects an empty body", () => {
  assert.equal(updateDigitalSettingsSchema.safeParse({}).success, false);
});

test("updateDigitalSettingsSchema rejects unknown keys", () => {
  const result = updateDigitalSettingsSchema.safeParse({
    is_enabled: true,
    secret_backdoor: true,
  });
  assert.equal(result.success, false);
});

test("updateDigitalSettingsSchema accepts a single-field partial", () => {
  const result = updateDigitalSettingsSchema.safeParse({ is_enabled: true });
  assert.equal(result.success, true);
});

test("updateDigitalSettingsSchema coerces a blank instructions_template to null", () => {
  const result = updateDigitalSettingsSchema.parse({
    instructions_template: "   ",
  });
  assert.equal(result.instructions_template, null);
});

test("mergeDigitalSettings overrides only present fields", () => {
  const merged = mergeDigitalSettings(DIGITAL_SETTINGS_DEFAULTS, {
    is_enabled: true,
    fulfillment_type: "subscription_code",
  });
  assert.equal(merged.is_enabled, true);
  assert.equal(merged.fulfillment_type, "subscription_code");
  // Untouched fields keep their defaults.
  assert.equal(merged.delivery_mode, DIGITAL_SETTINGS_DEFAULTS.delivery_mode);
  assert.deepEqual(
    merged.reserve_on_statuses,
    DIGITAL_SETTINGS_DEFAULTS.reserve_on_statuses,
  );
});

test("digitalSettingsAuditMetadata logs field names only — never the template body", () => {
  const meta = digitalSettingsAuditMetadata("prod-1", {
    is_enabled: true,
    instructions_template: "SENSITIVE BODY TEXT",
  });
  assert.deepEqual(meta, {
    productId: "prod-1",
    changedFields: ["is_enabled", "instructions_template"],
  });
  // The template body must not leak into the audit metadata.
  assert.ok(!JSON.stringify(meta).includes("SENSITIVE BODY TEXT"));
});
