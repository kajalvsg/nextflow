"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Info, Loader2, MoreHorizontal, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NodeRuntimeStatus } from "@/types/workflow-execution";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";

type NodeCardShellProps = {
  nodeId: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  selected?: boolean;
  executionStatus?: NodeRuntimeStatus;
  showRunButton?: boolean;
  className?: string;
  handles?: React.ReactNode;
  leftGutter?: boolean;
  rightGutter?: boolean;
  children: React.ReactNode;
};

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function NodeCardShell({
  nodeId,
  title,
  subtitle,
  icon: Icon,
  selected,
  executionStatus = "idle",
  showRunButton = true,
  className,
  handles,
  leftGutter = false,
  rightGutter = false,
  children,
}: NodeCardShellProps) {
  const { runNode, isWorkflowRunning } = useWorkflowBuilder();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isRunning = executionStatus === "running" || isWorkflowRunning;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  return (
    <div
      className={cn(
        "workflow-node-card relative min-w-[340px] max-w-[400px] rounded-xl border bg-surface shadow-card transition-shadow",
        selected && executionStatus === "idle"
          ? "border-accent/40 shadow-elevated ring-2 ring-accent/10"
          : "border-border",
        executionStatus === "running" && "workflow-node-running",
        executionStatus === "success" && "workflow-node-success",
        executionStatus === "failed" && "workflow-node-failed",
        className,
      )}
    >
      {handles}

      <div className="flex items-center gap-1.5 border-b border-border-soft px-3 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted">
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-body-sm font-semibold leading-tight text-foreground">
            {title}
          </p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <button
          type="button"
          className="workflow-node-header-icon"
          aria-label="Node information"
          onMouseDown={stopNodePointer}
          onPointerDown={stopNodePointer}
        >
          <Info className="h-3.5 w-3.5" />
        </button>

        {showRunButton ? (
          <button
            type="button"
            disabled={isRunning}
            onClick={(event) => {
              stopNodePointer(event);
              runNode(nodeId);
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
            className="workflow-node-run-btn"
            aria-label={`Run ${title}`}
          >
            {executionStatus === "running" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" />
                Run
              </>
            )}
          </button>
        ) : null}

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            className="workflow-node-header-icon"
            aria-label="Node menu"
            onClick={(event) => {
              stopNodePointer(event);
              setMenuOpen((current) => !current);
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-surface p-1 shadow-elevated">
              <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
                {title}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "workflow-node-body stack-sm px-3 py-3",
          leftGutter && "pl-9",
          rightGutter && "pr-9",
        )}
      >
        {children}
      </div>
    </div>
  );
}
