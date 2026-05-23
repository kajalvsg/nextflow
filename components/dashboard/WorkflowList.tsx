"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import type { WorkflowSummaryDTO } from "@/types/workflow";
import { WorkflowCard } from "./WorkflowCard";

type WorkflowListProps = {
  workflows: WorkflowSummaryDTO[];
  onEdit: (workflow: WorkflowSummaryDTO) => void;
  onDelete: (id: string) => void;
  onDeleteFailed: (workflow: WorkflowSummaryDTO) => void;
};

export function WorkflowList({
  workflows,
  onEdit,
  onDelete,
  onDeleteFailed,
}: WorkflowListProps) {
  const sortedWorkflows = useMemo(
    () =>
      [...workflows].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [workflows],
  );

  if (sortedWorkflows.length === 0) {
    return (
      <Card variant="muted" padding="lg" className="text-center">
        <div className="stack-sm mx-auto max-w-md">
          <h2 className="text-heading-sm text-foreground">No workflows yet</h2>
          <p className="text-body-sm text-muted">
            Create your first workflow to start building AI-powered automations.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sortedWorkflows.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onEdit={onEdit}
          onDelete={onDelete}
          onDeleteFailed={onDeleteFailed}
        />
      ))}
    </div>
  );
}
