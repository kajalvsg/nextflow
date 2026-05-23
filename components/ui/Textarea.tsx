import { cn } from "@/lib/utils/cn";
import type { WithClassName } from "@/types";

type TextareaProps = WithClassName &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
  };

export function Textarea({
  className,
  label,
  error,
  id,
  ...props
}: TextareaProps) {
  const textareaId = id ?? props.name;

  return (
    <div className="stack-sm">
      {label ? (
        <label htmlFor={textareaId} className="text-label text-foreground">
          {label}
        </label>
      ) : null}
      <textarea
        id={textareaId}
        className={cn(
          "min-h-24 w-full resize-y rounded-button border border-border bg-surface-muted px-3 py-2 text-body text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20",
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
