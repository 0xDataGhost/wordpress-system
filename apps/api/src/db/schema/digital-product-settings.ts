import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { stores } from "./stores";

/**
 * Canonical digital fulfillment types (plan2 §2.1). The `fulfillment_type`
 * column stays free text (so deferred types can be introduced without a
 * migration), but this list is the source of truth for validation and the
 * dashboard's labels — mirroring how product/order status vocabularies are
 * modelled elsewhere in the schema.
 */
export const FULFILLMENT_TYPES = [
  "manual",
  "license_key",
  "gift_card_code",
  "subscription_code",
  "account_credentials",
  "file_or_link",
  "service_activation",
] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

/**
 * The fulfillment types enabled for the digital-fulfillment MVP (plan2 §2.1 —
 * "implement these first"). The deferred types stay in FULFILLMENT_TYPES so the
 * vocabulary is complete, but Phase 15 validation should accept only this set.
 */
export const MVP_FULFILLMENT_TYPES = [
  "license_key",
  "subscription_code",
  "gift_card_code",
] as const;
export type MvpFulfillmentType = (typeof MVP_FULFILLMENT_TYPES)[number];

/** How assigned codes reach the customer (plan2 §4.2 validation). */
export const DELIVERY_MODES = ["automatic", "manual", "review_first"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

/** How a code is picked from the product's pool (plan2 §4.2 validation). */
export const CODE_POOL_STRATEGIES = [
  "fifo",
  "lifo",
  "earliest_expiry",
  "random",
] as const;
export type CodePoolStrategy = (typeof CODE_POOL_STRATEGIES)[number];

/**
 * Per-product digital fulfillment settings (Phase 15, plan2 §4.2). Tenant-scoped:
 * every row carries a `store_id` and ALL queries MUST scope by it — there is no
 * cross-store read. A product has at most one settings row per store (the
 * `(store_id, product_id)` unique index), lazily upserted the first time a store
 * configures digital fulfillment for that product.
 *
 * This phase is foundation only: it records *whether and how* a product is sold
 * as digital codes. It deliberately holds no code inventory, assignments, or
 * delivery state — those tables arrive in Phases 16+.
 *
 * `fulfillment_type` / `delivery_mode` / `code_pool_strategy` stay free text at
 * the DB level (backed by the canonical constant lists above); the service
 * validates the shape with Zod. The status arrays hold WooCommerce order
 * statuses (see ORDER_STATUSES) that trigger reservation / delivery. `metadata`
 * stays a generic jsonb so later phases can extend without a migration.
 */
export const digitalProductSettings = pgTable(
  "digital_product_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Tenant scope.
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    // The catalog product these settings configure. One row per (store, product).
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    // One of FULFILLMENT_TYPES (free text to tolerate deferred kinds).
    fulfillmentType: text("fulfillment_type").notNull().default("license_key"),
    // Master switch — digital fulfillment is off until a store opts in.
    isEnabled: boolean("is_enabled").notNull().default(false),
    // Whether eligible paid orders auto-deliver (vs. await manual action).
    autoDeliveryEnabled: boolean("auto_delivery_enabled")
      .notNull()
      .default(true),
    // One of DELIVERY_MODES.
    deliveryMode: text("delivery_mode").notNull().default("automatic"),
    // One of CODE_POOL_STRATEGIES.
    codePoolStrategy: text("code_pool_strategy").notNull().default("fifo"),
    // WooCommerce order statuses that reserve codes for the order.
    reserveOnStatuses: text("reserve_on_statuses")
      .array()
      .notNull()
      .default(sql`ARRAY['processing','on-hold','completed']::text[]`),
    // WooCommerce order statuses that trigger delivery of reserved codes.
    deliverOnStatuses: text("deliver_on_statuses")
      .array()
      .notNull()
      .default(sql`ARRAY['processing','completed']::text[]`),
    // Whether staff may hand-pick a code for an order item.
    allowManualAssignment: boolean("allow_manual_assignment")
      .notNull()
      .default(true),
    // Whether a delivered/invalid code may be replaced with another.
    allowReplacement: boolean("allow_replacement").notNull().default(true),
    // Raise a low-stock signal when available codes fall to/under this count.
    lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
    // Safety cap on codes assignable to a single order line item.
    maxCodesPerOrderItem: integer("max_codes_per_order_item")
      .notNull()
      .default(50),
    // Optional customer-facing instructions shown alongside delivered codes.
    instructionsTemplate: text("instructions_template"),
    // Generic structured extension point; validated by the service if used.
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Exactly one settings row per (store, product). Also backs the lazy
    // provisioning upsert (onConflictDoNothing/DoUpdate on this target).
    storeProductUnique: uniqueIndex(
      "digital_product_settings_store_product_unique",
    ).on(table.storeId, table.productId),
    // Backs the digital-products listing / "enabled?" filter on the catalog.
    storeEnabledIdx: index("digital_product_settings_store_enabled_idx").on(
      table.storeId,
      table.isEnabled,
    ),
    // Backs filtering digital products by fulfillment type within a store.
    storeFulfillmentTypeIdx: index(
      "digital_product_settings_store_fulfillment_type_idx",
    ).on(table.storeId, table.fulfillmentType),
    // Supports product-centric lookups (e.g. joining settings onto a product).
    productIdx: index("digital_product_settings_product_idx").on(
      table.productId,
    ),
  }),
);

export type DigitalProductSettingsRow =
  typeof digitalProductSettings.$inferSelect;
export type NewDigitalProductSettingsRow =
  typeof digitalProductSettings.$inferInsert;
