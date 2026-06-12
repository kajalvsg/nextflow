/**
 * Visual-only edge/handle colors for the workflow canvas (Magica-style).
 * Does not affect execution or persistence semantics.
 */

const TEXT_HANDLES = new Set([
  "text_field",
  "prompt",
  "system_prompt",
  "response",
  "result",
]);

const IMAGE_HANDLES = new Set([
  "image_field",
  "input_image",
  "image_vision",
  "output_image",
]);

export const EDGE_COLORS = {
  text: "#f97316",
  image: "#3b82f6",
  default: "#22c55e",
} as const;

export function getEdgeStrokeColor(
  sourceHandle: string | null | undefined,
): string {
  if (!sourceHandle) {
    return EDGE_COLORS.default;
  }

  if (TEXT_HANDLES.has(sourceHandle)) {
    return EDGE_COLORS.text;
  }

  if (IMAGE_HANDLES.has(sourceHandle)) {
    return EDGE_COLORS.image;
  }

  return EDGE_COLORS.default;
}

export function getHandleColorClass(handleId: string): string {
  if (TEXT_HANDLES.has(handleId)) {
    return "workflow-handle-text";
  }

  if (IMAGE_HANDLES.has(handleId)) {
    return "workflow-handle-image";
  }

  return "workflow-handle-default";
}
