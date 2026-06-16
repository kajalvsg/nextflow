"use client";

import { Loader2 } from "lucide-react";
import { getDisplayImageUrl } from "@/lib/upload/image-upload";
import { resolveRunOutputDisplayUrl } from "@/lib/workflow/execution/run-output-url";
import { cn } from "@/lib/utils/cn";
import type { NodeInlineExecutionState } from "@/types/workflow-execution";

type NodeInlineOutputSectionProps = {
  sectionLabel: string;
  nodeType: "geminiPro" | "cropImage" | "response";
  inlineExecution: NodeInlineExecutionState | null;
  compact?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getImageSource(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/workflow-assets/") ||
    trimmed.startsWith("/api/run-outputs/")
  ) {
    return (
      resolveRunOutputDisplayUrl(trimmed) ??
      getDisplayImageUrl(trimmed) ??
      trimmed
    );
  }

  return null;
}

function getGeminiResponseText(output: unknown): string | null {
  if (!isRecord(output)) {
    return null;
  }

  return typeof output.response === "string" && output.response.trim().length > 0
    ? output.response
    : null;
}

function getCropOutputImage(output: unknown): {
  src: string;
  width: number | null;
  height: number | null;
} | null {
  if (!isRecord(output)) {
    return null;
  }

  const src = getImageSource(output.output_image);

  if (!src) {
    return null;
  }

  return {
    src,
    width: typeof output.width === "number" ? output.width : null,
    height: typeof output.height === "number" ? output.height : null,
  };
}

function getResponseResultValue(output: unknown): unknown {
  if (!isRecord(output)) {
    return output;
  }

  return "result" in output ? output.result : output;
}

function renderResponseContent(result: unknown) {
  const imageSrc = getImageSource(result);

  if (imageSrc) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt="Workflow result"
          className="max-h-32 w-full rounded-button object-cover"
        />
      </>
    );
  }

  if (typeof result === "string" && result.trim().length > 0) {
    return (
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-button bg-surface-muted p-2 text-body-sm text-foreground">
        {result}
      </pre>
    );
  }

  if (isRecord(result)) {
    const nestedResponse = getGeminiResponseText(result);

    if (nestedResponse) {
      return (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-button bg-surface-muted p-2 text-body-sm text-foreground">
          {nestedResponse}
        </pre>
      );
    }

    const nestedCrop = getCropOutputImage(result);

    if (nestedCrop) {
      return (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={nestedCrop.src}
            alt="Workflow result"
            className="max-h-32 w-full rounded-button object-cover"
          />
        </>
      );
    }
  }

  if (result == null) {
    return (
      <p className="text-caption text-muted">No result was produced.</p>
    );
  }

  return (
    <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-button bg-surface-muted p-2 text-[11px] text-muted">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

function renderSuccessOutput(
  nodeType: NodeInlineOutputSectionProps["nodeType"],
  output: unknown,
) {
  if (nodeType === "geminiPro") {
    const response = getGeminiResponseText(output);

    if (!response) {
      return (
        <p className="text-caption text-muted">No response text was returned.</p>
      );
    }

    return (
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-button bg-surface-muted p-2 text-body-sm text-foreground">
        {response}
      </pre>
    );
  }

  if (nodeType === "cropImage") {
    const cropOutput = getCropOutputImage(output);

    if (!cropOutput) {
      return (
        <p className="text-caption text-muted">No cropped image was returned.</p>
      );
    }

    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cropOutput.src}
          alt="Cropped output"
          className="max-h-32 w-full rounded-button object-cover"
        />
        {cropOutput.width != null && cropOutput.height != null ? (
          <p className="text-caption text-muted">
            {cropOutput.width} × {cropOutput.height}px
          </p>
        ) : null}
      </>
    );
  }

  return renderResponseContent(getResponseResultValue(output));
}

export function NodeInlineOutputSection({
  sectionLabel,
  nodeType,
  inlineExecution,
  compact = false,
}: NodeInlineOutputSectionProps) {
  if (!inlineExecution) {
    return null;
  }

  const { status, output, error } = inlineExecution;
  const isPending = status === "updating" || status === "running";

  return (
    <div
      className={cn(
        "nodrag nopan nowheel stack-sm",
        !compact && "border-t border-border-soft pt-3",
        compact && "mt-2",
        isPending && "opacity-80",
      )}
    >
      {sectionLabel ? (
        <p className="text-label text-foreground">{sectionLabel}</p>
      ) : null}

      {isPending ? (
        <div className="flex items-center gap-2 text-caption text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </div>
      ) : null}

      {!isPending && status === "failed" ? (
        <p className="text-caption text-red-400">
          {error ?? "Node execution failed."}
        </p>
      ) : null}

      {!isPending && status === "success" ? (
        <div className="stack-sm">{renderSuccessOutput(nodeType, output)}</div>
      ) : null}
    </div>
  );
}
