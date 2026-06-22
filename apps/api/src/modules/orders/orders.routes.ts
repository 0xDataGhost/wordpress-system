import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import {
  getOrderHandler,
  listOrdersHandler,
  updateOrderNotesHandler,
} from "./orders.controller";
import {
  listOrdersQuerySchema,
  orderParamsSchema,
  updateOrderNotesSchema,
} from "./orders.schemas";

const router = Router();

// GET /orders            — list (search/status/date/pagination)
router.get(
  "/",
  authenticate,
  requirePermission("orders.view"),
  validate({ query: listOrdersQuerySchema }),
  asyncHandler(listOrdersHandler),
);

// GET /orders/:id        — details (order + items + customer summary)
router.get(
  "/:id",
  authenticate,
  requirePermission("orders.view"),
  validate({ params: orderParamsSchema }),
  asyncHandler(getOrderHandler),
);

// PATCH /orders/:id/notes — update internal notes
router.patch(
  "/:id/notes",
  authenticate,
  requirePermission("orders.edit"),
  validate({ params: orderParamsSchema, body: updateOrderNotesSchema }),
  asyncHandler(updateOrderNotesHandler),
);

export default router;
