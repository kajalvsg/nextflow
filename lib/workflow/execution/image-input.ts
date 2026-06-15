import type { Edge, Node } from "reactflow";
import {
  CROP_IMAGE_BLOB_ERROR,
  extractStoredImageReference,
  getExecutableImageUrl,
  normalizeStoredImageUrl,
  recordContainsBlobReference,
  resolveImageFieldForExecution,
  resolveImageSourceWithPriority,
} from "@/lib/upload/image-upload";
import {
  getRequestInputField,
  isRequestInputsImageHandle,
  normalizeRequestInputsConfig,
} from "@/lib/workflow/request-inputs-fields";
import type { ImageFieldState, WorkflowNodeData } from "@/types/workflow-canvas";
import type { NodeOutputMap } from "@/lib/workflow/execution/resolve-inputs";

export const IMAGE_SOURCE_HANDLES = new Set(["image_field", "output_image"]);

export const CROP_OUTPUT_IMAGE_KEYS = [
  "output_image",
  "outputImage",
  "output-image",
] as const;

export const CROP_IMAGE_INPUT_ERROR =
  "Crop Image requires an uploaded image URL.";

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

function resolveCropImageSource(
  connectedInput: unknown,
  connectedMeta: unknown,
  requestInputField: ImageFieldState | null | undefined,
  pathPrefix: string,
): string | null {
  if (recordContainsBlobReference(connectedInput)) {
    throw new Error(CROP_IMAGE_BLOB_ERROR);
  }

  if (recordContainsBlobReference(connectedMeta)) {
    throw new Error(CROP_IMAGE_BLOB_ERROR);
  }

  if (recordContainsBlobReference(requestInputField)) {
    throw new Error(CROP_IMAGE_BLOB_ERROR);
  }

  const fromConnected =
    resolveImageSourceWithPriority(
      connectedInput,
      `${pathPrefix}.connectedInput`,
    ) ??
    resolveImageSourceWithPriority(
      connectedMeta,
      `${pathPrefix}.connectedInput.meta`,
    );

  if (fromConnected) {
    return fromConnected.url;
  }

  const fromField =
    resolveImageSourceWithPriority(
      requestInputField,
      `${pathPrefix}.requestInputField`,
    ) ??
    resolveImageSourceWithPriority(
      requestInputField?.meta,
      `${pathPrefix}.requestInputField.meta`,
    );

  return fromField?.url ?? null;
}

/** Normalize any supported image reference to a fetchable URL or data URL. */
export function normalizeImageInputUrl(value: unknown): string | null {
  if (recordContainsBlobReference(value)) {
    return null;
  }

  if (typeof value === "string") {
    const stored = normalizeStoredImageUrl(value);

    if (!stored) {
      return null;
    }

    return (
      getExecutableImageUrl(stored) ??
      (stored.startsWith("data:image/") ? stored : null)
    );
  }

  return resolveImageSourceWithPriority(value, "input")?.url ?? null;
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
  requestInputField?: ImageFieldState | null,
): string | null {
  const normalizedHandle =
    normalizeImageSourceHandle(sourceHandle) ?? sourceHandle;

  if (isOutputImageHandle(normalizedHandle)) {
    return readCropOutputImage(sourceOutput);
  }

  return resolveCropImageSource(
    sourceOutput[normalizedHandle] ?? sourceOutput[sourceHandle],
    sourceOutput[`${normalizedHandle}_meta`] ??
      sourceOutput[`${sourceHandle}_meta`] ??
      sourceOutput.image_field_meta,
    requestInputField,
    `output.${normalizedHandle}`,
  );
}

function readImageFromNodeConfig(
  sourceNodeId: string,
  sourceHandle: string,
  nodes: Node<WorkflowNodeData>[],
  sourceOutput?: Record<string, unknown>,
): string | null {
  const node = nodes.find((item) => item.id === sourceNodeId);

  if (!node || node.data.nodeType !== "requestInputs") {
    return null;
  }

  const config = normalizeRequestInputsConfig(node.data.config);
  const field = getRequestInputField(config, sourceHandle);
  const requestInputField =
    field?.type === "image_field" ? field.imageValue : undefined;

  if (sourceOutput) {
    const fromOutput = readImageFromOutputRecord(
      sourceOutput,
      sourceHandle,
      requestInputField,
    );

    if (fromOutput) {
      return fromOutput;
    }
  }

  if (requestInputField) {
    const fromField = resolveImageFieldForExecution(requestInputField);

    if (fromField) {
      return fromField;
    }
  }

  const configRecord: Record<string, unknown> = isRecord(node.data.config)
    ? node.data.config
    : {};

  const fromConfigMeta = resolveImageSourceWithPriority(
    configRecord[`${sourceHandle}_meta`],
    `config.${sourceHandle}_meta`,
  )?.url;

  if (fromConfigMeta) {
    return fromConfigMeta;
  }

  const reference = extractStoredImageReference(configRecord[sourceHandle]);

  if (reference) {
    return (
      getExecutableImageUrl(reference) ??
      (reference.startsWith("data:image/") ? reference : null)
    );
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

  if (sourceNodeType === "cropImage") {
    if (!isOutputImageHandle(normalizedHandle)) {
      return null;
    }

    if (!sourceOutput) {
      return null;
    }

    return readCropOutputImage(sourceOutput);
  }

  if (sourceNodeType === "requestInputs") {
    return readImageFromNodeConfig(
      sourceNodeId,
      normalizedHandle,
      nodes,
      sourceOutput,
    );
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
  if (recordContainsBlobReference(inputImage)) {
    throw new Error(CROP_IMAGE_BLOB_ERROR);
  }

  if (!normalizeImageInputUrl(inputImage)) {
    throw new Error(CROP_IMAGE_INPUT_ERROR);
  }
}

export function requireCropImageInputUrl(inputImage: unknown): string {
  if (recordContainsBlobReference(inputImage)) {
    throw new Error(CROP_IMAGE_BLOB_ERROR);
  }

  const normalized = normalizeImageInputUrl(inputImage);

  if (!normalized) {
    throw new Error(CROP_IMAGE_INPUT_ERROR);
  }

  return normalized;
}
