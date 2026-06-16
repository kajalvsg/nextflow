"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react";
import {
  getWorkflowRunDetail,
  getWorkflowRunHistory,
} from "@/actions/workflow-execution";
import type {
  NodeInlineExecutionState,
  RunStatus,
  WorkflowRunDetail,
  WorkflowRunSummary,
} from "@/types/workflow-execution";
import { mapRunDetailToInlineExecutions } from "@/lib/workflow/execution/run-inline-executions";
import { pollServerAction, HISTORY_POLL_TIMEOUT_MS } from "@/lib/utils/poll-server-action";
import { cn } from "@/lib/utils/cn";
import {
  WorkflowHistoryRunDetails,
  formatHistoryDuration,
  formatHistoryRunStatusLabel,
  formatHistoryRunTimestampShort,
  formatHistoryScopeLabel,
  getHistoryRunNumber,
  getRunStatusBadgeClass,
} from "./WorkflowHistoryRunDetails";

type WorkflowHistoryPanelProps = {
  workflowId: string;
  refreshKey: number;
  activeRunId?: string | null;
  isRunActive?: boolean;
  liveRuns?: WorkflowRunSummary[] | null;
  pollError?: string | null;
  onApplyRunResults?: (
    executions: Record<string, NodeInlineExecutionState>,
    source: "history",
  ) => void;
  onActiveRunSettled?: (runId: string, status: RunStatus) => void;
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

const HISTORY_POLL_INTERVAL_MS = 2000;
const MAX_HISTORY_POLL_FAILURES = 5;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Failed to load run history.";
}

export function WorkflowHistoryPanel({
  workflowId,
  refreshKey,
  activeRunId = null,
  isRunActive = false,
  liveRuns = null,
  pollError = null,
  onApplyRunResults,
  onActiveRunSettled,
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);
  const expandedRunIdRef = useRef<string | null>(null);
  const runsRef = useRef<WorkflowRunSummary[]>([]);
  const pollFailureCountRef = useRef(0);
  const onApplyRunResultsRef = useRef(onApplyRunResults);
  const onActiveRunSettledRef = useRef(onActiveRunSettled);

  useEffect(() => {
    onApplyRunResultsRef.current = onApplyRunResults;
  }, [onApplyRunResults]);

  useEffect(() => {
    onActiveRunSettledRef.current = onActiveRunSettled;
  }, [onActiveRunSettled]);

  const notifyActiveRunSettled = (history: WorkflowRunSummary[]) => {
    if (!activeRunId) {
      return;
    }

    const activeRun = history.find((run) => run.id === activeRunId);

    if (
      !activeRun ||
      (activeRun.status !== "success" &&
        activeRun.status !== "failed" &&
        activeRun.status !== "partial")
    ) {
      return;
    }

    onActiveRunSettledRef.current?.(activeRun.id, activeRun.status);
  };

  const applySuccessfulRunOutputs = (detail: WorkflowRunDetail | null) => {
    if (!detail || detail.status !== "success") {
      return;
    }

    const executions = mapRunDetailToInlineExecutions(detail);
    const hasOutput = Object.values(executions).some(
      (execution) =>
        execution.status === "success" && execution.output != null,
    );

    if (hasOutput) {
      onApplyRunResultsRef.current?.(executions, "history");
    }
  };

  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  useEffect(() => {
    if (liveRuns) {
      setRuns(liveRuns);
      setError(pollError);
      notifyActiveRunSettled(liveRuns);
    }
  }, [liveRuns, pollError, activeRunId]);

  useEffect(() => {
    expandedRunIdRef.current = expandedRunId;
  }, [expandedRunId]);

  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    setError(null);
    hasLoadedRef.current = false;

    void pollServerAction(
      "getWorkflowRunHistory",
      () => getWorkflowRunHistory(workflowId),
      HISTORY_POLL_TIMEOUT_MS,
    )
      .then((history) => {
        if (!cancelled) {
          setRuns(history);
          setError(null);
          hasLoadedRef.current = true;
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitialLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  useEffect(() => {
    if (liveRuns != null) {
      return;
    }

    let cancelled = false;
    let refreshInFlight = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const refreshHistory = async () => {
      const shouldPoll =
        Boolean(activeRunId) ||
        isRunActive ||
        runsRef.current.some((run) => run.status === "running");

      if (!shouldPoll) {
        return;
      }

      if (refreshInFlight) {
        return;
      }

      refreshInFlight = true;

      try {
        const history = await pollServerAction(
          "getWorkflowRunHistory",
          () => getWorkflowRunHistory(workflowId),
          HISTORY_POLL_TIMEOUT_MS,
        );

        if (cancelled) {
          return;
        }

        setRuns(history);
        runsRef.current = history;
        setError(null);
        pollFailureCountRef.current = 0;

        notifyActiveRunSettled(history);

        const latestRun = history[0];

        if (latestRun?.status === "success") {
          const latestDetail = await pollServerAction("getWorkflowRunDetail", () =>
            getWorkflowRunDetail(latestRun.id),
          );

          if (!cancelled) {
            applySuccessfulRunOutputs(latestDetail);
          }
        }

        const expandedId = expandedRunIdRef.current;

        if (expandedId) {
          const detail = await pollServerAction("getWorkflowRunDetail", () =>
            getWorkflowRunDetail(expandedId),
          );

          if (!cancelled && detail) {
            setExpandedDetail(detail);
            applySuccessfulRunOutputs(detail);
          }
        }
      } catch (loadError) {
        pollFailureCountRef.current += 1;

        if (!cancelled) {
          if (pollFailureCountRef.current >= MAX_HISTORY_POLL_FAILURES) {
            setError(getErrorMessage(loadError));
          }
        }
      } finally {
        refreshInFlight = false;
      }
    };

    void refreshHistory();
    interval = setInterval(() => {
      void refreshHistory();
    }, HISTORY_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;

      if (interval) {
        clearInterval(interval);
      }
    };
  }, [workflowId, activeRunId, isRunActive, refreshKey, liveRuns]);

  useEffect(() => {
    if (refreshKey === 0 || !hasLoadedRef.current) {
      return;
    }

    let cancelled = false;

    void pollServerAction(
      "getWorkflowRunHistory",
      () => getWorkflowRunHistory(workflowId),
      HISTORY_POLL_TIMEOUT_MS,
    )
      .then((history) => {
        if (!cancelled) {
          setRuns(history);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, workflowId]);

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
    applySuccessfulRunOutputs(detail);
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
        {initialLoading ? (
          <div className="workflow-history-empty-card">
            <p className="workflow-history-empty-text">Loading runs…</p>
          </div>
        ) : error || pollError ? (
          <div className="workflow-history-empty-card">
            <p className="workflow-history-empty-text text-red-500">
              {pollError ?? error}
            </p>
          </div>
        ) : visibleRuns.length === 0 ? (
          <div className="workflow-history-empty-card">
            <p className="workflow-history-empty-text">No runs for this filter</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visibleRuns.map((run) => {
              const isExpanded = expandedRunId === run.id;
              const runNumber = getHistoryRunNumber(runs, run.id);

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
                      <p className="workflow-history-run-number">
                        Run #{runNumber}
                      </p>

                      <div className="mb-2 mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "workflow-history-status-badge",
                            getRunStatusBadgeClass(run.status),
                          )}
                        >
                          {formatHistoryRunStatusLabel(run.status)}
                        </span>
                        <span className="workflow-history-scope-badge">
                          {formatHistoryScopeLabel(run.scope)}
                        </span>
                      </div>

                      <p className="workflow-history-run-meta">
                        {formatHistoryRunTimestampShort(run.startedAt)}
                      </p>
                      <p className="workflow-history-run-meta">
                        {formatHistoryDuration(run.durationMs)} ·{" "}
                        {run.executionCount}{" "}
                        {run.executionCount === 1 ? "node" : "nodes"}
                      </p>
                    </div>
                  </button>

                  {isExpanded && expandedDetail?.id === run.id ? (
                    <div className="workflow-history-run-expanded-wrap border-t border-border-soft">
                      <WorkflowHistoryRunDetails
                        run={expandedDetail}
                        runNumber={runNumber}
                      />
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
