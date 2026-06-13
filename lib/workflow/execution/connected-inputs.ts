import type { Edge, Node } from "reactflow";
import { normalizeEdgeForResolution } from "@/lib/workflow/execution/edge-handles";
import {
  isOutputImageHandle,
  resolveImageInputFromEdge,
} from "@/lib/workflow/execution/image-input";
import {
  resolveHandleValue,
  resolveRequestInputsOutput,
  type NodeOutputMap,
} from "@/lib/workflow/execution/resolve-inputs";
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import type {
  NodeExecutionSnapshot,
  NodeInlineExecutionState,
  NodeRuntimeStatus,
} from "@/types/workflow-execution";

export type ConnectedInputStatus = "ready" | "waiting" | "blocked";

export type ConnectedInputValue = {
  text?: string | null;
  images?: string[];
  imageKind?: "cropped" | "default";
  status: ConnectedInputStatus;
  hint?: string;
};

export type ConnectedInputMap = Map<string, Map<string, ConnectedInputValue>>;

type NodeExecutionState = {
  status: NodeRuntimeStatus | "updating" | "pending" | "skipped";
  output: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSuccessfulExecution(state: NodeExecutionState | undefined): boolean {
  if (!state) {
    return false;
  }

  if (state.status === "success") {
    return true;
  }

  if (state.status === "failed" && isRecord(state.output)) {
    return true;
  }

  return false;
}

function isFailedExecution(state: NodeExecutionState | undefined): boolean {
  return state?.status === "failed" && !isSuccessfulExecution(state);
}

function isPendingExecution(state: NodeExecutionState | undefined): boolean {
  if (!state) {
    return true;
  }

  return (
    state.status === "pending" ||
    state.status === "running" ||
    state.status === "updating" ||
    state.status === "idle"
  );
}

function getNodeType(
  nodes: Node<WorkflowNodeData>[],
  nodeId: string,
): WorkflowNodeData["nodeType"] | null {
  return nodes.find((node) => node.id === nodeId)?.data.nodeType ?? null;
}

function buildExecutionStateMap(
  nodes: Node<WorkflowNodeData>[],
  nodeExecutions: Record<string, NodeExecutionSnapshot>,
  inlineExecutions?: Record<string, NodeInlineExecutionState>,
): Map<string, NodeExecutionState> {
  const states = new Map<string, NodeExecutionState>();

  for (const node of nodes) {
    const inline = inlineExecutions?.[node.id];
    const snapshot = nodeExecutions[node.id];

    if (inline) {
      states.set(node.id, {
        status: inline.status,
        output: inline.output,
      });
      continue;
    }

    if (snapshot) {
      states.set(node.id, {
        status: snapshot.status,
        output: snapshot.output,
      });
    }
  }

  return states;
}

function buildOutputMapFromExecutions(
  nodes: Node<WorkflowNodeData>[],
  executionStates: Map<string, NodeExecutionState>,
): NodeOutputMap {
  const outputs: NodeOutputMap = new Map();

  for (const node of nodes) {
    if (node.data.nodeType === "requestInputs") {
      outputs.set(node.id, resolveRequestInputsOutput(node));
    }
  }

  for (const node of nodes) {
    const state = executionStates.get(node.id);

    if (!isSuccessfulExecution(state)) {
      continue;
    }

    if (isRecord(state?.output)) {
      outputs.set(node.id, state.output);
    }
  }

  return outputs;
}

function getSourceExecutionState(
  executionStates: Map<string, NodeExecutionState>,
  sourceNodeId: string,
): NodeExecutionState | undefined {
  return executionStates.get(sourceNodeId);
}

function resolveTextConnectedInput(
  edges: Edge[],
  targetHandle: string,
  outputs: NodeOutputMap,
  executionStates: Map<string, NodeExecutionState>,
): ConnectedInputValue {
  let blocked = false;
  let waiting = false;
  const parts: string[] = [];

  for (const edge of edges) {
    const sourceState = getSourceExecutionState(executionStates, edge.source);
    const value = resolveHandleValue(edge.source, edge.sourceHandle, outputs);

    if (typeof value === "string" && value.trim()) {
      parts.push(value.trim());
      continue;
    }

    if (isFailedExecution(sourceState)) {
      blocked = true;
      continue;
    }

    if (isPendingExecution(sourceState)) {
      waiting = true;
    }
  }

  if (parts.length > 0) {
    return {
      text: parts.join("\n\n"),
      status: "ready",
    };
  }

  if (blocked) {
    return {
      status: "blocked",
      hint: "Connected — upstream node failed.",
    };
  }

  if (waiting) {
    return {
      status: "waiting",
      hint: "Connected — waiting for upstream output.",
    };
  }

  return {
    status: "waiting",
    hint: "Waiting for input...",
  };
}

function resolveImageConnectedInput(
  edges: Edge[],
  outputs: NodeOutputMap,
  nodes: Node<WorkflowNodeData>[],
  executionStates: Map<string, NodeExecutionState>,
): ConnectedInputValue {
  let blocked = false;
  let waiting = false;
  const images: string[] = [];
  let allFromCrop = edges.length > 0;

  for (const edge of edges) {
    const sourceType = getNodeType(nodes, edge.source);
    const sourceState = getSourceExecutionState(executionStates, edge.source);
    const isCropOutput =
      sourceType === "cropImage" &&
      isOutputImageHandle(edge.sourceHandle ?? "output_image");

    if (!isCropOutput) {
      allFromCrop = false;
    }

    if (isFailedExecution(sourceState)) {
      blocked = true;
      continue;
    }

    const url = resolveImageInputFromEdge(edge, outputs, nodes);

    if (url) {
      images.push(url);
      continue;
    }

    if (isPendingExecution(sourceState)) {
      waiting = true;
    }
  }

  if (images.length > 0) {
    return {
      images,
      imageKind: allFromCrop ? "cropped" : "default",
      status: "ready",
      hint:
        images.length > 1
          ? `${images.length} connected images ready`
          : allFromCrop
            ? "Connected cropped image ready"
            : "Connected image ready",
    };
  }

  if (blocked) {
    return {
      status: "blocked",
      hint: "Connected — upstream node failed.",
    };
  }

  if (waiting) {
    return {
      status: "waiting",
      hint: allFromCrop
        ? "Connected — waiting for cropped image."
        : "Connected — waiting for upstream output.",
    };
  }

  return {
    status: "waiting",
    hint: "Waiting for input...",
  };
}

export function buildConnectedInputMap(
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
  nodeExecutions: Record<string, NodeExecutionSnapshot> = {},
  inlineExecutions?: Record<string, NodeInlineExecutionState>,
): ConnectedInputMap {
  const executionStates = buildExecutionStateMap(
    nodes,
    nodeExecutions,
    inlineExecutions,
  );
  const outputs = buildOutputMapFromExecutions(nodes, executionStates);
  const connected = new Map<string, Map<string, ConnectedInputValue>>();

  for (const node of nodes) {
    const incoming = edges
      .filter((edge) => edge.target === node.id)
      .map((edge) => normalizeEdgeForResolution(edge, nodes));

    if (incoming.length === 0) {
      continue;
    }

    const byHandle = new Map<string, ConnectedInputValue>();
    const grouped = new Map<string, Edge[]>();

    for (const edge of incoming) {
      const handle = edge.targetHandle ?? "input";

      grouped.set(handle, [...(grouped.get(handle) ?? []), edge]);
    }

    for (const [targetHandle, handleEdges] of grouped) {
      if (
        targetHandle === "prompt" ||
        targetHandle === "system_prompt" ||
        targetHandle === "result"
      ) {
        byHandle.set(
          targetHandle,
          resolveTextConnectedInput(
            handleEdges,
            targetHandle,
            outputs,
            executionStates,
          ),
        );
        continue;
      }

      if (targetHandle === "input_image" || targetHandle === "image_vision") {
        byHandle.set(
          targetHandle,
          resolveImageConnectedInput(
            handleEdges,
            outputs,
            nodes,
            executionStates,
          ),
        );
      }
    }

    if (byHandle.size > 0) {
      connected.set(node.id, byHandle);
    }
  }

  return connected;
}

export function getConnectedInputValue(
  connectedInputMap: ConnectedInputMap,
  nodeId: string,
  targetHandle: string,
): ConnectedInputValue | null {
  return connectedInputMap.get(nodeId)?.get(targetHandle) ?? null;
}
