import type { StatusTone } from "@/components/shared/StatusBadge";
import { resolveOrderStatus } from "@/components/orders/order-status";
import type { OrderStatusSlice } from "@/lib/dashboard-api";

/** Bar fill colour per semantic tone (theme tokens, light/dark safe). */
const TONE_BG: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-primary",
  neutral: "bg-muted-foreground",
};

interface StatusDistributionProps {
  data: OrderStatusSlice[];
}

/** Horizontal proportion bars for the order status distribution. */
export function StatusDistribution({ data }: StatusDistributionProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        لا توجد طلبات في هذه الفترة.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((slice) => {
        const meta = resolveOrderStatus(slice.status);
        const pct = Math.round((slice.count / total) * 100);
        return (
          <li key={slice.status}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{meta.label}</span>
              <span className="font-medium">
                {slice.count}
                <span className="ms-1 text-xs text-muted-foreground">
                  ({pct}%)
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${TONE_BG[meta.tone]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
