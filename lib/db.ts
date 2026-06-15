import type { PrismaClient } from "@prisma/client";
import { prisma, initializeLocalPrisma, ensureRemotePrismaClient } from "@/lib/prisma";
import { resolveDatabaseBackend } from "@/lib/db/database-mode";
import {
  initLocalDatabase,
  isLocalDatabaseEnabled,
  reopenLocalDatabaseConnectionInternal,
  withLocalDbExclusive,
} from "@/lib/db/local-pglite";

let localDbReady: Promise<void> | null = null;
let lastReopenAt = 0;

const REOPEN_THROTTLE_MS = 3_000;

export function resetDbReadyState(): void {
  localDbReady = null;
}

export async function ensureDbReady(): Promise<void> {
  const mode = await resolveDatabaseBackend();

  if (mode === "postgres") {
    ensureRemotePrismaClient();
    return;
  }

  localDbReady ??= (async () => {
    const pglite = await initLocalDatabase();
    initializeLocalPrisma(pglite);
  })();

  try {
    await localDbReady;
  } catch (error) {
    resetDbReadyState();
    throw error;
  }
}

/**
 * Serialize local reads and periodically reopen the main PGlite connection so
 * polling sees Trigger.dev worker writes without opening extra connections.
 */
export async function withFreshLocalRead<T>(
  fn: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  if (!isLocalDatabaseEnabled()) {
    await ensureDbReady();
    return fn(prisma);
  }

  return withLocalDbExclusive(async () => {
    await ensureDbReady();

    const now = Date.now();

    if (now - lastReopenAt >= REOPEN_THROTTLE_MS) {
      lastReopenAt = now;

      try {
        await reopenLocalDatabaseConnectionInternal();
      } catch (error) {
        console.warn(
          "[db] reopenLocalDatabaseConnection skipped:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    return fn(prisma);
  });
}

export async function getDb() {
  await ensureDbReady();
  return prisma;
}

export const db = prisma;

export default db;
