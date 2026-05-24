import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { WithChildren, WithClassName } from "@/types";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = WithChildren &
  WithClassName & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    href?: string;
    onClick?: () => void;
  };

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-50",
  secondary:
    "border border-border bg-surface-muted text-foreground hover:bg-surface-hover disabled:opacity-50",
  ghost:
    "text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-50",
  danger:
    "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-caption",
  md: "px-4 py-2 text-body-sm",
  lg: "px-5 py-2.5 text-body-sm",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  type = "button",
  disabled,
  href,
  onClick,
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-button font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} prefetch>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}
