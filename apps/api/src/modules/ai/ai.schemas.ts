import { z } from "zod";

/**
 * Input validation for the AI assistant endpoints. All inputs are user-facing
 * and validated at the boundary; the assistants return suggestions only and
 * never persist anything.
 */

/** POST /ai/product-description */
export const productDescriptionSchema = z.object({
  product_name: z.string().trim().min(2, "اسم المنتج مطلوب").max(200),
  product_category: z.string().trim().max(120).optional().default(""),
  short_context: z.string().trim().max(1000).optional().default(""),
});

/**
 * POST /ai/sales-summary — a date range (mirrors the dashboard presets, minus
 * the custom range to keep the assistant simple and deterministic).
 */
export const salesSummarySchema = z.object({
  range: z.enum(["today", "7d", "30d", "this_month"]).default("30d"),
});

/** POST /ai/low-stock-insights — no input. */
export const lowStockInsightsSchema = z.object({}).strict();

export type ProductDescriptionInput = z.infer<typeof productDescriptionSchema>;
export type SalesSummaryInput = z.infer<typeof salesSummarySchema>;
export type LowStockInsightsInput = z.infer<typeof lowStockInsightsSchema>;

/** Validated shape the model must return for a product description. */
export const productDescriptionOutputSchema = z.object({
  title: z.string().min(1),
  short_description: z.string().min(1),
  long_description: z.string().min(1),
  seo_description: z.string().min(1),
});

export type ProductDescriptionOutput = z.infer<
  typeof productDescriptionOutputSchema
>;
