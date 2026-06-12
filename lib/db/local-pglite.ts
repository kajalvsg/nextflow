import "server-only";

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { resetLocalPrismaClient } from "@/lib/prisma";

const LOCAL_DB_PATH = join(process.cwd(), "data", "pglite");
const INIT_SQL_PATH = join(process.cwd(), "prisma", "sql", "init.sql");

let pglite: PGlite | null = null;
let initialized = false;
let initPromise: Promise<PGlite> | null = null;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortedError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return message.includes("aborted");
}

async function applySchema(db: PGlite): Promise<void> {
  const sql = readFileSync(INIT_SQL_PATH, "utf8");
  await db.exec(sql);
}

async function closePgliteInstance(instance: PGlite | null): Promise<void> {
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
  resetLocalPrismaClient();

  void import("@/lib/db").then(({ resetDbReadyState }) => {
    resetDbReadyState();
  });
}

async function recoverLocalDatabase(cause: unknown): Promise<PGlite> {
  console.warn(
    "[local-pglite] Recovering local database after open failure:",
    cause instanceof Error ? cause.message : cause,
  );

  const previous = pglite;
  invalidateLocalDatabase();
  await closePgliteInstance(previous);

  const { resetDbReadyState } = await import("@/lib/db");
  resetDbReadyState();

  rmSync(LOCAL_DB_PATH, { recursive: true, force: true });
  mkdirSync(dirname(LOCAL_DB_PATH), { recursive: true });

  const db = await PGlite.create(LOCAL_DB_PATH);
  await applySchema(db);
  await db.query("SELECT 1 AS ok");
  initialized = true;
  pglite = db;

  return db;
}

async function openPgliteDatabase(): Promise<PGlite> {
  mkdirSync(dirname(LOCAL_DB_PATH), { recursive: true });

  if (pglite) {
    try {
      await pglite.query("SELECT 1 AS ok");
      return pglite;
    } catch (error) {
      console.warn(
        "[local-pglite] Existing instance failed health check, reopening:",
        error instanceof Error ? error.message : error,
      );
      await closePgliteInstance(pglite);
      pglite = null;
    }
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const db = await PGlite.create(LOCAL_DB_PATH);
      await db.query("SELECT 1 AS ok");
      return db;
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isAbortedError(error);

      if (shouldRetry) {
        console.warn(
          `[local-pglite] Open attempt ${attempt} failed with Aborted(), retrying…`,
        );
        await wait(250 * attempt);
        continue;
      }

      return recoverLocalDatabase(error);
    }
  }

  throw new Error("Failed to open local PGlite database.");
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
    initPromise = null;
    pglite = null;
    initialized = false;
    throw error;
  }
}

export async function initLocalDatabase(): Promise<PGlite> {
  return getLocalPglite();
}

export function isLocalDatabaseEnabled(): boolean {
  return process.env.USE_LOCAL_DB === "true";
}

export { LOCAL_DB_PATH };
