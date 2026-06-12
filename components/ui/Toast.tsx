"use client";

import { cn } from "@/lib/utils/cn";

type ToastProps = {
  message: string | null;
  variant?: "error" | "success";
  className?: string;
};

export function Toast({
  message,
  variant = "error",
  className,
}: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed left-1/2 top-4 z-[100] max-w-md -translate-x-1/2",
        "rounded-button border bg-surface px-4 py-2.5 shadow-elevated",
        variant === "error" ? "border-red-500/30" : "border-emerald-500/30",
        className,
      )}
    >
      <p
        className={cn(
          "text-body-sm",
          variant === "error" ? "text-red-400" : "text-emerald-600",
        )}
      >
        {message}
      </p>
    </div>
  );
}
