import { useCallback, useEffect, useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ORDER_STATUS_OPTIONS } from "@/components/orders/order-status";
import {
  CODE_POOL_STRATEGY_OPTIONS,
  DELIVERY_MODE_OPTIONS,
  FULFILLMENT_TYPE_OPTIONS,
} from "@/components/products/digital-settings-options";
import {
  getDigitalSettings,
  updateDigitalSettings,
  type DigitalSettingsData,
  type DigitalSettingsDto,
  type UpdateDigitalSettingsInput,
} from "@/lib/digital-products-api";
import type { OrderStatus } from "@/lib/orders-api";
import { cn } from "@/lib/utils";

const ORDER_STATUS_VALUES = ORDER_STATUS_OPTIONS.map((o) => o.value) as [
  OrderStatus,
  ...OrderStatus[],
];

const statusArrayField = z.array(z.enum(ORDER_STATUS_VALUES));

const digitalFormSchema = z
  .object({
    is_enabled: z.boolean(),
    fulfillment_type: z.enum([
      "license_key",
      "subscription_code",
      "gift_card_code",
    ]),
    auto_delivery_enabled: z.boolean(),
    delivery_mode: z.enum(["automatic", "manual", "review_first"]),
    code_pool_strategy: z.enum(["fifo", "lifo", "earliest_expiry", "random"]),
    reserve_on_statuses: statusArrayField,
    deliver_on_statuses: statusArrayField,
    allow_manual_assignment: z.boolean(),
    allow_replacement: z.boolean(),
    low_stock_threshold: z.coerce
      .number({ invalid_type_error: "أدخل رقمًا صحيحًا" })
      .int("يجب أن يكون عددًا صحيحًا")
      .min(0, "لا يمكن أن يكون سالبًا")
      .max(1_000_000, "القيمة كبيرة جدًا"),
    max_codes_per_order_item: z.coerce
      .number({ invalid_type_error: "أدخل رقمًا صحيحًا" })
      .int("يجب أن يكون عددًا صحيحًا")
      .min(1, "يجب أن يكون 1 على الأقل")
      .max(500, "الحد الأقصى 500"),
    instructions_template: z.string().trim().max(5000, "النص طويل جدًا"),
  })
  .refine(
    (s) =>
      s.deliver_on_statuses.every((status) =>
        s.reserve_on_statuses.includes(status),
      ),
    {
      message: "حالات الإرسال يجب أن تكون ضمن حالات الحجز",
      path: ["deliver_on_statuses"],
    },
  );

type DigitalFormValues = z.infer<typeof digitalFormSchema>;

function toFormValues(dto: DigitalSettingsDto): DigitalFormValues {
  return {
    is_enabled: dto.is_enabled,
    fulfillment_type: dto.fulfillment_type,
    auto_delivery_enabled: dto.auto_delivery_enabled,
    delivery_mode: dto.delivery_mode,
    code_pool_strategy: dto.code_pool_strategy,
    reserve_on_statuses: dto.reserve_on_statuses,
    deliver_on_statuses: dto.deliver_on_statuses,
    allow_manual_assignment: dto.allow_manual_assignment,
    allow_replacement: dto.allow_replacement,
    low_stock_threshold: dto.low_stock_threshold,
    max_codes_per_order_item: dto.max_codes_per_order_item,
    instructions_template: dto.instructions_template ?? "",
  };
}

/** Normalizes parsed form values to the API settings shape (blank template → null). */
function toSettingsData(values: DigitalFormValues): DigitalSettingsData {
  return {
    ...values,
    instructions_template:
      values.instructions_template.trim() === ""
        ? null
        : values.instructions_template.trim(),
  };
}

const sameStatusSet = (a: OrderStatus[], b: OrderStatus[]): boolean =>
  a.length === b.length &&
  [...a].sort().join(",") === [...b].sort().join(",");

/**
 * Builds a minimal PATCH body containing only changed fields, so the backend
 * audit log records exactly what the user changed (not every field).
 */
function buildPatch(
  base: DigitalSettingsData,
  next: DigitalSettingsData,
): UpdateDigitalSettingsInput {
  const patch: UpdateDigitalSettingsInput = {};
  if (next.is_enabled !== base.is_enabled) patch.is_enabled = next.is_enabled;
  if (next.fulfillment_type !== base.fulfillment_type)
    patch.fulfillment_type = next.fulfillment_type;
  if (next.auto_delivery_enabled !== base.auto_delivery_enabled)
    patch.auto_delivery_enabled = next.auto_delivery_enabled;
  if (next.delivery_mode !== base.delivery_mode)
    patch.delivery_mode = next.delivery_mode;
  if (next.code_pool_strategy !== base.code_pool_strategy)
    patch.code_pool_strategy = next.code_pool_strategy;
  if (!sameStatusSet(next.reserve_on_statuses, base.reserve_on_statuses))
    patch.reserve_on_statuses = next.reserve_on_statuses;
  if (!sameStatusSet(next.deliver_on_statuses, base.deliver_on_statuses))
    patch.deliver_on_statuses = next.deliver_on_statuses;
  if (next.allow_manual_assignment !== base.allow_manual_assignment)
    patch.allow_manual_assignment = next.allow_manual_assignment;
  if (next.allow_replacement !== base.allow_replacement)
    patch.allow_replacement = next.allow_replacement;
  if (next.low_stock_threshold !== base.low_stock_threshold)
    patch.low_stock_threshold = next.low_stock_threshold;
  if (next.max_codes_per_order_item !== base.max_codes_per_order_item)
    patch.max_codes_per_order_item = next.max_codes_per_order_item;
  if (next.instructions_template !== base.instructions_template)
    patch.instructions_template = next.instructions_template;
  return patch;
}

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type Banner = { tone: "success" | "error" | "info"; message: string };

interface DigitalSettingsCardProps {
  productId: string;
  canEdit: boolean;
}

/**
 * Phase 15 digital fulfillment settings editor for the product edit page.
 * Self-fetching (GET on mount), saves a minimal diff (PATCH). Editing requires
 * `digital_inventory.edit`; view-only users see disabled inputs + a note.
 */
export function DigitalSettingsCard({
  productId,
  canEdit,
}: DigitalSettingsCardProps) {
  const [settings, setSettings] = useState<DigitalSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setSettings(await getDigitalSettings(productId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>إعدادات المنتج الرقمي</CardTitle>
        <CardDescription>
          فعّل تسليم الأكواد الرقمية واضبط طريقة الحجز والتسليم. (لا يتم إدخال
          الأكواد في هذه المرحلة.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState />
        ) : error || !settings ? (
          <ErrorState
            description="تعذّر تحميل إعدادات المنتج الرقمي."
            onRetry={() => void load()}
          />
        ) : (
          <DigitalSettingsFields
            settings={settings}
            canEdit={canEdit}
            onSaved={setSettings}
          />
        )}
      </CardContent>
    </Card>
  );
}

interface DigitalSettingsFieldsProps {
  settings: DigitalSettingsDto;
  canEdit: boolean;
  onSaved: (updated: DigitalSettingsDto) => void;
}

function DigitalSettingsFields({
  settings,
  canEdit,
  onSaved,
}: DigitalSettingsFieldsProps) {
  const [banner, setBanner] = useState<Banner | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DigitalFormValues>({
    resolver: zodResolver(digitalFormSchema),
    defaultValues: toFormValues(settings),
  });

  const submit = handleSubmit(async (values) => {
    setBanner(null);
    const next = toSettingsData(values);
    const patch = buildPatch(settings, next);
    if (Object.keys(patch).length === 0) {
      setBanner({ tone: "info", message: "لا توجد تغييرات للحفظ." });
      return;
    }
    try {
      const updated = await updateDigitalSettings(settings.productId, patch);
      onSaved(updated);
      reset(toFormValues(updated));
      setBanner({ tone: "success", message: "تم حفظ الإعدادات الرقمية بنجاح." });
    } catch (err) {
      setBanner({
        tone: "error",
        message: err instanceof Error ? err.message : "تعذّر حفظ الإعدادات.",
      });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {banner ? (
        <div
          role="alert"
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            banner.tone === "success" &&
              "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
            banner.tone === "error" &&
              "border-destructive/30 bg-destructive/5 text-destructive",
            banner.tone === "info" &&
              "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          {banner.message}
        </div>
      ) : null}

      <ToggleRow
        control={control}
        name="is_enabled"
        label="تفعيل التسليم الرقمي"
        disabled={!canEdit}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="نوع التسليم" error={errors.fulfillment_type?.message}>
          <select
            className={inputClass}
            disabled={!canEdit}
            {...register("fulfillment_type")}
          >
            {FULFILLMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="طريقة التسليم" error={errors.delivery_mode?.message}>
          <select
            className={inputClass}
            disabled={!canEdit}
            {...register("delivery_mode")}
          >
            {DELIVERY_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="استراتيجية اختيار الكود"
          error={errors.code_pool_strategy?.message}
        >
          <select
            className={inputClass}
            disabled={!canEdit}
            {...register("code_pool_strategy")}
          >
            {CODE_POOL_STRATEGY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="حالات حجز الكود" error={errors.reserve_on_statuses?.message}>
        <Controller
          control={control}
          name="reserve_on_statuses"
          render={({ field }) => (
            <StatusMultiSelect
              value={field.value}
              onChange={field.onChange}
              disabled={!canEdit}
            />
          )}
        />
      </Field>

      <Field
        label="حالات إرسال الكود"
        error={errors.deliver_on_statuses?.message}
      >
        <Controller
          control={control}
          name="deliver_on_statuses"
          render={({ field }) => (
            <StatusMultiSelect
              value={field.value}
              onChange={field.onChange}
              disabled={!canEdit}
            />
          )}
        />
      </Field>

      <div className="space-y-1">
        <ToggleRow
          control={control}
          name="auto_delivery_enabled"
          label="تفعيل التسليم التلقائي"
          disabled={!canEdit}
        />
        <ToggleRow
          control={control}
          name="allow_manual_assignment"
          label="السماح بالتعيين اليدوي"
          disabled={!canEdit}
        />
        <ToggleRow
          control={control}
          name="allow_replacement"
          label="السماح بالاستبدال"
          disabled={!canEdit}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="حد تنبيه انخفاض الأكواد"
          error={errors.low_stock_threshold?.message}
        >
          <Input
            type="number"
            min={0}
            dir="ltr"
            disabled={!canEdit}
            {...register("low_stock_threshold")}
          />
        </Field>
        <Field
          label="أقصى عدد أكواد في عنصر الطلب"
          error={errors.max_codes_per_order_item?.message}
        >
          <Input
            type="number"
            min={1}
            max={500}
            dir="ltr"
            disabled={!canEdit}
            {...register("max_codes_per_order_item")}
          />
        </Field>
      </div>

      <Field
        label="تعليمات تظهر مع الكود"
        error={errors.instructions_template?.message}
      >
        <Textarea
          rows={4}
          placeholder="تعليمات اختيارية تُعرض للعميل مع الكود…"
          disabled={!canEdit}
          {...register("instructions_template")}
        />
      </Field>

      {canEdit ? (
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "جارٍ الحفظ…" : "حفظ الإعدادات الرقمية"}
          </Button>
        </div>
      ) : (
        <p className="text-end text-xs text-muted-foreground">
          العرض فقط — تحتاج صلاحية «تعديل المخزون الرقمي» لحفظ التغييرات.
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

type ToggleName =
  | "is_enabled"
  | "auto_delivery_enabled"
  | "allow_manual_assignment"
  | "allow_replacement";

function ToggleRow({
  control,
  name,
  label,
  disabled,
}: {
  control: Control<DigitalFormValues>;
  name: ToggleName;
  label: string;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-3 last:border-0">
      <span className="text-sm font-medium">{label}</span>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
            aria-label={label}
          />
        )}
      />
    </div>
  );
}

function StatusMultiSelect({
  value,
  onChange,
  disabled,
}: {
  value: OrderStatus[];
  onChange: (value: OrderStatus[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER_STATUS_OPTIONS.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
              checked ? "border-primary bg-primary/5" : "border-input",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="checkbox"
              className="accent-primary"
              checked={checked}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, opt.value]
                    : value.filter((v) => v !== opt.value),
                )
              }
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
