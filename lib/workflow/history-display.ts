import type { NodeExecutionDetail } from "@/types/workflow-execution";
import type { RunScope, RunStatus } from "@/types/workflow-execution";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatHistoryDuration(durationMs: number | null): string {
  if (durationMs == null) {
    return "—";
  }

  if (durationMs < 1000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

export function formatHistoryRunTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatHistoryRunTimestampShort(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatHistoryScopeLabel(scope: RunScope): string {
  switch (scope) {
    case "full":
      return "Full Workflow";
    case "single":
      return "Single Node";
    case "partial":
      return "Partial Run";
    default:
      return scope;
  }
}

export function formatHistoryRunStatusLabel(status: RunStatus): string {
  switch (status) {
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
    case "partial":
      return "Partial";
    default:
      return status;
  }
}

export function getHistoryRunNumber(
  runs: Array<{ id: string }>,
  runId: string,
): number {
  const index = runs.findIndex((run) => run.id === runId);

  if (index === -1) {
    return runs.length;
  }

  return runs.length - index;
}

export function truncateDisplayUrl(url: string, maxLength = 45): string {
  const trimmed = url.trim();

  if (!trimmed) {
    return "—";
  }

  if (trimmed.startsWith("data:")) {
    const commaIndex = trimmed.indexOf(",");

    if (commaIndex === -1) {
      return trimmed.length > maxLength
        ? `${trimmed.slice(0, maxLength - 3)}...`
        : trimmed;
    }

    const header = trimmed.slice(0, commaIndex + 1);
    const payload = trimmed.slice(commaIndex + 1);
    const budget = Math.max(8, maxLength - header.length);

    if (header.length + payload.length <= maxLength) {
      return trimmed;
    }

    return `${header}${payload.slice(0, budget)}...`;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function truncateQuotedText(text: string, maxLength = 60): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "—";
  }

  if (normalized.length <= maxLength) {
    return `"${normalized}"`;
  }

  return `"${normalized.slice(0, maxLength).trim()}..."`;
}

function summarizeRequestInputsOutput(output: unknown): string {
  if (!isRecord(output)) {
    return "—";
  }

  const fieldNames = Object.keys(output)
    .filter((key) => !key.endsWith("_meta"))
    .sort();

  return fieldNames.length > 0 ? fieldNames.join(", ") : "—";
}

function summarizeCropImageOutput(output: unknown): string {
  if (!isRecord(output) || typeof output.output_image !== "string") {
    return "—";
  }

  const url = output.output_image.trim();

  if (!url) {
    return "—";
  }

  return "Cropped image generated";
}

export function getCropImageHistoryUrl(output: unknown): string | null {
  if (!isRecord(output) || typeof output.output_image !== "string") {
    return null;
  }

  const url = output.output_image.trim();
  return url.length > 0 ? url : null;
}

function extractResponseText(output: unknown): string | null {
  if (!isRecord(output)) {
    return null;
  }

  const result = output.result;

  if (typeof result === "string" && result.trim()) {
    return result.trim();
  }

  if (isRecord(result) && typeof result.response === "string" && result.response.trim()) {
    return result.response.trim();
  }

  return null;
}

function summarizeResponseOutput(output: unknown): string {
  const text = extractResponseText(output);

  if (text) {
    return truncateQuotedText(text, 80);
  }

  if (isRecord(output) && "result" in output && output.result != null) {
    return "final result captured";
  }

  return "final result captured";
}

function summarizeGeminiOutput(output: unknown): string {
  if (!isRecord(output) || typeof output.response !== "string") {
    return "—";
  }

  return truncateQuotedText(output.response, 72);
}

export function summarizeExecutionOutput(execution: NodeExecutionDetail): string {
  if (execution.status === "failed") {
    return execution.error?.trim() || "failed";
  }

  if (execution.status === "skipped") {
    return "skipped";
  }

  if (execution.status === "running" || execution.status === "pending") {
    return "…";
  }

  switch (execution.nodeType) {
    case "requestInputs":
      return summarizeRequestInputsOutput(execution.output);
    case "cropImage":
      return summarizeCropImageOutput(execution.output);
    case "geminiPro":
      return summarizeGeminiOutput(execution.output);
    case "response":
      return summarizeResponseOutput(execution.output);
    default:
      return "—";
  }
}

export function getExecutionTreePrefix(
  index: number,
  total: number,
): string {
  return index === total - 1 ? "└──" : "├──";
}

export type HistoryNodeStatusTone = "success" | "failed" | "running" | "muted";

export function getExecutionStatusTone(
  status: NodeExecutionDetail["status"],
): HistoryNodeStatusTone {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "failed";
    case "running":
      return "running";
    default:
      return "muted";
  }
}

export function getRunStatusBadgeClass(status: RunStatus): string {
  switch (status) {
    case "success":
      return "workflow-history-status-completed";
    case "failed":
      return "workflow-history-status-failed";
    case "running":
      return "workflow-history-status-running";
    case "partial":
      return "workflow-history-status-waiting";
    default:
      return "workflow-history-status-default";
  }
}
