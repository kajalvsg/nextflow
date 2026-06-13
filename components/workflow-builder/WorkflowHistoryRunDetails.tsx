"use client";

import { Check, Loader2, X } from "lucide-react";
import {
  formatHistoryDuration,
  formatHistoryRunTimestamp,
  formatHistoryScopeLabel,
  getCropImageHistoryUrl,
  getExecutionTreePrefix,
  getExecutionStatusTone,
  summarizeExecutionOutput,
  truncateDisplayUrl,
} from "@/lib/workflow/history-display";
import type { NodeExecutionDetail, WorkflowRunDetail } from "@/types/workflow-execution";
import { cn } from "@/lib/utils/cn";

function ExecutionStatusIcon({
  status,
}: {
  status: NodeExecutionDetail["status"];
}) {
  const tone = getExecutionStatusTone(status);

  if (status === "running") {
    return (
      <span
        className="workflow-history-node-status workflow-history-node-status-running"
        aria-hidden
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      </span>
    );
  }

  if (tone === "success") {
    return (
      <span
        className="workflow-history-node-status workflow-history-node-status-success"
        aria-hidden
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }

  if (tone === "failed") {
    return (
      <span
        className="workflow-history-node-status workflow-history-node-status-failed"
        aria-hidden
      >
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      className="workflow-history-node-status workflow-history-node-status-muted"
      aria-hidden
    />
  );
}

function CropHistoryUrlLine({ output }: { output: unknown }) {
  const url = getCropImageHistoryUrl(output);

  if (!url) {
    return null;
  }

  return (
    <p className="workflow-history-tree-subline">
      URL:{" "}
      <span className="workflow-history-tree-url" title={url}>
        {truncateDisplayUrl(url)}
      </span>
    </p>
  );
}

type WorkflowHistoryRunDetailsProps = {
  run: WorkflowRunDetail;
  runNumber: number;
};

export function WorkflowHistoryRunDetails({
  run,
  runNumber,
}: WorkflowHistoryRunDetailsProps) {
  const executions = run.executions;

  return (
    <div className="workflow-history-run-expanded">
      <p className="workflow-history-run-expanded-title">
        Run #{runNumber} — {formatHistoryRunTimestamp(run.startedAt)} (
        {formatHistoryScopeLabel(run.scope)})
      </p>

      <ul className="workflow-history-tree" aria-label="Node execution tree">
        {executions.map((execution, index) => {
          const summary = summarizeExecutionOutput(execution);
          const prefix = getExecutionTreePrefix(index, executions.length);
          const showCropUrl =
            execution.nodeType === "cropImage" &&
            execution.status === "success" &&
            getCropImageHistoryUrl(execution.output) != null;

          return (
            <li key={execution.id} className="workflow-history-tree-item">
              <div className="workflow-history-tree-row">
                <span className="workflow-history-tree-prefix">{prefix}</span>
                <span className="workflow-history-tree-name">
                  {execution.nodeName}
                </span>
                <ExecutionStatusIcon status={execution.status} />
                <span className="workflow-history-tree-duration">
                  {formatHistoryDuration(execution.durationMs)}
                </span>
                <span className="workflow-history-tree-arrow">→</span>
                <span
                  className={cn(
                    "workflow-history-tree-summary",
                    execution.status === "failed" &&
                      "workflow-history-tree-summary-error",
                  )}
                >
                  {summary}
                </span>
              </div>

              {showCropUrl ? (
                <CropHistoryUrlLine output={execution.output} />
              ) : null}

              {execution.error && execution.status === "failed" ? (
                <p className="workflow-history-tree-error">{execution.error}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export {
  formatHistoryDuration,
  formatHistoryRunStatusLabel,
  formatHistoryRunTimestampShort,
  formatHistoryScopeLabel,
  getHistoryRunNumber,
  getRunStatusBadgeClass,
} from "@/lib/workflow/history-display";
