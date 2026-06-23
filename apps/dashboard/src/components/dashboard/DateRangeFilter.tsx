import type { DashboardPeriod } from "@/lib/dashboard-api";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "اليوم" },
  { value: "7d", label: "آخر 7 أيام" },
  { value: "30d", label: "آخر 30 يومًا" },
  { value: "this_month", label: "هذا الشهر" },
  { value: "custom", label: "نطاق مخصص" },
];

export interface DateRangeValue {
  period: DashboardPeriod;
  dateFrom: string;
  dateTo: string;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

const selectClass =
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Period selector with optional custom date inputs (charts + top products). */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        aria-label="الفترة الزمنية"
        value={value.period}
        onChange={(e) =>
          onChange({ ...value, period: e.target.value as DashboardPeriod })
        }
        className={`${selectClass} w-full sm:w-44`}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {value.period === "custom" ? (
        <div className="flex gap-2">
          <input
            type="date"
            aria-label="من تاريخ"
            dir="ltr"
            value={value.dateFrom}
            max={value.dateTo || undefined}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
            className={`${selectClass} w-full sm:w-40`}
          />
          <input
            type="date"
            aria-label="إلى تاريخ"
            dir="ltr"
            value={value.dateTo}
            min={value.dateFrom || undefined}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
            className={`${selectClass} w-full sm:w-40`}
          />
        </div>
      ) : null}
    </div>
  );
}
