import { uploadWorkflowImageAction } from "@/actions/workflow-images";
import { uploadImageViaTransloadit } from "@/lib/upload/transloadit-client";
import type {
  ImageExecutionOutput,
  ImageFieldState,
} from "@/types/workflow-canvas";

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
  | "blob"
  | "other";

export type CropImageSourceKind =
  | "dataUrl"
  | "http"
  | "relative"
  | "blob"
  | "missing";

export const CROP_IMAGE_BLOB_ERROR =
  "Crop Image cannot use a browser-only blob URL. Re-upload the image and save the workflow.";

const STORED_IMAGE_KEYS = [
  "dataUrl",
  "fileUrl",
  "value",
  "executionUrl",
  "url",
  "previewUrl",
  "imageUrl",
  "publicUrl",
  "image_field",
  "imageField",
] as const;

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

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isBlobReference(value: string): boolean {
  return value.startsWith("blob:");
}

function isDataImageReference(value: string): boolean {
  return value.startsWith("data:image/");
}

function isHttpReference(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//")
  );
}

export function classifyImageReference(
  reference: string | null | undefined,
): ResolvedImageSourceType {
  if (!reference) {
    return "missing";
  }

  if (reference.startsWith("blob:")) {
    return "blob";
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

export function classifyCropImageSource(
  reference: string | null | undefined,
): CropImageSourceKind {
  const type = classifyImageReference(reference);

  switch (type) {
    case "dataUrl":
      return "dataUrl";
    case "absoluteUrl":
      return "http";
    case "relativeUrl":
      return "relative";
    case "blob":
      return "blob";
    case "missing":
      return "missing";
    default:
      return "missing";
  }
}

export function logCropImageSource(
  kind: CropImageSourceKind,
  path?: string,
): void {
  const typeLabel = kind === "http" ? "http" : kind;
  console.info(
    `crop image resolved source type: ${typeLabel}${path ? `, path: ${path}` : ""}`,
  );
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

  if (!trimmed || trimmed.startsWith("blob:")) {
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

export function recordContainsBlobReference(value: unknown): boolean {
  if (typeof value === "string") {
    return value.startsWith("blob:");
  }

  if (!isRecord(value)) {
    return false;
  }

  for (const candidate of Object.values(value)) {
    if (recordContainsBlobReference(candidate)) {
      return true;
    }
  }

  return false;
}

function toExecutableReference(
  raw: string | null | undefined,
): string | null {
  const normalized = normalizeStoredImageUrl(raw);

  if (!normalized) {
    return null;
  }

  return getExecutableImageUrl(normalized) ?? normalized;
}

/**
 * Resolve an image source using the crop execution priority order.
 */
export function resolveImageSourceWithPriority(
  record: unknown,
  pathPrefix: string,
): { url: string; kind: CropImageSourceKind; path: string } | null {
  if (recordContainsBlobReference(record)) {
    logCropImageSource("blob", `${pathPrefix}.*`);
    return null;
  }

  if (typeof record === "string") {
    const normalized = normalizeStoredImageUrl(record);

    if (!normalized) {
      logCropImageSource("missing", pathPrefix);
      return null;
    }

    const executable = toExecutableReference(normalized);

    if (!executable) {
      logCropImageSource("missing", pathPrefix);
      return null;
    }

    const kind = classifyCropImageSource(executable);
    logCropImageSource(kind, pathPrefix);
    return { url: executable, kind, path: pathPrefix };
  }

  if (!isRecord(record)) {
    logCropImageSource("missing", pathPrefix);
    return null;
  }

  const meta = isRecord(record.meta) ? record.meta : null;

  const checks: Array<{ path: string; raw: string | null }> = [
    { path: `${pathPrefix}.dataUrl`, raw: readTrimmedString(record.dataUrl) },
    { path: `${pathPrefix}.fileUrl`, raw: readTrimmedString(record.fileUrl) },
    {
      path: `${pathPrefix}.value`,
      raw: (() => {
        const value = readTrimmedString(record.value);
        return value && isDataImageReference(value) ? value : null;
      })(),
    },
    {
      path: `${pathPrefix}.value`,
      raw: (() => {
        const value = readTrimmedString(record.value);
        return value && isHttpReference(value) ? value : null;
      })(),
    },
    {
      path: `${pathPrefix}.meta.dataUrl`,
      raw: meta ? readTrimmedString(meta.dataUrl) : null,
    },
    {
      path: `${pathPrefix}.meta.fileUrl`,
      raw: meta ? readTrimmedString(meta.fileUrl) : null,
    },
    {
      path: `${pathPrefix}.executionUrl`,
      raw: readTrimmedString(record.executionUrl),
    },
    {
      path: `${pathPrefix}.value`,
      raw: (() => {
        const value = readTrimmedString(record.value);
        return value && value.startsWith("/") ? value : null;
      })(),
    },
  ];

  for (const check of checks) {
    if (!check.raw) {
      continue;
    }

    const executable = toExecutableReference(check.raw);

    if (!executable) {
      continue;
    }

    const kind = classifyCropImageSource(executable);
    logCropImageSource(kind, check.path);
    return { url: executable, kind, path: check.path };
  }

  logCropImageSource("missing", pathPrefix);
  return null;
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

export function resolveExecutableImageReference(
  value: unknown,
  pathPrefix = "value",
): { url: string; path: string; type: ResolvedImageSourceType } | null {
  const resolved = resolveImageSourceWithPriority(value, pathPrefix);

  if (!resolved) {
    return null;
  }

  return {
    url: resolved.url,
    path: resolved.path,
    type:
      resolved.kind === "http"
        ? "absoluteUrl"
        : resolved.kind === "relative"
          ? "relativeUrl"
          : resolved.kind,
  };
}

export function resolveImageFieldForExecution(
  imageValue: ImageFieldState | null | undefined,
): string | null {
  return (
    resolveImageSourceWithPriority(imageValue, "requestInputField")?.url ??
    resolveImageSourceWithPriority(imageValue?.meta, "requestInputField.meta")
      ?.url ??
    null
  );
}

export function toImageExecutionOutput(
  state: ImageFieldState,
): ImageExecutionOutput {
  const dataUrl =
    (state.dataUrl && isDataImageReference(state.dataUrl)
      ? state.dataUrl
      : null) ??
    (state.value && isDataImageReference(state.value) ? state.value : null) ??
    (state.meta?.dataUrl && isDataImageReference(state.meta.dataUrl)
      ? state.meta.dataUrl
      : null) ??
    null;

  const fileUrl = state.fileUrl ?? state.meta?.fileUrl ?? null;
  const value =
    dataUrl ??
    state.value ??
    state.executionUrl ??
    getExecutableImageUrl(fileUrl) ??
    fileUrl;

  return {
    dataUrl,
    fileUrl,
    value,
    meta: {
      fileUrl,
      dataUrl,
      fileName: state.fileName ?? state.meta?.fileName ?? null,
      mimeType: state.mimeType ?? state.meta?.mimeType ?? null,
    },
  };
}

export function getImagePreviewUrl(
  imageValue: ImageFieldState | null | undefined,
): string | null {
  const preview =
    imageValue?.dataUrl ??
    imageValue?.value ??
    imageValue?.executionUrl ??
    imageValue?.fileUrl ??
    imageValue?.meta?.dataUrl ??
    imageValue?.meta?.fileUrl ??
    null;

  if (!preview) {
    return null;
  }

  if (preview.startsWith("blob:") || preview.startsWith("data:image/")) {
    return preview;
  }

  return getExecutableImageUrl(preview) ?? preview;
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
 * Build persisted image field state. Always stores a FileReader data URL for execution.
 */
export async function buildImageFieldFromFile(
  file: File,
  dataUrl: string,
  uploadResult?: ImageUploadResult | null,
): Promise<ImageFieldState> {
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("Failed to read image as data URL.");
  }

  const fileUrl = uploadResult
    ? normalizeStoredImageUrl(uploadResult.fileUrl) ?? uploadResult.fileUrl
    : null;

  return {
    fileName: file.name,
    fileUrl: fileUrl && !fileUrl.startsWith("blob:") ? fileUrl : null,
    dataUrl,
    value: dataUrl,
    executionUrl: dataUrl,
    meta: {
      dataUrl,
      fileUrl: fileUrl && !fileUrl.startsWith("blob:") ? fileUrl : null,
      fileName: file.name,
      mimeType: file.type || null,
    },
    mimeType: file.type || null,
    size: file.size,
  };
}

/**
 * @deprecated Use buildImageFieldFromFile after readFileAsDataURL.
 */
export async function buildImageFieldFromUpload(
  file: File,
  result: ImageUploadResult,
): Promise<ImageFieldState> {
  const dataUrl = await readFileAsDataUrl(file);
  return buildImageFieldFromFile(file, dataUrl, result);
}
