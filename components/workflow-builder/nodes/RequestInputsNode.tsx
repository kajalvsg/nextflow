"use client";

import { useRef } from "react";
import { ArrowDownToLine, ImagePlus, Loader2, X } from "lucide-react";
import { type NodeProps } from "reactflow";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  getExecutableImageUrl,
  needsImageReupload,
  uploadWorkflowImage,
} from "@/lib/upload/image-upload";
import { cn } from "@/lib/utils/cn";
import type { RequestInputsConfig, WorkflowNodeData } from "@/types/workflow-canvas";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function RequestInputsNode({
  id,
  data,
  selected,
}: NodeProps<WorkflowNodeData>) {
  const { updateNodeData, isSourceHandleConnected, getNodeExecutionStatus, workflowId } =
    useWorkflowBuilder();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = data.config as RequestInputsConfig;
  const textFieldConnected = isSourceHandleConnected(id, "text_field");
  const imageFieldConnected = isSourceHandleConnected(id, "image_field");
  const hasExecutableImage = Boolean(getExecutableImageUrl(config.imageField.fileUrl));
  const hasPreviewImage =
    config.imageField.uploadStatus === "done" && Boolean(config.imageField.fileUrl);

  const updateConfig = (patch: Partial<RequestInputsConfig>) => {
    updateNodeData(id, (current) => ({
      ...current,
      config: { ...(current.config as RequestInputsConfig), ...patch },
    }));
  };

  const handleTextChange = (value: string) => {
    if (textFieldConnected) {
      return;
    }

    updateConfig({ textField: value });
  };

  const handleImageSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    updateConfig({
      imageField: {
        fileName: file.name,
        fileUrl: null,
        uploadStatus: "uploading",
      },
    });

    try {
      const result = await uploadWorkflowImage(file, workflowId);
      updateConfig({
        imageField: {
          fileName: result.fileName,
          fileUrl: result.fileUrl,
          uploadStatus: "done",
        },
      });
    } catch {
      updateConfig({
        imageField: {
          fileName: file.name,
          fileUrl: null,
          uploadStatus: "error",
        },
      });
    }
  };

  const clearImage = () => {
    updateConfig({
      imageField: { fileName: null, fileUrl: null, uploadStatus: "idle" },
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <NodeCardShell
      title={data.label}
      subtitle="Workflow Input"
      icon={ArrowDownToLine}
      selected={selected}
      executionStatus={getNodeExecutionStatus(id)}
      rightGutter
      handles={
        <>
          <NodeHandle id="text_field" type="source" top="38%" />
          <NodeHandle id="image_field" type="source" top="72%" />
        </>
      }
    >
      <div className="nodrag nopan nowheel">
        <Textarea
          label="text_field"
          placeholder="Enter default text input..."
          value={config.textField}
          disabled={textFieldConnected}
          onChange={(event) => handleTextChange(event.target.value)}
          className="min-h-20 text-body-sm"
        />
        {textFieldConnected ? (
          <p className="text-caption text-muted">
            Connected — manual input disabled.
          </p>
        ) : null}
      </div>

      <div className="nodrag nopan nowheel stack-sm">
        <p className="text-label text-foreground">image_field</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            void handleImageSelect(file);
          }}
        />

        {hasPreviewImage ? (
          <div
            className={cn(
              "rounded-button border border-border bg-surface-muted p-2",
              imageFieldConnected && "opacity-80",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-caption text-muted">
                {config.imageField.fileName}
              </p>
              <button
                type="button"
                onClick={clearImage}
                onMouseDown={stopNodePointer}
                onPointerDown={stopNodePointer}
                className="shrink-0 rounded-button p-0.5 text-muted hover:bg-surface-hover hover:text-foreground"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.imageField.fileUrl ?? undefined}
              alt={config.imageField.fileName ?? "Uploaded image"}
              className="mt-2 max-h-28 w-full rounded-button object-cover"
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={
              imageFieldConnected || config.imageField.uploadStatus === "uploading"
            }
            onClick={() => fileInputRef.current?.click()}
            onMouseDown={stopNodePointer}
          >
            {config.imageField.uploadStatus === "uploading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4" />
                Upload image
              </>
            )}
          </Button>
        )}

        {imageFieldConnected ? (
          <p className="text-caption text-muted">
            Connected — upload disabled. Remove image to reset, or delete the
            edge to upload again.
          </p>
        ) : null}

        {config.imageField.uploadStatus === "error" ? (
          <p className="text-caption text-red-400">Upload failed. Try again.</p>
        ) : null}

        {needsImageReupload(config.imageField.fileUrl) ? (
          <p className="text-caption text-amber-400">
            Re-upload this image before running the workflow.
          </p>
        ) : null}

        {hasPreviewImage && !hasExecutableImage && !needsImageReupload(config.imageField.fileUrl) ? (
          <p className="text-caption text-amber-400">
            Image preview unavailable for execution. Re-upload the image.
          </p>
        ) : null}
      </div>
    </NodeCardShell>
  );
}
