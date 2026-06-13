import type { Edge, Node } from "reactflow";
import {
  findFirstRequestFieldId,
  normalizeRequestInputsConfig,
} from "@/lib/workflow/request-inputs-fields";
import type { WorkflowNodeData } from "@/types/workflow-canvas";

function getNodeType(
  nodes: Node<WorkflowNodeData>[],
  nodeId: string,
): WorkflowNodeData["nodeType"] | null {
  return nodes.find((node) => node.id === nodeId)?.data.nodeType ?? null;
}

/**
 * Fill missing handle ids on stored edges so execution resolution matches canvas intent.
 */
export function normalizeEdgeForResolution(
  edge: Edge,
  nodes: Node<WorkflowNodeData>[],
): Edge {
  const sourceType = getNodeType(nodes, edge.source);
  const targetType = getNodeType(nodes, edge.target);

  let sourceHandle = edge.sourceHandle ?? undefined;
  let targetHandle = edge.targetHandle ?? undefined;

  if (!targetHandle && targetType === "cropImage") {
    targetHandle = "input_image";
  }

  if (!targetHandle && targetType === "response") {
    targetHandle = "result";
  }

  if (!sourceHandle && sourceType === "requestInputs") {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const config = normalizeRequestInputsConfig(sourceNode?.data.config);

    if (targetHandle === "input_image" || targetHandle === "image_vision") {
      sourceHandle =
        findFirstRequestFieldId(config, "image_field") ?? "image_field";
    } else if (
      targetHandle === "prompt" ||
      targetHandle === "system_prompt" ||
      targetHandle === "result"
    ) {
      sourceHandle =
        findFirstRequestFieldId(config, "text_field") ?? "text_field";
    }
  }

  if (!sourceHandle && sourceType === "cropImage") {
    sourceHandle = "output_image";
  }

  if (!sourceHandle && sourceType === "geminiPro") {
    sourceHandle = "response";
  }

  return {
    ...edge,
    sourceHandle,
    targetHandle,
  };
}
