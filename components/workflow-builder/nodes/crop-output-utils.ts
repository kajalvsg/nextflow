import { getExecutableImageUrl } from "@/lib/upload/image-upload";
import { normalizeCropExecutionOutput } from "@/lib/workflow/execution/crop-output-normalize";

export { normalizeCropExecutionOutput } from "@/lib/workflow/execution/crop-output-normalize";
export type { CropExecutionOutput } from "@/lib/workflow/execution/crop-output-normalize";

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
  const normalized = normalizeCropExecutionOutput(output);

  if (!normalized) {
    return null;
  }

  const src = getImageSource(normalized.output_image);

  if (!src) {
    return null;
  }

  return {
    src,
    width: normalized.width,
    height: normalized.height,
  };
}

/** Resolve crop preview from execution output or flat node.data keys. */
export function getCropOutputImageFromNodeData(data: {
  outputs?: unknown;
  outputImage?: string;
  output_image?: string;
  dataUrl?: string | null;
}): ReturnType<typeof getCropOutputImage> {
  return (
    getCropOutputImage(data.outputs) ??
    getCropOutputImage({
      output_image: data.output_image,
      outputImage: data.outputImage,
      dataUrl: data.dataUrl,
    })
  );
}

export function getCropOutputUrl(output: unknown): string | null {
  return normalizeCropExecutionOutput(output)?.output_image ?? null;
}
