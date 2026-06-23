import { and, count, eq, gte, lt } from "drizzle-orm";
import { db } from "../../db";
import { customers } from "../../db/schema/customers";
import { env } from "../../config/env";
import { ServiceUnavailableError } from "../../lib/errors";
import {
  getLowStock,
  getOrdersChart,
  getSalesChart,
  getTopProducts,
} from "../dashboard/dashboard.service";
import { resolveRange } from "../dashboard/dashboard.range";
import { getAIProvider } from "./provider";
import {
  productDescriptionOutputSchema,
  type ProductDescriptionInput,
  type ProductDescriptionOutput,
  type SalesSummaryInput,
} from "./ai.schemas";

const TOP_PRODUCTS_LIMIT = 5;
const LOW_STOCK_LIMIT = 20;

/** Arabic label for each supported range preset. */
const RANGE_LABELS: Record<SalesSummaryInput["range"], string> = {
  today: "اليوم",
  "7d": "آخر ٧ أيام",
  "30d": "آخر ٣٠ يومًا",
  this_month: "هذا الشهر",
};

/** Strips ```json fences (defensive) and parses a JSON object from text. */
function parseJsonObject(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new ServiceUnavailableError(
      "تعذّر تفسير استجابة الذكاء الاصطناعي. حاول مرة أخرى.",
    );
  }
}

/* ------------------------ 1. Product Description -------------------------- */

export interface ProductDescriptionResult extends ProductDescriptionOutput {
  provider: string;
}

/**
 * Generates marketing copy for a product from user input only (no store data).
 * Returns a validated { title, short/long/seo description }. Suggestions only —
 * nothing is persisted and no product is modified.
 */
export async function generateProductDescription(
  input: ProductDescriptionInput,
): Promise<ProductDescriptionResult> {
  const provider = getAIProvider();

  const system =
    "أنت كاتب محتوى تسويقي محترف لمتاجر التجزئة العربية. " +
    "أعد فقط كائن JSON صالحًا بالمفاتيح التالية بالضبط: " +
    "title, short_description, long_description, seo_description. " +
    "اكتب بالعربية الفصحى المبسطة، ولا تخترع مواصفات غير مذكورة.";

  const user =
    `اسم المنتج: ${input.product_name}\n` +
    `الفئة: ${input.product_category || "غير محددة"}\n` +
    `ملاحظات: ${input.short_context || "لا يوجد"}\n` +
    "اكتب عنوانًا جذابًا، ووصفًا مختصرًا، ووصفًا تفصيليًا، ووصفًا لتحسين محركات البحث.";

  const raw = await provider.complete({
    task: "product_description",
    system,
    user,
    json: true,
    context: {
      product_name: input.product_name,
      product_category: input.product_category,
      short_context: input.short_context,
    },
  });

  const parsed = productDescriptionOutputSchema.safeParse(parseJsonObject(raw));
  if (!parsed.success) {
    throw new ServiceUnavailableError(
      "أرجعت خدمة الذكاء الاصطناعي نتيجة بصيغة غير متوقعة. حاول مرة أخرى.",
    );
  }

  return { ...parsed.data, provider: provider.name };
}

/* --------------------------- 2. Sales Summary ---------------------------- */

export interface SalesSummaryResult {
  summary: string;
  provider: string;
  range: { period: SalesSummaryInput["range"]; from: string; to: string };
  metrics: {
    revenue: string;
    currency: string;
    orders: number;
    customers: number;
    topProducts: { name: string; quantity: number; revenue: string }[];
  };
}

/**
 * Generates a natural-language Arabic sales summary for a store + range. All
 * metrics are read tenant-scoped (storeId) from existing dashboard queries and
 * fed to the model — the model only narrates the supplied numbers.
 */
export async function generateSalesSummary(
  storeId: string,
  input: SalesSummaryInput,
  now: Date,
): Promise<SalesSummaryResult> {
  const range = resolveRange({ period: input.range }, now);

  const [sales, orders, topProducts, customerAgg] = await Promise.all([
    getSalesChart(storeId, range),
    getOrdersChart(storeId, range),
    getTopProducts(storeId, range, TOP_PRODUCTS_LIMIT),
    db
      .select({ value: count() })
      .from(customers)
      .where(
        and(
          eq(customers.storeId, storeId),
          gte(customers.createdAt, range.start),
          lt(customers.createdAt, range.end),
        ),
      ),
  ]);

  const customersCount = Number(customerAgg[0]?.value ?? 0);
  const periodLabel = RANGE_LABELS[input.range];
  const topForPrompt = topProducts.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    revenue: p.revenue,
  }));

  const provider = getAIProvider();
  const system =
    "أنت محلل مبيعات. اكتب ملخصًا موجزًا واضحًا بالعربية لأداء المتجر " +
    "بناءً على الأرقام المعطاة فقط. لا تخترع أي أرقام أو حقائق.";
  const user =
    `الفترة: ${periodLabel}\n` +
    `الإيرادات: ${sales.total} ${sales.currency}\n` +
    `عدد الطلبات: ${orders.total}\n` +
    `العملاء الجدد: ${customersCount}\n` +
    `أفضل المنتجات: ${
      topForPrompt.length > 0
        ? topForPrompt.map((p) => `${p.name} (${p.quantity})`).join("، ")
        : "لا يوجد"
    }`;

  const summary = await provider.complete({
    task: "sales_summary",
    system,
    user,
    context: {
      periodLabel,
      currency: sales.currency,
      revenue: sales.total,
      orders: orders.total,
      customers: customersCount,
      topProducts: topForPrompt,
    },
  });

  return {
    summary: summary.trim(),
    provider: provider.name,
    range: {
      period: input.range,
      from: range.start.toISOString(),
      to: range.end.toISOString(),
    },
    metrics: {
      revenue: sales.total,
      currency: sales.currency,
      orders: orders.total,
      customers: customersCount,
      topProducts: topForPrompt,
    },
  };
}

/* ------------------------ 3. Low Stock Insights -------------------------- */

export interface LowStockInsightsResult {
  insights: string;
  provider: string;
  threshold: number;
  products: { id: string; name: string; stockQuantity: number }[];
}

/**
 * Generates Arabic restocking recommendations from a store's low-stock products
 * (read tenant-scoped). Suggestions only — nothing is modified.
 */
export async function generateLowStockInsights(
  storeId: string,
): Promise<LowStockInsightsResult> {
  const threshold = env.DASHBOARD_LOW_STOCK_THRESHOLD;
  const lowStock = await getLowStock(storeId, LOW_STOCK_LIMIT, threshold);
  const products = lowStock.map((p) => ({
    id: p.id,
    name: p.name,
    stockQuantity: p.stockQuantity,
  }));

  const provider = getAIProvider();
  const system =
    "أنت مستشار إدارة مخزون. قدّم توصيات عملية موجزة بالعربية " +
    "بناءً على قائمة المنتجات المنخفضة المخزون المعطاة فقط.";
  const user =
    products.length > 0
      ? `الحد الأدنى للمخزون: ${threshold}\nالمنتجات المنخفضة:\n` +
        products
          .map((p) => `- ${p.name}: المتبقي ${p.stockQuantity}`)
          .join("\n")
      : `لا توجد منتجات منخفضة المخزون (الحد ${threshold}).`;

  const insights = await provider.complete({
    task: "low_stock_insights",
    system,
    user,
    context: { threshold, products },
  });

  return {
    insights: insights.trim(),
    provider: provider.name,
    threshold,
    products,
  };
}
