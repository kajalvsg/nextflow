"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, History, X } from "lucide-react";
import {
  getWorkflowRunDetail,
  getWorkflowRunHistory,
} from "@/actions/workflow-execution";
import { Badge } from "@/components/ui/Badge";
import type {
  WorkflowRunDetail,
  WorkflowRunSummary,
} from "@/types/workflow-execution";

type WorkflowHistoryPanelProps = {
  workflowId: string;
  refreshKey: number;
  onClose?: () => void;
};

function runBadgeVariant(status: string) {
  switch (status) {
    case "success":
      return "completed" as const;
    case "failed":
      return "failed" as const;
    case "running":
    case "partial":
      return "running" as const;
    default:
      return "default" as const;
  }
}

function formatDuration(durationMs: number | null): string {
  if (durationMs == null) {
    return "—";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function WorkflowHistoryPanel({
  workflowId,
  refreshKey,
  onClose,
}: WorkflowHistoryPanelProps) {
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<WorkflowRunDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getWorkflowRunHistory(workflowId)
      .then((history) => {
        if (!cancelled) {
          setRuns(history);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workflowId, refreshKey]);

  const toggleRun = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      setExpandedDetail(null);
      return;
    }

    setExpandedRunId(runId);
    const detail = await getWorkflowRunDetail(runId);
    setExpandedDetail(detail);
  };

  return (
    <aside className="workflow-history-panel flex h-full w-[320px] shrink-0 flex-col border-l border-border-soft bg-surface shadow-elevated">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-3 py-2.5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-accent" />
          <div>
            <p className="text-body-sm font-semibold text-foreground">History</p>
            <p className="text-caption text-muted">Workflow run records</p>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <p className="px-2 py-6 text-center text-body-sm text-muted">
            Loading history…
          </p>
        ) : runs.length === 0 ? (
          <p className="px-2 py-6 text-center text-body-sm text-muted">
            No runs yet. Use Run to execute this workflow.
          </p>
        ) : (
          <ul className="stack-sm">
            {runs.map((run) => {
              const isExpanded = expandedRunId === run.id;

              return (
                <li
                  key={run.id}
                  className="rounded-card border border-border bg-surface-muted"
                >
                  <button
                    type="button"
                    onClick={() => void toggleRun(run.id)}
                    className="flex w-full items-start gap-2 px-2.5 py-2.5 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={runBadgeVariant(run.status)}>
                          {run.status}
                        </Badge>
                        <Badge variant="default">{run.scope}</Badge>
                      </div>
                      <p className="text-caption text-muted">
                        {formatTimestamp(run.startedAt)}
                      </p>
                      <p className="text-caption text-muted">
                        Duration: {formatDuration(run.durationMs)} ·{" "}
                        {run.executionCount} nodes
                      </p>
                    </div>
                  </button>

                  {isExpanded && expandedDetail?.id === run.id ? (
                    <div className="border-t border-border-soft px-2.5 py-2.5">
                      <ul className="stack-sm">
                        {expandedDetail.executions.map((execution) => (
                          <li
                            key={execution.id}
                            className="rounded-button border border-border bg-background px-2.5 py-2"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="text-body-sm font-medium text-foreground">
                                {execution.nodeName}
                              </p>
                              <Badge variant={runBadgeVariant(execution.status)}>
                                {execution.status}
                              </Badge>
                            </div>
                            <p className="text-caption text-muted">
                              {execution.nodeType} ·{" "}
                              {formatDuration(execution.durationMs)}
                            </p>
                            {execution.error ? (
                              <p className="mt-1 text-caption text-red-400">
                                {execution.error}
                              </p>
                            ) : null}
                            {execution.input != null ? (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-caption text-muted">
                                  Input
                                </summary>
                                <pre className="mt-1 overflow-x-auto rounded-button bg-surface-muted p-2 text-[11px] text-muted">
                                  {JSON.stringify(execution.input, null, 2)}
                                </pre>
                              </details>
                            ) : null}
                            {execution.output != null ? (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-caption text-muted">
                                  Output
                                </summary>
                                <pre className="mt-1 max-h-32 overflow-auto rounded-button bg-surface-muted p-2 text-[11px] text-muted">
                                  {JSON.stringify(execution.output, null, 2)}
                                </pre>
                              </details>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
