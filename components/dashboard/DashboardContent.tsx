"use client";

import { useState } from "react";
import { Container, PageSection } from "@/components/layout";
import { Card } from "@/components/ui/Card";
import type { WorkflowSummaryDTO } from "@/types/workflow";
import { CreateWorkflowDialog } from "./CreateWorkflowDialog";
import { DashboardNavbar } from "./DashboardNavbar";
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
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] =
    useState<WorkflowSummaryDTO | null>(null);

  function handleWorkflowCreated(workflow: WorkflowSummaryDTO) {
    setWorkflows((current) => [workflow, ...current]);
  }

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
    <>
      <DashboardNavbar
        userName={userName}
        onCreateClick={() => setCreateOpen(true)}
      />
      <PageSection spacing="lg">
        <Container size="lg">
          <div className="stack-lg">
            {dbError ? (
              <Card variant="elevated" padding="md" className="border-red-500/30">
                <div className="stack-sm">
                  <p className="text-body-sm font-medium text-red-400">
                    Database connection issue
                  </p>
                  <p className="text-body-sm text-muted">{dbError}</p>
                  <p className="text-caption text-muted-foreground">
                    Verify DATABASE_URL in .env.local points to your Neon pooler
                    URL, then restart the dev server.
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
            </div>

            <WorkflowList
              workflows={workflows}
              onEdit={setEditingWorkflow}
              onDelete={handleWorkflowDeleted}
              onDeleteFailed={handleWorkflowDeleteFailed}
            />
          </div>
        </Container>
      </PageSection>

      <CreateWorkflowDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={handleWorkflowCreated}
      />

      <EditWorkflowDialog
        workflow={editingWorkflow}
        open={editingWorkflow !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWorkflow(null);
        }}
        onSuccess={handleWorkflowUpdated}
      />
    </>
  );
}
