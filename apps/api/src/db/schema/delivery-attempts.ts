import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { digitalDeliveries } from "./digital-deliveries";
import { orders } from "./orders";
import { stores } from "./stores";

/** Outcome of a single delivery attempt (plan2 §4.9). */
export const DELIVERY_ATTEMPT_STATUSES = [
  "queued",
  "sent",
  "failed",
  "skipped",
] as const;
export type DeliveryAttemptStatus = (typeof DELIVERY_ATTEMPT_STATUSES)[number];

/**
 * One send attempt for a delivery (Phase 18, plan2 §4.9). Tenant-scoped — every
 * row carries a `store_id` and ALL queries MUST scope by it. Keeps just enough
 * to drive retries (channel, provider, safe error code/message) and NEVER any
 * raw/decrypted code or full customer message body.
 */
export const deliveryAttempts = pgTable(
  "delivery_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    deliveryId: uuid("delivery_id")
      .notNull()
      .references(() => digitalDeliveries.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    errorCode: text("error_code"),
    // Safe, bounded error message for retry diagnostics — never a code.
    errorMessage: text("error_message"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    storeDeliveryIdx: index("delivery_attempts_store_delivery_idx").on(
      table.storeId,
      table.deliveryId,
      table.createdAt,
      table.id,
    ),
    storeOrderIdx: index("delivery_attempts_store_order_idx").on(
      table.storeId,
      table.orderId,
    ),
    storeStatusIdx: index("delivery_attempts_store_status_idx").on(
      table.storeId,
      table.status,
    ),
  }),
);

export type DeliveryAttemptRow = typeof deliveryAttempts.$inferSelect;
export type NewDeliveryAttemptRow = typeof deliveryAttempts.$inferInsert;
