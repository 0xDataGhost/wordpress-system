import { useState } from "react";
import { Lightbulb, Loader2, PackageMinus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton, ProviderBadge } from "@/components/ai/CopyButton";
import {
  generateLowStockInsights,
  type LowStockInsightsResult,
} from "@/lib/ai-api";

export function LowStockInsightsCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LowStockInsightsResult | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      setResult(await generateLowStockInsights());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر توليد التوصيات.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          توصيات المخزون المنخفض
        </CardTitle>
        <CardDescription>
          توصيات بالعربية لإعادة الطلب بناءً على منتجاتك المنخفضة المخزون.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={() => void handleGenerate()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="h-4 w-4" />
          )}
          {loading ? "جارٍ التحليل…" : "توليد التوصيات"}
        </Button>

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
              <CopyButton value={result.insights} label="نسخ التوصيات" />
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {result.insights}
            </p>
            {result.products.length > 0 ? (
              <ul className="space-y-1 pt-1">
                {result.products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <PackageMinus className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      {p.name}
                    </span>
                    <span dir="ltr" className="text-muted-foreground">
                      {p.stockQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
