import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  linkSupplierProduct,
  updateSupplierProduct,
  type SupplierProduct,
} from "@/lib/suppliers-api";
import { listProducts, type ProductDto } from "@/lib/products-api";

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface SupplierProductDialogProps {
  open: boolean;
  supplierId: string;
  /** Null = link a new product; a mapping = edit it. */
  mapping?: SupplierProduct | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const toNum = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function SupplierProductDialog({
  open,
  supplierId,
  mapping,
  onOpenChange,
  onSaved,
}: SupplierProductDialogProps) {
  const isEdit = Boolean(mapping);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [productId, setProductId] = useState("");
  const [supplierSku, setSupplierSku] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [currency, setCurrency] = useState("");
  const [minOrderQuantity, setMinOrderQuantity] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      const result = await listProducts({ limit: 100 });
      setProducts(result.items);
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setProductId(mapping?.productId ?? "");
    setSupplierSku(mapping?.supplierSku ?? "");
    setCostPrice(mapping?.costPrice ?? "");
    setCurrency(mapping?.currency ?? "");
    setMinOrderQuantity(
      mapping?.minOrderQuantity != null ? String(mapping.minOrderQuantity) : "",
    );
    setLeadTimeDays(
      mapping?.leadTimeDays != null ? String(mapping.leadTimeDays) : "",
    );
    setNotes(mapping?.notes ?? "");
    if (!mapping) void loadProducts();
  }, [open, mapping, loadProducts]);

  async function handleSubmit() {
    if (!isEdit && !productId) {
      setError("اختر المنتج.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const common = {
      supplierSku: supplierSku.trim() === "" ? null : supplierSku.trim(),
      costPrice: toNum(costPrice),
      currency: currency.trim() === "" ? null : currency.trim(),
      minOrderQuantity: toNum(minOrderQuantity),
      leadTimeDays: toNum(leadTimeDays),
      notes: notes.trim() === "" ? null : notes.trim(),
    };
    try {
      if (mapping) {
        await updateSupplierProduct(supplierId, mapping.id, common);
      } else {
        await linkSupplierProduct(supplierId, { productId, ...common });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ الربط.");
    } finally {
      setSubmitting(false);
    }
  }

  const productName = isEdit
    ? (products.find((p) => p.id === mapping?.productId)?.name ??
      mapping?.productId)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل ربط المنتج" : "ربط منتج"}</DialogTitle>
          <DialogDescription>
            ربط منتج بهذا المورد لتتبّع التكلفة ومعلومات التوريد.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sp-product">المنتج</Label>
            {isEdit ? (
              <Input id="sp-product" value={productName ?? ""} disabled />
            ) : (
              <select
                id="sp-product"
                className={inputClass}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">اختر منتجاً</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-sku">رمز المورد (SKU)</Label>
            <Input
              id="sp-sku"
              dir="ltr"
              value={supplierSku}
              onChange={(e) => setSupplierSku(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-cost">تكلفة الوحدة</Label>
            <Input
              id="sp-cost"
              dir="ltr"
              inputMode="decimal"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-currency">العملة</Label>
            <Input
              id="sp-currency"
              dir="ltr"
              placeholder="USD"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-moq">أقل كمية طلب</Label>
            <Input
              id="sp-moq"
              dir="ltr"
              inputMode="numeric"
              value={minOrderQuantity}
              onChange={(e) => setMinOrderQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-lead">مدة التوريد (أيام)</Label>
            <Input
              id="sp-lead"
              dir="ltr"
              inputMode="numeric"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sp-notes">ملاحظات</Label>
            <Input
              id="sp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || (!isEdit && !productId)}
          >
            {submitting ? "جارٍ الحفظ…" : isEdit ? "حفظ" : "ربط"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
