import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, ProviderBadge } from "@/components/ai/CopyButton";
import {
  generateProductDescription,
  type ProductDescriptionResult,
} from "@/lib/ai-api";

export function ProductDescriptionCard() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductDescriptionResult | null>(null);

  const canGenerate = name.trim().length >= 2 && !loading;

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const r = await generateProductDescription({
        product_name: name.trim(),
        product_category: category.trim(),
        short_context: context.trim(),
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر توليد الوصف.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          مولّد وصف المنتجات
        </CardTitle>
        <CardDescription>
          أدخل بيانات المنتج لتوليد عنوان ووصف مختصر وتفصيلي ووصف SEO.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-pd-name">اسم المنتج</Label>
            <Input
              id="ai-pd-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قميص قطني"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-pd-category">الفئة</Label>
            <Input
              id="ai-pd-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="مثال: ملابس رجالية"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-pd-context">ملاحظات قصيرة</Label>
          <Textarea
            id="ai-pd-context"
            rows={2}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="مواد، مميزات، جمهور مستهدف…"
          />
        </div>

        <Button onClick={() => void handleGenerate()} disabled={!canGenerate}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "جارٍ التوليد…" : "توليد الوصف"}
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
            <div className="flex justify-end">
              <ProviderBadge provider={result.provider} />
            </div>
            <ResultField label="العنوان" value={result.title} />
            <ResultField label="وصف مختصر" value={result.short_description} />
            <ResultField label="وصف تفصيلي" value={result.long_description} />
            <ResultField label="وصف SEO" value={result.seo_description} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ResultField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5 rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton value={value} />
      </div>
      <p className="whitespace-pre-line text-sm">{value}</p>
    </div>
  );
}
