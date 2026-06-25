import { z } from "zod";

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
