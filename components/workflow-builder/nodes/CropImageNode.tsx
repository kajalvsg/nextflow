"use client";

import { type NodeProps } from "reactflow";
import type { CropImageConfig, WorkflowNodeData } from "@/types/workflow-canvas";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeCropSliderRow } from "./NodeCropSliderRow";
import { NodeOutputPreview } from "./NodeOutputPreview";
import { NodeUploadInputRow } from "./NodeUploadInputRow";

export function CropImageNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const {
    updateNodeData,
    getNodeExecutionStatus,
    getNodeInlineExecution,
    getConnectedInput,
    isTargetHandleConnected,
    autoConnectHandle,
  } = useWorkflowBuilder();
  const config = data.config as CropImageConfig;
  const inputImageConnected = isTargetHandleConnected(id, "input_image");
  const inputImageResolved = getConnectedInput(id, "input_image");

  const updateConfig = (patch: Partial<CropImageConfig>) => {
    updateNodeData(id, (current) => ({
      ...current,
      config: { ...(current.config as CropImageConfig), ...patch },
    }));
  };

  return (
    <div className="relative w-[272px]">
      <NodeCardShell
        nodeId={id}
        title="Crop Image"
        selected={selected}
        locked={data.locked}
        showHeaderIcon={false}
        headerVariant="model"
        dense
        executionStatus={getNodeExecutionStatus(id)}
        className="workflow-node-card-crop w-full overflow-visible"
      >
        <NodeUploadInputRow
          dense
          label="Input Image"
          buttonLabel="Upload image"
          handleId="input_image"
          connected={inputImageConnected}
          connectedText="Image input connected"
          connectedImages={inputImageResolved?.images ?? []}
          connectedImageKind={inputImageResolved?.imageKind}
          connectedHint={
            inputImageConnected && inputImageResolved?.status !== "ready"
              ? inputImageResolved?.hint ?? "Connected — waiting for upstream output."
              : null
          }
          onAddConnection={() => autoConnectHandle(id, "input_image")}
          disabled
        />

        <NodeCropSliderRow
          dense
          label="X Position (%)"
          value={config.xPercent}
          defaultValue={0}
          onChange={(value) => updateConfig({ xPercent: value })}
        />
        <NodeCropSliderRow
          dense
          label="Y Position (%)"
          value={config.yPercent}
          defaultValue={0}
          onChange={(value) => updateConfig({ yPercent: value })}
        />
        <NodeCropSliderRow
          dense
          label="Width (%)"
          value={config.widthPercent}
          defaultValue={100}
          onChange={(value) => updateConfig({ widthPercent: value })}
        />
        <NodeCropSliderRow
          dense
          label="Height (%)"
          value={config.heightPercent}
          defaultValue={100}
          onChange={(value) => updateConfig({ heightPercent: value })}
        />

        <NodeOutputPreview
          dense
          label="Output Image"
          nodeType="cropImage"
          inlineExecution={getNodeInlineExecution(id)}
          outputHandleId="output_image"
        />
      </NodeCardShell>
    </div>
  );
}
