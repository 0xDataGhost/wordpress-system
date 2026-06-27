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
import {
  updateAssignmentStatus,
  type Assignment,
  type AssignmentStatusTarget,
} from "@/lib/digital-delivery-api";

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const STATUS_LABELS: Record<AssignmentStatusTarget, string> = {
  cancelled: "إلغاء التعيين",
  refunded: "استرجاع",
  failed: "تعليم كفاشل",
};

interface AssignmentStatusDialogProps {
  assignment: Assignment | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * Manually transitions an assignment to a destructive support status. The backend
 * enforces the golden rule (a delivered code is locked as refunded, never returned
 * to stock). A reason is always required.
 */
export function AssignmentStatusDialog({
  assignment,
  onOpenChange,
  onDone,
}: AssignmentStatusDialogProps) {
  const open = assignment !== null;
  const [status, setStatus] = useState<AssignmentStatusTarget>("cancelled");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus("cancelled");
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, assignment?.id]);

  async function handleSubmit() {
    if (!assignment) return;
    if (reason.trim().length < 3) {
      setError("السبب مطلوب (٣ أحرف على الأقل).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateAssignmentStatus(assignment.id, {
        status,
        reason: reason.trim(),
      });
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر تحديث الحالة.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تغيير حالة التعيين</DialogTitle>
          <DialogDescription>
            معاينة الكود:{" "}
            <span dir="ltr" className="font-mono">
              {assignment?.codePreview ?? "—"}
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
          <Label htmlFor="assignment-status">الحالة الجديدة</Label>
          <select
            id="assignment-status"
            className={inputClass}
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as AssignmentStatusTarget)
            }
          >
            {(Object.keys(STATUS_LABELS) as AssignmentStatusTarget[]).map(
              (value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ),
            )}
          </select>
          <p className="text-xs text-muted-foreground">
            الكود المُسلَّم لا يعود إلى المخزون أبداً؛ يُقفَل كمُسترجع.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignment-status-reason">السبب</Label>
          <Textarea
            id="assignment-status-reason"
            rows={3}
            placeholder="مثال: استرجاع الطلب من العميل"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "جارٍ الحفظ…" : "تأكيد"}
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
