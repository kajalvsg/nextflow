import "server-only";

import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { logFullError } from "@/lib/db/prisma-error";
import { resolveProjectRoot } from "@/lib/db/project-root";
import { isLocalDatabaseEnabled } from "@/lib/db/database-mode";

function getLocalDbPath(): string {
  return resolve(resolveProjectRoot(), "data", "pglite");
}

function getInitSqlPath(): string {
  return join(resolveProjectRoot(), "prisma", "sql", "init.sql");
}

let pglite: PGlite | null = null;
let initialized = false;
let initPromise: Promise<PGlite> | null = null;
let dbOperationChain: Promise<unknown> = Promise.resolve();

const OPEN_MAX_ATTEMPTS = 10;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortedError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes("aborted");
}

function isMissingDatabaseError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return message.includes("enoent") || message.includes("no such file");
}

function isRetryableOpenError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    isAbortedError(error) ||
    message.includes("locked") ||
    message.includes("busy") ||
    message.includes("resource")
  );
}

export function withLocalDbExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = dbOperationChain.then(fn, fn);
  dbOperationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function applySchema(db: PGlite): Promise<void> {
  const sql = readFileSync(getInitSqlPath(), "utf8");
  await db.exec(sql);
}

export async function closePgliteInstance(instance: PGlite | null): Promise<void> {
  if (!instance) {
    return;
  }

  try {
    await instance.close();
  } catch {
    // Ignore close errors during recovery.
  }
}

export function invalidateLocalDatabase(): void {
  initPromise = null;
  initialized = false;
  pglite = null;

  void import("@/lib/prisma").then(({ resetLocalPrismaClient }) => {
    resetLocalPrismaClient();
  });

  void import("@/lib/db").then(({ resetDbReadyState }) => {
    resetDbReadyState();
  });
}

async function createFreshPgliteInstance(localDbPath: string): Promise<PGlite> {
  for (let attempt = 1; attempt <= OPEN_MAX_ATTEMPTS; attempt += 1) {
    try {
      const db = await PGlite.create(localDbPath);
      await db.query("SELECT 1 AS ok");
      return db;
    } catch (error) {
      const shouldRetry =
        attempt < OPEN_MAX_ATTEMPTS && isRetryableOpenError(error);

      if (shouldRetry) {
        logFullError(`local-pglite open attempt ${attempt}`, error);
        console.warn(
          `[local-pglite] Open attempt ${attempt}/${OPEN_MAX_ATTEMPTS} failed (${getErrorMessage(error)}), retrying…`,
        );
        await wait(300 * attempt);
        continue;
      }

      if (isMissingDatabaseError(error)) {
        return initializeMissingDatabase(localDbPath);
      }

      logFullError("local-pglite createFreshPgliteInstance", error);
      throw new Error(
        `[local-pglite] Failed to open database after ${attempt} attempt(s): ${getErrorMessage(error)}`,
        { cause: error },
      );
    }
  }

  throw new Error("Failed to open local PGlite database.");
}

async function initializeMissingDatabase(localDbPath: string): Promise<PGlite> {
  console.warn(
    "[local-pglite] Database files missing, creating a new local database:",
    localDbPath,
  );

  mkdirSync(localDbPath, { recursive: true });

  const db = await PGlite.create(localDbPath);
  await applySchema(db);
  await db.query("SELECT 1 AS ok");
  initialized = true;
  pglite = db;

  return db;
}

async function openPgliteDatabase(): Promise<PGlite> {
  const localDbPath = getLocalDbPath();
  mkdirSync(localDbPath, { recursive: true });

  if (pglite) {
    try {
      await pglite.query("SELECT 1 AS ok");
      return pglite;
    } catch (error) {
      logFullError("local-pglite health check", error);
      console.warn(
        "[local-pglite] Existing instance failed health check, reopening:",
        getErrorMessage(error),
      );
      await closePgliteInstance(pglite);
      pglite = null;
    }
  }

  return createFreshPgliteInstance(localDbPath);
}

async function reopenLocalDatabaseConnectionInternal(): Promise<void> {
  const previous = pglite;
  await closePgliteInstance(previous);

  pglite = null;
  initPromise = null;
  initialized = true;

  const { initializeLocalPrisma, resetLocalPrismaClient } = await import(
    "@/lib/prisma"
  );
  resetLocalPrismaClient();

  const db = await openPgliteDatabase();
  pglite = db;
  initializeLocalPrisma(db);
}

export async function getLocalPglite(): Promise<PGlite> {
  if (pglite) {
    try {
      await pglite.query("SELECT 1 AS ok");
      return pglite;
    } catch {
      invalidateLocalDatabase();
    }
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const db = await openPgliteDatabase();

    if (!initialized) {
      await applySchema(db);
      initialized = true;
    }

    pglite = db;
    return db;
  })();

  try {
    return await initPromise;
  } catch (error) {
    logFullError("local-pglite getLocalPglite", error);
    initPromise = null;
    pglite = null;
    initialized = false;
    throw error;
  }
}

export async function initLocalDatabase(): Promise<PGlite> {
  return getLocalPglite();
}

/**
 * Re-open the on-disk PGlite connection so reads see writes from other
 * processes (e.g. Trigger.dev worker) during local dev.
 */
export async function reopenLocalDatabaseConnection(): Promise<void> {
  if (!isLocalDatabaseEnabled()) {
    return;
  }

  await withLocalDbExclusive(reopenLocalDatabaseConnectionInternal);
}

/**
 * Close the local PGlite handle after a write so another process (Next.js ↔
 * Trigger.dev) can open the on-disk database and see committed rows.
 */
export async function releaseLocalDatabaseAfterWrite(): Promise<void> {
  const { resolveDatabaseBackend } = await import("@/lib/db/database-mode");
  const backend = await resolveDatabaseBackend();

  if (backend !== "local") {
    return;
  }

  await withLocalDbExclusive(async () => {
    await closePgliteInstance(pglite);
    pglite = null;
    initPromise = null;

    const { resetLocalPrismaClient } = await import("@/lib/prisma");
    resetLocalPrismaClient();

    const { resetDbReadyState } = await import("@/lib/db");
    resetDbReadyState();
  });
}

export { reopenLocalDatabaseConnectionInternal };

/** @deprecated Use reopenLocalDatabaseConnection instead. */
export async function refreshLocalDatabaseConnection(): Promise<void> {
  return reopenLocalDatabaseConnection();
}

export { isLocalDatabaseEnabled } from "@/lib/db/database-mode";

export function getLocalDatabasePath(): string {
  return getLocalDbPath();
}
