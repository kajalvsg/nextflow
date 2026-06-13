import { getExecutableImageUrl } from "@/lib/upload/image-upload";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getImageSource(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/workflow-assets/")
  ) {
    return getExecutableImageUrl(trimmed) ?? trimmed;
  }

  return null;
}

export function getCropOutputImage(output: unknown): {
  src: string;
  width: number | null;
  height: number | null;
} | null {
  if (!isRecord(output)) {
    return null;
  }

  const src = getImageSource(output.output_image);

  if (!src) {
    return null;
  }

  return {
    src,
    width: typeof output.width === "number" ? output.width : null,
    height: typeof output.height === "number" ? output.height : null,
  };
}

export function getCropOutputUrl(output: unknown): string | null {
  if (!isRecord(output) || typeof output.output_image !== "string") {
    return getCropOutputImage(output)?.src ?? null;
  }

  const trimmed = output.output_image.trim();
  return trimmed.length > 0 ? trimmed : null;
}
