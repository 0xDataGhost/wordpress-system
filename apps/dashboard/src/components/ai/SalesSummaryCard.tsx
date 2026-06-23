import { useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CopyButton, ProviderBadge } from "@/components/ai/CopyButton";
import {
  generateSalesSummary,
  type AISalesRange,
  type SalesSummaryResult,
} from "@/lib/ai-api";
import { cn, formatMoney } from "@/lib/utils";

const RANGE_OPTIONS: { value: AISalesRange; label: string }[] = [
  { value: "today", label: "اليوم" },
  { value: "7d", label: "آخر ٧ أيام" },
  { value: "30d", label: "آخر ٣٠ يومًا" },
  { value: "this_month", label: "هذا الشهر" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function SalesSummaryCard() {
  const [range, setRange] = useState<AISalesRange>("30d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SalesSummaryResult | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await generateSalesSummary(range));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر توليد الملخص.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          مولّد ملخص المبيعات
        </CardTitle>
        <CardDescription>
          ملخص نصّي بالعربية لأداء متجرك خلال الفترة المحددة (إيرادات، طلبات،
          عملاء، أفضل المنتجات).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="ai-ss-range">الفترة</Label>
            <select
              id="ai-ss-range"
              className={selectClass}
              value={range}
              onChange={(e) => setRange(e.target.value as AISalesRange)}
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => void handleGenerate()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            {loading ? "جارٍ التوليد…" : "توليد الملخص"}
          </Button>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <ProviderBadge provider={result.provider} />
              <CopyButton value={result.summary} label="نسخ الملخص" />
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {result.summary}
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Metric
                label="الإيرادات"
                value={formatMoney(result.metrics.revenue, result.metrics.currency)}
              />
              <Metric label="الطلبات" value={String(result.metrics.orders)} />
              <Metric
                label="العملاء الجدد"
                value={String(result.metrics.customers)}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("rounded-md border bg-card p-3 text-center")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div dir="ltr" className="mt-1 text-sm font-semibold">
        {value}
      </div>
    </div>
  );
}
