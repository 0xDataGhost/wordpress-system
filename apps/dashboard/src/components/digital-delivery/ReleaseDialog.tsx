import { useEffect, useState } from "react";
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
import { releaseOrder, type ReleaseInput } from "@/lib/digital-delivery-api";

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const MODE_LABELS: Record<ReleaseInput["mode"], string> = {
  cancel: "إلغاء الطلب",
  refund: "استرجاع الطلب",
  manual_release: "تحرير يدوي",
};

interface ReleaseDialogProps {
  open: boolean;
  orderId: string;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * Order-level release of digital codes (cancel / refund / manual). The backend
 * guarantees delivered codes are never returned to stock — only undelivered codes
 * go back to `available`. A reason is always required.
 */
export function ReleaseDialog({
  open,
  orderId,
  onOpenChange,
  onDone,
}: ReleaseDialogProps) {
  const [mode, setMode] = useState<ReleaseInput["mode"]>("cancel");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode("cancel");
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (reason.trim().length < 3) {
      setError("السبب مطلوب (٣ أحرف على الأقل).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await releaseOrder(orderId, { mode, reason: reason.trim() });
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحرير الأكواد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تحرير أكواد الطلب</DialogTitle>
          <DialogDescription>
            الأكواد المُسلَّمة لا تعود إلى المخزون؛ تُعاد فقط الأكواد غير
            المُسلَّمة.
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

        <div className="space-y-2">
          <Label htmlFor="release-mode">نوع الإجراء</Label>
          <select
            id="release-mode"
            className={inputClass}
            value={mode}
            onChange={(e) => setMode(e.target.value as ReleaseInput["mode"])}
          >
            {(Object.keys(MODE_LABELS) as ReleaseInput["mode"][]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="release-reason">السبب</Label>
          <Textarea
            id="release-reason"
            rows={3}
            placeholder="مثال: ألغى العميل الطلب"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleSubmit()}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "جارٍ التنفيذ…" : "تأكيد"}
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
