import type { Edge, Node } from "reactflow";
import type { WorkflowNodeData, WorkflowNodeType } from "@/types/workflow-canvas";
import type { RunScope } from "@/types/workflow-execution";
import { REQUEST_INPUTS_NODE_ID, RESPONSE_NODE_ID } from "@/lib/workflow/canvas";

export const EXECUTABLE_NODE_TYPES = new Set<WorkflowNodeType>([
  "cropImage",
  "geminiPro",
]);

export const LOCAL_NODE_TYPES = new Set<WorkflowNodeType>([
  "requestInputs",
  "response",
]);

export function buildUpstreamMap(edges: Edge[]): Map<string, Set<string>> {
  const upstream = new Map<string, Set<string>>();

  for (const edge of edges) {
    const existing = upstream.get(edge.target) ?? new Set<string>();
    existing.add(edge.source);
    upstream.set(edge.target, existing);
  }

  return upstream;
}

export function collectUpstreamDependencies(
  nodeId: string,
  edges: Edge[],
): Set<string> {
  const upstreamMap = buildUpstreamMap(edges);
  const collected = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || collected.has(current)) {
      continue;
    }

    collected.add(current);

    for (const parent of upstreamMap.get(current) ?? []) {
      stack.push(parent);
    }
  }

  collected.delete(nodeId);
  return collected;
}

export function getAllExecutableNodeIds(
  nodes: Node<WorkflowNodeData>[],
): string[] {
  return nodes
    .filter((node) => EXECUTABLE_NODE_TYPES.has(node.data.nodeType))
    .map((node) => node.id);
}

export function planExecutionNodeIds(
  scope: RunScope,
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  selectedNodeIds: string[] = [],
): string[] {
  const nodeIds = new Set<string>();

  if (scope === "full") {
    for (const node of nodes) {
      nodeIds.add(node.id);
    }

    return [...nodeIds];
  }

  const targets =
    scope === "single"
      ? selectedNodeIds.slice(0, 1)
      : selectedNodeIds.filter(Boolean);

  for (const targetId of targets) {
  nodeIds.add(targetId);

    for (const upstreamId of collectUpstreamDependencies(targetId, edges)) {
      nodeIds.add(upstreamId);
    }
  }

  if (!nodeIds.has(REQUEST_INPUTS_NODE_ID)) {
    const needsRequestInputs = [...nodeIds].some((id) => {
      const deps = collectUpstreamDependencies(id, edges);
      return deps.size > 0 || id !== REQUEST_INPUTS_NODE_ID;
    });

    if (needsRequestInputs || targets.length > 0) {
      nodeIds.add(REQUEST_INPUTS_NODE_ID);
    }
  }

  const hasResponseUpstream = targets.some((targetId) => {
    const downstream = collectDownstreamDependencies(targetId, edges);
    return downstream.has(RESPONSE_NODE_ID);
  });

  if (hasResponseUpstream) {
    nodeIds.add(RESPONSE_NODE_ID);
  }

  return [...nodeIds];
}

export function collectDownstreamDependencies(
  nodeId: string,
  edges: Edge[],
): Set<string> {
  const downstream = new Map<string, Set<string>>();

  for (const edge of edges) {
    const existing = downstream.get(edge.source) ?? new Set<string>();
    existing.add(edge.target);
    downstream.set(edge.source, existing);
  }

  const collected = new Set<string>();
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || collected.has(current)) {
      continue;
    }

    collected.add(current);

    for (const child of downstream.get(current) ?? []) {
      stack.push(child);
    }
  }

  collected.delete(nodeId);
  return collected;
}

export function getReadyExecutableNodes(
  pendingExecutableIds: string[],
  completedNodeIds: Set<string>,
  edges: Edge[],
  plannedNodeIds: Set<string>,
): string[] {
  const upstreamMap = buildUpstreamMap(edges);

  return pendingExecutableIds.filter((nodeId) => {
    if (!plannedNodeIds.has(nodeId)) {
      return false;
    }

    const upstream = upstreamMap.get(nodeId) ?? new Set<string>();

    for (const parentId of upstream) {
      if (!plannedNodeIds.has(parentId)) {
        continue;
      }

      if (!completedNodeIds.has(parentId)) {
        return false;
      }
    }

    return true;
  });
}

export type NodeDependencyStatus = "ready" | "waiting" | "blocked";

export function getNodeDependencyStatus(
  nodeId: string,
  successfulNodeIds: Set<string>,
  failedNodeIds: Set<string>,
  edges: Edge[],
  plannedNodeIds: Set<string>,
): NodeDependencyStatus {
  const upstreamMap = buildUpstreamMap(edges);
  const upstream = upstreamMap.get(nodeId) ?? new Set<string>();

  for (const parentId of upstream) {
    if (!plannedNodeIds.has(parentId)) {
      continue;
    }

    if (failedNodeIds.has(parentId)) {
      return "blocked";
    }

    if (!successfulNodeIds.has(parentId)) {
      return "waiting";
    }
  }

  return "ready";
}

/**
 * Assign planned nodes to dependency levels. Nodes in the same level can run
 * in parallel once every upstream node is in an earlier level.
 */
export function computeExecutionLevels(
  plannedNodeIds: Set<string>,
  edges: Edge[],
): string[][] {
  const upstreamMap = buildUpstreamMap(edges);
  const planned = [...plannedNodeIds];
  const assigned = new Set<string>();
  const levels: string[][] = [];

  while (assigned.size < planned.length) {
    const level: string[] = [];

    for (const nodeId of planned) {
      if (assigned.has(nodeId)) {
        continue;
      }

      const upstream = upstreamMap.get(nodeId) ?? new Set<string>();
      const parentsReady = [...upstream].every(
        (parentId) =>
          !plannedNodeIds.has(parentId) || assigned.has(parentId),
      );

      if (parentsReady) {
        level.push(nodeId);
      }
    }

    if (level.length === 0) {
      const remaining = planned.filter((nodeId) => !assigned.has(nodeId));

      if (remaining.length === 0) {
        break;
      }

      levels.push(remaining);

      for (const nodeId of remaining) {
        assigned.add(nodeId);
      }

      break;
    }

    levels.push(level);

    for (const nodeId of level) {
      assigned.add(nodeId);
    }
  }

  return levels;
}
