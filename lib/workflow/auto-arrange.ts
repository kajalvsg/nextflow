import type { Edge, Node } from "reactflow";
import type { WorkflowNodeData } from "@/types/workflow-canvas";

const COLUMN_WIDTH = 420;
const ROW_HEIGHT = 260;
const ORIGIN_X = 80;
const ORIGIN_Y = 100;

function buildInDegree(
  nodeIds: string[],
  edges: Edge[],
): Map<string, number> {
  const inDegree = new Map(nodeIds.map((id) => [id, 0]));

  for (const edge of edges) {
    if (!inDegree.has(edge.target)) {
      continue;
    }

    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  return inDegree;
}

function topologicalOrder(nodeIds: string[], edges: Edge[]): string[] {
  const inDegree = buildInDegree(nodeIds, edges);
  const outgoing = new Map<string, string[]>();

  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }

  const queue = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const ordered: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    ordered.push(current);

    for (const target of outgoing.get(current) ?? []) {
      const nextDegree = (inDegree.get(target) ?? 0) - 1;
      inDegree.set(target, nextDegree);

      if (nextDegree === 0) {
        queue.push(target);
      }
    }
  }

  for (const id of nodeIds) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }

  return ordered;
}

export function autoArrangeWorkflowNodes(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): Node<WorkflowNodeData>[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const order = topologicalOrder(
    nodes.map((node) => node.id),
    edges,
  );
  const rank = new Map(order.map((id, index) => [id, index]));

  return nodes.map((node) => {
    const column = rank.get(node.id) ?? 0;

    return {
      ...node,
      position: {
        x: ORIGIN_X + column * COLUMN_WIDTH,
        y: ORIGIN_Y + (column % 2) * ROW_HEIGHT,
      },
    };
  });
}
