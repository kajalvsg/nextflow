"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  getActiveRunState,
  getLatestWorkflowInlineExecutions,
  getWorkflowRunHistory,
  hasSuccessfulRunOutputs,
  startWorkflowRun,
  waitForWorkflowRunOutputs,
} from "@/actions/workflow-execution";
import { saveWorkflowGraph } from "@/actions/workflow-builder";
import { autoArrangeWorkflowNodes } from "@/lib/workflow/auto-arrange";
import {
  getConnectedNodeIds,
  resolveConnectedGroupDrag,
} from "@/lib/workflow/connected-nodes";
import { PROTECTED_NODE_IDS, sanitizeGraphForSave } from "@/lib/workflow/canvas";
import { getEdgeStrokeColor } from "@/lib/workflow/edge-colors";
import { prepareGraphPayload, serializeGraphPayload } from "@/lib/workflow/graph-payload";
import { pollServerAction } from "@/lib/utils/poll-server-action";
import { applyRunResultsToNodes } from "@/lib/workflow/execution/apply-run-results";
import {
  buildWorkflowExportDocument,
  createAssignmentSampleWorkflow,
  downloadWorkflowJson,
  parseWorkflowImportFile,
} from "@/lib/workflow/import-export";
import {
  isSourceHandleConnected,
  isTargetHandleConnected,
  validateWorkflowConnection,
} from "@/lib/workflow/connection-rules";
import {
  cloneGraphSnapshot,
  createHistoryStack,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryStack,
} from "@/lib/workflow/history";
import { findAutoConnectSource } from "@/lib/workflow/auto-connect";
import {
  applyMagicaAutoConnectToNodes,
  getUnsupportedMagicaToast,
  isGeminiMagicaTargetHandle,
  planMagicaAutoConnect,
} from "@/lib/workflow/magica-auto-connect";
import {
  createAddableNode,
  createWorkflowNodeId,
} from "@/lib/workflow/node-registry";
import { getWorkflowCanvasCenter } from "@/lib/workflow/viewport";
import {
  createStickyNoteNode,
  isStickyNoteNodeId,
  loadStickyNotes,
  saveStickyNotes,
  STICKY_NOTE_NODE_TYPE,
  type StickyNoteNode as StickyNoteNodeModel,
} from "@/lib/workflow/sticky-notes-storage";
import {
  buildConnectedInputMap,
  getConnectedInputValue,
} from "@/lib/workflow/execution/connected-inputs";
import type {
  AddableWorkflowNodeType,
  WorkflowBuilderDTO,
  WorkflowNodeData,
} from "@/types/workflow-canvas";
import type {
  ActiveRunState,
  NodeInlineExecutionState,
  NodeRuntimeStatus,
  RunScope,
  RunStatus,
  WorkflowRunSummary,
} from "@/types/workflow-execution";
import { CropImageNode } from "./nodes/CropImageNode";
import { GeminiProNode } from "./nodes/GeminiProNode";
import { RequestInputsNode } from "./nodes/RequestInputsNode";
import { ResponseNode } from "./nodes/ResponseNode";
import { StickyNoteNode } from "./nodes/StickyNoteNode";
import { NodePicker } from "./NodePicker";
import { CanvasBottomToolbar } from "./CanvasBottomToolbar";
import { CanvasControlsToolbar } from "./CanvasControlsToolbar";
import { CanvasMinimapPanel } from "./CanvasMinimapPanel";
import { WorkflowPaneDragHandler } from "./WorkflowPaneDragHandler";
import { WorkflowEdge } from "./edges/WorkflowEdge";
import { WorkflowBuilderProvider } from "./WorkflowBuilderContext";
import { WorkflowBuilderTopBar } from "./WorkflowBuilderTopBar";
import { WorkflowHistoryPanel } from "./WorkflowHistoryPanel";
import { WorkflowToast } from "./WorkflowToast";

const nodeTypes = {
  requestInputs: RequestInputsNode,
  cropImage: CropImageNode,
  geminiPro: GeminiProNode,
  response: ResponseNode,
  [STICKY_NOTE_NODE_TYPE]: StickyNoteNode,
};

const edgeTypes = {
  default: WorkflowEdge,
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const TOAST_DURATION_MS = 3200;
const SAVE_INDICATOR_HIDE_MS = 2000;
const AUTOSAVE_DEBOUNCE_MS = 1200;
const RUN_POLL_INTERVAL_MS = 2000;
const RUN_STATUS_RESET_MS = 3500;
const MAX_RUN_POLL_FAILURES = 5;

function isTerminalRunStatus(status: RunStatus): boolean {
  return status === "success" || status === "failed" || status === "partial";
}

function mapSnapshotsToInlineExecutions(
  snapshots: Record<
    string,
  {
    status: NodeRuntimeStatus;
    output: unknown;
    error: string | null;
  }
  >,
): Record<string, NodeInlineExecutionState> {
  return Object.fromEntries(
    Object.entries(snapshots).map(([nodeId, snapshot]) => [
      nodeId,
      {
        status: snapshot.status,
        output: snapshot.output,
        error: snapshot.error,
      },
    ]),
  );
}

function createUpdatingInlineExecutions(
  nodeIds: string[],
): Record<string, NodeInlineExecutionState> {
  return Object.fromEntries(
    nodeIds.map((nodeId) => [
      nodeId,
      {
        status: "updating" as const,
        output: null,
        error: null,
      },
    ]),
  );
}

function mergeInlineExecutionsFromRun(
  previous: Record<string, NodeInlineExecutionState>,
  executions: Record<string, NodeInlineExecutionState>,
): Record<string, NodeInlineExecutionState> {
  const next = { ...previous };

  for (const [nodeId, execution] of Object.entries(executions)) {
    next[nodeId] = execution;
  }

  return next;
}

function isPersistableNodeChange(change: NodeChange): boolean {
  return change.type === "add" || change.type === "remove";
}

function isPersistableEdgeChange(change: EdgeChange): boolean {
  return change.type === "add" || change.type === "remove";
}

type WorkflowCanvasInnerProps = {
  workflow: WorkflowBuilderDTO;
};

type NodePickerPanelProps = {
  onAddNode: (
    type: AddableWorkflowNodeType,
    position: { x: number; y: number },
  ) => void;
  onDemoSelect: (message: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function NodePickerOverlay({
  onAddNode,
  onDemoSelect,
  open,
  onOpenChange,
}: NodePickerPanelProps) {
  const reactFlow = useReactFlow();

  const handleSelectType = useCallback(
    (type: AddableWorkflowNodeType) => {
      const position = getWorkflowCanvasCenter(reactFlow);
      onAddNode(type, position);
    },
    [onAddNode, reactFlow],
  );

  if (!open) {
    return null;
  }

  return (
    <NodePicker
      open={open}
      onOpenChange={onOpenChange}
      showTrigger={false}
      onSelectType={handleSelectType}
      onDemoSelect={onDemoSelect}
    />
  );
}

function CanvasInitializer() {
  const { fitView } = useReactFlow();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);

    return () => clearTimeout(timer);
  }, [fitView]);

  return null;
}

function isEditableTarget(element: EventTarget | null): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tag = element.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    element.isContentEditable
  );
}

function WorkflowCanvasInner({ workflow }: WorkflowCanvasInnerProps) {
  const reactFlow = useReactFlow();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const workflowId =
    typeof params.id === "string" && params.id.trim().length > 0
      ? params.id.trim()
      : workflow.id;
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>(workflow.nodes);
  const [edges, setEdges] = useState<Edge[]>(workflow.edges);
  const [stickyNotes, setStickyNotes] = useState<StickyNoteNodeModel[]>(() =>
    loadStickyNotes(workflow.id),
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<string, NodeRuntimeStatus>
  >({});
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [nodeInlineExecutions, setNodeInlineExecutions] = useState<
    Record<string, NodeInlineExecutionState>
  >({});
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [liveRunHistory, setLiveRunHistory] = useState<WorkflowRunSummary[] | null>(
    null,
  );
  const [runPollError, setRunPollError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [moveConnectedGroup, setMoveConnectedGroup] = useState(false);
  const [isWorkflowCanvasDragging, setIsWorkflowCanvasDragging] = useState(false);
  const moveConnectedGroupRef = useRef(false);
  const [canRunWorkflow, setCanRunWorkflow] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyRef = useRef<HistoryStack>(createHistoryStack(workflow.nodes, workflow.edges));
  const isHistoryActionRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragGroupRef = useRef<{
    anchor: { x: number; y: number };
    nodeStarts: Map<string, { x: number; y: number }>;
    nodeIds: Set<string>;
    mode: "node" | "pointer" | "workflow";
  } | null>(null);
  const pointerDragCleanupRef = useRef<(() => void) | null>(null);
  const fieldEditHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldEditHistoryPendingRef = useRef(false);
  const lastValidationRef = useRef<string | null>(null);
  const connectSessionRef = useRef({ started: false, connected: false });
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const lastSavedGraphRef = useRef(
    serializeGraphPayload(workflow.nodes, workflow.edges),
  );
  const workflowUnavailableRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const workflowMissingToastShownRef = useRef(false);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    moveConnectedGroupRef.current = moveConnectedGroup;
  }, [moveConnectedGroup]);

  useEffect(() => {
    if (saveStatusTimerRef.current) {
      clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = null;
    }

    if (saveStatus === "saved" || saveStatus === "error") {
      saveStatusTimerRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, SAVE_INDICATOR_HIDE_MS);
    }

    return () => {
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
    };
  }, [saveStatus]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, TOAST_DURATION_MS);
  }, []);

  const markWorkflowUnavailable = useCallback(
    (message: string) => {
      workflowUnavailableRef.current = true;
      setCanRunWorkflow(false);
      setSaveStatus("error");

      if (!workflowMissingToastShownRef.current) {
        workflowMissingToastShownRef.current = true;
        showToast(message);
      }
    },
    [showToast],
  );

  const runSave = useCallback(
    async (
      nextNodes: Node<WorkflowNodeData>[],
      nextEdges: Edge[],
      options: { force?: boolean } = {},
    ): Promise<boolean> => {
      if (workflowUnavailableRef.current || !isMountedRef.current) {
        return false;
      }

      const payload = prepareGraphPayload(nextNodes, nextEdges);
      const fingerprint = serializeGraphPayload(nextNodes, nextEdges);

      if (!options.force && fingerprint === lastSavedGraphRef.current) {
        setSaveStatus("saved");
        setCanRunWorkflow(true);
        return true;
      }

      if (saveInFlightRef.current) {
        return false;
      }

      saveInFlightRef.current = true;
      setSaveStatus("saving");

      try {
        const result = await saveWorkflowGraph({
          id: workflowId,
          nodes: payload.nodes,
          edges: payload.edges,
        });

        if (!isMountedRef.current) {
          return false;
        }

        if (result.success) {
          lastSavedGraphRef.current = fingerprint;
          setSaveStatus("saved");
          setCanRunWorkflow(true);
          return true;
        }

        setSaveStatus("error");
        setCanRunWorkflow(false);

        if (result.error?.toLowerCase().includes("not found")) {
          markWorkflowUnavailable(
            result.error ??
              "This workflow no longer exists. Return to the dashboard.",
          );
        } else {
          showToast(result.error ?? "Failed to save workflow.");
        }

        return false;
      } catch (error) {
        console.error("[save] saveWorkflowGraph failed:", error);

        if (isMountedRef.current) {
          setSaveStatus("error");
          setCanRunWorkflow(false);
          showToast(
            error instanceof Error ? error.message : "Failed to save workflow.",
          );
        }

        return false;
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [markWorkflowUnavailable, showToast, workflowId],
  );

  const scheduleSave = useCallback(() => {
    if (workflowUnavailableRef.current) {
      return;
    }

    setSaveStatus((current) => (current === "error" ? "error" : "saving"));

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void runSave(nodesRef.current, edgesRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [runSave]);

  const recordHistory = useCallback(() => {
    if (isHistoryActionRef.current) {
      return;
    }

    historyRef.current = pushHistory(
      historyRef.current,
      cloneGraphSnapshot(nodesRef.current, edgesRef.current),
    );
    setHistoryTick((current) => current + 1);
  }, []);

  const recordFieldEditHistory = useCallback(() => {
    if (isHistoryActionRef.current) {
      return;
    }

    if (!fieldEditHistoryPendingRef.current) {
      recordHistory();
      fieldEditHistoryPendingRef.current = true;
    }

    if (fieldEditHistoryTimerRef.current) {
      clearTimeout(fieldEditHistoryTimerRef.current);
    }

    fieldEditHistoryTimerRef.current = setTimeout(() => {
      fieldEditHistoryPendingRef.current = false;
    }, 800);
  }, [recordHistory]);

  const applySnapshot = useCallback(
    (snapshot: ReturnType<typeof cloneGraphSnapshot>) => {
      isHistoryActionRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);
      nodesRef.current = snapshot.nodes;
      edgesRef.current = snapshot.edges;
      isHistoryActionRef.current = false;
      scheduleSave();
    },
    [scheduleSave],
  );

  const persistGraphNow = useCallback(
    async (
      nextNodes: Node<WorkflowNodeData>[],
      nextEdges: Edge[],
      force = true,
    ): Promise<boolean> => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      if (saveInFlightRef.current) {
        const deadline = Date.now() + 5_000;

        while (saveInFlightRef.current && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      return runSave(nextNodes, nextEdges, { force });
    },
    [runSave],
  );

  const replaceGraph = useCallback(
    async (
      nextNodes: Node<WorkflowNodeData>[],
      nextEdges: Edge[],
      successMessage: string,
    ) => {
      recordHistory();
      isHistoryActionRef.current = true;
      setNodes(nextNodes);
      setEdges(nextEdges);
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      historyRef.current = pushHistory(
        historyRef.current,
        cloneGraphSnapshot(nextNodes, nextEdges),
      );
      setHistoryTick((current) => current + 1);
      isHistoryActionRef.current = false;

      const saved = await persistGraphNow(nextNodes, nextEdges);

      if (saved) {
        showToast(successMessage);
        setTimeout(() => {
          reactFlow.fitView({ padding: 0.2, duration: 300 });
        }, 50);
      }

      return saved;
    },
    [persistGraphNow, recordHistory, showToast, reactFlow],
  );

  const handleNavigateToDashboard = useCallback(async () => {
    if (isLeaving) {
      return;
    }

    if (isWorkflowRunning) {
      showToast("Wait for the workflow run to finish before leaving.");
      return;
    }

    setIsLeaving(true);

    try {
      const shouldSaveBeforeLeave =
        saveTimerRef.current !== null ||
        saveStatus === "saving" ||
        saveStatus === "error";

      if (shouldSaveBeforeLeave) {
        const saved = await persistGraphNow(
          nodesRef.current,
          edgesRef.current,
        );

        if (!saved) {
          const leaveAnyway = window.confirm(
            "Could not save your latest changes. Go to the dashboard anyway?",
          );

          if (!leaveAnyway) {
            return;
          }
        }
      }

      router.push("/dashboard");
    } finally {
      if (isMountedRef.current) {
        setIsLeaving(false);
      }
    }
  }, [
    isLeaving,
    isWorkflowRunning,
    persistGraphNow,
    router,
    saveStatus,
    showToast,
  ]);

  const handleExportJson = useCallback(() => {
    const { nodes: sanitizedNodes, edges: sanitizedEdges } =
      sanitizeGraphForSave(nodesRef.current, edgesRef.current);

    const exportDocument = buildWorkflowExportDocument({
      name: workflow.name,
      nodes: sanitizedNodes,
      edges: sanitizedEdges,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    });

    const slug =
      workflow.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "workflow";

    downloadWorkflowJson(exportDocument, `${slug}-workflow.json`);
    showToast("Workflow exported as JSON.");
  }, [showToast, workflow.createdAt, workflow.name, workflow.updatedAt]);

  const handleImportJsonClick = useCallback(() => {
    importFileInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;
        const result = parseWorkflowImportFile(parsed);

        if (!result.success) {
          showToast(result.error);
          return;
        }

        const confirmed = window.confirm(
          "Replace the current workflow with the imported JSON? This cannot be undone except with Undo.",
        );

        if (!confirmed) {
          return;
        }

        await replaceGraph(
          result.nodes,
          result.edges,
          "Workflow imported and saved.",
        );
      } catch {
        showToast("Invalid JSON file. Could not parse the uploaded document.");
      }
    },
    [replaceGraph, showToast],
  );

  const handleLoadSample = useCallback(async () => {
    const confirmed = window.confirm(
      "Replace the current workflow with the assignment sample? This cannot be undone except with Undo.",
    );

    if (!confirmed) {
      return;
    }

    const sample = createAssignmentSampleWorkflow();
    await replaceGraph(
      sample.nodes,
      sample.edges,
      "Sample workflow loaded and saved.",
    );
  }, [replaceGraph]);

  const undo = useCallback(() => {
    const present = cloneGraphSnapshot(nodesRef.current, edgesRef.current);
    const result = undoHistory(present, historyRef.current);

    if (!result) {
      return;
    }

    historyRef.current = result.stack;
    applySnapshot(result.snapshot);
    setHistoryTick((current) => current + 1);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const present = cloneGraphSnapshot(nodesRef.current, edgesRef.current);
    const result = redoHistory(present, historyRef.current);

    if (!result) {
      return;
    }

    historyRef.current = result.stack;
    applySnapshot(result.snapshot);
    setHistoryTick((current) => current + 1);
  }, [applySnapshot]);

  const canUndo =
    historyTick >= 0 && historyRef.current.past.length > 0;
  const canRedo =
    historyTick >= 0 && historyRef.current.future.length > 0;

  const handleAddStickyNote = useCallback(() => {
    const position = getWorkflowCanvasCenter(reactFlow);
    const note = createStickyNoteNode(position);

    setStickyNotes((current) => {
      const next = [...current, note];
      saveStickyNotes(workflowId, next);
      return next;
    });
  }, [reactFlow, workflowId]);

  const updateStickyNote = useCallback(
    (
      nodeId: string,
      updater: (data: StickyNoteNodeModel["data"]) => StickyNoteNodeModel["data"],
    ) => {
      setStickyNotes((current) => {
        const next = current.map((note) =>
          note.id === nodeId
            ? { ...note, data: updater(note.data) }
            : note,
        );
        saveStickyNotes(workflowId, next);
        return next;
      });
    },
    [workflowId],
  );

  const selectStickyNote = useCallback((nodeId: string) => {
    setNodes((current) => {
      const next = current.map((node) => ({ ...node, selected: false }));
      nodesRef.current = next;
      return next;
    });

    setStickyNotes((current) =>
      current.map((note) => ({
        ...note,
        selected: note.id === nodeId,
      })),
    );
  }, []);

  const deselectStickyNote = useCallback((nodeId: string) => {
    setStickyNotes((current) =>
      current.map((note) =>
        note.id === nodeId ? { ...note, selected: false } : note,
      ),
    );
  }, []);

  const deleteStickyNote = useCallback(
    (nodeId: string) => {
      setStickyNotes((current) => {
        const next = current.filter((note) => note.id !== nodeId);
        saveStickyNotes(workflowId, next);
        return next;
      });

      reactFlow.setNodes((flowNodes) =>
        flowNodes.filter((node) => node.id !== nodeId),
      );
    },
    [reactFlow, workflowId],
  );

  const handleAutoArrange = useCallback(() => {
    recordHistory();

    setNodes((current) => {
      const arranged = autoArrangeWorkflowNodes(current, edgesRef.current);
      nodesRef.current = arranged;
      scheduleSave();
      return arranged;
    });

    window.setTimeout(() => {
      reactFlow.fitView({ padding: 0.2, duration: 300 });
    }, 50);
  }, [recordHistory, reactFlow, scheduleSave]);

  const updateNodeData = useCallback(
    (
      nodeId: string,
      updater: (data: WorkflowNodeData) => WorkflowNodeData,
    ) => {
      recordFieldEditHistory();

      setNodes((current) => {
        const next = current.map((node) =>
          node.id === nodeId
            ? { ...node, data: updater(node.data) }
            : node,
        );
        nodesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordFieldEditHistory, scheduleSave],
  );

  const addNode = useCallback(
    (type: AddableWorkflowNodeType, position: { x: number; y: number }) => {
      recordHistory();
      const node = createAddableNode(type, position);

      setNodes((current) => {
        const next = [...current, node];
        nodesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordHistory, scheduleSave],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasRemove = changes.some((change) => change.type === "remove");
      const shouldPersist = changes.some(isPersistableNodeChange);

      if (hasRemove) {
        recordHistory();
      }

      const group = dragGroupRef.current;
      const suppressNodePositions =
        group?.mode === "workflow" ||
        (group?.mode === "node" && group.nodeIds.size >= 2);

      const filtered = changes
        .filter(
          (change) =>
            change.type !== "remove" || !PROTECTED_NODE_IDS.has(change.id),
        )
        .filter(
          (change) =>
            !suppressNodePositions ||
            (change.type !== "position" && change.type !== "dimensions"),
        );

      setNodes((current) => {
        const next = applyNodeChanges(filtered, current);
        nodesRef.current = next;
        return next;
      });

      if (shouldPersist) {
        scheduleSave();
      }
    },
    [recordHistory, scheduleSave],
  );

  const handleFlowNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const workflowChanges: NodeChange[] = [];
      const stickyChanges: NodeChange[] = [];

      for (const change of changes) {
        if ("id" in change && isStickyNoteNodeId(change.id)) {
          stickyChanges.push(change);
        } else {
          workflowChanges.push(change);
        }
      }

      if (stickyChanges.length > 0) {
        setStickyNotes((current) => {
          const next = applyNodeChanges(stickyChanges, current);
          saveStickyNotes(workflowId, next);
          return next;
        });
      }

      if (workflowChanges.length > 0) {
        onNodesChange(workflowChanges);
      }
    },
    [onNodesChange, workflowId],
  );

  const applyConnectedGroupDrag = useCallback(
    (deltaX: number, deltaY: number) => {
      const group = dragGroupRef.current;

      if (!group) {
        return;
      }

      const minGroupSize = group.mode === "workflow" ? 1 : 2;

      if (group.nodeIds.size < minGroupSize) {
        return;
      }

      setNodes((current) => {
        const next = current.map((currentNode) => {
          const start = group.nodeStarts.get(currentNode.id);

          if (!start || currentNode.draggable === false) {
            return currentNode;
          }

          return {
            ...currentNode,
            position: {
              x: start.x + deltaX,
              y: start.y + deltaY,
            },
          };
        });
        nodesRef.current = next;
        return next;
      });
    },
    [],
  );

  const endConnectedGroupDrag = useCallback(() => {
    pointerDragCleanupRef.current?.();
    pointerDragCleanupRef.current = null;
    dragGroupRef.current = null;
    isDraggingRef.current = false;
    setIsWorkflowCanvasDragging(false);
    scheduleSave();
  }, [scheduleSave]);

  const attachPointerGroupDragListeners = useCallback(() => {
    const onPointerMove = (moveEvent: PointerEvent) => {
      const current = reactFlow.screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const group = dragGroupRef.current;

      if (
        !group ||
        (group.mode !== "pointer" && group.mode !== "workflow")
      ) {
        return;
      }

      applyConnectedGroupDrag(
        current.x - group.anchor.x,
        current.y - group.anchor.y,
      );
    };

    const onPointerEnd = () => {
      endConnectedGroupDrag();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);

    pointerDragCleanupRef.current = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [applyConnectedGroupDrag, endConnectedGroupDrag, reactFlow]);

  const beginEdgeGroupDrag = useCallback(
    (sourceNodeId: string, event: React.PointerEvent<SVGElement>) => {
      if (isStickyNoteNodeId(sourceNodeId)) {
        return;
      }

      const groupIds = getConnectedNodeIds(sourceNodeId, edgesRef.current);

      if (groupIds.size < 2) {
        return;
      }

      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        recordHistory();
      }

      const nodeStarts = new Map<string, { x: number; y: number }>();

      for (const currentNode of nodesRef.current) {
        if (groupIds.has(currentNode.id)) {
          nodeStarts.set(currentNode.id, { ...currentNode.position });
        }
      }

      const anchor = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      dragGroupRef.current = {
        anchor,
        nodeStarts,
        nodeIds: groupIds,
        mode: "pointer",
      };

      attachPointerGroupDragListeners();
      event.preventDefault();
    },
    [attachPointerGroupDragListeners, reactFlow, recordHistory],
  );

  const beginWorkflowDrag = useCallback(
    (event: PointerEvent) => {
      pointerDragCleanupRef.current?.();
      pointerDragCleanupRef.current = null;

      const workflowNodeIds = new Set(
        nodesRef.current
          .filter((node) => !isStickyNoteNodeId(node.id))
          .map((node) => node.id),
      );

      if (workflowNodeIds.size === 0) {
        return;
      }

      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        recordHistory();
      }

      const nodeStarts = new Map<string, { x: number; y: number }>();

      for (const currentNode of nodesRef.current) {
        if (workflowNodeIds.has(currentNode.id)) {
          nodeStarts.set(currentNode.id, { ...currentNode.position });
        }
      }

      dragGroupRef.current = {
        anchor: reactFlow.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
        nodeStarts,
        nodeIds: workflowNodeIds,
        mode: "workflow",
      };

      setIsWorkflowCanvasDragging(true);
      attachPointerGroupDragListeners();
      event.preventDefault();
    },
    [attachPointerGroupDragListeners, reactFlow, recordHistory],
  );

  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      pointerDragCleanupRef.current?.();
      pointerDragCleanupRef.current = null;

      if (isStickyNoteNodeId(node.id)) {
        dragGroupRef.current = null;
      } else {
        const groupIds = resolveConnectedGroupDrag(node.id, edgesRef.current, {
          moveConnectedGroup: moveConnectedGroupRef.current,
          shiftKey: event.shiftKey,
        });

        if (groupIds) {
          const nodeStarts = new Map<string, { x: number; y: number }>();

          for (const currentNode of nodesRef.current) {
            if (groupIds.has(currentNode.id)) {
              nodeStarts.set(currentNode.id, { ...currentNode.position });
            }
          }

          dragGroupRef.current = {
            anchor: reactFlow.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            }),
            nodeStarts,
            nodeIds: groupIds,
            mode: "node",
          };
        } else {
          dragGroupRef.current = null;
        }
      }

      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        recordHistory();
      }
    },
    [reactFlow, recordHistory],
  );

  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node<WorkflowNodeData>) => {
      const group = dragGroupRef.current;

      if (
        !group ||
        group.mode !== "node" ||
        !group.nodeIds.has(node.id) ||
        group.nodeIds.size < 2
      ) {
        return;
      }

      const pointer = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      applyConnectedGroupDrag(
        pointer.x - group.anchor.x,
        pointer.y - group.anchor.y,
      );
    },
    [applyConnectedGroupDrag, reactFlow],
  );

  const onNodeDragStop = useCallback(() => {
    endConnectedGroupDrag();
  }, [endConnectedGroupDrag]);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const hasRemove = changes.some((change) => change.type === "remove");
      const shouldPersist = changes.some(isPersistableEdgeChange);

      if (hasRemove) {
        recordHistory();
      }

      setEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        edgesRef.current = next;
        return next;
      });

      if (shouldPersist) {
        scheduleSave();
      }
    },
    [recordHistory, scheduleSave],
  );

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    (document.activeElement as HTMLElement | null)?.blur();

    setNodes((current) => {
      const next = current.map((node) => ({ ...node, selected: false }));
      nodesRef.current = next;
      return next;
    });

    setEdges((current) => {
      const next = current.map((item) => ({
        ...item,
        selected: item.id === edge.id,
      }));
      edgesRef.current = next;
      return next;
    });
  }, []);

  const removeEdges = useCallback(
    (edgeIds: Set<string>) => {
      if (edgeIds.size === 0) {
        return;
      }

      recordHistory();

      setEdges((current) => {
        const next = current.filter((edge) => !edgeIds.has(edge.id));
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordHistory, scheduleSave],
  );

  const removeEdge = useCallback(
    (edgeId: string) => {
      removeEdges(new Set([edgeId]));
    },
    [removeEdges],
  );

  const removeEdgesForSourceHandle = useCallback(
    (nodeId: string, handleId: string) => {
      const edgeIds = new Set(
        edgesRef.current
          .filter(
            (edge) =>
              edge.source === nodeId && edge.sourceHandle === handleId,
          )
          .map((edge) => edge.id),
      );
      removeEdges(edgeIds);
    },
    [removeEdges],
  );

  const remapSourceHandle = useCallback(
    (nodeId: string, oldHandleId: string, newHandleId: string) => {
      if (oldHandleId === newHandleId) {
        return;
      }

      recordFieldEditHistory();

      setEdges((current) => {
        const next = current.map((edge) =>
          edge.source === nodeId && edge.sourceHandle === oldHandleId
            ? { ...edge, sourceHandle: newHandleId }
            : edge,
        );
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordFieldEditHistory, scheduleSave],
  );

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      removeEdges(new Set([edge.id]));
    },
    [removeEdges],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const deletedIds = new Set(deletedEdges.map((edge) => edge.id));

      setEdges((current) => {
        const next = current.filter((edge) => !deletedIds.has(edge.id));
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [scheduleSave],
  );

  const onPaneClick = useCallback(() => {
    setNodes((current) => {
      const next = current.map((node) => ({ ...node, selected: false }));
      nodesRef.current = next;
      return next;
    });

    setEdges((current) => {
      const next = current.map((item) => ({ ...item, selected: false }));
      edgesRef.current = next;
      return next;
    });
  }, []);

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const result = validateWorkflowConnection(
        connection,
        nodesRef.current,
        edgesRef.current,
      );

      lastValidationRef.current = result.reason ?? null;
      return result.valid;
    },
    [],
  );

  const onConnectStart = useCallback(() => {
    connectSessionRef.current = { started: true, connected: false };
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const result = validateWorkflowConnection(
        connection,
        nodesRef.current,
        edgesRef.current,
      );

      if (!result.valid) {
        showToast(result.reason ?? "Invalid connection.");
        return;
      }

      connectSessionRef.current.connected = true;
      recordHistory();

      setNodes((current) => {
        const next = current.map((node) => ({ ...node, selected: false }));
        nodesRef.current = next;
        return next;
      });

      setEdges((current) => {
        const next = addEdge(
          {
            ...connection,
            animated: false,
            style: {
              stroke: getEdgeStrokeColor(connection.sourceHandle),
              strokeWidth: 2,
            },
          },
          current,
        );
        const newestEdge = next[next.length - 1];
        const withSelection = next.map((edge) => ({
          ...edge,
          selected: newestEdge ? edge.id === newestEdge.id : false,
        }));
        edgesRef.current = withSelection;
        scheduleSave();
        return withSelection;
      });
    },
    [recordHistory, scheduleSave, showToast],
  );

  const onConnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent) => {
      if (
        connectSessionRef.current.started &&
        !connectSessionRef.current.connected &&
        lastValidationRef.current
      ) {
        showToast(lastValidationRef.current);
      }

      connectSessionRef.current = { started: false, connected: false };
      lastValidationRef.current = null;
    },
    [showToast],
  );

  useEffect(() => {
    isMountedRef.current = true;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "z";

      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" ||
          (event.shiftKey && event.key.toLowerCase() === "z"));

      if (isUndo) {
        event.preventDefault();
        undo();
      } else if (isRedo) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("keydown", handleKeyDown);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }

      if (fieldEditHistoryTimerRef.current) {
        clearTimeout(fieldEditHistoryTimerRef.current);
      }
    };
  }, [redo, undo]);

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
      selectable: true,
      focusable: true,
      interactionWidth: 24,
      style: { stroke: "#8b7cf7", strokeWidth: 2 },
    }),
    [],
  );

  const refreshNode = useCallback((nodeId: string) => {
    setNodeStatuses((current) => {
      if (!(nodeId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[nodeId];
      return next;
    });

    setNodeInlineExecutions((current) => {
      if (!(nodeId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[nodeId];
      return next;
    });
  }, []);

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const source = nodesRef.current.find((node) => node.id === nodeId);

      if (!source || PROTECTED_NODE_IDS.has(nodeId)) {
        return;
      }

      recordHistory();

      const cloned: Node<WorkflowNodeData> = {
        ...structuredClone(source),
        id: createWorkflowNodeId(source.data.nodeType),
        position: {
          x: source.position.x + 48,
          y: source.position.y + 48,
        },
        selected: true,
        data: {
          ...structuredClone(source.data),
          label: `${source.data.label} copy`,
        },
      };

      setNodes((current) => {
        const next = [
          ...current.map((node) => ({ ...node, selected: false })),
          cloned,
        ];
        nodesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordHistory, scheduleSave],
  );

  const duplicateNodeWithEdges = useCallback(
    (nodeId: string) => {
      const source = nodesRef.current.find((node) => node.id === nodeId);

      if (!source || PROTECTED_NODE_IDS.has(nodeId)) {
        return;
      }

      recordHistory();

      const newId = createWorkflowNodeId(source.data.nodeType);
      const cloned: Node<WorkflowNodeData> = {
        ...structuredClone(source),
        id: newId,
        position: {
          x: source.position.x + 48,
          y: source.position.y + 48,
        },
        selected: true,
        data: {
          ...structuredClone(source.data),
          label: `${source.data.label} copy`,
        },
      };

      const relatedEdges = edgesRef.current.filter(
        (edge) => edge.source === nodeId || edge.target === nodeId,
      );

      const clonedEdges = relatedEdges.map((edge) => ({
        ...structuredClone(edge),
        id: `edge-${newId}-${edge.sourceHandle ?? "out"}-${edge.targetHandle ?? "in"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source: edge.source === nodeId ? newId : edge.source,
        target: edge.target === nodeId ? newId : edge.target,
        animated: false,
      }));

      setNodes((current) => {
        const next = [
          ...current.map((node) => ({ ...node, selected: false })),
          cloned,
        ];
        nodesRef.current = next;
        return next;
      });

      setEdges((current) => {
        const next = [...current, ...clonedEdges];
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordHistory, scheduleSave],
  );

  const toggleNodeLock = useCallback(
    (nodeId: string) => {
      if (PROTECTED_NODE_IDS.has(nodeId)) {
        return;
      }

      recordHistory();

      setNodes((current) => {
        const next = current.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const locked = !node.data.locked;

          return {
            ...node,
            draggable: !locked,
            data: {
              ...node.data,
              locked,
            },
          };
        });
        nodesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordHistory, scheduleSave],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (PROTECTED_NODE_IDS.has(nodeId)) {
        return;
      }

      recordHistory();

      setNodes((current) => {
        const next = current.filter((node) => node.id !== nodeId);
        nodesRef.current = next;
        return next;
      });

      setEdges((current) => {
        const next = current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId,
        );
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [recordHistory, scheduleSave],
  );

  const autoConnectHandle = useCallback(
    (nodeId: string, targetHandle: string) => {
      if (
        isTargetHandleConnected(nodeId, targetHandle, edgesRef.current)
      ) {
        showToast("This input is already connected.");
        return;
      }

      if (isGeminiMagicaTargetHandle(targetHandle)) {
        const unsupportedToast = getUnsupportedMagicaToast(targetHandle);

        if (unsupportedToast) {
          showToast(unsupportedToast);
          return;
        }

        const result = planMagicaAutoConnect(
          nodeId,
          targetHandle,
          nodesRef.current,
        );

        if (result.kind === "no_request_inputs") {
          showToast("Request-Inputs node not found.");
          return;
        }

        if (result.kind !== "plan") {
          showToast("Unable to create input connection.");
          return;
        }

        const nextNodes = applyMagicaAutoConnectToNodes(
          nodesRef.current,
          result.plan,
        );
        const validation = validateWorkflowConnection(
          result.plan.connection,
          nextNodes,
          edgesRef.current,
        );

        if (!validation.valid) {
          showToast(validation.reason ?? "Invalid connection.");
          return;
        }

        recordHistory();

        setNodes((current) => {
          const next = applyMagicaAutoConnectToNodes(current, result.plan).map(
            (node) => ({ ...node, selected: false }),
          );
          nodesRef.current = next;
          return next;
        });

        setEdges((current) => {
          const next = addEdge(
            {
              ...result.plan.connection,
              animated: false,
              style: {
                stroke: getEdgeStrokeColor(result.plan.connection.sourceHandle),
                strokeWidth: 2,
              },
            },
            current,
          );
          const newestEdge = next[next.length - 1];
          const withSelection = next.map((edge) => ({
            ...edge,
            selected: newestEdge ? edge.id === newestEdge.id : false,
          }));
          edgesRef.current = withSelection;
          scheduleSave();
          return withSelection;
        });

        return;
      }

      const connection = findAutoConnectSource(
        nodeId,
        targetHandle,
        nodesRef.current,
        edgesRef.current,
      );

      if (!connection) {
        showToast("No compatible source found to connect.");
        return;
      }

      onConnect(connection);
    },
    [onConnect, recordHistory, scheduleSave, showToast],
  );

  const isSourceConnected = useCallback(
    (nodeId: string, handleId: string) =>
      isSourceHandleConnected(nodeId, handleId, edges),
    [edges],
  );

  const isTargetConnected = useCallback(
    (nodeId: string, handleId: string) =>
      isTargetHandleConnected(nodeId, handleId, edges),
    [edges],
  );

  const getNodeExecutionStatus = useCallback(
    (nodeId: string): NodeRuntimeStatus => nodeStatuses[nodeId] ?? "idle",
    [nodeStatuses],
  );

  const getNodeInlineExecution = useCallback(
    (nodeId: string): NodeInlineExecutionState | null =>
      nodeInlineExecutions[nodeId] ?? null,
    [nodeInlineExecutions],
  );

  const connectedInputMap = useMemo(
    () => buildConnectedInputMap(nodes, edges, {}, nodeInlineExecutions),
    [nodes, edges, nodeInlineExecutions],
  );

  const getConnectedInput = useCallback(
    (nodeId: string, targetHandle: string) =>
      getConnectedInputValue(connectedInputMap, nodeId, targetHandle),
    [connectedInputMap],
  );

  const applyRunResultsToCanvas = useCallback(
    (
      executions: Record<string, NodeInlineExecutionState>,
      source: "poll" | "run-complete" | "history",
    ) => {
      console.info("[run-result] received node outputs", {
        source,
        nodeIds: Object.keys(executions),
        executions,
      });

      setNodeInlineExecutions((previous) =>
        mergeInlineExecutionsFromRun(previous, executions),
      );

      setNodes((current) => {
        const next = applyRunResultsToNodes(current, executions);
        nodesRef.current = next;

        for (const [nodeId, execution] of Object.entries(executions)) {
          if (execution.status === "success") {
            console.info(`[run-result] applying output to node ${nodeId}`);
          }
        }

        return next;
      });
    },
    [],
  );

  const reloadInlineExecutions = useCallback(async () => {
    const executions = await getLatestWorkflowInlineExecutions(workflowId);
    applyRunResultsToCanvas(executions, "history");
  }, [applyRunResultsToCanvas, workflowId]);

  const applyRunExecutionSnapshots = useCallback(
    (
      snapshots: Record<
        string,
        {
          status: NodeRuntimeStatus;
          output: unknown;
          error: string | null;
        }
      >,
    ) => {
      applyRunResultsToCanvas(
        mapSnapshotsToInlineExecutions(snapshots),
        "poll",
      );
    },
    [applyRunResultsToCanvas],
  );

  const resetRunVisualState = useCallback(() => {
    setNodeStatuses({});
    setActiveNodeIds([]);
    setIsWorkflowRunning(false);
    setActiveRunId(null);
  }, []);

  const handleRun = useCallback(async () => {
    if (isWorkflowRunning) {
      return;
    }

    if (!canRunWorkflow || saveStatus === "error") {
      showToast("Save the workflow before running. Fix any save errors first.");
      return;
    }

    const selectedNodeIds = nodesRef.current
      .filter((node) => node.selected)
      .map((node) => node.id);

    let scope: RunScope = "full";

    if (selectedNodeIds.length === 1) {
      scope = "single";
    } else if (selectedNodeIds.length > 1) {
      scope = "partial";
    }

    setIsWorkflowRunning(true);
    setNodeStatuses({});
    setActiveNodeIds([]);
    setNodeInlineExecutions((previous) => ({
      ...previous,
      ...createUpdatingInlineExecutions(
        nodesRef.current.map((node) => node.id),
      ),
    }));

    const saved = await persistGraphNow(nodesRef.current, edgesRef.current);

    if (!saved) {
      resetRunVisualState();
      await reloadInlineExecutions();
      return;
    }

    const executionGraph = prepareGraphPayload(
      nodesRef.current,
      edgesRef.current,
    );

    const result = await startWorkflowRun({
      workflowId,
      scope,
      selectedNodeIds,
      nodes: executionGraph.nodes as unknown as Record<string, unknown>[],
      edges: executionGraph.edges as unknown as Record<string, unknown>[],
    });

    if (!result.success) {
      resetRunVisualState();
      await reloadInlineExecutions();

      if (result.error?.toLowerCase().includes("not found")) {
        markWorkflowUnavailable(
          result.error ??
            "This workflow no longer exists. Return to the dashboard.",
        );
      } else {
        showToast(result.error ?? "Failed to start workflow run.");
      }

      return;
    }

    setActiveRunId(result.runId);
    setRunPollError(null);
    setLiveRunHistory(null);
    setHistoryRefreshKey((current) => current + 1);
    showToast("Workflow run started.");
  }, [
    canRunWorkflow,
    isWorkflowRunning,
    markWorkflowUnavailable,
    persistGraphNow,
    reloadInlineExecutions,
    resetRunVisualState,
    saveStatus,
    showToast,
    workflowId,
  ]);

  const runNode = useCallback(
    (nodeId: string) => {
      setNodes((current) => {
        const next = current.map((node) => ({
          ...node,
          selected: node.id === nodeId,
        }));
        nodesRef.current = next;
        return next;
      });

      setEdges((current) => {
        const next = current.map((edge) => ({ ...edge, selected: false }));
        edgesRef.current = next;
        return next;
      });

      queueMicrotask(() => {
        void handleRun();
      });
    },
    [handleRun],
  );

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    let cancelled = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let pollFailureCount = 0;
    let pollInFlight = false;
    const runId = activeRunId;

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const clearUpdatingStates = () => {
      setNodeInlineExecutions((previous) => {
        const next = { ...previous };

        for (const [nodeId, inline] of Object.entries(next)) {
          if (inline.status === "updating") {
            delete next[nodeId];
          }
        }

        return next;
      });
    };

    const refreshHistory = async () => {
      const history = await pollServerAction("getWorkflowRunHistory", () =>
        getWorkflowRunHistory(workflowId),
      );

      if (!cancelled) {
        setLiveRunHistory(history);
      }

      return history;
    };

    const finishActiveRun = async (state: ActiveRunState) => {
      stopPolling();
      setRunPollError(null);
      setNodeStatuses(state.nodeStatuses);
      setActiveNodeIds(state.activeNodeIds);
      applyRunExecutionSnapshots(state.nodeExecutions);

      let outputsApplied = hasSuccessfulRunOutputs(
        mapSnapshotsToInlineExecutions(state.nodeExecutions),
      );

      try {
        const executions = await pollServerAction(
          "waitForWorkflowRunOutputs",
          () => waitForWorkflowRunOutputs(runId),
          35_000,
        );

        if (!cancelled) {
          applyRunResultsToCanvas(executions, "run-complete");
          outputsApplied =
            outputsApplied || hasSuccessfulRunOutputs(executions);
        }
      } catch (error) {
        console.error("[poll] waitForWorkflowRunOutputs failed:", error);
      }

      if (!cancelled) {
        clearUpdatingStates();

        if (!outputsApplied) {
          setRunPollError(
            "Run finished but outputs are still syncing. Check history in a moment.",
          );
        } else {
          setRunPollError(null);
        }
      }

      await refreshHistory().catch((error) => {
        console.error("[poll] refreshHistory failed:", error);
      });

      if (!cancelled) {
        setHistoryRefreshKey((current) => current + 1);
      }

      if (cancelled) {
        return;
      }

      setIsWorkflowRunning(false);

      if (state.status === "success") {
        showToast("Workflow run completed.");
      } else if (state.status === "failed") {
        showToast("Workflow run failed.");
      } else {
        showToast("Workflow run finished with partial success.");
      }

      resetTimer = setTimeout(() => {
        if (!cancelled) {
          resetRunVisualState();
          setLiveRunHistory(null);
        }
      }, RUN_STATUS_RESET_MS);
    };

    const resolveActiveRunState = async (): Promise<ActiveRunState | null> =>
      pollServerAction("getActiveRunState", () => getActiveRunState(runId));

    const poll = async () => {
      if (cancelled || pollInFlight) {
        return;
      }

      pollInFlight = true;

      try {
        const [state, history] = await Promise.all([
          resolveActiveRunState(),
          refreshHistory().catch(() => null),
        ]);

        if (cancelled) {
          return;
        }

        if (!state) {
          pollFailureCount += 1;

          if (pollFailureCount >= MAX_RUN_POLL_FAILURES) {
            stopPolling();
            setIsWorkflowRunning(false);
            clearUpdatingStates();
            setRunPollError("Could not load run status. Try reopening history.");
            showToast("Could not load run status.");
            resetRunVisualState();
            setLiveRunHistory(null);
          }

          return;
        }

        pollFailureCount = 0;
        setRunPollError(null);

        setNodeStatuses(state.nodeStatuses);
        setActiveNodeIds(state.activeNodeIds);

        const historySummary = history?.find((run) => run.id === runId);
        const status =
          historySummary && isTerminalRunStatus(historySummary.status)
            ? historySummary.status
            : state.status;

        if (status === "running") {
          applyRunExecutionSnapshots(state.nodeExecutions);
          return;
        }

        await finishActiveRun({
          ...state,
          status,
        });
      } catch (error) {
        pollFailureCount += 1;
        console.error("[poll] getActiveRunState failed:", error);

        if (pollFailureCount >= MAX_RUN_POLL_FAILURES) {
          stopPolling();
          setIsWorkflowRunning(false);
          clearUpdatingStates();
          setRunPollError("Lost connection to run status.");
          showToast(
            "Lost connection to run status. Check execution history for results.",
          );
          resetRunVisualState();
          setLiveRunHistory(null);
        }
      } finally {
        pollInFlight = false;
      }
    };

    void poll();
    interval = setInterval(() => {
      void poll();
    }, RUN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();

      if (resetTimer) {
        clearTimeout(resetTimer);
      }
    };
  }, [
    activeRunId,
    applyRunResultsToCanvas,
    applyRunExecutionSnapshots,
    resetRunVisualState,
    showToast,
    workflowId,
  ]);

  useEffect(() => {
    let cancelled = false;

    void getLatestWorkflowInlineExecutions(workflowId).then((executions) => {
      if (!cancelled) {
        applyRunResultsToCanvas(executions, "history");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [workflowId, applyRunResultsToCanvas]);

  const runningNodeIdSet = useMemo(
    () => new Set(activeNodeIds),
    [activeNodeIds],
  );

  const displayNodes = useMemo(
    () => [...nodes, ...stickyNotes],
    [nodes, stickyNotes],
  );

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const touchesRunning =
          runningNodeIdSet.has(edge.source) ||
          runningNodeIdSet.has(edge.target);
        const strokeColor =
          (edge.style as { stroke?: string } | undefined)?.stroke ??
          getEdgeStrokeColor(edge.sourceHandle);

        return {
          ...edge,
          animated: isWorkflowRunning ? touchesRunning : false,
          className: touchesRunning ? "workflow-edge-running" : edge.className,
          style: {
            ...edge.style,
            stroke: strokeColor,
            strokeWidth: touchesRunning ? 2.5 : 2,
          },
        };
      }),
    [edges, runningNodeIdSet, isWorkflowRunning],
  );

  const builderContextValue = useMemo(
    () => ({
      workflowId: workflow.id,
      updateNodeData,
      updateStickyNote,
      selectStickyNote,
      deselectStickyNote,
      deleteStickyNote,
      isSourceHandleConnected: isSourceConnected,
      isTargetHandleConnected: isTargetConnected,
      getNodeExecutionStatus,
      getNodeInlineExecution,
      getConnectedInput,
      isWorkflowRunning,
      runNode,
      removeEdge,
      removeEdgesForSourceHandle,
      remapSourceHandle,
      refreshNode,
      duplicateNode,
      duplicateNodeWithEdges,
      toggleNodeLock,
      deleteNode,
      autoConnectHandle,
      beginEdgeGroupDrag,
    }),
    [
      workflow.id,
      updateNodeData,
      updateStickyNote,
      selectStickyNote,
      deselectStickyNote,
      deleteStickyNote,
      isSourceConnected,
      isTargetConnected,
      getNodeExecutionStatus,
      getNodeInlineExecution,
      getConnectedInput,
      isWorkflowRunning,
      runNode,
      removeEdge,
      removeEdgesForSourceHandle,
      remapSourceHandle,
      refreshNode,
      duplicateNode,
      duplicateNodeWithEdges,
      toggleNodeLock,
      deleteNode,
      autoConnectHandle,
      beginEdgeGroupDrag,
    ],
  );

  return (
    <WorkflowBuilderProvider value={builderContextValue}>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <input
          ref={importFileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void handleImportFileChange(event)}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
          className={`workflow-canvas workflow-canvas-surface relative min-h-0 min-w-0 flex-1${isWorkflowCanvasDragging ? " workflow-canvas-dragging" : ""}`}
        >
            <WorkflowBuilderTopBar
              workflowName={workflow.name}
              saveStatus={saveStatus}
              isRunning={isWorkflowRunning}
              isLeaving={isLeaving}
              canRun={canRunWorkflow && saveStatus !== "error"}
              historyOpen={historyOpen}
              onNavigateDashboard={() => void handleNavigateToDashboard()}
              onRun={() => void handleRun()}
              onToggleHistory={() => setHistoryOpen((current) => !current)}
              onExportJson={handleExportJson}
              onImportJson={handleImportJsonClick}
              onLoadSample={() => void handleLoadSample()}
            />
            <WorkflowToast message={toastMessage} />
            <div className="absolute inset-0">
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={handleFlowNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneClick={onPaneClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            elementsSelectable
            deleteKeyCode={["Backspace", "Delete"]}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll
            selectionOnDrag={false}
            className="h-full w-full bg-transparent"
          >
            <WorkflowPaneDragHandler onBeginWorkflowDrag={beginWorkflowDrag} />
            <CanvasInitializer />
            {showGrid ? (
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.5}
                color="var(--canvas-dot)"
              />
            ) : null}
            <Panel position="bottom-left" className="!m-4">
              <CanvasControlsToolbar
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
                moveConnectedGroup={moveConnectedGroup}
                onMoveConnectedGroupChange={setMoveConnectedGroup}
                showGrid={showGrid}
                onShowGridChange={setShowGrid}
                onAutoArrange={handleAutoArrange}
              />
            </Panel>
            <Panel position="bottom-center" className="!mb-4">
              <CanvasBottomToolbar
                onAddNode={() => setNodePickerOpen(true)}
                onAddStickyNote={handleAddStickyNote}
              />
            </Panel>
            <Panel position="bottom-right" className="!mb-5 !mr-1">
              <CanvasMinimapPanel
                visible={showMinimap}
                onToggle={() => setShowMinimap((current) => !current)}
              />
            </Panel>
          </ReactFlow>
            </div>
            <NodePickerOverlay
              onAddNode={addNode}
              onDemoSelect={showToast}
              open={nodePickerOpen}
              onOpenChange={setNodePickerOpen}
            />
          </div>
          {historyOpen ? (
            <WorkflowHistoryPanel
              workflowId={workflow.id}
              refreshKey={historyRefreshKey}
              activeRunId={activeRunId}
              isRunActive={isWorkflowRunning || activeRunId !== null}
              liveRuns={liveRunHistory}
              pollError={runPollError}
              onApplyRunResults={applyRunResultsToCanvas}
              onClose={() => setHistoryOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </WorkflowBuilderProvider>
  );
}

type WorkflowBuilderProps = {
  workflow: WorkflowBuilderDTO;
};

export function WorkflowBuilder({ workflow }: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <div className="flex h-full min-h-0 flex-1">
        <WorkflowCanvasInner workflow={workflow} />
      </div>
    </ReactFlowProvider>
  );
}
