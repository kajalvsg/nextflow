"use client";

import { Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { NodeDecorativeHandle } from "./NodeDecorativeHandle";

type NodeCropSliderRowProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  defaultValue: number;
  onChange: (value: number) => void;
  className?: string;
  dense?: boolean;
};

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isDigitInput(value: string): boolean {
  return /^\d+$/.test(value);
}

export function NodeCropSliderRow({
  label,
  value,
  min = 0,
  max = 100,
  defaultValue,
  onChange,
  className,
  dense = false,
}: NodeCropSliderRowProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;
  const displayValue = isEditing ? draft : String(value);

  const commitDraft = (raw: string) => {
    if (raw.trim() === "") {
      onChange(min);
      return;
    }

    const parsed = Number(raw);
    onChange(clamp(Number.isFinite(parsed) ? parsed : min, min, max));
  };

  return (
    <div
      className={cn(
        "workflow-node-crop-row nodrag nopan nowheel relative",
        dense && "workflow-node-crop-row-dense",
        className,
      )}
    >
      <div className="workflow-node-crop-handle-slot">
        <NodeDecorativeHandle color="purple" />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex items-center justify-between gap-1",
            dense ? "mb-0" : "mb-1",
          )}
        >
          <span className="workflow-node-field-label">{label}</span>
          <button
            type="button"
            className={cn(
              "workflow-node-add-connection-btn",
              dense && "workflow-node-add-connection-btn-dense",
            )}
            aria-label={`Add connection for ${label}`}
            title="Add connection"
            onPointerDown={stopNodePointer}
            onMouseDown={stopNodePointer}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className={cn("flex items-center", dense ? "gap-1" : "gap-2")}>
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(event) => {
              setDraft(null);
              onChange(clamp(Number(event.target.value), min, max));
            }}
            onPointerDown={stopNodePointer}
            className="workflow-node-crop-slider min-w-0 flex-1"
          />
          <input
            type="text"
            inputMode="numeric"
            aria-label={label}
            value={displayValue}
            onFocus={() => setDraft(String(value))}
            onChange={(event) => {
              const raw = event.target.value;

              if (raw === "") {
                setDraft("");
                return;
              }

              if (!isDigitInput(raw)) {
                return;
              }

              setDraft(raw);

              const parsed = Number(raw);

              if (parsed >= min && parsed <= max) {
                onChange(parsed);
              }
            }}
            onBlur={() => {
              if (draft !== null) {
                commitDraft(draft);
              }

              setDraft(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            onPointerDown={stopNodePointer}
            className={cn(
              "workflow-node-crop-number",
              dense && "workflow-node-crop-number-dense",
            )}
          />
          <button
            type="button"
            className={cn(
              "workflow-node-header-icon",
              dense ? "!h-6 !w-6" : "!h-7 !w-7",
            )}
            aria-label={`Reset ${label}`}
            title="Reset"
            onClick={(event) => {
              stopNodePointer(event);
              setDraft(null);
              onChange(defaultValue);
            }}
            onPointerDown={stopNodePointer}
            onMouseDown={stopNodePointer}
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
