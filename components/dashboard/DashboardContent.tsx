"use client";

import { useState } from "react";
import { Container, PageSection, useAppSidebarActions } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { WorkflowSummaryDTO } from "@/types/workflow";
import { EditWorkflowDialog } from "./EditWorkflowDialog";
import { WorkflowList } from "./WorkflowList";

type DashboardContentProps = {
  initialWorkflows: WorkflowSummaryDTO[];
  userName?: string | null;
  dbError?: string | null;
};

export function DashboardContent({
  initialWorkflows,
  userName,
  dbError = null,
}: DashboardContentProps) {
  const { onNewTask, isNewTaskPending } = useAppSidebarActions();
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [editingWorkflow, setEditingWorkflow] =
    useState<WorkflowSummaryDTO | null>(null);

  function handleWorkflowUpdated(workflow: WorkflowSummaryDTO) {
    setWorkflows((current) =>
      current.map((item) => (item.id === workflow.id ? workflow : item)),
    );
  }

  function handleWorkflowDeleted(id: string) {
    setWorkflows((current) => current.filter((item) => item.id !== id));
  }

  function handleWorkflowDeleteFailed(workflow: WorkflowSummaryDTO) {
    setWorkflows((current) => {
      if (current.some((item) => item.id === workflow.id)) {
        return current;
      }

      return [...current, workflow];
    });
  }

  return (
    <PageSection spacing="lg" className="flex-1 overflow-y-auto">
      <Container size="lg">
        <div className="stack-lg pt-6">
          {userName ? (
            <div className="stack-sm">
              <p className="text-label text-accent">Tasks</p>
              <h1 className="text-display text-foreground">
                Welcome back, {userName}
              </h1>
              <p className="text-body-lg text-muted">
                Create, manage, and organize your AI workflows in one place.
              </p>
            </div>
          ) : null}
          {dbError ? (
            <Card variant="elevated" padding="md" className="border-red-500/30">
              <div className="stack-sm">
                <p className="text-body-sm font-medium text-red-400">
                  Database connection issue
                </p>
                <p className="text-body-sm text-muted">{dbError}</p>
                <p className="text-caption text-muted-foreground">
                  Run <code className="text-foreground">npm run db:check</code> in
                  your terminal for details. With{" "}
                  <code className="text-foreground">USE_LOCAL_DB=true</code>, run{" "}
                  <code className="text-foreground">npm run db:push</code> and
                  restart the dev server. For Neon, wake the project at
                  console.neon.tech and update{" "}
                  <code className="text-foreground">DATABASE_URL</code> in{" "}
                  <code className="text-foreground">.env.local</code>.
                </p>
              </div>
            </Card>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="stack-sm">
              <h2 className="text-heading text-foreground">Your workflows</h2>
              <p className="text-body-sm text-muted">
                {workflows.length === 0
                  ? "No workflows yet. Create one to get started."
                  : `${workflows.length} workflow${workflows.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <Button
              type="button"
              onClick={onNewTask}
              disabled={isNewTaskPending || Boolean(dbError)}
            >
              {isNewTaskPending ? "Creating..." : "New workflow"}
            </Button>
          </div>

          <WorkflowList
            workflows={workflows}
            onCreate={onNewTask}
            isCreating={isNewTaskPending}
            createDisabled={Boolean(dbError)}
            onEdit={setEditingWorkflow}
            onDelete={handleWorkflowDeleted}
            onDeleteFailed={handleWorkflowDeleteFailed}
          />
        </div>
      </Container>

      <EditWorkflowDialog
        workflow={editingWorkflow}
        open={editingWorkflow !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWorkflow(null);
        }}
        onSuccess={handleWorkflowUpdated}
      />
    </PageSection>
  );
}
