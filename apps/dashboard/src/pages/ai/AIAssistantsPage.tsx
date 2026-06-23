import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProductDescriptionCard } from "@/components/ai/ProductDescriptionCard";
import { SalesSummaryCard } from "@/components/ai/SalesSummaryCard";
import { LowStockInsightsCard } from "@/components/ai/LowStockInsightsCard";
import { useAuth } from "@/components/auth/AuthProvider";

export function AIAssistantsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("ai.view");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="المساعد الذكي"
        description="مساعدات ذكاء اصطناعي لتوليد أوصاف المنتجات وملخصات المبيعات وتوصيات المخزون. اقتراحات فقط — لا يتم حفظ أو تعديل أي بيانات تلقائيًا."
      />

      {!canView ? (
        <EmptyState
          icon={ShieldAlert}
          title="لا تملك صلاحية الوصول"
          description="تحتاج صلاحية «استخدام المساعد الذكي» للاطّلاع على هذه الصفحة."
        />
      ) : (
        <div className="space-y-6">
          <ProductDescriptionCard />
          <SalesSummaryCard />
          <LowStockInsightsCard />
        </div>
      )}
    </div>
  );
}
