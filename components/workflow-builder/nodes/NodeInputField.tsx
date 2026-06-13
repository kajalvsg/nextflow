"use client";

import { Info, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NodeHandle } from "./NodeHandle";

type NodeInputFieldProps = {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  disabled?: boolean;
  connected?: boolean;
  connectedHint?: string | null;
  minRows?: number;
  handleId?: string;
  handleType?: "target" | "source";
  onChange: (value: string) => void;
  onAddConnection?: () => void;
  className?: string;
  dense?: boolean;
};

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function NodeInputField({
  label,
  required = false,
  placeholder,
  value,
  disabled = false,
  connected = false,
  connectedHint = null,
  minRows = 2,
  handleId,
  handleType = "target",
  onChange,
  onAddConnection,
  className,
  dense = false,
}: NodeInputFieldProps) {
  return (
    <div
      className={cn(
        "workflow-node-field-row nodrag nopan nowheel relative",
        className,
      )}
    >
      {handleId ? (
        <div
          className={cn(
            "workflow-handle-slot",
            handleType === "source"
              ? "workflow-handle-slot-right"
              : "workflow-handle-slot-left",
          )}
        >
          <NodeHandle id={handleId} type={handleType} inline />
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
            <span className="workflow-node-field-label truncate">
              {label}
              {required ? <span className="text-red-500">*</span> : null}
            </span>
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

        <textarea
          value={value}
          disabled={disabled || connected}
          placeholder={placeholder}
          rows={dense ? 1 : minRows}
          onChange={(event) => onChange(event.target.value)}
          onPointerDown={stopNodePointer}
          className={cn(
            "workflow-node-prompt-field w-full resize-y",
            dense
              ? "min-h-[38px]"
              : minRows <= 2
                ? "min-h-[52px]"
                : "min-h-[72px]",
            (disabled || connected) && "opacity-80",
          )}
        />

        {connected ? (
          <p
            className={cn(
              "text-[10px] text-muted-foreground",
              dense ? "mt-0.5" : "mt-1",
            )}
          >
            {connectedHint ?? "Connected — manual input disabled."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
