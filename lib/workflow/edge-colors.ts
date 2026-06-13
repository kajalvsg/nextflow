/**
 * Visual-only edge/handle colors for the workflow canvas (Magica-style).
 * Does not affect execution or persistence semantics.
 */

const TEXT_HANDLES = new Set([
  "text_field",
  "prompt",
  "result",
]);

const IMAGE_HANDLES = new Set([
  "image_field",
  "input_image",
  "image_vision",
  "output_image",
]);

const PINK_HANDLES = new Set(["system_prompt", "response"]);

export const EDGE_COLORS = {
  text: "#f97316",
  image: "#3b82f6",
  pink: "#f472b6",
} as const;

export type EdgeColorKind = keyof typeof EDGE_COLORS;

export function getEdgeColorKind(
  handleId: string | null | undefined,
): EdgeColorKind {
  if (!handleId) {
    return "text";
  }

  if (IMAGE_HANDLES.has(handleId) || handleId.startsWith("image_field")) {
    return "image";
  }

  if (PINK_HANDLES.has(handleId)) {
    return "pink";
  }

  if (TEXT_HANDLES.has(handleId) || handleId.startsWith("text_field")) {
    return "text";
  }

  return "text";
}

export function getEdgeStrokeColor(
  sourceHandle: string | null | undefined,
): string {
  return EDGE_COLORS[getEdgeColorKind(sourceHandle)];
}

export function getHandleColorClass(handleId: string): string {
  switch (getEdgeColorKind(handleId)) {
    case "image":
      return "workflow-handle-image";
    case "pink":
      return "workflow-handle-pink";
    default:
      return "workflow-handle-text";
  }
}
