"use server";

import { auth } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { access } from "node:fs/promises";
import path from "node:path";
import { db, ensureDbReady, withFreshLocalRead } from "@/lib/db";
import { isPgStorageCorruptionError } from "@/lib/db/prisma-error";
import { resolveProjectRoot } from "@/lib/db/project-root";
import { parseStoredGraph } from "@/lib/workflow/canvas";
import { getRunOutputAssetPath } from "@/lib/workflow/execution/compact-run-output";
import { planExecutionNodeIds } from "@/lib/workflow/execution/dag";
import {
  hasSuccessfulRunOutputs,
  mapExecutionsToSnapshots,
  mapRunDetailToInlineExecutions,
  mapSnapshotsToInlineState,
} from "@/lib/workflow/execution/run-inline-executions";
import { persistExecutionGraphRaw } from "@/lib/workflow/execution/execution-graph";
import { createWorkflowRunRecord, nodeDisplayName } from "@/lib/workflow/execution/run-store";
import type { workflowOrchestratorTask } from "@/trigger/workflow-orchestrator";
import type {
  ActiveRunState,
  NodeExecutionDetail,
  NodeExecutionSnapshot,
  NodeInlineExecutionState,
  NodeRuntimeStatus,
  RunScope,
  StartRunResult,
  WorkflowRunDetail,
  WorkflowRunSummary,
} from "@/types/workflow-execution";

const startRunSchema = z.object({
  workflowId: z.string().min(1),
  scope: z.enum(["full", "single", "partial"]),
  selectedNodeIds: z.array(z.string()).optional(),
  nodes: z.array(z.unknown()).min(1, "Execution graph nodes are required."),
  edges: z.array(z.unknown()),
});

async function requireUserId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

function getTriggerConfigError(): string | null {
  if (!process.env.TRIGGER_SECRET_KEY) {
    return "Trigger.dev is not configured. Set TRIGGER_SECRET_KEY and run `npm run trigger:dev` alongside the app.";
  }

  return null;
}

function mapRunExecutions(
  executions: Array<{
    id: string;
    nodeId: string;
    nodeType: string;
    status: string;
    input: unknown;
    output: unknown;
    error: string | null;
    startedAt: Date;
    endedAt: Date | null;
    durationMs: number | null;
  }>,
): NodeExecutionDetail[] {
  return executions.map(
    (execution): NodeExecutionDetail => ({
      id: execution.id,
      nodeId: execution.nodeId,
      nodeType: execution.nodeType,
      nodeName: nodeDisplayName(execution.nodeType, execution.nodeId),
      status: execution.status as NodeExecutionDetail["status"],
      input: execution.input,
      output: execution.output,
      error: execution.error,
      startedAt: execution.startedAt.toISOString(),
      endedAt: execution.endedAt?.toISOString() ?? null,
      durationMs: execution.durationMs,
    }),
  );
}

export async function getWorkflowRunInlineExecutions(
  runId: string,
): Promise<Record<string, NodeInlineExecutionState>> {
  const detail = await getWorkflowRunDetail(runId);

  if (!detail) {
    return {};
  }

  return mapRunDetailToInlineExecutions(detail);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getWorkflowRunInlineExecutionsWithRetry(
  runId: string,
  maxAttempts = 8,
): Promise<Record<string, NodeInlineExecutionState>> {
  let last: Record<string, NodeInlineExecutionState> = {};

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await getWorkflowRunInlineExecutions(runId);

    if (hasSuccessfulRunOutputs(last) || attempt === maxAttempts) {
      return last;
    }

    await wait(500 * attempt);
  }

  return last;
}

/** Poll a specific run until outputs appear (Neon / Trigger read-after-write). */
export async function waitForWorkflowRunOutputs(
  runId: string,
  maxWaitMs = 45_000,
): Promise<Record<string, NodeInlineExecutionState>> {
  const startedAt = Date.now();
  let attempt = 0;
  let last: Record<string, NodeInlineExecutionState> = {};

  while (Date.now() - startedAt < maxWaitMs) {
    attempt += 1;
    last = await getWorkflowRunInlineExecutions(runId);

    if (hasSuccessfulRunOutputs(last)) {
      return last;
    }

    await wait(Math.min(500 * attempt, 2_000));
  }

  return last;
}

function buildActiveRunStateFromDetail(
  detail: WorkflowRunDetail,
): ActiveRunState {
  const nodeStatuses: Record<string, NodeRuntimeStatus> = {};
  const activeNodeIds: string[] = [];

  for (const execution of detail.executions) {
    if (execution.status === "running") {
      nodeStatuses[execution.nodeId] = "running";
      activeNodeIds.push(execution.nodeId);
    } else if (execution.status === "success") {
      nodeStatuses[execution.nodeId] = "success";
    } else if (execution.status === "failed") {
      nodeStatuses[execution.nodeId] = "failed";
    } else {
      nodeStatuses[execution.nodeId] = "idle";
    }
  }

  return {
    runId: detail.id,
    status: detail.status,
    nodeStatuses,
    activeNodeIds,
    nodeExecutions: mapExecutionsToSnapshots(detail.executions),
  };
}

async function fetchWorkflowRunStatus(
  runId: string,
): Promise<WorkflowRunSummary["status"] | null> {
  const userId = await requireUserId();

  const row = await withFreshLocalRead(async (client) =>
    client.workflowRun.findFirst({
      where: { id: runId, userId },
      select: { status: true },
    }),
  );

  return row
    ? (row.status as WorkflowRunSummary["status"])
    : null;
}

/**
 * Retry run status reads inside one server-action round trip (Neon / Trigger lag).
 */
export async function pollActiveWorkflowRun(
  runId: string,
  maxWaitMs = 12_000,
): Promise<ActiveRunState | null> {
  const startedAt = Date.now();
  let attempt = 0;
  let lastStatus: WorkflowRunSummary["status"] | null = null;

  while (Date.now() - startedAt < maxWaitMs) {
    attempt += 1;
    lastStatus = await fetchWorkflowRunStatus(runId);

    if (!lastStatus) {
      return null;
    }

    if (lastStatus !== "running") {
      break;
    }

    if (attempt >= 8) {
      break;
    }

    await wait(Math.min(400 * attempt, 1_500));
  }

  const detail = await getWorkflowRunDetail(runId);

  if (!detail) {
    return null;
  }

  return buildActiveRunStateFromDetail(detail);
}

export async function getLatestWorkflowInlineExecutions(
  workflowId: string,
): Promise<Record<string, NodeInlineExecutionState>> {
  const userId = await requireUserId();

  return withFreshLocalRead(async (client) => {
    const latest = await client.workflowRun.findFirst({
      where: {
        workflowId,
        userId,
        status: { not: "running" },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    if (!latest) {
      return {};
    }

    const run = await loadWorkflowRunWithExecutions(client, latest.id, userId);

    if (!run) {
      return {};
    }

    const executions = await Promise.all(
      mapRunExecutions(
        run.executions.map((execution) => ({
          ...execution,
          input: execution.input ?? null,
          output: execution.output ?? null,
        })),
      ).map(async (execution) => ({
        ...execution,
        output: await hydrateCropOutputFromDisk(
          execution.id,
          execution.nodeType,
          execution.status,
          execution.output,
        ),
      })),
    );

    return mapSnapshotsToInlineState(mapExecutionsToSnapshots(executions));
  });
}

export async function startWorkflowRun(
  input: z.infer<typeof startRunSchema>,
): Promise<StartRunResult> {
  try {
    await ensureDbReady();
    const userId = await requireUserId();
    const triggerError = getTriggerConfigError();

    if (triggerError) {
      return { success: false, error: triggerError };
    }

    const parsed = startRunSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid run request.",
      };
    }

    const {
      workflowId,
      scope,
      selectedNodeIds = [],
      nodes: clientNodes,
      edges: clientEdges,
    } = parsed.data;
    const normalizedWorkflowId = workflowId.trim();

    const workflow = await db.workflow.findFirst({
      where: { id: normalizedWorkflowId, userId },
      select: { id: true },
    });

    if (!workflow) {
      return {
        success: false,
        error: `Workflow not found for "${normalizedWorkflowId}". Save the workflow and try again.`,
      };
    }

    if (scope === "single" && selectedNodeIds.length === 0) {
      return { success: false, error: "Select a node to run." };
    }

    if (scope === "partial" && selectedNodeIds.length === 0) {
      return {
        success: false,
        error: "Select one or more nodes to run.",
      };
    }

    const graph = parseStoredGraph(clientNodes, clientEdges);
    const plannedNodeIds = planExecutionNodeIds(
      scope as RunScope,
      graph.nodes,
      graph.edges,
      selectedNodeIds,
    );

    const plannedNodes = graph.nodes
      .filter((node) => plannedNodeIds.includes(node.id))
      .map((node) => ({
        id: node.id,
        nodeType: node.data.nodeType,
      }));

    const persisted = await persistExecutionGraphRaw(
      normalizedWorkflowId,
      userId,
      clientNodes,
      clientEdges,
    );

    if (!persisted) {
      return {
        success: false,
        error: "Failed to persist workflow graph before run.",
      };
    }

    const run = await createWorkflowRunRecord({
      workflowId: normalizedWorkflowId,
      userId,
      scope: scope as RunScope,
      plannedNodes,
    });

    await tasks.trigger<typeof workflowOrchestratorTask>(
      "workflow-orchestrator",
      {
        runId: run.id,
        workflowId: normalizedWorkflowId,
        userId,
        scope: scope as RunScope,
        plannedNodeIds,
        targetNodeIds:
          scope === "single"
            ? selectedNodeIds.slice(0, 1)
            : scope === "partial"
              ? selectedNodeIds
              : [],
        nodeExecutionIds: run.executions.map((execution) => ({
          nodeId: execution.nodeId,
          executionId: execution.id,
        })),
      },
    );

    return { success: true, runId: run.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start workflow run.";
    return { success: false, error: message };
  }
}

export async function getWorkflowRunHistory(
  workflowId: string,
): Promise<WorkflowRunSummary[]> {
  const userId = await requireUserId();

  return withFreshLocalRead(async (client) => {
    const runs = await client.workflowRun.findMany({
      where: { workflowId, userId },
      orderBy: { startedAt: "desc" },
      include: {
        _count: {
          select: { executions: true },
        },
      },
    });

    return runs.map((run) => ({
      id: run.id,
      workflowId: run.workflowId,
      status: run.status as WorkflowRunSummary["status"],
      scope: run.scope as WorkflowRunSummary["scope"],
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      executionCount: run._count.executions,
    }));
  });
}

type RunWithExecutions = {
  id: string;
  workflowId: string;
  status: string;
  scope: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number | null;
  executions: Array<{
    id: string;
    nodeId: string;
    nodeType: string;
    status: string;
    input?: unknown;
    output?: unknown;
    error: string | null;
    startedAt: Date;
    endedAt: Date | null;
    durationMs: number | null;
  }>;
};

async function hydrateCropOutputFromDisk(
  executionId: string,
  nodeType: string,
  status: string,
  output: unknown,
): Promise<unknown> {
  if (output != null || status !== "success" || nodeType !== "cropImage") {
    return output ?? null;
  }

  const publicUrl = getRunOutputAssetPath(executionId);
  const absolutePath = path.join(resolveProjectRoot(), "public", publicUrl);

  try {
    await access(absolutePath);
    return {
      output_image: publicUrl,
      outputImage: publicUrl,
      fileUrl: publicUrl,
    };
  } catch {
    return null;
  }
}

async function loadWorkflowRunWithExecutions(
  client: typeof db,
  runId: string,
  userId: string,
): Promise<RunWithExecutions | null> {
  try {
    return await client.workflowRun.findFirst({
      where: { id: runId, userId },
      include: {
        executions: {
          orderBy: { startedAt: "asc" },
        },
      },
    });
  } catch (error) {
    if (!isPgStorageCorruptionError(error)) {
      throw error;
    }

    console.warn(
      "[workflow-execution] PGlite TOAST corruption while loading run detail — using metadata-only fallback",
    );

    const run = await client.workflowRun.findFirst({
      where: { id: runId, userId },
      include: {
        executions: {
          orderBy: { startedAt: "asc" },
          select: {
            id: true,
            nodeId: true,
            nodeType: true,
            status: true,
            error: true,
            startedAt: true,
            endedAt: true,
            durationMs: true,
          },
        },
      },
    });

    if (!run) {
      return null;
    }

    const executions = await Promise.all(
      run.executions.map(async (execution) => {
        let output: unknown = null;

        try {
          const row = await client.nodeExecution.findUnique({
            where: { id: execution.id },
            select: { output: true },
          });
          output = row?.output ?? null;
        } catch {
          output = null;
        }

        output = await hydrateCropOutputFromDisk(
          execution.id,
          execution.nodeType,
          execution.status,
          output,
        );

        return {
          ...execution,
          input: null,
          output,
        };
      }),
    );

    return {
      ...run,
      executions,
    };
  }
}

export async function getWorkflowRunDetail(
  runId: string,
): Promise<WorkflowRunDetail | null> {
  const userId = await requireUserId();

  return withFreshLocalRead(async (client) => {
    const run = await loadWorkflowRunWithExecutions(client, runId, userId);

    if (!run) {
      return null;
    }

    const executions = await Promise.all(
      mapRunExecutions(
        run.executions.map((execution) => ({
          ...execution,
          input: execution.input ?? null,
          output: execution.output ?? null,
        })),
      ).map(async (execution) => ({
        ...execution,
        output: await hydrateCropOutputFromDisk(
          execution.id,
          execution.nodeType,
          execution.status,
          execution.output,
        ),
      })),
    );

    return {
      id: run.id,
      workflowId: run.workflowId,
      status: run.status as WorkflowRunDetail["status"],
      scope: run.scope as WorkflowRunDetail["scope"],
      startedAt: run.startedAt.toISOString(),
      endedAt: run.endedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      executionCount: executions.length,
      executions,
    };
  });
}

export async function getActiveRunState(
  runId: string,
): Promise<ActiveRunState | null> {
  const detail = await getWorkflowRunDetail(runId);

  if (!detail) {
    return null;
  }

  return buildActiveRunStateFromDetail(detail);
}
