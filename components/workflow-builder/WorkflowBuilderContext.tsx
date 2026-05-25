"use client";

import { createContext, useContext } from "react";
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import type { NodeInlineExecutionState, NodeRuntimeStatus } from "@/types/workflow-execution";

type WorkflowBuilderContextValue = {
  workflowId: string;
  updateNodeData: (
    nodeId: string,
    updater: (data: WorkflowNodeData) => WorkflowNodeData,
  ) => void;
  isSourceHandleConnected: (nodeId: string, handleId: string) => boolean;
  isTargetHandleConnected: (nodeId: string, handleId: string) => boolean;
  getNodeExecutionStatus: (nodeId: string) => NodeRuntimeStatus;
  getNodeInlineExecution: (nodeId: string) => NodeInlineExecutionState | null;
  isWorkflowRunning: boolean;
};

const WorkflowBuilderContext =
  createContext<WorkflowBuilderContextValue | null>(null);

export function WorkflowBuilderProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WorkflowBuilderContextValue;
}) {
  return (
    <WorkflowBuilderContext.Provider value={value}>
      {children}
    </WorkflowBuilderContext.Provider>
  );
}

export function useWorkflowBuilder() {
  const context = useContext(WorkflowBuilderContext);

  if (!context) {
    throw new Error("useWorkflowBuilder must be used within WorkflowBuilderProvider");
  }

  return context;
}
