import { z } from "zod";

/** `?refresh=true` bypasses the cache read; anything else (or absent) does not. */
const refreshField = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const periodField = z
  .enum(["today", "7d", "30d", "this_month", "custom"])
  .default("7d");

/**
 * Upper bound on a custom range so chart bucket generation, response size, and
 * cache payloads stay bounded. 366 days (~1 year inclusive) comfortably exceeds
 * the fixed periods while preventing unbounded multi-year requests.
 */
const MAX_CUSTOM_RANGE_DAYS = 366;

interface CustomRangeShape {
  period: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** True unless a custom range exceeds the inclusive-day cap. */
function customSpanWithinLimit(d: CustomRangeShape): boolean {
  if (d.period !== "custom" || !d.dateFrom || !d.dateTo) return true;
  const inclusiveDays =
    (d.dateTo.getTime() - d.dateFrom.getTime()) / 86_400_000 + 1;
  return inclusiveDays <= MAX_CUSTOM_RANGE_DAYS;
}

const SPAN_MESSAGE = `custom range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`;

/**
 * Range query shared by the chart + top-product endpoints. `custom` requires
 * both `dateFrom` and `dateTo` (inclusive YYYY-MM-DD bounds, dateFrom <= dateTo,
 * span <= MAX_CUSTOM_RANGE_DAYS).
 */
export const rangeQuerySchema = z
  .object({
    period: periodField,
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    refresh: refreshField,
  })
  .refine(
    (d) =>
      d.period !== "custom" ||
      (d.dateFrom !== undefined && d.dateTo !== undefined),
    { message: "custom period requires dateFrom and dateTo", path: ["period"] },
  )
  .refine(
    (d) =>
      !d.dateFrom ||
      !d.dateTo ||
      d.dateFrom.getTime() <= d.dateTo.getTime(),
    { message: "dateFrom must be on or before dateTo", path: ["dateFrom"] },
  )
  .refine(customSpanWithinLimit, { message: SPAN_MESSAGE, path: ["dateTo"] });

/** Summary KPIs are fixed-period (today / this month / totals) — no range. */
export const summaryQuerySchema = z.object({
  refresh: refreshField,
});

/** Range query plus a result limit (top products). */
export const topProductsQuerySchema = z
  .object({
    period: periodField,
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(5),
    refresh: refreshField,
  })
  .refine(
    (d) =>
      d.period !== "custom" ||
      (d.dateFrom !== undefined && d.dateTo !== undefined),
    { message: "custom period requires dateFrom and dateTo", path: ["period"] },
  )
  .refine(
    (d) => !d.dateFrom || !d.dateTo || d.dateFrom.getTime() <= d.dateTo.getTime(),
    { message: "dateFrom must be on or before dateTo", path: ["dateFrom"] },
  )
  .refine(customSpanWithinLimit, { message: SPAN_MESSAGE, path: ["dateTo"] });

/** Recent orders: just a limit (not range-based). */
export const recentOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
  refresh: refreshField,
});

/** Low stock: limit + optional threshold override (not range-based). */
export const lowStockQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(5),
  threshold: z.coerce.number().int().min(0).max(100000).optional(),
  refresh: refreshField,
});

export type RangeQuery = z.infer<typeof rangeQuerySchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>;
export type RecentOrdersQuery = z.infer<typeof recentOrdersQuerySchema>;
export type LowStockQuery = z.infer<typeof lowStockQuerySchema>;
