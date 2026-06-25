import type { Request, Response } from "express";
import { successResponse } from "../../lib/api-response";
import { NotFoundError } from "../../lib/errors";
import { getAuth } from "../../middleware/authenticate";
import { recordAuditFromRequest } from "../audit-logs/audit-logs.recorder";
import {
  buildDeliveryAuditEntry,
  deliverCodesForOrder,
  getDelivery,
  listDeliveries,
  listOrderDeliveries,
  retryDeliveryForOrder,
} from "./delivery.service";
import {
  toDeliveryAttemptDto,
  toDeliveryDto,
} from "./delivery.serializer";
import type {
  DeliverInput,
  DeliveryParams,
  ListDeliveriesQuery,
  RetryInput,
} from "./delivery.schemas";
import type { OrderParams } from "./digital-delivery.schemas";

/** POST /digital-delivery/orders/:orderId/deliver (digital_delivery.deliver). */
export async function deliverHandler(req: Request, res: Response): Promise<void> {
  const { storeId, userId } = getAuth(req);
  const { orderId } = req.params as OrderParams;
  const body = req.body as DeliverInput;

  const result = await deliverCodesForOrder(storeId, orderId, {
    channel: body.channel,
    force: body.force,
    actorUserId: userId,
    isRetry: false,
  });

  if (!result.idempotentNoop) {
    const entry = buildDeliveryAuditEntry(result, false);
    await recordAuditFromRequest(req, entry);
  }

  res.status(200).json(
    successResponse(
      {
        orderId,
        delivered: result.delivered,
        idempotent: result.idempotentNoop,
        channel: result.channel,
        delivery: result.delivery ? toDeliveryDto(result.delivery) : null,
      },
      result.delivered ? "Delivery complete" : "Delivery attempted",
    ),
  );
}

/** POST /digital-delivery/orders/:orderId/retry (digital_delivery.retry). */
export async function retryHandler(req: Request, res: Response): Promise<void> {
  const { storeId, userId } = getAuth(req);
  const { orderId } = req.params as OrderParams;
  const body = req.body as RetryInput;

  const result = await retryDeliveryForOrder(storeId, orderId, body.channel, userId);

  if (!result.idempotentNoop) {
    const entry = buildDeliveryAuditEntry(result, true);
    await recordAuditFromRequest(req, entry);
  }

  res.status(200).json(
    successResponse(
      {
        orderId,
        delivered: result.delivered,
        idempotent: result.idempotentNoop,
        channel: result.channel,
        delivery: result.delivery ? toDeliveryDto(result.delivery) : null,
      },
      result.delivered ? "Retry complete" : "Retry attempted",
    ),
  );
}

/** GET /digital-delivery/orders/:orderId/deliveries (digital_delivery.view). */
export async function listOrderDeliveriesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const { orderId } = req.params as OrderParams;
  const view = await listOrderDeliveries(storeId, orderId);
  res.status(200).json(
    successResponse({
      orderId,
      deliveries: view.deliveries.map(toDeliveryDto),
      attempts: view.attempts.map(toDeliveryAttemptDto),
    }),
  );
}

/** GET /digital-delivery/deliveries (digital_delivery.view). */
export async function listDeliveriesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const query = req.query as unknown as ListDeliveriesQuery;
  const result = await listDeliveries(storeId, query);
  res.status(200).json(
    successResponse({
      items: result.items.map(toDeliveryDto),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    }),
  );
}

/** GET /digital-delivery/deliveries/:id (digital_delivery.view). */
export async function getDeliveryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { storeId } = getAuth(req);
  const { id } = req.params as DeliveryParams;
  const details = await getDelivery(storeId, id);
  if (!details) {
    throw new NotFoundError("Delivery not found");
  }
  res.status(200).json(
    successResponse({
      ...toDeliveryDto(details.delivery),
      attempts: details.attempts.map(toDeliveryAttemptDto),
    }),
  );
}
