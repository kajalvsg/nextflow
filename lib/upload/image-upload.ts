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

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
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
    trimmed.startsWith("/workflow-assets/")
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

  if (trimmed.startsWith("/workflow-assets/")) {
    return `${getAppBaseUrl()}${trimmed}`;
  }

  return null;
}

export function getImagePreviewUrl(
  imageValue: ImageFieldState | null | undefined,
): string | null {
  const fileUrl = imageValue?.fileUrl?.trim();

  if (!fileUrl) {
    return null;
  }

  if (fileUrl.startsWith("blob:") || fileUrl.startsWith("data:image/")) {
    return fileUrl;
  }

  return getExecutableImageUrl(fileUrl) ?? fileUrl;
}

export function resolveImageFieldForExecution(
  imageValue: ImageFieldState | null | undefined,
): string | null {
  const fileUrl = normalizeStoredImageUrl(imageValue?.fileUrl ?? null);

  if (!fileUrl) {
    return null;
  }

  return getExecutableImageUrl(fileUrl);
}

export function isExecutableImageUrl(value: string | null | undefined): boolean {
  return getExecutableImageUrl(normalizeStoredImageUrl(value)) !== null;
}

export function needsImageReupload(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}
