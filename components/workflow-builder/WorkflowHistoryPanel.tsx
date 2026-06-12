"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import {
  getWorkflowRunDetail,
  getWorkflowRunHistory,
} from "@/actions/workflow-execution";
import type {
  WorkflowRunDetail,
  WorkflowRunSummary,
} from "@/types/workflow-execution";
import { cn } from "@/lib/utils/cn";

type WorkflowHistoryPanelProps = {
  workflowId: string;
  refreshKey: number;
  onClose?: () => void;
};

type HistoryTab = "ui" | "api";

type HistoryFilter =
  | "all"
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "canceled";

const FILTER_OPTIONS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "canceled", label: "Canceled" },
];

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
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatScope(scope: WorkflowRunSummary["scope"]): string {
  switch (scope) {
    case "full":
      return "Full workflow";
    case "single":
      return "Single node";
    case "partial":
      return "Partial run";
    default:
      return scope;
  }
}

function getStatusLabel(status: WorkflowRunSummary["status"]): string {
  switch (status) {
    case "success":
      return "Completed";
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

function getStatusBadgeClass(status: WorkflowRunSummary["status"]): string {
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

function matchesFilter(
  run: WorkflowRunSummary,
  filter: HistoryFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "running") {
    return run.status === "running" || run.status === "partial";
  }

  if (filter === "completed") {
    return run.status === "success";
  }

  if (filter === "failed") {
    return run.status === "failed";
  }

  return false;
}

export function WorkflowHistoryPanel({
  workflowId,
  refreshKey,
  onClose,
}: WorkflowHistoryPanelProps) {
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [activeTab, setActiveTab] = useState<HistoryTab>("ui");
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<WorkflowRunDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

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

  useEffect(() => {
    if (!filterOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!filterRef.current?.contains(event.target as Node)) {
        setFilterOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [filterOpen]);

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

  const visibleRuns =
    activeTab === "api"
      ? []
      : runs.filter((run) => matchesFilter(run, statusFilter));

  const selectedFilterLabel =
    FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label ??
    "All";

  return (
    <aside className="workflow-history-panel flex h-full w-[360px] shrink-0 flex-col border-l border-border-soft bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3.5">
        <h2 className="workflow-history-title text-foreground">
          Execution History
        </h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Close execution history"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="border-b border-border-soft px-4 py-3">
        <div className="workflow-history-tabs">
          <button
            type="button"
            className={cn(
              "workflow-history-tab",
              activeTab === "ui" && "workflow-history-tab-active",
            )}
            onClick={() => setActiveTab("ui")}
          >
            UI Runs
          </button>
          <button
            type="button"
            className={cn(
              "workflow-history-tab",
              activeTab === "api" && "workflow-history-tab-active",
            )}
            onClick={() => setActiveTab("api")}
          >
            API Runs
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <p className="workflow-history-section-label text-foreground">
          Run history
        </p>

        <div className="relative" ref={filterRef}>
          <button
            type="button"
            className="workflow-history-filter-trigger"
            onClick={() => setFilterOpen((current) => !current)}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
          >
            <span>{selectedFilterLabel}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform",
                filterOpen && "rotate-180",
              )}
            />
          </button>

          {filterOpen ? (
            <div
              className="workflow-history-filter-menu"
              role="listbox"
              aria-label="Filter runs by status"
            >
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={statusFilter === option.value}
                  className="workflow-history-filter-option"
                  onClick={() => {
                    setStatusFilter(option.value);
                    setFilterOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {statusFilter === option.value ? (
                    <Check className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <span className="h-3.5 w-3.5" />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="workflow-history-empty-card">
            <p className="workflow-history-empty-text">Loading runs…</p>
          </div>
        ) : visibleRuns.length === 0 ? (
          <div className="workflow-history-empty-card">
            <p className="workflow-history-empty-text">No runs for this filter</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visibleRuns.map((run) => {
              const isExpanded = expandedRunId === run.id;

              return (
                <li key={run.id} className="workflow-history-run-card">
                  <button
                    type="button"
                    onClick={() => void toggleRun(run.id)}
                    className="flex w-full items-start gap-2.5 p-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "workflow-history-status-badge",
                            getStatusBadgeClass(run.status),
                          )}
                        >
                          {getStatusLabel(run.status)}
                        </span>
                        <span className="workflow-history-scope-badge">
                          {formatScope(run.scope)}
                        </span>
                      </div>

                      <p className="workflow-history-run-meta">
                        {formatTimestamp(run.startedAt)}
                      </p>
                      <p className="workflow-history-run-meta">
                        {formatDuration(run.durationMs)} · {run.executionCount}{" "}
                        {run.executionCount === 1 ? "node" : "nodes"}
                      </p>
                    </div>
                  </button>

                  {isExpanded && expandedDetail?.id === run.id ? (
                    <div className="border-t border-border-soft px-3 pb-3 pt-2">
                      <ul className="flex flex-col gap-2">
                        {expandedDetail.executions.map((execution) => (
                          <li
                            key={execution.id}
                            className="workflow-history-node-card"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="workflow-history-node-name">
                                {execution.nodeName}
                              </p>
                              <span
                                className={cn(
                                  "workflow-history-status-badge",
                                  getStatusBadgeClass(
                                    execution.status === "success"
                                      ? "success"
                                      : execution.status === "failed"
                                        ? "failed"
                                        : execution.status === "running"
                                          ? "running"
                                          : "partial",
                                  ),
                                )}
                              >
                                {execution.status}
                              </span>
                            </div>
                            <p className="workflow-history-run-meta">
                              {execution.nodeType} ·{" "}
                              {formatDuration(execution.durationMs)}
                            </p>
                            {execution.error ? (
                              <p className="mt-1 text-[11px] leading-4 text-red-500">
                                {execution.error}
                              </p>
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
