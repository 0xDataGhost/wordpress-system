import { BarChart3, Package, ShoppingCart, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Phase 1 dashboard placeholder. Cards use placeholder values; real analytics
 * are wired up in Phase 9 once the backend and sync exist.
 */
export function DashboardPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على أداء متجرك. ستظهر البيانات الفعلية بعد ربط المتجر والمزامنة."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="مبيعات اليوم"
          value="—"
          icon={Wallet}
          hint="بانتظار الربط"
        />
        <StatsCard
          title="عدد الطلبات"
          value="—"
          icon={ShoppingCart}
          hint="بانتظار الربط"
        />
        <StatsCard
          title="عدد العملاء"
          value="—"
          icon={Users}
          hint="بانتظار الربط"
        />
        <StatsCard
          title="منتجات منخفضة المخزون"
          value="—"
          icon={Package}
          hint="بانتظار الربط"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>المبيعات عبر الزمن</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={BarChart3}
              title="لا توجد بيانات بعد"
              description="ستظهر الرسوم البيانية للمبيعات هنا بعد إتمام المزامنة مع المتجر."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آخر الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={ShoppingCart}
              title="لا توجد طلبات"
              description="سيتم عرض أحدث الطلبات هنا."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
