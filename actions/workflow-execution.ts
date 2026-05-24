"use server";

import { auth } from "@clerk/nextjs/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseStoredGraph } from "@/lib/workflow/canvas";
import { prepareGraphPayload } from "@/lib/workflow/graph-payload";
import { planExecutionNodeIds } from "@/lib/workflow/execution/dag";
import { createWorkflowRunRecord, nodeDisplayName } from "@/lib/workflow/execution/run-store";
import type { workflowOrchestratorTask } from "@/trigger/workflow-orchestrator";
import type {
  ActiveRunState,
  NodeExecutionDetail,
  RunScope,
  StartRunResult,
  WorkflowRunDetail,
  WorkflowRunSummary,
} from "@/types/workflow-execution";
import type { NodeRuntimeStatus } from "@/types/workflow-execution";

const startRunSchema = z.object({
  workflowId: z.string().min(1),
  scope: z.enum(["full", "single", "partial"]),
  selectedNodeIds: z.array(z.string()).optional(),
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

export async function startWorkflowRun(
  input: z.infer<typeof startRunSchema>,
): Promise<StartRunResult> {
  try {
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

    const { workflowId, scope, selectedNodeIds = [] } = parsed.data;
    const normalizedWorkflowId = workflowId.trim();

    const workflow = await db.workflow.findFirst({
      where: { id: normalizedWorkflowId, userId },
      select: { id: true, nodes: true, edges: true },
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

    const graph = parseStoredGraph(workflow.nodes, workflow.edges);
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

    const run = await createWorkflowRunRecord({
      workflowId: normalizedWorkflowId,
      userId,
      scope: scope as RunScope,
      plannedNodes,
    });

    const sanitized = prepareGraphPayload(graph.nodes, graph.edges);

    await tasks.trigger<typeof workflowOrchestratorTask>(
      "workflow-orchestrator",
      {
        runId: run.id,
        workflowId: normalizedWorkflowId,
        userId,
        scope: scope as RunScope,
        nodes: sanitized.nodes as unknown as Record<string, unknown>[],
        edges: sanitized.edges as unknown as Record<string, unknown>[],
        plannedNodeIds,
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

  const runs = await db.workflowRun.findMany({
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
}

export async function getWorkflowRunDetail(
  runId: string,
): Promise<WorkflowRunDetail | null> {
  const userId = await requireUserId();

  const run = await db.workflowRun.findFirst({
    where: { id: runId, userId },
    include: {
      executions: {
        orderBy: { startedAt: "asc" },
      },
    },
  });

  if (!run) {
    return null;
  }

  return {
    id: run.id,
    workflowId: run.workflowId,
    status: run.status as WorkflowRunDetail["status"],
    scope: run.scope as WorkflowRunDetail["scope"],
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
    executionCount: run.executions.length,
    executions: run.executions.map(
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
    ),
  };
}

export async function getActiveRunState(
  runId: string,
): Promise<ActiveRunState | null> {
  const detail = await getWorkflowRunDetail(runId);

  if (!detail) {
    return null;
  }

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
  };
}
