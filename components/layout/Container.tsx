import { cn } from "@/lib/utils/cn";
import type { WithChildren, WithClassName } from "@/types";

type ContainerProps = WithChildren &
  WithClassName & {
    as?: "div" | "section" | "main";
    size?: "sm" | "md" | "lg" | "full";
  };

const sizeClasses = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  full: "max-w-full",
} as const;

export function Container({
  children,
  className,
  as: Component = "div",
  size = "lg",
}: ContainerProps) {
  return (
    <Component
      className={cn(
        "mx-auto w-full px-gutter",
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </Component>
  );
}
