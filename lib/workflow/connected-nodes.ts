import type { Edge } from "reactflow";

function buildAdjacency(edges: Edge[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }

    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set());
    }

    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }

  return adjacency;
}

/** All workflow node ids in the same undirected connected component. */
export function getConnectedNodeIds(
  startNodeId: string,
  edges: Edge[],
): Set<string> {
  const adjacency = buildAdjacency(edges);
  const visited = new Set<string>([startNodeId]);
  const queue = [startNodeId];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

/** Union of connected components for multiple starting nodes. */
export function getConnectedGroupForNodes(
  nodeIds: string[],
  edges: Edge[],
): Set<string> {
  const result = new Set<string>();

  for (const nodeId of nodeIds) {
    for (const connectedId of getConnectedNodeIds(nodeId, edges)) {
      result.add(connectedId);
    }
  }

  return result;
}

type ConnectedGroupDragOptions = {
  /** Toolbar toggle: normal drag moves the connected component. */
  moveConnectedGroup: boolean;
  /** Shift held at drag start: one-shot connected group drag. */
  shiftKey: boolean;
};

/**
 * Returns the connected component to move when group-drag mode is active.
 * Returns null when individual drag should be used.
 */
export function resolveConnectedGroupDrag(
  nodeId: string,
  edges: Edge[],
  options: ConnectedGroupDragOptions,
): Set<string> | null {
  if (!options.moveConnectedGroup && !options.shiftKey) {
    return null;
  }

  const component = getConnectedNodeIds(nodeId, edges);
  return component.size >= 2 ? component : null;
}
