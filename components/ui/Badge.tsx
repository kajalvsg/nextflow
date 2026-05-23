import { cn } from "@/lib/utils/cn";
import type { WithChildren, WithClassName } from "@/types";

type BadgeVariant = "default" | "idle" | "running" | "completed" | "failed";

type BadgeProps = WithChildren &
  WithClassName & {
    variant?: BadgeVariant;
  };

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-muted text-muted border-border",
  idle: "bg-accent-soft/50 text-accent border-accent/20",
  running: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function Badge({
  children,
  className,
  variant = "default",
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-caption capitalize",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusToBadgeVariant(
  status: string,
): BadgeVariant {
  switch (status) {
    case "idle":
    case "running":
    case "completed":
    case "failed":
      return status;
    default:
      return "default";
  }
}
