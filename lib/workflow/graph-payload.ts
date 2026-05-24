import type { Edge, Node } from "reactflow";
import { parseStoredGraph, sanitizeGraphForSave } from "@/lib/workflow/canvas";
import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowNodeData,
} from "@/types/workflow-canvas";

export type GraphPayload = {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
};

/** Plain JSON-safe graph for server actions and Prisma Json columns. */
export function prepareGraphPayload(
  nodes: Node<WorkflowNodeData>[] | WorkflowCanvasNode[],
  edges: Edge[] | WorkflowCanvasEdge[],
): GraphPayload {
  const sanitized = sanitizeGraphForSave(
    nodes as Node<WorkflowNodeData>[],
    edges as Edge[],
  );

  return JSON.parse(JSON.stringify(sanitized)) as GraphPayload;
}

export function parseGraphPayload(
  nodesJson: unknown,
  edgesJson: unknown,
): GraphPayload {
  const parsed = parseStoredGraph(nodesJson, edgesJson);

  return JSON.parse(
    JSON.stringify({
      nodes: parsed.nodes,
      edges: parsed.edges,
    }),
  ) as GraphPayload;
}

/** Stable string for comparing whether a graph changed since the last save. */
export function serializeGraphPayload(
  nodes: Node<WorkflowNodeData>[] | WorkflowCanvasNode[],
  edges: Edge[] | WorkflowCanvasEdge[],
): string {
  return JSON.stringify(prepareGraphPayload(nodes, edges));
}
