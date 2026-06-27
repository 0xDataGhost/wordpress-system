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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { SUPPLIER_STATUS_OPTIONS } from "@/components/suppliers/supplier-status";
import {
  createSupplier,
  updateSupplier,
  type Supplier,
  type SupplierInput,
  type SupplierStatus,
} from "@/lib/suppliers-api";

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface SupplierFormDialogProps {
  open: boolean;
  /** Null/undefined = create; a supplier = edit. */
  supplier?: Supplier | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  currency: string;
  notes: string;
  status: SupplierStatus;
  isPreferred: boolean;
}

const EMPTY: FormState = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  country: "",
  currency: "",
  notes: "",
  status: "active",
  isPreferred: false,
};

export function SupplierFormDialog({
  open,
  supplier,
  onOpenChange,
  onSaved,
}: SupplierFormDialogProps) {
  const isEdit = Boolean(supplier);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
      setForm(
        supplier
          ? {
              name: supplier.name,
              contactName: supplier.contactName ?? "",
              email: supplier.email ?? "",
              phone: supplier.phone ?? "",
              website: supplier.website ?? "",
              country: supplier.country ?? "",
              currency: supplier.currency ?? "",
              notes: supplier.notes ?? "",
              status: (supplier.status as SupplierStatus) ?? "active",
              isPreferred: supplier.isPreferred,
            }
          : EMPTY,
      );
    }
  }, [open, supplier]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (form.name.trim().length < 2) {
      setError("اسم المورد مطلوب (حرفان على الأقل).");
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: SupplierInput = {
      name: form.name.trim(),
      contactName: form.contactName,
      email: form.email,
      phone: form.phone,
      website: form.website,
      country: form.country,
      currency: form.currency,
      notes: form.notes,
      status: form.status,
      isPreferred: form.isPreferred,
    };
    try {
      if (supplier) {
        await updateSupplier(supplier.id, body);
      } else {
        await createSupplier(body);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ المورد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل المورد" : "إضافة مورد"}</DialogTitle>
          <DialogDescription>
            بيانات المورد لتتبّع مصدر الأكواد والتكاليف.
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
            <Label htmlFor="sup-name">اسم المورد</Label>
            <Input
              id="sup-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-contact">جهة التواصل</Label>
            <Input
              id="sup-contact"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-email">البريد الإلكتروني</Label>
            <Input
              id="sup-email"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-phone">الهاتف</Label>
            <Input
              id="sup-phone"
              dir="ltr"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-website">الموقع الإلكتروني</Label>
            <Input
              id="sup-website"
              dir="ltr"
              placeholder="https://"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-country">الدولة</Label>
            <Input
              id="sup-country"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-currency">العملة</Label>
            <Input
              id="sup-currency"
              dir="ltr"
              placeholder="USD"
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sup-status">الحالة</Label>
            <select
              id="sup-status"
              className={inputClass}
              value={form.status}
              onChange={(e) => set("status", e.target.value as SupplierStatus)}
            >
              {SUPPLIER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sup-notes">ملاحظات</Label>
            <Textarea
              id="sup-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
            <Label htmlFor="sup-preferred" className="cursor-pointer">
              مورد مفضّل
            </Label>
            <Switch
              id="sup-preferred"
              checked={form.isPreferred}
              onCheckedChange={(v) => set("isPreferred", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || form.name.trim().length < 2}
          >
            {submitting ? "جارٍ الحفظ…" : isEdit ? "حفظ" : "إضافة"}
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
