import { Router } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../lib/async-handler";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/authorize";
import { rateLimit } from "../../middleware/rate-limit";
import { validate } from "../../middleware/validate";
import {
  getBatchHandler,
  getCodeHandler,
  getSummaryHandler,
  importHandler,
  listBatchesHandler,
  listCodesHandler,
  markInvalidHandler,
  revealHandler,
  updateStatusHandler,
} from "./digital-inventory.controller";
import {
  batchParamsSchema,
  codeParamsSchema,
  importCodesSchema,
  listBatchesQuerySchema,
  listCodesQuerySchema,
  markInvalidSchema,
  summaryQuerySchema,
  updateCodeStatusSchema,
} from "./digital-inventory.schemas";

/**
 * Phase 16 — Code Inventory & Secure Import. Every route is JWT-authenticated and
 * tenant-scoped. Reading needs `digital_inventory.view`; importing needs
 * `.import`; revealing a full code needs `.reveal` (and is rate-limited with its
 * own bucket); a manual status change needs `.edit`. Codes are never returned
 * except by the dedicated reveal endpoint.
 */
const router = Router();

const view = requirePermission("digital_inventory.view");

// Per-IP limiter for the sensitive reveal endpoint, with its own enable flag.
const revealRateLimit = rateLimit({
  name: "digital-reveal",
  enabled: env.DIGITAL_CODE_REVEAL_RATE_LIMIT_ENABLED,
  max: env.DIGITAL_CODE_REVEAL_RATE_LIMIT_MAX,
  windowSeconds: env.DIGITAL_CODE_REVEAL_RATE_LIMIT_WINDOW_SECONDS,
});

// GET /digital-inventory/summary
router.get(
  "/summary",
  authenticate,
  view,
  validate({ query: summaryQuerySchema }),
  asyncHandler(getSummaryHandler),
);

// GET /digital-inventory/codes
router.get(
  "/codes",
  authenticate,
  view,
  validate({ query: listCodesQuerySchema }),
  asyncHandler(listCodesHandler),
);

// GET /digital-inventory/codes/:id
router.get(
  "/codes/:id",
  authenticate,
  view,
  validate({ params: codeParamsSchema }),
  asyncHandler(getCodeHandler),
);

// POST /digital-inventory/import
router.post(
  "/import",
  authenticate,
  requirePermission("digital_inventory.import"),
  validate({ body: importCodesSchema }),
  asyncHandler(importHandler),
);

// POST /digital-inventory/codes/:id/reveal
router.post(
  "/codes/:id/reveal",
  authenticate,
  requirePermission("digital_inventory.reveal"),
  revealRateLimit,
  validate({ params: codeParamsSchema }),
  asyncHandler(revealHandler),
);

// PATCH /digital-inventory/codes/:id/status
router.patch(
  "/codes/:id/status",
  authenticate,
  requirePermission("digital_inventory.edit"),
  validate({ params: codeParamsSchema, body: updateCodeStatusSchema }),
  asyncHandler(updateStatusHandler),
);

// POST /digital-inventory/codes/:id/mark-invalid — audited "supplier said it's bad" shortcut
router.post(
  "/codes/:id/mark-invalid",
  authenticate,
  requirePermission("digital_inventory.edit"),
  validate({ params: codeParamsSchema, body: markInvalidSchema }),
  asyncHandler(markInvalidHandler),
);

// GET /digital-inventory/batches
router.get(
  "/batches",
  authenticate,
  view,
  validate({ query: listBatchesQuerySchema }),
  asyncHandler(listBatchesHandler),
);

// GET /digital-inventory/batches/:id
router.get(
  "/batches/:id",
  authenticate,
  view,
  validate({ params: batchParamsSchema }),
  asyncHandler(getBatchHandler),
);

export default router;
