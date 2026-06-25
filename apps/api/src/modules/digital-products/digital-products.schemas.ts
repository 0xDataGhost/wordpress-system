import { z } from "zod";
import { ORDER_STATUSES } from "../../db/schema/orders";
import {
  CODE_POOL_STRATEGIES,
  DELIVERY_MODES,
  MVP_FULFILLMENT_TYPES,
} from "../../db/schema/digital-product-settings";

/**
 * Validation, defaults and merge helpers for Phase 15 digital product settings.
 *
 * The API contract uses snake_case keys, matching plan2 §4.2/§15 (and the
 * settings module precedent) so the dashboard form and the audit `changedFields`
 * line up with the plan literally. The service maps this snake_case shape to/from
 * the typed `digital_product_settings` columns.
 *
 * This is foundation only: settings describe *whether and how* a product is sold
 * as digital codes. No code inventory, assignment, or delivery is implemented.
 */

/** Coerce blank strings to null so the UI can clear an optional field. */
const emptyToNull = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

/** Drops duplicates while preserving first-seen order. */
const dedupe = <T>(values: readonly T[]): T[] => [...new Set(values)];

/* ------------------------------ Field schemas ----------------------------- */

// Only the MVP fulfillment types are accepted (plan2 §2.1 — deferred types are
// rejected even though they exist in the DB-level vocabulary).
const fulfillmentTypeField = z.enum(MVP_FULFILLMENT_TYPES);
const deliveryModeField = z.enum(DELIVERY_MODES);
const codePoolStrategyField = z.enum(CODE_POOL_STRATEGIES);

// Status arrays may only contain valid WooCommerce order statuses; duplicates
// are collapsed. Empty is allowed (effectively "never reserve/deliver here").
const orderStatusArrayField = z
  .array(z.enum(ORDER_STATUSES))
  .max(ORDER_STATUSES.length)
  .transform(dedupe);

const lowStockThresholdField = z.number().int().min(0).max(1_000_000);
// plan2 §4.2: max_codes_per_order_item >= 1 and <= 500.
const maxCodesPerOrderItemField = z.number().int().min(1).max(500);
const instructionsTemplateField = z.preprocess(
  emptyToNull,
  z.string().trim().max(5000).nullable(),
);

/* ------------------------------- Full schema ------------------------------ */

const digitalSettingsBase = z.object({
  is_enabled: z.boolean(),
  fulfillment_type: fulfillmentTypeField,
  auto_delivery_enabled: z.boolean(),
  delivery_mode: deliveryModeField,
  code_pool_strategy: codePoolStrategyField,
  reserve_on_statuses: orderStatusArrayField,
  deliver_on_statuses: orderStatusArrayField,
  allow_manual_assignment: z.boolean(),
  allow_replacement: z.boolean(),
  low_stock_threshold: lowStockThresholdField,
  max_codes_per_order_item: maxCodesPerOrderItemField,
  instructions_template: instructionsTemplateField,
});

/**
 * The complete, validated settings shape. A code can only be *delivered* on a
 * status it was *reserved* on, so `deliver_on_statuses` must be a subset of
 * `reserve_on_statuses` (plan2 §15). Checked here (after merge) rather than on
 * the partial patch, since the rule spans both fields.
 */
export const digitalSettingsSchema = digitalSettingsBase.strict().refine(
  (s) =>
    s.deliver_on_statuses.every((status) =>
      s.reserve_on_statuses.includes(status),
    ),
  {
    message: "deliver_on_statuses must be a subset of reserve_on_statuses",
    path: ["deliver_on_statuses"],
  },
);

export type DigitalSettingsData = z.infer<typeof digitalSettingsSchema>;

/**
 * Body for PATCH /products/:id/digital-settings. Every field is optional
 * (partial update); unknown keys are rejected (strict) and at least one field
 * must be present. The subset rule is enforced on the merged result in the
 * service, not here.
 */
export const updateDigitalSettingsSchema = digitalSettingsBase
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one digital setting to update",
  });

export type UpdateDigitalSettingsInput = z.infer<
  typeof updateDigitalSettingsSchema
>;

/** Route params carrying the product id. */
export const digitalProductParamsSchema = z.object({
  id: z.string().uuid(),
});

export type DigitalProductParams = z.infer<typeof digitalProductParamsSchema>;

/* -------------------------------- Defaults -------------------------------- */

/**
 * Recommended defaults for a product that has never been configured (plan2 §2.2).
 * Mirrors the column defaults Sub-Agent A set, so a returned-default DTO matches
 * what the DB would store on first write.
 */
export const DIGITAL_SETTINGS_DEFAULTS: DigitalSettingsData = {
  is_enabled: false,
  fulfillment_type: "license_key",
  auto_delivery_enabled: true,
  delivery_mode: "automatic",
  code_pool_strategy: "fifo",
  reserve_on_statuses: ["processing", "on-hold", "completed"],
  deliver_on_statuses: ["processing", "completed"],
  allow_manual_assignment: true,
  allow_replacement: true,
  low_stock_threshold: 5,
  max_codes_per_order_item: 50,
  instructions_template: null,
};

/* ------------------------------ Merge helper ------------------------------ */

/**
 * Applies a partial patch over a complete settings object (one level deep — the
 * shape is flat). An omitted key keeps the current value; a present key (incl.
 * an explicit `null` for `instructions_template`) overrides it.
 */
export function mergeDigitalSettings(
  current: DigitalSettingsData,
  patch: UpdateDigitalSettingsInput,
): DigitalSettingsData {
  return { ...current, ...patch };
}

/* --------------------------- Audit metadata ------------------------------- */

/**
 * Builds the audit metadata for a settings update: the product id and the names
 * of the changed fields ONLY. The `instructions_template` *body* is never
 * included — even when it changes, only the field name "instructions_template"
 * is recorded (plan2 §15).
 */
export function digitalSettingsAuditMetadata(
  productId: string,
  patch: UpdateDigitalSettingsInput,
): { productId: string; changedFields: string[] } {
  return { productId, changedFields: Object.keys(patch) };
}
