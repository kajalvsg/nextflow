export const GEMINI_DEMO_FALLBACK_RESPONSE =
  "Demo fallback: Gemini quota exceeded, but the workflow execution pipeline completed successfully.";

export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
}

export function isGeminiQuotaError(message: string): boolean {
  const lower = message.toLowerCase();

  return (
    lower.includes("429") ||
    lower.includes("quota exceeded") ||
    lower.includes("too many requests") ||
    lower.includes("rate limit")
  );
}

export function shouldUseGeminiDemoFallback(error: string): boolean {
  return isDemoModeEnabled() || isGeminiQuotaError(error);
}

export function getDemoModeSkipError(): string {
  return "DEMO_MODE=true in .env.local — Gemini API was not called. Set DEMO_MODE=false and restart trigger:dev to use your API key.";
}
