"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, ensureDbReady } from "@/lib/db";
import {
  createDefaultGraph,
  isGraphEmpty,
  parseStoredGraph,
} from "@/lib/workflow/canvas";
import { parseGraphPayload } from "@/lib/workflow/graph-payload";
import type { ActionResult } from "@/types/workflow";
import type { WorkflowBuilderDTO } from "@/types/workflow-canvas";

const saveGraphSchema = z.object({
  id: z.string().min(1),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});

async function requireUserId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

function isWorkflowNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("not found") || message.includes("does not exist");
}

export async function getWorkflowForBuilder(
  id: string,
): Promise<WorkflowBuilderDTO | null> {
  try {
    await ensureDbReady();
    const userId = await requireUserId();
    const workflowId = id.trim();

    if (!workflowId) {
      return null;
    }

    const workflow = await db.workflow.findFirst({
      where: { id: workflowId, userId },
      select: {
        id: true,
        name: true,
        nodes: true,
        edges: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!workflow) {
      return null;
    }

    let nodes;
    let edges;

    try {
      ({ nodes, edges } = parseStoredGraph(workflow.nodes, workflow.edges));
    } catch (parseError) {
      console.error(
        `[getWorkflowForBuilder] Invalid stored graph for ${workflowId}`,
        parseError,
      );
      const defaults = createDefaultGraph();
      nodes = defaults.nodes;
      edges = defaults.edges;
    }

    if (isGraphEmpty(nodes, edges)) {
      const defaults = createDefaultGraph();
      nodes = defaults.nodes;
      edges = defaults.edges;

      try {
        await db.workflow.update({
          where: { id: workflow.id },
          data: {
            nodes: nodes as unknown as object,
            edges: edges as unknown as object,
          },
        });
      } catch (updateError) {
        console.error(
          `[getWorkflowForBuilder] Failed to seed default graph for ${workflowId}`,
          updateError,
        );
      }
    }

    return {
      id: workflow.id,
      name: workflow.name,
      nodes,
      edges,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return null;
    }

    console.error("[getWorkflowForBuilder]", error);
    return null;
  }
}

export async function saveWorkflowGraph(
  input: z.infer<typeof saveGraphSchema>,
): Promise<ActionResult> {
  try {
    await ensureDbReady();
    const userId = await requireUserId();
    const parsed = saveGraphSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid graph data",
      };
    }

    const { id, nodes: rawNodes, edges: rawEdges } = parsed.data;
    const workflowId = id.trim();

    if (!workflowId) {
      return { success: false, error: "Workflow id is missing." };
    }

    const existing = await db.workflow.findFirst({
      where: { id: workflowId, userId },
      select: { id: true },
    });

    if (!existing) {
      return {
        success: false,
        error: "Workflow not found. Return to the dashboard and reopen this workflow.",
      };
    }

    const { nodes, edges } = parseGraphPayload(rawNodes, rawEdges);

    if (nodes.length === 0) {
      return {
        success: false,
        error: "Cannot save an empty workflow graph.",
      };
    }

    await db.workflow.update({
      where: { id: existing.id },
      data: {
        nodes: nodes as unknown as object,
        edges: edges as unknown as object,
      },
    });

    revalidatePath(`/workflow/${existing.id}`);
    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch (error) {
    if (isWorkflowNotFoundError(error)) {
      return {
        success: false,
        error: "Workflow not found. Return to the dashboard and reopen this workflow.",
      };
    }

    const message =
      error instanceof Error ? error.message : "Failed to save workflow";
    return { success: false, error: message };
  }
}
