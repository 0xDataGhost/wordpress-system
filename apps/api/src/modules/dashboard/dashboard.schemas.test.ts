import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lowStockQuerySchema,
  rangeQuerySchema,
  recentOrdersQuerySchema,
  summaryQuerySchema,
  topProductsQuerySchema,
} from "./dashboard.schemas";

test("rangeQuerySchema defaults period to 7d and refresh to false", () => {
  const parsed = rangeQuerySchema.parse({});
  assert.equal(parsed.period, "7d");
  assert.equal(parsed.refresh, false);
});

test("rangeQuerySchema parses refresh=true and coerces dates", () => {
  const parsed = rangeQuerySchema.parse({
    period: "custom",
    dateFrom: "2026-06-01",
    dateTo: "2026-06-07",
    refresh: "true",
  });
  assert.equal(parsed.refresh, true);
  assert.ok(parsed.dateFrom instanceof Date);
});

test("rangeQuerySchema requires both bounds for custom and orders them", () => {
  assert.equal(rangeQuerySchema.safeParse({ period: "custom" }).success, false);
  assert.equal(
    rangeQuerySchema.safeParse({
      period: "custom",
      dateFrom: "2026-06-10",
      dateTo: "2026-06-01",
    }).success,
    false,
  );
});

test("rangeQuerySchema rejects an unknown period", () => {
  assert.equal(rangeQuerySchema.safeParse({ period: "year" }).success, false);
});

test("rangeQuerySchema caps the custom range span at 366 days", () => {
  // ~1 year is allowed.
  assert.equal(
    rangeQuerySchema.safeParse({
      period: "custom",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    }).success,
    true,
  );
  // Multi-year is rejected.
  assert.equal(
    rangeQuerySchema.safeParse({
      period: "custom",
      dateFrom: "2020-01-01",
      dateTo: "2030-01-01",
    }).success,
    false,
  );
});

test("topProductsQuerySchema also caps the custom range span", () => {
  assert.equal(
    topProductsQuerySchema.safeParse({
      period: "custom",
      dateFrom: "2000-01-01",
      dateTo: "2026-01-01",
    }).success,
    false,
  );
});

test("summaryQuerySchema exposes only a refresh flag", () => {
  const parsed = summaryQuerySchema.parse({ refresh: "true" });
  assert.equal(parsed.refresh, true);
  assert.equal(summaryQuerySchema.parse({}).refresh, false);
});

test("topProductsQuerySchema defaults and caps the limit", () => {
  assert.equal(topProductsQuerySchema.parse({}).limit, 5);
  assert.equal(topProductsQuerySchema.parse({ limit: "10" }).limit, 10);
  assert.equal(topProductsQuerySchema.safeParse({ limit: "51" }).success, false);
});

test("recentOrdersQuerySchema defaults and caps the limit", () => {
  assert.equal(recentOrdersQuerySchema.parse({}).limit, 5);
  assert.equal(recentOrdersQuerySchema.safeParse({ limit: "0" }).success, false);
});

test("lowStockQuerySchema makes threshold optional and caps the limit", () => {
  const parsed = lowStockQuerySchema.parse({});
  assert.equal(parsed.limit, 5);
  assert.equal(parsed.threshold, undefined);
  assert.equal(lowStockQuerySchema.parse({ threshold: "3" }).threshold, 3);
  assert.equal(lowStockQuerySchema.safeParse({ limit: "101" }).success, false);
});
