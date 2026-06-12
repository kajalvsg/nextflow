"use client";

import { memo, useCallback } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "reactflow";
import { X } from "lucide-react";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";

function WorkflowEdgeComponent({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  style,
  markerEnd,
  interactionWidth,
}: EdgeProps) {
  const { removeEdge, beginEdgeGroupDrag } = useWorkflowBuilder();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      removeEdge(id);
    },
    [id, removeEdge],
  );

  const handleEdgePointerDown = useCallback(
    (event: React.PointerEvent<SVGPathElement>) => {
      if (event.button !== 0) {
        return;
      }

      event.stopPropagation();
      beginEdgeGroupDrag(source, event);
    },
    [beginEdgeGroupDrag, source],
  );

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="workflow-edge-hit nodrag"
        onPointerDown={handleEdgePointerDown}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth}
      />
      {selected ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="workflow-edge-delete nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            aria-label="Delete connection"
            title="Delete connection"
            onClick={handleDelete}
          >
            <X className="h-3 w-3 text-red-800" strokeWidth={2.5} />
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const WorkflowEdge = memo(WorkflowEdgeComponent);
