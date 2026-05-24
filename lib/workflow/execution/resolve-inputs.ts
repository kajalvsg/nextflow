import type { Edge, Node } from "reactflow";
import { getExecutableImageUrl } from "@/lib/upload/image-upload";
import { normalizeEdgeForResolution } from "@/lib/workflow/execution/edge-handles";
import {
  resolveImageInputFromEdge,
} from "@/lib/workflow/execution/image-input";
import type {
  CropImageConfig,
  GeminiProConfig,
  RequestInputsConfig,
  WorkflowNodeData,
} from "@/types/workflow-canvas";

export type NodeOutputMap = Map<string, Record<string, unknown>>;

export function resolveRequestInputsOutput(
  node: Node<WorkflowNodeData>,
): Record<string, unknown> {
  const config = node.data.config as RequestInputsConfig;
  const executableImageUrl = getExecutableImageUrl(config.imageField.fileUrl);

  return {
    text_field: config.textField,
    image_field: executableImageUrl,
    image_field_meta: {
      fileName: config.imageField.fileName,
      fileUrl: config.imageField.fileUrl,
      mimeType: config.imageField.mimeType,
      size: config.imageField.size,
    },
  };
}

function getIncomingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((edge) => edge.target === nodeId);
}

function resolveHandleValue(
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

export function resolveCropImageInput(
  nodeId: string,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): Record<string, unknown> {
  const incoming = getIncomingEdges(nodeId, edges)
    .map((edge) => normalizeEdgeForResolution(edge, nodes))
    .find((edge) => edge.targetHandle === "input_image");

  const imageUrl = resolveImageInputFromEdge(incoming, outputs);

  return { input_image: imageUrl };
}

export function resolveGeminiInput(
  nodeId: string,
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): Record<string, unknown> {
  const incoming = getIncomingEdges(nodeId, edges).map((edge) =>
    normalizeEdgeForResolution(edge, nodes),
  );
  const promptEdge = incoming.find((edge) => edge.targetHandle === "prompt");
  const systemEdge = incoming.find(
    (edge) => edge.targetHandle === "system_prompt",
  );
  const visionEdge = incoming.find(
    (edge) => edge.targetHandle === "image_vision",
  );

  return {
    prompt: promptEdge
      ? resolveHandleValue(promptEdge.source, promptEdge.sourceHandle, outputs)
      : "",
    system_prompt: systemEdge
      ? resolveHandleValue(systemEdge.source, systemEdge.sourceHandle, outputs)
      : "",
    image_vision: resolveImageInputFromEdge(visionEdge, outputs),
  };
}

export function resolveResponseInput(
  edges: Edge[],
  outputs: NodeOutputMap,
): Record<string, unknown> {
  const incoming = edges.find((edge) => edge.target === "response");

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
      return resolveResponseInput(edges, outputs);
    default:
      return {};
  }
}
