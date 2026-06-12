import { db, ensureDbReady } from "@/lib/db";
import { defaultLabelForNodeType } from "@/lib/workflow/node-defaults";
import type { RunScope, RunStatus } from "@/types/workflow-execution";
import type { WorkflowNodeType } from "@/types/workflow-canvas";

export async function createWorkflowRunRecord(input: {
  workflowId: string;
  userId: string;
  scope: RunScope;
  plannedNodes: Array<{ id: string; nodeType: WorkflowNodeType }>;
}) {
  await ensureDbReady();

  const run = await db.workflowRun.create({
    data: {
      workflowId: input.workflowId,
      userId: input.userId,
      status: "running",
      scope: input.scope,
      executions: {
        create: input.plannedNodes.map((node) => ({
          nodeId: node.id,
          nodeType: node.nodeType,
          status: "pending",
        })),
      },
    },
    include: {
      executions: true,
    },
  });

  return run;
}

export async function markNodeExecutionRunning(executionId: string) {
  await ensureDbReady();

  return db.nodeExecution.update({
    where: { id: executionId },
    data: {
      status: "running",
      startedAt: new Date(),
    },
  });
}

export async function markNodeExecutionSuccess(
  executionId: string,
  input: unknown,
  output: unknown,
  startedAt: Date,
) {
  await ensureDbReady();

  const endedAt = new Date();

  return db.nodeExecution.update({
    where: { id: executionId },
    data: {
      status: "success",
      input: input as object,
      output: output as object,
      endedAt,
      durationMs: endedAt.getTime() - startedAt.getTime(),
    },
  });
}

export async function markNodeExecutionFailed(
  executionId: string,
  input: unknown,
  error: string,
  startedAt: Date,
  fallbackOutput?: unknown,
) {
  await ensureDbReady();

  const endedAt = new Date();

  return db.nodeExecution.update({
    where: { id: executionId },
    data: {
      status: "failed",
      input: input as object,
      output: fallbackOutput ? (fallbackOutput as object) : undefined,
      error,
      endedAt,
      durationMs: endedAt.getTime() - startedAt.getTime(),
    },
  });
}

export async function settlePlannedExecutions(
  executions: Array<{ id: string; nodeId: string; status: string }>,
  plannedNodeIds: Set<string>,
  completedNodeIds: Set<string>,
  executionByNodeId: Map<string, { id: string }>,
) {
  await ensureDbReady();

  for (const nodeId of plannedNodeIds) {
    if (completedNodeIds.has(nodeId)) {
      continue;
    }

    const execution = executionByNodeId.get(nodeId);

    if (!execution) {
      continue;
    }

    const record = executions.find((item) => item.id === execution.id);

    if (record?.status === "pending") {
      await markNodeExecutionSkipped(execution.id);
    }
  }
}

export async function markNodeExecutionSkipped(executionId: string) {
  await ensureDbReady();

  return db.nodeExecution.update({
    where: { id: executionId },
    data: {
      status: "skipped",
      endedAt: new Date(),
      durationMs: 0,
    },
  });
}

export async function finalizeWorkflowRun(
  runId: string,
  status: RunStatus,
  startedAt: Date,
) {
  await ensureDbReady();

  const endedAt = new Date();

  return db.workflowRun.update({
    where: { id: runId },
    data: {
      status,
      endedAt,
      durationMs: endedAt.getTime() - startedAt.getTime(),
    },
  });
}

export function nodeDisplayName(nodeType: string, nodeId: string): string {
  if (nodeType === "requestInputs" || nodeType === "response") {
    return defaultLabelForNodeType(nodeType);
  }

  return defaultLabelForNodeType(nodeType as WorkflowNodeType) || nodeId;
}
