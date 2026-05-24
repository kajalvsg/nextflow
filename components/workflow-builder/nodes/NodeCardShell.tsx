"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NodeRuntimeStatus } from "@/types/workflow-execution";

type NodeCardShellProps = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  selected?: boolean;
  executionStatus?: NodeRuntimeStatus;
  className?: string;
  handles?: React.ReactNode;
  leftGutter?: boolean;
  rightGutter?: boolean;
  children: React.ReactNode;
};

export function NodeCardShell({
  title,
  subtitle,
  icon: Icon,
  selected,
  executionStatus = "idle",
  className,
  handles,
  leftGutter = false,
  rightGutter = false,
  children,
}: NodeCardShellProps) {
  return (
    <div
      className={cn(
        "relative min-w-[360px] max-w-[420px] rounded-card border bg-surface shadow-card transition-shadow",
        selected
          ? "border-accent shadow-elevated ring-2 ring-accent/30"
          : "border-border",
        executionStatus === "running" && "workflow-node-running",
        executionStatus === "success" && "border-success/60",
        executionStatus === "failed" && "border-danger/60",
        className,
      )}
    >
      {handles}

      <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-accent-soft text-accent">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-caption text-muted">{subtitle}</p>
          <p className="truncate text-body-sm font-semibold text-foreground">
            {title}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "stack-sm px-4 py-3",
          leftGutter && "pl-10",
          rightGutter && "pr-10",
        )}
      >
        {children}
      </div>
    </div>
  );
}
