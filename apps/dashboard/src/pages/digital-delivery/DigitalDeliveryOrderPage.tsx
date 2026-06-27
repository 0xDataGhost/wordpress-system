import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { OrderDigitalSection } from "@/components/digital-delivery/OrderDigitalSection";
import { getOrder, type OrderDetailsDto } from "@/lib/orders-api";

export function DigitalDeliveryOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView = hasPermission("digital_delivery.view");

  const [order, setOrder] = useState<OrderDetailsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(false);
    try {
      setOrder(await getOrder(orderId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!canView) return;
    void load();
  }, [canView, load]);

  const title = order
    ? `التسليم الرقمي — الطلب ${order.orderNumber ?? order.wpOrderId ?? ""}`
    : "التسليم الرقمي";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={title}
        description="تعيين وتسليم وإدارة الأكواد الرقمية لهذا الطلب."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/digital-delivery")}
            >
              <ArrowRight className="h-4 w-4" />
              قائمة التسليم
            </Button>
            {order ? (
              <Button
                variant="ghost"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                تفاصيل الطلب
              </Button>
            ) : null}
          </div>
        }
      />

      {!canView ? (
        <EmptyState
          title="لا تملك صلاحية الوصول"
          description="تحتاج صلاحية «عرض تسليم الأكواد» لرؤية هذه الصفحة."
        />
      ) : loading ? (
        <LoadingState />
      ) : error || !order || !orderId ? (
        <ErrorState
          description="تعذّر تحميل الطلب."
          onRetry={() => void load()}
        />
      ) : (
        <OrderDigitalSection orderId={orderId} orderItems={order.items} />
      )}
    </div>
  );
}
