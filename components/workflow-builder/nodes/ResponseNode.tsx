"use client";

import { ArrowUpFromLine } from "lucide-react";
import { type NodeProps } from "reactflow";
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";

export function ResponseNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  return (
    <div className="relative">
      <NodeHandle id="result" type="target" top="50%" />

      <NodeCardShell
        title={data.label}
        subtitle="Workflow Output"
        icon={ArrowUpFromLine}
        selected={selected}
      >
        <p className="text-body-sm text-muted">
          Connect a node output to the result handle to define the workflow
          response.
        </p>
      </NodeCardShell>
    </div>
  );
}
