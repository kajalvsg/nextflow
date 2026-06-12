import type { Connection, Edge, Node } from "reactflow";
import { validateWorkflowConnection } from "@/lib/workflow/connection-rules";
import { isTargetHandleConnected } from "@/lib/workflow/connection-rules";
import type { WorkflowNodeData } from "@/types/workflow-canvas";

function tryConnection(
  connection: Connection,
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): Connection | null {
  if (isTargetHandleConnected(connection.target!, connection.targetHandle!, edges)) {
    return null;
  }

  const result = validateWorkflowConnection(connection, nodes, edges);

  if (!result.valid) {
    return null;
  }

  return connection;
}

export function findAutoConnectSource(
  targetNodeId: string,
  targetHandle: string,
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): Connection | null {
  const requestInputs = nodes.find(
    (node) => node.data.nodeType === "requestInputs",
  );

  if (targetHandle === "prompt" || targetHandle === "system_prompt") {
    if (requestInputs) {
      const fromRequest = tryConnection(
        {
          source: requestInputs.id,
          target: targetNodeId,
          sourceHandle: "text_field",
          targetHandle,
        },
        nodes,
        edges,
      );

      if (fromRequest) {
        return fromRequest;
      }
    }

    for (const node of nodes) {
      if (node.data.nodeType !== "geminiPro" || node.id === targetNodeId) {
        continue;
      }

      const fromGemini = tryConnection(
        {
          source: node.id,
          target: targetNodeId,
          sourceHandle: "response",
          targetHandle,
        },
        nodes,
        edges,
      );

      if (fromGemini) {
        return fromGemini;
      }
    }

    return null;
  }

  if (targetHandle === "image_vision") {
    if (requestInputs) {
      const fromRequest = tryConnection(
        {
          source: requestInputs.id,
          target: targetNodeId,
          sourceHandle: "image_field",
          targetHandle,
        },
        nodes,
        edges,
      );

      if (fromRequest) {
        return fromRequest;
      }
    }

    for (const node of nodes) {
      if (node.data.nodeType !== "cropImage") {
        continue;
      }

      const fromCrop = tryConnection(
        {
          source: node.id,
          target: targetNodeId,
          sourceHandle: "output_image",
          targetHandle,
        },
        nodes,
        edges,
      );

      if (fromCrop) {
        return fromCrop;
      }
    }
  }

  return null;
}
