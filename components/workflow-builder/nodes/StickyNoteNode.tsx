"use client";

import { memo, useCallback, useState } from "react";
import { NodeResizer, NodeToolbar, Position, type NodeProps } from "reactflow";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils/cn";
import {
  STICKY_NOTE_COLORS,
  getStickyNoteFontStack,
} from "@/lib/workflow/sticky-note-theme";
import type { StickyNoteNodeData } from "@/lib/workflow/sticky-notes-storage";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { StickyNoteToolbar } from "./StickyNoteToolbar";

function StickyNoteNodeComponent({
  id,
  data,
  selected,
}: NodeProps<StickyNoteNodeData>) {
  const { updateStickyNote, deleteStickyNote } = useWorkflowBuilder();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const theme = STICKY_NOTE_COLORS[data.colorId];

  const handleUpdate = useCallback(
    (updater: (current: StickyNoteNodeData) => StickyNoteNodeData) => {
      updateStickyNote(id, updater);
    },
    [id, updateStickyNote],
  );

  const handleConfirmDelete = useCallback(() => {
    setConfirmDeleteOpen(false);
    deleteStickyNote(id);
  }, [deleteStickyNote, id]);

  return (
    <div className="workflow-sticky-note-shell relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={110}
        handleClassName="workflow-sticky-note-resize-handle"
        lineClassName="workflow-sticky-note-resize-line"
      />

      <div
        className={cn(
          "workflow-sticky-note h-full w-full rounded-xl border p-3 shadow-card",
          selected && "ring-2 ring-black/10",
        )}
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.border,
        }}
      >
        <textarea
          value={data.text}
          onChange={(event) =>
            handleUpdate((current) => ({ ...current, text: event.target.value }))
          }
          placeholder="Type a note..."
          className="nodrag nopan nowheel h-full w-full resize-none border-0 bg-transparent leading-snug placeholder:opacity-60 focus:outline-none"
          style={{
            color: theme.text,
            fontSize: data.fontSize,
            fontFamily: getStickyNoteFontStack(data.fontFamily),
            fontWeight: data.bold ? 700 : 400,
            textTransform:
              data.textCase === "normal" ? "none" : data.textCase,
          }}
          onPointerDown={(event) => event.stopPropagation()}
        />
      </div>

      <NodeToolbar
        isVisible={selected}
        position={Position.Right}
        align="start"
        offset={12}
        className="workflow-sticky-note-node-toolbar nodrag nopan nowheel"
      >
        <StickyNoteToolbar
          data={data}
          onUpdate={handleUpdate}
          onDelete={() => setConfirmDeleteOpen(true)}
        />
      </NodeToolbar>

      <Dialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete sticky note?"
        description="This note will be removed from the canvas. This action cannot be undone."
      >
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => setConfirmDeleteOpen(false)}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export const StickyNoteNode = memo(StickyNoteNodeComponent);
