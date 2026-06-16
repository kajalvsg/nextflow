import { normalizeCropExecutionOutput } from "@/lib/workflow/execution/crop-output-normalize";
import type {
  NodeExecutionDetail,
  NodeExecutionSnapshot,
  NodeInlineExecutionState,
  NodeRuntimeStatus,
  WorkflowRunDetail,
} from "@/types/workflow-execution";

function mapExecutionStatusToRuntime(
  status: NodeExecutionDetail["status"],
): NodeRuntimeStatus | null {
  if (status === "running") {
    return "running";
  }

  if (status === "success") {
    return "success";
  }

  if (status === "failed") {
    return "failed";
  }

  return null;
}

function normalizeExecutionOutput(
  nodeType: string,
  output: unknown,
): unknown {
  if (nodeType === "cropImage") {
    return normalizeCropExecutionOutput(output) ?? output;
  }

  return output;
}

export function mapExecutionsToInlineState(
  executions: NodeExecutionDetail[],
): Record<string, NodeInlineExecutionState> {
  const nodeExecutions: Record<string, NodeInlineExecutionState> = {};

  for (const execution of executions) {
    const runtimeStatus = mapExecutionStatusToRuntime(execution.status);

    if (!runtimeStatus) {
      continue;
    }

    nodeExecutions[execution.nodeId] = {
      status: runtimeStatus,
      output: normalizeExecutionOutput(execution.nodeType, execution.output),
      error: execution.error,
    };
  }

  return nodeExecutions;
}

export function mapExecutionsToSnapshots(
  executions: NodeExecutionDetail[],
): Record<string, NodeExecutionSnapshot> {
  const nodeExecutions: Record<string, NodeExecutionSnapshot> = {};

  for (const execution of executions) {
    const runtimeStatus = mapExecutionStatusToRuntime(execution.status);

    if (!runtimeStatus) {
      continue;
    }

    nodeExecutions[execution.nodeId] = {
      status: runtimeStatus,
      output: normalizeExecutionOutput(execution.nodeType, execution.output),
      error: execution.error,
    };
  }

  return nodeExecutions;
}

export function mapSnapshotsToInlineState(
  snapshots: Record<string, NodeExecutionSnapshot>,
): Record<string, NodeInlineExecutionState> {
  return Object.fromEntries(
    Object.entries(snapshots).map(([nodeId, snapshot]) => [
      nodeId,
      {
        status: snapshot.status,
        output: snapshot.output,
        error: snapshot.error,
      },
    ]),
  );
}

export function mapRunDetailToInlineExecutions(
  detail: WorkflowRunDetail,
): Record<string, NodeInlineExecutionState> {
  return mapExecutionsToInlineState(detail.executions);
}

export function hasSuccessfulRunOutputs(
  executions: Record<string, NodeInlineExecutionState>,
): boolean {
  return Object.values(executions).some(
    (execution) =>
      execution.status === "success" && execution.output != null,
  );
}
