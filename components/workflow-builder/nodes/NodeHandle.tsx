"use client";

import { Handle, Position, type HandleType } from "reactflow";
import { cn } from "@/lib/utils/cn";

type NodeHandleProps = {
  id: string;
  type: HandleType;
  top: string;
};

export function NodeHandle({ id, type, top }: NodeHandleProps) {
  const isSource = type === "source";

  return (
    <div
      className={cn(
        "workflow-handle-row pointer-events-none absolute z-10 flex items-center",
        isSource ? "right-2" : "left-2",
      )}
      style={{ top, transform: "translateY(-50%)" }}
    >
      <Handle
        id={id}
        type={type}
        position={isSource ? Position.Right : Position.Left}
        aria-label={id}
        className="workflow-handle-dot pointer-events-auto !relative !left-auto !right-auto !top-auto !translate-x-0 !translate-y-0"
      />
    </div>
  );
}
