"use client";

import { Handle, Position, type HandleType } from "reactflow";
import { getEdgeColorKind, getHandleColorClass } from "@/lib/workflow/edge-colors";
import { cn } from "@/lib/utils/cn";

type NodeHandleProps = {
  id: string;
  type: HandleType;
  /** @deprecated Use inline handles on field rows instead of percentage positioning. */
  top?: string;
  inline?: boolean;
};

export function NodeHandle({ id, type, top, inline = false }: NodeHandleProps) {
  const isSource = type === "source";
  const colorKind = getEdgeColorKind(id);

  if (inline) {
    return (
      <Handle
        id={id}
        type={type}
        position={isSource ? Position.Right : Position.Left}
        aria-label={id}
        data-handle-color={colorKind}
        className={cn(
          "workflow-handle-dot !relative !left-auto !right-auto !top-auto !translate-x-0 !translate-y-0",
          getHandleColorClass(id),
        )}
      />
    );
  }

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
        data-handle-color={colorKind}
        className={cn(
          "workflow-handle-dot pointer-events-auto !relative !left-auto !right-auto !top-auto !translate-x-0 !translate-y-0",
          getHandleColorClass(id),
        )}
      />
    </div>
  );
}
