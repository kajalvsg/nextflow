import {
  PROTECTED_NODE_IDS,
  REQUEST_INPUTS_NODE_ID,
  RESPONSE_NODE_ID,
  parseStoredGraph,
  sanitizeGraphForSave,
} from "@/lib/workflow/canvas";
import { defaultConfigForNodeType, serializeImageFieldState } from "@/lib/workflow/node-defaults";
import { createWorkflowNode } from "@/lib/workflow/node-registry";
import type {
  CropImageConfig,
  RequestInputsConfig,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowExportDocument,
} from "@/types/workflow-canvas";

export const WORKFLOW_EXPORT_FORMAT = "nextflow-workflow" as const;
export const WORKFLOW_EXPORT_VERSION = 1;

const SECRET_KEY_PATTERN =
  /^(api[_-]?key|secret|token|password|authorization|gemini|trigger|clerk|database|private)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripSecretsDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSecretsDeep);
  }

  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      continue;
    }

    next[key] = stripSecretsDeep(nested);
  }

  return next;
}

function sanitizeNodeForExport(node: WorkflowCanvasNode): WorkflowCanvasNode {
  const config = stripSecretsDeep(node.data.config) as WorkflowCanvasNode["data"]["config"];

  if (node.data.nodeType === "requestInputs") {
    const requestConfig = config as RequestInputsConfig;

    return {
      ...node,
      data: {
        ...node.data,
        config: {
          ...requestConfig,
          imageField: serializeImageFieldState(requestConfig.imageField),
        },
      },
    };
  }

  return {
    ...node,
    data: {
      ...node.data,
      config,
    },
  };
}

export function buildWorkflowExportDocument(input: {
  name: string;
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  createdAt?: string | null;
  updatedAt?: string | null;
}): WorkflowExportDocument {
  const { nodes, edges } = sanitizeGraphForSave(input.nodes, input.edges);

  return {
    format: WORKFLOW_EXPORT_FORMAT,
    version: WORKFLOW_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    workflow: {
      name: input.name,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
    },
    nodes: nodes.map(sanitizeNodeForExport),
    edges,
  };
}

export type WorkflowImportResult =
  | { success: true; nodes: WorkflowCanvasNode[]; edges: WorkflowCanvasEdge[] }
  | { success: false; error: string };

export function parseWorkflowImportFile(raw: unknown): WorkflowImportResult {
  if (!isRecord(raw)) {
    return { success: false, error: "Invalid JSON: expected an object at the root." };
  }

  if (raw.format !== WORKFLOW_EXPORT_FORMAT) {
    return {
      success: false,
      error: `Unsupported format. Expected "${WORKFLOW_EXPORT_FORMAT}".`,
    };
  }

  if (raw.version !== WORKFLOW_EXPORT_VERSION) {
    return {
      success: false,
      error: `Unsupported version. Expected version ${WORKFLOW_EXPORT_VERSION}.`,
    };
  }

  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    return {
      success: false,
      error: "Invalid workflow file: nodes and edges must be arrays.",
    };
  }

  const workflowName = isRecord(raw.workflow) ? raw.workflow.name : undefined;

  if (workflowName !== undefined && typeof workflowName !== "string") {
    return {
      success: false,
      error: "Invalid workflow metadata: name must be a string.",
    };
  }

  const { nodes, edges } = parseStoredGraph(raw.nodes, raw.edges);

  if (nodes.length === 0) {
    return { success: false, error: "Import file contains no valid nodes." };
  }

  const hasRequestInputs = nodes.some(
    (node) => node.data.nodeType === "requestInputs",
  );
  const hasResponse = nodes.some((node) => node.data.nodeType === "response");

  if (!hasRequestInputs || !hasResponse) {
    return {
      success: false,
      error: "Workflow must include Request Inputs and Response nodes.",
    };
  }

  for (const edge of edges) {
    const sourceExists = nodes.some((node) => node.id === edge.source);
    const targetExists = nodes.some((node) => node.id === edge.target);

    if (!sourceExists || !targetExists) {
      return {
        success: false,
        error: `Invalid edge "${edge.id}": source or target node is missing.`,
      };
    }
  }

  return {
    success: true,
    nodes: nodes.map((node) => ({
      ...node,
      deletable: !PROTECTED_NODE_IDS.has(node.id),
    })),
    edges,
  };
}

function createEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): WorkflowCanvasEdge {
  return {
    id,
    source,
    sourceHandle,
    target,
    targetHandle,
    type: "default",
    animated: true,
    style: { stroke: "#8b7cf7", strokeWidth: 2 },
  };
}

function createSampleNode(
  id: string,
  nodeType: WorkflowCanvasNode["data"]["nodeType"],
  label: string,
  position: { x: number; y: number },
  configPatch?: Partial<WorkflowCanvasNode["data"]["config"]>,
): WorkflowCanvasNode {
  const node = createWorkflowNode(nodeType, position, id);
  node.data.label = label;
  node.deletable = !PROTECTED_NODE_IDS.has(id);

  if (configPatch) {
    node.data.config = {
      ...node.data.config,
      ...configPatch,
    } as WorkflowCanvasNode["data"]["config"];
  }

  return node;
}

/** Assignment sample: dual crop + chained Gemini pipeline. */
export function createAssignmentSampleWorkflow(): {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
} {
  const requestConfig = defaultConfigForNodeType(
    "requestInputs",
  ) as RequestInputsConfig;

  const nodes: WorkflowCanvasNode[] = [
    createSampleNode(
      REQUEST_INPUTS_NODE_ID,
      "requestInputs",
      "Request Inputs",
      { x: 40, y: 300 },
      {
        ...requestConfig,
        textField: "Describe this uploaded image.",
      },
    ),
    createSampleNode(
      "crop-image-1",
      "cropImage",
      "Crop Image #1",
      { x: 420, y: 60 },
      {
        xPercent: 0,
        yPercent: 0,
        widthPercent: 50,
        heightPercent: 50,
      } satisfies CropImageConfig,
    ),
    createSampleNode(
      "crop-image-2",
      "cropImage",
      "Crop Image #2",
      { x: 420, y: 520 },
      {
        xPercent: 50,
        yPercent: 50,
        widthPercent: 50,
        heightPercent: 50,
      } satisfies CropImageConfig,
    ),
    createSampleNode("gemini-1", "geminiPro", "Gemini #1", { x: 420, y: 300 }),
    createSampleNode("gemini-2", "geminiPro", "Gemini #2", { x: 820, y: 180 }),
    createSampleNode(
      "gemini-final",
      "geminiPro",
      "Final Gemini",
      { x: 1220, y: 300 },
    ),
    createSampleNode(
      RESPONSE_NODE_ID,
      "response",
      "Response",
      { x: 1620, y: 300 },
    ),
  ];

  const edges: WorkflowCanvasEdge[] = [
    createEdge(
      "edge-request-crop1",
      REQUEST_INPUTS_NODE_ID,
      "image_field",
      "crop-image-1",
      "input_image",
    ),
    createEdge(
      "edge-request-crop2",
      REQUEST_INPUTS_NODE_ID,
      "image_field",
      "crop-image-2",
      "input_image",
    ),
    createEdge(
      "edge-request-gemini1",
      REQUEST_INPUTS_NODE_ID,
      "text_field",
      "gemini-1",
      "prompt",
    ),
    createEdge(
      "edge-gemini1-gemini2",
      "gemini-1",
      "response",
      "gemini-2",
      "prompt",
    ),
    createEdge(
      "edge-crop1-final",
      "crop-image-1",
      "output_image",
      "gemini-final",
      "image_vision",
    ),
    createEdge(
      "edge-crop2-final",
      "crop-image-2",
      "output_image",
      "gemini-final",
      "image_vision",
    ),
    createEdge(
      "edge-gemini2-final",
      "gemini-2",
      "response",
      "gemini-final",
      "prompt",
    ),
    createEdge(
      "edge-final-response",
      "gemini-final",
      "response",
      RESPONSE_NODE_ID,
      "result",
    ),
  ];

  return { nodes, edges };
}

export function downloadWorkflowJson(
  exportDoc: WorkflowExportDocument,
  fileName: string,
): void {
  const blob = new Blob([JSON.stringify(exportDoc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".json") ? fileName : `${fileName}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
