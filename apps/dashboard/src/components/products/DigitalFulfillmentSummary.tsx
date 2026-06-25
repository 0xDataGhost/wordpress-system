import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ORDER_STATUS_META } from "@/components/orders/order-status";
import {
  CODE_POOL_STRATEGY_LABELS,
  DELIVERY_MODE_LABELS,
  FULFILLMENT_TYPE_LABELS,
} from "@/components/products/digital-settings-options";
import type { DigitalSettingsDto } from "@/lib/digital-products-api";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

function StatusList({ statuses }: { statuses: DigitalSettingsDto["reserve_on_statuses"] }) {
  if (statuses.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {statuses.map((status) => (
        <StatusBadge
          key={status}
          label={ORDER_STATUS_META[status]?.label ?? status}
          tone={ORDER_STATUS_META[status]?.tone ?? "neutral"}
        />
      ))}
    </span>
  );
}

/**
 * Read-only digital fulfillment summary for the product details page. Renders
 * only the safe configuration — no codes, no inventory. Shown to users with
 * `digital_inventory.view`.
 */
export function DigitalFulfillmentSummary({
  settings,
}: {
  settings: DigitalSettingsDto;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>التسليم الرقمي</CardTitle>
        {settings.is_enabled ? (
          <Badge variant="success">مُفعّل</Badge>
        ) : (
          <Badge variant="outline">غير مُفعّل</Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {settings.is_enabled ? (
          <>
            <Row label="نوع التسليم">
              {FULFILLMENT_TYPE_LABELS[settings.fulfillment_type]}
            </Row>
            <Row label="طريقة التسليم">
              {DELIVERY_MODE_LABELS[settings.delivery_mode]}
            </Row>
            <Row label="التسليم التلقائي">
              {settings.auto_delivery_enabled ? "نعم" : "لا"}
            </Row>
            <Row label="استراتيجية اختيار الكود">
              {CODE_POOL_STRATEGY_LABELS[settings.code_pool_strategy]}
            </Row>
            <Row label="حالات حجز الكود">
              <StatusList statuses={settings.reserve_on_statuses} />
            </Row>
            <Row label="حالات إرسال الكود">
              <StatusList statuses={settings.deliver_on_statuses} />
            </Row>
            <Row label="حد تنبيه انخفاض الأكواد">
              {settings.low_stock_threshold}
            </Row>
            <Row label="أقصى عدد أكواد في عنصر الطلب">
              {settings.max_codes_per_order_item}
            </Row>
          </>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">
            التسليم الرقمي غير مُفعّل لهذا المنتج. فعّله من صفحة التعديل لإدارة
            الأكواد لاحقًا.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
