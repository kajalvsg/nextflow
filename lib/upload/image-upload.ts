import { uploadWorkflowImageAction } from "@/actions/workflow-images";

export type ImageUploadResult = {
  fileName: string;
  fileUrl: string;
};

export type ImageUploadOptions = {
  onProgress?: (percent: number) => void;
};

/**
 * Upload a workflow image via server action.
 * Files are stored under /public/workflow-assets and referenced by HTTP URL
 * so workflow JSON stays small and Trigger.dev can fetch images server-side.
 */
export async function uploadWorkflowImage(
  file: File,
  workflowId: string,
  _options?: ImageUploadOptions,
): Promise<ImageUploadResult> {
  void _options;

  const formData = new FormData();
  formData.append("file", file);

  return uploadWorkflowImageAction(workflowId, formData);
}

export function isTransloaditConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_TRANSLOADIT_KEY &&
      process.env.NEXT_PUBLIC_TRANSLOADIT_TEMPLATE_ID,
  );
}

export function getExecutableImageUrl(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:image/")) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/workflow-assets/")) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";
    return `${baseUrl}${trimmed}`;
  }

  return null;
}

export function isExecutableImageUrl(value: string | null | undefined): boolean {
  return getExecutableImageUrl(value) !== null;
}

export function needsImageReupload(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("blob:");
}
