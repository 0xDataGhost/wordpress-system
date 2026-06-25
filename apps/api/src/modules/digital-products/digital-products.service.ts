import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  digitalProductSettings,
  type DigitalProductSettingsRow,
} from "../../db/schema/digital-product-settings";
import { products } from "../../db/schema/products";
import { NotFoundError, ValidationError } from "../../lib/errors";
import {
  DIGITAL_SETTINGS_DEFAULTS,
  digitalSettingsSchema,
  mergeDigitalSettings,
  type DigitalSettingsData,
  type UpdateDigitalSettingsInput,
} from "./digital-products.schemas";

/**
 * Loads a product scoped to the store, throwing 404 when it does not exist (or
 * belongs to another tenant). This is the tenant-isolation guard for every
 * digital-settings operation: settings can only be read/written for a product
 * the caller's store owns.
 */
async function getOwnedProduct(
  storeId: string,
  productId: string,
): Promise<{ id: string; status: string }> {
  const [row] = await db
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.id, productId)))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Product not found");
  }
  return row;
}

/** Fetches the settings row for a (store, product), or null when none exists. */
async function findSettingsRow(
  storeId: string,
  productId: string,
): Promise<DigitalProductSettingsRow | null> {
  const [row] = await db
    .select()
    .from(digitalProductSettings)
    .where(
      and(
        eq(digitalProductSettings.storeId, storeId),
        eq(digitalProductSettings.productId, productId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Returns a product's digital settings, validating tenant ownership first.
 * Returns null when the product has no settings yet — the caller/serializer
 * surfaces defaults WITHOUT creating a row (plan2 §15 service behaviour).
 */
export async function getDigitalSettings(
  storeId: string,
  productId: string,
): Promise<DigitalProductSettingsRow | null> {
  await getOwnedProduct(storeId, productId);
  return findSettingsRow(storeId, productId);
}

/** Maps the validated snake_case settings to typed column values for upsert. */
function settingsColumnValues(data: DigitalSettingsData) {
  return {
    isEnabled: data.is_enabled,
    fulfillmentType: data.fulfillment_type,
    autoDeliveryEnabled: data.auto_delivery_enabled,
    deliveryMode: data.delivery_mode,
    codePoolStrategy: data.code_pool_strategy,
    reserveOnStatuses: data.reserve_on_statuses,
    deliverOnStatuses: data.deliver_on_statuses,
    allowManualAssignment: data.allow_manual_assignment,
    allowReplacement: data.allow_replacement,
    lowStockThreshold: data.low_stock_threshold,
    maxCodesPerOrderItem: data.max_codes_per_order_item,
    instructionsTemplate: data.instructions_template,
  };
}

export interface UpdateDigitalSettingsResult {
  row: DigitalProductSettingsRow;
  /** Names of the fields present in the patch — for the audit log. */
  changedFields: string[];
}

/**
 * Applies a partial digital-settings update for a store-owned product: merges
 * the patch onto the current settings (or the recommended defaults when none
 * exist), validates the COMPLETE merged result (including the deliver⊆reserve
 * rule), then upserts the single (store, product) row. Tenant-scoped — only the
 * caller's store row is ever touched.
 */
export async function updateDigitalSettings(
  storeId: string,
  productId: string,
  patch: UpdateDigitalSettingsInput,
): Promise<UpdateDigitalSettingsResult> {
  const product = await getOwnedProduct(storeId, productId);
  if (product.status === "archived") {
    throw new ValidationError(
      "Cannot configure digital fulfillment for an archived product",
    );
  }

  const existing = await findSettingsRow(storeId, productId);
  const current: DigitalSettingsData = existing
    ? // Re-validate the stored row through the schema so the merge base is a
      // clean, fully-typed object (and any legacy/partial row is normalized).
      digitalSettingsSchema.parse({
        is_enabled: existing.isEnabled,
        fulfillment_type: existing.fulfillmentType,
        auto_delivery_enabled: existing.autoDeliveryEnabled,
        delivery_mode: existing.deliveryMode,
        code_pool_strategy: existing.codePoolStrategy,
        reserve_on_statuses: existing.reserveOnStatuses,
        deliver_on_statuses: existing.deliverOnStatuses,
        allow_manual_assignment: existing.allowManualAssignment,
        allow_replacement: existing.allowReplacement,
        low_stock_threshold: existing.lowStockThreshold,
        max_codes_per_order_item: existing.maxCodesPerOrderItem,
        instructions_template: existing.instructionsTemplate,
      })
    : DIGITAL_SETTINGS_DEFAULTS;

  const merged = mergeDigitalSettings(current, patch);
  const result = digitalSettingsSchema.safeParse(merged);
  if (!result.success) {
    throw new ValidationError(
      "Invalid digital settings",
      result.error.flatten(),
    );
  }

  const values = settingsColumnValues(result.data);
  const now = new Date();
  const [row] = await db
    .insert(digitalProductSettings)
    .values({ storeId, productId, ...values })
    .onConflictDoUpdate({
      target: [
        digitalProductSettings.storeId,
        digitalProductSettings.productId,
      ],
      set: { ...values, updatedAt: now },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to upsert digital product settings");
  }
  return { row, changedFields: Object.keys(patch) };
}
