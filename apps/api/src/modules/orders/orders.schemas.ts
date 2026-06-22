import { z } from "zod";
import { ORDER_STATUSES } from "../../db/schema/orders";

const statusField = z.enum(ORDER_STATUSES);

/**
 * Query for GET /orders (search + status filter + date range + pagination).
 *
 * `search` matches the order number or — when a customer is linked — the
 * customer name/email/phone. `dateFrom`/`dateTo` filter on the order date
 * (placed-at, falling back to created-at) as inclusive YYYY-MM-DD bounds.
 */
export const listOrdersQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    status: statusField.optional(),
    // Inclusive date bounds (YYYY-MM-DD). dateTo covers the whole day.
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (data) =>
      !data.dateFrom || !data.dateTo || data.dateFrom.getTime() <= data.dateTo.getTime(),
    { message: "dateFrom must be on or before dateTo", path: ["dateFrom"] },
  );

/** Route params carrying an order id. */
export const orderParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Body for PATCH /orders/:id/notes. `internalNotes` may be cleared with an empty
 * string or null. Trimmed and length-capped; notes are dashboard-only and never
 * pushed back to WooCommerce.
 */
export const updateOrderNotesSchema = z.object({
  internalNotes: z.string().trim().max(5000).nullish(),
});

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type OrderParams = z.infer<typeof orderParamsSchema>;
export type UpdateOrderNotesInput = z.infer<typeof updateOrderNotesSchema>;
