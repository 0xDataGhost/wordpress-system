import type { Request, Response } from "express";
import { successResponse } from "../../lib/api-response";
import { getAuth } from "../../middleware/authenticate";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../db/schema/audit-logs";
import { recordAuditFromRequest } from "../audit-logs/audit-logs.recorder";
import {
  manualAssignCode,
  releaseOrderCodes,
  replaceAssignment,
  resendAssignment,
  updateAssignmentStatus,
} from "./manual.service";
import type {
  AssignmentParams,
  AssignmentStatusInput,
  ManualAssignInput,
  ReleaseInput,
  ReplaceInput,
  ResendInput,
} from "./manual.schemas";
import type { OrderParams } from "./digital-delivery.schemas";

/** Records the order-level digital status change as a separate audit entry. */
async function auditOrderStatusChange(
  req: Request,
  orderId: string,
  from: string,
  to: string,
): Promise<void> {
  if (from === to) return;
  await recordAuditFromRequest(req, {
    action: AUDIT_ACTIONS.DIGITAL_ORDER_STATUS_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.DIGITAL_DELIVERY,
    entityId: orderId,
    message: `تغيّرت حالة التسليم الرقمي للطلب: ${from} → ${to}`,
    metadata: { orderId, fromStatus: from, toStatus: to },
  });
}

/** POST /digital-delivery/orders/:orderId/manual-assign (digital_delivery.assign). */
export async function manualAssignHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId, userId } = getAuth(req);
  const { orderId } = req.params as OrderParams;
  const body = req.body as ManualAssignInput;

  const result = await manualAssignCode(storeId, orderId, body, userId);

  await recordAuditFromRequest(req, {
    action: AUDIT_ACTIONS.DIGITAL_CODE_MANUALLY_ASSIGNED,
    entityType: AUDIT_ENTITY_TYPES.DIGITAL_CODE,
    entityId: result.codeId,
    message: "عيّن كوداً رقمياً يدوياً",
    metadata: {
      orderId: result.orderId,
      codeId: result.codeId,
      productId: result.productId,
      assignmentId: result.assignmentId,
    },
  });
  await auditOrderStatusChange(req, orderId, result.orderStatusBefore, result.orderStatus);

  res.status(201).json(
    successResponse(
      {
        orderId: result.orderId,
        codeId: result.codeId,
        productId: result.productId,
        assignmentId: result.assignmentId,
        orderStatus: result.orderStatus,
      },
      "Code assigned",
    ),
  );
}

/** POST /digital-delivery/assignments/:assignmentId/replace (digital_delivery.replace). */
export async function replaceHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId, userId } = getAuth(req);
  const { assignmentId } = req.params as AssignmentParams;
  const body = req.body as ReplaceInput;

  const result = await replaceAssignment(storeId, assignmentId, body, userId);

  await recordAuditFromRequest(req, {
    action: AUDIT_ACTIONS.DIGITAL_CODE_REPLACED,
    entityType: AUDIT_ENTITY_TYPES.DIGITAL_CODE,
    entityId: result.oldCodeId,
    message: "استبدل كوداً رقمياً",
    metadata: {
      orderId: result.orderId,
      oldAssignmentId: result.oldAssignmentId,
      newAssignmentId: result.newAssignmentId,
      oldCodeId: result.oldCodeId,
      newCodeId: result.newCodeId,
      productId: result.productId,
      wasDelivered: result.wasDelivered,
    },
  });
  await auditOrderStatusChange(req, result.orderId, result.orderStatusBefore, result.orderStatus);

  res.status(200).json(
    successResponse(
      {
        orderId: result.orderId,
        oldAssignmentId: result.oldAssignmentId,
        newAssignmentId: result.newAssignmentId,
        wasDelivered: result.wasDelivered,
        orderStatus: result.orderStatus,
      },
      "Code replaced",
    ),
  );
}

/** POST /digital-delivery/assignments/:assignmentId/resend (digital_delivery.resend). */
export async function resendHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId, userId } = getAuth(req);
  const { assignmentId } = req.params as AssignmentParams;
  const body = req.body as ResendInput;

  const result = await resendAssignment(storeId, assignmentId, body, userId);

  await recordAuditFromRequest(req, {
    action: AUDIT_ACTIONS.DIGITAL_CODE_RESENT,
    entityType: AUDIT_ENTITY_TYPES.DIGITAL_CODE,
    entityId: result.codeId,
    message: "أعاد إرسال كود رقمي",
    metadata: {
      orderId: result.orderId,
      assignmentId: result.assignmentId,
      codeId: result.codeId,
      channel: result.channel,
      delivered: result.delivered,
    },
  });

  res.status(200).json(
    successResponse(
      {
        orderId: result.orderId,
        assignmentId: result.assignmentId,
        delivered: result.delivered,
        channel: result.channel,
        deliveryId: result.deliveryId,
      },
      result.delivered ? "Resend complete" : "Resend attempted",
    ),
  );
}

/** PATCH /digital-delivery/assignments/:assignmentId/status (digital_delivery.refund). */
export async function updateAssignmentStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId, userId } = getAuth(req);
  const { assignmentId } = req.params as AssignmentParams;
  const body = req.body as AssignmentStatusInput;

  const result = await updateAssignmentStatus(storeId, assignmentId, body, userId);

  const action =
    result.status === "refunded"
      ? AUDIT_ACTIONS.DIGITAL_ASSIGNMENT_REFUNDED
      : result.status === "cancelled"
        ? AUDIT_ACTIONS.DIGITAL_ASSIGNMENT_CANCELLED
        : AUDIT_ACTIONS.DIGITAL_DELIVERY_FAILED;
  await recordAuditFromRequest(req, {
    action,
    entityType: AUDIT_ENTITY_TYPES.DIGITAL_CODE,
    entityId: result.codeId,
    message: `غيّر حالة تعيين كود إلى ${result.status}`,
    metadata: {
      orderId: result.orderId,
      assignmentId: result.assignmentId,
      codeId: result.codeId,
      toStatus: result.status,
      codeStatus: result.codeStatus,
    },
  });
  await auditOrderStatusChange(req, result.orderId, result.orderStatusBefore, result.orderStatus);

  res.status(200).json(
    successResponse(
      {
        orderId: result.orderId,
        assignmentId: result.assignmentId,
        status: result.status,
        codeStatus: result.codeStatus,
        orderStatus: result.orderStatus,
      },
      "Assignment status updated",
    ),
  );
}

/** POST /digital-delivery/orders/:orderId/release (digital_delivery.refund). */
export async function releaseHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId, userId } = getAuth(req);
  const { orderId } = req.params as OrderParams;
  const body = req.body as ReleaseInput;

  const result = await releaseOrderCodes(storeId, orderId, body, userId);

  await recordAuditFromRequest(req, {
    action: AUDIT_ACTIONS.DIGITAL_CODE_RELEASED,
    entityType: AUDIT_ENTITY_TYPES.DIGITAL_DELIVERY,
    entityId: result.orderId,
    message: `حرّر أكواد الطلب (${result.mode})`,
    metadata: {
      orderId: result.orderId,
      mode: result.mode,
      releasedCount: result.releasedCount,
      refundedCount: result.refundedCount,
      deliveredSkippedCount: result.deliveredSkippedCount,
    },
  });
  await auditOrderStatusChange(req, orderId, result.orderStatusBefore, result.orderStatus);

  res.status(200).json(
    successResponse(
      {
        orderId: result.orderId,
        mode: result.mode,
        releasedCount: result.releasedCount,
        refundedCount: result.refundedCount,
        deliveredSkippedCount: result.deliveredSkippedCount,
        orderStatus: result.orderStatus,
      },
      "Release complete",
    ),
  );
}
