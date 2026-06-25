import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";
import { orders } from "./orders";
import { stores } from "./stores";
import { users } from "./users";

/** Lifecycle of a delivery package (plan2 §4.8). Free text backed by this list. */
export const DELIVERY_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "manual_review",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Delivery channels (plan2 §4.8 / §18). `dashboard` is the safe MVP channel. */
export const DELIVERY_CHANNELS = [
  "dashboard",
  "email",
  "whatsapp",
  "woocommerce_note",
  "manual",
] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

/**
 * A delivery package for an order (Phase 18, plan2 §4.8). Tenant-scoped: every
 * row carries a `store_id` and ALL queries MUST scope by it.
 *
 * SECURITY: `message_preview` stores a SAFE, masked rendering only — it never
 * contains raw codes (Phase 18 channels deliver "codes ready" notices, not the
 * codes themselves; staff reveal codes via the audited Phase 16 reveal endpoint).
 * No raw or decrypted code is ever persisted here.
 */
export const digitalDeliveries = pgTable(
  "digital_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    channel: text("channel").notNull().default("dashboard"),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    subject: text("subject"),
    // Masked preview only — NEVER contains raw codes.
    messagePreview: text("message_preview"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Safe failure reason for retry — never a code.
    failedReason: text("failed_reason"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    storeOrderIdx: index("digital_deliveries_store_order_idx").on(
      table.storeId,
      table.orderId,
    ),
    storeStatusIdx: index("digital_deliveries_store_status_idx").on(
      table.storeId,
      table.status,
    ),
    storeCreatedIdx: index("digital_deliveries_store_created_idx").on(
      table.storeId,
      table.createdAt,
      table.id,
    ),
  }),
);

export type DigitalDeliveryRow = typeof digitalDeliveries.$inferSelect;
export type NewDigitalDeliveryRow = typeof digitalDeliveries.$inferInsert;
