import type { Connection, Edge, Node } from "reactflow";
import {
  getRequestInputField,
  normalizeRequestInputsConfig,
} from "@/lib/workflow/request-inputs-fields";
import type { WorkflowNodeData, WorkflowNodeType } from "@/types/workflow-canvas";

export type HandleDataType = "text" | "image";

type HandleDefinition = {
  dataType: HandleDataType;
  allowedTargets?: string[];
};

const STATIC_SOURCE_HANDLES: Partial<
  Record<WorkflowNodeType, Record<string, HandleDefinition>>
> = {
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

const TEXT_OUTPUT_TARGETS = ["prompt", "system_prompt", "result"] as const;
const IMAGE_OUTPUT_TARGETS = ["input_image", "image_vision"] as const;

function getNodeType(
  nodes: Node<WorkflowNodeData>[],
  nodeId: string | null | undefined,
): WorkflowNodeType | null {
  if (!nodeId) return null;
  const node = nodes.find((item) => item.id === nodeId);
  return node?.data.nodeType ?? null;
}

function getRequestInputsSourceDefinition(
  nodes: Node<WorkflowNodeData>[],
  nodeId: string,
  handleId: string,
): HandleDefinition | null {
  const node = nodes.find((item) => item.id === nodeId);

  if (!node || node.data.nodeType !== "requestInputs") {
    return null;
  }

  const config = normalizeRequestInputsConfig(node.data.config);
  const field = getRequestInputField(config, handleId);

  if (!field) {
    return null;
  }

  if (field.type === "text_field") {
    return {
      dataType: "text",
      allowedTargets: [...TEXT_OUTPUT_TARGETS],
    };
  }

  return {
    dataType: "image",
    allowedTargets: [...IMAGE_OUTPUT_TARGETS],
  };
}

function getSourceDefinition(
  nodes: Node<WorkflowNodeData>[],
  nodeId: string | null | undefined,
  handleId: string | null | undefined,
): HandleDefinition | null {
  if (!nodeId || !handleId) return null;

  const nodeType = getNodeType(nodes, nodeId);

  if (nodeType === "requestInputs") {
    return getRequestInputsSourceDefinition(nodes, nodeId, handleId);
  }

  if (!nodeType) return null;
  return STATIC_SOURCE_HANDLES[nodeType]?.[handleId] ?? null;
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

  const targetNodeType = getNodeType(nodes, target);
  const sourceDef = getSourceDefinition(nodes, source, sourceHandle);
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
