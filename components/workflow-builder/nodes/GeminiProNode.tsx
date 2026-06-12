"use client";

import { ChevronDown, Plus } from "lucide-react";
import { type NodeProps } from "reactflow";
import { Input } from "@/components/ui/Input";
import { defaultGeminiProConfig } from "@/lib/workflow/node-defaults";
import type { GeminiProConfig, WorkflowNodeData } from "@/types/workflow-canvas";
import { cn } from "@/lib/utils/cn";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";
import { NodeInlineOutputSection } from "./NodeInlineOutputSection";
import { NodeInputField } from "./NodeInputField";

export function GeminiProNode({
  id,
  data,
  selected,
}: NodeProps<WorkflowNodeData>) {
  const {
    updateNodeData,
    getNodeExecutionStatus,
    getNodeInlineExecution,
    isTargetHandleConnected,
    autoConnectHandle,
  } = useWorkflowBuilder();
  const config = {
    ...defaultGeminiProConfig(),
    ...(data.config as GeminiProConfig),
  };

  const promptConnected = isTargetHandleConnected(id, "prompt");
  const systemPromptConnected = isTargetHandleConnected(id, "system_prompt");
  const imageVisionConnected = isTargetHandleConnected(id, "image_vision");
  const inlineExecution = getNodeInlineExecution(id);

  const updateConfig = (patch: Partial<GeminiProConfig>) => {
    updateNodeData(id, (current) => ({
      ...current,
      config: { ...(current.config as GeminiProConfig), ...patch },
    }));
  };

  return (
    <div className="relative w-[320px]">
      <NodeCardShell
        nodeId={id}
        title={data.label}
        selected={selected}
        locked={data.locked}
        headerVariant="model"
        executionStatus={getNodeExecutionStatus(id)}
        className="w-full overflow-visible"
      >
        <NodeInputField
          label="Prompt"
          required
          handleId="prompt"
          handleType="target"
          placeholder="Enter your prompt..."
          value={config.prompt}
          connected={promptConnected}
          disabled={promptConnected}
          minRows={4}
          onChange={(value) => updateConfig({ prompt: value })}
          onAddConnection={() => autoConnectHandle(id, "prompt")}
        />

        <NodeInputField
          label="System Prompt"
          handleId="system_prompt"
          handleType="target"
          placeholder="You are a helpful assistant..."
          value={config.systemPrompt}
          connected={systemPromptConnected}
          disabled={systemPromptConnected}
          minRows={4}
          onChange={(value) => updateConfig({ systemPrompt: value })}
          onAddConnection={() => autoConnectHandle(id, "system_prompt")}
        />

        <div className="workflow-node-field-row nodrag nopan nowheel relative">
          <div className="workflow-handle-slot workflow-handle-slot-left">
            <NodeHandle id="image_vision" type="target" inline />
          </div>

          <div className="stack-sm">
            <div className="workflow-node-label-row flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium leading-none text-foreground">
                Image (Vision)
              </span>
              <button
                type="button"
                className="workflow-node-add-connection-btn"
                aria-label="Connect image vision input"
                title="Add connection"
                disabled={imageVisionConnected}
                onClick={() => autoConnectHandle(id, "image_vision")}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <div
              className={cn(
                "flex min-h-[88px] items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/70 px-3 py-4 text-center",
                imageVisionConnected && "opacity-80",
              )}
            >
              <p className="text-[11px] text-muted-foreground">
                {imageVisionConnected
                  ? "Image input connected"
                  : "Connect an image source or use the + button"}
              </p>
            </div>
          </div>
        </div>

        <div className="nodrag nopan nowheel border-t border-border-soft pt-2">
          <button
            type="button"
            onClick={() => updateConfig({ settingsOpen: !config.settingsOpen })}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] font-medium text-foreground hover:bg-surface-muted"
            onPointerDown={(event) => event.stopPropagation()}
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

        <div className="border-t border-border-soft pt-3">
          <div className="workflow-node-field-row relative">
            <div className="workflow-handle-slot workflow-handle-slot-right">
              <NodeHandle id="response" type="source" inline />
            </div>

            <p className="workflow-node-label-row text-[11px] font-medium leading-none text-foreground">
              Response
            </p>
          </div>

          {inlineExecution ? (
            <NodeInlineOutputSection
              sectionLabel=""
              nodeType="geminiPro"
              inlineExecution={inlineExecution}
              compact
            />
          ) : (
            <div className="mt-2 rounded-lg bg-surface-muted px-3 py-2.5 text-[11px] text-muted-foreground">
              No output yet
            </div>
          )}
        </div>
      </NodeCardShell>
    </div>
  );
}
