import { getExecutableImageUrl } from "@/lib/upload/image-upload";
import { CROP_OUTPUT_IMAGE_KEYS } from "@/lib/workflow/execution/image-input";

export type CropExecutionOutput = {
  output_image: string;
  outputImage: string;
  dataUrl: string | null;
  fileUrl: string | null;
  width: number | null;
  height: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readImageReference(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveCropImageUrl(output: Record<string, unknown>): string | null {
  for (const key of CROP_OUTPUT_IMAGE_KEYS) {
    const candidate = readImageReference(output[key]);

    if (candidate) {
      return candidate;
    }
  }

  return (
    readImageReference(output.dataUrl) ??
    readImageReference(output.fileUrl) ??
    readImageReference(output.value)
  );
}

/** Normalize crop execution/history output into the keys the canvas reads. */
export function normalizeCropExecutionOutput(
  output: unknown,
): CropExecutionOutput | null {
  if (!isRecord(output)) {
    return null;
  }

  const imageUrl = resolveCropImageUrl(output);

  if (!imageUrl) {
    return null;
  }

  const executableUrl = getExecutableImageUrl(imageUrl) ?? imageUrl;

  return {
    output_image: executableUrl,
    outputImage: executableUrl,
    dataUrl: executableUrl.startsWith("data:") ? executableUrl : null,
    fileUrl:
      executableUrl.startsWith("http://") ||
      executableUrl.startsWith("https://") ||
      executableUrl.startsWith("/workflow-assets/")
        ? executableUrl
        : null,
    width: typeof output.width === "number" ? output.width : null,
    height: typeof output.height === "number" ? output.height : null,
  };
}
