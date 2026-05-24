import {
  getGeminiEndpoint,
  getGeminiEnvSnapshot,
  getGeminiModelName,
  isGeminiDebugEnabled,
  logGeminiDebug,
  logGeminiEnvSnapshot,
  parseGeminiApiErrorBody,
  summarizeGeminiApiErrorBody,
} from "@/lib/workflow/execution/gemini-debug";
import {
  getDemoModeSkipError,
  isDemoModeEnabled,
} from "@/lib/workflow/execution/gemini-demo";

export type GeminiInvokeInput = {
  prompt: string;
  systemPrompt?: string;
  imageUrl?: string | null;
  temperature?: number;
  maxOutputTokens?: number;
};

export type GeminiInvokeResult =
  | { success: true; text: string }
  | { success: false; error: string; quotaExceeded?: boolean };

type GeminiContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

type GeminiGenerateRequest = {
  contents: Array<{ role: string; parts: GeminiContentPart[] }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
  systemInstruction?: { parts: Array<{ text: string }> };
};

export function isGeminiQuotaErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("429") ||
    lower.includes("quota exceeded") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted")
  );
}

export function getGeminiConfigError(): string | null {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return "Gemini API key is missing. Set GEMINI_API_KEY in your server environment.";
  }

  return null;
}

export function formatGeminiError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "Gemini request failed.");

  if (
    message.includes("429") ||
    message.toLowerCase().includes("quota exceeded") ||
    message.toLowerCase().includes("too many requests") ||
    message.toLowerCase().includes("resource_exhausted")
  ) {
    const model = getGeminiModelName();
    return `Gemini API quota exceeded for model "${model}". Try GEMINI_MODEL=gemini-2.5-flash, enable billing, or wait for your free-tier quota to reset.`;
  }

  if (message.includes("404") && message.toLowerCase().includes("not found")) {
    const model = getGeminiModelName();
    return `Gemini model "${model}" was not found. Set GEMINI_MODEL=gemini-2.5-flash in .env.local and restart trigger:dev.`;
  }

  if (message.includes("API key") || message.includes("API_KEY")) {
    return "Gemini API key is invalid or missing. Set GEMINI_API_KEY in your server environment.";
  }

  return message.length > 280 ? `${message.slice(0, 280)}…` : message;
}

const GEMINI_EMPTY_RESPONSE_FALLBACK = "Gemini returned an empty response.";

function extractGeminiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    logGeminiDebug("Gemini response missing body — using fallback", {});
    return GEMINI_EMPTY_RESPONSE_FALLBACK;
  }

  const record = payload as Record<string, unknown>;
  const candidates = record.candidates;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    logGeminiDebug("Gemini response missing candidates — using fallback", {
      promptFeedback: record.promptFeedback ?? null,
    });
    return GEMINI_EMPTY_RESPONSE_FALLBACK;
  }

  const firstCandidate = candidates[0];

  if (!firstCandidate || typeof firstCandidate !== "object") {
    logGeminiDebug("Gemini candidate payload invalid — using fallback", {});
    return GEMINI_EMPTY_RESPONSE_FALLBACK;
  }

  const content = (firstCandidate as Record<string, unknown>).content;

  if (!content || typeof content !== "object") {
    logGeminiDebug("Gemini candidate content missing — using fallback", {});
    return GEMINI_EMPTY_RESPONSE_FALLBACK;
  }

  const parts = (content as Record<string, unknown>).parts;

  if (!Array.isArray(parts)) {
    logGeminiDebug("Gemini candidate parts missing — using fallback", {});
    return GEMINI_EMPTY_RESPONSE_FALLBACK;
  }

  const text = parts
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }

      return typeof (part as Record<string, unknown>).text === "string"
        ? ((part as Record<string, unknown>).text as string)
        : "";
    })
    .join("")
    .trim();

  if (!text) {
    logGeminiDebug("Gemini response empty text — using fallback", {});
    return GEMINI_EMPTY_RESPONSE_FALLBACK;
  }

  return text;
}

async function buildGeminiParts(
  input: GeminiInvokeInput,
): Promise<GeminiContentPart[]> {
  const parts: GeminiContentPart[] = [
    { text: input.prompt || "Describe the provided input." },
  ];

  if (!input.imageUrl) {
    return parts;
  }

  logGeminiDebug("fetching vision image", {
    imageUrlHost: (() => {
      try {
        return new URL(input.imageUrl).host;
      } catch {
        return "invalid-url";
      }
    })(),
  });

  const response = await fetch(input.imageUrl);

  logGeminiDebug("vision image fetch completed", {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type"),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch vision image (${response.status}).`);
  }

  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());

  parts.push({
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  });

  return parts;
}

async function invokeGeminiViaRestApi(
  input: GeminiInvokeInput,
): Promise<GeminiInvokeResult> {
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const modelName = getGeminiModelName();
  const endpoint = getGeminiEndpoint(modelName);

  logGeminiEnvSnapshot("invokeGemini start");
  logGeminiDebug("request start", {
    model: modelName,
    endpoint,
    temperature: input.temperature ?? 0.7,
    maxOutputTokens: input.maxOutputTokens ?? 8192,
    promptLength: input.prompt?.length ?? 0,
    hasSystemPrompt: Boolean(input.systemPrompt?.trim()),
    hasImageUrl: Boolean(input.imageUrl),
  });

  const parts = await buildGeminiParts(input);

  const requestBody: GeminiGenerateRequest = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: input.temperature ?? 0.7,
      maxOutputTokens: input.maxOutputTokens ?? 8192,
    },
  };

  if (input.systemPrompt?.trim()) {
    requestBody.systemInstruction = {
      parts: [{ text: input.systemPrompt.trim() }],
    };
  }

  const startedAt = Date.now();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(requestBody),
  });

  const rawBody = await response.text();
  const durationMs = Date.now() - startedAt;

  logGeminiDebug("response received", {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    durationMs,
    bodyLength: rawBody.length,
  });

  if (!response.ok) {
    const parsedBody = parseGeminiApiErrorBody(rawBody);
    const summarizedBody = summarizeGeminiApiErrorBody(parsedBody);
    const quotaExceeded =
      response.status === 429 || isGeminiQuotaErrorMessage(rawBody);

    logGeminiDebug("Gemini API error response", {
      status: response.status,
      statusText: response.statusText,
      model: modelName,
      endpoint,
      quotaExceeded,
      errorBody: summarizedBody,
      rawBodyPreview: rawBody.slice(0, 2000),
    });

    const apiMessage =
      typeof summarizedBody.message === "string"
        ? summarizedBody.message
        : rawBody.slice(0, 500);

    const errorMessage = formatGeminiError(
      new Error(
        `[${response.status} ${response.statusText}] ${apiMessage}`,
      ),
    );

    return {
      success: false,
      error: errorMessage,
      quotaExceeded,
    };
  }

  let parsedSuccessBody: unknown;

  try {
    parsedSuccessBody = JSON.parse(rawBody) as unknown;
  } catch (error) {
    logGeminiDebug("failed to parse Gemini success body", {
      error: error instanceof Error ? error.message : String(error),
      rawBodyPreview: rawBody.slice(0, 500),
    });
    throw error;
  }

  const text = extractGeminiResponseText(parsedSuccessBody);

  logGeminiDebug("Gemini API success", {
    model: modelName,
    responseLength: text.length,
    durationMs,
  });

  return { success: true, text };
}

export async function invokeGemini(
  input: GeminiInvokeInput,
): Promise<GeminiInvokeResult> {
  if (isDemoModeEnabled() && !isGeminiDebugEnabled()) {
    logGeminiDebug("demo mode bypass active — skipping Gemini API call");
    return {
      success: false,
      error: getDemoModeSkipError(),
    };
  }

  const configError = getGeminiConfigError();

  if (configError) {
    logGeminiDebug("Gemini config error", getGeminiEnvSnapshot());
    return { success: false, error: configError };
  }

  try {
    return await invokeGeminiViaRestApi(input);
  } catch (error) {
    const errorMessage = formatGeminiError(error);

    logGeminiDebug("invokeGemini unexpected failure", {
      message: errorMessage,
      env: getGeminiEnvSnapshot(),
    });

    return {
      success: false,
      error: errorMessage,
      quotaExceeded: isGeminiQuotaErrorMessage(errorMessage),
    };
  }
}
