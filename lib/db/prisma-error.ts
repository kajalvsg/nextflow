type ErrorRecord = {
  message?: string;
  stack?: string;
  code?: string;
  meta?: unknown;
};

function readErrorRecord(error: unknown): ErrorRecord {
  if (error instanceof Error) {
    const record = error as Error & { code?: string; meta?: unknown };

    return {
      message: record.message,
      stack: record.stack,
      code: record.code,
      meta: record.meta,
    };
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    return {
      message: typeof record.message === "string" ? record.message : undefined,
      stack: typeof record.stack === "string" ? record.stack : undefined,
      code: record.code !== undefined ? String(record.code) : undefined,
      meta: record.meta,
    };
  }

  return {
    message: error === undefined ? undefined : String(error),
  };
}

/** Log full error details for Prisma and generic failures (Trigger.dev / server). */
export function logFullError(context: string, error: unknown): void {
  const prefix = context ? `[${context}] ` : "";
  const record = readErrorRecord(error);

  console.error(`${prefix}FULL ERROR:`, error);
  console.error(`${prefix}MESSAGE:`, record.message);
  console.error(`${prefix}STACK:`, record.stack);

  try {
    console.error(`${prefix}STRINGIFIED:`, JSON.stringify(error, null, 2));
  } catch (stringifyError) {
    console.error(`${prefix}STRINGIFIED:`, String(error));
    console.error(`${prefix}STRINGIFY FAILED:`, stringifyError);
  }

  if (record.code !== undefined) {
    console.error(`${prefix}PRISMA CODE:`, record.code);
  }

  if (record.meta !== undefined) {
    console.error(`${prefix}PRISMA META:`, record.meta);
  }
}

export function formatPrismaError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message && error.message !== "[object Object]") {
      return error;
    }

    const prismaCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;

    if (prismaCode) {
      return new Error(
        `Database error (${prismaCode}): ${error.message || "unknown"}`,
      );
    }
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [
      record.code ? `code=${String(record.code)}` : null,
      record.message ? String(record.message) : null,
      record.meta ? JSON.stringify(record.meta) : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      return new Error(`Database error: ${parts.join(" ")}`);
    }
  }

  return new Error(
    error instanceof Error ? error.message : "Database operation failed.",
  );
}
