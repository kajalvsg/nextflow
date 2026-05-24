import type { Connection, Edge, Node } from "reactflow";
import type { WorkflowNodeData, WorkflowNodeType } from "@/types/workflow-canvas";

export type HandleDataType = "text" | "image";

type HandleRole = "source" | "target";

type HandleDefinition = {
  dataType: HandleDataType;
  allowedTargets?: string[];
  allowedSources?: string[];
};

const SOURCE_HANDLES: Partial<
  Record<WorkflowNodeType, Record<string, HandleDefinition>>
> = {
  requestInputs: {
    text_field: {
      dataType: "text",
      allowedTargets: ["prompt", "system_prompt", "result"],
    },
    image_field: {
      dataType: "image",
      allowedTargets: ["input_image", "image_vision"],
    },
  },
  cropImage: {
    output_image: {
      dataType: "image",
      allowedTargets: ["image_vision"],
    },
  },
  geminiPro: {
    response: {
      dataType: "text",
      allowedTargets: ["result", "prompt"],
    },
  },
};

const TARGET_HANDLES: Partial<
  Record<WorkflowNodeType, Record<string, HandleDefinition>>
> = {
  cropImage: {
    input_image: { dataType: "image" },
  },
  geminiPro: {
    prompt: { dataType: "text" },
    system_prompt: { dataType: "text" },
    image_vision: { dataType: "image" },
  },
  response: {
    result: { dataType: "text" },
  },
};

function getNodeType(
  nodes: Node<WorkflowNodeData>[],
  nodeId: string | null | undefined,
): WorkflowNodeType | null {
  if (!nodeId) return null;
  const node = nodes.find((item) => item.id === nodeId);
  return node?.data.nodeType ?? null;
}

function getSourceDefinition(
  nodeType: WorkflowNodeType | null,
  handleId: string | null | undefined,
): HandleDefinition | null {
  if (!nodeType || !handleId) return null;
  return SOURCE_HANDLES[nodeType]?.[handleId] ?? null;
}

function getTargetDefinition(
  nodeType: WorkflowNodeType | null,
  handleId: string | null | undefined,
): HandleDefinition | null {
  if (!nodeType || !handleId) return null;
  return TARGET_HANDLES[nodeType]?.[handleId] ?? null;
}

export type ConnectionValidationResult = {
  valid: boolean;
  reason?: string;
};

export function validateWorkflowConnection(
  connection: Connection,
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): ConnectionValidationResult {
  const { source, target, sourceHandle, targetHandle } = connection;

  if (!source || !target || !sourceHandle || !targetHandle) {
    return { valid: false, reason: "Connect a specific input to an output handle." };
  }

  if (source === target) {
    return { valid: false, reason: "A node cannot connect to itself." };
  }

  const sourceNodeType = getNodeType(nodes, source);
  const targetNodeType = getNodeType(nodes, target);
  const sourceDef = getSourceDefinition(sourceNodeType, sourceHandle);
  const targetDef = getTargetDefinition(targetNodeType, targetHandle);

  if (!sourceDef) {
    return { valid: false, reason: "That output handle cannot be connected." };
  }

  if (!targetDef) {
    return { valid: false, reason: "That input handle cannot receive connections." };
  }

  if (sourceDef.dataType !== targetDef.dataType) {
    return {
      valid: false,
      reason:
        sourceDef.dataType === "text"
          ? "Text outputs can only connect to text inputs."
          : "Image outputs can only connect to image inputs.",
    };
  }

  if (sourceDef.allowedTargets && !sourceDef.allowedTargets.includes(targetHandle)) {
    return {
      valid: false,
      reason: `${sourceHandle} cannot connect to ${targetHandle}.`,
    };
  }

  if (wouldCreateCycle(source, target, edges)) {
    return {
      valid: false,
      reason: "This connection would create a cycle in the workflow.",
    };
  }

  return { valid: true };
}

function wouldCreateCycle(
  source: string,
  target: string,
  edges: Edge[],
): boolean {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const next = adjacency.get(edge.source) ?? [];
    next.push(edge.target);
    adjacency.set(edge.source, next);
  }

  const visited = new Set<string>();
  const stack = [source];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || visited.has(current)) {
      continue;
    }

    if (current === target) {
      return true;
    }

    visited.add(current);

    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

export function isSourceHandleConnected(
  nodeId: string,
  handleId: string,
  edges: Edge[],
): boolean {
  return edges.some(
    (edge) => edge.source === nodeId && edge.sourceHandle === handleId,
  );
}

export function isTargetHandleConnected(
  nodeId: string,
  handleId: string,
  edges: Edge[],
): boolean {
  return edges.some(
    (edge) => edge.target === nodeId && edge.targetHandle === handleId,
  );
}
