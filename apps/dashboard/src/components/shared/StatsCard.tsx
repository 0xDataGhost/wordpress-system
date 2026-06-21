import type { LucideIcon } from "lucide-react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  /** Percentage change vs. previous period; positive = up, negative = down. */
  trend?: number;
  /** Helper text under the value (e.g. comparison period). */
  hint?: string;
  className?: string;
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  hint,
  className,
}: StatsCardProps) {
  const hasTrend = typeof trend === "number";
  const isUp = (trend ?? 0) >= 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-2">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {hasTrend || hint ? (
            <div className="flex items-center gap-2 text-xs">
              {hasTrend ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium",
                    isUp ? "text-success" : "text-destructive",
                  )}
                >
                  {isUp ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownLeft className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(trend as number)}%
                </span>
              ) : null}
              {hint ? (
                <span className="text-muted-foreground">{hint}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
