"use client";

import { createContext, useContext, useEffect } from "react";
import { Toast } from "@/components/ui/Toast";
import { useCreateWorkflowTask } from "@/hooks/useCreateWorkflowTask";

type AppSidebarActions = {
  onNewTask: () => void;
  isNewTaskPending: boolean;
};

const AppSidebarActionsContext = createContext<AppSidebarActions>({
  onNewTask: () => {},
  isNewTaskPending: false,
});

export function AppSidebarActionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { createNewWorkflow, isPending, error, clearError } =
    useCreateWorkflowTask();

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = setTimeout(() => {
      clearError();
    }, 5000);

    return () => clearTimeout(timer);
  }, [clearError, error]);

  return (
    <AppSidebarActionsContext.Provider
      value={{ onNewTask: createNewWorkflow, isNewTaskPending: isPending }}
    >
      {children}
      <Toast message={error} variant="error" />
    </AppSidebarActionsContext.Provider>
  );
}

export function useAppSidebarActions() {
  return useContext(AppSidebarActionsContext);
}
