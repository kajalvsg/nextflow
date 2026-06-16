import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveProjectRoot } from "@/lib/db/project-root";
import { resolveDatabaseBackend } from "@/lib/db/database-mode";
import {
  getRunOutputFileName,
  getRunOutputPublicUrl,
} from "@/lib/workflow/execution/run-output-url";

const MAX_INLINE_DATA_URL_CHARS = 8_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readDataImageUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.startsWith("data:image/") ? trimmed : null;
}

function findLargeDataUrl(
  record: Record<string, unknown>,
): { key: string; dataUrl: string } | null {
  for (const key of [
    "output_image",
    "outputImage",
    "dataUrl",
    "image_field",
    "input_image",
  ]) {
    const dataUrl = readDataImageUrl(record[key]);

    if (dataUrl && dataUrl.length > MAX_INLINE_DATA_URL_CHARS) {
      return { key, dataUrl };
    }
  }

  return null;
}

async function persistDataUrlToWorkflowAsset(
  executionId: string,
  dataUrl: string,
  suffix: string,
): Promise<string> {
  const base64 = dataUrl.split(",")[1];

  if (!base64) {
    throw new Error("Invalid image data URL.");
  }

  const directory = path.join(
    resolveProjectRoot(),
    "public",
    "workflow-assets",
    "run-outputs",
  );

  await mkdir(directory, { recursive: true });

  const fileName = getRunOutputFileName(executionId, suffix);
  const absolutePath = path.join(directory, fileName);
  await writeFile(absolutePath, Buffer.from(base64, "base64"));

  return getRunOutputPublicUrl(executionId);
}

export function getRunOutputFilePath(executionId: string, suffix = ""): string {
  return path.join(
    resolveProjectRoot(),
    "public",
    "workflow-assets",
    "run-outputs",
    getRunOutputFileName(executionId, suffix),
  );
}

/**
 * PGlite corrupts large JSON TOAST values when Next.js and Trigger.dev share
 * data/pglite. Store big data URLs as files and keep a small URL in the row.
 */
export async function compactExecutionPayloadForStorage(
  executionId: string,
  payload: unknown,
): Promise<unknown> {
  const databaseBackend = await resolveDatabaseBackend();

  if (databaseBackend !== "local" || !isRecord(payload)) {
    return payload;
  }

  const large = findLargeDataUrl(payload);

  if (!large) {
    return payload;
  }

  const publicUrl = await persistDataUrlToWorkflowAsset(
    executionId,
    large.dataUrl,
    large.key === "input_image" ? "-input" : "",
  );

  const next: Record<string, unknown> = { ...payload };

  if (large.key === "output_image" || large.key === "outputImage") {
    next.output_image = publicUrl;
    next.outputImage = publicUrl;
    next.fileUrl = publicUrl;
    next.dataUrl = null;
    return next;
  }

  if (large.key === "dataUrl") {
    next.dataUrl = publicUrl;
    if (typeof next.output_image === "string" && next.output_image.startsWith("data:")) {
      next.output_image = publicUrl;
    }
    if (typeof next.outputImage === "string" && next.outputImage.startsWith("data:")) {
      next.outputImage = publicUrl;
    }
    next.fileUrl = publicUrl;
    return next;
  }

  next[large.key] = publicUrl;
  return next;
}

export function getRunOutputAssetPath(executionId: string): string {
  return getRunOutputPublicUrl(executionId);
}
