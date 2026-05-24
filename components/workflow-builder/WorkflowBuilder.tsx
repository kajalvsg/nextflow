"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
  startWorkflowRun,
} from "@/actions/workflow-execution";
import { saveWorkflowGraph } from "@/actions/workflow-builder";
import { PROTECTED_NODE_IDS, sanitizeGraphForSave } from "@/lib/workflow/canvas";
import { prepareGraphPayload, serializeGraphPayload } from "@/lib/workflow/graph-payload";
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
import { createAddableNode } from "@/lib/workflow/node-registry";
import { getWorkflowCanvasCenter } from "@/lib/workflow/viewport";
import type {
  AddableWorkflowNodeType,
  WorkflowBuilderDTO,
  WorkflowNodeData,
} from "@/types/workflow-canvas";
import type {
  NodeRuntimeStatus,
  RunScope,
} from "@/types/workflow-execution";
import { CropImageNode } from "./nodes/CropImageNode";
import { GeminiProNode } from "./nodes/GeminiProNode";
import { RequestInputsNode } from "./nodes/RequestInputsNode";
import { ResponseNode } from "./nodes/ResponseNode";
import { NodePicker } from "./NodePicker";
import { WorkflowBuilderProvider } from "./WorkflowBuilderContext";
import { WorkflowBuilderTopBar } from "./WorkflowBuilderTopBar";
import { WorkflowHistoryPanel } from "./WorkflowHistoryPanel";
import { WorkflowToast } from "./WorkflowToast";

const nodeTypes = {
  requestInputs: RequestInputsNode,
  cropImage: CropImageNode,
  geminiPro: GeminiProNode,
  response: ResponseNode,
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const TOAST_DURATION_MS = 3200;
const AUTOSAVE_DEBOUNCE_MS = 1200;
const RUN_POLL_INTERVAL_MS = 4000;
const RUN_STATUS_RESET_MS = 3500;

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
};

function NodePickerPanel({ onAddNode }: NodePickerPanelProps) {
  const reactFlow = useReactFlow();

  const handleSelectType = useCallback(
    (type: AddableWorkflowNodeType) => {
      const position = getWorkflowCanvasCenter(reactFlow);
      onAddNode(type, position);
    },
    [onAddNode, reactFlow],
  );

  return (
    <Panel position="bottom-center" className="!mb-6 !mt-0">
      <NodePicker onSelectType={handleSelectType} />
    </Panel>
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<string, NodeRuntimeStatus>
  >({});
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [runScopeLabel, setRunScopeLabel] = useState<string | null>(null);
  const [canRunWorkflow, setCanRunWorkflow] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const historyRef = useRef<HistoryStack>(createHistoryStack(workflow.nodes, workflow.edges));
  const isHistoryActionRef = useRef(false);
  const isDraggingRef = useRef(false);
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
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const present = cloneGraphSnapshot(nodesRef.current, edgesRef.current);
    const result = redoHistory(present, historyRef.current);

    if (!result) {
      return;
    }

    historyRef.current = result.stack;
    applySnapshot(result.snapshot);
  }, [applySnapshot]);

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

      const filtered = changes.filter(
        (change) =>
          change.type !== "remove" || !PROTECTED_NODE_IDS.has(change.id),
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

  const onNodeDragStart = useCallback(() => {
    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      recordHistory();
    }
  }, [recordHistory]);

  const onNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
    scheduleSave();
  }, [scheduleSave]);

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
            animated: true,
            style: { stroke: "#8b7cf7", strokeWidth: 2 },
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
      animated: true,
      selectable: true,
      focusable: true,
      interactionWidth: 24,
      style: { stroke: "#8b7cf7", strokeWidth: 2 },
    }),
    [],
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

  const resetRunVisualState = useCallback(() => {
    setNodeStatuses({});
    setActiveNodeIds([]);
    setIsWorkflowRunning(false);
    setActiveRunId(null);
    setRunScopeLabel(null);
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

  const scopeLabels: Record<RunScope, string> = {
    full: "Run full workflow",
    single: "Run selected node",
    partial: "Run selected nodes",
  };

    setRunScopeLabel(scopeLabels[scope]);
    setIsWorkflowRunning(true);
    setNodeStatuses({});
    setActiveNodeIds([]);

    const saved = await persistGraphNow(nodesRef.current, edgesRef.current);

    if (!saved) {
      resetRunVisualState();
      return;
    }

    const result = await startWorkflowRun({
      workflowId,
      scope,
      selectedNodeIds,
    });

    if (!result.success) {
      resetRunVisualState();

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
    setHistoryRefreshKey((current) => current + 1);
    showToast("Workflow run started.");
  }, [
    canRunWorkflow,
    isWorkflowRunning,
    markWorkflowUnavailable,
    persistGraphNow,
    resetRunVisualState,
    saveStatus,
    showToast,
    workflowId,
  ]);

  useEffect(() => {
    if (!activeRunId || !isWorkflowRunning) {
      return;
    }

    let cancelled = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (cancelled || !isWorkflowRunning) {
        return;
      }

      const state = await getActiveRunState(activeRunId);

      if (cancelled) {
        return;
      }

      if (!state) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }

        setIsWorkflowRunning(false);
        setActiveRunId(null);
        return;
      }

      setNodeStatuses(state.nodeStatuses);
      setActiveNodeIds(state.activeNodeIds);

      if (state.status !== "running") {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }

        setIsWorkflowRunning(false);
        setHistoryRefreshKey((current) => current + 1);

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
          }
        }, RUN_STATUS_RESET_MS);
      }
    };

    void poll();
    interval = setInterval(() => {
      void poll();
    }, RUN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;

      if (interval) {
        clearInterval(interval);
      }

      if (resetTimer) {
        clearTimeout(resetTimer);
      }
    };
  }, [activeRunId, isWorkflowRunning, resetRunVisualState, showToast]);

  const runningNodeIdSet = useMemo(
    () => new Set(activeNodeIds),
    [activeNodeIds],
  );

  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const touchesRunning =
          runningNodeIdSet.has(edge.source) ||
          runningNodeIdSet.has(edge.target);

        return {
          ...edge,
          animated: isWorkflowRunning ? touchesRunning : (edge.animated ?? true),
          className: touchesRunning ? "workflow-edge-running" : edge.className,
        };
      }),
    [edges, runningNodeIdSet, isWorkflowRunning],
  );

  const builderContextValue = useMemo(
    () => ({
      workflowId: workflow.id,
      updateNodeData,
      isSourceHandleConnected: isSourceConnected,
      isTargetHandleConnected: isTargetConnected,
      getNodeExecutionStatus,
      isWorkflowRunning,
    }),
    [
      workflow.id,
      updateNodeData,
      isSourceConnected,
      isTargetConnected,
      getNodeExecutionStatus,
      isWorkflowRunning,
    ],
  );

  return (
    <WorkflowBuilderProvider value={builderContextValue}>
      <div className="flex h-full min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <WorkflowBuilderTopBar
            workflowName={workflow.name}
            saveStatus={saveStatus}
            isRunning={isWorkflowRunning}
            isLeaving={isLeaving}
            canRun={canRunWorkflow && saveStatus !== "error"}
            runScopeLabel={runScopeLabel}
            onNavigateDashboard={() => void handleNavigateToDashboard()}
            onRun={() => void handleRun()}
            onExportJson={handleExportJson}
            onImportJson={handleImportJsonClick}
            onLoadSample={() => void handleLoadSample()}
          />
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleImportFileChange(event)}
          />
          <div className="workflow-canvas relative min-h-0 flex-1">
          <WorkflowToast message={toastMessage} />
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onPaneClick={onPaneClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            elementsSelectable
            deleteKeyCode={["Backspace", "Delete"]}
            minZoom={0.2}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            className="bg-background"
          >
            <CanvasInitializer />
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.2}
              color="#2a2a34"
            />
            <Controls className="workflow-controls" showInteractive={false} />
            <MiniMap
              className="workflow-minimap"
              nodeColor="#8b7cf7"
              maskColor="rgb(12 12 16 / 0.75)"
            />
            <NodePickerPanel onAddNode={addNode} />
          </ReactFlow>
        </div>
        </div>
        <WorkflowHistoryPanel
          workflowId={workflow.id}
          refreshKey={historyRefreshKey}
        />
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
