"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createDefaultGraph,
  isGraphEmpty,
  parseStoredGraph,
  sanitizeGraphForSave,
} from "@/lib/workflow/canvas";
import type { ActionResult } from "@/types/workflow";
import type { WorkflowBuilderDTO } from "@/types/workflow-canvas";

const saveGraphSchema = z.object({
  id: z.string().min(1),
  nodes: z.array(z.record(z.string(), z.unknown())),
  edges: z.array(z.record(z.string(), z.unknown())),
});

async function requireUserId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

export async function getWorkflowForBuilder(
  id: string,
): Promise<WorkflowBuilderDTO | null> {
  const userId = await requireUserId();

  const workflow = await db.workflow.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      nodes: true,
      edges: true,
    },
  });

  if (!workflow) {
    return null;
  }

  let { nodes, edges } = parseStoredGraph(workflow.nodes, workflow.edges);

  if (isGraphEmpty(nodes, edges)) {
    const defaults = createDefaultGraph();
    nodes = defaults.nodes;
    edges = defaults.edges;

    await db.workflow.update({
      where: { id: workflow.id },
      data: {
        nodes: nodes as unknown as object,
        edges: edges as unknown as object,
      },
    });
  }

  return {
    id: workflow.id,
    name: workflow.name,
    nodes,
    edges,
  };
}

export async function saveWorkflowGraph(
  input: z.infer<typeof saveGraphSchema>,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = saveGraphSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid graph data",
      };
    }

    const { id, nodes: rawNodes, edges: rawEdges } = parsed.data;

    const existing = await db.workflow.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    const parsedGraph = parseStoredGraph(rawNodes, rawEdges);
    const { nodes, edges } = sanitizeGraphForSave(
      parsedGraph.nodes,
      parsedGraph.edges,
    );

    await db.workflow.update({
      where: { id },
      data: {
        nodes: nodes as unknown as object,
        edges: edges as unknown as object,
      },
    });

    revalidatePath(`/workflow/${id}`);
    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save workflow";
    return { success: false, error: message };
  }
}
