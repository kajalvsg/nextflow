"use client";

import { Info, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NodeHandle } from "./NodeHandle";
import { NodeDecorativeHandle } from "./NodeDecorativeHandle";

type UploadHandleColor = "image" | "green" | "cyan" | "purple";

type NodeUploadInputRowProps = {
  label: string;
  buttonLabel: string;
  connected?: boolean;
  connectedText?: string;
  handleId?: string;
  decorativeColor?: UploadHandleColor;
  onAddConnection?: () => void;
  onUploadClick?: () => void;
  disabled?: boolean;
  className?: string;
  dense?: boolean;
};

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function NodeUploadInputRow({
  label,
  buttonLabel,
  connected = false,
  connectedText = "Input connected",
  handleId,
  decorativeColor,
  onAddConnection,
  onUploadClick,
  disabled = false,
  className,
  dense = false,
}: NodeUploadInputRowProps) {
  const showFunctionalHandle = Boolean(handleId);

  return (
    <div
      className={cn(
        "workflow-node-field-row nodrag nopan nowheel relative",
        className,
      )}
    >
      {showFunctionalHandle ? (
        <div className="workflow-handle-slot workflow-handle-slot-left">
          <NodeHandle id={handleId!} type="target" inline />
        </div>
      ) : decorativeColor ? (
        <div className="workflow-handle-slot workflow-handle-slot-left pointer-events-none">
          <NodeDecorativeHandle color={decorativeColor} />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "workflow-node-label-row flex items-center justify-between gap-2",
            dense ? "mb-0.5" : "mb-1.5",
          )}
        >
          <div className="flex min-w-0 items-center gap-1">
            <span className="workflow-node-field-label truncate">{label}</span>
            <button
              type="button"
              className="workflow-node-field-info"
              aria-label={`${label} information`}
              onMouseDown={stopNodePointer}
              onPointerDown={stopNodePointer}
            >
              <Info className="h-3 w-3" />
            </button>
          </div>

          {onAddConnection ? (
            <button
              type="button"
              className={cn(
                "workflow-node-add-connection-btn",
                dense && "workflow-node-add-connection-btn-dense",
              )}
              aria-label={`Connect ${label}`}
              title="Add connection"
              disabled={connected}
              onClick={(event) => {
                stopNodePointer(event);
                onAddConnection();
              }}
              onMouseDown={stopNodePointer}
              onPointerDown={stopNodePointer}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          disabled={disabled || connected}
          onClick={(event) => {
            stopNodePointer(event);
            onUploadClick?.();
          }}
          onMouseDown={stopNodePointer}
          onPointerDown={stopNodePointer}
          className={cn(
            "workflow-node-upload-btn w-full",
            dense && "workflow-node-upload-btn-dense",
            (disabled || connected) && "opacity-75",
          )}
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span>{connected ? connectedText : buttonLabel}</span>
        </button>
      </div>
    </div>
  );
}
