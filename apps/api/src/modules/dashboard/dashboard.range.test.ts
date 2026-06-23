import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addUtcDays,
  dayKey,
  rangeDayBuckets,
  rangeDays,
  resolveRange,
  startOfUtcDay,
  startOfUtcMonth,
} from "./dashboard.range";

// Mid-afternoon UTC so any local-timezone leakage would change the day.
const NOW = new Date("2026-06-23T15:30:00.000Z");

test("startOfUtcDay zeroes the time in UTC", () => {
  assert.equal(startOfUtcDay(NOW).toISOString(), "2026-06-23T00:00:00.000Z");
});

test("startOfUtcMonth returns the first of the month in UTC", () => {
  assert.equal(startOfUtcMonth(NOW).toISOString(), "2026-06-01T00:00:00.000Z");
});

test("resolveRange today is [todayUTC, tomorrowUTC)", () => {
  const r = resolveRange({ period: "today" }, NOW);
  assert.equal(r.start.toISOString(), "2026-06-23T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-06-24T00:00:00.000Z");
  assert.equal(rangeDays(r), 1);
});

test("resolveRange 7d covers 7 day buckets ending tomorrow", () => {
  const r = resolveRange({ period: "7d" }, NOW);
  assert.equal(r.start.toISOString(), "2026-06-17T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-06-24T00:00:00.000Z");
  assert.equal(rangeDays(r), 7);
  assert.equal(rangeDayBuckets(r).length, 7);
});

test("resolveRange 30d covers 30 day buckets", () => {
  const r = resolveRange({ period: "30d" }, NOW);
  assert.equal(rangeDays(r), 30);
  assert.equal(r.end.toISOString(), "2026-06-24T00:00:00.000Z");
});

test("resolveRange this_month is the whole calendar month in UTC", () => {
  const r = resolveRange({ period: "this_month" }, NOW);
  assert.equal(r.start.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(rangeDays(r), 30);
});

test("resolveRange custom makes the end day fully inclusive", () => {
  const r = resolveRange(
    {
      period: "custom",
      dateFrom: new Date("2026-06-10"),
      dateTo: new Date("2026-06-12"),
    },
    NOW,
  );
  assert.equal(r.start.toISOString(), "2026-06-10T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2026-06-13T00:00:00.000Z");
  assert.equal(rangeDays(r), 3);
});

test("resolveRange custom without bounds throws", () => {
  assert.throws(() => resolveRange({ period: "custom" }, NOW));
});

test("rangeDayBuckets yields consecutive UTC day starts with stable keys", () => {
  const r = resolveRange({ period: "7d" }, NOW);
  const keys = rangeDayBuckets(r).map(dayKey);
  assert.deepEqual(keys, [
    "2026-06-17",
    "2026-06-18",
    "2026-06-19",
    "2026-06-20",
    "2026-06-21",
    "2026-06-22",
    "2026-06-23",
  ]);
});

test("month rollover is handled by addUtcDays", () => {
  assert.equal(
    addUtcDays(new Date("2026-01-31T00:00:00Z"), 1).toISOString(),
    "2026-02-01T00:00:00.000Z",
  );
});
