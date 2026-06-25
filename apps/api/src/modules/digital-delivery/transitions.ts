import { ValidationError } from "../../lib/errors";

/**
 * Centralized status-transition rules for the Phase 19 manual/exception tools.
 * Pure + side-effect free so the safety logic is unit-tested in isolation.
 *
 * The golden rule (plan2 §19): a DELIVERED code is never returned to available
 * automatically — only undelivered (assigned/sold-but-not-delivered) codes may go
 * back to stock. `decideReleaseOutcome` encodes that rule.
 */

/**
 * Target statuses that ALWAYS require an operator reason when reached through a
 * manual/exception action (validated at the Zod boundary + asserted here).
 */
export const REASON_REQUIRED_STATUSES = [
  "invalid",
  "voided",
  "replaced",
  "refunded",
  "released",
  "cancelled",
] as const;

export function requiresReason(status: string): boolean {
  return (REASON_REQUIRED_STATUSES as readonly string[]).includes(status);
}

/**
 * Allowed `digital_codes.status` transitions for manual/exception flows (a
 * superset of the Phase 16 manual status endpoint). Note `delivered` can never
 * transition to `available` — it can only be refunded/invalidated/replaced.
 */
const CODE_TRANSITIONS: Record<string, readonly string[]> = {
  available: ["sold", "reserved", "voided", "invalid", "expired"],
  reserved: ["available", "sold", "voided", "invalid", "expired"],
  // `available` here = release of an UNDELIVERED (sold, not delivered) code.
  sold: ["delivered", "available", "invalid", "refunded", "voided"],
  // delivered NEVER → available.
  delivered: ["refunded", "invalid", "replacement"],
  replacement: ["delivered", "sold", "refunded", "invalid"],
  invalid: [],
  voided: [],
  refunded: [],
  expired: [],
};

export function isCodeTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return true;
  return (CODE_TRANSITIONS[from] ?? []).includes(to);
}

/** Asserts a code status transition is allowed, throwing 400 otherwise. */
export function assertCodeTransition(from: string, to: string): void {
  if (!isCodeTransitionAllowed(from, to)) {
    throw new ValidationError(
      `Illegal code status transition: "${from}" → "${to}".`,
    );
  }
}

/** Allowed `code_assignments.status` transitions for manual/exception flows. */
const ASSIGNMENT_TRANSITIONS: Record<string, readonly string[]> = {
  assigned: ["delivered", "replaced", "cancelled", "refunded", "failed"],
  delivered: ["replaced", "refunded", "cancelled"],
  replaced: [],
  refunded: [],
  cancelled: [],
  failed: [],
};

export function isAssignmentTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return true;
  return (ASSIGNMENT_TRANSITIONS[from] ?? []).includes(to);
}

export function assertAssignmentTransition(from: string, to: string): void {
  if (!isAssignmentTransitionAllowed(from, to)) {
    throw new ValidationError(
      `Illegal assignment status transition: "${from}" → "${to}".`,
    );
  }
}

/* ------------------------------ Release logic ----------------------------- */

export type ReleaseMode = "cancel" | "refund" | "manual_release";

export interface ReleaseOutcome {
  /** What to do with this assignment's code. */
  action: "release_to_available" | "lock_refunded" | "skip";
  /** New code status, or null to leave unchanged. */
  newCodeStatus: string | null;
  /** New assignment status, or null to leave unchanged. */
  newAssignmentStatus: string | null;
  /** Whether this code had already been delivered to the customer. */
  delivered: boolean;
}

/**
 * Decides what happens to one assignment's code on order cancel/refund/release
 * (plan2 §19). The single source of the safety rule:
 *
 *  - UNDELIVERED (assignment `assigned`): safe to return to stock → `available`,
 *    assignment `cancelled`.
 *  - DELIVERED: NEVER returns to stock. On cancel/refund the code is locked as
 *    `refunded`; on `manual_release` it is left untouched (it was already given
 *    to the customer). Either way it needs manual attention.
 *  - Anything else (already replaced/refunded/cancelled): no-op.
 */
export function decideReleaseOutcome(
  assignmentStatus: string,
  mode: ReleaseMode,
): ReleaseOutcome {
  if (assignmentStatus === "assigned") {
    return {
      action: "release_to_available",
      newCodeStatus: "available",
      newAssignmentStatus: "cancelled",
      delivered: false,
    };
  }
  if (assignmentStatus === "delivered") {
    if (mode === "manual_release") {
      return {
        action: "skip",
        newCodeStatus: null,
        newAssignmentStatus: null,
        delivered: true,
      };
    }
    return {
      action: "lock_refunded",
      newCodeStatus: "refunded",
      newAssignmentStatus: mode === "refund" ? "refunded" : "cancelled",
      delivered: true,
    };
  }
  return {
    action: "skip",
    newCodeStatus: null,
    newAssignmentStatus: null,
    delivered: false,
  };
}

/** Resulting order digital status for a release mode. */
export function orderStatusForRelease(mode: ReleaseMode): string {
  if (mode === "refund") return "refunded";
  if (mode === "cancel") return "cancelled";
  return "manual_review";
}
