"use client";

import { MiniMap } from "reactflow";
import { Map } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CanvasMinimapPanelProps = {
  visible: boolean;
  onToggle: () => void;
};

export function CanvasMinimapPanel({
  visible,
  onToggle,
}: CanvasMinimapPanelProps) {
  return (
    <div className="workflow-minimap-panel nodrag nopan nowheel pointer-events-auto flex flex-col items-end">
      {visible ? (
        <div className="relative">
          <MiniMap
            className="workflow-minimap !static !m-0"
            nodeColor="#7c3aed"
            maskColor="rgb(247 247 247 / 0.85)"
            pannable
            zoomable
          />
          <button
            type="button"
            onClick={onToggle}
            title="Hide minimap"
            aria-label="Hide minimap"
            className={cn(
              "canvas-minimap-toggle absolute -right-1.5 -top-1.5",
              "flex h-6 w-6 items-center justify-center rounded-full",
              "border border-border bg-surface text-muted shadow-card",
              "transition-colors hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <Map className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          title="Show minimap"
          aria-label="Show minimap"
          className={cn(
            "canvas-minimap-toggle flex h-8 w-8 items-center justify-center rounded-lg",
            "border border-border bg-surface text-muted shadow-card",
            "transition-colors hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <Map className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
