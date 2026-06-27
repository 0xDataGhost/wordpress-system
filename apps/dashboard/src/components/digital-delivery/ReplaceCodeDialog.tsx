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
import { Switch } from "@/components/ui/switch";
import { replaceAssignment, type Assignment } from "@/lib/digital-delivery-api";
import { listCodes, type CodeListItem } from "@/lib/digital-inventory-api";

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface ReplaceCodeDialogProps {
  assignment: Assignment | null;
  /** When the caller can also list inventory, the replacement picker is enabled. */
  canPickCode: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * Replaces an assignment's code with a new one. The replacement is auto-picked
 * (FIFO) by the backend unless the operator chooses a specific available code.
 * `resendNow` re-delivers the replacement immediately via the safe channel.
 */
export function ReplaceCodeDialog({
  assignment,
  canPickCode,
  onOpenChange,
  onDone,
}: ReplaceCodeDialogProps) {
  const open = assignment !== null;
  const [reason, setReason] = useState("");
  const [replacementCodeId, setReplacementCodeId] = useState("");
  const [resendNow, setResendNow] = useState(false);
  const [available, setAvailable] = useState<CodeListItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAvailable = useCallback(async (productId: string) => {
    try {
      const result = await listCodes({
        productId,
        status: "available",
        limit: 50,
      });
      setAvailable(result.items);
    } catch {
      // Picker stays empty → auto-pick path; not fatal.
      setAvailable([]);
    }
  }, []);

  useEffect(() => {
    if (open && assignment) {
      setReason("");
      setReplacementCodeId("");
      setResendNow(false);
      setError(null);
      setSubmitting(false);
      setAvailable([]);
      if (canPickCode) void loadAvailable(assignment.productId);
    }
  }, [open, assignment, canPickCode, loadAvailable]);

  async function handleSubmit() {
    if (!assignment) return;
    if (reason.trim().length < 3) {
      setError("السبب مطلوب (٣ أحرف على الأقل).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await replaceAssignment(assignment.id, {
        reason: reason.trim(),
        replacementCodeId: replacementCodeId || undefined,
        resendNow,
      });
      onDone();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر استبدال الكود.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>استبدال الكود</DialogTitle>
          <DialogDescription>
            الكود الحالي:{" "}
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
          <Label htmlFor="replace-reason">سبب الاستبدال</Label>
          <Textarea
            id="replace-reason"
            rows={3}
            placeholder="مثال: أبلغ العميل أن الكود مستخدَم مسبقاً"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {canPickCode ? (
          <div className="space-y-2">
            <Label htmlFor="replace-code">اختيار كود بديل (اختياري)</Label>
            <select
              id="replace-code"
              className={inputClass}
              value={replacementCodeId}
              onChange={(e) => setReplacementCodeId(e.target.value)}
            >
              <option value="">اختيار تلقائي (الأقدم أولاً)</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codePreview ?? c.id}
                </option>
              ))}
            </select>
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                لا توجد أكواد متاحة لهذا المنتج لعرضها — سيحاول النظام الاختيار
                التلقائي.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
          <Label htmlFor="resend-now" className="cursor-pointer">
            إرسال البديل للعميل الآن
          </Label>
          <Switch
            id="resend-now"
            checked={resendNow}
            onCheckedChange={setResendNow}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || reason.trim().length < 3}
          >
            {submitting ? "جارٍ الاستبدال…" : "استبدال"}
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
