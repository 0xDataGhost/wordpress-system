import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listOrdersQuerySchema,
  orderParamsSchema,
  updateOrderNotesSchema,
} from "./orders.schemas";

test("listOrdersQuerySchema defaults and coerces pagination", () => {
  const parsed = listOrdersQuerySchema.parse({});
  assert.equal(parsed.page, 1);
  assert.equal(parsed.limit, 20);

  const coerced = listOrdersQuerySchema.parse({ page: "2", limit: "50" });
  assert.equal(coerced.page, 2);
  assert.equal(coerced.limit, 50);
});

test("listOrdersQuerySchema caps limit and rejects page below 1", () => {
  assert.equal(listOrdersQuerySchema.safeParse({ limit: "101" }).success, false);
  assert.equal(listOrdersQuerySchema.safeParse({ page: "0" }).success, false);
});

test("listOrdersQuerySchema accepts a known status and rejects an unknown one", () => {
  assert.equal(
    listOrdersQuerySchema.safeParse({ status: "completed" }).success,
    true,
  );
  assert.equal(
    listOrdersQuerySchema.safeParse({ status: "shipped" }).success,
    false,
  );
});

test("listOrdersQuerySchema coerces date bounds and enforces ordering", () => {
  const parsed = listOrdersQuerySchema.parse({
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
  });
  assert.ok(parsed.dateFrom instanceof Date);
  assert.ok(parsed.dateTo instanceof Date);

  // dateFrom after dateTo must fail.
  assert.equal(
    listOrdersQuerySchema.safeParse({
      dateFrom: "2026-02-01",
      dateTo: "2026-01-01",
    }).success,
    false,
  );

  // An invalid date string must fail.
  assert.equal(
    listOrdersQuerySchema.safeParse({ dateFrom: "not-a-date" }).success,
    false,
  );
});

test("orderParamsSchema accepts a uuid and rejects other strings", () => {
  assert.equal(
    orderParamsSchema.safeParse({
      id: "3f9a1c7b-2d4e-5f60-8a1b-2c3d4e5f6071",
    }).success,
    true,
  );
  assert.equal(orderParamsSchema.safeParse({ id: "42" }).success, false);
});

test("updateOrderNotesSchema accepts text, null, and trims whitespace", () => {
  assert.equal(
    updateOrderNotesSchema.parse({ internalNotes: "  ملاحظة  " }).internalNotes,
    "ملاحظة",
  );
  assert.equal(updateOrderNotesSchema.parse({ internalNotes: null }).internalNotes, null);
  // Omitted is allowed (nullish) — clears nothing on its own.
  assert.equal(updateOrderNotesSchema.safeParse({}).success, true);
});

test("updateOrderNotesSchema rejects notes over the length cap", () => {
  const tooLong = "a".repeat(5001);
  assert.equal(
    updateOrderNotesSchema.safeParse({ internalNotes: tooLong }).success,
    false,
  );
});
