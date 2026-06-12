"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkflow } from "@/actions/workflows";

const DEFAULT_WORKFLOW_NAME = "Untitled Workflow";

export function useCreateWorkflowTask() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createNewWorkflow = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsPending(true);
    setError(null);

    try {
      const result = await createWorkflow({ name: DEFAULT_WORKFLOW_NAME });

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (!result.success) {
        setError(result.error ?? "Failed to create workflow.");
        return;
      }

      router.refresh();
      router.push(`/workflow/${result.data.id}`);
    } catch (cause) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      const message =
        cause instanceof Error ? cause.message : "Failed to create workflow.";
      setError(message);
    } finally {
      if (requestIdRef.current === requestId) {
        inFlightRef.current = false;
        setIsPending(false);
      }
    }
  }, [router]);

  return {
    createNewWorkflow,
    isPending,
    error,
    clearError,
  };
}
