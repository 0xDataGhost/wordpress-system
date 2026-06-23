import type { Request, Response } from "express";
import { successResponse } from "../../lib/api-response";
import { getAuth } from "../../middleware/authenticate";
import {
  generateLowStockInsights,
  generateProductDescription,
  generateSalesSummary,
} from "./ai.service";
import type {
  ProductDescriptionInput,
  SalesSummaryInput,
} from "./ai.schemas";

/** POST /ai/product-description — generate product copy (ai.view). */
export async function productDescriptionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  // Auth (and thus store scope) is enforced even though this assistant uses no
  // store data — keeps every AI endpoint consistently gated.
  getAuth(req);
  const input = req.body as ProductDescriptionInput;
  const result = await generateProductDescription(input);
  res.status(200).json(successResponse(result, ""));
}

/** POST /ai/sales-summary — natural-language sales summary (ai.view). */
export async function salesSummaryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const input = req.body as SalesSummaryInput;
  const result = await generateSalesSummary(storeId, input, new Date());
  res.status(200).json(successResponse(result, ""));
}

/** POST /ai/low-stock-insights — restocking recommendations (ai.view). */
export async function lowStockInsightsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const result = await generateLowStockInsights(storeId);
  res.status(200).json(successResponse(result, ""));
}
