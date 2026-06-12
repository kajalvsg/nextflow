const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
]);

function isRetryableDbError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";

  // Timeouts already waited long enough — retrying makes pages hang.
  if (code === "ETIMEDOUT" || code === "ENOTFOUND") {
    return false;
  }

  if (RETRYABLE_CODES.has(code)) {
    return true;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("connection terminated") ||
    message.includes("connection refused")
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_DB_TIMEOUT_MS = 10_000;

export async function withDbTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = DEFAULT_DB_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Database connection timed out. Check DATABASE_URL and your network."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function withDbRetry<T>(
  operation: () => Promise<T>,
  attempts = 2,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableDbError(error) || attempt === attempts) {
        throw error;
      }

      await wait(750);
    }
  }

  throw lastError;
}

export function getDbErrorMessage(error: unknown): string {
  const usingLocalDb = process.env.USE_LOCAL_DB === "true";

  if (error && typeof error === "object" && "code" in error) {
    const code = String(error.code);

    if (code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "P2024") {
      if (usingLocalDb) {
        return "Local database failed to start. Run npm run db:push, then restart the dev server.";
      }

      return "Could not reach Neon. Open console.neon.tech, copy a fresh pooled DATABASE_URL into .env.local, run npm run db:push, then restart the dev server.";
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("aborted") ||
      message.includes("pglite") ||
      message.includes("not ready") ||
      message.includes("wasm")
    ) {
      return "Local database failed to start. Run npm run db:push, then restart the dev server.";
    }

    if (
      message.includes("timed out") ||
      message.includes("timeout") ||
      message.includes("fetch failed") ||
      message.includes("connect timeout") ||
      (message.includes("connect") && !usingLocalDb)
    ) {
      if (usingLocalDb) {
        return "Local database failed to start. Run npm run db:push, then restart the dev server.";
      }

      return "Could not reach Neon. Open console.neon.tech, copy a fresh pooled DATABASE_URL into .env.local, run npm run db:push, then restart the dev server.";
    }

    return error.message;
  }

  return "Database connection failed.";
}
