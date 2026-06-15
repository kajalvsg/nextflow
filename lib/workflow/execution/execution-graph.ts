import { db } from "@/lib/db";
import { parseStoredGraph } from "@/lib/workflow/canvas";
import type { GraphPayload } from "@/lib/workflow/graph-payload";
import type {
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
} from "@/types/workflow-canvas";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDataImageUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("data:image/") || trimmed.startsWith("blob:")) {
    return null;
  }

  return trimmed;
}

/** Read image_field data URLs directly from raw stored node JSON (bypasses parse normalization). */
export function extractRequestInputsImageSourcesFromRawNodes(
  nodesJson: unknown,
): Map<string, Record<string, string>> {
  const sources = new Map<string, Record<string, string>>();
  const nodes = Array.isArray(nodesJson) ? nodesJson : [];

  for (const node of nodes) {
    if (!isRecord(node) || !isRecord(node.data)) {
      continue;
    }

    if (node.data.nodeType !== "requestInputs") {
      continue;
    }

    const nodeId = typeof node.id === "string" ? node.id : null;

    if (!nodeId) {
      continue;
    }

    const config = node.data.config;

    if (!isRecord(config) || !Array.isArray(config.fields)) {
      continue;
    }

    const fieldSources: Record<string, string> = {};

    for (const field of config.fields) {
      if (!isRecord(field) || field.type !== "image_field") {
        continue;
      }

      const fieldId = typeof field.id === "string" ? field.id : null;

      if (!fieldId) {
        continue;
      }

      const imageValue = isRecord(field.imageValue) ? field.imageValue : null;
      const meta = isRecord(field.meta)
        ? field.meta
        : isRecord(imageValue?.meta)
          ? imageValue.meta
          : null;

      const dataUrl =
        readDataImageUrl(field.dataUrl) ??
        readDataImageUrl(field.value) ??
        readDataImageUrl(imageValue?.dataUrl) ??
        readDataImageUrl(imageValue?.value) ??
        readDataImageUrl(imageValue?.executionUrl) ??
        readDataImageUrl(meta?.dataUrl) ??
        null;

      if (dataUrl) {
        fieldSources[fieldId] = dataUrl;
      }
    }

    if (Object.keys(fieldSources).length > 0) {
      sources.set(nodeId, fieldSources);
    }
  }

  return sources;
}

export function logRequestInputsImageSources(
  nodeId: string,
  sources: Record<string, string>,
): void {
  for (const [fieldId, dataUrl] of Object.entries(sources)) {
    console.info(
      `[execution-graph] ${nodeId}.${fieldId} hasDataUrl=${dataUrl.startsWith("data:image/")}`,
    );
  }
}

export function buildRequestInputsOutputFromRawSources(
  fieldSources: Record<string, string>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const [fieldId, dataUrl] of Object.entries(fieldSources)) {
    const payload = {
      dataUrl,
      fileUrl: null,
      value: dataUrl,
      meta: {
        dataUrl,
        fileUrl: null,
      },
    };

    output[fieldId] = payload;
    output[`${fieldId}_meta`] = payload;
  }

  return output;
}

function hasExecutableImagePayload(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return typeof value === "string" && value.startsWith("data:image/");
  }

  const record = value as Record<string, unknown>;

  return Boolean(
    readDataImageUrl(record.dataUrl) ??
      readDataImageUrl(record.value) ??
      (isRecord(record.meta) ? readDataImageUrl(record.meta.dataUrl) : null),
  );
}

/** Keep raw-seeded image outputs when local node output lacks dataUrl. */
export function mergeRequestInputsOutputs(
  seeded: Record<string, unknown>,
  computed: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...computed };

  for (const [key, seededValue] of Object.entries(seeded)) {
    const computedValue = computed[key];

    if (
      key === "image_field" ||
      key.startsWith("image_field") ||
      key.endsWith("_meta")
    ) {
      if (hasExecutableImagePayload(seededValue)) {
        merged[key] = seededValue;
        continue;
      }

      if (hasExecutableImagePayload(computedValue)) {
        merged[key] = computedValue;
        continue;
      }
    }

    if (computedValue !== undefined) {
      merged[key] = computedValue;
    } else {
      merged[key] = seededValue;
    }
  }

  return merged;
}

export async function persistExecutionGraphRaw(
  workflowId: string,
  userId: string,
  nodes: unknown[],
  edges: unknown[],
): Promise<boolean> {
  const existing = await db.workflow.findFirst({
    where: { id: workflowId, userId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await db.workflow.update({
    where: { id: existing.id },
    data: {
      nodes: nodes as object,
      edges: edges as object,
    },
  });

  return true;
}

export async function loadExecutionGraphFromWorkflow(
  workflowId: string,
  userId: string,
): Promise<{
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  rawNodes: unknown;
  rawEdges: unknown;
} | null> {
  const workflow = await db.workflow.findFirst({
    where: { id: workflowId, userId },
    select: { nodes: true, edges: true },
  });

  if (!workflow) {
    return null;
  }

  const { nodes, edges } = parseStoredGraph(workflow.nodes, workflow.edges);

  return {
    nodes,
    edges,
    rawNodes: workflow.nodes,
    rawEdges: workflow.edges,
  };
}

export type ExecutionGraph = GraphPayload;
