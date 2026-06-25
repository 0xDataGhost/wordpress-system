import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import {
  deliveryHandler,
  inventoryHandler,
  profitHandler,
  stockHandler,
  summaryHandler,
  suppliersHandler,
} from "./digital-reports.controller";
import {
  reportFiltersSchema,
  stockReportQuerySchema,
} from "./digital-reports.schemas";

/**
 * Phase 21 — Digital Reports & Profit Analytics. Every route is JWT-authenticated,
 * tenant-scoped, and read-only. A single permission gates them all: reports never
 * expose raw codes, so `digital_reports.view` is sufficient and no audit is taken.
 */
const router = Router();

const view = requirePermission("digital_reports.view");

router.get(
  "/summary",
  authenticate,
  view,
  validate({ query: reportFiltersSchema }),
  asyncHandler(summaryHandler),
);

router.get(
  "/inventory",
  authenticate,
  view,
  validate({ query: reportFiltersSchema }),
  asyncHandler(inventoryHandler),
);

// /profit is canonical; /sales is an alias (the report covers sales + profit).
router.get(
  "/profit",
  authenticate,
  view,
  validate({ query: reportFiltersSchema }),
  asyncHandler(profitHandler),
);
router.get(
  "/sales",
  authenticate,
  view,
  validate({ query: reportFiltersSchema }),
  asyncHandler(profitHandler),
);

router.get(
  "/suppliers",
  authenticate,
  view,
  validate({ query: reportFiltersSchema }),
  asyncHandler(suppliersHandler),
);

router.get(
  "/delivery",
  authenticate,
  view,
  validate({ query: reportFiltersSchema }),
  asyncHandler(deliveryHandler),
);

// /low-stock is canonical (plan2 §21); /stock is an alias (the phase-brief name).
router.get(
  "/low-stock",
  authenticate,
  view,
  validate({ query: stockReportQuerySchema }),
  asyncHandler(stockHandler),
);
router.get(
  "/stock",
  authenticate,
  view,
  validate({ query: stockReportQuerySchema }),
  asyncHandler(stockHandler),
);

export default router;
