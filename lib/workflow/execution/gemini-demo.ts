export const GEMINI_DEMO_FALLBACK_RESPONSE =
  "Demo fallback: Gemini quota exceeded, but the workflow execution pipeline completed successfully.";

const GEMINI_FALLBACK_BY_LABEL: Array<{ match: RegExp; message: string }> = [
  {
    match: /#1\b|gemini\s*#?1\b/i,
    message:
      "Demo fallback: Product description generated while Gemini is temporarily unavailable.",
  },
  {
    match: /#2\b|gemini\s*#?2\b/i,
    message:
      "Demo fallback: Short marketing hook generated while Gemini is temporarily unavailable.",
  },
  {
    match: /final/i,
    message:
      "Demo fallback: Final marketing post generated while Gemini is temporarily unavailable.",
  },
];

export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
}

export function isGeminiFallbackExplicitlyDisabled(): boolean {
  const value = process.env.ENABLE_GEMINI_FALLBACK?.trim().toLowerCase();

  return value === "false" || value === "0" || value === "no";
}

export function isGeminiQuotaError(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("429") ||
    lower.includes("quota exceeded") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted")
  );
}

export function isGeminiServiceUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("service unavailable") ||
    lower.includes("high demand") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("overloaded")
  );
}

export function isRetryableGeminiServiceError(message: string): boolean {
  return isGeminiQuotaError(message) || isGeminiServiceUnavailableError(message);
}

export function shouldUseGeminiDemoFallback(error: string): boolean {
  if (isGeminiFallbackExplicitlyDisabled()) {
    return false;
  }

  if (isDemoModeEnabled()) {
    return true;
  }

  return isRetryableGeminiServiceError(error);
}

export function getGeminiFallbackResponse(
  nodeLabel: string,
  nodeId?: string,
): string {
  const label = nodeLabel.trim();
  const id = nodeId?.trim() ?? "";

  for (const entry of GEMINI_FALLBACK_BY_LABEL) {
    if (entry.match.test(label) || (id && entry.match.test(id))) {
      return entry.message;
    }
  }

  if (/gemini-1\b/i.test(id)) {
    return GEMINI_FALLBACK_BY_LABEL[0]!.message;
  }

  if (/gemini-2\b/i.test(id)) {
    return GEMINI_FALLBACK_BY_LABEL[1]!.message;
  }

  return GEMINI_DEMO_FALLBACK_RESPONSE;
}

export function getDemoModeSkipError(): string {
  return "DEMO_MODE=true in .env.local — Gemini API was not called. Set DEMO_MODE=false and restart trigger:dev to use your API key.";
}
