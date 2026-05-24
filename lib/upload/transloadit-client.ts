import {
  createTransloaditUploadParams,
  logTransloaditParseFailure,
} from "@/actions/transloadit-upload";
import type { ImageUploadResult } from "@/lib/upload/image-upload";
import {
  TransloaditParseError,
  extractUploadedFileFromAssembly,
  normalizeTransloaditAssembly,
  type TransloaditAssemblyResponse,
} from "@/lib/upload/transloadit-response";

const TRANSLOADIT_API = "https://api2.transloadit.com/assemblies";
const MAX_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1_000;

async function pollAssembly(
  assemblySslUrl: string,
): Promise<TransloaditAssemblyResponse> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(assemblySslUrl);

    if (!response.ok) {
      throw new Error(`Transloadit status check failed (${response.status}).`);
    }

    const assembly = normalizeTransloaditAssembly(await response.json());

    if (assembly.error) {
      throw new Error(assembly.message ?? assembly.error);
    }

    if (assembly.ok === "ASSEMBLY_COMPLETED") {
      return assembly;
    }

    if (
      assembly.ok === "ASSEMBLY_CANCELED" ||
      assembly.ok === "ASSEMBLY_ABORTED"
    ) {
      throw new Error("Transloadit upload was canceled.");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Transloadit upload timed out while processing.");
}

async function waitForAssemblyResult(
  initial: TransloaditAssemblyResponse,
): Promise<TransloaditAssemblyResponse> {
  const assembly = normalizeTransloaditAssembly(initial);

  if (assembly.error) {
    throw new Error(assembly.message ?? assembly.error);
  }

  if (assembly.ok === "ASSEMBLY_COMPLETED") {
    return assembly;
  }

  const pollUrl =
    assembly.assembly_ssl_url ??
    (assembly.assembly_id
      ? `${TRANSLOADIT_API}/${assembly.assembly_id}`
      : null);

  if (!pollUrl) {
    throw new Error("Transloadit did not return an assembly id.");
  }

  return pollAssembly(pollUrl);
}

async function parseAssemblyResponse(
  payload: unknown,
): Promise<ImageUploadResult> {
  try {
    return extractUploadedFileFromAssembly(payload);
  } catch (error) {
    if (error instanceof TransloaditParseError) {
      console.error(
        "[transloadit-upload] Missing file URL. Response shape:",
        error.responseShape,
      );

      try {
        await logTransloaditParseFailure(payload);
      } catch {
        // Ignore logging failures; user-facing error still applies.
      }

      throw new Error(
        `${error.message} Check server logs for the Transloadit response shape.`,
      );
    }

    throw error;
  }
}

export async function uploadImageViaTransloadit(
  file: File,
  options?: { onProgress?: (percent: number) => void },
): Promise<ImageUploadResult> {
  const { params, signature } = await createTransloaditUploadParams();

  const formData = new FormData();
  formData.append("params", params);
  formData.append("signature", signature);
  formData.append("file", file);

  const initial = await new Promise<TransloaditAssemblyResponse>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", TRANSLOADIT_API);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options?.onProgress) {
          options.onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          const body = normalizeTransloaditAssembly(
            JSON.parse(xhr.responseText) as unknown,
          );

          if (xhr.status >= 400) {
            reject(
              new Error(body.message ?? body.error ?? "Transloadit upload failed."),
            );
            return;
          }

          resolve(body);
        } catch {
          reject(new Error("Invalid response from Transloadit."));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Network error while uploading to Transloadit."));
      };

      xhr.send(formData);
    },
  );

  const completed = await waitForAssemblyResult(initial);
  return parseAssemblyResponse(completed);
}
