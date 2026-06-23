import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import {
  lowStockHandler,
  ordersChartHandler,
  recentOrdersHandler,
  salesChartHandler,
  summaryHandler,
  topProductsHandler,
} from "./dashboard.controller";
import {
  lowStockQuerySchema,
  rangeQuerySchema,
  recentOrdersQuerySchema,
  summaryQuerySchema,
  topProductsQuerySchema,
} from "./dashboard.schemas";

const router = Router();

// Every analytics route requires dashboard.view and is tenant-scoped via JWT.
const view = requirePermission("dashboard.view");

router.get(
  "/summary",
  authenticate,
  view,
  validate({ query: summaryQuerySchema }),
  asyncHandler(summaryHandler),
);

router.get(
  "/sales-chart",
  authenticate,
  view,
  validate({ query: rangeQuerySchema }),
  asyncHandler(salesChartHandler),
);

router.get(
  "/orders-chart",
  authenticate,
  view,
  validate({ query: rangeQuerySchema }),
  asyncHandler(ordersChartHandler),
);

router.get(
  "/recent-orders",
  authenticate,
  view,
  validate({ query: recentOrdersQuerySchema }),
  asyncHandler(recentOrdersHandler),
);

router.get(
  "/top-products",
  authenticate,
  view,
  validate({ query: topProductsQuerySchema }),
  asyncHandler(topProductsHandler),
);

router.get(
  "/low-stock",
  authenticate,
  view,
  validate({ query: lowStockQuerySchema }),
  asyncHandler(lowStockHandler),
);

export default router;
