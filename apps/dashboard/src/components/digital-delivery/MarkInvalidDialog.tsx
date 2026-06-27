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
import { markCodeInvalid } from "@/lib/digital-inventory-api";

interface MarkInvalidTarget {
  codeId: string;
  codePreview: string | null;
}

interface MarkInvalidDialogProps {
  target: MarkInvalidTarget | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Flags a code as invalid (supplier reported it bad). Reason required + audited. */
export function MarkInvalidDialog({
  target,
  onOpenChange,
  onDone,
}: MarkInvalidDialogProps) {
  const open = target !== null;
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, target?.codeId]);

  async function handleSubmit() {
    if (!target) return;
    if (reason.trim().length < 3) {
      setError("السبب مطلوب (٣ أحرف على الأقل).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await markCodeInvalid(target.codeId, reason.trim());
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تعليم الكود.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعليم الكود كغير صالح</DialogTitle>
          <DialogDescription>
            معاينة الكود:{" "}
            <span dir="ltr" className="font-mono">
              {target?.codePreview ?? "—"}
            </span>
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
          <Label htmlFor="invalid-reason">السبب</Label>
          <Textarea
            id="invalid-reason"
            rows={3}
            placeholder="مثال: أبلغ المورد أن هذا الكود غير صالح"
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
            {submitting ? "جارٍ الحفظ…" : "تعليم كغير صالح"}
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
