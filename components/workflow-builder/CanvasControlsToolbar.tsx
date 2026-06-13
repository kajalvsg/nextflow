"use client";

import { useCallback, useEffect, useState } from "react";
import { useReactFlow, useStore } from "reactflow";
import {
  ChevronLeft,
  Expand,
  Grid3x3,
  Keyboard,
  LayoutGrid,
  Minus,
  Network,
  PanelLeft,
  Plus,
  Redo2,
  Undo2,
} from "lucide-react";
import {
  CanvasToolbarButton,
  CanvasToolbarDivider,
} from "./CanvasToolbarButton";
import { CanvasShortcutsPopover } from "./CanvasShortcutsPopover";

type CanvasControlsToolbarProps = {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  moveConnectedGroup: boolean;
  onMoveConnectedGroupChange: (enabled: boolean) => void;
  showGrid: boolean;
  onShowGridChange: (enabled: boolean) => void;
  onAutoArrange: () => void;
};

export function CanvasControlsToolbar({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  moveConnectedGroup,
  onMoveConnectedGroupChange,
  showGrid,
  onShowGridChange,
  onAutoArrange,
}: CanvasControlsToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const [collapsed, setCollapsed] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [zoomLabel, setZoomLabel] = useState("100%");

  useEffect(() => {
    setZoomLabel(`${Math.round(zoom * 100)}%`);
  }, [zoom]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  if (collapsed) {
    return (
      <div className="canvas-toolbar nodrag nopan nowheel pointer-events-auto">
        <CanvasToolbarButton
          label="Expand controls"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeft className="h-4 w-4" />
        </CanvasToolbarButton>
      </div>
    );
  }

  return (
    <div className="canvas-toolbar nodrag nopan nowheel pointer-events-auto relative flex items-center gap-0.5">
      <CanvasToolbarButton
        label="Collapse controls"
        onClick={() => setCollapsed(true)}
      >
        <ChevronLeft className="h-4 w-4" />
      </CanvasToolbarButton>

      <CanvasToolbarDivider />

      <CanvasToolbarButton label="Undo" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="h-4 w-4" />
      </CanvasToolbarButton>

      <CanvasToolbarButton label="Redo" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="h-4 w-4" />
      </CanvasToolbarButton>

      <CanvasToolbarDivider />

      <div className="relative">
        <CanvasToolbarButton
          label="Keyboard shortcuts"
          onClick={() => setShortcutsOpen((current) => !current)}
          active={shortcutsOpen}
        >
          <Keyboard className="h-4 w-4" />
        </CanvasToolbarButton>
        <CanvasShortcutsPopover
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      </div>

      <CanvasToolbarDivider />

      <CanvasToolbarButton
        label="Zoom out"
        onClick={() => zoomOut({ duration: 200 })}
      >
        <Minus className="h-4 w-4" />
      </CanvasToolbarButton>

      <button
        type="button"
        className="canvas-toolbar-zoom-label"
        onClick={handleFitView}
        aria-label="Reset zoom to fit"
      >
        {zoomLabel}
      </button>

      <CanvasToolbarButton
        label="Zoom in"
        onClick={() => zoomIn({ duration: 200 })}
      >
        <Plus className="h-4 w-4" />
      </CanvasToolbarButton>

      <CanvasToolbarButton label="Fit view" onClick={handleFitView}>
        <Expand className="h-4 w-4" />
      </CanvasToolbarButton>

      <CanvasToolbarDivider />

      <CanvasToolbarButton
        label={showGrid ? "Hide grid" : "Show grid"}
        onClick={() => onShowGridChange(!showGrid)}
        active={showGrid}
      >
        <Grid3x3 className="h-4 w-4" />
      </CanvasToolbarButton>

      <CanvasToolbarButton
        label={
          moveConnectedGroup
            ? "Move connected nodes (on) — drag any linked node to move the group"
            : "Move connected nodes (off) — hold Shift while dragging to move a group"
        }
        onClick={() => onMoveConnectedGroupChange(!moveConnectedGroup)}
        active={moveConnectedGroup}
      >
        <Network className="h-4 w-4" />
      </CanvasToolbarButton>

      <CanvasToolbarButton label="Auto arrange" onClick={onAutoArrange}>
        <LayoutGrid className="h-4 w-4" />
      </CanvasToolbarButton>
    </div>
  );
}
