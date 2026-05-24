import type { Edge } from "reactflow";
import type { NodeOutputMap } from "@/lib/workflow/execution/resolve-inputs";

/** Source handles that may supply image data to image inputs. */
export const IMAGE_SOURCE_HANDLES = new Set(["image_field", "output_image"]);

export const CROP_IMAGE_INPUT_ERROR =
  "Crop Image requires an uploaded image URL.";

export function isImageSourceHandle(
  handleId: string | null | undefined,
): handleId is string {
  return typeof handleId === "string" && IMAGE_SOURCE_HANDLES.has(handleId);
}

export function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("data:image/")) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveImageInputFromEdge(
  incoming: Edge | undefined,
  outputs: NodeOutputMap,
): string | null {
  if (!incoming?.sourceHandle) {
    return null;
  }

  if (!isImageSourceHandle(incoming.sourceHandle)) {
    return null;
  }

  const sourceOutput = outputs.get(incoming.source);

  if (!sourceOutput) {
    return null;
  }

  const value = sourceOutput[incoming.sourceHandle];

  if (!isValidImageUrl(value)) {
    return null;
  }

  return value.trim();
}

export function assertCropImageInputUrl(
  inputImage: unknown,
): asserts inputImage is string {
  if (!isValidImageUrl(inputImage)) {
    throw new Error(CROP_IMAGE_INPUT_ERROR);
  }
}
