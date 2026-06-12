"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, ensureDbReady } from "@/lib/db";
import { getDbErrorMessage, withDbTimeout } from "@/lib/db/retry";
import type { ActionResult, WorkflowSummary } from "@/types/workflow";
import { toWorkflowDTO, type WorkflowSummaryDTO } from "@/types/workflow";

const createWorkflowSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workflow name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional(),
});

const updateWorkflowSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(1, "Workflow name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional(),
});

const deleteWorkflowSchema = z.object({
  id: z.string().min(1),
});

function serializeWorkflow(workflow: {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): WorkflowSummary {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}

async function requireUserId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

export async function getWorkflows(): Promise<WorkflowSummary[]> {
  try {
    await ensureDbReady();
    const userId = await requireUserId();

    const workflows = await withDbTimeout(() =>
      db.workflow.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );

    return workflows.map(serializeWorkflow);
  } catch (error) {
    console.error("[getWorkflows]", error);
    throw new Error(getDbErrorMessage(error));
  }
}

export async function createWorkflow(
  input: z.infer<typeof createWorkflowSchema>,
): Promise<ActionResult<WorkflowSummaryDTO>> {
  try {
    await ensureDbReady();
    const userId = await requireUserId();
    const parsed = createWorkflowSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const { name, description } = parsed.data;

    const workflow = await db.workflow.create({
      data: {
        name,
        description: description || null,
        userId,
        nodes: [],
        edges: [],
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/workflow/${workflow.id}`);

    return { success: true, data: toWorkflowDTO(serializeWorkflow(workflow)) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create workflow";
    return { success: false, error: message };
  }
}

export async function updateWorkflow(
  input: z.infer<typeof updateWorkflowSchema>,
): Promise<ActionResult<WorkflowSummaryDTO>> {
  try {
    await ensureDbReady();
    const userId = await requireUserId();
    const parsed = updateWorkflowSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const { id, name, description } = parsed.data;

    const existing = await db.workflow.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    const workflow = await db.workflow.update({
      where: { id },
      data: {
        name,
        description: description || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    revalidatePath("/dashboard");

    return { success: true, data: toWorkflowDTO(serializeWorkflow(workflow)) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update workflow";
    return { success: false, error: message };
  }
}

export async function deleteWorkflow(
  input: z.infer<typeof deleteWorkflowSchema>,
): Promise<ActionResult> {
  try {
    await ensureDbReady();
    const userId = await requireUserId();
    const parsed = deleteWorkflowSchema.safeParse(input);

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const { id } = parsed.data;

    const existing = await db.workflow.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      return { success: false, error: "Workflow not found" };
    }

    await db.workflow.delete({ where: { id } });

    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete workflow";
    return { success: false, error: message };
  }
}
