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

export type ImageReferenceSource = {
  reference: string;
  path: string;
};

export type ResolvedImageSourceType =
  | "dataUrl"
  | "absoluteUrl"
  | "relativeUrl"
  | "missing"
  | "other";

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

/** Max size for embedding a data URL in saved workflow node data. */
const MAX_DATA_URL_PERSIST_BYTES = 2 * 1024 * 1024;

const STORED_IMAGE_KEYS = [
  "executionUrl",
  "fileUrl",
  "url",
  "previewUrl",
  "imageUrl",
  "publicUrl",
  "dataUrl",
  "image_field",
  "imageField",
  "value",
] as const;

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
  return Boolean(process.env.NEXT_PUBLIC_TRANSLOADIT_AUTH_KEY?.trim());
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
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();

    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.replace(/\/$/, "");
    return normalized.startsWith("http")
      ? normalized
      : `https://${normalized}`;
  }

  return "http://localhost:3000";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function classifyImageReference(
  reference: string | null | undefined,
): ResolvedImageSourceType {
  if (!reference) {
    return "missing";
  }

  if (reference.startsWith("data:image/")) {
    return "dataUrl";
  }

  if (reference.startsWith("http://") || reference.startsWith("https://")) {
    return "absoluteUrl";
  }

  if (reference.startsWith("/")) {
    return "relativeUrl";
  }

  return "other";
}

export function logImageResolution(path: string, reference: string | null): void {
  const type = classifyImageReference(reference);

  if (process.env.NODE_ENV === "development") {
    console.info(`[image-input] ${path} -> ${type}`);
    return;
  }

  if (type === "missing") {
    console.info(`[image-input] ${path} -> missing`);
  }
}

/** Pull a stored image reference from strings or nested upload metadata. */
export function extractStoredImageReferenceWithSource(
  value: unknown,
  pathPrefix = "value",
): ImageReferenceSource | null {
  if (typeof value === "string") {
    const normalized = normalizeStoredImageUrl(value);

    return normalized ? { reference: normalized, path: pathPrefix } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of STORED_IMAGE_KEYS) {
    const candidate = value[key];

    if (typeof candidate === "string") {
      const normalized = normalizeStoredImageUrl(candidate);

      if (normalized) {
        return { reference: normalized, path: `${pathPrefix}.${key}` };
      }
    }
  }

  if (isRecord(value.meta)) {
    const fromMeta = extractStoredImageReferenceWithSource(
      value.meta,
      `${pathPrefix}.meta`,
    );

    if (fromMeta) {
      return fromMeta;
    }
  }

  for (const [key, candidate] of Object.entries(value)) {
    if (!key.endsWith("_meta")) {
      continue;
    }

    const fromMetaKey = extractStoredImageReferenceWithSource(
      candidate,
      `${pathPrefix}.${key}`,
    );

    if (fromMetaKey) {
      return fromMetaKey;
    }
  }

  if (isRecord(value.imageValue)) {
    const fromImageValue = extractStoredImageReferenceWithSource(
      value.imageValue,
      `${pathPrefix}.imageValue`,
    );

    if (fromImageValue) {
      return fromImageValue;
    }
  }

  for (const key of STORED_IMAGE_KEYS) {
    const candidate = value[key];

    if (!isRecord(candidate)) {
      continue;
    }

    const nested = extractStoredImageReferenceWithSource(
      candidate,
      `${pathPrefix}.${key}`,
    );

    if (nested) {
      return nested;
    }
  }

  return null;
}

/** Pull a stored image reference from strings or nested upload metadata. */
export function extractStoredImageReference(value: unknown): string | null {
  return extractStoredImageReferenceWithSource(value)?.reference ?? null;
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
    trimmed.startsWith("//") ||
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

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${getAppBaseUrl()}${trimmed}`;
  }

  return null;
}

export function resolveExecutableImageReference(
  value: unknown,
  pathPrefix = "value",
): { url: string; path: string; type: ResolvedImageSourceType } | null {
  const sourced = extractStoredImageReferenceWithSource(value, pathPrefix);

  if (!sourced) {
    logImageResolution(pathPrefix, null);
    return null;
  }

  const executable =
    getExecutableImageUrl(sourced.reference) ??
    (sourced.reference.startsWith("data:image/") ? sourced.reference : null);

  if (!executable) {
    logImageResolution(sourced.path, sourced.reference);
    return null;
  }

  const type = classifyImageReference(executable);
  logImageResolution(sourced.path, executable);

  return {
    url: executable,
    path: sourced.path,
    type,
  };
}

export function resolveImageFieldForExecution(
  imageValue: ImageFieldState | null | undefined,
): string | null {
  return (
    resolveExecutableImageReference(imageValue, "imageValue")?.url ?? null
  );
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

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read image file."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read image file."));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Build persisted image field state with an execution-ready reference.
 * Relative local uploads also store a data URL when small enough for serverless execution.
 */
export async function buildImageFieldFromUpload(
  file: File,
  result: ImageUploadResult,
): Promise<ImageFieldState> {
  const fileUrl = normalizeStoredImageUrl(result.fileUrl) ?? result.fileUrl;
  let executionUrl = getExecutableImageUrl(fileUrl);

  const shouldPersistDataUrl =
    !executionUrl ||
    fileUrl.startsWith("/workflow-assets/") ||
    (!isTransloaditConfigured() && fileUrl.startsWith("/"));

  if (shouldPersistDataUrl && file.size <= MAX_DATA_URL_PERSIST_BYTES) {
    try {
      executionUrl = await readFileAsDataUrl(file);
    } catch {
      // Fall back to the stored path or absolute URL below.
    }
  }

  if (!executionUrl) {
    executionUrl = getExecutableImageUrl(fileUrl) ?? fileUrl;
  }

  return {
    fileName: result.fileName,
    fileUrl,
    executionUrl,
    mimeType: result.mimeType ?? file.type ?? null,
    size: result.size ?? file.size,
  };
}
