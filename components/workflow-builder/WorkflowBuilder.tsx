"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
import { saveWorkflowGraph } from "@/actions/workflow-builder";
import { PROTECTED_NODE_IDS } from "@/lib/workflow/canvas";
import type { WorkflowBuilderDTO, WorkflowNodeData } from "@/types/workflow-canvas";
import { RequestInputsNode } from "./nodes/RequestInputsNode";
import { ResponseNode } from "./nodes/ResponseNode";
import { WorkflowBuilderTopBar } from "./WorkflowBuilderTopBar";

const nodeTypes = {
  requestInputs: RequestInputsNode,
  response: ResponseNode,
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type WorkflowCanvasInnerProps = {
  workflow: WorkflowBuilderDTO;
};

function WorkflowCanvasInner({ workflow }: WorkflowCanvasInnerProps) {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>(workflow.nodes);
  const [edges, setEdges] = useState<Edge[]>(workflow.edges);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const persistGraph = useCallback(async () => {
    setSaveStatus("saving");

    const result = await saveWorkflowGraph({
      id: workflow.id,
      nodes: nodesRef.current as unknown as Record<string, unknown>[],
      edges: edgesRef.current as unknown as Record<string, unknown>[],
    });

    if (!isMountedRef.current) return;

    setSaveStatus(result.success ? "saved" : "error");
  }, [workflow.id]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void persistGraph();
    }, 600);
  }, [persistGraph]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<WorkflowNodeData>>[]) => {
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
    [scheduleSave],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [scheduleSave],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        const next = addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: "#8b7cf7", strokeWidth: 2 },
          },
          current,
        );
        edgesRef.current = next;
        scheduleSave();
        return next;
      });
    },
    [scheduleSave],
  );

  const onNodeDragStop = useCallback(() => {
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    isMountedRef.current = true;
    const timer = setTimeout(() => {
      fitView({ padding: 0.2, duration: 300 });
    }, 50);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [fitView]);

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: true,
      style: { stroke: "#8b7cf7", strokeWidth: 2 },
    }),
    [],
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <WorkflowBuilderTopBar
        workflowName={workflow.name}
        saveStatus={saveStatus}
      />
      <div className="workflow-canvas relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
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
        </ReactFlow>
      </div>
    </div>
  );
}

type WorkflowBuilderProps = {
  workflow: WorkflowBuilderDTO;
};

export function WorkflowBuilder({ workflow }: WorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner workflow={workflow} />
    </ReactFlowProvider>
  );
}
