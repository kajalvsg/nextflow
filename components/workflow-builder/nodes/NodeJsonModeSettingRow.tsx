"use client";

import { Info, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type NodeJsonModeSettingRowProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  onAddConnection?: () => void;
  connected?: boolean;
};

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function NodeJsonModeSettingRow({
  value,
  onChange,
  onAddConnection,
  connected = false,
}: NodeJsonModeSettingRowProps) {
  return (
    <div
      className={cn(
        "nodrag nopan nowheel flex h-8 min-h-8 w-full flex-nowrap items-center justify-between gap-2 whitespace-nowrap",
      )}
    >
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-[12px] font-medium leading-[1.35] text-[#71717a]">
          JSON Mode
        </span>
        <button
          type="button"
          className="workflow-node-field-info inline-flex shrink-0 items-center"
          aria-label="JSON Mode information"
          onMouseDown={stopNodePointer}
          onPointerDown={stopNodePointer}
        >
          <Info className="h-3 w-3" />
        </button>
      </div>

      <div className="flex shrink-0 flex-nowrap items-center gap-2 whitespace-nowrap">
        <span
          className={cn(
            "shrink-0 text-[12px] leading-[1.35] text-[#a1a1aa]",
            !value && "font-medium text-[#52525b]",
          )}
        >
          False
        </span>

        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label="JSON Mode"
          className={cn(
            "workflow-node-bool-toggle shrink-0",
            value && "workflow-node-bool-toggle-on",
          )}
          onClick={(event) => {
            stopNodePointer(event);
            onChange(!value);
          }}
          onMouseDown={stopNodePointer}
          onPointerDown={stopNodePointer}
        >
          <span className="workflow-node-bool-toggle-thumb" />
        </button>

        <span
          className={cn(
            "shrink-0 text-[12px] leading-[1.35] text-[#a1a1aa]",
            value && "font-medium text-[#52525b]",
          )}
        >
          True
        </span>

        <button
          type="button"
          className="workflow-node-add-connection-btn workflow-node-add-connection-btn-dense shrink-0"
          aria-label="JSON Mode connection"
          title="Add connection"
          disabled={connected}
          onClick={(event) => {
            stopNodePointer(event);
            onAddConnection?.();
          }}
          onMouseDown={stopNodePointer}
          onPointerDown={stopNodePointer}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
