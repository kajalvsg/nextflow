import type { Edge, Node } from "reactflow";
import { getExecutableImageUrl } from "@/lib/upload/image-upload";
import {
  getRequestInputField,
  isRequestInputsImageHandle,
  normalizeRequestInputsConfig,
} from "@/lib/workflow/request-inputs-fields";
import type { NodeOutputMap } from "@/lib/workflow/execution/resolve-inputs";
import type { WorkflowNodeData } from "@/types/workflow-canvas";

export const IMAGE_SOURCE_HANDLES = new Set(["image_field", "output_image"]);

export const CROP_IMAGE_INPUT_ERROR =
  "Crop Image requires a valid uploaded image or image URL.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isImageSourceHandle(
  handleId: string | null | undefined,
  nodes?: Node<WorkflowNodeData>[],
  sourceNodeId?: string,
): handleId is string {
  if (typeof handleId !== "string") {
    return false;
  }

  if (handleId === "output_image") {
    return true;
  }

  if (nodes && sourceNodeId) {
    const node = nodes.find((item) => item.id === sourceNodeId);

    if (node?.data.nodeType === "requestInputs") {
      const config = normalizeRequestInputsConfig(node.data.config);
      return isRequestInputsImageHandle(config, handleId);
    }
  }

  return handleId === "image_field" || handleId.startsWith("image_field_");
}

export function isValidImageUrl(value: unknown): value is string {
  return normalizeImageInputUrl(value) !== null;
}

/** Normalize any supported image reference to a fetchable URL or data URL. */
export function normalizeImageInputUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const executable = getExecutableImageUrl(trimmed);

  if (executable) {
    return executable;
  }

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  if (trimmed.startsWith("/workflow-assets/")) {
    return getExecutableImageUrl(trimmed);
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}

function readImageFromOutputRecord(
  sourceOutput: Record<string, unknown>,
  sourceHandle: string,
): string | null {
  const direct = normalizeImageInputUrl(sourceOutput[sourceHandle]);

  if (direct) {
    return direct;
  }

  const meta = sourceOutput[`${sourceHandle}_meta`];

  if (isRecord(meta)) {
    const fromMeta = normalizeImageInputUrl(meta.fileUrl);

    if (fromMeta) {
      return fromMeta;
    }
  }

  return null;
}

function readImageFromNodeConfig(
  sourceNodeId: string,
  sourceHandle: string,
  nodes: Node<WorkflowNodeData>[],
): string | null {
  const node = nodes.find((item) => item.id === sourceNodeId);

  if (!node || node.data.nodeType !== "requestInputs") {
    return null;
  }

  const config = normalizeRequestInputsConfig(node.data.config);
  const field = getRequestInputField(config, sourceHandle);

  if (!field || field.type !== "image_field") {
    return null;
  }

  return normalizeImageInputUrl(field.imageValue?.fileUrl ?? null);
}

export function resolveImageValue(
  sourceNodeId: string,
  sourceHandle: string | null | undefined,
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): string | null {
  if (!sourceHandle) {
    return null;
  }

  if (!isImageSourceHandle(sourceHandle, nodes, sourceNodeId)) {
    return null;
  }

  const sourceOutput = outputs.get(sourceNodeId);

  if (sourceOutput) {
    const fromOutput = readImageFromOutputRecord(sourceOutput, sourceHandle);

    if (fromOutput) {
      return fromOutput;
    }
  }

  return readImageFromNodeConfig(sourceNodeId, sourceHandle, nodes);
}

export function resolveImageInputFromEdge(
  incoming: Edge | undefined,
  outputs: NodeOutputMap,
  nodes?: Node<WorkflowNodeData>[],
): string | null {
  if (!incoming?.source || !incoming.sourceHandle) {
    return null;
  }

  if (!nodes) {
    const sourceOutput = outputs.get(incoming.source);

    if (!sourceOutput) {
      return null;
    }

    return readImageFromOutputRecord(sourceOutput, incoming.sourceHandle);
  }

  return resolveImageValue(
    incoming.source,
    incoming.sourceHandle,
    outputs,
    nodes,
  );
}

export function assertCropImageInputUrl(
  inputImage: unknown,
): asserts inputImage is string {
  if (!normalizeImageInputUrl(inputImage)) {
    throw new Error(CROP_IMAGE_INPUT_ERROR);
  }
}

export function requireCropImageInputUrl(inputImage: unknown): string {
  const normalized = normalizeImageInputUrl(inputImage);

  if (!normalized) {
    throw new Error(CROP_IMAGE_INPUT_ERROR);
  }

  return normalized;
}
