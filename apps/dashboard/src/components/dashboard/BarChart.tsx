import { cn } from "@/lib/utils";

export interface BarDatum {
  /** Short axis label (e.g. "23/06"). */
  label: string;
  value: number;
  /** Hover tooltip text; falls back to `${label}: ${value}`. */
  tooltip?: string;
}

interface BarChartProps {
  data: BarDatum[];
  /** Chart body height in pixels. */
  height?: number;
  /** Tailwind classes for the bar fill. */
  barClassName?: string;
  /** Max number of x-axis labels to render (evenly spaced). */
  maxLabels?: number;
  className?: string;
}

/**
 * Dependency-free vertical bar chart. Bars scale to the series max; only the
 * fill colour transitions on hover (compositor-friendly). Renders nothing but an
 * empty hint when every value is zero.
 */
export function BarChart({
  data,
  height = 192,
  barClassName = "bg-primary/70 group-hover:bg-primary",
  maxLabels = 7,
  className,
}: BarChartProps) {
  const max = Math.max(0, ...data.map((d) => d.value));

  // Indices of the bars whose labels we actually render, evenly spaced.
  const labelIndices = new Set<number>();
  if (data.length <= maxLabels) {
    data.forEach((_, i) => labelIndices.add(i));
  } else {
    const step = (data.length - 1) / (maxLabels - 1);
    for (let i = 0; i < maxLabels; i += 1) {
      labelIndices.add(Math.round(i * step));
    }
  }

  const hasData = max > 0;

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex items-end gap-1 border-b border-border"
        style={{ height }}
        role="img"
        aria-label="رسم بياني شريطي"
      >
        {data.map((d, i) => {
          const pct = hasData ? (d.value / max) * 100 : 0;
          return (
            <div
              key={`${d.label}-${i}`}
              className="group flex h-full flex-1 items-end"
              title={d.tooltip ?? `${d.label}: ${d.value}`}
            >
              <div
                className={cn("w-full rounded-t-sm transition-colors", barClassName)}
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1">
        {data.map((d, i) => (
          <div
            key={`label-${d.label}-${i}`}
            className="flex-1 text-center text-[10px] text-muted-foreground"
          >
            {labelIndices.has(i) ? d.label : ""}
          </div>
        ))}
      </div>
      {!hasData ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          لا توجد بيانات في هذه الفترة.
        </p>
      ) : null}
    </div>
  );
}
