export type WorkflowStatus = "idle" | "running" | "completed" | "failed";

export type WorkflowSummary = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Serializable shape passed from Server Components to client components */
export type WorkflowSummaryDTO = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export function toWorkflowDTO(workflow: WorkflowSummary): WorkflowSummaryDTO {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  };
}

