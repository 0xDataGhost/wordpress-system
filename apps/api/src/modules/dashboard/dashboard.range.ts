/**
 * Pure, timezone-safe date-range resolution for the dashboard.
 *
 * All ranges are half-open [start, end) computed in UTC so results never shift
 * with the server's local timezone. Fixed periods (today / 7d / 30d / this_month)
 * are derived from a supplied `now`; `custom` uses inclusive YYYY-MM-DD bounds
 * (the end day is made fully inclusive by advancing to the next UTC midnight).
 */

export type DashboardPeriod = "today" | "7d" | "30d" | "this_month" | "custom";

export interface ResolvedRange {
  start: Date;
  end: Date;
  /** Stable key fragment for cache keys; rolls over as the window moves. */
  rangeKey: string;
}

/** Start of the UTC day containing `date`. */
export function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/** A new date `n` whole days after `date` (UTC). */
export function addUtcDays(date: Date, n: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

/** Start of the UTC month containing `date`. */
export function startOfUtcMonth(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(1);
  return copy;
}

/** First UTC midnight of the month after the one containing `date`. */
export function startOfNextUtcMonth(date: Date): Date {
  const copy = startOfUtcMonth(date);
  copy.setUTCMonth(copy.getUTCMonth() + 1);
  return copy;
}

function makeKey(start: Date, end: Date): string {
  return `${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`;
}

export interface ResolveRangeInput {
  period: DashboardPeriod;
  /** Inclusive lower bound (custom only). */
  dateFrom?: Date;
  /** Inclusive upper bound (custom only). */
  dateTo?: Date;
}

/**
 * Resolves a period (plus optional custom bounds) into a half-open [start, end)
 * UTC range. `now` is injected for determinism/testability.
 */
export function resolveRange(input: ResolveRangeInput, now: Date): ResolvedRange {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = addUtcDays(todayStart, 1);

  switch (input.period) {
    case "today":
      return { start: todayStart, end: tomorrowStart, rangeKey: makeKey(todayStart, tomorrowStart) };
    case "7d": {
      const start = addUtcDays(tomorrowStart, -7);
      return { start, end: tomorrowStart, rangeKey: makeKey(start, tomorrowStart) };
    }
    case "30d": {
      const start = addUtcDays(tomorrowStart, -30);
      return { start, end: tomorrowStart, rangeKey: makeKey(start, tomorrowStart) };
    }
    case "this_month": {
      const start = startOfUtcMonth(now);
      const end = startOfNextUtcMonth(now);
      return { start, end, rangeKey: makeKey(start, end) };
    }
    case "custom": {
      if (!input.dateFrom || !input.dateTo) {
        throw new Error("custom range requires dateFrom and dateTo");
      }
      const start = startOfUtcDay(input.dateFrom);
      const end = addUtcDays(startOfUtcDay(input.dateTo), 1); // inclusive end day
      return { start, end, rangeKey: makeKey(start, end) };
    }
    default: {
      // Exhaustiveness guard.
      const never: never = input.period;
      throw new Error(`Unknown period: ${String(never)}`);
    }
  }
}

/** Number of whole UTC days in a resolved range (used to build chart buckets). */
export function rangeDays(range: ResolvedRange): number {
  const ms = range.end.getTime() - range.start.getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
}

/** The list of UTC day-start dates spanning [start, end), one per bucket. */
export function rangeDayBuckets(range: ResolvedRange): Date[] {
  const buckets: Date[] = [];
  const count = rangeDays(range);
  for (let i = 0; i < count; i += 1) {
    buckets.push(addUtcDays(range.start, i));
  }
  return buckets;
}

/** A YYYY-MM-DD label for a UTC day-start date (chart x-axis key). */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
