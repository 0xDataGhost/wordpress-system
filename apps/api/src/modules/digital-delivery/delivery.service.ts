import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { codeAssignments } from "../../db/schema/code-assignments";
import { customers } from "../../db/schema/customers";
import { deliveryAttempts, type DeliveryAttemptRow } from "../../db/schema/delivery-attempts";
import { digitalCodes } from "../../db/schema/digital-codes";
import {
  digitalDeliveries,
  type DigitalDeliveryRow,
} from "../../db/schema/digital-deliveries";
import { digitalProductSettings } from "../../db/schema/digital-product-settings";
import { orderItems } from "../../db/schema/order-items";
import { orders } from "../../db/schema/orders";
import { products } from "../../db/schema/products";
import { stores } from "../../db/schema/stores";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../db/schema/audit-logs";
import type { AuditAction, AuditEntityType } from "../../db/schema/audit-logs";
import { logger } from "../../lib/logger";
import { NotFoundError, ValidationError } from "../../lib/errors";
import { recordAuditLog } from "../audit-logs/audit-logs.service";
import { createNotification } from "../notifications/notifications.service";
import type { DeliveryChannel } from "../../db/schema/digital-deliveries";
import { runChannel } from "./delivery.channels";
import { DEFAULT_DELIVERY_TEMPLATE, renderDeliveryMessage } from "./delivery.template";
import type { ListDeliveriesQuery } from "./delivery.schemas";

export interface DeliverOptions {
  channel: DeliveryChannel;
  force: boolean;
  actorUserId: string | null;
  isRetry: boolean;
}

export interface DeliveryRunResult {
  orderId: string;
  delivery: DigitalDeliveryRow | null;
  attempt: DeliveryAttemptRow | null;
  delivered: boolean;
  idempotentNoop: boolean;
  orderStatus: string;
  assignmentCount: number;
  channel: DeliveryChannel;
}

interface AssignmentForDelivery {
  assignmentId: string;
  codeId: string;
  status: string;
  codePreview: string | null;
  productName: string | null;
  instructionsTemplate: string | null;
  deliverOnStatuses: string[];
}

interface DeliveryContext {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  wpOrderId: number | null;
  customerId: string | null;
  customerName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  storeName: string;
  assignments: AssignmentForDelivery[];
  requiredCodes: number;
}

/** Loads everything the delivery engine needs (tenant-scoped). 404 if no order. */
async function loadDeliveryContext(
  storeId: string,
  orderId: string,
): Promise<DeliveryContext> {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      wpOrderId: orders.wpOrderId,
      customerId: orders.customerId,
      storeName: stores.name,
    })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .limit(1);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  let customerName = "عميل";
  let recipientEmail: string | null = null;
  let recipientPhone: string | null = null;
  if (order.customerId) {
    const [c] = await db
      .select({ name: customers.name, email: customers.email, phone: customers.phone })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), eq(customers.id, order.customerId)))
      .limit(1);
    if (c) {
      customerName = c.name?.trim() || customerName;
      recipientEmail = c.email;
      recipientPhone = c.phone;
    }
  }

  const assignmentRows = await db
    .select({
      assignmentId: codeAssignments.id,
      codeId: codeAssignments.codeId,
      status: codeAssignments.status,
      codePreview: digitalCodes.codePreview,
      productName: products.name,
      instructionsTemplate: digitalProductSettings.instructionsTemplate,
      deliverOnStatuses: digitalProductSettings.deliverOnStatuses,
    })
    .from(codeAssignments)
    .innerJoin(digitalCodes, eq(digitalCodes.id, codeAssignments.codeId))
    .leftJoin(products, eq(products.id, codeAssignments.productId))
    .leftJoin(
      digitalProductSettings,
      and(
        eq(digitalProductSettings.storeId, codeAssignments.storeId),
        eq(digitalProductSettings.productId, codeAssignments.productId),
      ),
    )
    .where(
      and(
        eq(codeAssignments.storeId, storeId),
        eq(codeAssignments.orderId, orderId),
        inArray(codeAssignments.status, ["assigned", "delivered"]),
      ),
    );

  const [requiredAgg] = await db
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

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    wpOrderId: order.wpOrderId,
    customerId: order.customerId,
    customerName,
    recipientEmail,
    recipientPhone,
    storeName: order.storeName,
    assignments: assignmentRows.map((r) => ({
      assignmentId: r.assignmentId,
      codeId: r.codeId,
      status: r.status,
      codePreview: r.codePreview,
      productName: r.productName,
      instructionsTemplate: r.instructionsTemplate,
      deliverOnStatuses: r.deliverOnStatuses ?? [],
    })),
    requiredCodes: Number(requiredAgg?.value ?? 0),
  };
}

/** Audit entry for a delivery run — ids/counts/channel/status only, never codes. */
export interface DeliveryAuditEntry {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  message: string;
  metadata: Record<string, unknown>;
}

export function buildDeliveryAuditEntry(
  result: DeliveryRunResult,
  isRetry: boolean,
): DeliveryAuditEntry {
  let action: AuditAction;
  let message: string;
  if (result.delivered) {
    action = isRetry
      ? AUDIT_ACTIONS.DIGITAL_DELIVERY_RETRIED
      : AUDIT_ACTIONS.DIGITAL_CODES_DELIVERED;
    message = isRetry ? "أعاد تسليم الأكواد الرقمية" : "سلّم الأكواد الرقمية";
  } else {
    action = AUDIT_ACTIONS.DIGITAL_DELIVERY_FAILED;
    message = "فشل تسليم الأكواد الرقمية";
  }
  return {
    action,
    entityType: AUDIT_ENTITY_TYPES.DIGITAL_DELIVERY,
    entityId: result.orderId,
    message,
    metadata: {
      orderId: result.orderId,
      deliveryId: result.delivery?.id ?? null,
      assignmentCount: result.assignmentCount,
      channel: result.channel,
      status: result.delivery?.status ?? (result.delivered ? "completed" : "failed"),
    },
  };
}

/**
 * Delivers an order's assigned codes (Phase 18, plan2 §18). Safe + idempotent:
 *
 *  - Tenant-scoped throughout.
 *  - No raw codes: the channel transmits a "codes ready" notice only; the stored
 *    message_preview uses masked previews. Nothing here decrypts a code.
 *  - Idempotent: a fully-delivered order is a no-op (no duplicate message) unless
 *    `force`. On success, assignments + codes move to `delivered` and the order
 *    reaches `completed` only when every required code is delivered.
 *  - On failure/skip: codes are NOT marked delivered; a safe reason is kept for
 *    retry and a notification is raised.
 *
 * The channel's (possibly networked) send runs OUTSIDE the DB transaction; only
 * the resulting state changes are transactional.
 */
export async function deliverCodesForOrder(
  storeId: string,
  orderId: string,
  options: DeliverOptions,
): Promise<DeliveryRunResult> {
  const ctx = await loadDeliveryContext(storeId, orderId);

  if (ctx.assignments.length === 0) {
    throw new ValidationError("Order has no assigned codes to deliver.");
  }

  // Eligibility: order status must be in the products' deliver_on_statuses
  // (unless forced — a staff override).
  if (!options.force) {
    const eligibleStatuses = new Set(
      ctx.assignments.flatMap((a) => a.deliverOnStatuses),
    );
    if (!eligibleStatuses.has(ctx.orderStatus)) {
      throw new ValidationError(
        "Order status is not eligible for delivery (deliver_on_statuses).",
      );
    }
  }

  const undelivered = ctx.assignments.filter((a) => a.status === "assigned");

  // Idempotent no-op: everything already delivered and not forced.
  if (undelivered.length === 0 && !options.force) {
    const [latest] = await db
      .select()
      .from(digitalDeliveries)
      .where(
        and(
          eq(digitalDeliveries.storeId, storeId),
          eq(digitalDeliveries.orderId, orderId),
          eq(digitalDeliveries.status, "completed"),
        ),
      )
      .orderBy(desc(digitalDeliveries.createdAt))
      .limit(1);
    if (latest) {
      return {
        orderId,
        delivery: latest,
        attempt: null,
        delivered: true,
        idempotentNoop: true,
        orderStatus: "completed",
        assignmentCount: 0,
        channel: options.channel,
      };
    }
  }

  const targetAssignments =
    undelivered.length > 0 ? undelivered : ctx.assignments;
  const maskedCodes = targetAssignments.map((a) => a.codePreview ?? "••••");
  const instructions = targetAssignments[0]?.instructionsTemplate ?? "";
  const productName = targetAssignments[0]?.productName ?? "";

  // Masked, safe preview (never contains raw codes).
  const messagePreview = renderDeliveryMessage(DEFAULT_DELIVERY_TEMPLATE, {
    customerName: ctx.customerName,
    orderNumber: ctx.orderNumber ?? ctx.orderId,
    productName,
    maskedCodes,
    instructions,
    storeName: ctx.storeName,
  });

  const now = new Date();
  const [delivery] = await db
    .insert(digitalDeliveries)
    .values({
      storeId,
      orderId,
      customerId: ctx.customerId,
      status: "processing",
      channel: options.channel,
      recipientEmail: ctx.recipientEmail,
      recipientPhone: ctx.recipientPhone,
      subject: `طلب ${ctx.orderNumber ?? ctx.orderId}`,
      messagePreview,
      attemptCount: 0,
      createdBy: options.actorUserId,
    })
    .returning();
  if (!delivery) {
    throw new Error("Failed to create delivery record");
  }

  // Channel send runs OUTSIDE any transaction (it may do network I/O).
  const channelResult = await runChannel(options.channel, {
    storeId,
    orderId,
    wpOrderId: ctx.wpOrderId,
    orderNumber: ctx.orderNumber,
    assignmentCount: targetAssignments.length,
  });

  const finalRow = await db.transaction(async (tx) => {
    const [attempt] = await tx
      .insert(deliveryAttempts)
      .values({
        storeId,
        deliveryId: delivery.id,
        orderId,
        channel: options.channel,
        status: channelResult.status,
        provider: channelResult.provider,
        providerMessageId: channelResult.providerMessageId,
        errorCode: channelResult.errorCode,
        errorMessage: channelResult.errorMessage,
      })
      .returning();

    if (channelResult.status === "sent") {
      const assignmentIds = targetAssignments.map((a) => a.assignmentId);
      const codeIds = targetAssignments.map((a) => a.codeId);
      await tx
        .update(codeAssignments)
        .set({ status: "delivered", deliveredAt: now, updatedAt: now })
        .where(
          and(
            eq(codeAssignments.storeId, storeId),
            inArray(codeAssignments.id, assignmentIds),
          ),
        );
      await tx
        .update(digitalCodes)
        .set({ status: "delivered", deliveredAt: now, updatedAt: now })
        .where(
          and(
            eq(digitalCodes.storeId, storeId),
            inArray(digitalCodes.id, codeIds),
          ),
        );

      // Order is completed only when every required code is now delivered.
      const [pending] = await tx
        .select({ value: count() })
        .from(codeAssignments)
        .where(
          and(
            eq(codeAssignments.storeId, storeId),
            eq(codeAssignments.orderId, orderId),
            eq(codeAssignments.status, "assigned"),
          ),
        );
      const [deliveredAgg] = await tx
        .select({ value: count() })
        .from(codeAssignments)
        .where(
          and(
            eq(codeAssignments.storeId, storeId),
            eq(codeAssignments.orderId, orderId),
            eq(codeAssignments.status, "delivered"),
          ),
        );
      const pendingCount = Number(pending?.value ?? 0);
      const deliveredCount = Number(deliveredAgg?.value ?? 0);
      const orderCompleted =
        pendingCount === 0 && deliveredCount >= ctx.requiredCodes && ctx.requiredCodes > 0;

      if (orderCompleted) {
        await tx
          .update(orders)
          .set({
            digitalDeliveryStatus: "completed",
            digitalDeliveryCompletedAt: now,
            updatedAt: now,
          })
          .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)));
      }

      const [updated] = await tx
        .update(digitalDeliveries)
        .set({
          status: "completed",
          attemptCount: delivery.attemptCount + 1,
          lastAttemptAt: now,
          completedAt: now,
          failedReason: null,
          updatedAt: now,
        })
        .where(eq(digitalDeliveries.id, delivery.id))
        .returning();
      return { delivery: updated ?? delivery, attempt: attempt ?? null, orderCompleted };
    }

    // failed → 'failed'; skipped → 'manual_review' (needs another channel).
    const deliveryStatus = channelResult.status === "failed" ? "failed" : "manual_review";
    const [updated] = await tx
      .update(digitalDeliveries)
      .set({
        status: deliveryStatus,
        attemptCount: delivery.attemptCount + 1,
        lastAttemptAt: now,
        failedReason: channelResult.errorMessage,
        updatedAt: now,
      })
      .where(eq(digitalDeliveries.id, delivery.id))
      .returning();
    return { delivery: updated ?? delivery, attempt: attempt ?? null, orderCompleted: false };
  });

  const delivered = channelResult.status === "sent";
  const result: DeliveryRunResult = {
    orderId,
    delivery: finalRow.delivery,
    attempt: finalRow.attempt,
    delivered,
    idempotentNoop: false,
    orderStatus: finalRow.orderCompleted ? "completed" : ctx.orderStatus,
    assignmentCount: targetAssignments.length,
    channel: options.channel,
  };

  if (!delivered) {
    await notifyDeliveryProblem(storeId, orderId, channelResult.status, ctx);
  }
  return result;
}

/** Retry: re-attempt delivery for an order's not-yet-delivered codes. */
export async function retryDeliveryForOrder(
  storeId: string,
  orderId: string,
  channel: DeliveryChannel,
  actorUserId: string | null,
): Promise<DeliveryRunResult> {
  return deliverCodesForOrder(storeId, orderId, {
    channel,
    force: false,
    actorUserId,
    isRetry: true,
  });
}

/**
 * Auto-delivery seam for the webhook path (best-effort, never throws). Delivers
 * via the safe `dashboard` channel when a product has auto-delivery enabled in
 * `automatic` mode and the order status is in its `deliver_on_statuses`.
 */
export async function maybeDeliverCodesForOrder(
  storeId: string,
  orderId: string,
): Promise<void> {
  try {
    const eligible = await db
      .select({ id: digitalProductSettings.id })
      .from(orderItems)
      .innerJoin(
        digitalProductSettings,
        and(
          eq(digitalProductSettings.storeId, orderItems.storeId),
          eq(digitalProductSettings.productId, orderItems.productId),
        ),
      )
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.storeId, storeId),
          eq(orderItems.orderId, orderId),
          eq(digitalProductSettings.isEnabled, true),
          eq(digitalProductSettings.autoDeliveryEnabled, true),
          eq(digitalProductSettings.deliveryMode, "automatic"),
          sql`${orders.status} = any(${digitalProductSettings.deliverOnStatuses})`,
        ),
      )
      .limit(1);
    if (eligible.length === 0) return;

    const result = await deliverCodesForOrder(storeId, orderId, {
      channel: "dashboard",
      force: false,
      actorUserId: null,
      isRetry: false,
    });
    if (result.idempotentNoop) return;

    const entry = buildDeliveryAuditEntry(result, false);
    await recordAuditLog({
      storeId,
      userId: null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      message: entry.message,
      metadata: entry.metadata,
      ipAddress: null,
      userAgent: null,
    });
  } catch (err) {
    logger.error({ err, storeId, orderId }, "Auto digital delivery failed");
  }
}

/** Best-effort notification when a delivery could not complete. Never throws. */
async function notifyDeliveryProblem(
  storeId: string,
  orderId: string,
  channelStatus: string,
  ctx: DeliveryContext,
): Promise<void> {
  try {
    const manual = channelStatus === "skipped";
    await createNotification({
      storeId,
      type: "digital_inventory",
      title: manual ? "تسليم يحتاج إجراءً يدوياً" : "فشل تسليم الأكواد",
      message: `تعذّر تسليم أكواد الطلب ${ctx.orderNumber ?? orderId}.`,
      severity: manual ? "warning" : "error",
      metadata: { orderId },
    });
  } catch {
    // best-effort
  }
}

/* --------------------------------- Reads --------------------------------- */

/** Verifies an order belongs to the store (404 otherwise). */
async function assertOwnedOrder(storeId: string, orderId: string): Promise<void> {
  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.id, orderId)))
    .limit(1);
  if (!order) {
    throw new NotFoundError("Order not found");
  }
}

export interface OrderDeliveriesView {
  deliveries: DigitalDeliveryRow[];
  attempts: DeliveryAttemptRow[];
}

/** All deliveries + attempts for an order (tenant-scoped). */
export async function listOrderDeliveries(
  storeId: string,
  orderId: string,
): Promise<OrderDeliveriesView> {
  await assertOwnedOrder(storeId, orderId);
  const [deliveries, attempts] = await Promise.all([
    db
      .select()
      .from(digitalDeliveries)
      .where(
        and(
          eq(digitalDeliveries.storeId, storeId),
          eq(digitalDeliveries.orderId, orderId),
        ),
      )
      .orderBy(desc(digitalDeliveries.createdAt), desc(digitalDeliveries.id)),
    db
      .select()
      .from(deliveryAttempts)
      .where(
        and(
          eq(deliveryAttempts.storeId, storeId),
          eq(deliveryAttempts.orderId, orderId),
        ),
      )
      .orderBy(desc(deliveryAttempts.createdAt), desc(deliveryAttempts.id)),
  ]);
  return { deliveries, attempts };
}

export interface DeliveryListResult {
  items: DigitalDeliveryRow[];
  total: number;
  page: number;
  limit: number;
}

/** Store-wide deliveries list with optional filters. */
export async function listDeliveries(
  storeId: string,
  query: ListDeliveriesQuery,
): Promise<DeliveryListResult> {
  const conditions = [eq(digitalDeliveries.storeId, storeId)];
  if (query.orderId) conditions.push(eq(digitalDeliveries.orderId, query.orderId));
  if (query.status) conditions.push(eq(digitalDeliveries.status, query.status));
  if (query.channel) conditions.push(eq(digitalDeliveries.channel, query.channel));
  const whereClause = and(...conditions);
  const offset = (query.page - 1) * query.limit;

  const [items, totals] = await Promise.all([
    db
      .select()
      .from(digitalDeliveries)
      .where(whereClause)
      .orderBy(desc(digitalDeliveries.createdAt), desc(digitalDeliveries.id))
      .limit(query.limit)
      .offset(offset),
    db.select({ value: count() }).from(digitalDeliveries).where(whereClause),
  ]);

  return {
    items,
    total: Number(totals[0]?.value ?? 0),
    page: query.page,
    limit: query.limit,
  };
}

export interface DeliveryDetails {
  delivery: DigitalDeliveryRow;
  attempts: DeliveryAttemptRow[];
}

/** One delivery with its attempts (tenant-scoped). Null when not found. */
export async function getDelivery(
  storeId: string,
  id: string,
): Promise<DeliveryDetails | null> {
  const [delivery] = await db
    .select()
    .from(digitalDeliveries)
    .where(and(eq(digitalDeliveries.storeId, storeId), eq(digitalDeliveries.id, id)))
    .limit(1);
  if (!delivery) return null;

  const attempts = await db
    .select()
    .from(deliveryAttempts)
    .where(
      and(
        eq(deliveryAttempts.storeId, storeId),
        eq(deliveryAttempts.deliveryId, id),
      ),
    )
    .orderBy(desc(deliveryAttempts.createdAt), desc(deliveryAttempts.id));

  return { delivery, attempts };
}
