import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  /** "spinner" for a centered spinner, "skeleton" for placeholder rows. */
  variant?: "spinner" | "skeleton";
  label?: string;
  rows?: number;
  className?: string;
};

export function LoadingState({
  variant = "spinner",
  label = "جارٍ التحميل…",
  rows = 5,
  className,
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div
        className={cn("space-y-3", className)}
        role="status"
        aria-label={label}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground",
        className,
      )}
      role="status"
      aria-label={label}
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
