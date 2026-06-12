"use client";

import { cn } from "@/lib/utils/cn";

type CanvasToolbarButtonProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit";
};

export function CanvasToolbarButton({
  label,
  onClick,
  disabled = false,
  active = false,
  children,
  className,
  type = "button",
}: CanvasToolbarButtonProps) {
  return (
    <div className="group/btn relative flex items-center justify-center">
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "canvas-toolbar-btn",
          active && "canvas-toolbar-btn-active",
          className,
        )}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="canvas-toolbar-tooltip pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/btn:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}

export function CanvasToolbarDivider() {
  return <div className="canvas-toolbar-divider" aria-hidden="true" />;
}
