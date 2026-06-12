/** True when pointer down should move the entire workflow (empty canvas / grid). */
export function isWorkflowCanvasDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (!target.closest(".workflow-canvas .react-flow")) {
    return false;
  }

  if (target.closest(".react-flow__node")) {
    return false;
  }

  if (target.closest(".react-flow__edge")) {
    return false;
  }

  if (target.closest(".react-flow__connection")) {
    return false;
  }

  if (target.closest(".react-flow__panel")) {
    return false;
  }

  if (target.closest(".canvas-toolbar")) {
    return false;
  }

  if (target.closest(".workflow-builder-topbar")) {
    return false;
  }

  if (target.closest(".workflow-node-picker-overlay")) {
    return false;
  }

  if (target.closest(".workflow-edge-delete")) {
    return false;
  }

  return true;
}
