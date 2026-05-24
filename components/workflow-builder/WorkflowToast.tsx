"use client";

import { cn } from "@/lib/utils/cn";

type WorkflowToastProps = {
  message: string | null;
};

export function WorkflowToast({ message }: WorkflowToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute left-1/2 top-4 z-50 max-w-md -translate-x-1/2",
        "rounded-button border border-red-500/30 bg-surface px-4 py-2.5 shadow-elevated",
      )}
    >
      <p className="text-body-sm text-red-400">{message}</p>
    </div>
  );
}
