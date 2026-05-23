"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { WithChildren, WithClassName } from "@/types";
import { Button } from "./Button";

type DialogProps = WithChildren &
  WithClassName & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
  };

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-lg rounded-card border border-border bg-surface p-0 text-foreground shadow-elevated backdrop:bg-black/60",
        className,
      )}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
    >
      <div className="border-b border-border-soft px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="stack-sm min-w-0 flex-1">
            <h2 className="text-heading-sm text-foreground">{title}</h2>
            {description ? (
              <p className="text-body-sm text-muted">{description}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-2"
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  );
}
