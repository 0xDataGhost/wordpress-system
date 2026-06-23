import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import {
  lowStockInsightsHandler,
  productDescriptionHandler,
  salesSummaryHandler,
} from "./ai.controller";
import {
  lowStockInsightsSchema,
  productDescriptionSchema,
  salesSummarySchema,
} from "./ai.schemas";

const router = Router();

// Every AI assistant requires ai.view (plan.md Phase 12.5). The assistants
// return suggestions only — no writes — so a single view permission gates them.
const view = requirePermission("ai.view");

// POST /ai/product-description — generate product copy from user input
router.post(
  "/product-description",
  authenticate,
  view,
  validate({ body: productDescriptionSchema }),
  asyncHandler(productDescriptionHandler),
);

// POST /ai/sales-summary — narrate the store's metrics for a date range
router.post(
  "/sales-summary",
  authenticate,
  view,
  validate({ body: salesSummarySchema }),
  asyncHandler(salesSummaryHandler),
);

// POST /ai/low-stock-insights — restocking recommendations (no input)
router.post(
  "/low-stock-insights",
  authenticate,
  view,
  validate({ body: lowStockInsightsSchema }),
  asyncHandler(lowStockInsightsHandler),
);

export default router;
