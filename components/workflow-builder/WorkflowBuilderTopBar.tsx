"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CLERK_AUTH_PATHS } from "@/lib/clerk/config";

type WorkflowBuilderTopBarProps = {
  workflowName: string;
  saveStatus: "idle" | "saving" | "saved" | "error";
};

export function WorkflowBuilderTopBar({
  workflowName,
  saveStatus,
}: WorkflowBuilderTopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border-soft bg-surface/90 px-4 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={CLERK_AUTH_PATHS.afterAuth}
          className="inline-flex items-center gap-2 rounded-button border border-border bg-surface-muted px-3 py-1.5 text-body-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="hidden h-6 w-px bg-border-soft sm:block" />
        <h1 className="truncate text-heading-sm text-foreground">{workflowName}</h1>
      </div>

      <p className="text-caption text-muted-foreground">
        {saveStatus === "saving" && "Saving…"}
        {saveStatus === "saved" && "Saved"}
        {saveStatus === "error" && "Save failed"}
        {saveStatus === "idle" && "Workflow builder"}
      </p>
    </header>
  );
}
