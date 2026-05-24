"use client";

import { Crop } from "lucide-react";
import { type NodeProps } from "reactflow";
import { Input } from "@/components/ui/Input";
import type { CropImageConfig, WorkflowNodeData } from "@/types/workflow-canvas";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";

export function CropImageNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const { updateNodeData, getNodeExecutionStatus } = useWorkflowBuilder();
  const config = data.config as CropImageConfig;

  const updateConfig = (patch: Partial<CropImageConfig>) => {
    updateNodeData(id, (current) => ({
      ...current,
      config: { ...(current.config as CropImageConfig), ...patch },
    }));
  };

  return (
    <div className="relative">
      <NodeHandle id="input_image" type="target" top="28%" />
      <NodeHandle id="output_image" type="source" top="72%" />

      <NodeCardShell
        title={data.label}
        subtitle="Image Processing"
        icon={Crop}
        selected={selected}
        executionStatus={getNodeExecutionStatus(id)}
      >
        <div className="nodrag nopan nowheel grid grid-cols-2 gap-3">
          <Input
            label="X Position (%)"
            type="number"
            min={0}
            max={100}
            value={config.xPercent}
            onChange={(event) =>
              updateConfig({ xPercent: Number(event.target.value) })
            }
          />
          <Input
            label="Y Position (%)"
            type="number"
            min={0}
            max={100}
            value={config.yPercent}
            onChange={(event) =>
              updateConfig({ yPercent: Number(event.target.value) })
            }
          />
          <Input
            label="Width (%)"
            type="number"
            min={1}
            max={100}
            value={config.widthPercent}
            onChange={(event) =>
              updateConfig({ widthPercent: Number(event.target.value) })
            }
          />
          <Input
            label="Height (%)"
            type="number"
            min={1}
            max={100}
            value={config.heightPercent}
            onChange={(event) =>
              updateConfig({ heightPercent: Number(event.target.value) })
            }
          />
        </div>
      </NodeCardShell>
    </div>
  );
}
