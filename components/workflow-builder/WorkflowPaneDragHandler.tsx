"use client";

import { useEffect, useRef } from "react";
import { isWorkflowCanvasDragTarget } from "@/lib/workflow/canvas-drag";

type WorkflowPaneDragHandlerProps = {
  onBeginWorkflowDrag: (event: PointerEvent) => void;
};

export function WorkflowPaneDragHandler({
  onBeginWorkflowDrag,
}: WorkflowPaneDragHandlerProps) {
  const onBeginRef = useRef(onBeginWorkflowDrag);
  onBeginRef.current = onBeginWorkflowDrag;

  useEffect(() => {
    const pane = document.querySelector<HTMLElement>(
      ".workflow-canvas .react-flow__pane",
    );

    if (!pane) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      if (!isWorkflowCanvasDragTarget(event.target)) {
        return;
      }

      onBeginRef.current(event);
    };

    pane.addEventListener("pointerdown", handlePointerDown);

    return () => {
      pane.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return null;
}
