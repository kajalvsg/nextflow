import { uploadWorkflowImageAction } from "@/actions/workflow-images";
import { uploadImageViaTransloadit } from "@/lib/upload/transloadit-client";
import type { ImageFieldState } from "@/types/workflow-canvas";

export type ImageUploadResult = {
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  size?: number | null;
};

export type ImageUploadOptions = {
  onProgress?: (percent: number) => void;
};

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
]);

export function validateWorkflowImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      return "Please upload a JPG, PNG, WebP, or GIF image.";
    }
  }

  if (file.size > 8 * 1024 * 1024) {
    return "Image must be 8MB or smaller.";
  }

  return null;
}

export function isTransloaditConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY);
}

/**
 * Upload a workflow image via Transloadit when configured, otherwise local storage.
 */
export async function uploadWorkflowImage(
  file: File,
  workflowId: string,
  options?: ImageUploadOptions,
): Promise<ImageUploadResult> {
  if (isTransloaditConfigured()) {
    return uploadImageViaTransloadit(file, options);
  }

  const formData = new FormData();
  formData.append("file", file);

  const result = await uploadWorkflowImageAction(workflowId, formData);

  return {
    ...result,
    mimeType: file.type || null,
    size: file.size,
  };
}

function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const vercelUrl =
    process.env.VERCEL_URL?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim();

  if (vercelUrl) {
    const normalized = vercelUrl.replace(/\/$/, "");
    return normalized.startsWith("http") ? normalized : `https://${normalized}`;
  }

  return "http://localhost:3000";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Pull a stored image reference from strings or nested upload metadata. */
export function extractStoredImageReference(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeStoredImageUrl(value);
  }

  if (!isRecord(value)) {
    return null;
  }

  const directKeys = [
    "fileUrl",
    "url",
    "previewUrl",
    "imageUrl",
    "image_field",
    "imageField",
    "value",
  ] as const;

  for (const key of directKeys) {
    const candidate = value[key];

    if (typeof candidate === "string") {
      const normalized = normalizeStoredImageUrl(candidate);

      if (normalized) {
        return normalized;
      }
    }

    if (isRecord(candidate)) {
      const nested = extractStoredImageReference(candidate);

      if (nested) {
        return nested;
      }
    }
  }

  if (isRecord(value.imageValue)) {
    return extractStoredImageReference(value.imageValue);
  }

  return null;
}

/** Canonical stored reference for workflow asset uploads. */
export function toWorkflowAssetPath(fileName: string): string {
  return `/workflow-assets/${fileName}`;
}

/** Normalize persisted image references to a stable stored form. */
export function normalizeStoredImageUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.startsWith("blob:")) {
    return null;
  }

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  const assetMatch = trimmed.match(/\/workflow-assets\/[^?#]+/);

  if (assetMatch) {
    return assetMatch[0];
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/workflow-assets/") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }

  return trimmed;
}

export function getExecutableImageUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${getAppBaseUrl()}${trimmed}`;
  }

  return null;
}

export function resolveImageFieldForExecution(
  imageValue: ImageFieldState | null | undefined,
): string | null {
  const reference = extractStoredImageReference(imageValue);

  if (!reference) {
    return null;
  }

  return getExecutableImageUrl(reference) ?? reference;
}

export function getImagePreviewUrl(
  imageValue: ImageFieldState | null | undefined,
): string | null {
  const reference = extractStoredImageReference(imageValue);

  if (!reference) {
    return null;
  }

  if (reference.startsWith("blob:") || reference.startsWith("data:image/")) {
    return reference;
  }

  return getExecutableImageUrl(reference) ?? reference;
}

export function isExecutableImageUrl(value: string | null | undefined): boolean {
  return getExecutableImageUrl(normalizeStoredImageUrl(value)) !== null;
}

export function needsImageReupload(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}
