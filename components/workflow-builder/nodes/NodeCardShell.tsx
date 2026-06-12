"use client";

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Copy,
  Link2,
  Loader2,
  Lock,
  MoreHorizontal,
  Play,
  RefreshCw,
  Trash2,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NodeRuntimeStatus } from "@/types/workflow-execution";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";

type NodeCardShellProps = {
  nodeId: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  selected?: boolean;
  locked?: boolean;
  executionStatus?: NodeRuntimeStatus;
  showRunButton?: boolean;
  showRefreshButton?: boolean;
  headerVariant?: "default" | "model";
  className?: string;
  handles?: React.ReactNode;
  leftGutter?: boolean;
  rightGutter?: boolean;
  children: React.ReactNode;
};

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

const MENU_ITEMS = [
  { id: "duplicate", label: "Duplicate", icon: Copy },
  { id: "duplicate-edges", label: "Duplicate with Edges", icon: Link2 },
  { id: "lock", label: "Lock", icon: Lock },
  { id: "delete", label: "Delete", icon: Trash2 },
] as const;

export function NodeCardShell({
  nodeId,
  title,
  subtitle,
  icon: Icon,
  selected,
  locked = false,
  executionStatus = "idle",
  showRunButton = true,
  showRefreshButton = true,
  headerVariant = "default",
  className,
  handles,
  leftGutter = false,
  rightGutter = false,
  children,
}: NodeCardShellProps) {
  const {
    runNode,
    isWorkflowRunning,
    refreshNode,
    duplicateNode,
    duplicateNodeWithEdges,
    toggleNodeLock,
    deleteNode,
  } = useWorkflowBuilder();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isRunning = executionStatus === "running" || isWorkflowRunning;

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  const handleMenuAction = (actionId: (typeof MENU_ITEMS)[number]["id"]) => {
    setMenuOpen(false);

    switch (actionId) {
      case "duplicate":
        duplicateNode(nodeId);
        break;
      case "duplicate-edges":
        duplicateNodeWithEdges(nodeId);
        break;
      case "lock":
        toggleNodeLock(nodeId);
        break;
      case "delete":
        deleteNode(nodeId);
        break;
    }
  };

  return (
    <div
      className={cn(
        "workflow-node-card relative overflow-visible rounded-xl border-2 bg-surface shadow-card transition-[border-color,box-shadow] duration-150",
        selected || executionStatus !== "idle"
          ? "workflow-node-card-active"
          : "border-border",
        executionStatus === "running" && "workflow-node-running",
        executionStatus === "success" && "workflow-node-success",
        executionStatus === "failed" && "workflow-node-failed",
        locked && "workflow-node-card-locked",
        className,
      )}
    >
      {handles}

      <div className="flex items-center gap-1.5 border-b border-border-soft px-3 py-2.5">
        {headerVariant === "default" && Icon ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted">
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight text-foreground">
            {title}
          </p>
          {headerVariant === "default" && subtitle ? (
            <p className="truncate text-[10px] font-normal leading-tight text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        {showRefreshButton ? (
          <button
            type="button"
            className="workflow-node-header-icon"
            aria-label="Refresh node"
            title="Refresh"
            onClick={(event) => {
              stopNodePointer(event);
              refreshNode(nodeId);
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {showRunButton ? (
          <button
            type="button"
            disabled={isRunning || locked}
            onClick={(event) => {
              stopNodePointer(event);
              runNode(nodeId);
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
            className="workflow-node-run-btn"
            aria-label={`Run ${title}`}
          >
            {executionStatus === "running" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Play className="h-3 w-3 fill-current" />
                Run
              </>
            )}
          </button>
        ) : null}

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            className="workflow-node-header-icon"
            aria-label="Node menu"
            onClick={(event) => {
              stopNodePointer(event);
              setMenuOpen((current) => !current);
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-elevated">
              {MENU_ITEMS.map((item) => {
                const MenuIcon = item.icon;
                const label =
                  item.id === "lock"
                    ? locked
                      ? "Unlock"
                      : "Lock"
                    : item.label;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-surface-hover"
                    onClick={(event) => {
                      stopNodePointer(event);
                      handleMenuAction(item.id);
                    }}
                    onMouseDown={stopNodePointer}
                    onPointerDown={stopNodePointer}
                  >
                    {item.id === "lock" && locked ? (
                      <Unlock className="h-3.5 w-3.5 text-muted" />
                    ) : (
                      <MenuIcon
                        className={cn(
                          "h-3.5 w-3.5",
                          item.id === "delete" ? "text-red-500" : "text-muted",
                        )}
                      />
                    )}
                    <span
                      className={item.id === "delete" ? "text-red-500" : undefined}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "workflow-node-body stack-sm overflow-visible px-3 py-3",
        )}
      >
        {children}
      </div>
    </div>
  );
}
