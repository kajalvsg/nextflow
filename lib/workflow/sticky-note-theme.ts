export const STICKY_NOTE_COLORS = {
  yellow: {
    bg: "#fef9c3",
    border: "#e8d89a",
    text: "#713f12",
    placeholder: "#a16207",
    swatch: "#fef08a",
  },
  green: {
    bg: "#dcfce7",
    border: "#86efac",
    text: "#14532d",
    placeholder: "#166534",
    swatch: "#bbf7d0",
  },
  pink: {
    bg: "#fce7f3",
    border: "#f9a8d4",
    text: "#831843",
    placeholder: "#9d174d",
    swatch: "#fbcfe8",
  },
  orange: {
    bg: "#ffedd5",
    border: "#fdba74",
    text: "#7c2d12",
    placeholder: "#9a3412",
    swatch: "#fed7aa",
  },
  blue: {
    bg: "#dbeafe",
    border: "#93c5fd",
    text: "#1e3a8a",
    placeholder: "#1d4ed8",
    swatch: "#bfdbfe",
  },
} as const;

export type StickyNoteColorId = keyof typeof STICKY_NOTE_COLORS;

export const STICKY_NOTE_COLOR_IDS = Object.keys(
  STICKY_NOTE_COLORS,
) as StickyNoteColorId[];

export type StickyNoteTextCase =
  | "normal"
  | "uppercase"
  | "lowercase"
  | "capitalize";

export const STICKY_NOTE_FONT_FAMILIES = {
  sans: {
    label: "Sans serif",
    stack:
      'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  serif: {
    label: "Serif",
    stack: 'ui-serif, Georgia, "Times New Roman", Times, serif',
  },
  cursive: {
    label: "Cursive",
    stack:
      '"Segoe Script", "Bradley Hand", "Brush Script MT", "Snell Roundhand", cursive',
  },
  mono: {
    label: "Monospace",
    stack: 'ui-monospace, "Courier New", Courier, monospace',
  },
} as const;

export type StickyNoteFontFamilyId = keyof typeof STICKY_NOTE_FONT_FAMILIES;

export const STICKY_NOTE_FONT_FAMILY_IDS = Object.keys(
  STICKY_NOTE_FONT_FAMILIES,
) as StickyNoteFontFamilyId[];

export const STICKY_NOTE_MIN_FONT_SIZE = 12;
export const STICKY_NOTE_MAX_FONT_SIZE = 36;
export const STICKY_NOTE_DEFAULT_FONT_SIZE = 18;
export const STICKY_NOTE_DEFAULT_WIDTH = 220;
export const STICKY_NOTE_DEFAULT_HEIGHT = 150;

export function clampStickyNoteFontSize(size: number): number {
  return Math.min(
    STICKY_NOTE_MAX_FONT_SIZE,
    Math.max(STICKY_NOTE_MIN_FONT_SIZE, Math.round(size)),
  );
}

export function cycleStickyNoteTextCase(
  current: StickyNoteTextCase,
): StickyNoteTextCase {
  switch (current) {
    case "normal":
      return "uppercase";
    case "uppercase":
      return "lowercase";
    case "lowercase":
      return "capitalize";
    default:
      return "normal";
  }
}

export function isStickyNoteColorId(value: unknown): value is StickyNoteColorId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STICKY_NOTE_COLORS, value)
  );
}

export function isStickyNoteTextCase(value: unknown): value is StickyNoteTextCase {
  return (
    value === "normal" ||
    value === "uppercase" ||
    value === "lowercase" ||
    value === "capitalize"
  );
}

export function isStickyNoteFontFamilyId(
  value: unknown,
): value is StickyNoteFontFamilyId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STICKY_NOTE_FONT_FAMILIES, value)
  );
}

export function getStickyNoteFontStack(fontFamilyId: StickyNoteFontFamilyId): string {
  return STICKY_NOTE_FONT_FAMILIES[fontFamilyId].stack;
}
