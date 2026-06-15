import type { Edge, Node } from "reactflow";
import {
  extractStoredImageReference,
  getExecutableImageUrl,
  logImageResolution,
  normalizeStoredImageUrl,
  resolveExecutableImageReference,
  resolveImageFieldForExecution,
} from "@/lib/upload/image-upload";
import {
  getRequestInputField,
  isRequestInputsImageHandle,
  normalizeRequestInputsConfig,
} from "@/lib/workflow/request-inputs-fields";
import type { NodeOutputMap } from "@/lib/workflow/execution/resolve-inputs";
import type { WorkflowNodeData } from "@/types/workflow-canvas";

export const IMAGE_SOURCE_HANDLES = new Set(["image_field", "output_image"]);

export const CROP_OUTPUT_IMAGE_KEYS = [
  "output_image",
  "outputImage",
  "output-image",
] as const;

export const CROP_IMAGE_INPUT_ERROR =
  "Crop Image requires a connected uploaded image.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSourceNodeType(
  nodes: Node<WorkflowNodeData>[],
  sourceNodeId: string,
): WorkflowNodeData["nodeType"] | null {
  return nodes.find((item) => item.id === sourceNodeId)?.data.nodeType ?? null;
}

export function normalizeImageSourceHandle(
  handleId: string | null | undefined,
): string | null {
  if (typeof handleId !== "string") {
    return null;
  }

  const trimmed = handleId.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed === "output_image" ||
    trimmed === "outputImage" ||
    trimmed === "output-image"
  ) {
    return "output_image";
  }

  return trimmed;
}

export function isOutputImageHandle(
  handleId: string | null | undefined,
): boolean {
  return normalizeImageSourceHandle(handleId) === "output_image";
}

export function isImageSourceHandle(
  handleId: string | null | undefined,
  nodes?: Node<WorkflowNodeData>[],
  sourceNodeId?: string,
): handleId is string {
  if (typeof handleId !== "string") {
    return false;
  }

  if (isOutputImageHandle(handleId)) {
    return true;
  }

  if (nodes && sourceNodeId) {
    const node = nodes.find((item) => item.id === sourceNodeId);

    if (node?.data.nodeType === "requestInputs") {
      const config = normalizeRequestInputsConfig(node.data.config);
      return isRequestInputsImageHandle(config, handleId);
    }

    if (node?.data.nodeType === "cropImage") {
      return false;
    }
  }

  return handleId === "image_field" || handleId.startsWith("image_field_");
}

export function isValidImageUrl(value: unknown): value is string {
  return normalizeImageInputUrl(value) !== null;
}

/** Normalize any supported image reference to a fetchable URL or data URL. */
export function normalizeImageInputUrl(value: unknown): string | null {
  if (typeof value === "string") {
    const stored = normalizeStoredImageUrl(value);

    if (!stored) {
      return null;
    }

    const executable = getExecutableImageUrl(stored);

    if (executable) {
      logImageResolution("input", executable);
      return executable;
    }

    if (stored.startsWith("data:image/")) {
      logImageResolution("input", stored);
      return stored;
    }

    return null;
  }

  const resolved = resolveExecutableImageReference(value, "input");

  return resolved?.url ?? null;
}

function collectImageCandidates(
  sourceOutput: Record<string, unknown>,
  sourceHandle: string,
): string[] {
  const normalizedHandle =
    normalizeImageSourceHandle(sourceHandle) ?? sourceHandle;
  const candidates: unknown[] = [
    sourceOutput[normalizedHandle],
    sourceOutput[sourceHandle],
    sourceOutput.image_field,
    sourceOutput.imageField,
    sourceOutput[`${normalizedHandle}_meta`],
    sourceOutput[`${sourceHandle}_meta`],
    sourceOutput.image_field_meta,
  ];

  for (const [key, value] of Object.entries(sourceOutput)) {
    if (key.endsWith("_meta")) {
      candidates.push(value);
    }
  }

  const urls: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeImageInputUrl(candidate);

    if (normalized) {
      urls.push(normalized);
    }
  }

  return urls;
}

export function readCropOutputImage(
  sourceOutput: Record<string, unknown>,
): string | null {
  for (const key of CROP_OUTPUT_IMAGE_KEYS) {
    const normalized = normalizeImageInputUrl(sourceOutput[key]);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function readImageFromOutputRecord(
  sourceOutput: Record<string, unknown>,
  sourceHandle: string,
): string | null {
  const normalizedHandle =
    normalizeImageSourceHandle(sourceHandle) ?? sourceHandle;

  if (isOutputImageHandle(normalizedHandle)) {
    return readCropOutputImage(sourceOutput);
  }

  const candidates = collectImageCandidates(sourceOutput, sourceHandle);

  return candidates[0] ?? null;
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
  const configRecord: Record<string, unknown> = isRecord(node.data.config)
    ? node.data.config
    : {};
  const dataRecord: Record<string, unknown> = isRecord(node.data)
    ? (node.data as Record<string, unknown>)
    : {};

  const lookupPaths: Array<{ value: unknown; path: string }> = [];

  if (field?.type === "image_field") {
    lookupPaths.push({
      value: field.imageValue,
      path: `fields.${field.id}.imageValue`,
    });
    lookupPaths.push({
      value: field,
      path: `fields.${field.id}`,
    });
  }

  lookupPaths.push(
    {
      value: configRecord[sourceHandle],
      path: `config.${sourceHandle}`,
    },
    {
      value: configRecord[`${sourceHandle}_meta`],
      path: `config.${sourceHandle}_meta`,
    },
    {
      value: dataRecord[sourceHandle],
      path: `data.${sourceHandle}`,
    },
    {
      value: dataRecord[`${sourceHandle}_meta`],
      path: `data.${sourceHandle}_meta`,
    },
  );

  for (const lookup of lookupPaths) {
    const fromField = resolveImageFieldForExecution(
      lookup.value as Parameters<typeof resolveImageFieldForExecution>[0],
    );

    if (fromField) {
      return fromField;
    }

    const resolved = resolveExecutableImageReference(
      lookup.value,
      lookup.path,
    )?.url;

    if (resolved) {
      return resolved;
    }

    const reference = extractStoredImageReference(lookup.value);

    if (reference) {
      const executable = getExecutableImageUrl(reference);

      if (executable) {
        logImageResolution(lookup.path, executable);
        return executable;
      }

      if (reference.startsWith("data:image/")) {
        logImageResolution(lookup.path, reference);
        return reference;
      }
    }
  }

  return null;
}

export function resolveImageValue(
  sourceNodeId: string,
  sourceHandle: string | null | undefined,
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
): string | null {
  const normalizedHandle = normalizeImageSourceHandle(sourceHandle);

  if (!normalizedHandle) {
    return null;
  }

  if (!isImageSourceHandle(normalizedHandle, nodes, sourceNodeId)) {
    return null;
  }

  const sourceNodeType = getSourceNodeType(nodes, sourceNodeId);
  const sourceOutput = outputs.get(sourceNodeId);

  if (sourceNodeType === "requestInputs") {
    const fromConfig = readImageFromNodeConfig(
      sourceNodeId,
      normalizedHandle,
      nodes,
    );

    if (fromConfig) {
      return fromConfig;
    }
  }

  if (sourceNodeType === "cropImage") {
    if (!isOutputImageHandle(normalizedHandle)) {
      return null;
    }

    if (!sourceOutput) {
      return null;
    }

    return readCropOutputImage(sourceOutput);
  }

  if (sourceOutput) {
    const fromOutput = readImageFromOutputRecord(sourceOutput, normalizedHandle);

    if (fromOutput) {
      return fromOutput;
    }
  }

  return readImageFromNodeConfig(sourceNodeId, normalizedHandle, nodes);
}

export function resolveImageInputFromEdge(
  incoming: Edge | undefined,
  outputs: NodeOutputMap,
  nodes?: Node<WorkflowNodeData>[],
): string | null {
  if (!incoming?.source || !incoming.sourceHandle) {
    return null;
  }

  const normalizedHandle = normalizeImageSourceHandle(incoming.sourceHandle);

  if (!normalizedHandle) {
    return null;
  }

  if (!nodes) {
    const sourceOutput = outputs.get(incoming.source);

    if (!sourceOutput) {
      return null;
    }

    if (isOutputImageHandle(normalizedHandle)) {
      return readCropOutputImage(sourceOutput);
    }

    return readImageFromOutputRecord(sourceOutput, normalizedHandle);
  }

  return resolveImageValue(
    incoming.source,
    normalizedHandle,
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
