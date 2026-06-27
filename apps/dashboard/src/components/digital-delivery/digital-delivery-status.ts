import type { StatusTone } from "@/components/shared/StatusBadge";
import type { DigitalDeliveryStatus } from "@/lib/digital-delivery-api";

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

/** Arabic label + tone for an order's derived digital fulfillment status. */
export const DIGITAL_DELIVERY_STATUS_META: Record<
  DigitalDeliveryStatus,
  StatusMeta
> = {
  pending: { label: "بانتظار التعيين", tone: "warning" },
  partial: { label: "تعيين جزئي", tone: "warning" },
  reserved: { label: "مُعيَّن", tone: "info" },
  failed: { label: "فشل", tone: "danger" },
  manual_review: { label: "مراجعة يدوية", tone: "warning" },
  completed: { label: "مكتمل", tone: "success" },
};

export function resolveDigitalDeliveryStatus(status: string): StatusMeta {
  return (
    DIGITAL_DELIVERY_STATUS_META[status as DigitalDeliveryStatus] ?? {
      label: status === "not_required" ? "غير مطلوب" : status,
      tone: "neutral",
    }
  );
}

export const DIGITAL_DELIVERY_STATUS_OPTIONS: {
  value: DigitalDeliveryStatus;
  label: string;
}[] = (
  Object.keys(DIGITAL_DELIVERY_STATUS_META) as DigitalDeliveryStatus[]
).map((value) => ({ value, label: DIGITAL_DELIVERY_STATUS_META[value].label }));

/** Arabic label + tone for a delivery record status. */
const DELIVERY_STATUS_META: Record<string, StatusMeta> = {
  pending: { label: "قيد الانتظار", tone: "warning" },
  processing: { label: "جاري المعالجة", tone: "info" },
  completed: { label: "مكتمل", tone: "success" },
  failed: { label: "فشل", tone: "danger" },
  cancelled: { label: "ملغى", tone: "neutral" },
  manual_review: { label: "مراجعة يدوية", tone: "warning" },
};

export function resolveDeliveryStatus(status: string): StatusMeta {
  return DELIVERY_STATUS_META[status] ?? { label: status, tone: "neutral" };
}

/** Arabic label + tone for a delivery attempt status. */
const ATTEMPT_STATUS_META: Record<string, StatusMeta> = {
  queued: { label: "في الطابور", tone: "neutral" },
  sent: { label: "أُرسل", tone: "success" },
  failed: { label: "فشل", tone: "danger" },
  skipped: { label: "تم تخطّيه", tone: "warning" },
};

export function resolveAttemptStatus(status: string): StatusMeta {
  return ATTEMPT_STATUS_META[status] ?? { label: status, tone: "neutral" };
}

/** Arabic label + tone for a code-assignment status. */
const ASSIGNMENT_STATUS_META: Record<string, StatusMeta> = {
  assigned: { label: "مُعيَّن", tone: "info" },
  delivered: { label: "مُسلَّم", tone: "success" },
  replaced: { label: "مُستبدل", tone: "neutral" },
  refunded: { label: "مُسترجع", tone: "warning" },
  cancelled: { label: "ملغى", tone: "neutral" },
  failed: { label: "فشل", tone: "danger" },
};

export function resolveAssignmentStatus(status: string): StatusMeta {
  return ASSIGNMENT_STATUS_META[status] ?? { label: status, tone: "neutral" };
}

/** Arabic labels for assignment types. */
export const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
  sale: "بيع",
  manual: "يدوي",
  replacement: "استبدال",
  resend: "إعادة إرسال",
};

/** Arabic labels for delivery channels. */
export const DELIVERY_CHANNEL_LABELS: Record<string, string> = {
  dashboard: "لوحة التحكم",
  email: "البريد الإلكتروني",
  whatsapp: "واتساب",
  woocommerce_note: "ملاحظة ووكومرس",
  manual: "يدوي",
};
