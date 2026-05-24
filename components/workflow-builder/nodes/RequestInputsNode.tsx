"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ImagePlus, Loader2, X } from "lucide-react";
import { type NodeProps } from "reactflow";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import {
  getExecutableImageUrl,
  needsImageReupload,
  uploadWorkflowImage,
  validateWorkflowImageFile,
} from "@/lib/upload/image-upload";
import { defaultImageFieldState } from "@/lib/workflow/node-defaults";
import { cn } from "@/lib/utils/cn";
import type {
  ImageFieldState,
  RequestInputsConfig,
  WorkflowNodeData,
} from "@/types/workflow-canvas";
import { useWorkflowBuilder } from "../WorkflowBuilderContext";
import { NodeCardShell } from "./NodeCardShell";
import { NodeHandle } from "./NodeHandle";

const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function revokePreviewUrl(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export function RequestInputsNode({
  id,
  data,
  selected,
}: NodeProps<WorkflowNodeData>) {
  const { updateNodeData, isSourceHandleConnected, getNodeExecutionStatus, workflowId } =
    useWorkflowBuilder();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null,
  );

  const config = data.config as RequestInputsConfig;
  const textFieldConnected = isSourceHandleConnected(id, "text_field");
  const imageFieldConnected = isSourceHandleConnected(id, "image_field");
  const savedImage = config.imageField;
  const hasSavedImage = Boolean(savedImage.fileUrl);
  const hasExecutableImage = Boolean(getExecutableImageUrl(savedImage.fileUrl));

  const displayPreviewUrl =
    isUploading && localPreviewUrl ? localPreviewUrl : savedImage.fileUrl;
  const showPreview = Boolean(displayPreviewUrl);

  useEffect(() => {
    return () => {
      revokePreviewUrl(localPreviewRef.current);
    };
  }, []);

  const updateImageField = (imageField: ImageFieldState) => {
    updateNodeData(id, (current) => ({
      ...current,
      config: {
        ...(current.config as RequestInputsConfig),
        imageField,
      },
    }));
  };

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

  const resetLocalUploadState = () => {
    revokePreviewUrl(localPreviewRef.current);
    localPreviewRef.current = null;
    setLocalPreviewUrl(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleImageSelect = async (file: File | null) => {
    if (!file) {
      return;
    }

    const validationError = validateWorkflowImageFile(file);

    if (validationError) {
      setUploadErrorMessage(validationError);
      return;
    }

    setUploadErrorMessage(null);
    resetLocalUploadState();

    const blobPreviewUrl = URL.createObjectURL(file);
    localPreviewRef.current = blobPreviewUrl;
    setLocalPreviewUrl(blobPreviewUrl);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await uploadWorkflowImage(file, workflowId, {
        onProgress: setUploadProgress,
      });

      updateImageField({
        fileName: result.fileName,
        fileUrl: result.fileUrl,
        mimeType: result.mimeType ?? file.type ?? null,
        size: result.size ?? file.size,
      });

      resetLocalUploadState();
      setUploadErrorMessage(null);
    } catch (error) {
      resetLocalUploadState();
      setUploadErrorMessage(
        error instanceof Error ? error.message : "Upload failed.",
      );
    }
  };

  const clearImage = () => {
    resetLocalUploadState();
    setUploadErrorMessage(null);
    updateImageField(defaultImageFieldState());

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
          accept={IMAGE_ACCEPT}
          className="hidden"
          disabled={imageFieldConnected || isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            void handleImageSelect(file);
          }}
        />

        {showPreview ? (
          <div
            className={cn(
              "rounded-button border border-border bg-surface-muted p-2",
              imageFieldConnected && "opacity-80",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-caption text-muted">
                {isUploading
                  ? "Uploading..."
                  : savedImage.fileName ?? "Uploaded image"}
              </p>
              <button
                type="button"
                onClick={clearImage}
                disabled={isUploading || imageFieldConnected}
                onMouseDown={stopNodePointer}
                onPointerDown={stopNodePointer}
                className="shrink-0 rounded-button p-0.5 text-muted hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPreviewUrl ?? undefined}
              alt={savedImage.fileName ?? "Uploaded image"}
              className="mt-2 max-h-28 w-full rounded-button object-cover"
            />
            {isUploading ? (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-1 text-caption text-muted">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={imageFieldConnected || isUploading}
            onClick={() => fileInputRef.current?.click()}
            onMouseDown={stopNodePointer}
          >
            {isUploading ? (
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

        {uploadErrorMessage ? (
          <p className="text-caption text-red-400">{uploadErrorMessage}</p>
        ) : null}

        {needsImageReupload(savedImage.fileUrl) ? (
          <p className="text-caption text-amber-400">
            Re-upload this image before running the workflow.
          </p>
        ) : null}

        {hasSavedImage &&
        !hasExecutableImage &&
        !needsImageReupload(savedImage.fileUrl) ? (
          <p className="text-caption text-amber-400">
            Image preview unavailable for execution. Re-upload the image.
          </p>
        ) : null}
      </div>
    </NodeCardShell>
  );
}