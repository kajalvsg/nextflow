"use client";

import { ArrowLeft, Download, Loader2, Play, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

type WorkflowBuilderTopBarProps = {
  workflowName: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isRunning: boolean;
  isLeaving: boolean;
  canRun: boolean;
  runScopeLabel: string | null;
  onNavigateDashboard: () => void;
  onRun: () => void;
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
  runScopeLabel,
  onNavigateDashboard,
  onRun,
  onExportJson,
  onImportJson,
  onLoadSample,
}: WorkflowBuilderTopBarProps) {
  return (
    <header className="relative z-20 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-surface/90 px-4 py-2 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isRunning || isLeaving}
          onClick={onNavigateDashboard}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <div className="hidden h-6 w-px bg-border-soft sm:block" />
        <h1 className="truncate text-heading-sm text-foreground">{workflowName}</h1>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {runScopeLabel ? (
          <p className="hidden text-caption text-muted lg:block">{runScopeLabel}</p>
        ) : null}

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isRunning}
          onClick={onExportJson}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export JSON</span>
          <span className="sm:hidden">Export</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isRunning}
          onClick={onImportJson}
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import JSON</span>
          <span className="sm:hidden">Import</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isRunning}
          onClick={onLoadSample}
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden md:inline">Load Sample Workflow</span>
          <span className="md:hidden">Sample</span>
        </Button>

        <Button
          type="button"
          size="sm"
          disabled={isRunning || !canRun}
          onClick={onRun}
          className="min-w-[88px]"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run
            </>
          )}
        </Button>

        <p className="hidden text-caption text-muted-foreground xl:block">
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
          {saveStatus === "error" && "Save failed"}
          {saveStatus === "idle" && "Workflow builder"}
        </p>
      </div>
    </header>
  );
}
