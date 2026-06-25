import type {
  CodePoolStrategy,
  DeliveryMode,
  DigitalProductSettingsRow,
  MvpFulfillmentType,
} from "../../db/schema/digital-product-settings";
import type { OrderStatus } from "../../db/schema/orders";
import {
  DIGITAL_SETTINGS_DEFAULTS,
  type DigitalSettingsData,
} from "./digital-products.schemas";

/**
 * Public API shape of a product's digital fulfillment settings. Extends the
 * validated settings data with the product id and bookkeeping. `configured` is
 * false when no row exists yet (the data is pure defaults), letting the UI tell
 * "never configured" apart from "configured with default-looking values".
 */
export interface DigitalSettingsDto extends DigitalSettingsData {
  productId: string;
  configured: boolean;
  updatedAt: Date | null;
}

/** Maps a persisted settings row to the snake_case settings data shape. */
function settingsDataFromRow(
  row: DigitalProductSettingsRow,
): DigitalSettingsData {
  return {
    is_enabled: row.isEnabled,
    // Columns are written only through the validated service, so the free-text
    // columns always hold an in-vocabulary value.
    fulfillment_type: row.fulfillmentType as MvpFulfillmentType,
    auto_delivery_enabled: row.autoDeliveryEnabled,
    delivery_mode: row.deliveryMode as DeliveryMode,
    code_pool_strategy: row.codePoolStrategy as CodePoolStrategy,
    reserve_on_statuses: row.reserveOnStatuses as OrderStatus[],
    deliver_on_statuses: row.deliverOnStatuses as OrderStatus[],
    allow_manual_assignment: row.allowManualAssignment,
    allow_replacement: row.allowReplacement,
    low_stock_threshold: row.lowStockThreshold,
    max_codes_per_order_item: row.maxCodesPerOrderItem,
    instructions_template: row.instructionsTemplate,
  };
}

/**
 * Builds the DTO for a product's digital settings. When `row` is null the
 * product has no settings yet, so the recommended defaults are returned with
 * `configured: false` and no `updatedAt` — no row is created on read.
 */
export function toDigitalSettingsDto(
  productId: string,
  row: DigitalProductSettingsRow | null,
): DigitalSettingsDto {
  if (!row) {
    return {
      productId,
      configured: false,
      updatedAt: null,
      ...DIGITAL_SETTINGS_DEFAULTS,
    };
  }
  return {
    productId,
    configured: true,
    updatedAt: row.updatedAt,
    ...settingsDataFromRow(row),
  };
}
