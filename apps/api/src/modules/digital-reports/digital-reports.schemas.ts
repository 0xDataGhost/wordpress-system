import { z } from "zod";
import { ORDER_STATUSES } from "../../db/schema/orders";

/**
 * Validation for the Phase 21 digital reports API. Every report is read-only and
 * tenant-scoped; the store is always taken from the JWT, never the query. Filters
 * are optional and each report applies the subset that is meaningful for it (see
 * the service docs) — an inventory snapshot ignores the date range, a profit
 * report ignores `status` (it uses the canonical paid set), and so on.
 */

/** Inclusive `YYYY-MM-DD` date bounds; `dateTo` covers the whole calendar day. */
const dateRange = {
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
};

const dateOrderRefinement = (data: { dateFrom?: Date; dateTo?: Date }) =>
  !data.dateFrom || !data.dateTo || data.dateFrom.getTime() <= data.dateTo.getTime();

const DATE_ORDER_MESSAGE = {
  message: "dateFrom must be on or before dateTo",
  path: ["dateFrom"],
};

/**
 * Shared report filter (plan2 §21 "Filtering": date range, product, supplier,
 * status, currency — store is implicit). All optional; combined with the
 * mandatory tenant scope in the service layer.
 */
export const reportFiltersSchema = z
  .object({
    ...dateRange,
    productId: z.string().uuid().optional(),
    supplierId: z.string().uuid().optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    currency: z.string().trim().min(1).max(8).optional(),
  })
  .refine(dateOrderRefinement, DATE_ORDER_MESSAGE);

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

/** Stock-health query: a snapshot, so only the product filter applies. */
export const stockReportQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  /** Codes expiring within this many days count as "expiring" (1..365). */
  expiringWithinDays: z.coerce.number().int().min(1).max(365).default(30),
});

export type StockReportQuery = z.infer<typeof stockReportQuerySchema>;

/**
 * Resolves an optional inclusive `YYYY-MM-DD` range to a half-open `[start, end)`
 * window in UTC (matching `z.coerce.date` parsing and the audit-logs convention).
 * Either bound may be absent → that side is unbounded.
 */
export interface ResolvedDateRange {
  start: Date | null;
  end: Date | null;
}

function startOfDayUtc(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function startOfNextDayUtc(date: Date): Date {
  const copy = startOfDayUtc(date);
  copy.setUTCDate(copy.getUTCDate() + 1);
  return copy;
}

export function resolveDateRange(filters: {
  dateFrom?: Date;
  dateTo?: Date;
}): ResolvedDateRange {
  return {
    start: filters.dateFrom ? startOfDayUtc(filters.dateFrom) : null,
    end: filters.dateTo ? startOfNextDayUtc(filters.dateTo) : null,
  };
}
