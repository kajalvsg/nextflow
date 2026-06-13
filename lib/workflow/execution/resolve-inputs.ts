import type { Edge, Node } from "reactflow";
import { normalizeEdgeForResolution } from "@/lib/workflow/execution/edge-handles";
import {
  normalizeImageInputUrl,
  resolveImageInputFromEdge,
} from "@/lib/workflow/execution/image-input";
import { normalizeRequestInputsConfig } from "@/lib/workflow/request-inputs-fields";
import type {
  CropImageConfig,
  GeminiProConfig,
  WorkflowNodeData,
} from "@/types/workflow-canvas";

export type NodeOutputMap = Map<string, Record<string, unknown>>;

export function resolveRequestInputsOutput(
  node: Node<WorkflowNodeData>,
): Record<string, unknown> {
  const config = normalizeRequestInputsConfig(node.data.config);
  const output: Record<string, unknown> = {};

  for (const field of config.fields) {
    if (field.type === "text_field") {
      output[field.id] = field.textValue ?? "";
      continue;
    }

    const imageValue = field.imageValue;
    const rawUrl = imageValue?.fileUrl?.trim() ?? "";
    output[field.id] = rawUrl
      ? normalizeImageInputUrl(rawUrl) ?? rawUrl
      : null;
    output[`${field.id}_meta`] = imageValue ?? null;
  }

  return output;
}

function getIncomingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((edge) => edge.target === nodeId);
}

export function resolveHandleValue(
  sourceNodeId: string,
  sourceHandle: string | null | undefined,
  outputs: NodeOutputMap,
): unknown {
  const sourceOutput = outputs.get(sourceNodeId);

  if (!sourceOutput || !sourceHandle) {
    return null;
  }

  return sourceOutput[sourceHandle] ?? null;
}

function resolveTextFromEdges(
  nodeId: string,
  targetHandle: string,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): string {
  const incoming = getIncomingEdges(nodeId, edges)
    .map((edge) => normalizeEdgeForResolution(edge, nodes))
    .filter((edge) => edge.targetHandle === targetHandle);

  const parts = incoming
    .map((edge) => {
      const value = resolveHandleValue(
        edge.source,
        edge.sourceHandle,
        outputs,
      );

      return typeof value === "string" ? value.trim() : "";
    })
    .filter(Boolean);

  return parts.join("\n\n");
}

export function resolveAllImagesFromEdges(
  nodeId: string,
  targetHandle: string,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): string[] {
  const incoming = getIncomingEdges(nodeId, edges)
    .map((edge) => normalizeEdgeForResolution(edge, nodes))
    .filter((edge) => edge.targetHandle === targetHandle);

  const urls: string[] = [];

  for (const edge of incoming) {
    const url = resolveImageInputFromEdge(edge, outputs, nodes);

    if (url) {
      urls.push(url);
    }
  }

  return urls;
}

export function countIncomingImageEdges(
  nodeId: string,
  targetHandle: string,
  edges: Edge[],
  nodes: Node<WorkflowNodeData>[],
): number {
  return getIncomingEdges(nodeId, edges)
    .map((edge) => normalizeEdgeForResolution(edge, nodes))
    .filter((edge) => edge.targetHandle === targetHandle).length;
}

/** Returns how many connected image edges still lack a resolved value. */
export function countMissingConnectedImages(
  nodeId: string,
  targetHandle: string,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): number {
  const expected = countIncomingImageEdges(nodeId, targetHandle, edges, nodes);

  if (expected === 0) {
    return 0;
  }

  const resolved = resolveAllImagesFromEdges(
    nodeId,
    targetHandle,
    edges,
    outputs,
    nodes,
  ).length;

  return Math.max(0, expected - resolved);
}

export function resolveCropImageInput(
  nodeId: string,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): Record<string, unknown> {
  const incoming = getIncomingEdges(nodeId, edges)
    .map((edge) => normalizeEdgeForResolution(edge, nodes))
    .find((edge) => edge.targetHandle === "input_image");

  const imageUrl = resolveImageInputFromEdge(incoming, outputs, nodes);

  return { input_image: imageUrl };
}

export function resolveGeminiInput(
  nodeId: string,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): Record<string, unknown> {
  const imageUrls = resolveAllImagesFromEdges(
    nodeId,
    "image_vision",
    edges,
    outputs,
    nodes,
  );

  return {
    prompt: resolveTextFromEdges(nodeId, "prompt", edges, outputs, nodes),
    system_prompt: resolveTextFromEdges(
      nodeId,
      "system_prompt",
      edges,
      outputs,
      nodes,
    ),
    image_vision: imageUrls[0] ?? null,
    image_vision_urls: imageUrls,
  };
}

export function resolveResponseInput(
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): Record<string, unknown> {
  const incoming = edges
    .filter((edge) => edge.target === "response")
    .map((edge) => normalizeEdgeForResolution(edge, nodes))[0];

  if (!incoming) {
    return { result: null };
  }

  return {
    result: resolveHandleValue(
      incoming.source,
      incoming.sourceHandle,
      outputs,
    ),
  };
}

export function buildNodeInputRecord(
  node: Node<WorkflowNodeData>,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): Record<string, unknown> {
  switch (node.data.nodeType) {
    case "requestInputs":
      return resolveRequestInputsOutput(node);
    case "cropImage": {
      const config = node.data.config as CropImageConfig;
      return {
        ...resolveCropImageInput(node.id, edges, outputs, nodes),
        ...config,
      };
    }
    case "geminiPro": {
      const config = node.data.config as GeminiProConfig;
      return {
        ...resolveGeminiInput(node.id, edges, outputs, nodes),
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
      };
    }
    case "response":
      return resolveResponseInput(edges, outputs, nodes);
    default:
      return {};
  }
}

export function logPropagatedOutputs(
  sourceNodeId: string,
  edges: Edge[],
  nodes: Node<WorkflowNodeData>[],
): void {
  for (const edge of edges) {
    if (edge.source !== sourceNodeId) {
      continue;
    }

    const normalized = normalizeEdgeForResolution(edge, nodes);
    const targetHandle = normalized.targetHandle ?? "input";
    const sourceHandle = normalized.sourceHandle ?? "output";

    console.info(
      `[workflow-orchestrator] propagated output ${sourceHandle} -> ${normalized.target}.${targetHandle}`,
    );
  }
}
