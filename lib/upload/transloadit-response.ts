import type { ImageUploadResult } from "@/lib/upload/image-upload";

export type TransloaditFileRecord = {
  name?: string;
  ssl_url?: string;
  url?: string;
  mime?: string;
  size?: number;
  original_name?: string;
  type?: string;
};

export type TransloaditAssemblyResponse = {
  ok?: string;
  error?: string;
  message?: string;
  assembly_id?: string;
  assembly_ssl_url?: string;
  results?: Record<string, TransloaditFileRecord[] | TransloaditFileRecord>;
  uploads?: TransloaditFileRecord[] | TransloaditFileRecord;
  result?: TransloaditAssemblyResponse;
};

function asFileArray(value: unknown): TransloaditFileRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is TransloaditFileRecord =>
        item !== null && typeof item === "object",
    );
  }

  if (value && typeof value === "object") {
    return [value as TransloaditFileRecord];
  }

  return [];
}

function pickFileUrl(file: TransloaditFileRecord): string | null {
  const sslUrl =
    typeof file.ssl_url === "string" && file.ssl_url.trim().length > 0
      ? file.ssl_url.trim()
      : null;

  if (sslUrl) {
    return sslUrl;
  }

  const url =
    typeof file.url === "string" && file.url.trim().length > 0
      ? file.url.trim()
      : null;

  return url;
}

function mapFileRecord(
  file: TransloaditFileRecord,
  fileUrl: string,
): ImageUploadResult {
  return {
    fileName:
      file.name ??
      file.original_name ??
      fileUrl.split("/").pop()?.split("?")[0] ??
      "upload",
    fileUrl,
    mimeType: file.mime ?? file.type ?? null,
    size: typeof file.size === "number" ? file.size : null,
  };
}

export function normalizeTransloaditAssembly(
  payload: unknown,
): TransloaditAssemblyResponse {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const root = payload as TransloaditAssemblyResponse;

  if (root.result && typeof root.result === "object") {
    return root.result;
  }

  return root;
}

export function describeTransloaditResponseShape(payload: unknown): unknown {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.slice(0, 3).map((item) => describeTransloaditResponseShape(item));
  }

  if (typeof payload !== "object") {
    if (typeof payload === "string" && /^https?:\/\//.test(payload)) {
      return "[url]";
    }

    return payload;
  }

  const record = payload as Record<string, unknown>;
  const described: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === "results" && value && typeof value === "object") {
      const results = value as Record<string, unknown>;
      described.results = Object.fromEntries(
        Object.entries(results).map(([step, files]) => [
          step,
          asFileArray(files).map((file) => ({
            name: file.name ?? file.original_name ?? null,
            hasSslUrl: Boolean(file.ssl_url),
            hasUrl: Boolean(file.url),
            mime: file.mime ?? file.type ?? null,
            size: file.size ?? null,
          })),
        ]),
      );
      continue;
    }

    if (key === "uploads") {
      described.uploads = asFileArray(value).map((file) => ({
        name: file.name ?? file.original_name ?? null,
        hasSslUrl: Boolean(file.ssl_url),
        hasUrl: Boolean(file.url),
        mime: file.mime ?? file.type ?? null,
        size: file.size ?? null,
      }));
      continue;
    }

    described[key] = describeTransloaditResponseShape(value);
  }

  return described;
}

export function extractUploadedFileFromAssembly(
  payload: unknown,
): ImageUploadResult {
  const assembly = normalizeTransloaditAssembly(payload);
  const results = assembly.results ?? {};

  const preferredSteps = [
    ":original",
    ...Object.keys(results).filter((step) => step !== ":original"),
  ];

  for (const step of preferredSteps) {
    for (const file of asFileArray(results[step])) {
      const fileUrl = pickFileUrl(file);

      if (fileUrl) {
        return mapFileRecord(file, fileUrl);
      }
    }
  }

  for (const file of asFileArray(assembly.uploads)) {
    const fileUrl = pickFileUrl(file);

    if (fileUrl) {
      return mapFileRecord(file, fileUrl);
    }
  }

  const shape = describeTransloaditResponseShape(payload);

  throw new TransloaditParseError(
    "Transloadit completed but no file URL was found in the assembly response.",
    shape,
  );
}

export class TransloaditParseError extends Error {
  readonly responseShape: unknown;

  constructor(message: string, responseShape: unknown) {
    super(message);
    this.name = "TransloaditParseError";
    this.responseShape = responseShape;
  }
}
