"use client";

import { ArrowDownToLine } from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";
import { cn } from "@/lib/utils/cn";
import type { WorkflowNodeData } from "@/types/workflow-canvas";

export function RequestInputsNode({
  data,
  selected,
}: NodeProps<WorkflowNodeData>) {
  return (
    <div
      className={cn(
        "min-w-[220px] rounded-card border bg-surface px-4 py-3 shadow-card transition-shadow",
        selected
          ? "border-accent shadow-elevated ring-2 ring-accent/30"
          : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-button bg-accent-soft text-accent">
          <ArrowDownToLine className="h-4 w-4" />
        </div>
        <div>
          <p className="text-caption text-muted">Input</p>
          <p className="text-body-sm font-medium text-foreground">{data.label}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-accent !bg-background"
      />
    </div>
  );
}
