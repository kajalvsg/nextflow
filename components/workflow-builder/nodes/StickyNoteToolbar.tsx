"use client";

import { Bold, CaseSensitive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  STICKY_NOTE_COLOR_IDS,
  STICKY_NOTE_COLORS,
  STICKY_NOTE_FONT_FAMILIES,
  STICKY_NOTE_FONT_FAMILY_IDS,
  STICKY_NOTE_MAX_FONT_SIZE,
  STICKY_NOTE_MIN_FONT_SIZE,
  cycleStickyNoteTextCase,
  type StickyNoteFontFamilyId,
} from "@/lib/workflow/sticky-note-theme";
import type { StickyNoteNodeData } from "@/lib/workflow/sticky-notes-storage";

type StickyNoteToolbarProps = {
  data: StickyNoteNodeData;
  onUpdate: (updater: (data: StickyNoteNodeData) => StickyNoteNodeData) => void;
  onDelete: () => void;
};

function stopPointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      onPointerDown={stopPointer}
      className={cn(
        "workflow-sticky-note-toolbar-btn",
        active && "workflow-sticky-note-toolbar-btn-active",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StickyNoteToolbar({
  data,
  onUpdate,
  onDelete,
}: StickyNoteToolbarProps) {
  return (
    <div
      className="workflow-sticky-note-toolbar nodrag nopan nowheel"
      onPointerDown={stopPointer}
    >
      <div className="workflow-sticky-note-toolbar-colors">
        {STICKY_NOTE_COLOR_IDS.map((colorId) => (
          <button
            key={colorId}
            type="button"
            title={`${colorId} note`}
            aria-label={`${colorId} note color`}
            onClick={() =>
              onUpdate((current) => ({ ...current, colorId }))
            }
            onPointerDown={stopPointer}
            className={cn(
              "workflow-sticky-note-color-swatch",
              data.colorId === colorId &&
                "workflow-sticky-note-color-swatch-active",
            )}
            style={{ backgroundColor: STICKY_NOTE_COLORS[colorId].swatch }}
          />
        ))}
      </div>

      <div className="workflow-sticky-note-toolbar-divider" />

      <ToolbarButton
        label="Bold"
        active={data.bold}
        onClick={() =>
          onUpdate((current) => ({ ...current, bold: !current.bold }))
        }
      >
        <Bold className="h-3.5 w-3.5" strokeWidth={2.5} />
      </ToolbarButton>

      <ToolbarButton
        label="Increase font size"
        onClick={() =>
          onUpdate((current) => ({
            ...current,
            fontSize: Math.min(
              STICKY_NOTE_MAX_FONT_SIZE,
              current.fontSize + 2,
            ),
          }))
        }
      >
        <span className="workflow-sticky-note-toolbar-glyph">A+</span>
      </ToolbarButton>

      <div className="workflow-sticky-note-font-size">{data.fontSize}</div>

      <ToolbarButton
        label="Decrease font size"
        onClick={() =>
          onUpdate((current) => ({
            ...current,
            fontSize: Math.max(
              STICKY_NOTE_MIN_FONT_SIZE,
              current.fontSize - 2,
            ),
          }))
        }
      >
        <span className="workflow-sticky-note-toolbar-glyph">A−</span>
      </ToolbarButton>

      <ToolbarButton
        label="Toggle text case"
        active={data.textCase !== "normal"}
        onClick={() =>
          onUpdate((current) => ({
            ...current,
            textCase: cycleStickyNoteTextCase(current.textCase),
          }))
        }
      >
        <CaseSensitive className="h-3.5 w-3.5" strokeWidth={2.5} />
      </ToolbarButton>

      {STICKY_NOTE_FONT_FAMILY_IDS.map((fontFamilyId) => (
        <button
          key={fontFamilyId}
          type="button"
          title={STICKY_NOTE_FONT_FAMILIES[fontFamilyId].label}
          aria-label={STICKY_NOTE_FONT_FAMILIES[fontFamilyId].label}
          onClick={() =>
            onUpdate((current) => ({
              ...current,
              fontFamily: fontFamilyId as StickyNoteFontFamilyId,
            }))
          }
          onPointerDown={stopPointer}
          className={cn(
            "workflow-sticky-note-font-family-btn",
            data.fontFamily === fontFamilyId &&
              "workflow-sticky-note-font-family-btn-active",
          )}
        >
          <span
            className="workflow-sticky-note-font-family-preview"
            style={{
              fontFamily: STICKY_NOTE_FONT_FAMILIES[fontFamilyId].stack,
            }}
          >
            Aa
          </span>
        </button>
      ))}

      <div className="workflow-sticky-note-toolbar-divider" />

      <ToolbarButton label="Delete sticky note" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={2.5} />
      </ToolbarButton>
    </div>
  );
}
