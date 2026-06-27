import type { StatusTone } from "@/components/shared/StatusBadge";
import type { SupplierStatus } from "@/lib/suppliers-api";

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

/** Arabic label + badge tone for each supplier status. */
export const SUPPLIER_STATUS_META: Record<SupplierStatus, StatusMeta> = {
  active: { label: "نشط", tone: "success" },
  paused: { label: "موقوف", tone: "warning" },
  archived: { label: "مؤرشف", tone: "neutral" },
};

export function resolveSupplierStatus(status: string): StatusMeta {
  return (
    SUPPLIER_STATUS_META[status as SupplierStatus] ?? {
      label: status,
      tone: "neutral",
    }
  );
}

export const SUPPLIER_STATUS_OPTIONS: { value: SupplierStatus; label: string }[] =
  (Object.keys(SUPPLIER_STATUS_META) as SupplierStatus[]).map((value) => ({
    value,
    label: SUPPLIER_STATUS_META[value].label,
  }));
