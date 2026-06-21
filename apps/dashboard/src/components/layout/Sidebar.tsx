import { Brand } from "@/components/layout/Brand";
import { SidebarNav } from "@/components/layout/SidebarNav";

/** Desktop sidebar. Hidden below the lg breakpoint (mobile uses a sheet). */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Brand />
      </div>
      <SidebarNav />
      <div className="border-t border-sidebar-border p-4">
        <p className="text-center text-xs text-sidebar-foreground/50">
          الإصدار التجريبي • MVP
        </p>
      </div>
    </aside>
  );
}
