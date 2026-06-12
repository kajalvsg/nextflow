"use client";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type WorkflowSaveStatus = "idle" | "saving" | "saved" | "error";

type WorkflowSaveIndicatorProps = {
  status: WorkflowSaveStatus;
};

export function WorkflowSaveIndicator({ status }: WorkflowSaveIndicatorProps) {
  if (status === "idle") {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "workflow-save-indicator flex h-9 items-center gap-1.5 rounded-lg border px-3 shadow-card",
        status === "saving" && "border-border bg-surface text-foreground",
        status === "saved" && "border-green-200 bg-surface text-green-700",
        status === "error" && "border-red-200 bg-surface text-red-600",
      )}
    >
        {status === "saving" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            <span className="text-xs font-medium">Saving</span>
          </>
        ) : null}

        {status === "saved" ? (
          <>
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            <span className="text-xs font-medium">Saved</span>
          </>
        ) : null}

        {status === "error" ? (
          <span className="text-xs font-medium">Save failed</span>
        ) : null}
    </div>
  );
}
