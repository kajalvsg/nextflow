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
    uploadStatus: "idle",
  };
}

export function defaultRequestInputsConfig(): RequestInputsConfig {
  return {
    textField: "",
    imageField: defaultImageFieldState(),
  };
}

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
    temperature: 0.7,
    maxOutputTokens: 8192,
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
      return "Request Inputs";
    case "cropImage":
      return "Crop Image";
    case "geminiPro":
      return "Gemini 3.1 Pro";
    case "response":
      return "Response";
  }
}
