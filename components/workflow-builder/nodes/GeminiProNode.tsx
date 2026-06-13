"use client";

import { ChevronRight } from "lucide-react";
import { type NodeProps } from "reactflow";
import { Input } from "@/components/ui/Input";
import { defaultGeminiProConfig } from "@/lib/workflow/node-defaults";
import { cn } from "@/lib/utils/cn";
import type { GeminiProConfig, WorkflowNodeData } from "@/types/workflow-canvas";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeInputField } from "./NodeInputField";
import { NodeOutputPreview } from "./NodeOutputPreview";
import { NodeUploadInputRow } from "./NodeUploadInputRow";

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

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

  const updateConfig = (patch: Partial<GeminiProConfig>) => {
    updateNodeData(id, (current) => ({
      ...current,
      config: { ...(current.config as GeminiProConfig), ...patch },
    }));
  };

  return (
    <div className="relative w-[272px]">
      <NodeCardShell
        nodeId={id}
        title="Gemini 3.1 Pro"
        selected={selected}
        locked={data.locked}
        showHeaderIcon={false}
        headerVariant="model"
        dense
        executionStatus={getNodeExecutionStatus(id)}
        className="w-full overflow-visible"
      >
        <NodeInputField
          dense
          label="Prompt"
          required
          handleId="prompt"
          handleType="target"
          placeholder="Enter your prompt..."
          value={config.prompt}
          connected={promptConnected}
          disabled={promptConnected}
          minRows={1}
          onChange={(value) => updateConfig({ prompt: value })}
          onAddConnection={() => autoConnectHandle(id, "prompt")}
        />

        <NodeInputField
          dense
          label="System Prompt"
          handleId="system_prompt"
          handleType="target"
          placeholder="You are a helpful assistant..."
          value={config.systemPrompt}
          connected={systemPromptConnected}
          disabled={systemPromptConnected}
          minRows={1}
          onChange={(value) => updateConfig({ systemPrompt: value })}
          onAddConnection={() => autoConnectHandle(id, "system_prompt")}
        />

        <NodeUploadInputRow
          dense
          label="Image (Vision)"
          buttonLabel="Upload image"
          handleId="image_vision"
          connected={imageVisionConnected}
          connectedText="Image input connected"
          onAddConnection={() => autoConnectHandle(id, "image_vision")}
          disabled
        />

        <NodeUploadInputRow
          dense
          label="Video"
          buttonLabel="Upload video"
          decorativeColor="green"
          disabled
        />

        <NodeUploadInputRow
          dense
          label="Audio"
          buttonLabel="Upload audio"
          decorativeColor="cyan"
          disabled
        />

        <NodeUploadInputRow
          dense
          label="File"
          buttonLabel="Upload file"
          decorativeColor="purple"
          disabled
        />

        <button
          type="button"
          onClick={() => updateConfig({ settingsOpen: !config.settingsOpen })}
          className="workflow-node-settings-toggle workflow-node-settings-toggle-dense"
          onPointerDown={stopNodePointer}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
              config.settingsOpen && "rotate-90",
            )}
          />
          <span className="shrink-0">Settings</span>
        </button>

        {config.settingsOpen ? (
          <div className="grid grid-cols-2 gap-1.5">
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

        <NodeOutputPreview
          dense
          label="Response"
          nodeType="geminiPro"
          inlineExecution={getNodeInlineExecution(id)}
          outputHandleId="response"
        />
      </NodeCardShell>
    </div>
  );
}
