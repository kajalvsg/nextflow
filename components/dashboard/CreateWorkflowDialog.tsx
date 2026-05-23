"use client";

import { useRef, useState, useTransition } from "react";
import { createWorkflow } from "@/actions/workflows";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { WorkflowSummaryDTO } from "@/types/workflow";

type CreateWorkflowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (workflow: WorkflowSummaryDTO) => void;
};

export function CreateWorkflowDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateWorkflowDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (isPending) return;
    setError(null);
    onOpenChange(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const description = String(formData.get("description") ?? "");

    startTransition(async () => {
      const result = await createWorkflow({
        name,
        description: description || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSuccess(result.data);
      formRef.current?.reset();
      setError(null);
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title="Create workflow"
      description="Give your workflow a name and optional description."
    >
      <form ref={formRef} onSubmit={handleSubmit} className="stack-lg">
        <Input
          name="name"
          label="Workflow name"
          placeholder="e.g. Content pipeline"
          required
          disabled={isPending}
          autoFocus
        />
        <Textarea
          name="description"
          label="Description"
          placeholder="What does this workflow do?"
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
            {isPending ? "Creating..." : "Create workflow"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
