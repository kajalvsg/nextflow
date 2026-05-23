import { cn } from "@/lib/utils/cn";
import type { WithClassName } from "@/types";

type InputProps = WithClassName &
  React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
  };

export function Input({
  className,
  label,
  error,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="stack-sm">
      {label ? (
        <label htmlFor={inputId} className="text-label text-foreground">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-button border border-border bg-surface-muted px-3 py-2 text-body text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
          error &&
            "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
        {...props}
      />
      {error ? <p className="text-caption text-red-400">{error}</p> : null}
    </div>
  );
}
