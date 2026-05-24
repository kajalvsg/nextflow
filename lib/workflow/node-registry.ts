import {
  defaultConfigForNodeType,
  defaultLabelForNodeType,
} from "@/lib/workflow/node-defaults";
import type {
  AddableWorkflowNodeType,
  NodePickerItem,
  WorkflowCanvasNode,
  WorkflowNodeType,
} from "@/types/workflow-canvas";

export const NODE_PICKER_ITEMS: NodePickerItem[] = [
  {
    type: "cropImage",
    label: "Crop Image",
    description: "Crop an input image using percentage-based bounds.",
    keywords: ["crop", "image", "resize", "cut"],
  },
  {
    type: "geminiPro",
    label: "Gemini 3.1 Pro",
    description: "Generate responses with Gemini 3.1 Pro vision model.",
    keywords: ["gemini", "ai", "llm", "vision", "pro"],
  },
];

export function createWorkflowNode(
  nodeType: WorkflowNodeType,
  position: { x: number; y: number },
  id?: string,
): WorkflowCanvasNode {
  const nodeId = id ?? `${nodeType}-${crypto.randomUUID()}`;

  return {
    id: nodeId,
    type: nodeType,
    position,
    data: {
      label: defaultLabelForNodeType(nodeType),
      nodeType,
      config: defaultConfigForNodeType(nodeType),
    },
    deletable: nodeType !== "requestInputs" && nodeType !== "response",
    draggable: true,
    selectable: true,
  };
}

export function createAddableNode(
  nodeType: AddableWorkflowNodeType,
  position: { x: number; y: number },
): WorkflowCanvasNode {
  return createWorkflowNode(nodeType, position);
}
