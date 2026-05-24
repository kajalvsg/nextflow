import type { Edge, Node } from "reactflow";
import type {
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
    target: RESPONSE_NODE_ID,
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
        position: { x: 80, y: 220 },
        data: { label: "Request Inputs", nodeType: "requestInputs" },
        deletable: false,
        draggable: true,
        selectable: true,
      },
      {
        id: RESPONSE_NODE_ID,
        type: "response",
        position: { x: 560, y: 220 },
        data: { label: "Response", nodeType: "response" },
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

/** Adds Request Inputs → Response edge when missing; leaves node positions unchanged. */
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
  if (value === "requestInputs" || value === "response") {
    return value;
  }

  return "requestInputs";
}

function parseNode(node: unknown): WorkflowCanvasNode | null {
  if (!isRecord(node) || typeof node.id !== "string") {
    return null;
  }

  const data = isRecord(node.data) ? node.data : {};
  const nodeType = parseNodeType(data.nodeType ?? node.type);
  const position = isRecord(node.position) ? node.position : { x: 0, y: 0 };

  return {
    id: node.id,
    type: nodeType,
    position: {
      x: typeof position.x === "number" ? position.x : 0,
      y: typeof position.y === "number" ? position.y : 0,
    },
    data: {
      label:
        typeof data.label === "string"
          ? data.label
          : nodeType === "response"
            ? "Response"
            : "Request Inputs",
      nodeType,
    },
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
    style: isRecord(edge.style) ? (edge.style as WorkflowCanvasEdge["style"]) : undefined,
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
      type: node.type ?? "requestInputs",
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      data: {
        label: node.data?.label ?? "Node",
        nodeType: parseNodeType(node.data?.nodeType ?? node.type),
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
