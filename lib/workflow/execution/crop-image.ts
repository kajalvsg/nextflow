import { readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { resolveProjectRoot } from "@/lib/db/project-root";
import {
  normalizeImageInputUrl,
  requireCropImageInputUrl,
} from "@/lib/workflow/execution/image-input";

export type CropImageInput = {
  input_image?: string | null;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
};

export type CropImageOutput = {
  output_image: string;
  width: number;
  height: number;
};

const MIN_CROP_DURATION_MS =
  process.env.NODE_ENV === "production" ? 0 : 30_000;

function extractWorkflowAssetFileName(reference: string): string | null {
  const match = reference.match(/\/workflow-assets\/([^?#]+)/);

  return match?.[1] ?? null;
}

async function readLocalWorkflowAsset(reference: string): Promise<Buffer | null> {
  const assetFileName = extractWorkflowAssetFileName(reference);

  if (!assetFileName) {
    return null;
  }

  try {
    return await readFile(
      path.join(resolveProjectRoot(), "public", "workflow-assets", assetFileName),
    );
  } catch {
    return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadImageBuffer(inputImage: string): Promise<Buffer> {
  const trimmed = inputImage.trim();

  if (trimmed.startsWith("data:image/")) {
    const base64 = trimmed.split(",")[1];

    if (!base64) {
      throw new Error("Invalid image data URL.");
    }

    return Buffer.from(base64, "base64");
  }

  const localAsset = await readLocalWorkflowAsset(trimmed);

  if (localAsset) {
    return localAsset;
  }

  const fetchUrl = normalizeImageInputUrl(trimmed) ?? trimmed;

  try {
    const response = await fetch(fetchUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to fetch input image (HTTP ${response.status}). Check that the URL is valid and publicly accessible.`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType && !contentType.startsWith("image/")) {
      throw new Error(
        "The input URL did not return an image. Provide a direct image URL or upload an image file.",
      );
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unable to fetch")) {
      throw error;
    }

    if (error instanceof Error && error.message.startsWith("The input URL")) {
      throw error;
    }

    throw new Error(
      "Invalid image URL or unable to reach the image server. Check the URL and try again.",
    );
  }
}

export async function executeCropImage(
  input: CropImageInput,
): Promise<CropImageOutput> {
  const startedAt = Date.now();
  const normalizedInput = requireCropImageInputUrl(input.input_image);
  const buffer = await loadImageBuffer(normalizedInput);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions.");
  }

  const xPercent = input.xPercent ?? 0;
  const yPercent = input.yPercent ?? 0;
  const widthPercent = input.widthPercent ?? 100;
  const heightPercent = input.heightPercent ?? 100;

  const left = Math.round((metadata.width * xPercent) / 100);
  const top = Math.round((metadata.height * yPercent) / 100);
  const width = Math.max(
    1,
    Math.round((metadata.width * widthPercent) / 100),
  );
  const height = Math.max(
    1,
    Math.round((metadata.height * heightPercent) / 100),
  );

  const cropped = await image
    .extract({
      left: Math.min(left, metadata.width - 1),
      top: Math.min(top, metadata.height - 1),
      width: Math.min(width, metadata.width - left),
      height: Math.min(height, metadata.height - top),
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  const elapsed = Date.now() - startedAt;
  const remaining = MIN_CROP_DURATION_MS - elapsed;

  if (remaining > 0) {
    await wait(remaining);
  }

  const output_image = `data:image/jpeg;base64,${cropped.toString("base64")}`;

  return {
    output_image,
    width,
    height,
  };
}
