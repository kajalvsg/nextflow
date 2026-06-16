import type { NodeExecution } from "@prisma/client";
import { db, ensureDbReady } from "@/lib/db";
import { resolveDatabaseBackend } from "@/lib/db/database-mode";
import { releaseLocalDatabaseAfterWrite } from "@/lib/db/local-pglite";
import { logFullError } from "@/lib/db/prisma-error";
import { compactExecutionPayloadForStorage } from "@/lib/workflow/execution/compact-run-output";
import { defaultLabelForNodeType } from "@/lib/workflow/node-defaults";
import type { RunScope, RunStatus } from "@/types/workflow-execution";
import type { WorkflowNodeType } from "@/types/workflow-canvas";

function logRunStore(message: string): void {
  console.info(`[run-store] ${message}`);
}

async function publishLocalRunState(): Promise<void> {
  const backend = await resolveDatabaseBackend();

  if (backend !== "local") {
    return;
  }

  try {
    await releaseLocalDatabaseAfterWrite();
  } catch (error) {
    logFullError("run-store publishLocalRunState", error);
  }
}

/**
 * Workflow run persistence must use sequential Prisma writes only.
 * Nested creates and $transaction are unsupported on Neon HTTP.
 */
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
    },
  });

  const executions: NodeExecution[] = [];

  try {
    for (const node of input.plannedNodes) {
      const execution = await db.nodeExecution.create({
        data: {
          runId: run.id,
          nodeId: node.id,
          nodeType: node.nodeType,
          status: "pending",
        },
      });
      executions.push(execution);
    }
  } catch (error) {
    logFullError("run-store createWorkflowRunRecord", error);
    await db.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        endedAt: new Date(),
        durationMs: 0,
      },
    });
    throw error;
  }

  logRunStore(
    `created workflow run ${run.id} (${input.scope}, ${input.plannedNodes.length} nodes) -> running`,
  );

  await publishLocalRunState();

  return { ...run, executions };
}

export async function markNodeExecutionRunning(executionId: string) {
  await ensureDbReady();

  const updated = await db.nodeExecution.update({
    where: { id: executionId },
    data: {
      status: "running",
      startedAt: new Date(),
    },
  });

  logRunStore(
    `node execution ${updated.nodeId} (${executionId}) pending -> running`,
  );

  return updated;
}

export async function markNodeExecutionSuccess(
  executionId: string,
  input: unknown,
  output: unknown,
  startedAt: Date,
) {
  await ensureDbReady();

  const endedAt = new Date();
  const storedInput = await compactExecutionPayloadForStorage(
    executionId,
    input,
  );
  const storedOutput = await compactExecutionPayloadForStorage(
    executionId,
    output,
  );

  const updated = await db.nodeExecution.update({
    where: { id: executionId },
    data: {
      status: "success",
      input: storedInput as object,
      output: storedOutput as object,
      endedAt,
      durationMs: endedAt.getTime() - startedAt.getTime(),
    },
  });

  logRunStore(
    `node execution ${updated.nodeId} (${executionId}) -> success (${updated.durationMs ?? 0}ms)`,
  );

  await publishLocalRunState();

  return updated;
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

  const updated = await db.nodeExecution.update({
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

  logRunStore(
    `node execution ${updated.nodeId} (${executionId}) -> failed: ${error}`,
  );

  await publishLocalRunState();

  return updated;
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
      await markNodeExecutionFailed(
        execution.id,
        null,
        "Node did not execute.",
        new Date(),
      );
    }
  }
}

export async function markNodeExecutionSkipped(executionId: string) {
  await ensureDbReady();

  const updated = await db.nodeExecution.update({
    where: { id: executionId },
    data: {
      status: "skipped",
      endedAt: new Date(),
      durationMs: 0,
    },
  });

  logRunStore(
    `node execution ${updated.nodeId} (${executionId}) -> skipped`,
  );

  await publishLocalRunState();

  return updated;
}

export async function resolveWorkflowRunStatus(
  runId: string,
  scope: RunScope,
  options?: { preferFailure?: boolean; hasDemoFallback?: boolean },
): Promise<RunStatus> {
  await ensureDbReady();

  const executions = await db.nodeExecution.findMany({
    where: { runId },
    select: { status: true },
  });

  if (executions.length === 0) {
    return "failed";
  }

  const statuses = executions.map((execution) => execution.status);
  const hasSuccess = statuses.some((status) => status === "success");
  const hasFailed = statuses.some((status) => status === "failed");
  const hasPending = statuses.some(
    (status) => status === "pending" || status === "running",
  );
  const allSkipped = statuses.every((status) => status === "skipped");

  if (hasPending) {
    return "running";
  }

  if (allSkipped || (!hasSuccess && hasFailed)) {
    return scope === "full" ? "failed" : "partial";
  }

  if (!hasSuccess) {
    return scope === "full" ? "failed" : "partial";
  }

  if (hasFailed || options?.preferFailure) {
    if (options?.hasDemoFallback) {
      return "partial";
    }

    return scope === "full" ? "failed" : "partial";
  }

  return "success";
}

export async function finalizeWorkflowRun(
  runId: string,
  status: RunStatus,
  startedAt: Date,
) {
  await ensureDbReady();

  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();

  const updated = await db.workflowRun.update({
    where: { id: runId },
    data: {
      status,
      endedAt,
      durationMs,
    },
  });

  logRunStore(
    `workflow run ${runId} running -> ${status} (${durationMs}ms)`,
  );

  await publishLocalRunState();

  return updated;
}

export function nodeDisplayName(nodeType: string, nodeId: string): string {
  if (nodeType === "requestInputs" || nodeType === "response") {
    return defaultLabelForNodeType(nodeType);
  }

  return defaultLabelForNodeType(nodeType as WorkflowNodeType) || nodeId;
}
