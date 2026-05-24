import { task } from "@trigger.dev/sdk/v3";
import {
  invokeGemini,
  type GeminiInvokeInput,
} from "@/lib/workflow/execution/gemini-client";
import {
  logGeminiDebug,
  logGeminiEnvSnapshot,
} from "@/lib/workflow/execution/gemini-debug";

export type GeminiProTaskPayload = {
  input: GeminiInvokeInput;
};

export const geminiProTask = task({
  id: "gemini-pro",
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: GeminiProTaskPayload) => {
    logGeminiEnvSnapshot("gemini-pro task worker env");
    logGeminiDebug("gemini-pro task payload summary", {
      promptLength: payload.input.prompt?.length ?? 0,
      hasSystemPrompt: Boolean(payload.input.systemPrompt?.trim()),
      hasImageUrl: Boolean(payload.input.imageUrl),
      temperature: payload.input.temperature,
      maxOutputTokens: payload.input.maxOutputTokens,
    });

    const result = await invokeGemini(payload.input);

    if (!result.success) {
      logGeminiDebug("gemini-pro task invokeGemini failed", {
        error: result.error,
        quotaExceeded: result.quotaExceeded ?? false,
      });
      throw new Error(result.error);
    }

    logGeminiDebug("gemini-pro task invokeGemini succeeded", {
      responseLength: result.text.length,
    });

    return {
      response: result.text,
    };
  },
});
