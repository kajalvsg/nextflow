import type { Edge, Node } from "reactflow";
import {
  defaultConfigForNodeType,
  defaultImageFieldState,
  defaultLabelForNodeType,
} from "@/lib/workflow/node-defaults";
import type {
  CropImageConfig,
  GeminiProConfig,
  ImageFieldState,
  RequestInputsConfig,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowNodeData,
  WorkflowNodeType,
} from "@/types/workflow-canvas";

export const PROTECTED_NODE_IDS = new Set(["request-inputs", "response"]);

export const REQUEST_INPUTS_NODE_ID = "request-inputs";
export const RESPONSE_NODE_ID = "response";
export const DEFAULT_EDGE_ID = "edge-request-inputs-response";

export function createDefaultEdge(): WorkflowCanvasEdge {
  return {
    id: DEFAULT_EDGE_ID,
    source: REQUEST_INPUTS_NODE_ID,
    sourceHandle: "text_field",
    target: RESPONSE_NODE_ID,
    targetHandle: "result",
    type: "default",
    animated: true,
    style: { stroke: "#8b7cf7", strokeWidth: 2 },
  };
}

export function createDefaultGraph(): {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
} {
  return {
    nodes: [
      {
        id: REQUEST_INPUTS_NODE_ID,
        type: "requestInputs",
        position: { x: 80, y: 180 },
        data: {
          label: "Request Inputs",
          nodeType: "requestInputs",
          config: defaultConfigForNodeType("requestInputs") as RequestInputsConfig,
        },
        deletable: false,
        draggable: true,
        selectable: true,
      },
      {
        id: RESPONSE_NODE_ID,
        type: "response",
        position: { x: 720, y: 180 },
        data: {
          label: "Response",
          nodeType: "response",
          config: defaultConfigForNodeType("response"),
        },
        deletable: false,
        draggable: true,
        selectable: true,
      },
    ],
    edges: [createDefaultEdge()],
  };
}

export function isGraphEmpty(
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
): boolean {
  return nodes.length === 0 && edges.length === 0;
}

function hasDefaultNodes(nodes: WorkflowCanvasNode[]): boolean {
  return (
    nodes.some((node) => node.id === REQUEST_INPUTS_NODE_ID) &&
    nodes.some((node) => node.id === RESPONSE_NODE_ID)
  );
}

function hasDefaultConnection(edges: WorkflowCanvasEdge[]): boolean {
  return edges.some(
    (edge) =>
      edge.source === REQUEST_INPUTS_NODE_ID &&
      edge.target === RESPONSE_NODE_ID,
  );
}

export function ensureDefaultEdge(
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
): {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  changed: boolean;
} {
  if (!hasDefaultNodes(nodes) || hasDefaultConnection(edges)) {
    return { nodes, edges, changed: false };
  }

  return {
    nodes,
    edges: [...edges, createDefaultEdge()],
    changed: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNodeType(value: unknown): WorkflowNodeType {
  if (
    value === "requestInputs" ||
    value === "cropImage" ||
    value === "geminiPro" ||
    value === "response"
  ) {
    return value;
  }

  return "requestInputs";
}

function parseImageFieldState(value: unknown): ImageFieldState {
  if (!isRecord(value)) {
    return defaultImageFieldState();
  }

  const uploadStatus = value.uploadStatus;
  const validStatus =
    uploadStatus === "idle" ||
    uploadStatus === "uploading" ||
    uploadStatus === "done" ||
    uploadStatus === "error";

  return {
    fileName: typeof value.fileName === "string" ? value.fileName : null,
    fileUrl: typeof value.fileUrl === "string" ? value.fileUrl : null,
    uploadStatus: validStatus ? uploadStatus : "idle",
  };
}

function parseRequestInputsConfig(value: unknown): RequestInputsConfig {
  const defaults = defaultConfigForNodeType("requestInputs") as RequestInputsConfig;
  if (!isRecord(value)) return defaults;

  return {
    textField:
      typeof value.textField === "string" ? value.textField : defaults.textField,
    imageField: parseImageFieldState(value.imageField),
  };
}

function parseCropImageConfig(value: unknown): CropImageConfig {
  const defaults = defaultConfigForNodeType("cropImage") as CropImageConfig;
  if (!isRecord(value)) return defaults;

  return {
    xPercent:
      typeof value.xPercent === "number" ? value.xPercent : defaults.xPercent,
    yPercent:
      typeof value.yPercent === "number" ? value.yPercent : defaults.yPercent,
    widthPercent:
      typeof value.widthPercent === "number"
        ? value.widthPercent
        : defaults.widthPercent,
    heightPercent:
      typeof value.heightPercent === "number"
        ? value.heightPercent
        : defaults.heightPercent,
  };
}

function parseGeminiProConfig(value: unknown): GeminiProConfig {
  const defaults = defaultConfigForNodeType("geminiPro") as GeminiProConfig;
  if (!isRecord(value)) return defaults;

  return {
    settingsOpen:
      typeof value.settingsOpen === "boolean"
        ? value.settingsOpen
        : defaults.settingsOpen,
    temperature:
      typeof value.temperature === "number"
        ? value.temperature
        : defaults.temperature,
    maxOutputTokens:
      typeof value.maxOutputTokens === "number"
        ? value.maxOutputTokens
        : defaults.maxOutputTokens,
  };
}

function parseNodeConfig(
  nodeType: WorkflowNodeType,
  value: unknown,
): WorkflowNodeData["config"] {
  switch (nodeType) {
    case "requestInputs":
      return parseRequestInputsConfig(value);
    case "cropImage":
      return parseCropImageConfig(value);
    case "geminiPro":
      return parseGeminiProConfig(value);
    case "response":
      return {};
  }
}

function parseNodeData(nodeType: WorkflowNodeType, data: unknown): WorkflowNodeData {
  const record = isRecord(data) ? data : {};

  return {
    label:
      typeof record.label === "string"
        ? record.label
        : defaultLabelForNodeType(nodeType),
    nodeType,
    config: parseNodeConfig(nodeType, record.config),
  };
}

function parseNode(node: unknown): WorkflowCanvasNode | null {
  if (!isRecord(node) || typeof node.id !== "string") {
    return null;
  }

  const dataRecord = isRecord(node.data) ? node.data : {};
  const nodeType = parseNodeType(dataRecord.nodeType ?? node.type);
  const position = isRecord(node.position) ? node.position : { x: 0, y: 0 };

  return {
    id: node.id,
    type: nodeType,
    position: {
      x: typeof position.x === "number" ? position.x : 0,
      y: typeof position.y === "number" ? position.y : 0,
    },
    data: parseNodeData(nodeType, dataRecord),
    deletable: !PROTECTED_NODE_IDS.has(node.id),
    draggable: true,
    selectable: true,
  };
}

function parseEdge(edge: unknown): WorkflowCanvasEdge | null {
  if (
    !isRecord(edge) ||
    typeof edge.id !== "string" ||
    typeof edge.source !== "string" ||
    typeof edge.target !== "string"
  ) {
    return null;
  }

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle:
      typeof edge.sourceHandle === "string" ? edge.sourceHandle : undefined,
    targetHandle:
      typeof edge.targetHandle === "string" ? edge.targetHandle : undefined,
    type: typeof edge.type === "string" ? edge.type : "default",
    animated: typeof edge.animated === "boolean" ? edge.animated : undefined,
    style: isRecord(edge.style)
      ? (edge.style as WorkflowCanvasEdge["style"])
      : undefined,
  };
}

export function parseStoredGraph(
  nodesJson: unknown,
  edgesJson: unknown,
): { nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] } {
  const rawNodes = Array.isArray(nodesJson) ? nodesJson : [];
  const rawEdges = Array.isArray(edgesJson) ? edgesJson : [];

  const nodes = rawNodes
    .map(parseNode)
    .filter((node): node is WorkflowCanvasNode => node !== null)
    .map((node) => ({
      ...node,
      deletable: !PROTECTED_NODE_IDS.has(node.id),
    }));

  const edges = rawEdges
    .map(parseEdge)
    .filter((edge): edge is WorkflowCanvasEdge => edge !== null);

  return { nodes, edges };
}

export function sanitizeGraphForSave(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): { nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] } {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type ?? node.data.nodeType,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      data: {
        label: node.data?.label ?? defaultLabelForNodeType(node.data.nodeType),
        nodeType: node.data.nodeType,
        config: node.data.config,
      },
      deletable: !PROTECTED_NODE_IDS.has(node.id),
      draggable: true,
      selectable: true,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
      type: edge.type ?? "default",
      animated: edge.animated ?? undefined,
      style: edge.style ?? undefined,
    })),
  };
}
