import { Badge, type BadgeProps } from "@/components/ui/badge";

/** Semantic tone for a status label. */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneToVariant: Record<StatusTone, BadgeProps["variant"]> = {
  neutral: "secondary",
  success: "success",
  warning: "warning",
  danger: "destructive",
  info: "default",
};

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant={toneToVariant[tone]} className={className}>
      {label}
    </Badge>
  );
}
