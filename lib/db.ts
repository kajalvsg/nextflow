import type { PrismaClient } from "@prisma/client";
import { logFullError } from "@/lib/db/prisma-error";
import { prisma, initializeLocalPrisma, ensureRemotePrismaClient, isLocalPrismaReady } from "@/lib/prisma";
import { resolveDatabaseBackend } from "@/lib/db/database-mode";
import {
  initLocalDatabase,
  isLocalDatabaseEnabled,
  reopenLocalDatabaseConnectionInternal,
  withLocalDbExclusive,
} from "@/lib/db/local-pglite";

let localDbReady: Promise<void> | null = null;

const REOPEN_MAX_ATTEMPTS = 5;
const REOPEN_RETRY_MS = 200;

export function resetDbReadyState(): void {
  localDbReady = null;
}

export async function ensureDbReady(): Promise<void> {
  const mode = await resolveDatabaseBackend();

  if (mode === "postgres") {
    ensureRemotePrismaClient();
    return;
  }

  if (!isLocalPrismaReady()) {
    resetDbReadyState();
  }

  localDbReady ??= (async () => {
    const pglite = await initLocalDatabase();
    initializeLocalPrisma(pglite);
  })();

  try {
    await localDbReady;
  } catch (error) {
    logFullError("db ensureDbReady", error);
    resetDbReadyState();
    throw error;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reopenForCrossProcessRead(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= REOPEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      await reopenLocalDatabaseConnectionInternal();
      return;
    } catch (error) {
      lastError = error;
      logFullError(`db reopenForCrossProcessRead attempt ${attempt}`, error);

      if (attempt < REOPEN_MAX_ATTEMPTS) {
        await wait(REOPEN_RETRY_MS * attempt);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to reopen local database for cross-process read.");
}

/**
 * Serialize local reads and reopen the PGlite connection on every read so
 * polling sees Trigger.dev worker writes on the shared on-disk database.
 */
export async function withFreshLocalRead<T>(
  fn: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!isLocalDatabaseEnabled()) {
    await ensureDbReady();
    return fn(prisma);
  }

  return withLocalDbExclusive(async () => {
    await reopenForCrossProcessRead();
    return fn(prisma);
  });
}

export async function getDb() {
  await ensureDbReady();
  return prisma;
}

export const db = prisma;

export default db;
