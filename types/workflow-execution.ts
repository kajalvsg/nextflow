export type RunScope = "full" | "single" | "partial";

export type RunStatus = "running" | "success" | "failed" | "partial";

export type NodeExecutionStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export type NodeRuntimeStatus = "idle" | "running" | "success" | "failed";

export type NodeInlineExecutionState = {
  status: NodeRuntimeStatus | "updating";
  output: unknown;
  error: string | null;
};

export type NodeExecutionSnapshot = {
  status: NodeRuntimeStatus;
  output: unknown;
  error: string | null;
};

export type WorkflowRunSummary = {
  id: string;
  workflowId: string;
  status: RunStatus;
  scope: RunScope;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  executionCount: number;
};

export type NodeExecutionDetail = {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeName: string;
  status: NodeExecutionStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
};

export type WorkflowRunDetail = WorkflowRunSummary & {
  executions: NodeExecutionDetail[];
};

export type ActiveRunState = {
  runId: string;
  status: RunStatus;
  nodeStatuses: Record<string, NodeRuntimeStatus>;
  activeNodeIds: string[];
  nodeExecutions: Record<string, NodeExecutionSnapshot>;
};

export type StartRunInput = {
  workflowId: string;
  scope: RunScope;
  selectedNodeIds?: string[];
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
};

export type StartRunResult =
  | { success: true; runId: string }
  | { success: false; error: string };
