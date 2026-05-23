import { cn } from "@/lib/utils/cn";
import type { WithChildren, WithClassName } from "@/types";

type CardProps = WithChildren &
  WithClassName & {
    variant?: "default" | "muted" | "elevated";
    padding?: "none" | "sm" | "md" | "lg";
  };

const variantClasses = {
  default: "card",
  muted: "surface-muted",
  elevated: "card-elevated",
} as const;

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export function Card({
  children,
  className,
  variant = "default",
  padding = "md",
}: CardProps) {
  return (
    <div
      className={cn(variantClasses[variant], paddingClasses[padding], className)}
    >
      {children}
    </div>
  );
}
