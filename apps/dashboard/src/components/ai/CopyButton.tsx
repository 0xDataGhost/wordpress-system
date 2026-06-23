import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
  label?: string;
}

/** Copies `value` to the clipboard and briefly confirms. */
export function CopyButton({ value, label = "نسخ" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (insecure context) — fail silently.
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void handleCopy()}
      aria-label={label}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "تم النسخ" : label}
    </Button>
  );
}

/** Small badge shown when the deterministic mock provider produced the result. */
export function ProviderBadge({ provider }: { provider: string }) {
  if (provider !== "mock") return null;
  return (
    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
      وضع تجريبي (بدون مفتاح AI)
    </span>
  );
}
