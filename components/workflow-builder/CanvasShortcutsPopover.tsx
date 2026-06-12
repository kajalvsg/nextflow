"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

const SHORTCUTS = [
  { keys: "Ctrl + Z", action: "Undo" },
  { keys: "Ctrl + Y / Ctrl + Shift + Z", action: "Redo" },
  { keys: "Delete / Backspace", action: "Delete selected" },
  { keys: "Scroll", action: "Zoom canvas" },
  { keys: "Drag empty canvas", action: "Move entire workflow" },
  { keys: "Drag handle", action: "Connect nodes" },
  { keys: "Shift + drag node", action: "Move connected group" },
  { keys: "Drag connection line", action: "Move connected group" },
];

type CanvasShortcutsPopoverProps = {
  open: boolean;
  onClose: () => void;
};

export function CanvasShortcutsPopover({
  open,
  onClose,
}: CanvasShortcutsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-elevated",
      )}
    >
      <p className="mb-2 text-body-sm font-semibold text-foreground">
        Keyboard shortcuts
      </p>
      <ul className="stack-sm">
        {SHORTCUTS.map((item) => (
          <li
            key={item.action}
            className="flex items-start justify-between gap-3 text-caption"
          >
            <span className="text-muted">{item.action}</span>
            <kbd className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
              {item.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
