import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lowStockInsightsSchema,
  productDescriptionOutputSchema,
  productDescriptionSchema,
  salesSummarySchema,
} from "./ai.schemas";

test("productDescriptionSchema requires a name and defaults optionals", () => {
  const parsed = productDescriptionSchema.parse({ product_name: "قميص قطني" });
  assert.equal(parsed.product_name, "قميص قطني");
  assert.equal(parsed.product_category, "");
  assert.equal(parsed.short_context, "");
});

test("productDescriptionSchema rejects a too-short name", () => {
  assert.equal(
    productDescriptionSchema.safeParse({ product_name: "x" }).success,
    false,
  );
});

test("salesSummarySchema defaults to 30d and rejects custom/unknown", () => {
  assert.equal(salesSummarySchema.parse({}).range, "30d");
  assert.equal(salesSummarySchema.parse({ range: "7d" }).range, "7d");
  assert.equal(salesSummarySchema.safeParse({ range: "custom" }).success, false);
  assert.equal(salesSummarySchema.safeParse({ range: "year" }).success, false);
});

test("lowStockInsightsSchema accepts an empty object and rejects extra keys", () => {
  assert.equal(lowStockInsightsSchema.safeParse({}).success, true);
  assert.equal(lowStockInsightsSchema.safeParse({ foo: 1 }).success, false);
});

test("productDescriptionOutputSchema validates the four required keys", () => {
  assert.equal(
    productDescriptionOutputSchema.safeParse({
      title: "t",
      short_description: "s",
      long_description: "l",
      seo_description: "seo",
    }).success,
    true,
  );
  assert.equal(
    productDescriptionOutputSchema.safeParse({ title: "t" }).success,
    false,
  );
});
