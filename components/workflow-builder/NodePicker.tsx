"use client";

import { useCallback, useMemo, useState } from "react";
import { Crop, Plus, Search, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NODE_PICKER_ITEMS } from "@/lib/workflow/node-registry";
import type { AddableWorkflowNodeType } from "@/types/workflow-canvas";
import { cn } from "@/lib/utils/cn";

const PICKER_ICONS = {
  cropImage: Crop,
  geminiPro: Sparkles,
} as const;

type NodePickerProps = {
  onSelectType: (type: AddableWorkflowNodeType) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export function NodePicker({
  onSelectType,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: NodePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
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

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return NODE_PICKER_ITEMS;
    }

    return NODE_PICKER_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.description.toLowerCase().includes(normalized) ||
        item.keywords.some((keyword) => keyword.includes(normalized)),
    );
  }, [query]);

  const handleSelect = (
    event: React.MouseEvent,
    type: AddableWorkflowNodeType,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    onSelectType(type);
    setOpen(false);
    setQuery("");
  };

  const handleToggle = () => {
    setOpen(!open);
  };

  return (
    <div className="nodrag nopan nowheel pointer-events-auto flex flex-col items-center gap-3">
      {open ? (
        <div className="w-[min(92vw,400px)] rounded-xl border border-border bg-surface shadow-elevated">
          <div className="flex items-center justify-between border-b border-border-soft px-4 py-3">
            <div>
              <p className="text-body-sm font-semibold text-foreground">Add node</p>
              <p className="text-caption text-muted">
                Crop Image or Gemini 3.1 Pro
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setQuery("");
              }}
              className="rounded-button p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label="Close node picker"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-border-soft px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search nodes..."
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto p-2">
            {items.length === 0 ? (
              <li className="px-3 py-6 text-center text-body-sm text-muted">
                No matching nodes
              </li>
            ) : (
              items.map((item) => {
                const Icon = PICKER_ICONS[item.type];

                return (
                  <li key={item.type}>
                    <button
                      type="button"
                      onClick={(event) => handleSelect(event, item.type)}
                      className="flex w-full items-start gap-3 rounded-button px-3 py-3 text-left transition-colors hover:bg-surface-muted"
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-accent-soft text-accent">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-body-sm font-medium text-foreground">
                          {item.label}
                        </p>
                        <p className="text-caption text-muted">{item.description}</p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}

      {showTrigger ? (
        <div className="flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-card">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 w-9 rounded-full p-0 text-muted hover:text-foreground"
            onClick={handleToggle}
            aria-label="Add workflow node"
          >
            <Plus className={cn("h-5 w-5 transition-transform", open && "rotate-45")} />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
