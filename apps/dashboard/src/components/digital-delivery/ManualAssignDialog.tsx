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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { manualAssign } from "@/lib/digital-delivery-api";
import { listCodes, type CodeListItem } from "@/lib/digital-inventory-api";

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export interface ManualAssignItem {
  id: string;
  productId: string;
  name: string;
}

interface ManualAssignDialogProps {
  open: boolean;
  orderId: string;
  /** Order line items that have a linked product (manual assign targets). */
  items: ManualAssignItem[];
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * Hand-picks a specific available code for an order line item (plan2 §19). The
 * backend enforces that the code is available and belongs to the chosen product's
 * pool. A reason is always required.
 */
export function ManualAssignDialog({
  open,
  orderId,
  items,
  onOpenChange,
  onDone,
}: ManualAssignDialogProps) {
  const [orderItemId, setOrderItemId] = useState("");
  const [codeId, setCodeId] = useState("");
  const [reason, setReason] = useState("");
  const [available, setAvailable] = useState<CodeListItem[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === orderItemId);

  const loadCodes = useCallback(async (productId: string) => {
    setLoadingCodes(true);
    try {
      const result = await listCodes({
        productId,
        status: "available",
        limit: 50,
      });
      setAvailable(result.items);
    } catch {
      setAvailable([]);
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      const first = items[0]?.id ?? "";
      setOrderItemId(first);
      setCodeId("");
      setReason("");
      setError(null);
      setSubmitting(false);
      setAvailable([]);
    }
  }, [open, items]);

  useEffect(() => {
    if (open && selectedItem) {
      setCodeId("");
      void loadCodes(selectedItem.productId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderItemId]);

  async function handleSubmit() {
    if (!orderItemId || !codeId) {
      setError("اختر عنصر الطلب والكود.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("السبب مطلوب (٣ أحرف على الأقل).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await manualAssign(orderId, {
        orderItemId,
        codeId,
        reason: reason.trim(),
      });
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تعيين الكود.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعيين كود يدوي</DialogTitle>
          <DialogDescription>
            اختر عنصر الطلب ثم كوداً متاحاً من مخزون المنتج لتعيينه يدوياً.
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

        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            لا توجد عناصر طلب مرتبطة بمنتجات لتعيينها.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="manual-item">عنصر الطلب</Label>
              <select
                id="manual-item"
                className={inputClass}
                value={orderItemId}
                onChange={(e) => setOrderItemId(e.target.value)}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-code">الكود المتاح</Label>
              <select
                id="manual-code"
                className={inputClass}
                value={codeId}
                onChange={(e) => setCodeId(e.target.value)}
                disabled={loadingCodes || available.length === 0}
              >
                <option value="">
                  {loadingCodes
                    ? "جارٍ التحميل…"
                    : available.length === 0
                      ? "لا توجد أكواد متاحة"
                      : "اختر كوداً"}
                </option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codePreview ?? c.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-reason">السبب</Label>
              <Textarea
                id="manual-reason"
                rows={3}
                placeholder="مثال: تعيين يدوي بعد مراجعة"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              submitting ||
              items.length === 0 ||
              !codeId ||
              reason.trim().length < 3
            }
          >
            {submitting ? "جارٍ التعيين…" : "تعيين الكود"}
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
