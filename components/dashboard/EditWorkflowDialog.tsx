"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateWorkflow } from "@/actions/workflows";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { WorkflowSummaryDTO } from "@/types/workflow";

type EditWorkflowDialogProps = {
  workflow: WorkflowSummaryDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditWorkflowDialog({
  workflow,
  open,
  onOpenChange,
}: EditWorkflowDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (isPending) return;
    setError(null);
    onOpenChange(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workflow) return;

    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const description = String(formData.get("description") ?? "");

    startTransition(async () => {
      const result = await updateWorkflow({
        id: workflow.id,
        name,
        description: description || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onOpenChange(false);
      router.refresh();
    });
  }

  if (!workflow) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="Edit workflow"
      description="Update the name or description for this workflow."
    >
      <form onSubmit={handleSubmit} className="stack-lg">
        <Input
          key={`${workflow.id}-name`}
          name="name"
          label="Workflow name"
          defaultValue={workflow.name}
          required
          disabled={isPending}
          autoFocus
        />
        <Textarea
          key={`${workflow.id}-description`}
          name="description"
          label="Description"
          defaultValue={workflow.description ?? ""}
          disabled={isPending}
        />

        {error ? <p className="text-body-sm text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
