import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db, type DbTransaction } from "../../db";
import { codeAssignments } from "../../db/schema/code-assignments";
import { digitalCodes } from "../../db/schema/digital-codes";
import { digitalProductSettings } from "../../db/schema/digital-product-settings";
import { orderItems } from "../../db/schema/order-items";
import { orders } from "../../db/schema/orders";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../db/schema/audit-logs";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { recordAuditLog } from "../audit-logs/audit-logs.service";
import { createNotification } from "../notifications/notifications.service";
import { deliverCodesForOrder } from "./delivery.service";
import {
  assertAssignmentTransition,
  assertCodeTransition,
  decideAssignmentStatusOutcome,
  decideReleaseOutcome,
  orderStatusForRelease,
  type AssignmentStatusTarget,
  type ReleaseMode,
} from "./transitions";
import type {
  AssignmentStatusInput,
  ManualAssignInput,
  ReleaseInput,
  ReplaceInput,
  ResendInput,
} from "./manual.schemas";

/**
 * Recomputes an order's digital delivery status from its assignments
 * (delivered-aware). Used after manual assign/replace; release sets a terminal
 * status directly. Tenant-scoped. Returns the new status.
 */
async function recomputeOrderDigitalStatus(
  tx: DbTransaction,
  storeId: string,
  orderId: string,
): Promise<string> {
  const [reqAgg] = await tx
    .select({ value: sql<number>`coalesce(sum(${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(
      digitalProductSettings,
      and(
        eq(digitalProductSettings.storeId, orderItems.storeId),
        eq(digitalProductSettings.productId, orderItems.productId),
        eq(digitalProductSettings.isEnabled, true),
      ),
    )
    .where(and(eq(orderItems.storeId, storeId), eq(orderItems.orderId, orderId)));
  const required = Number(reqAgg?.value ?? 0);

  const counts = await tx
    .select({ status: codeAssignments.status, value: count() })
    .from(codeAssignments)
    .where(
      and(
        eq(codeAssignments.storeId, storeId),
        eq(codeAssignments.orderId, orderId),
      ),
    )
    .groupBy(codeAssignments.status);
  const byStatus = new Map<string, number>();
  for (const c of counts) byStatus.set(c.status, Number(c.value));
  const assignedOnly = byStatus.get("assigned") ?? 0;
  const delivered = byStatus.get("delivered") ?? 0;
  const activeAssigned = assignedOnly + delivered;

  let status: string;
  if (required === 0) status = "not_required";
  else if (delivered >= required && assignedOnly === 0) status = "completed";
  else if (activeAssigned >= required) status = "reserved";
  else if (activeAssigned > 0) status = "partial";
  else status = "pending";

  await tx
    .update(orders)
    .set({
      digitalDeliveryRequired: required > 0,
      digitalDeliveryStatus: status,
      digitalDeliveryCompletedAt:
        status === "completed"
          ? sql`coalesce(${orders.digitalDeliveryCompletedAt}, now())`
          : null,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
  return status;
}

/* ----------------------------- Manual assign ----------------------------- */

export interface ManualAssignResult {
  orderId: string;
  codeId: string;
  productId: string;
  assignmentId: string;
  orderStatusBefore: string;
  orderStatus: string;
}

export async function manualAssignCode(
  storeId: string,
  orderId: string,
  input: ManualAssignInput,
  actorUserId: string | null,
): Promise<ManualAssignResult> {
  const [order] = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      digitalDeliveryStatus: orders.digitalDeliveryStatus,
    })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .limit(1);
  if (!order) throw new NotFoundError("Order not found");

  // Resolve the target order item + product.
  let productId: string;
  let orderItemId: string;
  if (input.orderItemId) {
    const [item] = await db
      .select({ id: orderItems.id, productId: orderItems.productId })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.storeId, storeId),
          eq(orderItems.orderId, orderId),
          eq(orderItems.id, input.orderItemId),
        ),
      )
      .limit(1);
    if (!item) throw new NotFoundError("Order item not found");
    if (!item.productId) {
      throw new ValidationError("Order item has no linked product.");
    }
    productId = item.productId;
    orderItemId = item.id;
  } else {
    const [item] = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(
        and(
          eq(orderItems.storeId, storeId),
          eq(orderItems.orderId, orderId),
          eq(orderItems.productId, input.productId!),
        ),
      )
      .limit(1);
    if (!item) throw new ValidationError("Product is not part of this order.");
    productId = input.productId!;
    orderItemId = item.id;
  }

  const [settings] = await db
    .select({ isEnabled: digitalProductSettings.isEnabled })
    .from(digitalProductSettings)
    .where(
      and(
        eq(digitalProductSettings.storeId, storeId),
        eq(digitalProductSettings.productId, productId),
      ),
    )
    .limit(1);
  if (!settings?.isEnabled) {
    throw new ValidationError("Digital fulfillment is not enabled for this product.");
  }

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [code] = await tx
      .select({ status: digitalCodes.status, productId: digitalCodes.productId })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, input.codeId)))
      .limit(1);
    if (!code) throw new NotFoundError("Code not found");
    if (code.productId !== productId) {
      throw new ValidationError("Code does not belong to the order item's product.");
    }
    if (code.status !== "available") {
      throw new ValidationError("Code is not available.");
    }
    assertCodeTransition("available", "sold");

    // Atomic claim — the status guard prevents a concurrent assignment.
    const claimed = await tx
      .update(digitalCodes)
      .set({
        status: "sold",
        assignedOrderId: orderId,
        assignedOrderItemId: orderItemId,
        assignedCustomerId: order.customerId,
        soldAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(digitalCodes.storeId, storeId),
          eq(digitalCodes.id, input.codeId),
          eq(digitalCodes.status, "available"),
        ),
      )
      .returning({ id: digitalCodes.id });
    if (claimed.length === 0) {
      throw new ValidationError("Code is no longer available.");
    }

    const [assignment] = await tx
      .insert(codeAssignments)
      .values({
        storeId,
        codeId: input.codeId,
        productId,
        orderId,
        orderItemId,
        customerId: order.customerId,
        assignmentType: "manual",
        status: "assigned",
        assignedBy: actorUserId,
        notes: input.reason,
      })
      .returning({ id: codeAssignments.id });
    if (!assignment) throw new Error("Failed to create assignment");

    const orderStatus = await recomputeOrderDigitalStatus(tx, storeId, orderId);
    return { assignmentId: assignment.id, orderStatus };
  });

  return {
    orderId,
    codeId: input.codeId,
    productId,
    assignmentId: result.assignmentId,
    orderStatusBefore: order.digitalDeliveryStatus,
    orderStatus: result.orderStatus,
  };
}

/* ------------------------------- Replacement ------------------------------ */

export interface ReplaceResult {
  orderId: string;
  oldAssignmentId: string;
  newAssignmentId: string;
  oldCodeId: string;
  newCodeId: string;
  productId: string;
  wasDelivered: boolean;
  orderStatusBefore: string;
  orderStatus: string;
}

export async function replaceAssignment(
  storeId: string,
  assignmentId: string,
  input: ReplaceInput,
  actorUserId: string | null,
): Promise<ReplaceResult> {
  const [old] = await db
    .select({
      id: codeAssignments.id,
      codeId: codeAssignments.codeId,
      productId: codeAssignments.productId,
      orderId: codeAssignments.orderId,
      orderItemId: codeAssignments.orderItemId,
      customerId: codeAssignments.customerId,
      status: codeAssignments.status,
    })
    .from(codeAssignments)
    .where(and(eq(codeAssignments.storeId, storeId), eq(codeAssignments.id, assignmentId)))
    .limit(1);
  if (!old) throw new NotFoundError("Assignment not found");
  if (old.status !== "assigned" && old.status !== "delivered") {
    throw new ValidationError("Only active (assigned/delivered) assignments can be replaced.");
  }

  const [settings] = await db
    .select({ allowReplacement: digitalProductSettings.allowReplacement })
    .from(digitalProductSettings)
    .where(
      and(
        eq(digitalProductSettings.storeId, storeId),
        eq(digitalProductSettings.productId, old.productId),
      ),
    )
    .limit(1);
  if (settings && !settings.allowReplacement) {
    throw new ValidationError("Replacement is not allowed for this product.");
  }

  const [order] = await db
    .select({ digitalDeliveryStatus: orders.digitalDeliveryStatus })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, old.orderId)))
    .limit(1);
  const orderStatusBefore = order?.digitalDeliveryStatus ?? "unknown";

  // Resolve the replacement code (validate explicit, else auto-pick FIFO).
  let newCodeId: string;
  if (input.replacementCodeId) {
    const [c] = await db
      .select({ id: digitalCodes.id, status: digitalCodes.status, productId: digitalCodes.productId })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, input.replacementCodeId)))
      .limit(1);
    if (!c) throw new NotFoundError("Replacement code not found");
    if (c.productId !== old.productId) {
      throw new ValidationError("Replacement code must be the same product.");
    }
    if (c.status !== "available") {
      throw new ValidationError("Replacement code is not available.");
    }
    newCodeId = c.id;
  } else {
    const [c] = await db
      .select({ id: digitalCodes.id })
      .from(digitalCodes)
      .where(
        and(
          eq(digitalCodes.storeId, storeId),
          eq(digitalCodes.productId, old.productId),
          eq(digitalCodes.status, "available"),
        ),
      )
      .orderBy(asc(digitalCodes.createdAt), asc(digitalCodes.id))
      .limit(1);
    if (!c) throw new ValidationError("No available replacement code for this product.");
    newCodeId = c.id;
  }

  const wasDelivered = old.status === "delivered";
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    // Claim the new code atomically.
    const claimed = await tx
      .update(digitalCodes)
      .set({
        status: "sold",
        assignedOrderId: old.orderId,
        assignedOrderItemId: old.orderItemId,
        assignedCustomerId: old.customerId,
        soldAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(digitalCodes.storeId, storeId),
          eq(digitalCodes.id, newCodeId),
          eq(digitalCodes.status, "available"),
        ),
      )
      .returning({ id: digitalCodes.id });
    if (claimed.length === 0) {
      throw new ValidationError("Replacement code is no longer available.");
    }

    const [newAssign] = await tx
      .insert(codeAssignments)
      .values({
        storeId,
        codeId: newCodeId,
        productId: old.productId,
        orderId: old.orderId,
        orderItemId: old.orderItemId,
        customerId: old.customerId,
        assignmentType: "replacement",
        status: "assigned",
        assignedBy: actorUserId,
        notes: input.reason,
      })
      .returning({ id: codeAssignments.id });
    if (!newAssign) throw new Error("Failed to create replacement assignment");

    // Old assignment → replaced, linked to the new one.
    assertAssignmentTransition(old.status, "replaced");
    await tx
      .update(codeAssignments)
      .set({
        status: "replaced",
        replacedByAssignmentId: newAssign.id,
        notes: input.reason,
        updatedAt: now,
      })
      .where(and(eq(codeAssignments.storeId, storeId), eq(codeAssignments.id, old.id)));

    // Old code → invalid (it is being replaced because it is bad).
    const [oldCode] = await tx
      .select({ status: digitalCodes.status })
      .from(digitalCodes)
      .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, old.codeId)))
      .limit(1);
    if (oldCode) {
      assertCodeTransition(oldCode.status, "invalid");
      await tx
        .update(digitalCodes)
        .set({ status: "invalid", updatedAt: now })
        .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, old.codeId)));
    }

    // Replacing a DELIVERED code means the order now needs redelivery.
    let orderStatus: string;
    if (wasDelivered) {
      orderStatus = "manual_review";
      await tx
        .update(orders)
        .set({
          digitalDeliveryStatus: "manual_review",
          digitalDeliveryCompletedAt: null,
          updatedAt: now,
        })
        .where(and(eq(orders.storeId, storeId), eq(orders.id, old.orderId)));
    } else {
      orderStatus = await recomputeOrderDigitalStatus(tx, storeId, old.orderId);
    }
    return { newAssignmentId: newAssign.id, orderStatus };
  });

  let finalOrderStatus = result.orderStatus;
  // Optionally redeliver the replacement immediately via the safe channel.
  if (input.resendNow) {
    try {
      const delivered = await deliverCodesForOrder(storeId, old.orderId, {
        channel: "dashboard",
        force: false,
        actorUserId,
        isRetry: false,
      });
      finalOrderStatus = delivered.orderStatus;
    } catch {
      // Delivery raises its own notifications; replacement itself succeeded.
    }
  }

  if (wasDelivered && !input.resendNow) {
    await notifyReplacement(storeId, old.orderId);
  }

  return {
    orderId: old.orderId,
    oldAssignmentId: old.id,
    newAssignmentId: result.newAssignmentId,
    oldCodeId: old.codeId,
    newCodeId,
    productId: old.productId,
    wasDelivered,
    orderStatusBefore,
    orderStatus: finalOrderStatus,
  };
}

/* --------------------------------- Release -------------------------------- */

export interface ReleaseResult {
  orderId: string;
  mode: ReleaseMode;
  releasedCount: number;
  refundedCount: number;
  deliveredSkippedCount: number;
  hasDelivered: boolean;
  orderStatusBefore: string;
  orderStatus: string;
}

export async function releaseOrderCodes(
  storeId: string,
  orderId: string,
  input: ReleaseInput,
  _actorUserId: string | null,
): Promise<ReleaseResult> {
  const [order] = await db
    .select({ id: orders.id, digitalDeliveryStatus: orders.digitalDeliveryStatus })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .limit(1);
  if (!order) throw new NotFoundError("Order not found");

  const assignments = await db
    .select({ id: codeAssignments.id, codeId: codeAssignments.codeId, status: codeAssignments.status })
    .from(codeAssignments)
    .where(
      and(
        eq(codeAssignments.storeId, storeId),
        eq(codeAssignments.orderId, orderId),
        inArray(codeAssignments.status, ["assigned", "delivered"]),
      ),
    );

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    let released = 0;
    let refunded = 0;
    let skipped = 0;
    for (const a of assignments) {
      const outcome = decideReleaseOutcome(a.status, input.mode);
      if (outcome.action === "skip") {
        if (outcome.delivered) skipped += 1;
        continue;
      }
      if (outcome.action === "release_to_available") {
        // Undelivered → return to stock (clear all assignment links).
        await tx
          .update(digitalCodes)
          .set({
            status: "available",
            assignedOrderId: null,
            assignedOrderItemId: null,
            assignedCustomerId: null,
            soldAt: null,
            updatedAt: now,
          })
          .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, a.codeId)));
        released += 1;
      } else {
        // Delivered → NEVER back to stock; lock it.
        await tx
          .update(digitalCodes)
          .set({ status: outcome.newCodeStatus!, updatedAt: now })
          .where(and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, a.codeId)));
        refunded += 1;
      }
      await tx
        .update(codeAssignments)
        .set({ status: outcome.newAssignmentStatus!, notes: input.reason, updatedAt: now })
        .where(and(eq(codeAssignments.storeId, storeId), eq(codeAssignments.id, a.id)));
    }

    const orderStatus = orderStatusForRelease(input.mode);
    await tx
      .update(orders)
      .set({
        digitalDeliveryStatus: orderStatus,
        digitalDeliveryCompletedAt: null,
        updatedAt: now,
      })
      .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
    return { released, refunded, skipped, orderStatus };
  });

  const hasDelivered = result.refunded + result.skipped > 0;
  await notifyRelease(storeId, orderId, input.mode, hasDelivered);

  return {
    orderId,
    mode: input.mode,
    releasedCount: result.released,
    refundedCount: result.refunded,
    deliveredSkippedCount: result.skipped,
    hasDelivered,
    orderStatusBefore: order.digitalDeliveryStatus,
    orderStatus: result.orderStatus,
  };
}

/* --------------------------------- Resend --------------------------------- */

export interface ResendResult {
  orderId: string;
  assignmentId: string;
  codeId: string;
  delivered: boolean;
  channel: string;
  deliveryId: string | null;
}

/**
 * Resends an assignment's code to the customer (plan2 §19). Re-delivers the
 * order's codes through the (safe) chosen channel with `force` so an already
 * delivered code is sent again — WITHOUT creating a new assignment. A fresh
 * delivery + attempt are recorded by the delivery engine. No raw code is exposed.
 */
export async function resendAssignment(
  storeId: string,
  assignmentId: string,
  input: ResendInput,
  actorUserId: string | null,
): Promise<ResendResult> {
  const [assignment] = await db
    .select({
      id: codeAssignments.id,
      codeId: codeAssignments.codeId,
      orderId: codeAssignments.orderId,
      status: codeAssignments.status,
    })
    .from(codeAssignments)
    .where(
      and(eq(codeAssignments.storeId, storeId), eq(codeAssignments.id, assignmentId)),
    )
    .limit(1);
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.status !== "assigned" && assignment.status !== "delivered") {
    throw new ValidationError("Only active assignments can be resent.");
  }

  const result = await deliverCodesForOrder(storeId, assignment.orderId, {
    channel: input.channel,
    force: true,
    actorUserId,
    isRetry: true,
  });

  return {
    orderId: assignment.orderId,
    assignmentId: assignment.id,
    codeId: assignment.codeId,
    delivered: result.delivered,
    channel: result.channel,
    deliveryId: result.delivery?.id ?? null,
  };
}

/* ------------------------- Assignment status change ------------------------ */

export interface UpdateAssignmentStatusResult {
  orderId: string;
  assignmentId: string;
  codeId: string;
  status: AssignmentStatusTarget;
  codeStatus: string | null;
  orderStatusBefore: string;
  orderStatus: string;
}

/**
 * Manually transitions an assignment to a destructive support status
 * (cancelled / refunded / failed). Transactional + tenant-scoped. The code-side
 * effect follows the golden rule (delivered codes are locked as `refunded`, never
 * returned to stock); `failed` leaves the code untouched for a later retry.
 */
export async function updateAssignmentStatus(
  storeId: string,
  assignmentId: string,
  input: AssignmentStatusInput,
  _actorUserId: string | null,
): Promise<UpdateAssignmentStatusResult> {
  const [assignment] = await db
    .select({
      id: codeAssignments.id,
      codeId: codeAssignments.codeId,
      orderId: codeAssignments.orderId,
      status: codeAssignments.status,
    })
    .from(codeAssignments)
    .where(
      and(eq(codeAssignments.storeId, storeId), eq(codeAssignments.id, assignmentId)),
    )
    .limit(1);
  if (!assignment) throw new NotFoundError("Assignment not found");

  assertAssignmentTransition(assignment.status, input.status);
  const outcome = decideAssignmentStatusOutcome(assignment.status, input.status);

  const [order] = await db
    .select({ digitalDeliveryStatus: orders.digitalDeliveryStatus })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, assignment.orderId)))
    .limit(1);
  const orderStatusBefore = order?.digitalDeliveryStatus ?? "unknown";

  const now = new Date();
  const orderStatus = await db.transaction(async (tx) => {
    if (outcome.codeAction !== "none" && outcome.newCodeStatus) {
      const [code] = await tx
        .select({ status: digitalCodes.status })
        .from(digitalCodes)
        .where(
          and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, assignment.codeId)),
        )
        .limit(1);
      if (code) {
        assertCodeTransition(code.status, outcome.newCodeStatus);
        if (outcome.codeAction === "release_to_available") {
          await tx
            .update(digitalCodes)
            .set({
              status: "available",
              assignedOrderId: null,
              assignedOrderItemId: null,
              assignedCustomerId: null,
              soldAt: null,
              updatedAt: now,
            })
            .where(
              and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, assignment.codeId)),
            );
        } else {
          await tx
            .update(digitalCodes)
            .set({ status: outcome.newCodeStatus, updatedAt: now })
            .where(
              and(eq(digitalCodes.storeId, storeId), eq(digitalCodes.id, assignment.codeId)),
            );
        }
      }
    }

    await tx
      .update(codeAssignments)
      .set({
        status: outcome.newAssignmentStatus,
        notes: input.reason,
        updatedAt: now,
      })
      .where(
        and(eq(codeAssignments.storeId, storeId), eq(codeAssignments.id, assignment.id)),
      );

    return recomputeOrderDigitalStatus(tx, storeId, assignment.orderId);
  });

  return {
    orderId: assignment.orderId,
    assignmentId: assignment.id,
    codeId: assignment.codeId,
    status: input.status,
    codeStatus: outcome.newCodeStatus,
    orderStatusBefore,
    orderStatus,
  };
}

/* --------------------- Webhook-driven safe release (§19) -------------------- */

/**
 * Webhook seam (plan2 §19): when a WooCommerce order becomes cancelled/refunded,
 * release its digital codes safely. Best-effort — NEVER throws (the order sync has
 * already succeeded). Idempotent + quiet: skips when there is nothing to release
 * or the order's digital status is already terminal. Delivered/revealed codes are
 * never returned to stock (enforced by `decideReleaseOutcome`).
 */
export async function maybeReleaseCodesForOrder(
  storeId: string,
  orderId: string,
  orderStatus: string,
): Promise<void> {
  try {
    const mode: ReleaseMode | null =
      orderStatus === "refunded"
        ? "refund"
        : orderStatus === "cancelled"
          ? "cancel"
          : null;
    if (!mode) return;

    const [order] = await db
      .select({
        digitalDeliveryStatus: orders.digitalDeliveryStatus,
        digitalDeliveryRequired: orders.digitalDeliveryRequired,
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
      .limit(1);
    if (!order || !order.digitalDeliveryRequired) return;
    if (
      order.digitalDeliveryStatus === "refunded" ||
      order.digitalDeliveryStatus === "cancelled"
    ) {
      return;
    }

    const result = await releaseOrderCodes(
      storeId,
      orderId,
      { mode, reason: `Order ${orderStatus} via WooCommerce webhook` },
      null,
    );

    await recordAuditLog({
      storeId,
      userId: null,
      action:
        mode === "refund"
          ? AUDIT_ACTIONS.DIGITAL_ASSIGNMENT_REFUNDED
          : AUDIT_ACTIONS.DIGITAL_ASSIGNMENT_CANCELLED,
      entityType: AUDIT_ENTITY_TYPES.DIGITAL_DELIVERY,
      entityId: orderId,
      message:
        mode === "refund"
          ? "استرجاع تلقائي لأكواد الطلب (ويب هوك)"
          : "إلغاء تلقائي لأكواد الطلب (ويب هوك)",
      metadata: {
        orderId,
        mode,
        releasedCount: result.releasedCount,
        refundedCount: result.refundedCount,
        deliveredSkippedCount: result.deliveredSkippedCount,
      },
      ipAddress: null,
      userAgent: null,
    });
  } catch (err) {
    logger.error({ err, storeId, orderId }, "Auto digital release failed");
  }
}

/* ------------------------------ Notifications ----------------------------- */

async function notifyReplacement(storeId: string, orderId: string): Promise<void> {
  try {
    await createNotification({
      storeId,
      type: "digital_inventory",
      title: "استبدال يحتاج إعادة تسليم",
      message: `تم استبدال كود مُسلّم في الطلب ${orderId} ويحتاج إعادة تسليم.`,
      severity: "warning",
      metadata: { orderId },
    });
  } catch {
    /* best-effort */
  }
}

async function notifyRelease(
  storeId: string,
  orderId: string,
  mode: ReleaseMode,
  hasDelivered: boolean,
): Promise<void> {
  try {
    await createNotification({
      storeId,
      type: "digital_inventory",
      title: "تم تحرير أكواد الطلب",
      message: `تمت معالجة (${mode}) لأكواد الطلب ${orderId}.`,
      severity: "info",
      metadata: { orderId, mode },
    });
    if (hasDelivered && mode !== "manual_release") {
      await createNotification({
        storeId,
        type: "digital_inventory",
        title: "إلغاء/استرجاع يحتوي أكواداً مُسلّمة",
        message: `الطلب ${orderId} يحتوي أكواداً مُسلّمة لم تُعَد للمخزون — مراجعة يدوية.`,
        severity: "warning",
        metadata: { orderId, mode },
      });
    }
  } catch {
    /* best-effort */
  }
}
