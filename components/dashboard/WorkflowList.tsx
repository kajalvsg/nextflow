"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { WorkflowSummaryDTO } from "@/types/workflow";
import { EditWorkflowDialog } from "./EditWorkflowDialog";
import { WorkflowCard } from "./WorkflowCard";

type WorkflowListProps = {
  workflows: WorkflowSummaryDTO[];
};

export function WorkflowList({ workflows }: WorkflowListProps) {
  const [hiddenIds, setHiddenIds] = useState<Record<string, true>>({});
  const [editingWorkflow, setEditingWorkflow] =
    useState<WorkflowSummaryDTO | null>(null);

  const visibleWorkflows = useMemo(
    () => workflows.filter((workflow) => !hiddenIds[workflow.id]),
    [workflows, hiddenIds],
  );

  const sortedWorkflows = useMemo(
    () =>
      [...visibleWorkflows].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [visibleWorkflows],
  );

  function handleDelete(id: string) {
    setHiddenIds((current) => ({ ...current, [id]: true }));
  }

  function handleDeleteFailed(id: string) {
    setHiddenIds((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

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
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sortedWorkflows.map((workflow) => (
          <WorkflowCard
            key={workflow.id}
            workflow={workflow}
            onEdit={setEditingWorkflow}
            onDelete={handleDelete}
            onDeleteFailed={handleDeleteFailed}
          />
        ))}
      </div>

      <EditWorkflowDialog
        workflow={editingWorkflow}
        open={editingWorkflow !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWorkflow(null);
        }}
      />
    </>
  );
}
