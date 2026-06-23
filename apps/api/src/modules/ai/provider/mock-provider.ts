import type { AICompletionRequest, AIProvider } from "./ai-provider";

/**
 * Deterministic, offline AI provider. Used automatically when no OPENAI_API_KEY
 * is configured so the assistants work end-to-end (and tests stay hermetic)
 * without any external call. Output is built purely from the request `context`,
 * so it is stable for the same input — no randomness, no network, no Date.now.
 *
 * Responses are intentionally template-based, not "intelligent": swap in the
 * OpenAIProvider (set OPENAI_API_KEY) for real generation. The shape it returns
 * is identical to the real provider's, so the service/UI are unaffected.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async complete(req: AICompletionRequest): Promise<string> {
    switch (req.task) {
      case "product_description":
        return productDescription(req.context);
      case "sales_summary":
        return salesSummary(req.context);
      case "low_stock_insights":
        return lowStockInsights(req.context);
      default:
        return "";
    }
  }
}

function str(ctx: Record<string, unknown>, key: string, fallback = ""): string {
  const v = ctx[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;
}

function num(ctx: Record<string, unknown>, key: string): number {
  const v = ctx[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Returns a JSON string matching the product-description output shape. */
function productDescription(ctx: Record<string, unknown>): string {
  const name = str(ctx, "product_name", "المنتج");
  const category = str(ctx, "product_category");
  const context = str(ctx, "short_context");
  const categoryPart = category ? ` ضمن فئة ${category}` : "";
  const contextPart = context ? ` ${context}` : "";

  return JSON.stringify({
    title: name,
    short_description:
      `${name}${categoryPart} — جودة عالية وقيمة ممتازة.`.trim(),
    long_description:
      `${name} خيار مثالي${categoryPart}.${contextPart} ` +
      `يتميّز بجودة الصنع والاهتمام بالتفاصيل ليمنحك تجربة استخدام مريحة وموثوقة. ` +
      `مناسب للاستخدام اليومي ويجمع بين الأناقة والعملية.`.trim(),
    seo_description:
      `اشترِ ${name}${categoryPart} بأفضل سعر. جودة مضمونة وشحن سريع.`.trim(),
  });
}

/** Returns an Arabic natural-language sales summary. */
function salesSummary(ctx: Record<string, unknown>): string {
  const period = str(ctx, "periodLabel", "الفترة المحددة");
  const currency = str(ctx, "currency", "SAR");
  const revenue = str(ctx, "revenue", "0");
  const orders = num(ctx, "orders");
  const customers = num(ctx, "customers");
  const top = Array.isArray(ctx.topProducts)
    ? (ctx.topProducts as { name?: string }[])
    : [];
  const topNames = top
    .map((p) => p?.name)
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);

  const topLine =
    topNames.length > 0
      ? `أكثر المنتجات مبيعًا: ${topNames.join("، ")}.`
      : "لا توجد منتجات مباعة بارزة في هذه الفترة.";

  return (
    `خلال ${period}، بلغت إيرادات المتجر ${revenue} ${currency} ` +
    `من إجمالي ${orders} طلبًا، مع نشاط شراء من ${customers} عميلًا جديدًا. ` +
    `${topLine} ` +
    `${orders > 0 ? "يُنصح بالحفاظ على مستوى المخزون للمنتجات الأكثر مبيعًا ومتابعة أداء الفترة القادمة." : "يُنصح بمراجعة الحملات التسويقية لتحفيز الطلبات."}`
  );
}

/** Returns Arabic low-stock recommendations. */
function lowStockInsights(ctx: Record<string, unknown>): string {
  const threshold = num(ctx, "threshold");
  const products = Array.isArray(ctx.products)
    ? (ctx.products as { name?: string; stockQuantity?: number }[])
    : [];

  if (products.length === 0) {
    return `لا توجد منتجات منخفضة المخزون حاليًا (الحد ${threshold}). المخزون في وضع جيد.`;
  }

  const lines = products
    .slice(0, 10)
    .map((p) => {
      const name = p?.name ?? "منتج";
      const qty = typeof p?.stockQuantity === "number" ? p.stockQuantity : 0;
      const urgency = qty === 0 ? "نفد المخزون" : `متبقٍّ ${qty} فقط`;
      return `• ${name}: ${urgency} — يُوصى بإعادة الطلب قريبًا.`;
    })
    .join("\n");

  return (
    `يوجد ${products.length} منتج عند أو تحت حد المخزون (${threshold}):\n` +
    `${lines}\n` +
    `التوصية: أعطِ الأولوية للمنتجات النافدة، وراجع معدّل دورانها قبل تحديد كميات إعادة الطلب.`
  );
}
