import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  /** Typically a SearchInput plus filter controls. */
  children: ReactNode;
  /** Actions rendered at the opposite end (e.g. reset, export). */
  actions?: ReactNode;
  className?: string;
};

export function FilterBar({ children, actions, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {children}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
