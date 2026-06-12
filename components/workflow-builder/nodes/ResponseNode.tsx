"use client";

import { ArrowUpFromLine } from "lucide-react";
import { type NodeProps } from "reactflow";
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";
import { NodeInlineOutputSection } from "./NodeInlineOutputSection";

export function ResponseNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const { getNodeExecutionStatus, getNodeInlineExecution } = useWorkflowBuilder();

  return (
    <div className="relative">
      <NodeHandle id="result" type="target" top="50%" />

      <NodeCardShell
        nodeId={id}
        title={data.label}
        subtitle="Workflow Output"
        icon={ArrowUpFromLine}
        selected={selected}
        executionStatus={getNodeExecutionStatus(id)}
      >
        <p className="text-body-sm text-muted">
          Connect a node output to the result handle to define the workflow
          response.
        </p>

        <NodeInlineOutputSection
          sectionLabel="Final Output"
          nodeType="response"
          inlineExecution={getNodeInlineExecution(id)}
        />
      </NodeCardShell>
    </div>
  );
}
