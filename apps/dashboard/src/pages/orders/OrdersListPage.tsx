import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { SearchInput } from "@/components/shared/SearchInput";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  ORDER_STATUS_OPTIONS,
  resolveOrderStatus,
} from "@/components/orders/order-status";
import {
  listOrders,
  type OrderDto,
  type OrderPagination,
  type OrderStatus,
} from "@/lib/orders-api";
import { formatDateTime, formatMoney } from "@/lib/utils";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "كل الحالات" },
  ...ORDER_STATUS_OPTIONS,
];

/** Order date shown in the list: WooCommerce placed-at, falling back to created-at. */
function orderDate(order: OrderDto): string | null {
  return order.placedAt ?? order.createdAt;
}

/** Best display name for a buyer, falling back through email/phone to "guest". */
function customerLabel(order: OrderDto): string {
  const c = order.customer;
  if (!c) return "زائر";
  return c.name?.trim() || c.email || c.phone || "زائر";
}

export function OrdersListPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<OrderDto[]>([]);
  const [pagination, setPagination] = useState<OrderPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Debounce the search box so each keystroke does not fire a request.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await listOrders({
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Column<OrderDto>[] = [
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
      key: "customer",
      header: "العميل",
      cell: (row) => <span>{customerLabel(row)}</span>,
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
      cell: (row) => (
        <span dir="ltr">{formatMoney(row.total, row.currency)}</span>
      ),
    },
    {
      key: "paymentMethod",
      header: "طريقة الدفع",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.paymentMethod || "—"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "تاريخ الإنشاء",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(orderDate(row))}
        </span>
      ),
    },
  ];

  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="الطلبات"
        description="تابع طلبات متجرك من ووكومرس: ابحث، صفّ حسب الحالة والتاريخ، واطّلع على التفاصيل."
      />

      <FilterBar>
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="ابحث برقم الطلب أو اسم/بريد/هاتف العميل…"
          className="sm:max-w-xs"
        />
        <select
          aria-label="تصفية حسب الحالة"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as OrderStatus | "all");
            setPage(1);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-44"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="من تاريخ"
          dir="ltr"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-40"
        />
        <input
          type="date"
          aria-label="إلى تاريخ"
          dir="ltr"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-40"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={items}
        rowKey={(row) => row.id}
        isLoading={loading}
        isError={error}
        onRetry={() => void load()}
        emptyTitle="لا توجد طلبات"
        emptyDescription="لم يتم العثور على طلبات مطابقة. جرّب مزامنة المتجر أو تعديل عوامل التصفية."
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
      />

      {!loading && !error && total > 0 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            صفحة {page} من {totalPages} · {total} طلب
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              التالي
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
