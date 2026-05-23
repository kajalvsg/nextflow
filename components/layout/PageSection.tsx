import { cn } from "@/lib/utils/cn";
import type { WithChildren, WithClassName } from "@/types";

type PageSectionProps = WithChildren &
  WithClassName & {
    spacing?: "default" | "lg" | "none";
  };

const spacingClasses = {
  default: "section-padding",
  lg: "section-padding-lg",
  none: "",
} as const;

export function PageSection({
  children,
  className,
  spacing = "default",
}: PageSectionProps) {
  return (
    <section className={cn(spacingClasses[spacing], className)}>
      {children}
    </section>
  );
}
