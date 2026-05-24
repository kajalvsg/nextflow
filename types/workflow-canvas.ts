import type { Edge, Node } from "reactflow";

export type WorkflowNodeType =
  | "requestInputs"
  | "cropImage"
  | "geminiPro"
  | "response";

export type AddableWorkflowNodeType = "cropImage" | "geminiPro";

export type ImageFieldState = {
  fileName: string | null;
  fileUrl: string | null;
  uploadStatus: "idle" | "uploading" | "done" | "error";
};

export type RequestInputsConfig = {
  textField: string;
  imageField: ImageFieldState;
};

export type CropImageConfig = {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
};

export type GeminiProConfig = {
  settingsOpen: boolean;
  temperature: number;
  maxOutputTokens: number;
};

export type ResponseConfig = Record<string, never>;

export type WorkflowNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
  config:
    | RequestInputsConfig
    | CropImageConfig
    | GeminiProConfig
    | ResponseConfig;
};

export type WorkflowCanvasNode = Node<WorkflowNodeData>;
export type WorkflowCanvasEdge = Edge;

export type WorkflowBuilderDTO = {
  id: string;
  name: string;
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
};

export type NodePickerItem = {
  type: AddableWorkflowNodeType;
  label: string;
  description: string;
  keywords: string[];
};
