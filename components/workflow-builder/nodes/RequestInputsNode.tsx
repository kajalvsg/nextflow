"use client";

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  GripVertical,
  ImagePlus,
  Info,
  Loader2,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { type NodeProps, useUpdateNodeInternals } from "reactflow";
import {
  getExecutableImageUrl,
  needsImageReupload,
  uploadWorkflowImage,
  validateWorkflowImageFile,
} from "@/lib/upload/image-upload";
import { defaultImageFieldState } from "@/lib/workflow/node-defaults";
import {
  createRequestInputField,
  fieldIdFromLabel,
  normalizeRequestInputsConfig,
  serializeRequestInputsConfig,
} from "@/lib/workflow/request-inputs-fields";
import type {
  ImageFieldState,
  RequestInputField,
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

type RequestFieldRowProps = {
  field: RequestInputField;
  workflowId: string;
  onLabelCommit: (fieldId: string, label: string) => void;
  onDelete: (fieldId: string) => void;
  onTextChange: (fieldId: string, value: string) => void;
  onImageChange: (fieldId: string, imageValue: ImageFieldState) => void;
};

function RequestInputFieldRow({
  field,
  workflowId,
  onLabelCommit,
  onDelete,
  onTextChange,
  onImageChange,
}: RequestFieldRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const [labelDraft, setLabelDraft] = useState(field.label);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setLabelDraft(field.label);
  }, [field.label]);

  useEffect(() => {
    return () => {
      revokePreviewUrl(localPreviewRef.current);
    };
  }, []);

  const savedImage = field.imageValue ?? defaultImageFieldState();
  const hasSavedImage = Boolean(savedImage.fileUrl);
  const hasExecutableImage = Boolean(getExecutableImageUrl(savedImage.fileUrl));
  const displayPreviewUrl =
    isUploading && localPreviewUrl ? localPreviewUrl : savedImage.fileUrl;
  const showPreview = Boolean(displayPreviewUrl);

  const resetLocalUploadState = () => {
    revokePreviewUrl(localPreviewRef.current);
    localPreviewRef.current = null;
    setLocalPreviewUrl(null);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleLabelBlur = () => {
    const trimmed = labelDraft.trim();

    if (!trimmed) {
      setLabelDraft(field.label);
      return;
    }

    if (trimmed !== field.label) {
      onLabelCommit(field.id, trimmed);
    }
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

      onImageChange(field.id, {
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
    onImageChange(field.id, defaultImageFieldState());

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyFieldValue = async () => {
    try {
      if (field.type === "text_field") {
        await navigator.clipboard.writeText(field.textValue ?? "");
        return;
      }

      const url = savedImage.fileUrl;

      if (url) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Clipboard may be unavailable in some contexts.
    }
  };

  return (
    <div className="workflow-node-request-field nodrag nopan nowheel relative">
      <div className="workflow-handle-slot workflow-handle-slot-right">
        <NodeHandle id={field.id} type="source" inline />
      </div>

      <div className="workflow-node-request-field-header">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <input
            type="text"
            value={labelDraft}
            aria-label="Field name"
            onChange={(event) => setLabelDraft(event.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            onPointerDown={stopNodePointer}
            className="workflow-node-field-label min-w-0 flex-1 truncate bg-transparent outline-none"
          />
          <button
            type="button"
            className="workflow-node-field-info"
            aria-label={`${field.label} information`}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
          >
            <Info className="h-3 w-3" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="workflow-node-header-icon !h-7 !w-7"
            aria-label={`Copy ${field.label}`}
            title="Copy"
            onClick={(event) => {
              stopNodePointer(event);
              void copyFieldValue();
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="workflow-node-header-icon !h-7 !w-7"
            aria-label={`Delete ${field.label}`}
            title="Delete field"
            onClick={(event) => {
              stopNodePointer(event);
              onDelete(field.id);
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
          >
            <Trash2 className="h-3 w-3 text-red-500" />
          </button>
        </div>
      </div>

      <div className="workflow-node-request-field-body">
        {field.type === "text_field" ? (
          <>
            <textarea
              placeholder="Enter text..."
              value={field.textValue ?? ""}
              onChange={(event) => onTextChange(field.id, event.target.value)}
              onPointerDown={stopNodePointer}
              className="workflow-node-prompt-field min-h-[52px] w-full resize-y"
            />
          </>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              disabled={isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handleImageSelect(file);
              }}
            />

            {showPreview ? (
              <div className="workflow-node-upload-preview">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="truncate text-[10px] text-muted-foreground">
                    {isUploading
                      ? "Uploading..."
                      : savedImage.fileName ?? "Uploaded image"}
                  </p>
                  <button
                    type="button"
                    onClick={clearImage}
                    disabled={isUploading}
                    onMouseDown={stopNodePointer}
                    onPointerDown={stopNodePointer}
                    className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayPreviewUrl ?? undefined}
                  alt={savedImage.fileName ?? "Uploaded image"}
                  className="max-h-24 w-full rounded-md object-cover"
                />
                {isUploading ? (
                  <div className="mt-2">
                    <div className="h-1 overflow-hidden rounded-full bg-surface-hover">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                onMouseDown={stopNodePointer}
                onPointerDown={stopNodePointer}
                className="workflow-node-upload-btn w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-3.5 w-3.5" />
                    Upload image
                  </>
                )}
              </button>
            )}

            {!showPreview ? (
              <input
                type="url"
                placeholder="Or paste image URL..."
                value=""
                disabled={isUploading}
                onChange={(event) => {
                  const url = event.target.value.trim();
                  onImageChange(field.id, {
                    fileName: url ? "Image URL" : null,
                    fileUrl: url || null,
                    mimeType: null,
                    size: null,
                  });
                }}
                onPointerDown={stopNodePointer}
                className="workflow-node-prompt-field mt-2 w-full px-2 py-1.5 text-[11px]"
              />
            ) : null}

            {uploadErrorMessage ? (
              <p className="mt-1 text-[10px] text-red-500">
                {uploadErrorMessage}
              </p>
            ) : null}

            {needsImageReupload(savedImage.fileUrl) ? (
              <p className="mt-1 text-[10px] text-amber-600">
                Re-upload this image before running the workflow.
              </p>
            ) : null}

            {hasSavedImage &&
            !hasExecutableImage &&
            !needsImageReupload(savedImage.fileUrl) ? (
              <p className="mt-1 text-[10px] text-amber-600">
                Image preview unavailable for execution. Re-upload the image.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function RequestInputsNode({
  id,
  data,
  selected,
}: NodeProps<WorkflowNodeData>) {
  const {
    updateNodeData,
    getNodeExecutionStatus,
    workflowId,
    removeEdgesForSourceHandle,
    remapSourceHandle,
  } = useWorkflowBuilder();
  const updateNodeInternals = useUpdateNodeInternals();
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const config = normalizeRequestInputsConfig(data.config);
  const fieldIdsKey = config.fields.map((field) => field.id).join("|");

  useEffect(() => {
    updateNodeInternals(id);
  }, [fieldIdsKey, id, updateNodeInternals]);

  useEffect(() => {
    if (!showAddMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as HTMLElement)
      ) {
        setShowAddMenu(false);
      }
    };

    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown, true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [showAddMenu]);

  const addField = (type: RequestInputField["type"]) => {
    setShowAddMenu(false);

    updateNodeData(id, (current) => {
      const currentConfig = normalizeRequestInputsConfig(current.config);
      const existingIds = currentConfig.fields.map((field) => field.id);
      const nextField = createRequestInputField(type, existingIds);

      return {
        ...current,
        config: serializeRequestInputsConfig({
          fields: [...currentConfig.fields, nextField],
        }),
      };
    });
  };

  const handleLabelCommit = (fieldId: string, label: string) => {
    updateNodeData(id, (current) => {
      const currentConfig = normalizeRequestInputsConfig(current.config);
      const field = currentConfig.fields.find((item) => item.id === fieldId);

      if (!field) {
        return current;
      }

      const existingIds = currentConfig.fields.map((item) => item.id);
      const nextId = fieldIdFromLabel(label, field.type, existingIds, fieldId);

      if (nextId !== fieldId) {
        remapSourceHandle(id, fieldId, nextId);
      }

      return {
        ...current,
        config: serializeRequestInputsConfig({
          fields: currentConfig.fields.map((item) =>
            item.id === fieldId ? { ...item, id: nextId, label } : item,
          ),
        }),
      };
    });
  };

  const handleDeleteField = (fieldId: string) => {
    removeEdgesForSourceHandle(id, fieldId);

    updateNodeData(id, (current) => {
      const currentConfig = normalizeRequestInputsConfig(current.config);

      return {
        ...current,
        config: serializeRequestInputsConfig({
          fields: currentConfig.fields.filter((field) => field.id !== fieldId),
        }),
      };
    });
  };

  const handleTextChange = (fieldId: string, value: string) => {
    updateNodeData(id, (current) => {
      const currentConfig = normalizeRequestInputsConfig(current.config);

      return {
        ...current,
        config: serializeRequestInputsConfig({
          fields: currentConfig.fields.map((field) =>
            field.id === fieldId && field.type === "text_field"
              ? { ...field, textValue: value }
              : field,
          ),
        }),
      };
    });
  };

  const handleImageChange = (fieldId: string, imageValue: ImageFieldState) => {
    updateNodeData(id, (current) => {
      const currentConfig = normalizeRequestInputsConfig(current.config);

      return {
        ...current,
        config: serializeRequestInputsConfig({
          fields: currentConfig.fields.map((field) =>
            field.id === fieldId && field.type === "image_field"
              ? { ...field, imageValue }
              : field,
          ),
        }),
      };
    });
  };

  return (
    <div className="relative w-[272px]">
      <NodeCardShell
        nodeId={id}
        title="Request-Inputs"
        selected={selected}
        showRunButton={false}
        showRefreshButton={false}
        showHeaderIcon={false}
        showInfoIcon
        executionStatus={getNodeExecutionStatus(id)}
        headerActions={
          <div className="relative nodrag nopan nowheel" ref={addMenuRef}>
            <button
              type="button"
              className="workflow-node-add-connection-btn nodrag nopan nowheel"
              aria-label="Add input field"
              title="Add field"
              aria-expanded={showAddMenu}
              aria-haspopup="menu"
              onClick={(event) => {
                stopNodePointer(event);
                setShowAddMenu((current) => !current);
              }}
              onMouseDown={stopNodePointer}
              onPointerDown={stopNodePointer}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            {showAddMenu ? (
              <div
                role="menu"
                className="nodrag nopan nowheel absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-md border border-border bg-background shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="nodrag nopan nowheel flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-surface-hover"
                  onClick={(event) => {
                    stopNodePointer(event);
                    addField("text_field");
                  }}
                  onMouseDown={stopNodePointer}
                  onPointerDown={stopNodePointer}
                >
                  <Type className="h-3.5 w-3.5 shrink-0" />
                  Text field
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="nodrag nopan nowheel flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] hover:bg-surface-hover"
                  onClick={(event) => {
                    stopNodePointer(event);
                    addField("image_field");
                  }}
                  onMouseDown={stopNodePointer}
                  onPointerDown={stopNodePointer}
                >
                  <ImagePlus className="h-3.5 w-3.5 shrink-0" />
                  Image field
                </button>
              </div>
            ) : null}
          </div>
        }
        className="w-full"
      >
        {config.fields.map((field) => (
          <RequestInputFieldRow
            key={field.id}
            field={field}
            workflowId={workflowId}
            onLabelCommit={handleLabelCommit}
            onDelete={handleDeleteField}
            onTextChange={handleTextChange}
            onImageChange={handleImageChange}
          />
        ))}
      </NodeCardShell>
    </div>
  );
}
