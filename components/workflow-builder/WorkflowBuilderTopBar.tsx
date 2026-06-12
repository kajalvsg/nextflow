"use client";

import {
  ArrowLeft,
  Clock,
  Coins,
  Download,
  Loader2,
  MoreHorizontal,
  Play,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  WorkflowSaveIndicator,
  type WorkflowSaveStatus,
} from "./WorkflowSaveIndicator";

type WorkflowBuilderTopBarProps = {
  workflowName: string;
  saveStatus: WorkflowSaveStatus;
  isRunning: boolean;
  isLeaving: boolean;
  canRun: boolean;
  historyOpen: boolean;
  onNavigateDashboard: () => void;
  onRun: () => void;
  onToggleHistory: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onLoadSample: () => void;
};

export function WorkflowBuilderTopBar({
  workflowName,
  saveStatus,
  isRunning,
  isLeaving,
  canRun,
  historyOpen,
  onNavigateDashboard,
  onRun,
  onToggleHistory,
  onExportJson,
  onImportJson,
  onLoadSample,
}: WorkflowBuilderTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 py-2.5 sm:px-4">
      <div className="relative flex items-center justify-between gap-3">
        <div className="workflow-topbar-left pointer-events-auto flex min-w-0 max-w-[min(46vw,380px)] items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 shadow-card">
          <button
            type="button"
            disabled={isRunning || isLeaving}
            onClick={onNavigateDashboard}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>

          <h1 className="workflow-builder-topbar-title min-w-0 flex-1 truncate text-foreground">
            {workflowName}
          </h1>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              disabled={isRunning}
              onClick={() => setMenuOpen((current) => !current)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
              aria-label="Workflow actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {menuOpen ? (
              <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[180px] rounded-xl border border-border bg-surface p-1 shadow-elevated">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface-hover"
                  onClick={() => {
                    onExportJson();
                    setMenuOpen(false);
                  }}
                >
                  <Download className="h-3.5 w-3.5 text-muted" />
                  Export JSON
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface-hover"
                  onClick={() => {
                    onImportJson();
                    setMenuOpen(false);
                  }}
                >
                  <Upload className="h-3.5 w-3.5 text-muted" />
                  Import JSON
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface-hover"
                  onClick={() => {
                    onLoadSample();
                    setMenuOpen(false);
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-muted" />
                  Load Sample
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <WorkflowSaveIndicator status={saveStatus} />
        </div>

        <div className="workflow-topbar-right pointer-events-auto flex shrink-0 items-center gap-1.5">
          <div className="workflow-topbar-credit-pill hidden items-center gap-1.5 sm:flex">
            <Coins className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="workflow-topbar-credit-text">
              <span className="text-muted-foreground">Est</span> 1.72 M
            </span>
          </div>

          <div className="workflow-topbar-credit-pill hidden items-center gap-1.5 sm:flex">
            <Wallet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="workflow-topbar-credit-text">
              <span className="text-muted-foreground">Bal</span> 0.00 M
            </span>
          </div>

          <button
            type="button"
            disabled={isRunning || !canRun}
            onClick={onRun}
            className="workflow-topbar-run-btn flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-card transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={isRunning ? "Running workflow" : "Run workflow"}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleHistory}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground shadow-card transition-colors hover:bg-surface-hover hover:text-foreground",
              historyOpen && "border-accent/30 bg-accent-soft text-accent",
            )}
            aria-label="Toggle run history"
            aria-pressed={historyOpen}
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
