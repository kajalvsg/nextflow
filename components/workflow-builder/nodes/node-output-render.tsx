import { getDisplayImageUrl } from "@/lib/upload/image-upload";
import { resolveRunOutputDisplayUrl } from "@/lib/workflow/execution/run-output-url";

import { getCropOutputImage } from "./crop-output-utils";
import { CropImageOutputBody } from "./CropImageOutputBody";

export type InlineOutputNodeType = "geminiPro" | "cropImage" | "response";

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
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt="Workflow result"
        className="max-h-28 w-full rounded-md object-cover"
      />
    );
  }

  if (typeof result === "string" && result.trim().length > 0) {
    return (
      <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
        {result}
      </pre>
    );
  }

  if (isRecord(result)) {
    const nestedResponse = getGeminiResponseText(result);

    if (nestedResponse) {
      return (
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
          {nestedResponse}
        </pre>
      );
    }

    const nestedCrop = getCropOutputImage(result);

    if (nestedCrop) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={nestedCrop.src}
          alt="Workflow result"
          className="max-h-28 w-full rounded-md object-cover"
        />
      );
    }
  }

  if (result == null) {
    return (
      <p className="text-[11px] text-muted-foreground">No result was produced.</p>
    );
  }

  return (
    <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

export function renderInlineExecutionBody(
  nodeType: InlineOutputNodeType,
  output: unknown,
) {
  if (nodeType === "geminiPro") {
    const response = getGeminiResponseText(output);

    if (!response) {
      return (
        <p className="text-[11px] text-muted-foreground">
          No response text was returned.
        </p>
      );
    }

    return (
      <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
        {response}
      </pre>
    );
  }

  if (nodeType === "cropImage") {
    return <CropImageOutputBody output={output} />;
  }

  return renderResponseContent(getResponseResultValue(output));
}
