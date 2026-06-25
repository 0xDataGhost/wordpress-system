import { z } from "zod";
import { DELIVERY_CHANNELS, DELIVERY_STATUSES } from "../../db/schema/digital-deliveries";

/**
 * Validation for the Phase 18 delivery endpoints. Delivery works on orders by id
 * and never accepts or returns raw codes.
 */

/**
 * Body for POST /digital-delivery/orders/:orderId/deliver. `channel` defaults to
 * the safe `dashboard` channel. `force` re-delivers even when codes are already
 * delivered (creates a fresh delivery + attempt) — without it, a fully-delivered
 * order is an idempotent no-op (no duplicate customer message).
 */
export const deliverSchema = z.object({
  channel: z.enum(DELIVERY_CHANNELS).default("dashboard"),
  force: z.boolean().default(false),
});

export type DeliverInput = z.infer<typeof deliverSchema>;

/** Body for POST /digital-delivery/orders/:orderId/retry. */
export const retrySchema = z.object({
  channel: z.enum(DELIVERY_CHANNELS).default("dashboard"),
});

export type RetryInput = z.infer<typeof retrySchema>;

export const deliveryParamsSchema = z.object({ id: z.string().uuid() });
export type DeliveryParams = z.infer<typeof deliveryParamsSchema>;

export const listDeliveriesQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
  status: z.enum(DELIVERY_STATUSES).optional(),
  channel: z.enum(DELIVERY_CHANNELS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
