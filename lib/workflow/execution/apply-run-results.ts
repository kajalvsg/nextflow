import type { Node } from "reactflow";
import { normalizeCropExecutionOutput } from "@/lib/workflow/execution/crop-output-normalize";
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import type { NodeInlineExecutionState } from "@/types/workflow-execution";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function buildCropNodeDataFromOutput(
  data: WorkflowNodeData,
  output: unknown,
): WorkflowNodeData | null {
  const normalized = normalizeCropExecutionOutput(output);

  if (!normalized) {
    return null;
  }

  const imageUrl = normalized.output_image;

  return {
    ...data,
    outputs: normalized,
    outputImage: imageUrl,
    output_image: imageUrl,
    dataUrl: normalized.dataUrl ?? (imageUrl.startsWith("data:") ? imageUrl : null),
  };
}

function hasNormalizedCropOutput(output: unknown): boolean {
  return normalizeCropExecutionOutput(output) !== null;
}

function buildInlineOutputFromNodeData(
  data: WorkflowNodeData,
): Record<string, unknown> | null {
  if (isRecord(data.outputs) && hasNormalizedCropOutput(data.outputs)) {
    return data.outputs;
  }

  const imageUrl =
    (typeof data.output_image === "string" && data.output_image.trim()) ||
    (typeof data.outputImage === "string" && data.outputImage.trim()) ||
    (typeof data.dataUrl === "string" && data.dataUrl.trim()) ||
    null;

  if (!imageUrl) {
    return null;
  }

  return normalizeCropExecutionOutput({
    output_image: imageUrl,
    outputImage: imageUrl,
    dataUrl: data.dataUrl ?? imageUrl,
    width: isRecord(data.outputs) ? data.outputs.width : undefined,
    height: isRecord(data.outputs) ? data.outputs.height : undefined,
  });
}

/** Prefer successful inline state, then persisted node.data output fields. */
export function resolveCropNodeDisplayExecution(
  inlineExecution: NodeInlineExecutionState | null,
  data: WorkflowNodeData,
): NodeInlineExecutionState | null {
  if (
    inlineExecution?.status === "success" ||
    inlineExecution?.status === "failed"
  ) {
    return inlineExecution;
  }

  const output = buildInlineOutputFromNodeData(data);

  if (output) {
    return {
      status: "success",
      output,
      error: null,
    };
  }

  return inlineExecution;
}

export function hasCropNodeOutputImage(
  inlineExecution: NodeInlineExecutionState | null,
  data: WorkflowNodeData,
): boolean {
  const resolved = resolveCropNodeDisplayExecution(inlineExecution, data);
  return Boolean(
    hasNormalizedCropOutput(resolved?.output) ||
      hasNormalizedCropOutput(data.outputs) ||
      hasNormalizedCropOutput({
        output_image: data.output_image,
        outputImage: data.outputImage,
        dataUrl: data.dataUrl,
      }),
  );
}

export function applyRunResultsToNodes(
  nodes: Node<WorkflowNodeData>[],
  executions: Record<string, NodeInlineExecutionState>,
): Node<WorkflowNodeData>[] {
  if (Object.keys(executions).length === 0) {
    return nodes;
  }

  return nodes.map((node) => {
    const execution = executions[node.id];

    if (!execution || execution.status !== "success") {
      return node;
    }

    if (node.data.nodeType === "cropImage") {
      const nextData = buildCropNodeDataFromOutput(node.data, execution.output);

      if (!nextData) {
        return node;
      }

      return {
        ...node,
        data: nextData,
      };
    }

    if (isRecord(execution.output)) {
      return {
        ...node,
        data: {
          ...node.data,
          outputs: execution.output,
        },
      };
    }

    return node;
  });
}
