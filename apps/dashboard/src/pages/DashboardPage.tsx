import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Wallet,
  CalendarRange,
  ShoppingCart,
  CalendarClock,
  Receipt,
  Users,
  UserPlus,
  Package,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, type BarDatum } from "@/components/dashboard/BarChart";
import { StatusDistribution } from "@/components/dashboard/StatusDistribution";
import {
  DateRangeFilter,
  type DateRangeValue,
} from "@/components/dashboard/DateRangeFilter";
import { resolveOrderStatus } from "@/components/orders/order-status";
import {
  getLowStock,
  getOrdersChart,
  getRecentOrders,
  getSalesChart,
  getSummary,
  getTopProducts,
  type DashboardSummary,
  type LowStockProduct,
  type OrdersChart,
  type RecentOrder,
  type SalesChart,
  type TopProduct,
} from "@/lib/dashboard-api";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";

/** "YYYY-MM-DD" → "DD/MM" for compact chart axis labels. */
function shortDay(day: string): string {
  const [, m, d] = day.split("-");
  return d && m ? `${d}/${m}` : day;
}

export function DashboardPage() {
  const navigate = useNavigate();

  const [range, setRange] = useState<DateRangeValue>({
    period: "7d",
    dateFrom: "",
    dateTo: "",
  });

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryState, setSummaryState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const [sales, setSales] = useState<SalesChart | null>(null);
  const [ordersChart, setOrdersChart] = useState<OrdersChart | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [analyticsState, setAnalyticsState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentState, setRecentState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [lowStockState, setLowStockState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const [refreshing, setRefreshing] = useState(false);

  // Custom range needs both ends before we can query the range-based endpoints.
  const rangeReady =
    range.period !== "custom" || (!!range.dateFrom && !!range.dateTo);

  const loadSummary = useCallback(async (refresh: boolean) => {
    setSummaryState("loading");
    try {
      setSummary(await getSummary(refresh));
      setSummaryState("ready");
    } catch {
      setSummaryState("error");
    }
  }, []);

  const loadFixedTables = useCallback(async (refresh: boolean) => {
    setRecentState("loading");
    setLowStockState("loading");
    const [recent, low] = await Promise.allSettled([
      getRecentOrders(5, refresh),
      getLowStock(5, refresh),
    ]);
    if (recent.status === "fulfilled") {
      setRecentOrders(recent.value);
      setRecentState("ready");
    } else {
      setRecentState("error");
    }
    if (low.status === "fulfilled") {
      setLowStock(low.value);
      setLowStockState("ready");
    } else {
      setLowStockState("error");
    }
  }, []);

  const loadAnalytics = useCallback(
    async (refresh: boolean) => {
      if (!rangeReady) return;
      setAnalyticsState("loading");
      const params = {
        period: range.period,
        dateFrom: range.dateFrom || undefined,
        dateTo: range.dateTo || undefined,
        refresh,
      };
      try {
        const [s, o, t] = await Promise.all([
          getSalesChart(params),
          getOrdersChart(params),
          getTopProducts(params, 5),
        ]);
        setSales(s);
        setOrdersChart(o);
        setTopProducts(t);
        setAnalyticsState("ready");
      } catch {
        setAnalyticsState("error");
      }
    },
    [range, rangeReady],
  );

  useEffect(() => {
    void loadSummary(false);
    void loadFixedTables(false);
  }, [loadSummary, loadFixedTables]);

  useEffect(() => {
    void loadAnalytics(false);
  }, [loadAnalytics]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.allSettled([
      loadSummary(true),
      loadFixedTables(true),
      loadAnalytics(true),
    ]);
    setRefreshing(false);
  }

  const currency = summary?.currency ?? "SAR";

  const kpis = summary
    ? [
        { title: "مبيعات اليوم", value: formatMoney(summary.revenueToday, currency), icon: Wallet },
        { title: "مبيعات هذا الشهر", value: formatMoney(summary.revenueThisMonth, currency), icon: CalendarRange },
        { title: "طلبات اليوم", value: summary.ordersToday, icon: ShoppingCart },
        { title: "طلبات هذا الشهر", value: summary.ordersThisMonth, icon: CalendarClock },
        { title: "متوسط قيمة الطلب", value: formatMoney(summary.averageOrderValue, currency), icon: Receipt },
        { title: "عدد العملاء", value: summary.customersCount, icon: Users },
        { title: "عملاء جدد هذا الشهر", value: summary.newCustomersThisMonth, icon: UserPlus },
        { title: "عدد المنتجات", value: summary.productsCount, icon: Package },
        { title: "منتجات منخفضة المخزون", value: summary.lowStockCount, icon: AlertTriangle },
      ]
    : [];

  const revenueBars: BarDatum[] = (sales?.points ?? []).map((p) => ({
    label: shortDay(p.day),
    value: Number(p.revenue),
    tooltip: `${p.day}: ${formatMoney(p.revenue, currency)}`,
  }));
  const ordersBars: BarDatum[] = (ordersChart?.points ?? []).map((p) => ({
    label: shortDay(p.day),
    value: p.orders,
    tooltip: `${p.day}: ${p.orders} طلب`,
  }));

  const recentColumns: Column<RecentOrder>[] = [
    {
      key: "orderNumber",
      header: "رقم الطلب",
      cell: (row) => (
        <span dir="ltr" className="font-medium">
          {row.orderNumber || (row.wpOrderId ? `#${row.wpOrderId}` : "—")}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "العميل",
      cell: (row) => row.customerName || "زائر",
    },
    {
      key: "status",
      header: "الحالة",
      cell: (row) => {
        const meta = resolveOrderStatus(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      key: "total",
      header: "الإجمالي",
      cell: (row) => <span dir="ltr">{formatMoney(row.total, row.currency)}</span>,
    },
    {
      key: "orderDate",
      header: "التاريخ",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(row.orderDate)}
        </span>
      ),
    },
  ];

  const topColumns: Column<TopProduct>[] = [
    {
      key: "name",
      header: "المنتج",
      cell: (row) => <span className="font-medium">{row.name || "—"}</span>,
    },
    {
      key: "quantity",
      header: "الكمية",
      cell: (row) => <span>{row.quantity}</span>,
    },
    {
      key: "revenue",
      header: "الإيراد",
      cell: (row) => <span dir="ltr">{formatMoney(row.revenue, currency)}</span>,
    },
  ];

  const lowStockColumns: Column<LowStockProduct>[] = [
    {
      key: "name",
      header: "المنتج",
      cell: (row) => <span className="font-medium">{row.name || "—"}</span>,
    },
    {
      key: "stockQuantity",
      header: "المخزون",
      cell: (row) => (
        <span className={cn(row.stockQuantity === 0 && "text-destructive")}>
          {row.stockQuantity}
        </span>
      ),
    },
    {
      key: "price",
      header: "السعر",
      cell: (row) => <span dir="ltr">{formatMoney(row.price, currency)}</span>,
    },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على أداء متجرك: المبيعات والطلبات والعملاء والمخزون."
        actions={
          <Button variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            تحديث
          </Button>
        }
      />

      {/* KPI cards */}
      {summaryState === "loading" ? (
        <LoadingState variant="skeleton" rows={3} />
      ) : summaryState === "error" || !summary ? (
        <ErrorState
          description="تعذّر تحميل المؤشرات. يرجى المحاولة مرة أخرى."
          onRetry={() => void loadSummary(false)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {kpis.map((kpi) => (
            <StatsCard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} />
          ))}
        </div>
      )}

      {/* Analytics section with the date range filter */}
      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">التحليلات</h2>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {!rangeReady ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            اختر تاريخ البداية والنهاية لعرض التحليلات.
          </CardContent>
        </Card>
      ) : analyticsState === "loading" ? (
        <LoadingState />
      ) : analyticsState === "error" ? (
        <ErrorState
          description="تعذّر تحميل التحليلات. يرجى المحاولة مرة أخرى."
          onRetry={() => void loadAnalytics(false)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>المبيعات عبر الزمن</CardTitle>
              <span dir="ltr" className="text-sm text-muted-foreground">
                {formatMoney(sales?.total ?? "0", currency)}
              </span>
            </CardHeader>
            <CardContent>
              <BarChart data={revenueBars} barClassName="bg-primary/70 group-hover:bg-primary" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>توزيع حالات الطلبات</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusDistribution data={ordersChart?.statusDistribution ?? []} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>الطلبات عبر الزمن</CardTitle>
              <span className="text-sm text-muted-foreground">
                {ordersChart?.total ?? 0} طلب
              </span>
            </CardHeader>
            <CardContent>
              <BarChart data={ordersBars} barClassName="bg-emerald-500/70 group-hover:bg-emerald-500" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>أفضل المنتجات</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                columns={topColumns}
                data={topProducts}
                rowKey={(row) => row.productId ?? row.name}
                emptyTitle="لا توجد مبيعات"
                emptyDescription="لا توجد منتجات مُباعة في هذه الفترة."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tables: recent orders + low stock */}
      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>آخر الطلبات</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              columns={recentColumns}
              data={recentOrders}
              rowKey={(row) => row.id}
              isLoading={recentState === "loading"}
              isError={recentState === "error"}
              onRetry={() => void loadFixedTables(false)}
              emptyTitle="لا توجد طلبات"
              emptyDescription="ستظهر أحدث الطلبات هنا بعد المزامنة."
              onRowClick={(row) => navigate(`/orders/${row.id}`)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>منتجات منخفضة المخزون</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              columns={lowStockColumns}
              data={lowStock}
              rowKey={(row) => row.id}
              isLoading={lowStockState === "loading"}
              isError={lowStockState === "error"}
              onRetry={() => void loadFixedTables(false)}
              emptyTitle="المخزون بحالة جيدة"
              emptyDescription="لا توجد منتجات منخفضة المخزون حاليًا."
              onRowClick={(row) => navigate(`/products/${row.id}`)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
