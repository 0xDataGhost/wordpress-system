import type { DeliveryAttemptRow } from "../../db/schema/delivery-attempts";
import type { DigitalDeliveryRow } from "../../db/schema/digital-deliveries";

/**
 * Public DTOs for deliveries and attempts. SECURITY: `messagePreview` is a masked
 * rendering only; no field here exposes a raw/decrypted code or a full
 * customer message body containing codes.
 */

export interface DeliveryDto {
  id: string;
  orderId: string;
  customerId: string | null;
  status: string;
  channel: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  subject: string | null;
  messagePreview: string | null;
  attemptCount: number;
  lastAttemptAt: Date | null;
  completedAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toDeliveryDto(row: DigitalDeliveryRow): DeliveryDto {
  return {
    id: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    status: row.status,
    channel: row.channel,
    recipientEmail: row.recipientEmail,
    recipientPhone: row.recipientPhone,
    subject: row.subject,
    messagePreview: row.messagePreview,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
    completedAt: row.completedAt,
    failedReason: row.failedReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export interface DeliveryAttemptDto {
  id: string;
  deliveryId: string;
  orderId: string;
  channel: string;
  status: string;
  provider: string | null;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export function toDeliveryAttemptDto(row: DeliveryAttemptRow): DeliveryAttemptDto {
  return {
    id: row.id,
    deliveryId: row.deliveryId,
    orderId: row.orderId,
    channel: row.channel,
    status: row.status,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
  };
}
