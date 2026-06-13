"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NodeInlineExecutionState } from "@/types/workflow-execution";
import { NodeHandle } from "./NodeHandle";
import {
  renderInlineExecutionBody,
  type InlineOutputNodeType,
} from "./node-output-render";

type NodeOutputPreviewProps = {
  label: string;
  nodeType: InlineOutputNodeType;
  inlineExecution: NodeInlineExecutionState | null;
  sourceLabel?: string | null;
  outputHandleId?: string;
  className?: string;
  dense?: boolean;
};

export function NodeOutputPreview({
  label,
  nodeType,
  inlineExecution,
  sourceLabel,
  outputHandleId,
  className,
  dense = false,
}: NodeOutputPreviewProps) {
  const isPending =
    inlineExecution?.status === "updating" ||
    inlineExecution?.status === "running";
  const hasSuccessOutput = inlineExecution?.status === "success";
  const hasFailed = inlineExecution?.status === "failed";
  const showSourceCard = Boolean(sourceLabel);

  const showHeader = Boolean(label || outputHandleId);

  return (
    <div
      className={cn(
        "workflow-node-output-section nodrag nopan nowheel",
        dense && "workflow-node-output-section-dense",
        className,
      )}
    >
      {showHeader ? (
        <div
          className={cn(
            "workflow-node-field-row relative",
            dense ? "mb-0.5" : "mb-1.5",
          )}
        >
          {outputHandleId ? (
            <div className="workflow-handle-slot workflow-handle-slot-right">
              <NodeHandle id={outputHandleId} type="source" inline />
            </div>
          ) : null}
          {label ? <p className="workflow-node-section-label">{label}</p> : null}
        </div>
      ) : null}

      {showSourceCard ? (
        <div className="workflow-node-connected-output-card">
          <div className="workflow-node-connected-output-header">
            <span className="workflow-node-connected-source-label">
              {sourceLabel}
            </span>
          </div>
          <div className="workflow-node-output-box">
            {isPending ? (
              <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating…
              </div>
            ) : hasFailed ? (
              <p className="px-3 py-2.5 text-[11px] text-red-500">
                {inlineExecution?.error ?? "Node execution failed."}
              </p>
            ) : hasSuccessOutput ? (
              <div className="p-2.5">
                {renderInlineExecutionBody(nodeType, inlineExecution.output)}
              </div>
            ) : (
              <p
                className={cn(
                  "workflow-node-output-empty",
                  dense && "workflow-node-output-empty-dense",
                )}
              >
                No output yet
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="workflow-node-output-box">
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating…
            </div>
          ) : hasFailed ? (
            <p className="px-3 py-2.5 text-[11px] text-red-500">
              {inlineExecution?.error ?? "Node execution failed."}
            </p>
          ) : hasSuccessOutput ? (
            <div className="p-2.5">
              {renderInlineExecutionBody(nodeType, inlineExecution.output)}
            </div>
          ) : (
            <p
              className={cn(
                "workflow-node-output-empty",
                dense && "workflow-node-output-empty-dense",
              )}
            >
              No output yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
