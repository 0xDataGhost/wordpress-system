/**
 * Digital product settings API client (Phase 15 — Digital Product Foundation).
 *
 * Calls the backend digital-products module (mounted under /api/v1/products)
 * through the shared HTTP client, which attaches the Bearer token and unwraps
 * the response envelope:
 *   getDigitalSettings    → GET   /products/:id/digital-settings  (JWT, digital_inventory.view)
 *   updateDigitalSettings → PATCH /products/:id/digital-settings  (JWT, digital_inventory.edit)
 *
 * The contract is snake_case (matching plan2 §4.2/§15). Failures surface as
 * `ApiError` from lib/http; pages render `error.message` directly.
 *
 * Foundation only: this configures *whether and how* a product is sold as
 * digital codes. No code inventory, import, assignment, or delivery here.
 */

import { apiRequest } from "./http";
import type { OrderStatus } from "./orders-api";

/** Fulfillment types enabled for the MVP (plan2 §2.1 — deferred types rejected). */
export type FulfillmentType =
  | "license_key"
  | "subscription_code"
  | "gift_card_code";

export type DeliveryMode = "automatic" | "manual" | "review_first";

export type CodePoolStrategy = "fifo" | "lifo" | "earliest_expiry" | "random";

/** The validated settings payload (snake_case, mirrors the backend DTO). */
export interface DigitalSettingsData {
  is_enabled: boolean;
  fulfillment_type: FulfillmentType;
  auto_delivery_enabled: boolean;
  delivery_mode: DeliveryMode;
  code_pool_strategy: CodePoolStrategy;
  reserve_on_statuses: OrderStatus[];
  deliver_on_statuses: OrderStatus[];
  allow_manual_assignment: boolean;
  allow_replacement: boolean;
  low_stock_threshold: number;
  max_codes_per_order_item: number;
  instructions_template: string | null;
}

export interface DigitalSettingsDto extends DigitalSettingsData {
  productId: string;
  /** False when the product has never been configured (data is pure defaults). */
  configured: boolean;
  updatedAt: string | null;
}

/** Partial update body — any subset of the settings fields. */
export type UpdateDigitalSettingsInput = Partial<DigitalSettingsData>;

export async function getDigitalSettings(
  productId: string,
): Promise<DigitalSettingsDto> {
  return apiRequest<DigitalSettingsDto>(
    `/products/${productId}/digital-settings`,
    { method: "GET" },
  );
}

export async function updateDigitalSettings(
  productId: string,
  patch: UpdateDigitalSettingsInput,
): Promise<DigitalSettingsDto> {
  return apiRequest<DigitalSettingsDto>(
    `/products/${productId}/digital-settings`,
    { method: "PATCH", body: patch },
  );
}
