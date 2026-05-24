"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { type NodeProps } from "reactflow";
import { Input } from "@/components/ui/Input";
import type { GeminiProConfig, WorkflowNodeData } from "@/types/workflow-canvas";
import { cn } from "@/lib/utils/cn";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";

export function GeminiProNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const { updateNodeData } = useWorkflowBuilder();
  const config = data.config as GeminiProConfig;

  const updateConfig = (patch: Partial<GeminiProConfig>) => {
    updateNodeData(id, (current) => ({
      ...current,
      config: { ...(current.config as GeminiProConfig), ...patch },
    }));
  };

  return (
    <div className="relative">
      <NodeHandle id="prompt" type="target" top="22%" />
      <NodeHandle id="system_prompt" type="target" top="42%" />
      <NodeHandle id="image_vision" type="target" top="62%" />
      <NodeHandle id="response" type="source" top="82%" />

      <NodeCardShell
        title={data.label}
        subtitle="AI Model"
        icon={Sparkles}
        selected={selected}
      >
        <p className="text-body-sm text-muted">
          Connect prompt, system prompt, and optional vision image inputs.
        </p>

        <div className="nodrag nopan nowheel border-t border-border-soft pt-3">
          <button
            type="button"
            onClick={() => updateConfig({ settingsOpen: !config.settingsOpen })}
            className="flex w-full items-center justify-between rounded-button px-1 py-1 text-left text-label text-foreground hover:bg-surface-muted"
          >
            Settings
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted transition-transform",
                config.settingsOpen && "rotate-180",
              )}
            />
          </button>

          {config.settingsOpen ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Input
                label="Temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                onChange={(event) =>
                  updateConfig({ temperature: Number(event.target.value) })
                }
              />
              <Input
                label="Max Output Tokens"
                type="number"
                min={256}
                max={65536}
                step={256}
                value={config.maxOutputTokens}
                onChange={(event) =>
                  updateConfig({ maxOutputTokens: Number(event.target.value) })
                }
              />
            </div>
          ) : null}
        </div>
      </NodeCardShell>
    </div>
  );
}
