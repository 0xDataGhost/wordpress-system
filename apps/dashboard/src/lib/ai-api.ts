/**
 * AI assistants API client (Phase 12.5).
 *
 * Calls the backend AI module (mounted at /api/v1/ai) through the shared HTTP
 * client (Bearer token + envelope unwrap). All three endpoints require
 * `ai.view` and return suggestions only — nothing is persisted server-side.
 *   generateProductDescription → POST /ai/product-description
 *   generateSalesSummary       → POST /ai/sales-summary
 *   generateLowStockInsights   → POST /ai/low-stock-insights
 *
 * `provider` is "mock" when no OPENAI_API_KEY is configured (the UI badges it).
 */

import { apiRequest } from "./http";

export type AISalesRange = "today" | "7d" | "30d" | "this_month";

export interface ProductDescriptionInput {
  product_name: string;
  product_category?: string;
  short_context?: string;
}

export interface ProductDescriptionResult {
  title: string;
  short_description: string;
  long_description: string;
  seo_description: string;
  provider: string;
}

export interface SalesSummaryResult {
  summary: string;
  provider: string;
  range: { period: AISalesRange; from: string; to: string };
  metrics: {
    revenue: string;
    currency: string;
    orders: number;
    customers: number;
    topProducts: { name: string; quantity: number; revenue: string }[];
  };
}

export interface LowStockInsightsResult {
  insights: string;
  provider: string;
  threshold: number;
  products: { id: string; name: string; stockQuantity: number }[];
}

export async function generateProductDescription(
  input: ProductDescriptionInput,
): Promise<ProductDescriptionResult> {
  return apiRequest<ProductDescriptionResult>("/ai/product-description", {
    method: "POST",
    body: input,
  });
}

export async function generateSalesSummary(
  range: AISalesRange,
): Promise<SalesSummaryResult> {
  return apiRequest<SalesSummaryResult>("/ai/sales-summary", {
    method: "POST",
    body: { range },
  });
}

export async function generateLowStockInsights(): Promise<LowStockInsightsResult> {
  return apiRequest<LowStockInsightsResult>("/ai/low-stock-insights", {
    method: "POST",
    body: {},
  });
}
