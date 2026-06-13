"use client";

import { Info, Plus, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { NodeHandle } from "./NodeHandle";
import { NodeDecorativeHandle } from "./NodeDecorativeHandle";

type UploadHandleColor = "image" | "green" | "cyan" | "purple";

type NodeUploadInputRowProps = {
  label: string;
  buttonLabel: string;
  connected?: boolean;
  connectedText?: string;
  connectedImages?: string[];
  connectedImageKind?: "cropped" | "default";
  connectedHint?: string | null;
  handleId?: string;
  decorativeColor?: UploadHandleColor;
  onAddConnection?: () => void;
  onUploadClick?: () => void;
  disabled?: boolean;
  className?: string;
  dense?: boolean;
};

function stopNodePointer(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function NodeUploadInputRow({
  label,
  buttonLabel,
  connected = false,
  connectedText = "Input connected",
  connectedImages = [],
  connectedImageKind = "default",
  connectedHint = null,
  handleId,
  decorativeColor,
  onAddConnection,
  onUploadClick,
  disabled = false,
  className,
  dense = false,
}: NodeUploadInputRowProps) {
  const showFunctionalHandle = Boolean(handleId);
  const readyImages = connectedImages.filter(Boolean);
  const hasReadyImages = readyImages.length > 0;
  const readyLabel =
    connectedImageKind === "cropped" && readyImages.length > 1
      ? `${readyImages.length} connected cropped images ready`
      : connectedImageKind === "cropped" && readyImages.length === 1
        ? "Connected cropped image ready"
        : readyImages.length > 1
          ? `${readyImages.length} connected images ready`
          : readyImages.length === 1
            ? "Connected image ready"
            : connectedText;

  return (
    <div
      className={cn(
        "workflow-node-field-row nodrag nopan nowheel relative",
        className,
      )}
    >
      {showFunctionalHandle ? (
        <div className="workflow-handle-slot workflow-handle-slot-left">
          <NodeHandle id={handleId!} type="target" inline />
        </div>
      ) : decorativeColor ? (
        <div className="workflow-handle-slot workflow-handle-slot-left pointer-events-none">
          <NodeDecorativeHandle color={decorativeColor} />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "workflow-node-label-row flex items-center justify-between gap-2",
            dense ? "mb-0.5" : "mb-1.5",
          )}
        >
          <div className="flex min-w-0 items-center gap-1">
            <span className="workflow-node-field-label truncate">{label}</span>
            <button
              type="button"
              className="workflow-node-field-info"
              aria-label={`${label} information`}
              onMouseDown={stopNodePointer}
              onPointerDown={stopNodePointer}
            >
              <Info className="h-3 w-3" />
            </button>
          </div>

          {onAddConnection ? (
            <button
              type="button"
              className={cn(
                "workflow-node-add-connection-btn",
                dense && "workflow-node-add-connection-btn-dense",
              )}
              aria-label={`Connect ${label}`}
              title="Add connection"
              disabled={connected}
              onClick={(event) => {
                stopNodePointer(event);
                onAddConnection();
              }}
              onMouseDown={stopNodePointer}
              onPointerDown={stopNodePointer}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {connected && hasReadyImages ? (
          <div className="workflow-node-upload-preview">
            <p className="mb-2 text-[10px] text-muted-foreground">{readyLabel}</p>
            <div
              className={cn(
                "grid gap-2",
                readyImages.length > 1 ? "grid-cols-2" : "grid-cols-1",
              )}
            >
              {readyImages.map((imageUrl, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${imageUrl.slice(0, 32)}-${index}`}
                  src={imageUrl}
                  alt={`Connected ${label}`}
                  className="max-h-24 w-full rounded-md object-cover"
                />
              ))}
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled || connected}
            onClick={(event) => {
              stopNodePointer(event);
              onUploadClick?.();
            }}
            onMouseDown={stopNodePointer}
            onPointerDown={stopNodePointer}
            className={cn(
              "workflow-node-upload-btn w-full",
              dense && "workflow-node-upload-btn-dense",
              (disabled || connected) && "opacity-75",
            )}
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span>{connected ? connectedText : buttonLabel}</span>
          </button>
        )}

        {connected ? (
          <p
            className={cn(
              "text-[10px] text-muted-foreground",
              dense ? "mt-0.5" : "mt-1",
            )}
          >
            {hasReadyImages
              ? "Connected — manual input disabled."
              : (connectedHint ?? "Connected — manual input disabled.")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
