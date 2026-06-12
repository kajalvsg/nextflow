import type { Node } from "reactflow";
import {
  STICKY_NOTE_DEFAULT_FONT_SIZE,
  STICKY_NOTE_DEFAULT_HEIGHT,
  STICKY_NOTE_DEFAULT_WIDTH,
  clampStickyNoteFontSize,
  isStickyNoteColorId,
  isStickyNoteFontFamilyId,
  isStickyNoteTextCase,
  type StickyNoteColorId,
  type StickyNoteFontFamilyId,
  type StickyNoteTextCase,
} from "@/lib/workflow/sticky-note-theme";

// Sticky notes are UI-only annotations stored in sessionStorage for the current
// browser session. They are intentionally excluded from workflow save payloads.

export type StickyNoteNodeData = {
  text: string;
  colorId: StickyNoteColorId;
  fontSize: number;
  bold: boolean;
  textCase: StickyNoteTextCase;
  fontFamily: StickyNoteFontFamilyId;
};

export type StickyNoteNode = Node<StickyNoteNodeData>;

export const STICKY_NOTE_NODE_TYPE = "stickyNote";
export const STICKY_NOTE_ID_PREFIX = "sticky-note-";

export function createDefaultStickyNoteData(): StickyNoteNodeData {
  return {
    text: "",
    colorId: "yellow",
    fontSize: STICKY_NOTE_DEFAULT_FONT_SIZE,
    bold: false,
    textCase: "normal",
    fontFamily: "sans",
  };
}

export function normalizeStickyNoteData(
  data: Partial<StickyNoteNodeData> | undefined,
): StickyNoteNodeData {
  const defaults = createDefaultStickyNoteData();

  return {
    text: typeof data?.text === "string" ? data.text : defaults.text,
    colorId: isStickyNoteColorId(data?.colorId) ? data.colorId : defaults.colorId,
    fontSize: clampStickyNoteFontSize(
      typeof data?.fontSize === "number" ? data.fontSize : defaults.fontSize,
    ),
    bold: typeof data?.bold === "boolean" ? data.bold : defaults.bold,
    textCase: isStickyNoteTextCase(data?.textCase)
      ? data.textCase
      : defaults.textCase,
    fontFamily: isStickyNoteFontFamilyId(data?.fontFamily)
      ? data.fontFamily
      : defaults.fontFamily,
  };
}

export function normalizeStickyNote(node: StickyNoteNode): StickyNoteNode {
  const width =
    typeof node.width === "number"
      ? node.width
      : typeof node.style?.width === "number"
        ? node.style.width
        : STICKY_NOTE_DEFAULT_WIDTH;
  const height =
    typeof node.height === "number"
      ? node.height
      : typeof node.style?.height === "number"
        ? node.style.height
        : STICKY_NOTE_DEFAULT_HEIGHT;

  return {
    ...node,
    type: STICKY_NOTE_NODE_TYPE,
    data: normalizeStickyNoteData(node.data),
    width,
    height,
    style: {
      ...node.style,
      width,
      height,
    },
    draggable: true,
    selectable: true,
    deletable: false,
  };
}

export function isStickyNoteNodeId(id: string): boolean {
  return id.startsWith(STICKY_NOTE_ID_PREFIX);
}

function storageKey(workflowId: string): string {
  return `nextflow-sticky-notes:${workflowId}`;
}

export function loadStickyNotes(workflowId: string): StickyNoteNode[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(workflowId));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as StickyNoteNode[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (node) =>
          typeof node.id === "string" &&
          isStickyNoteNodeId(node.id) &&
          typeof node.position?.x === "number" &&
          typeof node.position?.y === "number",
      )
      .map((node) => normalizeStickyNote(node));
  } catch {
    return [];
  }
}

export function saveStickyNotes(
  workflowId: string,
  notes: StickyNoteNode[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(storageKey(workflowId), JSON.stringify(notes));
  } catch {
    // Ignore quota / private mode errors — notes remain in memory for this session.
  }
}

export function createStickyNoteNode(position: {
  x: number;
  y: number;
}): StickyNoteNode {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `${STICKY_NOTE_ID_PREFIX}${crypto.randomUUID()}`
      : `${STICKY_NOTE_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return normalizeStickyNote({
    id,
    type: STICKY_NOTE_NODE_TYPE,
    position,
    data: createDefaultStickyNoteData(),
    width: STICKY_NOTE_DEFAULT_WIDTH,
    height: STICKY_NOTE_DEFAULT_HEIGHT,
    style: {
      width: STICKY_NOTE_DEFAULT_WIDTH,
      height: STICKY_NOTE_DEFAULT_HEIGHT,
    },
    draggable: true,
    selectable: true,
    deletable: false,
  });
}
