import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Pencil, Plus, Archive, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatsCard } from "@/components/shared/StatsCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/components/auth/AuthProvider";
import { SupplierFormDialog } from "@/components/suppliers/SupplierFormDialog";
import { SupplierProductDialog } from "@/components/suppliers/SupplierProductDialog";
import { resolveSupplierStatus } from "@/components/suppliers/supplier-status";
import { resolveBatchStatus } from "@/components/digital-inventory/digital-code-status";
import {
  archiveSupplier,
  getSupplier,
  listSupplierBatches,
  listSupplierProducts,
  unlinkSupplierProduct,
  type SupplierProduct,
  type SupplierWithMetrics,
} from "@/lib/suppliers-api";
import { listProducts } from "@/lib/products-api";
import type { Batch } from "@/lib/digital-inventory-api";
import { formatDateTime, formatMoney } from "@/lib/utils";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

export function SupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canView = hasPermission("digital_suppliers.view");
  const canEdit = hasPermission("digital_suppliers.edit");
  const canDelete = hasPermission("digital_suppliers.delete");

  const [supplier, setSupplier] = useState<SupplierWithMetrics | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [productDialog, setProductDialog] = useState<{
    open: boolean;
    mapping: SupplierProduct | null;
  }>({ open: false, mapping: null });
  const [unlinkTarget, setUnlinkTarget] = useState<SupplierProduct | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const [sup, prods, batchList, catalog] = await Promise.all([
        getSupplier(id),
        listSupplierProducts(id),
        listSupplierBatches(id),
        listProducts({ limit: 100 }).catch(() => ({ items: [] })),
      ]);
      setSupplier(sup);
      setProducts(prods.items);
      setBatches(batchList.items);
      const names: Record<string, string> = {};
      for (const p of catalog.items) names[p.id] = p.name;
      setProductNames(names);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!canView) return;
    void load();
  }, [canView, load]);

  async function handleArchive() {
    if (!id) return;
    setArchiving(true);
    try {
      await archiveSupplier(id);
      setBanner("تمت أرشفة المورد.");
      setArchiveOpen(false);
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "تعذّرت الأرشفة.");
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnlink() {
    if (!id || !unlinkTarget) return;
    setUnlinking(true);
    try {
      await unlinkSupplierProduct(id, unlinkTarget.id);
      setUnlinkTarget(null);
      await load();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "تعذّر إلغاء الربط.");
    } finally {
      setUnlinking(false);
    }
  }

  if (!canView) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="المورد" description="تفاصيل المورد." />
        <EmptyState
          title="لا تملك صلاحية الوصول"
          description="تحتاج صلاحية «عرض الموردين» لرؤية هذه الصفحة."
        />
      </div>
    );
  }

  const productColumns: Column<SupplierProduct>[] = [
    {
      key: "product",
      header: "المنتج",
      cell: (row) => (
        <span className="font-medium">
          {productNames[row.productId] ?? row.productId.slice(0, 8)}
        </span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      cell: (row) =>
        row.supplierSku ? (
          <span dir="ltr" className="text-xs">
            {row.supplierSku}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "cost",
      header: "التكلفة",
      cell: (row) => (
        <span dir="ltr">
          {row.costPrice ? formatMoney(row.costPrice, row.currency ?? "USD") : "—"}
        </span>
      ),
    },
    {
      key: "moq",
      header: "أقل كمية",
      cell: (row) => <span>{row.minOrderQuantity ?? "—"}</span>,
    },
    {
      key: "lead",
      header: "مدة التوريد",
      cell: (row) =>
        row.leadTimeDays != null ? <span>{row.leadTimeDays} يوم</span> : "—",
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-24",
      cell: (row) =>
        canEdit ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="تعديل"
              onClick={() => setProductDialog({ open: true, mapping: row })}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="إلغاء الربط"
              onClick={() => setUnlinkTarget(row)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : null,
    },
  ];

  const batchColumns: Column<Batch>[] = [
    {
      key: "batchName",
      header: "اسم الدفعة",
      cell: (row) => <span className="font-medium">{row.batchName ?? "—"}</span>,
    },
    {
      key: "product",
      header: "المنتج",
      cell: (row) => <span>{row.productName ?? "—"}</span>,
    },
    {
      key: "total",
      header: "الإجمالي",
      cell: (row) => <span>{row.quantityTotal}</span>,
    },
    {
      key: "available",
      header: "المتاح",
      cell: (row) => <span>{row.quantityAvailable}</span>,
    },
    {
      key: "sold",
      header: "المباع",
      cell: (row) => <span>{row.quantitySold}</span>,
    },
    {
      key: "cost",
      header: "تكلفة الوحدة",
      cell: (row) => (
        <span dir="ltr">
          {row.costPerCode ? formatMoney(row.costPerCode, row.currency ?? "USD") : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "الحالة",
      cell: (row) => {
        const meta = resolveBatchStatus(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      key: "createdAt",
      header: "التاريخ",
      cell: (row) => (
        <span className="text-sm">{formatDateTime(row.createdAt)}</span>
      ),
    },
  ];

  const statusMeta = supplier ? resolveSupplierStatus(supplier.status) : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={supplier ? supplier.name : "المورد"}
        description="بيانات المورد والمنتجات المرتبطة ودفعات الأكواد وملخص الأداء."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/suppliers")}>
              <ArrowRight className="h-4 w-4" />
              رجوع للموردين
            </Button>
            {supplier && canEdit ? (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                تعديل
              </Button>
            ) : null}
            {supplier && canDelete && supplier.status !== "archived" ? (
              <Button variant="ghost" onClick={() => setArchiveOpen(true)}>
                <Archive className="h-4 w-4" />
                أرشفة
              </Button>
            ) : null}
          </div>
        }
      />

      {banner ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm"
        >
          {banner}
        </div>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : error || !supplier ? (
        <ErrorState
          description="تعذّر تحميل المورد."
          onRetry={() => void load()}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatsCard title="إجمالي الأكواد" value={supplier.metrics.totalCodes} />
            <StatsCard title="المتاح" value={supplier.metrics.available} />
            <StatsCard title="المباع" value={supplier.metrics.sold} />
            <StatsCard title="المسلَّم" value={supplier.metrics.delivered} />
            <StatsCard title="غير صالح" value={supplier.metrics.invalid} />
            <StatsCard
              title="التكلفة التقديرية"
              value={
                supplier.metrics.estimatedCost
                  ? formatMoney(
                      supplier.metrics.estimatedCost,
                      supplier.metrics.currency ?? "USD",
                    )
                  : "—"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                بيانات المورد
                {statusMeta ? (
                  <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DetailRow label="جهة التواصل">{supplier.contactName ?? "—"}</DetailRow>
              <DetailRow label="البريد الإلكتروني">
                {supplier.email ? <span dir="ltr">{supplier.email}</span> : "—"}
              </DetailRow>
              <DetailRow label="الهاتف">
                {supplier.phone ? <span dir="ltr">{supplier.phone}</span> : "—"}
              </DetailRow>
              <DetailRow label="الموقع">
                {supplier.website ? <span dir="ltr">{supplier.website}</span> : "—"}
              </DetailRow>
              <DetailRow label="الدولة">{supplier.country ?? "—"}</DetailRow>
              <DetailRow label="العملة">
                {supplier.currency ? <span dir="ltr">{supplier.currency}</span> : "—"}
              </DetailRow>
              <DetailRow label="نسبة الأكواد غير الصالحة">
                {(supplier.metrics.invalidRate * 100).toFixed(1)}%
              </DetailRow>
              {supplier.notes ? (
                <DetailRow label="ملاحظات">{supplier.notes}</DetailRow>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>المنتجات المرتبطة</CardTitle>
              {canEdit ? (
                <Button
                  size="sm"
                  onClick={() => setProductDialog({ open: true, mapping: null })}
                >
                  <Plus className="h-4 w-4" />
                  ربط منتج
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                columns={productColumns}
                data={products}
                rowKey={(row) => row.id}
                emptyTitle="لا توجد منتجات مرتبطة"
                emptyDescription="اربط منتجات هذا المورد لتتبّع التكلفة."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>دفعات الأكواد</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                columns={batchColumns}
                data={batches}
                rowKey={(row) => row.id}
                emptyTitle="لا توجد دفعات"
                emptyDescription="لم تُستورد أي دفعة أكواد من هذا المورد بعد."
              />
            </CardContent>
          </Card>
        </div>
      )}

      {supplier ? (
        <SupplierFormDialog
          open={editOpen}
          supplier={supplier}
          onOpenChange={setEditOpen}
          onSaved={() => void load()}
        />
      ) : null}
      {id ? (
        <SupplierProductDialog
          open={productDialog.open}
          supplierId={id}
          mapping={productDialog.mapping}
          onOpenChange={(open) =>
            setProductDialog((prev) => ({ ...prev, open }))
          }
          onSaved={() => void load()}
        />
      ) : null}
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="أرشفة المورد"
        description="سيتم تعطيل المورد. لا يمكن الأرشفة إذا كان لديه دفعات نشطة."
        confirmLabel="أرشفة"
        destructive
        loading={archiving}
        onConfirm={() => void handleArchive()}
      />
      <ConfirmDialog
        open={unlinkTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUnlinkTarget(null);
        }}
        title="إلغاء ربط المنتج"
        description="سيتم إزالة ربط هذا المنتج بالمورد."
        confirmLabel="إلغاء الربط"
        destructive
        loading={unlinking}
        onConfirm={() => void handleUnlink()}
      />
    </div>
  );
}
