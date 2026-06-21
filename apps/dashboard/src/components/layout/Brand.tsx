import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground shadow-sm">
        <Store className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-base font-bold">لوحة المتجر</span>
        <span className="text-xs text-sidebar-foreground/60">
          إدارة المتجر بذكاء
        </span>
      </div>
    </div>
  );
}
