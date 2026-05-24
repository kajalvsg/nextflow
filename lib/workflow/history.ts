import type { Edge, Node } from "reactflow";
import type { WorkflowNodeData } from "@/types/workflow-canvas";

export type GraphSnapshot = {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
};

export type HistoryStack = {
  past: GraphSnapshot[];
  future: GraphSnapshot[];
};

const MAX_HISTORY = 50;

export function cloneGraphSnapshot(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): GraphSnapshot {
  return {
    nodes: structuredClone(nodes),
    edges: structuredClone(edges),
  };
}

export function createHistoryStack(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): HistoryStack {
  return {
    past: [],
    future: [],
  };
}

export function pushHistory(
  stack: HistoryStack,
  snapshot: GraphSnapshot,
): HistoryStack {
  return {
    past: [...stack.past.slice(-(MAX_HISTORY - 1)), snapshot],
    future: [],
  };
}

export function undoHistory(
  present: GraphSnapshot,
  stack: HistoryStack,
): { snapshot: GraphSnapshot; stack: HistoryStack } | null {
  if (stack.past.length === 0) {
    return null;
  }

  const previous = stack.past[stack.past.length - 1];

  if (!previous) {
    return null;
  }

  return {
    snapshot: previous,
    stack: {
      past: stack.past.slice(0, -1),
      future: [present, ...stack.future].slice(0, MAX_HISTORY),
    },
  };
}

export function redoHistory(
  present: GraphSnapshot,
  stack: HistoryStack,
): { snapshot: GraphSnapshot; stack: HistoryStack } | null {
  if (stack.future.length === 0) {
    return null;
  }

  const [next, ...remainingFuture] = stack.future;

  if (!next) {
    return null;
  }

  return {
    snapshot: next,
    stack: {
      past: [...stack.past, present].slice(-MAX_HISTORY),
      future: remainingFuture,
    },
  };
}
