"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const RUN_POLL_INTERVAL_MS = 1500;
const RUN_STATUS_RESET_MS = 3500;

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

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        setSaveStatus("saving");

        const { nodes: sanitizedNodes, edges: sanitizedEdges } =
          sanitizeGraphForSave(nodesRef.current, edgesRef.current);

        const result = await saveWorkflowGraph({
          id: workflow.id,
          nodes: sanitizedNodes as unknown as Record<string, unknown>[],
          edges: sanitizedEdges as unknown as Record<string, unknown>[],
        });

        if (!isMountedRef.current) return;

        setSaveStatus(result.success ? "saved" : "error");
      })();
    }, 600);
  }, [workflow.id]);

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
        scheduleSave();
        return next;
      });
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

      if (hasRemove) {
        recordHistory();
      }

      setEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
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

    const { nodes: sanitizedNodes, edges: sanitizedEdges } =
      sanitizeGraphForSave(nodesRef.current, edgesRef.current);

    const saveResult = await saveWorkflowGraph({
      id: workflow.id,
      nodes: sanitizedNodes as unknown as Record<string, unknown>[],
      edges: sanitizedEdges as unknown as Record<string, unknown>[],
    });

    if (!saveResult.success) {
      resetRunVisualState();
      showToast(saveResult.error ?? "Could not save workflow before run.");
      return;
    }

    const result = await startWorkflowRun({
      workflowId: workflow.id,
      scope,
      selectedNodeIds,
      nodes: sanitizedNodes as unknown as Record<string, unknown>[],
      edges: sanitizedEdges as unknown as Record<string, unknown>[],
    });

    if (!result.success) {
      resetRunVisualState();
      showToast(result.error);
      return;
    }

    setActiveRunId(result.runId);
    setHistoryRefreshKey((current) => current + 1);
    showToast("Workflow run started.");
  }, [isWorkflowRunning, resetRunVisualState, showToast, workflow.id]);

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    let cancelled = false;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      const state = await getActiveRunState(activeRunId);

      if (cancelled || !state) {
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
  }, [activeRunId, resetRunVisualState, showToast]);

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
            runScopeLabel={runScopeLabel}
            onRun={() => void handleRun()}
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
