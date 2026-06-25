import type { Request, Response } from "express";
import { successResponse } from "../../lib/api-response";
import { getAuth } from "../../middleware/authenticate";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../db/schema/audit-logs";
import { recordAuditFromRequest } from "../audit-logs/audit-logs.recorder";
import { toDigitalSettingsDto } from "./digital-products.serializer";
import {
  getDigitalSettings,
  updateDigitalSettings,
} from "./digital-products.service";
import {
  digitalSettingsAuditMetadata,
  type DigitalProductParams,
  type UpdateDigitalSettingsInput,
} from "./digital-products.schemas";

/**
 * GET /products/:id/digital-settings — a product's digital fulfillment settings
 * (digital_inventory.view). Returns the recommended defaults (not persisted)
 * when the product has not been configured yet.
 */
export async function getDigitalSettingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const { id } = req.params as DigitalProductParams;
  const row = await getDigitalSettings(storeId, id);
  res.status(200).json(successResponse(toDigitalSettingsDto(id, row), ""));
}

/**
 * PATCH /products/:id/digital-settings — partial update of a product's digital
 * settings (digital_inventory.edit). Records an audit log carrying only the
 * changed field NAMES (never the instructions-template body).
 */
export async function updateDigitalSettingsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const { id } = req.params as DigitalProductParams;
  const patch = req.body as UpdateDigitalSettingsInput;

  const { row } = await updateDigitalSettings(storeId, id, patch);

  await recordAuditFromRequest(req, {
    action: AUDIT_ACTIONS.DIGITAL_PRODUCT_SETTINGS_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.PRODUCT,
    entityId: id,
    message: "حدّث إعدادات المنتج الرقمي",
    metadata: digitalSettingsAuditMetadata(id, patch),
  });

  res
    .status(200)
    .json(
      successResponse(toDigitalSettingsDto(id, row), "Digital settings updated"),
    );
}
