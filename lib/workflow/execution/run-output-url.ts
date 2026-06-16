import { getDisplayImageUrl } from "@/lib/upload/image-upload";

const RUN_OUTPUT_API_PATTERN = /^\/api\/run-outputs\/([^/?#]+)$/i;

/** Absolute filesystem path for a compacted crop output JPEG. */
export function getRunOutputFileName(executionId: string, suffix = ""): string {
  return `${executionId}${suffix}.jpg`;
}

/** Browser URL that serves the output via the Next.js API (same origin). */
export function getRunOutputPublicUrl(executionId: string): string {
  return `/api/run-outputs/${executionId}`;
}

/** Extract execution id from stored output references. */
export function parseRunOutputExecutionId(reference: string): string | null {
  const trimmed = reference.trim();

  const apiMatch = trimmed.match(RUN_OUTPUT_API_PATTERN);

  if (apiMatch?.[1]) {
    return apiMatch[1];
  }

  const assetMatch = trimmed.match(/\/workflow-assets\/run-outputs\/([^/?#]+)\.jpg$/i);

  if (assetMatch?.[1]) {
    return assetMatch[1].replace(/-input$/, "");
  }

  return null;
}

/** Normalize stored crop output URLs for canvas/history display. */
export function resolveRunOutputDisplayUrl(
  reference: string | null | undefined,
): string | null {
  if (typeof reference !== "string") {
    return null;
  }

  const trimmed = reference.trim();

  if (!trimmed) {
    return null;
  }

  const executionId = parseRunOutputExecutionId(trimmed);

  if (executionId) {
    return getRunOutputPublicUrl(executionId);
  }

  return getDisplayImageUrl(trimmed);
}
