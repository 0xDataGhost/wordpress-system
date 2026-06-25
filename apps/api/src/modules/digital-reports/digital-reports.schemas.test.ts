import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reportFiltersSchema,
  resolveDateRange,
  stockReportQuerySchema,
} from "./digital-reports.schemas";

test("reportFiltersSchema: accepts an empty query (all filters optional)", () => {
  const parsed = reportFiltersSchema.parse({});
  assert.equal(parsed.productId, undefined);
  assert.equal(parsed.status, undefined);
});

test("reportFiltersSchema: coerces dates and accepts valid filters", () => {
  const parsed = reportFiltersSchema.parse({
    dateFrom: "2026-06-01",
    dateTo: "2026-06-30",
    productId: "11111111-1111-1111-1111-111111111111",
    status: "completed",
    currency: "SAR",
  });
  assert.ok(parsed.dateFrom instanceof Date);
  assert.equal(parsed.status, "completed");
  assert.equal(parsed.currency, "SAR");
});

test("reportFiltersSchema: rejects dateFrom after dateTo", () => {
  const result = reportFiltersSchema.safeParse({
    dateFrom: "2026-06-30",
    dateTo: "2026-06-01",
  });
  assert.equal(result.success, false);
});

test("reportFiltersSchema: rejects an invalid order status", () => {
  const result = reportFiltersSchema.safeParse({ status: "shipped" });
  assert.equal(result.success, false);
});

test("reportFiltersSchema: rejects a non-uuid productId", () => {
  const result = reportFiltersSchema.safeParse({ productId: "not-a-uuid" });
  assert.equal(result.success, false);
});

test("stockReportQuerySchema: defaults expiringWithinDays to 30", () => {
  const parsed = stockReportQuerySchema.parse({});
  assert.equal(parsed.expiringWithinDays, 30);
});

test("stockReportQuerySchema: bounds expiringWithinDays to 1..365", () => {
  assert.equal(stockReportQuerySchema.safeParse({ expiringWithinDays: 0 }).success, false);
  assert.equal(stockReportQuerySchema.safeParse({ expiringWithinDays: 366 }).success, false);
  assert.equal(stockReportQuerySchema.parse({ expiringWithinDays: "45" }).expiringWithinDays, 45);
});

test("resolveDateRange: builds half-open [start, nextDay) in UTC", () => {
  const { start, end } = resolveDateRange({
    dateFrom: new Date("2026-06-01T00:00:00.000Z"),
    dateTo: new Date("2026-06-30T00:00:00.000Z"),
  });
  assert.equal(start?.toISOString(), "2026-06-01T00:00:00.000Z");
  // dateTo is inclusive → end is the start of the following day.
  assert.equal(end?.toISOString(), "2026-07-01T00:00:00.000Z");
});

test("resolveDateRange: absent bounds stay null (unbounded)", () => {
  const range = resolveDateRange({});
  assert.equal(range.start, null);
  assert.equal(range.end, null);
});
