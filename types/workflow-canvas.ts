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
  mimeType: string | null;
  size: number | null;
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
  prompt: string;
  systemPrompt: string;
};

export type ResponseConfig = Record<string, never>;

export type WorkflowNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
  locked?: boolean;
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
  createdAt?: string;
  updatedAt?: string;
};

export type WorkflowExportDocument = {
  format: "nextflow-workflow";
  version: number;
  exportedAt: string;
  workflow: {
    name: string;
    createdAt?: string;
    updatedAt?: string;
  };
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
};

export type NodePickerItem = {
  type: AddableWorkflowNodeType;
  label: string;
  description: string;
  keywords: string[];
};
