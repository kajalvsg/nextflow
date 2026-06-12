"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { type NodeProps } from "reactflow";
import { Input } from "@/components/ui/Input";
import type { GeminiProConfig, WorkflowNodeData } from "@/types/workflow-canvas";
import { cn } from "@/lib/utils/cn";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";
import { NodeInlineOutputSection } from "./NodeInlineOutputSection";

export function GeminiProNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const { updateNodeData, getNodeExecutionStatus, getNodeInlineExecution } =
    useWorkflowBuilder();
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
        nodeId={id}
        title={data.label}
        subtitle="AI Model"
        icon={Sparkles}
        selected={selected}
        executionStatus={getNodeExecutionStatus(id)}
      >
        <p className="text-body-sm text-muted-foreground">
          Connect prompt, system prompt, and optional vision image inputs.
        </p>

        <div className="nodrag nopan nowheel border-t border-border-soft pt-2">
          <button
            type="button"
            onClick={() => updateConfig({ settingsOpen: !config.settingsOpen })}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] font-medium text-foreground hover:bg-surface-muted"
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
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input
                label="Temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                className="workflow-node-field"
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
                className="workflow-node-field"
                onChange={(event) =>
                  updateConfig({ maxOutputTokens: Number(event.target.value) })
                }
              />
            </div>
          ) : null}
        </div>

        <NodeInlineOutputSection
          sectionLabel="Response"
          nodeType="geminiPro"
          inlineExecution={getNodeInlineExecution(id)}
        />
      </NodeCardShell>
    </div>
  );
}
