"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  Crop,
  Image as ImageIcon,
  LayoutGrid,
  Music,
  Plus,
  Search,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  NODE_PICKER_CATALOG,
  filterPickerCatalog,
  findSubcategoryByKey,
  getDefaultSubcategoryKey,
  getFirstSubcategoryKey,
  type PickerOption,
  type PickerSubcategoryKey,
} from "@/lib/workflow/node-picker-catalog";
import type { AddableWorkflowNodeType } from "@/types/workflow-canvas";

const DEMO_TOAST_MESSAGE = "This node is shown for UI parity only.";

const ADDABLE_ICONS = {
  cropImage: Crop,
  geminiPro: Sparkles,
} as const;

const CATEGORY_ICONS: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  others: LayoutGrid,
};

const pickerStyles = {
  portalRoot: {
    position: "fixed" as const,
    left: "50%",
    bottom: "88px",
    transform: "translateX(-50%)",
    zIndex: 9999,
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    pointerEvents: "auto" as const,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  mainPanel: {
    width: "312px",
    maxHeight: "480px",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderRadius: "10px 0 0 10px",
    border: "1px solid rgba(15, 15, 20, 0.09)",
    borderRight: "none",
    boxShadow:
      "0 2px 4px rgba(15, 15, 20, 0.04), 0 12px 32px rgba(15, 15, 20, 0.1)",
  },
  searchBar: {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    height: "44px",
    paddingLeft: "10px",
    paddingRight: "6px",
    borderBottom: "1px solid #ececef",
    flexShrink: 0,
    gap: "6px",
  },
  searchInputWrap: {
    display: "flex",
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
  },
  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: "12px",
    lineHeight: "18px",
    color: "#111118",
  },
  closeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "#6b7280",
    cursor: "pointer",
    flexShrink: 0,
  },
  navScroll: {
    display: "flex",
    flexDirection: "column" as const,
    overflowY: "auto" as const,
    padding: "2px 4px 6px",
    flex: 1,
    minHeight: 0,
  },
  categoryHeading: {
    margin: 0,
    padding: "6px 8px 2px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    color: "#9ca3af",
  },
  subcategoryRow: (active: boolean) => ({
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    gap: "8px",
    width: "100%",
    height: "34px",
    paddingLeft: "8px",
    paddingRight: "6px",
    border: "none",
    borderRadius: "6px",
    background: active ? "#eef2ff" : "transparent",
    color: active ? "#1d4ed8" : "#374151",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left" as const,
  }),
  subcategoryIconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    flexShrink: 0,
    color: "#6b7280",
  },
  subcategoryLabel: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  submenuPanel: {
    width: "272px",
    height: "auto" as const,
    maxHeight: "500px",
    display: "flex",
    flexDirection: "column" as const,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderRadius: "0 10px 10px 0",
    border: "1px solid rgba(15, 15, 20, 0.09)",
    boxShadow:
      "0 2px 4px rgba(15, 15, 20, 0.04), 0 12px 32px rgba(15, 15, 20, 0.1)",
    alignSelf: "flex-start" as const,
  },
  submenuHeader: {
    margin: 0,
    padding: "10px 12px 8px",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: "16px",
    color: "#111118",
    borderBottom: "1px solid #ececef",
    flexShrink: 0,
  },
  submenuScroll: {
    overflowY: "auto" as const,
    maxHeight: "452px",
    padding: "4px 6px 8px",
  },
  optionList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  optionButton: (isAddable: boolean) => ({
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    gap: "7px",
    width: "100%",
    minHeight: "36px",
    padding: "5px 7px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: isAddable ? "#111118" : "#6b7280",
    fontSize: "12.5px",
    lineHeight: "16px",
    cursor: "pointer",
    textAlign: "left" as const,
  }),
  optionIconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: "5px",
    background: "#eef2ff",
    color: "#4f46e5",
    flexShrink: 0,
  },
  optionLabel: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  emptyText: {
    margin: 0,
    padding: "12px 8px",
    fontSize: "13px",
    color: "#6b7280",
  },
  triggerWrap: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    borderRadius: "9999px",
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    padding: "4px",
    boxShadow: "0 1px 3px rgba(15, 15, 20, 0.08)",
  },
};

type NodePickerProps = {
  onSelectType: (type: AddableWorkflowNodeType) => void;
  onDemoSelect?: (message: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

function CategoryIcon({ categoryId }: { categoryId: string }) {
  const Icon = CATEGORY_ICONS[categoryId] ?? LayoutGrid;

  return (
    <span style={pickerStyles.subcategoryIconWrap}>
      <Icon size={13} strokeWidth={2} />
    </span>
  );
}

type PickerOptionRowProps = {
  option: PickerOption;
  onSelect: (event: React.MouseEvent, option: PickerOption) => void;
};

function PickerOptionRow({ option, onSelect }: PickerOptionRowProps) {
  const addableType =
    option.action.kind === "addable" ? option.action.type : null;
  const Icon = addableType ? ADDABLE_ICONS[addableType] : null;
  const isAddable = addableType !== null;

  return (
    <li>
      <button
        type="button"
        style={pickerStyles.optionButton(isAddable)}
        onClick={(event) => onSelect(event, option)}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = "#f3f4f6";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = "transparent";
        }}
      >
        {Icon ? (
          <span style={pickerStyles.optionIconWrap}>
            <Icon size={13} strokeWidth={2} />
          </span>
        ) : null}
        <span style={pickerStyles.optionLabel}>{option.label}</span>
      </button>
    </li>
  );
}

export function NodePicker({
  onSelectType,
  onDemoSelect,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: NodePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const open = controlledOpen ?? internalOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) {
        onOpenChange(next);
        return;
      }

      setInternalOpen(next);
    },
    [onOpenChange],
  );

  const [query, setQuery] = useState("");
  const [activeSubcategoryKey, setActiveSubcategoryKey] =
    useState<PickerSubcategoryKey>(getDefaultSubcategoryKey());

  useEffect(() => {
    setMounted(true);
  }, []);

  const { categories } = useMemo(
    () => filterPickerCatalog(NODE_PICKER_CATALOG, query),
    [query],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const match = findSubcategoryByKey(categories, activeSubcategoryKey);

    if (match) {
      return;
    }

    const fallback = getFirstSubcategoryKey(categories);

    if (fallback) {
      setActiveSubcategoryKey(fallback);
    }
  }, [activeSubcategoryKey, categories, open]);

  const activeSubcategory = useMemo(
    () => findSubcategoryByKey(categories, activeSubcategoryKey),
    [activeSubcategoryKey, categories],
  );

  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveSubcategoryKey(getDefaultSubcategoryKey());
  }, [setOpen]);

  const handleOptionSelect = useCallback(
    (event: React.MouseEvent, option: PickerOption) => {
      event.preventDefault();
      event.stopPropagation();

      if (option.action.kind === "addable") {
        onSelectType(option.action.type);
        closePicker();
        return;
      }

      onDemoSelect?.(DEMO_TOAST_MESSAGE);
    },
    [closePicker, onDemoSelect, onSelectType],
  );

  const handleToggle = () => {
    setOpen(!open);
  };

  const pickerPortal =
    open && mounted
      ? createPortal(
          <div
            style={pickerStyles.portalRoot}
            className="nodrag nopan nowheel"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div style={pickerStyles.mainPanel}>
              <div style={pickerStyles.searchBar}>
                <div style={pickerStyles.searchInputWrap}>
                  <Search size={14} strokeWidth={2} color="#9ca3af" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search nodes or models..."
                    style={pickerStyles.searchInput}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  style={pickerStyles.closeButton}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    closePicker();
                  }}
                  aria-label="Close node picker"
                  onMouseEnter={(event) => {
                    event.currentTarget.style.background = "#f3f4f6";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = "transparent";
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              <div style={pickerStyles.navScroll}>
                {categories.length === 0 ? (
                  <p style={pickerStyles.emptyText}>No matching nodes</p>
                ) : (
                  categories.map((category) => (
                    <section key={category.id}>
                      <h2 style={pickerStyles.categoryHeading}>
                        {category.label}
                      </h2>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {category.subcategories.map((subcategory) => {
                          const rowKey = `${category.id}:${subcategory.id}` as PickerSubcategoryKey;
                          const isActive = activeSubcategoryKey === rowKey;

                          return (
                            <button
                              key={subcategory.id}
                              type="button"
                              style={pickerStyles.subcategoryRow(isActive)}
                              onMouseEnter={() => setActiveSubcategoryKey(rowKey)}
                              onFocus={() => setActiveSubcategoryKey(rowKey)}
                              onClick={() => setActiveSubcategoryKey(rowKey)}
                            >
                              <CategoryIcon categoryId={category.id} />
                              <span style={pickerStyles.subcategoryLabel}>
                                {subcategory.label}
                              </span>
                              <ChevronRight
                                size={13}
                                strokeWidth={2}
                                color="#9ca3af"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>
            </div>

            {activeSubcategory ? (
              <div style={pickerStyles.submenuPanel}>
                <h3 style={pickerStyles.submenuHeader}>
                  {activeSubcategory.subcategory.label}
                </h3>
                <div style={pickerStyles.submenuScroll}>
                  {activeSubcategory.subcategory.options.length === 0 ? (
                    <p style={pickerStyles.emptyText}>No matching nodes</p>
                  ) : (
                    <ul style={pickerStyles.optionList}>
                      {activeSubcategory.subcategory.options.map((option) => (
                        <PickerOptionRow
                          key={option.id}
                          option={option}
                          onSelect={handleOptionSelect}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div style={{ pointerEvents: "auto" }}>
      {pickerPortal}
      {showTrigger ? (
        <div style={pickerStyles.triggerWrap}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 rounded-full p-0 text-muted hover:text-foreground"
            onClick={handleToggle}
            aria-label="Add workflow node"
          >
            <Plus
              size={20}
              strokeWidth={2}
              style={{
                transform: open ? "rotate(45deg)" : "none",
                transition: "transform 0.15s ease",
              }}
            />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
