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

type WorkflowBuilderTopBarProps = {
  workflowName: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
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

function FloatingCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface px-3 py-2 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

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
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-4">
      <FloatingCard className="pointer-events-auto flex items-center gap-2 rounded-full px-2 py-1.5">
        <button
          type="button"
          disabled={isRunning || isLeaving}
          onClick={onNavigateDashboard}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h1 className="max-w-[min(42vw,320px)] truncate text-body-sm font-semibold text-foreground">
            {workflowName}
          </h1>
          {saveStatus === "saving" ? (
            <p className="text-[11px] text-muted-foreground">Saving…</p>
          ) : saveStatus === "error" ? (
            <p className="text-[11px] text-red-500">Save failed</p>
          ) : null}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
            aria-label="Workflow actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute left-0 top-full z-40 mt-2 min-w-[180px] rounded-xl border border-border bg-surface p-1 shadow-elevated">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body-sm text-foreground hover:bg-surface-hover"
                onClick={() => {
                  onExportJson();
                  setMenuOpen(false);
                }}
              >
                <Download className="h-4 w-4 text-muted" />
                Export JSON
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body-sm text-foreground hover:bg-surface-hover"
                onClick={() => {
                  onImportJson();
                  setMenuOpen(false);
                }}
              >
                <Upload className="h-4 w-4 text-muted" />
                Import JSON
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body-sm text-foreground hover:bg-surface-hover"
                onClick={() => {
                  onLoadSample();
                  setMenuOpen(false);
                }}
              >
                <Sparkles className="h-4 w-4 text-muted" />
                Load Sample
              </button>
            </div>
          ) : null}
        </div>
      </FloatingCard>

      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
        <FloatingCard className="flex items-center gap-2 px-2.5 py-1.5">
          <Coins className="hidden h-4 w-4 text-muted sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Est
            </p>
            <p className="text-body-sm font-semibold leading-tight text-foreground">
              1.72 M
            </p>
          </div>
        </FloatingCard>

        <FloatingCard className="flex items-center gap-2 px-2.5 py-1.5">
          <Wallet className="hidden h-4 w-4 text-muted sm:block" />
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Bal
            </p>
            <p className="text-body-sm font-semibold leading-tight text-foreground">
              0.00 M
            </p>
          </div>
        </FloatingCard>

        <button
          type="button"
          disabled={isRunning || !canRun}
          onClick={onRun}
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-card transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={isRunning ? "Running workflow" : "Run workflow"}
        >
          {isRunning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleHistory}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-foreground shadow-card transition-colors hover:bg-surface-hover",
            historyOpen && "border-accent/40 bg-accent-soft text-accent",
          )}
          aria-label="Toggle run history"
          aria-pressed={historyOpen}
        >
          <Clock className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
