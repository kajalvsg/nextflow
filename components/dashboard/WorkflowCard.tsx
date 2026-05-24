"use client";

import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteWorkflow } from "@/actions/workflows";
import { Badge, statusToBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatWorkflowDate } from "@/lib/utils/format";
import { workflowRoute } from "@/lib/routes";
import type { WorkflowSummaryDTO } from "@/types/workflow";

type WorkflowCardProps = {
  workflow: WorkflowSummaryDTO;
  onEdit: (workflow: WorkflowSummaryDTO) => void;
  onDelete: (id: string) => void;
  onDeleteFailed: (workflow: WorkflowSummaryDTO) => void;
};

export function WorkflowCard({
  workflow,
  onEdit,
  onDelete,
  onDeleteFailed,
}: WorkflowCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workflowHref = workflowRoute(workflow.id);

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      onDelete(workflow.id);

      const result = await deleteWorkflow({ id: workflow.id });

      if (!result.success) {
        onDeleteFailed(workflow);
        setError(result.error);
        setShowConfirm(false);
        return;
      }

      setShowConfirm(false);
    });
  }

  return (
    <Card variant="elevated" padding="md" className="flex h-full flex-col">
      <div className="stack flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="stack-sm min-w-0 flex-1">
            <Link
              href={workflowHref}
              className="block truncate text-heading-sm text-foreground transition-colors hover:text-accent"
            >
              {workflow.name}
            </Link>
            {workflow.description ? (
              <p className="line-clamp-2 text-body-sm text-muted">
                {workflow.description}
              </p>
            ) : (
              <p className="text-body-sm italic text-muted-foreground">
                No description
              </p>
            )}
          </div>
          <Badge variant={statusToBadgeVariant(workflow.status)}>
            {workflow.status}
          </Badge>
        </div>

        <p className="text-caption text-muted-foreground">
          Created {formatWorkflowDate(workflow.createdAt)}
        </p>

        {error ? <p className="text-caption text-red-400">{error}</p> : null}
      </div>

      <div className="relative z-10 divider mt-4 pt-4">
        {showConfirm ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-sm text-muted">Delete this workflow?</span>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" href={workflowHref} disabled={isPending}>
              Open
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(workflow)}
              disabled={isPending}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
