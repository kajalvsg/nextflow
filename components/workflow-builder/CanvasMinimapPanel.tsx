"use client";

import { MiniMap } from "reactflow";
import { Map } from "lucide-react";
import { CanvasToolbarButton } from "./CanvasToolbarButton";

type CanvasMinimapPanelProps = {
  visible: boolean;
  onToggle: () => void;
};

export function CanvasMinimapPanel({
  visible,
  onToggle,
}: CanvasMinimapPanelProps) {
  return (
    <div className="nodrag nopan nowheel pointer-events-auto flex flex-col items-end gap-2">
      {visible ? (
        <div className="relative">
          <MiniMap
            className="workflow-minimap !static !m-0"
            nodeColor="#7c3aed"
            maskColor="rgb(247 247 247 / 0.85)"
            pannable
            zoomable
          />
          <div className="absolute -left-2 -top-2">
            <div className="canvas-toolbar canvas-toolbar-compact">
              <CanvasToolbarButton
                label="Hide minimap"
                onClick={onToggle}
              >
                <Map className="h-3.5 w-3.5" />
              </CanvasToolbarButton>
            </div>
          </div>
        </div>
      ) : (
        <div className="canvas-toolbar canvas-toolbar-compact">
          <CanvasToolbarButton label="Show minimap" onClick={onToggle}>
            <Map className="h-4 w-4" />
          </CanvasToolbarButton>
        </div>
      )}
    </div>
  );
}
