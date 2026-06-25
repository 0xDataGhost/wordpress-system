/**
 * Pure, dependency-free financial/operational math for the digital reports
 * (Phase 21). Kept separate from the DB layer so every rule is unit-testable in
 * isolation — mirroring the `computeInvalidRate` helper in the suppliers module.
 *
 * Money is represented as exact 2-decimal strings (consistent with the rest of
 * the API, and byte-stable across JSON). Rates are numbers rounded to 4 dp.
 * "Unknown cost" is modelled as `null` and never coerced to zero (plan2 §21:
 * "If no cost, treat as unknown, not zero").
 */

/** Coerce a pg numeric/count (string | number | null | undefined) to a finite number. */
export function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce a value to an exact 2-decimal money string. */
export function money(value: unknown): string {
  return num(value).toFixed(2);
}

/**
 * Gross profit = revenue − cost. Returns `null` when the cost basis is unknown,
 * so an unknown cost is never silently reported as a profit equal to revenue.
 */
export function grossProfit(
  revenue: number,
  cost: number | null,
): number | null {
  if (cost === null) return null;
  return revenue - cost;
}

/**
 * Gross margin as a percentage = profit / revenue × 100, rounded to 2 dp.
 * `null` when profit is unknown or revenue is non-positive (no meaningful base).
 */
export function grossMargin(
  revenue: number,
  profit: number | null,
): number | null {
  if (profit === null || revenue <= 0) return null;
  return Math.round((profit / revenue) * 10000) / 100;
}

/** Ratio numerator/denominator rounded to 4 dp; 0 when the denominator ≤ 0. */
export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

/** Average = total / count as a 2-decimal money string; "0.00" when count ≤ 0. */
export function average(total: number, count: number): string {
  if (count <= 0) return "0.00";
  return (total / count).toFixed(2);
}

/** Current stock status of a product's available pool relative to its threshold. */
export type StockStatus = "out_of_stock" | "low" | "healthy";

export function stockStatus(available: number, threshold: number): StockStatus {
  if (available <= 0) return "out_of_stock";
  if (available <= threshold) return "low";
  return "healthy";
}
