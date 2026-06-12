export class WorkflowBuilderLoadError extends Error {
  readonly code: "DB_ERROR" | "UNAUTHORIZED";

  constructor(message: string, code: "DB_ERROR" | "UNAUTHORIZED") {
    super(message);
    this.name = "WorkflowBuilderLoadError";
    this.code = code;
  }
}

export function isWorkflowBuilderLoadError(
  error: unknown,
): error is WorkflowBuilderLoadError {
  return error instanceof WorkflowBuilderLoadError;
}
