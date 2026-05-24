import type { Edge, Node } from "reactflow";

export type WorkflowNodeType = "requestInputs" | "response";

export type WorkflowNodeData = {
  label: string;
  nodeType: WorkflowNodeType;
};

export type WorkflowCanvasNode = Node<WorkflowNodeData>;
export type WorkflowCanvasEdge = Edge;

export type WorkflowBuilderDTO = {
  id: string;
  name: string;
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
};
