"use client";

import { Plus, StickyNote } from "lucide-react";
import { CanvasToolbarButton } from "./CanvasToolbarButton";

type CanvasBottomToolbarProps = {
  onAddNode: () => void;
  onAddStickyNote: () => void;
};

export function CanvasBottomToolbar({
  onAddNode,
  onAddStickyNote,
}: CanvasBottomToolbarProps) {
  return (
    <div className="canvas-toolbar nodrag nopan nowheel pointer-events-auto flex items-center gap-0.5">
      <CanvasToolbarButton label="Add sticky note" onClick={onAddStickyNote}>
        <StickyNote className="h-4 w-4" />
      </CanvasToolbarButton>
      <CanvasToolbarButton label="Add node" onClick={onAddNode}>
        <Plus className="h-4 w-4" />
      </CanvasToolbarButton>
    </div>
  );
}
