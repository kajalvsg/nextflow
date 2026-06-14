"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { auth } from "@clerk/nextjs/server";
import { resolveProjectRoot } from "@/lib/db/project-root";
import { db, ensureDbReady } from "@/lib/db";
import type { ImageUploadResult } from "@/lib/upload/image-upload";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  toWorkflowAssetPath,
} from "@/lib/upload/image-upload";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UPLOAD_DIR = path.join(resolveProjectRoot(), "public", "workflow-assets");

async function requireUserId(): Promise<string> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

function getPublicAssetUrl(fileName: string): string {
  return toWorkflowAssetPath(fileName);
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

export async function uploadWorkflowImageAction(
  workflowId: string,
  formData: FormData,
): Promise<ImageUploadResult> {
  await ensureDbReady();
  const userId = await requireUserId();

  const workflow = await db.workflow.findFirst({
    where: { id: workflowId, userId },
    select: { id: true },
  });

  if (!workflow) {
    throw new Error("Workflow not found.");
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("No image file provided.");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Please upload a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 8MB or smaller.");
  }

  const extension = extensionForMimeType(file.type);
  const assetName = `${randomUUID()}.${extension}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(
    path.join(UPLOAD_DIR, assetName),
    Buffer.from(await file.arrayBuffer()),
  );

  return {
    fileName: file.name,
    fileUrl: getPublicAssetUrl(assetName),
  };
}
