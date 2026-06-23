import assert from "node:assert/strict";
import { test } from "node:test";
import { productDescriptionOutputSchema } from "../ai.schemas";
import { MockAIProvider } from "./mock-provider";
import type { AICompletionRequest } from "./ai-provider";

const provider = new MockAIProvider();

function req(
  task: AICompletionRequest["task"],
  context: Record<string, unknown>,
  json = false,
): AICompletionRequest {
  return { task, system: "", user: "", json, context };
}

test("mock product_description returns valid JSON matching the output schema", async () => {
  const out = await provider.complete(
    req("product_description", {
      product_name: "قميص قطني",
      product_category: "ملابس",
      short_context: "قطن مصري",
    }),
    true,
  );
  const parsed = productDescriptionOutputSchema.safeParse(JSON.parse(out));
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.title, "قميص قطني");
    assert.match(parsed.data.short_description, /ملابس/);
  }
});

test("mock provider is deterministic for the same input", async () => {
  const ctx = { product_name: "حذاء", product_category: "أحذية", short_context: "" };
  const a = await provider.complete(req("product_description", ctx));
  const b = await provider.complete(req("product_description", ctx));
  assert.equal(a, b);
});

test("mock sales_summary narrates the supplied metrics in Arabic", async () => {
  const out = await provider.complete(
    req("sales_summary", {
      periodLabel: "آخر ٣٠ يومًا",
      currency: "SAR",
      revenue: "1500.00",
      orders: 12,
      customers: 5,
      topProducts: [{ name: "منتج أ" }, { name: "منتج ب" }],
    }),
  );
  assert.match(out, /1500\.00 SAR/);
  assert.match(out, /12 طلب/);
  assert.match(out, /منتج أ/);
});

test("mock low_stock_insights lists products and handles the empty case", async () => {
  const withProducts = await provider.complete(
    req("low_stock_insights", {
      threshold: 5,
      products: [
        { name: "منتج Y", stockQuantity: 0 },
        { name: "منتج X", stockQuantity: 2 },
      ],
    }),
  );
  assert.match(withProducts, /منتج Y/);
  assert.match(withProducts, /نفد المخزون/);

  const empty = await provider.complete(
    req("low_stock_insights", { threshold: 5, products: [] }),
  );
  assert.match(empty, /لا توجد منتجات منخفضة المخزون/);
});
