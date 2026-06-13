"use client";

import { type NodeProps, useStore } from "reactflow";
import type { WorkflowNodeData, WorkflowNodeType } from "@/types/workflow-canvas";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";
import { NodeOutputPreview } from "./NodeOutputPreview";

function formatSourceLabel(
  nodeType: WorkflowNodeType | undefined,
  nodeId: string,
): string {
  switch (nodeType) {
    case "geminiPro":
      return "gemini_3_1_pro";
    case "cropImage":
      return "crop_image";
    case "requestInputs":
      return "request_inputs";
    default:
      return nodeId.replace(/-/g, "_").toLowerCase();
  }
}

export function ResponseNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const { getNodeExecutionStatus, getNodeInlineExecution } = useWorkflowBuilder();

  const connectedSource = useStore((state) => {
    const edge = state.edges.find(
      (item) => item.target === id && item.targetHandle === "result",
    );

    if (!edge) {
      return null;
    }

    const sourceNode = state.nodeInternals.get(edge.source)?.data as
      | WorkflowNodeData
      | undefined;

    return {
      nodeId: edge.source,
      nodeType: sourceNode?.nodeType,
      sourceHandle: edge.sourceHandle,
    };
  });

  const sourceLabel = connectedSource
    ? formatSourceLabel(connectedSource.nodeType, connectedSource.nodeId)
    : null;

  return (
    <div className="relative w-[272px]">
      <NodeCardShell
        nodeId={id}
        title="Response"
        selected={selected}
        showRunButton={false}
        showRefreshButton={false}
        showHeaderIcon={false}
        showInfoIcon
        executionStatus={getNodeExecutionStatus(id)}
        className="w-full overflow-visible"
      >
        <div className="workflow-node-field-row relative nodrag nopan nowheel">
          <div className="workflow-handle-slot workflow-handle-slot-left">
            <NodeHandle id="result" type="target" inline />
          </div>
          <span className="workflow-node-field-label">result</span>
        </div>

        <NodeOutputPreview
          label=""
          nodeType="response"
          inlineExecution={getNodeInlineExecution(id)}
          sourceLabel={sourceLabel}
        />
      </NodeCardShell>
    </div>
  );
}
