import { z } from "zod";
import { DELIVERY_CHANNELS } from "../../db/schema/digital-deliveries";

/**
 * Validation for the Phase 19 manual fulfillment / replacement / release tools.
 * Every destructive action requires a `reason` (enforced here at the boundary).
 * No raw codes are ever accepted or returned.
 */

const reasonField = z.string().trim().min(3, "A reason is required").max(500);

/**
 * Body for POST /digital-delivery/orders/:orderId/manual-assign. The target line
 * is identified by `orderItemId` (preferred) or `productId`; at least one is
 * required. The chosen code must be available and belong to that product.
 */
export const manualAssignSchema = z
  .object({
    codeId: z.string().uuid(),
    orderItemId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    reason: reasonField,
  })
  .refine((b) => Boolean(b.orderItemId || b.productId), {
    message: "Provide orderItemId or productId",
    path: ["orderItemId"],
  });

export type ManualAssignInput = z.infer<typeof manualAssignSchema>;

/**
 * Body for POST /digital-delivery/assignments/:assignmentId/replace. When
 * `replacementCodeId` is omitted the engine auto-picks the next available code
 * for the same product. `resendNow` re-delivers the replacement immediately via
 * the (safe) dashboard channel.
 */
export const replaceSchema = z.object({
  replacementCodeId: z.string().uuid().optional(),
  reason: reasonField,
  resendNow: z.boolean().default(false),
});

export type ReplaceInput = z.infer<typeof replaceSchema>;

/** Body for POST /digital-delivery/orders/:orderId/release. */
export const releaseSchema = z.object({
  mode: z.enum(["cancel", "refund", "manual_release"]),
  reason: reasonField,
});

export type ReleaseInput = z.infer<typeof releaseSchema>;

export const assignmentParamsSchema = z.object({
  assignmentId: z.string().uuid(),
});

export type AssignmentParams = z.infer<typeof assignmentParamsSchema>;

/**
 * Body for POST /digital-delivery/assignments/:assignmentId/resend. Re-delivers
 * the assignment's code through the chosen (default: safe dashboard) channel
 * without creating a new assignment. No reason required — resend is not destructive.
 */
export const resendSchema = z.object({
  channel: z.enum(DELIVERY_CHANNELS).default("dashboard"),
});

export type ResendInput = z.infer<typeof resendSchema>;

/**
 * Body for PATCH /digital-delivery/assignments/:assignmentId/status. Only the
 * destructive support targets are settable here; a reason is always required.
 * The code-side effect honors the "delivered codes never return to stock" rule.
 */
export const assignmentStatusSchema = z.object({
  status: z.enum(["cancelled", "refunded", "failed"]),
  reason: reasonField,
});

export type AssignmentStatusInput = z.infer<typeof assignmentStatusSchema>;
