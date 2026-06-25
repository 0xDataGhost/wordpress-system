import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import {
  getDigitalSettingsHandler,
  updateDigitalSettingsHandler,
} from "./digital-products.controller";
import {
  digitalProductParamsSchema,
  updateDigitalSettingsSchema,
} from "./digital-products.schemas";

/**
 * Phase 15 digital product foundation. Mounted at `/products` (alongside the
 * products router) so the public paths are `/products/:id/digital-settings`,
 * matching the products module's nested `/:id/publish` style. Reading requires
 * `digital_inventory.view`; changing requires `digital_inventory.edit`.
 */
const router = Router();

const view = requirePermission("digital_inventory.view");
const edit = requirePermission("digital_inventory.edit");

// GET /products/:id/digital-settings — current settings (defaults if unset)
router.get(
  "/:id/digital-settings",
  authenticate,
  view,
  validate({ params: digitalProductParamsSchema }),
  asyncHandler(getDigitalSettingsHandler),
);

// PATCH /products/:id/digital-settings — partial update
router.patch(
  "/:id/digital-settings",
  authenticate,
  edit,
  validate({
    params: digitalProductParamsSchema,
    body: updateDigitalSettingsSchema,
  }),
  asyncHandler(updateDigitalSettingsHandler),
);

export default router;
