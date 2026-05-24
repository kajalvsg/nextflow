const LOG_PREFIX = "[gemini-debug]";

export function isGeminiDebugEnabled(): boolean {
  return process.env.GEMINI_DEBUG?.trim().toLowerCase() === "true";
}

export function logGeminiDebug(
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!isGeminiDebugEnabled()) {
    return;
  }

  if (data) {
    console.log(`${LOG_PREFIX} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${LOG_PREFIX} ${message}`);
  }
}

export type GeminiEnvSnapshot = {
  apiKeyPresent: boolean;
  apiKeyLength: number;
  model: string;
  demoMode: boolean;
  debugEnabled: boolean;
  endpoint: string;
  triggerSecretKeyPresent: boolean;
  envFileHint: string;
};

export function getGeminiModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

export function getGeminiEndpoint(model?: string): string {
  const modelName = model ?? getGeminiModelName();
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
}

export function getGeminiEnvSnapshot(): GeminiEnvSnapshot {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const model = getGeminiModelName();

  return {
    apiKeyPresent: apiKey.length > 0,
    apiKeyLength: apiKey.length,
    model,
    demoMode: process.env.DEMO_MODE?.trim().toLowerCase() === "true",
    debugEnabled: isGeminiDebugEnabled(),
    endpoint: getGeminiEndpoint(model),
    triggerSecretKeyPresent: Boolean(process.env.TRIGGER_SECRET_KEY?.trim()),
    envFileHint:
      "Trigger worker loads .env.local via `npm run trigger:dev` (--env-file .env.local). Restart after env changes.",
  };
}

export function logGeminiEnvSnapshot(context: string): void {
  logGeminiDebug(`${context} — env snapshot`, getGeminiEnvSnapshot());
}

export function parseGeminiApiErrorBody(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return { raw: rawBody };
  }
}

export function summarizeGeminiApiErrorBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    return { body };
  }

  const record = body as Record<string, unknown>;
  const error = record.error;

  if (!error || typeof error !== "object") {
    return record;
  }

  const errorRecord = error as Record<string, unknown>;
  const details = errorRecord.details;

  return {
    code: errorRecord.code,
    message: errorRecord.message,
    status: errorRecord.status,
    details: Array.isArray(details)
      ? details.map((detail) => {
          if (!detail || typeof detail !== "object") {
            return detail;
          }

          const detailRecord = detail as Record<string, unknown>;
          return {
            type: detailRecord["@type"],
            reason: detailRecord.reason,
            domain: detailRecord.domain,
            metadata: detailRecord.metadata,
          };
        })
      : details,
  };
}
