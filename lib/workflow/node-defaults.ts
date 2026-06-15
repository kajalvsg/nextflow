import {
  extractStoredImageReferenceWithSource,
  getExecutableImageUrl,
  normalizeStoredImageUrl,
  toImageExecutionOutput,
} from "@/lib/upload/image-upload";
import { defaultRequestInputsConfig } from "@/lib/workflow/request-inputs-fields";
import type {
  CropImageConfig,
  GeminiProConfig,
  ImageFieldState,
  RequestInputsConfig,
  ResponseConfig,
  WorkflowNodeType,
} from "@/types/workflow-canvas";

export function defaultImageFieldState(): ImageFieldState {
  return {
    fileName: null,
    fileUrl: null,
    dataUrl: null,
    value: null,
    executionUrl: null,
    meta: {
      fileUrl: null,
      dataUrl: null,
    },
    mimeType: null,
    size: null,
  };
}

/** Persist server-usable image references; strip UI-only/blob values from stored graphs. */
export function serializeImageFieldState(
  value: Partial<ImageFieldState> & Record<string, unknown>,
): ImageFieldState {
  if (
    typeof value.fileUrl === "string" &&
    value.fileUrl.trim().startsWith("blob:")
  ) {
    return defaultImageFieldState();
  }

  if (
    typeof value.dataUrl === "string" &&
    value.dataUrl.trim().startsWith("blob:")
  ) {
    return defaultImageFieldState();
  }

  const dataUrl =
    typeof value.dataUrl === "string"
      ? normalizeStoredImageUrl(value.dataUrl)
      : null;
  const fileUrlFromField =
    typeof value.fileUrl === "string"
      ? normalizeStoredImageUrl(value.fileUrl)
      : null;
  const sourced = extractStoredImageReferenceWithSource(value, "imageValue");
  const sourcedReference = sourced?.reference
    ? normalizeStoredImageUrl(sourced.reference)
    : null;

  const fileUrl =
    fileUrlFromField ??
    (sourcedReference && !sourcedReference.startsWith("data:image/")
      ? sourcedReference
      : null);

  const resolvedDataUrl =
    dataUrl ??
    (sourcedReference?.startsWith("data:image/") ? sourcedReference : null) ??
    (typeof value.value === "string"
      ? normalizeStoredImageUrl(value.value)
      : null);

  if (!fileUrl && !resolvedDataUrl) {
    return defaultImageFieldState();
  }

  const explicitValue =
    typeof value.value === "string"
      ? normalizeStoredImageUrl(value.value)
      : typeof value.executionUrl === "string"
        ? normalizeStoredImageUrl(value.executionUrl)
        : null;

  const metaRecord = value.meta;
  const meta = {
    fileUrl:
      (typeof metaRecord === "object" &&
      metaRecord !== null &&
      typeof metaRecord.fileUrl === "string"
        ? normalizeStoredImageUrl(metaRecord.fileUrl)
        : null) ?? fileUrl,
    dataUrl:
      (typeof metaRecord === "object" &&
      metaRecord !== null &&
      typeof metaRecord.dataUrl === "string"
        ? normalizeStoredImageUrl(metaRecord.dataUrl)
        : null) ?? resolvedDataUrl,
    fileName:
      (typeof metaRecord === "object" &&
      metaRecord !== null &&
      typeof metaRecord.fileName === "string"
        ? metaRecord.fileName
        : null) ??
      (typeof value.fileName === "string" ? value.fileName : null),
    mimeType:
      (typeof metaRecord === "object" &&
      metaRecord !== null &&
      typeof metaRecord.mimeType === "string"
        ? metaRecord.mimeType
        : null) ??
      (typeof value.mimeType === "string" ? value.mimeType : null),
  };

  const valueRef =
    resolvedDataUrl ??
    explicitValue ??
    getExecutableImageUrl(fileUrl) ??
    fileUrl;

  return {
    fileName: typeof value.fileName === "string" ? value.fileName : null,
    fileUrl,
    dataUrl: resolvedDataUrl,
    value: valueRef,
    executionUrl: valueRef,
    meta,
    mimeType: typeof value.mimeType === "string" ? value.mimeType : null,
    size: typeof value.size === "number" ? value.size : null,
  };
}

export { defaultRequestInputsConfig } from "@/lib/workflow/request-inputs-fields";

export function defaultCropImageConfig(): CropImageConfig {
  return {
    xPercent: 0,
    yPercent: 0,
    widthPercent: 100,
    heightPercent: 100,
  };
}

export function defaultGeminiProConfig(): GeminiProConfig {
  return {
    settingsOpen: false,
    jsonMode: false,
    temperature: 0.7,
    maxOutputTokens: 8192,
    prompt: "",
    systemPrompt: "",
  };
}

export function defaultResponseConfig(): ResponseConfig {
  return {};
}

export function defaultConfigForNodeType(
  nodeType: WorkflowNodeType,
): RequestInputsConfig | CropImageConfig | GeminiProConfig | ResponseConfig {
  switch (nodeType) {
    case "requestInputs":
      return defaultRequestInputsConfig();
    case "cropImage":
      return defaultCropImageConfig();
    case "geminiPro":
      return defaultGeminiProConfig();
    case "response":
      return defaultResponseConfig();
  }
}

export function defaultLabelForNodeType(nodeType: WorkflowNodeType): string {
  switch (nodeType) {
    case "requestInputs":
      return "Request-Inputs";
    case "cropImage":
      return "Crop Image";
    case "geminiPro":
      return "Gemini 3.1 Pro";
    case "response":
      return "Response";
  }
}
