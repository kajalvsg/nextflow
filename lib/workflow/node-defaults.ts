import { normalizeStoredImageUrl, extractStoredImageReference } from "@/lib/upload/image-upload";
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
    mimeType: null,
    size: null,
  };
}

/** Persist only saved upload metadata; strip UI-only fields from stored graphs. */
export function serializeImageFieldState(
  value: Partial<ImageFieldState> & Record<string, unknown>,
): ImageFieldState {
  const reference = extractStoredImageReference(value);
  const fileUrl = reference ? normalizeStoredImageUrl(reference) : null;

  if (!fileUrl) {
    return defaultImageFieldState();
  }

  return {
    fileName: typeof value.fileName === "string" ? value.fileName : null,
    fileUrl,
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
