import type { StatusTone } from "@/components/shared/StatusBadge";
import type { OrderStatus } from "@/lib/orders-api";

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

/** Arabic label + badge tone for each known WooCommerce order status. */
export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  pending: { label: "قيد الانتظار", tone: "warning" },
  processing: { label: "قيد المعالجة", tone: "info" },
  "on-hold": { label: "معلّق", tone: "neutral" },
  completed: { label: "مكتمل", tone: "success" },
  cancelled: { label: "ملغي", tone: "danger" },
  refunded: { label: "مُسترجع", tone: "neutral" },
  failed: { label: "فاشل", tone: "danger" },
};

/** Resolve a raw status string to its label + tone, tolerating unknown values. */
export function resolveOrderStatus(status: string): StatusMeta {
  return (
    ORDER_STATUS_META[status as OrderStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

/** Ordered options for the status filter select ("all" handled by the page). */
export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: ORDER_STATUS_META.pending.label },
  { value: "processing", label: ORDER_STATUS_META.processing.label },
  { value: "on-hold", label: ORDER_STATUS_META["on-hold"].label },
  { value: "completed", label: ORDER_STATUS_META.completed.label },
  { value: "cancelled", label: ORDER_STATUS_META.cancelled.label },
  { value: "refunded", label: ORDER_STATUS_META.refunded.label },
  { value: "failed", label: ORDER_STATUS_META.failed.label },
];
