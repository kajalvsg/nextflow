"use client";

import { createContext, useContext } from "react";
import type { StickyNoteNodeData } from "@/lib/workflow/sticky-notes-storage";
import type { WorkflowNodeData } from "@/types/workflow-canvas";
import type { NodeInlineExecutionState, NodeRuntimeStatus } from "@/types/workflow-execution";

type WorkflowBuilderContextValue = {
  workflowId: string;
  updateNodeData: (
    nodeId: string,
    updater: (data: WorkflowNodeData) => WorkflowNodeData,
  ) => void;
  updateStickyNote: (
    nodeId: string,
    updater: (data: StickyNoteNodeData) => StickyNoteNodeData,
  ) => void;
  deleteStickyNote: (nodeId: string) => void;
  isSourceHandleConnected: (nodeId: string, handleId: string) => boolean;
  isTargetHandleConnected: (nodeId: string, handleId: string) => boolean;
  getNodeExecutionStatus: (nodeId: string) => NodeRuntimeStatus;
  getNodeInlineExecution: (nodeId: string) => NodeInlineExecutionState | null;
  isWorkflowRunning: boolean;
  runNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  removeEdgesForSourceHandle: (nodeId: string, handleId: string) => void;
  remapSourceHandle: (
    nodeId: string,
    oldHandleId: string,
    newHandleId: string,
  ) => void;
  refreshNode: (nodeId: string) => void;
  duplicateNode: (nodeId: string) => void;
  duplicateNodeWithEdges: (nodeId: string) => void;
  toggleNodeLock: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  autoConnectHandle: (nodeId: string, targetHandle: string) => void;
  beginEdgeGroupDrag: (
    sourceNodeId: string,
    event: React.PointerEvent<SVGElement>,
  ) => void;
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
