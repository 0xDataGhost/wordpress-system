import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CheckCircle2,
  Clock,
  KeyRound,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  TrendingUp,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { StatsCard } from "@/components/shared/StatsCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import { listProducts, type ProductDto } from "@/lib/products-api";
import {
  getDelivery,
  getInventory,
  getProfit,
  getStock,
  getSummary,
  getSuppliers,
  resolveDeliveryChannel,
  resolveStockStatus,
  type DeliveryReport,
  type DigitalSummary,
  type InventoryReportRow,
  type ProfitReport,
  type ReportFilters,
  type StockHealth,
  type SupplierPerformanceRow,
} from "@/lib/digital-reports-api";

const filterControlClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-44";

type TabKey =
  | "summary"
  | "inventory"
  | "profit"
  | "suppliers"
  | "delivery"
  | "stock";

const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "ملخص" },
  { key: "inventory", label: "المخزون" },
  { key: "profit", label: "المبيعات والربح" },
  { key: "suppliers", label: "الموردين" },
  { key: "delivery", label: "التسليم" },
  { key: "stock", label: "منخفض المخزون" },
];

/** Renders a number|null percentage, e.g. 42.5 → "42.5%", null → "—". */
function percent(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/** Renders a 0..1 rate as a percentage, e.g. 0.04 → "4%". */
function rateToPercent(value: number): string {
  return `${Math.round(value * 10000) / 100}%`;
}

/** Renders an optional money string with a currency, or a dash. */
function moneyOrDash(value: string | null, currency: string): string {
  return value === null ? "—" : formatMoney(value, currency);
}

export function DigitalReportsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("digital_reports.view");

  const [tab, setTab] = useState<TabKey>("summary");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productId, setProductId] = useState("all");
  const [products, setProducts] = useState<ProductDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [summary, setSummary] = useState<DigitalSummary | null>(null);
  const [inventory, setInventory] = useState<InventoryReportRow[]>([]);
  const [profit, setProfit] = useState<ProfitReport | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierPerformanceRow[]>([]);
  const [delivery, setDelivery] = useState<DeliveryReport | null>(null);
  const [stock, setStock] = useState<StockHealth | null>(null);

  // Product dropdown options (best-effort, loaded once).
  useEffect(() => {
    if (!canView) return;
    listProducts({ limit: 100 })
      .then((res) => setProducts(res.items))
      .catch(() => setProducts([]));
  }, [canView]);

  const filters: ReportFilters = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    productId: productId === "all" ? undefined : productId,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      switch (tab) {
        case "summary":
          setSummary(await getSummary(filters));
          break;
        case "inventory":
          setInventory((await getInventory(filters)).items);
          break;
        case "profit":
          setProfit(await getProfit(filters));
          break;
        case "suppliers":
          setSuppliers((await getSuppliers(filters)).items);
          break;
        case "delivery":
          setDelivery(await getDelivery(filters));
          break;
        case "stock":
          setStock(await getStock(filters));
          break;
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dateFrom, dateTo, productId]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void load();
  }, [canView, load]);

  if (!canView) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="تقارير الأكواد"
          description="تحليلات المخزون الرقمي والأرباح."
        />
        <EmptyState
          icon={ShieldAlert}
          title="لا تملك صلاحية الوصول"
          description="تحتاج صلاحية «عرض تقارير الأكواد» للاطّلاع على هذه الصفحة."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="تقارير الأكواد"
        description="تابع صحة المخزون الرقمي والأرباح وأداء الموردين والتسليم."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            تحديث
          </Button>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <FilterBar>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          من
          <input
            type="date"
            aria-label="من تاريخ"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={filterControlClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          إلى
          <input
            type="date"
            aria-label="إلى تاريخ"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={filterControlClass}
          />
        </label>
        <select
          aria-label="تصفية حسب المنتج"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className={filterControlClass}
        >
          <option value="all">كل المنتجات</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </FilterBar>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState onRetry={() => void load()} />
      ) : (
        <div className="animate-fade-in">
          {tab === "summary" && <SummaryTab data={summary} />}
          {tab === "inventory" && <InventoryTab rows={inventory} />}
          {tab === "profit" && <ProfitTab data={profit} />}
          {tab === "suppliers" && <SuppliersTab rows={suppliers} />}
          {tab === "delivery" && <DeliveryTab data={delivery} />}
          {tab === "stock" && <StockTab data={stock} />}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Summary ------------------------------- */

function SummaryTab({ data }: { data: DigitalSummary | null }) {
  if (!data) return null;
  const c = data.currency;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="الإيراد" value={formatMoney(data.revenue, c)} icon={Wallet} />
        <StatsCard
          title="تكلفة الشراء"
          value={moneyOrDash(data.purchaseCost, c)}
          icon={ShoppingCart}
        />
        <StatsCard
          title="الربح الإجمالي"
          value={moneyOrDash(data.grossProfit, c)}
          icon={TrendingUp}
        />
        <StatsCard
          title="نسبة الربح"
          value={percent(data.profitPercent)}
          icon={BarChart3}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatsCard title="المنتجات الرقمية" value={data.totalDigitalProducts} icon={KeyRound} />
        <StatsCard title="الأكواد المتاحة" value={data.availableCodes} icon={Boxes} />
        <StatsCard title="الأكواد المباعة" value={data.soldCodes} icon={ShoppingCart} />
        <StatsCard title="الأكواد المسلمة" value={data.deliveredCodes} icon={PackageCheck} />
        <StatsCard title="الطلبات الرقمية" value={data.digitalOrders} icon={ShoppingCart} />
        <StatsCard title="الطلبات المسلمة" value={data.deliveredOrders} icon={CheckCircle2} />
        <StatsCard title="منتجات منخفضة المخزون" value={data.lowStockProducts} icon={AlertTriangle} />
        <StatsCard title="حالات تسليم فاشلة" value={data.failedDeliveries} icon={XCircle} />
        <StatsCard title="معدل الاستبدال" value={rateToPercent(data.replacementRate)} icon={RefreshCw} />
      </div>
    </div>
  );
}

/* -------------------------------- Inventory ------------------------------ */

function InventoryTab({ rows }: { rows: InventoryReportRow[] }) {
  const columns: Column<InventoryReportRow>[] = [
    {
      key: "productName",
      header: "المنتج",
      cell: (r) => <span className="font-medium">{r.productName ?? "—"}</span>,
    },
    { key: "available", header: "المتاح", cell: (r) => r.available },
    { key: "reserved", header: "المحجوز", cell: (r) => r.reserved },
    { key: "sold", header: "المباع", cell: (r) => r.sold },
    { key: "delivered", header: "المسلم", cell: (r) => r.delivered },
    { key: "invalid", header: "غير صالح", cell: (r) => r.invalid },
    { key: "voided", header: "ملغى", cell: (r) => r.voided },
    {
      key: "stockStatus",
      header: "الحالة",
      cell: (r) => {
        const s = resolveStockStatus(r.stockStatus);
        return <StatusBadge label={s.label} tone={s.tone} />;
      },
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.productId}
      emptyTitle="لا توجد منتجات رقمية"
      emptyDescription="فعّل التسليم الرقمي على منتج واستورد أكواداً لعرض المخزون هنا."
    />
  );
}

/* --------------------------------- Profit -------------------------------- */

function ProfitTab({ data }: { data: ProfitReport | null }) {
  if (!data) return null;
  const c = data.currency;
  const t = data.totals;
  const columns: Column<ProfitReport["items"][number]>[] = [
    {
      key: "productName",
      header: "المنتج",
      cell: (r) => <span className="font-medium">{r.productName ?? "—"}</span>,
    },
    { key: "unitsSold", header: "المباع", cell: (r) => r.unitsSold },
    { key: "revenue", header: "الإيراد", cell: (r) => formatMoney(r.revenue, c) },
    {
      key: "purchaseCost",
      header: "التكلفة",
      cell: (r) => moneyOrDash(r.purchaseCost, c),
    },
    {
      key: "grossProfit",
      header: "الربح",
      cell: (r) => moneyOrDash(r.grossProfit, c),
    },
    { key: "grossMargin", header: "الهامش", cell: (r) => percent(r.grossMargin) },
    {
      key: "averageCost",
      header: "متوسط التكلفة",
      cell: (r) => moneyOrDash(r.averageCost, c),
    },
    {
      key: "averageSellingPrice",
      header: "متوسط سعر البيع",
      cell: (r) => formatMoney(r.averageSellingPrice, c),
    },
    { key: "refundCount", header: "المرتجعات", cell: (r) => r.refundCount },
    { key: "replacementCount", header: "الاستبدالات", cell: (r) => r.replacementCount },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="إجمالي الإيراد" value={formatMoney(t.revenue, c)} icon={Wallet} />
        <StatsCard title="إجمالي التكلفة" value={moneyOrDash(t.purchaseCost, c)} icon={ShoppingCart} />
        <StatsCard title="إجمالي الربح" value={moneyOrDash(t.grossProfit, c)} icon={TrendingUp} />
        <StatsCard title="الهامش الإجمالي" value={percent(t.grossMargin)} icon={BarChart3} />
      </div>
      <DataTable
        columns={columns}
        data={data.items}
        rowKey={(r) => r.productId}
        emptyTitle="لا توجد مبيعات رقمية"
        emptyDescription="لم تُسجَّل مبيعات رقمية ضمن النطاق المحدد."
      />
    </div>
  );
}

/* ---------------------------- Supplier performance ----------------------- */

function SuppliersTab({ rows }: { rows: SupplierPerformanceRow[] }) {
  const columns: Column<SupplierPerformanceRow>[] = [
    {
      key: "supplierName",
      header: "المورد",
      cell: (r) => <span className="font-medium">{r.supplierName}</span>,
    },
    { key: "codesImported", header: "المستورد", cell: (r) => r.codesImported },
    { key: "codesSold", header: "المباع", cell: (r) => r.codesSold },
    { key: "codesInvalid", header: "غير صالح", cell: (r) => r.codesInvalid },
    {
      key: "invalidRate",
      header: "نسبة التلف",
      cell: (r) => rateToPercent(r.invalidRate),
    },
    { key: "replacementCount", header: "الاستبدالات", cell: (r) => r.replacementCount },
    {
      key: "estimatedCost",
      header: "التكلفة التقديرية",
      cell: (r) => moneyOrDash(r.estimatedCost, r.currency ?? "SAR"),
    },
    {
      key: "estimatedProfit",
      header: "الربح التقديري",
      cell: (r) => moneyOrDash(r.estimatedProfit, r.currency ?? "SAR"),
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.supplierId}
      emptyTitle="لا يوجد موردون"
      emptyDescription="اربط دفعات الأكواد بموردين لعرض أدائهم هنا."
    />
  );
}

/* -------------------------------- Delivery ------------------------------- */

function DeliveryTab({ data }: { data: DeliveryReport | null }) {
  if (!data) return null;
  const avgTime =
    data.averageDeliverySeconds === null
      ? "—"
      : `${Math.round(data.averageDeliverySeconds / 60)} دقيقة`;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatsCard title="إجمالي عمليات التسليم" value={data.totalDeliveries} icon={Truck} />
        <StatsCard title="مكتمل" value={data.completed} icon={CheckCircle2} />
        <StatsCard title="قيد الانتظار" value={data.pending} icon={Clock} />
        <StatsCard title="فشل" value={data.failed} icon={XCircle} />
        <StatsCard title="مراجعة يدوية" value={data.manualReview} icon={AlertTriangle} />
        <StatsCard title="تسليم يدوي" value={data.manualDeliveries} icon={PackageCheck} />
        <StatsCard title="إعادة المحاولات" value={data.retries} icon={RefreshCw} />
        <StatsCard title="متوسط زمن التسليم" value={avgTime} icon={Clock} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          حالات الفشل حسب القناة
        </h3>
        {data.failedByChannel.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="لا توجد حالات فشل"
            description="لم تُسجَّل أي عمليات تسليم فاشلة ضمن النطاق."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.failedByChannel.map((row) => (
              <StatsCard
                key={row.channel}
                title={resolveDeliveryChannel(row.channel)}
                value={row.count}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Stock health ---------------------------- */

function StockTab({ data }: { data: StockHealth | null }) {
  if (!data) return null;
  const columns: Column<StockHealth["products"][number]>[] = [
    {
      key: "productName",
      header: "المنتج",
      cell: (r) => <span className="font-medium">{r.productName ?? "—"}</span>,
    },
    { key: "available", header: "المتاح", cell: (r) => r.available },
    {
      key: "lowStockThreshold",
      header: "حد التنبيه",
      cell: (r) => r.lowStockThreshold,
    },
    {
      key: "stockStatus",
      header: "الحالة",
      cell: (r) => {
        const s = resolveStockStatus(r.stockStatus);
        return <StatusBadge label={s.label} tone={s.tone} />;
      },
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard title="نفد المخزون" value={data.outOfStockCount} icon={XCircle} />
        <StatsCard title="منخفض المخزون" value={data.lowStockCount} icon={AlertTriangle} />
        <StatsCard title="تحت الحد" value={data.belowThresholdCount} icon={Boxes} />
        <StatsCard
          title={`أكواد تنتهي خلال ${data.expiringWithinDays} يوماً`}
          value={data.expiringCodesCount}
          icon={Clock}
        />
      </div>
      <DataTable
        columns={columns}
        data={data.products}
        rowKey={(r) => r.productId}
        emptyTitle="لا توجد منتجات رقمية"
        emptyDescription="فعّل التسليم الرقمي على منتج لعرض صحة المخزون هنا."
      />
      {data.expiringProducts.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            أكواد قاربت على الانتهاء
          </h3>
          <DataTable
            columns={[
              {
                key: "productName",
                header: "المنتج",
                cell: (r: StockHealth["expiringProducts"][number]) => (
                  <span className="font-medium">{r.productName ?? "—"}</span>
                ),
              },
              {
                key: "count",
                header: "عدد الأكواد",
                cell: (r: StockHealth["expiringProducts"][number]) => r.count,
              },
              {
                key: "earliestExpiry",
                header: "أقرب انتهاء",
                cell: (r: StockHealth["expiringProducts"][number]) =>
                  formatDateTime(r.earliestExpiry),
              },
            ]}
            data={data.expiringProducts}
            rowKey={(r) => r.productId}
            emptyTitle="لا يوجد"
          />
        </div>
      ) : null}
    </div>
  );
}
