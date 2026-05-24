import type { Node } from "reactflow";
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import type { NodeOutputMap } from "@/lib/workflow/execution/resolve-inputs";
import {
  buildNodeInputRecord,
  resolveRequestInputsOutput,
} from "@/lib/workflow/execution/resolve-inputs";

export function executeRequestInputsLocal(
  node: Node<WorkflowNodeData>,
): Record<string, unknown> {
  return resolveRequestInputsOutput(node);
}

export function executeResponseLocal(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return {
    result: input.result ?? null,
  };
}

export function buildLocalNodeOutput(
  node: Node<WorkflowNodeData>,
  edges: Parameters<typeof buildNodeInputRecord>[1],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): Record<string, unknown> {
  if (node.data.nodeType === "requestInputs") {
    return executeRequestInputsLocal(node);
  }

  if (node.data.nodeType === "response") {
    const input = buildNodeInputRecord(node, edges, outputs, nodes);
    return executeResponseLocal(input);
  }

  return {};
}
