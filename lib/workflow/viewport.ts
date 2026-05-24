import type { ReactFlowInstance } from "reactflow";

export function getWorkflowCanvasCenter(client: ReactFlowInstance): {
  x: number;
  y: number;
} {
  const container = document.querySelector(".workflow-canvas");

  if (!container) {
    return client.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  }

  const bounds = container.getBoundingClientRect();

  const position = client.screenToFlowPosition({
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  });

  return {
    x: Number.isFinite(position.x) ? position.x : 400,
    y: Number.isFinite(position.y) ? position.y : 240,
  };
}
